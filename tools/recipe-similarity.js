#!/usr/bin/env node
/**
 * recipe-similarity.js — 菜谱语义去重工具 (CLI)
 *
 * Usage:
 *   node recipe-similarity.js                    # 本地分析，阈值 0.55
 *   node recipe-similarity.js --threshold 0.7    # 调高阈值
 *   node recipe-similarity.js --cloud            # 从云端拉取
 *   node recipe-similarity.js --json             # JSON 输出
 *   node recipe-similarity.js --baby             # 包含 baby 菜谱
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { clusterSimilarRecipes } from './lib/recipe-similarity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── 数据加载 ──

function loadLocalRecipes(includeBaby) {
  const recipesPath = path.resolve(__dirname, '..', 'miniprogram', 'data', 'recipes.js');
  const mod = require(recipesPath);
  let recipes = mod.adultRecipes || [];
  if (includeBaby && mod.babyRecipes) {
    recipes = recipes.concat(mod.babyRecipes.map(r => ({ ...r, type: 'baby' })));
  }
  return recipes;
}

async function loadCloudRecipes() {
  const cloudbase = (await import('@cloudbase/node-sdk')).default;
  const { CONFIG } = await import('./config.js');
  const app = cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey,
  });
  const coll = app.database().collection('recipes');
  const results = [];
  const PAGE = 100;
  let offset = 0;
  const fields = {
    id: true, name: true, type: true,
    meat: true, taste: true, flavor_profile: true,
    cook_type: true, dish_type: true, is_baby_friendly: true,
  };
  while (true) {
    const res = await coll.field(fields).skip(offset).limit(PAGE).get();
    if (!res.data || res.data.length === 0) break;
    results.push(...res.data);
    if (res.data.length < PAGE) break;
    offset += PAGE;
  }
  const seen = new Map();
  for (const r of results) {
    const key = r.id || r._id;
    if (!seen.has(key)) seen.set(key, r);
  }
  return [...seen.values()];
}

// ── 报告输出 ──

function printReport(clusters, totalPairs, recipes, threshold) {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║    菜谱语义相似度分析报告                ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray(`  菜谱总数: ${recipes.length}`));
  console.log(chalk.gray(`  相似阈值: ${threshold}`));
  console.log(chalk.gray(`  相似对数: ${totalPairs}`));
  console.log(chalk.gray(`  聚类数量: ${clusters.length}`));
  console.log();

  if (clusters.length === 0) {
    console.log(chalk.green('  ✅ 未发现超过阈值的相似菜谱'));
    return;
  }

  const exact = [];
  const deviceVariant = [];
  const semantic = [];

  for (const c of clusters) {
    const names = c.members.map(m => m.name);
    const uniqueNames = new Set(names);
    const hasDeviceVariant = c.pairs.some(p => p.reason === 'device-variant');

    if (uniqueNames.size < names.length) {
      exact.push(c);
    } else if (hasDeviceVariant) {
      deviceVariant.push(c);
    } else {
      semantic.push(c);
    }
  }

  if (exact.length > 0) {
    console.log(chalk.red.bold(`  🔴 完全同名重复 (${exact.length} 组)`));
    for (const c of exact) {
      const nameCount = {};
      c.members.forEach(m => { nameCount[m.name] = (nameCount[m.name] || 0) + 1; });
      const dupNames = Object.entries(nameCount).filter(([, n]) => n > 1);
      for (const [name, count] of dupNames) {
        const ids = c.members.filter(m => m.name === name).map(m => m.id);
        console.log(chalk.red(`     "${name}" × ${count}  [${ids.join(', ')}]`));
      }
    }
    console.log();
  }

  if (deviceVariant.length > 0) {
    console.log(chalk.yellow.bold(`  🟡 设备变体 (${deviceVariant.length} 组)`));
    for (const c of deviceVariant) {
      const names = c.members.map(m => `${m.name} (${m.cook_type})`);
      console.log(chalk.yellow(`     ${names.join('  ↔  ')}`));
      const p = c.pairs.find(p => p.reason === 'device-variant');
      if (p) console.log(chalk.gray(`       相似度: ${(p.score * 100).toFixed(0)}%`));
    }
    console.log();
  }

  if (semantic.length > 0) {
    console.log(chalk.magenta.bold(`  🟣 语义相似 (${semantic.length} 组)`));
    for (const c of semantic) {
      console.log(chalk.magenta(`     ┌─ 聚类 (${c.size} 道)`));
      for (const m of c.members) {
        const tags = [m.meat, m.taste, m.flavor_profile, m.cook_type].filter(Boolean).join('/');
        console.log(chalk.magenta(`     │  ${m.name}  ${chalk.gray(tags)}`));
      }
      for (const p of c.pairs) {
        console.log(chalk.gray(`     │  "${p.a}" ↔ "${p.b}"  ${(p.score * 100).toFixed(0)}%`));
      }
      console.log(chalk.magenta(`     └─`));
    }
    console.log();
  }

  const totalDupRecipes = clusters.reduce((sum, c) => sum + c.size, 0);
  const canReduce = totalDupRecipes - clusters.length;
  console.log(chalk.bold('  📊 总结'));
  console.log(`     涉及菜谱: ${totalDupRecipes} 道（占比 ${(totalDupRecipes / recipes.length * 100).toFixed(0)}%）`);
  console.log(`     可精简:   ~${canReduce} 道（合并/删除后）`);
  console.log();

  console.log(chalk.bold('  💡 建议'));
  if (exact.length > 0) {
    console.log(chalk.red('     1. 完全同名菜谱应立即去重（保留最新版本）'));
  }
  if (deviceVariant.length > 0) {
    console.log(chalk.yellow('     2. 设备变体考虑合并为同一菜谱的不同「做法模式」'));
  }
  if (semantic.length > 0) {
    console.log(chalk.magenta('     3. 语义相似菜谱评估是否提供足够差异化'));
  }
  console.log();
}

// ── CLI ──

async function main() {
  const args = process.argv.slice(2);
  const threshold = args.includes('--threshold')
    ? parseFloat(args[args.indexOf('--threshold') + 1])
    : 0.55;
  const useCloud = args.includes('--cloud');
  const jsonOutput = args.includes('--json');
  const includeBaby = args.includes('--baby');

  let recipes;
  if (useCloud) {
    console.log(chalk.gray('  从云端拉取菜谱...'));
    recipes = await loadCloudRecipes();
    console.log(chalk.gray(`  获取 ${recipes.length} 条（去重后）`));
  } else {
    recipes = loadLocalRecipes(includeBaby);
    console.log(chalk.gray(`  加载本地菜谱 ${recipes.length} 条`));
  }

  if (!includeBaby && !useCloud) {
    recipes = recipes.filter(r => r.type !== 'baby');
  }

  const { clusters, totalPairs } = clusterSimilarRecipes(recipes, threshold);

  if (jsonOutput) {
    console.log(JSON.stringify({ threshold, total: recipes.length, clusters }, null, 2));
  } else {
    printReport(clusters, totalPairs, recipes, threshold);
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err.message || err);
  process.exit(1);
});
