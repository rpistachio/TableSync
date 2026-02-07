#!/usr/bin/env node
/**
 * 将 optimize-recipes.js 生成的优化草稿写回 miniprogram/data/recipes.js.bak。
 * 仅更新 adultRecipes 中与草稿 id 匹配的菜谱的 ingredients、steps、baby_variant，其余内容与 babyRecipes、templateCombos 保持不变。
 *
 * 用法：
 *   node tools/apply-optimized.js --draft tools/drafts/optimized_2026-02-07.json
 *   node tools/apply-optimized.js --dry-run   # 仅预览将更新的 id，不写文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Command } from 'commander';
import chalk from 'chalk';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

function loadBackupFile(backupPath) {
  const content = fs.readFileSync(backupPath, 'utf8');
  const idxAdult = content.indexOf('var adultRecipes = [');
  let idxBaby = content.indexOf('\nvar babyRecipes = [');
  if (idxBaby === -1) idxBaby = content.indexOf('var babyRecipes = [');
  if (idxAdult === -1 || idxBaby === -1) {
    throw new Error('recipes.js.bak 格式异常：未找到 var adultRecipes = [ 或 var babyRecipes = [');
  }
  return {
    content,
    beforeAdult: content.slice(0, idxAdult + 'var adultRecipes = ['.length),
    afterAdult: content.slice(idxBaby)
  };
}

function loadBackupModule(backupPath) {
  return require(backupPath);
}

function mergeOptimizedIntoAdultRecipes(adultRecipes, draftItems) {
  const idToOptimized = new Map();
  draftItems.forEach((item) => {
    const recipe = item && item.recipe;
    if (recipe && recipe.id) idToOptimized.set(recipe.id, recipe);
  });

  return adultRecipes.map((orig) => {
    const opt = idToOptimized.get(orig.id);
    if (!opt) return orig;
    return {
      ...orig,
      ingredients: Array.isArray(opt.ingredients) ? opt.ingredients : orig.ingredients,
      steps: Array.isArray(opt.steps) ? opt.steps : orig.steps,
      baby_variant: opt.baby_variant !== undefined ? opt.baby_variant : orig.baby_variant
    };
  });
}

function main() {
  const program = new Command();
  program
    .option('--draft <path>', '优化草稿 JSON 路径（如 drafts/optimized_2026-02-07.json）', '')
    .option('--dry-run', '仅预览将更新的 id，不写文件', false)
    .parse(process.argv);

  const opts = program.opts();
  const dryRun = !!opts.dryRun;
  let draftPath = opts.draft;

  if (!draftPath) {
    const draftsDir = CONFIG.draftsDir;
    const files = fs.readdirSync(draftsDir).filter((f) => f.startsWith('optimized_') && f.endsWith('.json'));
    if (files.length === 0) {
      console.error(chalk.red('未找到 drafts/optimized_*.json，请先运行 optimize-recipes.js 或指定 --draft'));
      process.exit(1);
    }
    files.sort().reverse();
    draftPath = path.join(draftsDir, files[0]);
    console.log(chalk.cyan('使用草稿文件: ' + draftPath));
  }

  const absDraft = path.isAbsolute(draftPath) ? draftPath : path.join(CONFIG.projectRoot, draftPath);
  if (!fs.existsSync(absDraft)) {
    console.error(chalk.red('草稿文件不存在: ' + absDraft));
    process.exit(1);
  }

  const backupPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js.bak');
  if (!fs.existsSync(backupPath)) {
    console.error(chalk.red('recipes.js.bak 不存在: ' + backupPath));
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(absDraft, 'utf8'));
  const draftItems = payload.items || [];
  const ids = draftItems.map((i) => i.recipe && i.recipe.id).filter(Boolean);

  const mod = loadBackupModule(backupPath);
  const mergedAdult = mergeOptimizedIntoAdultRecipes(mod.adultRecipes || [], draftItems);

  console.log(chalk.cyan(`将更新 recipes.js.bak 中 ${ids.length} 道菜: ${ids.join(', ')}`));

  if (dryRun) {
    console.log(chalk.yellow('\n[dry-run] 去掉 --dry-run 将写回 recipes.js.bak'));
    return;
  }

  const { beforeAdult, afterAdult } = loadBackupFile(backupPath);
  const newAdultJson = JSON.stringify(mergedAdult, null, 2);
  const newContent = beforeAdult + '\n' + newAdultJson + ';\n\n' + afterAdult;

  fs.writeFileSync(backupPath, newContent, 'utf8');
  console.log(chalk.green('\n已写回 ' + backupPath + '。可运行 batch-sync-recipes.js --force 同步到云端。'));
}

main();
