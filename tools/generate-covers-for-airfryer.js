#!/usr/bin/env node
/**
 * 为 recipes.js 中「空气炸锅替代菜谱」自动生成封面图并上传到云存储 adults_recipes/
 * 同时更新 recipeCoverSlugs.js，使前端能正确展示封面。
 *
 * 使用方式：
 *   cd tools && node generate-covers-for-airfryer.js
 *   node generate-covers-for-airfryer.js --dry-run   # 只出图不上传、不写 slug
 *
 * 依赖：tools/.env 中 MINIMAX_API_KEY、TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY
 *      或复用 cloudfunctions/recipeCoverGen/secret-config.json 的 MiniMax Key
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Command } from 'commander';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

import { CONFIG } from './config.js';
import { generateImage } from './lib/minimax-image.js';
import { uploadAdultRecipeImage } from './lib/cloud-uploader.js';
import { applyLocalPatches } from './lib/local-file-patcher.js';

// 9 道空气炸锅菜：菜名 → 云存储文件名（与 recipeCoverSlugs 约定一致，扩展名 .jpg 与 MiniMax 输出一致）
const AIRFRYER_NAME_TO_SLUG = {
  '空气炸锅蜜汁鸡翅': 'air_fryer_honey_chicken_wings.jpg',
  '空气炸锅盐焗鸡腿': 'air_fryer_salt_baked_chicken_drumsticks.jpg',
  '空气炸锅脆皮五花肉': 'air_fryer_crispy_pork_belly.jpg',
  '空气炸锅蒜香排骨': 'air_fryer_garlic_ribs.jpg',
  '空气炸锅黑椒牛肉粒': 'air_fryer_black_pepper_beef_cubes.jpg',
  '空气炸锅香酥鳕鱼块': 'air_fryer_crispy_cod_bites.jpg',
  '空气炸锅椒盐虾': 'air_fryer_salt_pepper_shrimp.jpg',
  '空气炸锅蒜香杏鲍菇': 'air_fryer_garlic_king_oyster_mushroom.jpg',
  '空气炸锅孜然土豆块': 'air_fryer_cumin_potato_cubes.jpg',
};

/**
 * 从 recipes.js 中筛出 is_airfryer_alt 的成人菜
 */
function loadAirFryerRecipes() {
  const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
  const mod = require(recipesPath);
  const list = mod.adultRecipes || [];
  return list.filter((r) => r && (r.is_airfryer_alt === true || r.cook_type === 'air_fryer'));
}

async function main() {
  const program = new Command();
  program
    .option('--dry-run', '只生成图片到 drafts/images，不上传、不更新 recipeCoverSlugs.js', false)
    .parse(process.argv);

  const dryRun = !!program.opts().dryRun;

  const recipes = loadAirFryerRecipes();
  if (recipes.length === 0) {
    console.log(chalk.yellow('未在 recipes.js 中找到空气炸锅菜（is_airfryer_alt / cook_type: air_fryer）'));
    process.exit(0);
  }

  const apiKey = (CONFIG.minimaxApiKey || '').trim();
  if (!apiKey) {
    console.error(chalk.red('未配置 MINIMAX_API_KEY，请在 tools/.env 或 cloudfunctions/recipeCoverGen/secret-config.json 中设置'));
    process.exit(1);
  }

  if (!dryRun && (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey)) {
    console.error(chalk.red('上传需腾讯云配置，请在 tools/.env 中设置 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY'));
    process.exit(1);
  }

  const coverPrompt = require(path.join(CONFIG.projectRoot, 'cloudfunctions', 'recipeCoverGen', 'lib', 'cover-prompt.js')).buildCoverPrompt;
  const imagesDir = path.join(CONFIG.draftsDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const resolvedHost =
    CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com'
      ? CONFIG.minimaxHost
      : 'api.minimax.io';
  const minimaxOpts = { host: resolvedHost };

  const slugMap = {};
  let failed = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const name = recipe.name && recipe.name.trim();
    if (!name) continue;

    const fileName = AIRFRYER_NAME_TO_SLUG[name];
    if (!fileName) {
      console.log(chalk.yellow(`  跳过未配置 slug 的菜: ${name}`));
      continue;
    }

    console.log(chalk.cyan(`\n[${i + 1}/${recipes.length}] ${name}`));

    const prompt = coverPrompt(recipe);
    if (!prompt) {
      console.error(chalk.red('  无法生成 cover prompt'));
      failed++;
      continue;
    }

    const localPath = path.join(imagesDir, fileName);
    try {
      console.log(chalk.gray('  正在请求 MiniMax 出图（约 20–60 秒）…'));
      const buffer = await generateImage(apiKey, prompt, minimaxOpts);
      fs.writeFileSync(localPath, buffer);
      console.log(chalk.green(`  已保存: ${fileName}`));
    } catch (err) {
      console.error(chalk.red(`  出图失败: ${err.message}`));
      failed++;
      continue;
    }

    if (!dryRun) {
      try {
        const fileID = await uploadAdultRecipeImage(localPath, fileName);
        console.log(chalk.green(`  已上传云存储: ${fileID ? fileID.slice(0, 60) + '...' : fileID}`));
      } catch (err) {
        console.error(chalk.red(`  上传失败: ${err.message}`));
        failed++;
        continue;
      }
    } else {
      console.log(chalk.gray(`  (dry-run) 将上传: adults_recipes/${fileName}`));
    }

    slugMap[name] = fileName;
  }

  if (Object.keys(slugMap).length > 0 && !dryRun) {
    try {
      applyLocalPatches({ slug: slugMap });
      console.log(chalk.green(`\n已更新 recipeCoverSlugs.js，新增 ${Object.keys(slugMap).length} 条封面映射（已备份 .bak）`));
    } catch (err) {
      console.error(chalk.red('\n更新 recipeCoverSlugs.js 失败: ' + err.message));
    }
  } else if (dryRun && Object.keys(slugMap).length > 0) {
    console.log(chalk.yellow(`\n(dry-run) 将向 recipeCoverSlugs.js 写入 ${Object.keys(slugMap).length} 条`));
  }

  if (failed > 0) {
    console.log(chalk.yellow(`\n共 ${failed} 道菜未完成`));
    process.exit(1);
  }
  console.log(chalk.green('\n全部完成'));
}

main().catch((err) => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});
