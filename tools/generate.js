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
import { validateIngredientStepConsistency } from './lib/validate-recipe-consistency.js';
import { crawlRefRecipes } from './lib/recipe-crawler.js';
import { reviewRecipeWithRefs } from './lib/recipe-reviewer.js';

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
    .option('--gen-images-only', '仅对已有草稿补图（需配合 --draft 使用，不再调用 LLM）')
    .option('--draft <file>', '草稿 JSON 路径（与 --gen-images-only 一起用时，只对该草稿出图）', '')
    .option('--with-ref', '生成后按菜名爬取下厨房/爱料理参考菜谱并写入草稿')
    .option('--auto-review', '生成并爬取参考后用 AI 做交叉校验并写入草稿（建议与 --with-ref 同用）')
    .parse(process.argv);

  const opts = program.opts();
  const mode = opts.mode;
  const input = opts.input;
  const count = opts.count;
  const draftsDir = CONFIG.draftsDir;
  if (!fs.existsSync(draftsDir)) {
    fs.mkdirSync(draftsDir, { recursive: true });
  }

  // ========== 仅对已有草稿补图（不调用 LLM） ==========
  if (opts.genImagesOnly && opts.draft) {
    const draftPath = path.isAbsolute(opts.draft) ? opts.draft : path.resolve(process.cwd(), opts.draft);
    if (!fs.existsSync(draftPath)) {
      console.error(chalk.red(`草稿不存在: ${draftPath}`));
      process.exit(1);
    }
    const payload = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    if (!payload.items || !Array.isArray(payload.items)) {
      console.error(chalk.red('草稿格式错误：缺少 items 数组'));
      process.exit(1);
    }
    const apiKey = (CONFIG.minimaxApiKey || '').trim();
    if (!apiKey) {
      console.error(chalk.red('未配置 MINIMAX_API_KEY，请在 tools/.env 中设置'));
      process.exit(1);
    }
    const resolvedHost = (CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com')
      ? CONFIG.minimaxHost
      : 'api.minimax.io';
    console.log(chalk.cyan(`\n[generate] 仅补图，草稿: ${draftPath}，共 ${payload.items.length} 道`));
    console.log(chalk.gray(`MiniMax: ${resolvedHost}，模型: ${CONFIG.minimaxModel}`));
    const imagesDir = path.join(draftsDir, 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    const minimaxOpts = { host: resolvedHost, model: CONFIG.minimaxModel };
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
      console.log(chalk.cyan(`\n[${i + 1}/${payload.items.length}] ${it.recipe.name} 正在出图（约 20–60 秒）…`));
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
    fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    console.log(chalk.green(`\n草稿已更新: ${draftPath}，可运行 sync 上传。`));
    return;
  }

  // 读取已有菜名（本地 + 云端），告知 LLM 不要生成重复菜品
  const localNames = loadExistingRecipeNames();
  let excludeNames = localNames;
  try {
    const { fetchExistingNames } = await import('./lib/cloud-db.js');
    const { names: cloudNamesSet } = await fetchExistingNames();
    const cloudNames = Array.from(cloudNamesSet);
    if (cloudNames.length > 0) {
      excludeNames = [...new Set([...localNames, ...cloudNames])];
      console.log(chalk.gray(`[generate] 排除列表：本地 ${localNames.length} + 云端 ${cloudNames.length} = ${excludeNames.length} 道`));
    }
  } catch (e) {
    console.warn(chalk.yellow('⚠ 无法拉取云端菜名，仅使用本地排除列表: ' + (e && e.message ? e.message : String(e))));
  }
  const provider = CONFIG.llmProvider === 'minimax' ? 'MiniMax' : 'Claude';
  const modelName = CONFIG.llmProvider === 'minimax' ? CONFIG.minimaxLlmModel : CONFIG.llmModel;
  console.log(chalk.cyan(`\n[generate] mode=${mode}, count=${count}, 已有菜谱=${excludeNames.length} 道，LLM: ${provider} (${modelName})`));
  if (count >= 6) {
    console.log(chalk.gray('（count≥6 已启用两批并行请求，总耗时会明显缩短）'));
  }

  const raw = await generateRecipesFromInput({ mode, input, count, excludeNames });
  const normalized = normalizeGeneratedItems(raw);
  const withPrompts = ensurePromptsForItems(normalized);

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
      image_file: null,
      ref_recipes: null,
      review: null
    }))
  };

  // 生成后自动跑一遍配料-步骤与烹饪逻辑校验，输出警告
  payload.items.forEach((it) => {
    const recipe = it.recipe;
    const v = validateIngredientStepConsistency(recipe);
    if (!v.ok || (v.warnings && v.warnings.length > 0) || (v.errors && v.errors.length > 0)) {
      console.log(chalk.yellow(`  [校验] ${recipe.name}:`));
      if (v.errors && v.errors.length) {
        v.errors.forEach((e) => console.log(chalk.red(`    [错误] ${e}`)));
      }
      if (v.missingInSteps && v.missingInSteps.length) {
        console.log(chalk.yellow(`    配料未在步骤中出现: ${v.missingInSteps.join('、')}`));
      }
      if (v.mentionedNotInList && v.mentionedNotInList.length) {
        console.log(chalk.yellow(`    步骤中提到但配料表无: ${v.mentionedNotInList.join('、')}`));
      }
      if (v.warnings && v.warnings.length) {
        v.warnings.forEach((w) => console.log(chalk.yellow(`    ${w}`)));
      }
    }
  });

  // --with-ref: 按菜名爬取参考菜谱
  if (opts.withRef) {
    console.log(chalk.cyan('\n[generate] 正在爬取参考菜谱（下厨房/爱料理）…'));
    for (let i = 0; i < payload.items.length; i += 1) {
      const it = payload.items[i];
      const name = it.recipe && it.recipe.name;
      if (!name) continue;
      try {
        const refs = await crawlRefRecipes(name, { maxPerSite: 2 });
        it.ref_recipes = refs;
        console.log(chalk.gray(`  ${name}: ${refs.length} 条参考`));
      } catch (err) {
        console.warn(chalk.yellow(`  ${name} 爬取失败: ${err.message}`));
        it.ref_recipes = [];
      }
    }
  }

  // --auto-review: AI 交叉校验（建议与 --with-ref 同用）
  if (opts.autoReview) {
    console.log(chalk.cyan('\n[generate] 正在 AI 交叉校验…'));
    for (let i = 0; i < payload.items.length; i += 1) {
      const it = payload.items[i];
      const refs = it.ref_recipes || [];
      try {
        const review = await reviewRecipeWithRefs(it.recipe, refs);
        it.review = review;
        const tag = review.verdict === 'pass' ? chalk.green : review.verdict === 'warn' ? chalk.yellow : chalk.red;
        console.log(chalk.gray(`  ${it.recipe.name}: ${tag(review.overall)} 分 (${review.verdict})`));
      } catch (err) {
        console.warn(chalk.yellow(`  ${it.recipe.name} 校验失败: ${err.message}`));
        it.review = { scores: {}, overall: 0, verdict: 'fail', suggestions: [], needs_revision: true };
      }
    }
  }

  fs.writeFileSync(filename, JSON.stringify(payload, null, 2), 'utf8');

  console.log(chalk.green(`\n已生成草稿: ${filename}`));

  if (!opts.genImages) {
    console.log(chalk.yellow('  提示：未加 --gen-images，草稿中暂无封面图。'));
    console.log(chalk.gray('  若需自动出图：可对本草稿补图 → node tools/generate.js --gen-images-only --draft ' + path.relative(process.cwd(), filename)));
  }

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
      console.log(chalk.gray(`\nMiniMax 请求: ${hostDesc}，模型: ${CONFIG.minimaxModel}（可在 .env 设置 MINIMAX_HOST / MINIMAX_MODEL）`));
      const imagesDir = path.join(draftsDir, 'images');
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      const minimaxOpts = { host: resolvedHost, model: CONFIG.minimaxModel };
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

