#!/usr/bin/env node
/**
 * 批量优化已有菜谱：从 recipes.js.bak 读取成人菜谱，按批调用 LLM 优化 ingredients、steps、baby_variant，
 * 输出到 drafts/optimized_YYYY-MM-DD.json，便于人工审核后通过 apply-optimized.js 写回。
 *
 * 用法：
 *   node tools/optimize-recipes.js                     # 优化全部成人菜谱
 *   node tools/optimize-recipes.js --dry-run          # 仅预览待优化列表，不调 API
 *   node tools/optimize-recipes.js --ids a-beef-1,a-chi-2   # 只优化指定 id
 *   node tools/optimize-recipes.js --batch-size 3      # 每批 3 道（默认 4）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Command } from 'commander';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { optimizeRecipesWithLlm } from './lib/llm-client.js';
import { validateIngredientStepConsistency } from './lib/validate-recipe-consistency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

const BATCH_DELAY_MS = 2000;

function loadAdultRecipesFromBackup() {
  const backupPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js.bak');
  if (!fs.existsSync(backupPath)) {
    throw new Error(`recipes.js.bak 不存在: ${backupPath}`);
  }
  const mod = require(backupPath);
  const list = mod.adultRecipes || [];
  return list.filter((r) => r && r.id && r.name);
}

function parseIdsOption(idsStr) {
  if (!idsStr || typeof idsStr !== 'string') return null;
  return idsStr.split(',').map((s) => s.trim()).filter(Boolean);
}

function mergeOptimizedIntoRecipe(original, optimized) {
  if (!optimized || !optimized.id) return original;
  return {
    ...original,
    ingredients: Array.isArray(optimized.ingredients) ? optimized.ingredients : original.ingredients,
    steps: Array.isArray(optimized.steps) ? optimized.steps : original.steps,
    baby_variant: optimized.baby_variant != null ? optimized.baby_variant : original.baby_variant
  };
}

function runValidation(recipe) {
  const merged = { name: recipe.name, id: recipe.id, ingredients: recipe.ingredients || [], steps: recipe.steps || [] };
  return validateIngredientStepConsistency(merged);
}

async function main() {
  const program = new Command();
  program
    .option('--dry-run', '仅列出待优化菜谱，不调用 LLM', false)
    .option('--ids <id1,id2,...>', '只优化指定 id 的菜谱')
    .option('--batch-size <n>', '每批发送给 LLM 的菜谱数量', (v) => Math.max(1, parseInt(v, 10) || 4), 4)
    .parse(process.argv);

  const opts = program.opts();
  const dryRun = !!opts.dryRun;
  const idFilter = parseIdsOption(opts.ids);
  const batchSize = opts.batchSize;

  let allRecipes = loadAdultRecipesFromBackup();
  if (idFilter && idFilter.length > 0) {
    allRecipes = allRecipes.filter((r) => idFilter.includes(r.id));
    if (allRecipes.length === 0) {
      console.log(chalk.yellow('未找到指定 id 的菜谱，请检查 --ids'));
      process.exit(1);
    }
  }

  console.log(chalk.cyan(`\n[optimize-recipes] 待优化: ${allRecipes.length} 道（batch-size=${batchSize}）\n`));

  if (dryRun) {
    allRecipes.forEach((r, i) => console.log(chalk.gray(`  ${i + 1}. ${r.id} ${r.name}`)));
    console.log(chalk.yellow('\n[dry-run] 去掉 --dry-run 将调用 LLM 进行优化。'));
    return;
  }

  const batches = [];
  for (let i = 0; i < allRecipes.length; i += batchSize) {
    batches.push(allRecipes.slice(i, i + batchSize));
  }

  const idToOriginal = new Map(allRecipes.map((r) => [r.id, r]));
  const allOptimizedItems = [];

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(chalk.cyan(`[batch ${b + 1}/${batches.length}] 正在优化: ${batch.map((r) => r.name).join('、')}`));
    try {
      const result = await optimizeRecipesWithLlm(batch);
      const items = result && result.items ? result.items : [];
      for (const item of items) {
        if (item.id && idToOriginal.has(item.id)) {
          allOptimizedItems.push({ original: idToOriginal.get(item.id), optimized: item });
        }
      }
    } catch (err) {
      console.error(chalk.red(`[batch ${b + 1}] 调用 LLM 失败: ${err.message}`));
      throw err;
    }
    if (b < batches.length - 1) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const mergedRecipes = allOptimizedItems.map(({ original, optimized }) => mergeOptimizedIntoRecipe(original, optimized));

  mergedRecipes.forEach((recipe) => {
    const v = runValidation(recipe);
    if (!v.ok || (v.warnings && v.warnings.length > 0)) {
      console.log(chalk.yellow(`  [校验] ${recipe.name}:`));
      if (v.missingInSteps.length) console.log(chalk.yellow(`    配料未在步骤中出现: ${v.missingInSteps.join('、')}`));
      if (v.mentionedNotInList.length) console.log(chalk.yellow(`    步骤中提到但配料表无: ${v.mentionedNotInList.join('、')}`));
      if (v.warnings && v.warnings.length) v.warnings.forEach((w) => console.log(chalk.yellow(`    ${w}`)));
    }
  });

  const outDir = CONFIG.draftsDir;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `optimized_${dateStr}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    source: 'optimize-recipes',
    items: mergedRecipes.map((r) => ({ recipe: r, status: 'pending' }))
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(chalk.green(`\n已写入 ${outPath}，共 ${mergedRecipes.length} 道。审核后使用 apply-optimized.js 写回 recipes.js.bak。`));
}

main().catch((err) => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});
