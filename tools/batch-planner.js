#!/usr/bin/env node
/**
 * batch-planner.js — 智能批次编排
 *
 * 分析现有菜谱的 meat × taste × flavor_profile 覆盖矩阵，
 * 自动发现空洞、编排下一批生成计划，输出 generate.js 命令。
 *
 * Usage:
 *   node batch-planner.js                # 本地分析，输出报告 + 批次建议
 *   node batch-planner.js --cloud        # 从云端拉取数据
 *   node batch-planner.js --gen          # 直接输出可执行的 generate.js 命令
 *   node batch-planner.js --json         # JSON 格式输出
 *   node batch-planner.js --baby         # 聚焦宝宝菜谱缺口
 *   node batch-planner.js --cook         # 聚焦 cook_type 多样性
 *   node batch-planner.js --batch-size 8 # 每批数量（默认 5）
 *   node batch-planner.js --max-batches 3 # 最多批次数（默认 6）
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ────────────────────────────────────────────
// 维度定义
// ────────────────────────────────────────────

const MEATS = ['beef', 'chicken', 'pork', 'fish', 'shrimp', 'shellfish', 'lamb', 'duck', 'vegetable'];
const ADULT_TASTES = ['quick_stir_fry', 'slow_stew', 'steamed_salad', 'sweet_sour'];
const FLAVORS = ['light', 'salty_umami', 'sour_fresh', 'spicy', 'sweet_sour'];
const COOK_TYPES = ['stir_fry', 'stew', 'steam', 'bake', 'air_fryer', 'cold_dress', 'salad'];

const MEAT_CN = {
  beef: '牛肉', chicken: '鸡肉', pork: '猪肉', fish: '鱼',
  shrimp: '虾', shellfish: '贝类', lamb: '羊肉', duck: '鸭肉', vegetable: '蔬菜',
};
const TASTE_CN = {
  quick_stir_fry: '快炒', slow_stew: '炖煮', steamed_salad: '蒸/凉',
  sweet_sour: '糖醋/酸甜',
};
const FLAVOR_CN = {
  light: '清淡', salty_umami: '咸鲜', sour_fresh: '酸爽', spicy: '辣', sweet_sour: '酸甜',
};
const COOK_CN = {
  stir_fry: '炒', stew: '炖', steam: '蒸', bake: '烤',
  air_fryer: '空气炸', cold_dress: '凉拌', salad: '沙拉',
};

// 稀有食材权重更高（鼓励扩品）
const MEAT_RARITY = {
  lamb: 1.5, duck: 1.5, shellfish: 1.4, fish: 1.2,
  shrimp: 1.1, beef: 1.0, pork: 1.0, chicken: 1.0, vegetable: 0.8,
};

// ────────────────────────────────────────────
// 数据加载
// ────────────────────────────────────────────

function loadLocalRecipes() {
  const recipesPath = path.resolve(__dirname, '..', 'miniprogram', 'data', 'recipes.js');
  const mod = require(recipesPath);
  const adults = (mod.adultRecipes || []).filter(r => !r.type || r.type === 'adult');
  const babies = mod.babyRecipes || [];
  return { adults, babies };
}

async function loadCloudRecipes() {
  const { fetchRecipesForAnalysis } = await import('./lib/cloud-db.js');
  const all = await fetchRecipesForAnalysis();
  // Deduplicate by id
  const seen = new Map();
  for (const r of all) {
    const key = r.id || r._id;
    if (!seen.has(key)) seen.set(key, r);
  }
  const unique = [...seen.values()];
  const adults = unique.filter(r => r.type === 'adult' || !r.type);
  const babies = unique.filter(r => r.type === 'baby');
  return { adults, babies, rawCount: all.length, uniqueCount: unique.length };
}

async function loadRecipes(useCloud) {
  if (!useCloud) return loadLocalRecipes();
  try {
    const cloud = await loadCloudRecipes();
    if (cloud.adults.length > 0) {
      console.log(chalk.gray(`  云端: ${cloud.rawCount} 条 → 去重后 ${cloud.uniqueCount} 条`));
      return cloud;
    }
    console.log(chalk.yellow('  ⚠ 云端返回 0 条，降级到本地'));
    return loadLocalRecipes();
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 云端拉取失败: ${e.message || e}`));
    return loadLocalRecipes();
  }
}

// ────────────────────────────────────────────
// 矩阵分析
// ────────────────────────────────────────────

function buildMatrix(recipes) {
  // meat × taste × flavor_profile → count
  const matrix = {};
  const cookMatrix = {}; // meat × cook_type → count

  for (const r of recipes) {
    const m = r.meat, t = r.taste, f = r.flavor_profile, c = r.cook_type;
    if (!m) continue;

    const key = `${m}|${t}|${f}`;
    matrix[key] = (matrix[key] || 0) + 1;

    if (c) {
      const ck = `${m}|${c}`;
      cookMatrix[ck] = (cookMatrix[ck] || 0) + 1;
    }
  }

  return { matrix, cookMatrix };
}

function findMatrixGaps(matrix) {
  const gaps = [];
  for (const m of MEATS) {
    for (const t of ADULT_TASTES) {
      for (const f of FLAVORS) {
        const key = `${m}|${t}|${f}`;
        const count = matrix[key] || 0;
        const rarity = MEAT_RARITY[m] || 1.0;

        let priority = 0;
        if (count === 0) priority = 3 * rarity;
        else if (count === 1) priority = 1.5 * rarity;
        else if (count === 2) priority = 0.5 * rarity;

        gaps.push({ meat: m, taste: t, flavor: f, count, priority });
      }
    }
  }
  gaps.sort((a, b) => b.priority - a.priority);
  return gaps;
}

function findCookTypeGaps(cookMatrix) {
  const gaps = [];
  for (const m of MEATS) {
    for (const c of COOK_TYPES) {
      const key = `${m}|${c}`;
      const count = cookMatrix[key] || 0;
      const rarity = MEAT_RARITY[m] || 1.0;
      if (count === 0) {
        gaps.push({ meat: m, cook_type: c, count, priority: 2 * rarity });
      } else if (count === 1) {
        gaps.push({ meat: m, cook_type: c, count, priority: 0.8 * rarity });
      }
    }
  }
  gaps.sort((a, b) => b.priority - a.priority);
  return gaps;
}

function findBabyGaps(adults) {
  const babyFriendly = adults.filter(r => r.is_baby_friendly);
  const meatBabyCount = {};
  for (const r of babyFriendly) {
    if (r.meat) meatBabyCount[r.meat] = (meatBabyCount[r.meat] || 0) + 1;
  }
  const gaps = [];
  for (const m of MEATS) {
    const count = meatBabyCount[m] || 0;
    const total = adults.filter(r => r.meat === m).length;
    const ratio = total > 0 ? count / total : 0;
    if (ratio < 0.5 || count < 2) {
      gaps.push({ meat: m, babyCount: count, totalCount: total, ratio, priority: (1 - ratio) * (MEAT_RARITY[m] || 1) });
    }
  }
  gaps.sort((a, b) => b.priority - a.priority);
  return gaps;
}

// ────────────────────────────────────────────
// 批次编排策略
// ────────────────────────────────────────────

function generateBatchPlan(matrixGaps, cookTypeGaps, babyGaps, opts = {}) {
  const batchSize = opts.batchSize || 5;
  const maxBatches = opts.maxBatches || 6;
  const focus = opts.focus || 'all'; // 'all' | 'cook' | 'baby'
  const batches = [];

  if (focus === 'cook') {
    const cookGapsZero = cookTypeGaps.filter(g => g.count === 0);
    for (let i = 0; i < cookGapsZero.length && batches.length < maxBatches; i += batchSize) {
      const slice = cookGapsZero.slice(i, i + batchSize);
      batches.push({
        theme: `cook_type 扩展 #${batches.length + 1}`,
        slots: slice.map(g => ({
          meat: g.meat, cook_type: g.cook_type,
          hint: `${MEAT_CN[g.meat]}的${COOK_CN[g.cook_type] || g.cook_type}做法`,
        })),
      });
    }
    return batches;
  }

  if (focus === 'baby') {
    const babySlots = babyGaps.slice(0, batchSize * maxBatches);
    for (let i = 0; i < babySlots.length && batches.length < maxBatches; i += batchSize) {
      const slice = babySlots.slice(i, i + batchSize);
      batches.push({
        theme: `宝宝友好扩展 #${batches.length + 1}`,
        slots: slice.map(g => ({
          meat: g.meat, is_baby_friendly: true,
          hint: `${MEAT_CN[g.meat]}宝宝版（当前 ${g.babyCount}/${g.totalCount}）`,
        })),
      });
    }
    return batches;
  }

  // ── 默认策略：themed batches covering diverse gaps ──
  const actionable = matrixGaps.filter(g => g.priority > 0);
  const used = new Set();

  function pickSlots(filter, theme, count = batchSize) {
    const slots = [];
    for (const g of actionable) {
      if (slots.length >= count) break;
      const key = `${g.meat}|${g.taste}|${g.flavor}`;
      if (used.has(key)) continue;
      if (filter && !filter(g)) continue;
      used.add(key);
      slots.push({
        meat: g.meat, taste: g.taste, flavor_profile: g.flavor, count: g.count,
        hint: `${MEAT_CN[g.meat]} ${TASTE_CN[g.taste] || g.taste} ${FLAVOR_CN[g.flavor] || g.flavor}`,
      });
    }
    if (slots.length > 0) {
      batches.push({ theme, slots });
    }
  }

  // Batch 1: Rare meats with empty cells
  const rareMeats = new Set(['lamb', 'duck', 'shellfish']);
  pickSlots(g => rareMeats.has(g.meat) && g.count === 0, '稀缺食材空白填补（羊/鸭/贝）');

  // Batch 2: Flavor diversity — sour_fresh & spicy gaps
  pickSlots(g => (g.flavor === 'sour_fresh' || g.flavor === 'spicy') && g.count === 0, '风味多样性（酸爽/辣味空白）');

  // Batch 3: Steamed/Salad gaps
  pickSlots(g => g.taste === 'steamed_salad' && g.count === 0, '蒸/凉拌类空白');

  // Batch 4: Sweet-sour gaps
  pickSlots(g => (g.taste === 'sweet_sour' || g.flavor === 'sweet_sour') && g.count === 0, '糖醋/酸甜类空白');

  // Batch 5: Sparse cells (count=1) for depth
  pickSlots(g => g.count === 1, '薄弱格子加深（仅1道）');

  // Batch 6: Cook-type diversification (pick from cook gaps)
  if (batches.length < maxBatches && cookTypeGaps.length > 0) {
    const cookSlots = cookTypeGaps
      .filter(g => g.count === 0)
      .slice(0, batchSize)
      .map(g => ({
        meat: g.meat, cook_type: g.cook_type,
        hint: `${MEAT_CN[g.meat]}的${COOK_CN[g.cook_type] || g.cook_type}做法`,
      }));
    if (cookSlots.length > 0) {
      batches.push({ theme: 'cook_type 多样化', slots: cookSlots });
    }
  }

  return batches.slice(0, maxBatches);
}

// ────────────────────────────────────────────
// 输出格式
// ────────────────────────────────────────────

function formatGenerateCommand(batch, index) {
  const lines = [`请生成以下 ${batch.slots.length} 道菜，精确匹配指定字段：`];
  batch.slots.forEach((s, i) => {
    const parts = [`${i + 1}. ${s.hint}`];
    if (s.meat) parts.push(`   meat: ${s.meat}`);
    if (s.taste) parts.push(`   taste: ${s.taste}`);
    if (s.flavor_profile) parts.push(`   flavor_profile: ${s.flavor_profile}`);
    if (s.cook_type) parts.push(`   cook_type: ${s.cook_type}`);
    if (s.is_baby_friendly) parts.push(`   is_baby_friendly: true`);
    lines.push(parts.join('\n'));
  });
  const input = lines.join('\n\n');
  return `node generate.js --mode text --count ${batch.slots.length} --input "${input}"`;
}

function printReport(adults, matrixGaps, cookTypeGaps, babyGaps, batches) {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║    智能批次编排 — 菜谱覆盖分析          ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝'));
  console.log();

  // Matrix overview
  console.log(chalk.bold('  📊 覆盖矩阵概览'));
  console.log(chalk.gray(`  菜谱总数: ${adults.length}`));

  const totalCells = MEATS.length * ADULT_TASTES.length * FLAVORS.length;
  const emptyCells = matrixGaps.filter(g => g.count === 0).length;
  const sparseCells = matrixGaps.filter(g => g.count === 1).length;
  const covered = totalCells - emptyCells;
  console.log(chalk.gray(`  矩阵格子: ${totalCells}（${MEATS.length} meat × ${ADULT_TASTES.length} taste × ${FLAVORS.length} flavor）`));
  console.log(chalk.gray(`  已覆盖: ${covered}  空白: ${emptyCells}  薄弱(=1): ${sparseCells}`));
  console.log(chalk.gray(`  覆盖率: ${(covered / totalCells * 100).toFixed(0)}%`));
  console.log();

  // Meat distribution
  console.log(chalk.bold('  🥩 食材分布'));
  for (const m of MEATS) {
    const count = adults.filter(r => r.meat === m).length;
    const bar = '█'.repeat(Math.min(count, 30));
    const cn = (MEAT_CN[m] || m).padEnd(4, '　');
    console.log(`  ${cn} ${chalk.cyan(bar)} ${count}`);
  }
  console.log();

  // Top gaps
  console.log(chalk.bold('  🕳️  高优先级空白 TOP 15'));
  const topGaps = matrixGaps.filter(g => g.count === 0).slice(0, 15);
  for (const g of topGaps) {
    const m = (MEAT_CN[g.meat] || g.meat).padEnd(4, '　');
    const t = (TASTE_CN[g.taste] || g.taste).padEnd(6, '　');
    const f = FLAVOR_CN[g.flavor] || g.flavor;
    console.log(chalk.yellow(`     ${m} × ${t} × ${f}  (priority: ${g.priority.toFixed(1)})`));
  }
  console.log();

  // Cook type gaps
  const cookEmpty = cookTypeGaps.filter(g => g.count === 0);
  if (cookEmpty.length > 0) {
    console.log(chalk.bold(`  🍳 cook_type 空白 (${cookEmpty.length} 个)`));
    for (const g of cookEmpty.slice(0, 10)) {
      console.log(chalk.yellow(`     ${MEAT_CN[g.meat] || g.meat} × ${COOK_CN[g.cook_type] || g.cook_type}`));
    }
    if (cookEmpty.length > 10) console.log(chalk.gray(`     ... 还有 ${cookEmpty.length - 10} 个`));
    console.log();
  }

  // Baby gaps
  if (babyGaps.length > 0) {
    console.log(chalk.bold('  👶 宝宝友好缺口'));
    for (const g of babyGaps) {
      const pct = (g.ratio * 100).toFixed(0);
      console.log(chalk.yellow(`     ${MEAT_CN[g.meat] || g.meat}: ${g.babyCount}/${g.totalCount} (${pct}%)`));
    }
    console.log();
  }

  // Batch plan
  if (batches.length > 0) {
    console.log(chalk.bold.green(`  🗂️  建议批次 (${batches.length} 批)`));
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      console.log(chalk.green(`\n  ── Batch ${i + 1}: ${b.theme} (${b.slots.length} 道) ──`));
      for (const s of b.slots) {
        console.log(chalk.white(`     • ${s.hint}`));
      }
    }
    console.log();
  }
}

function printGenerateCommands(batches) {
  console.log(chalk.bold('\n  📋 可执行命令（复制粘贴到终端）\n'));
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    console.log(chalk.cyan(`# ── Batch ${i + 1}: ${b.theme} ──`));
    console.log(formatGenerateCommand(b, i));
    console.log();
  }
}

// ────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const useCloud = args.includes('--cloud');
  const genMode = args.includes('--gen');
  const jsonOutput = args.includes('--json');
  const batchSize = args.includes('--batch-size')
    ? parseInt(args[args.indexOf('--batch-size') + 1])
    : 5;
  const maxBatches = args.includes('--max-batches')
    ? parseInt(args[args.indexOf('--max-batches') + 1])
    : 6;

  let focus = 'all';
  if (args.includes('--baby')) focus = 'baby';
  if (args.includes('--cook')) focus = 'cook';

  console.log(chalk.gray(`  数据源: ${useCloud ? '云端' : '本地 recipes.js'}`));
  const { adults, babies } = await loadRecipes(useCloud);
  console.log(chalk.gray(`  成人菜谱: ${adults.length} 道`));

  // Deduplicate by name for analysis
  const seen = new Set();
  const unique = [];
  for (const r of adults) {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      unique.push(r);
    }
  }
  if (unique.length < adults.length) {
    console.log(chalk.yellow(`  ⚠ 去重后: ${unique.length} 道（${adults.length - unique.length} 道同名重复已忽略）`));
  }

  const { matrix, cookMatrix } = buildMatrix(unique);
  const matrixGaps = findMatrixGaps(matrix);
  const cookTypeGaps = findCookTypeGaps(cookMatrix);
  const babyGaps = findBabyGaps(unique);
  const batches = generateBatchPlan(matrixGaps, cookTypeGaps, babyGaps, { batchSize, maxBatches, focus });

  if (jsonOutput) {
    console.log(JSON.stringify({
      total: unique.length,
      matrix_gaps: matrixGaps.filter(g => g.priority > 0),
      cook_type_gaps: cookTypeGaps.filter(g => g.count === 0),
      baby_gaps: babyGaps,
      batches,
    }, null, 2));
    return;
  }

  printReport(unique, matrixGaps, cookTypeGaps, babyGaps, batches);

  if (genMode) {
    printGenerateCommands(batches);
  } else {
    console.log(chalk.gray('  提示: 加 --gen 输出可执行的 generate.js 命令'));
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err.message || err);
  process.exit(1);
});
