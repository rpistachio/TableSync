#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Command } from 'commander';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { generateRecipesFromInput } from './lib/llm-client.js';
import { normalizeGeneratedItems } from './lib/recipe-formatter.js';
import { ensurePromptsForItems } from './lib/mj-prompt-builder.js';
import { generateImage } from './lib/minimax-image.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

/**
 * 从本地 recipes.js 读取所有已有菜名（大人+宝宝）
 */
function loadExistingRecipeNames() {
  const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
  try {
    const mod = require(recipesPath);
    const names = [];
    if (Array.isArray(mod.adultRecipes)) {
      mod.adultRecipes.forEach(r => { if (r && r.name) names.push(r.name); });
    }
    if (Array.isArray(mod.babyRecipes)) {
      mod.babyRecipes.forEach(r => { if (r && r.name) names.push(r.name); });
    }
    return names;
  } catch (e) {
    console.warn(chalk.yellow('⚠ 读取 recipes.js 失败，跳过排除列表'));
    return [];
  }
}

async function main() {
  const program = new Command();
  program
    .option('--mode <mode>', '生成模式: trending|url|text', 'trending')
    .option('--input <input>', '输入内容（主题 / URL / 文本）', '养生滋补家常菜')
    .option('--count <n>', '生成菜谱数量', (v) => Number(v), CONFIG.defaultGenerateCount)
    .option('--out <file>', '输出草稿文件路径', '')
    .option('--gen-images', '生成草稿后使用 MiniMax 按 MJ prompt 自动出图并写入 drafts/images')
    .parse(process.argv);

  const opts = program.opts();
  const mode = opts.mode;
  const input = opts.input;
  const count = opts.count;

  // 读取已有菜名，告知 LLM 不要生成重复菜品
  const excludeNames = loadExistingRecipeNames();
  console.log(chalk.cyan(`\n[generate] mode=${mode}, count=${count}, 已有菜谱=${excludeNames.length} 道`));

  const raw = await generateRecipesFromInput({ mode, input, count, excludeNames });
  const normalized = normalizeGeneratedItems(raw);
  const withPrompts = ensurePromptsForItems(normalized);

  const draftsDir = CONFIG.draftsDir;
  if (!fs.existsSync(draftsDir)) {
    fs.mkdirSync(draftsDir, { recursive: true });
  }

  const filename =
    opts.out ||
    path.join(
      draftsDir,
      `${new Date().toISOString().slice(0, 10)}_batch.json`
    );

  const payload = {
    generated_at: new Date().toISOString(),
    source: `${mode}:${input}`,
    items: withPrompts.items.map((it) => ({
      status: 'pending',
      recipe: it.recipe,
      slug: it.slug,
      mj_prompts: it.mj_prompts,
      selected_prompt_index: null,
      image_file: null
    }))
  };

  fs.writeFileSync(filename, JSON.stringify(payload, null, 2), 'utf8');

  console.log(chalk.green(`\n已生成草稿: ${filename}`));

  // 可选：使用 MiniMax 按 MJ prompt 自动出图
  if (opts.genImages) {
    const apiKey = (CONFIG.minimaxApiKey || '').trim();
    if (!apiKey) {
      console.log(chalk.yellow('\n未配置 MINIMAX_API_KEY，跳过自动出图。请在 tools/.env 中设置 MINIMAX_API_KEY 后使用 --gen-images。'));
    } else {
      // 未配置 host 时默认用国际站 api.minimax.io，避免国内站 2049 invalid api key（Key 多为国际站创建）
      const resolvedHost = (CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com')
        ? CONFIG.minimaxHost
        : 'api.minimax.io';
      const hostDesc = CONFIG.minimaxHost ? CONFIG.minimaxHost : 'api.minimax.io(未配置 host 时默认国际站)';
      console.log(chalk.gray(`\nMiniMax 请求地址: ${hostDesc}（Key 优先来自 tools/.env，未配置则用 cloudfunctions/recipeCoverGen/secret-config.json）`));
      const imagesDir = path.join(draftsDir, 'images');
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      const minimaxOpts = { host: resolvedHost };
      for (let i = 0; i < payload.items.length; i += 1) {
        const it = payload.items[i];
        const slugMap = it.slug || {};
        const slugFileName = Object.values(slugMap)[0];
        if (!slugFileName || !it.mj_prompts || it.mj_prompts.length === 0) continue;
        const promptIndex = it.selected_prompt_index != null ? it.selected_prompt_index : 0;
        const prompt = it.mj_prompts[promptIndex] || it.mj_prompts[0];
        const baseName = slugFileName.replace(/\.png$/i, '');
        const imageFileName = `${baseName}.jpg`;
        const imagePath = path.join(imagesDir, imageFileName);
        const relPath = path.relative(__dirname, imagePath);
        console.log(chalk.cyan(`\n[${i + 1}/${payload.items.length}] ${it.recipe.name} 正在用 MiniMax 出图（约 20–60 秒）…`));
        try {
          const buffer = await generateImage(apiKey, prompt, minimaxOpts);
          fs.writeFileSync(imagePath, buffer);
          it.image_file = relPath;
          it.status = 'has_image';
          console.log(chalk.green(`  已保存: ${imageFileName}`));
        } catch (err) {
          console.error(chalk.red(`  出图失败: ${err.message}`));
        }
      }
      fs.writeFileSync(filename, JSON.stringify(payload, null, 2), 'utf8');
      console.log(chalk.green('\n草稿已更新（含 image_file），可运行 sync 上传。'));
    }
  }

  console.log(chalk.yellow('\n为每道菜生成的 3 组 MJ Prompt（可直接复制到 Discord）：\n'));
  payload.items.forEach((it, index) => {
    console.log(chalk.magenta(`\n[菜 ${index + 1}] ${it.recipe.name}\n`));
    it.mj_prompts.forEach((p, i) => {
      console.log(chalk.gray(`  Prompt ${i + 1}:`));
      console.log(`  ${p}\n`);
    });
  });
}

main().catch((err) => {
  console.error(chalk.red('\n[generate] 发生错误：'));
  console.error(err);
  process.exit(1);
});

