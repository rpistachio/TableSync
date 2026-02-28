#!/usr/bin/env node
/**
 * recipe-fusion-spider.js — 下厨房交叉融合爬虫
 *
 * 从缺口清单或单道菜描述出发：爬取参考菜谱 → LLM 交叉比对融合 → 输出 TableSync 规范 JSON。
 * 可被 recipe-manager-server 调用，也可 CLI 独立运行。
 *
 * Usage (CLI):
 *   node recipe-fusion-spider.js --count 50     # 批量融合 50 道（按缺口优先级）
 *   node recipe-fusion-spider.js --single "空气炸锅羊排"
 *   node recipe-fusion-spider.js --dry-run      # 仅打印将要融合的菜单
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlRefRecipes } from './lib/recipe-crawler.js';
import { callLlmForJson } from './lib/llm-client.js';
import { CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FUSION_SITES = ['xiachufang', 'douguo', 'meishij'];
const MIN_INGREDIENTS = 3;
const MIN_STEPS = 2;
const DEFAULT_INTERVAL_MS = 5000;

function loadFusionSystemPrompt() {
  const p = path.join(__dirname, 'templates', 'recipe-fusion-prompt.md');
  if (!fs.existsSync(p)) throw new Error(`Fusion prompt not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

/**
 * 从 LLM 返回中安全解析 recipe；兼容 { recipe: {...} } 或直接 {...}
 * @param {object} parsed
 * @returns {object|null}
 */
function extractRecipe(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.recipe && typeof parsed.recipe === 'object') return parsed.recipe;
  if (parsed.name && (parsed.main_ingredients || parsed.ingredients || parsed.steps)) return parsed;
  return null;
}

/**
 * 为融合菜谱分配 id（与 recipe-formatter 前缀约定一致）
 * @param {object} recipe
 * @param {Map<string,number>} counters
 * @returns {string}
 */
function assignId(recipe, counters) {
  const meat = recipe.meat || 'vegetable';
  const isAirFryer = recipe.cook_type === 'air_fryer';
  let prefix = 'a-veg';
  if (recipe.dish_type === 'soup' && !isAirFryer) prefix = 'a-soup';
  else if (isAirFryer) {
    const afMap = { chicken: 'af-chi', pork: 'af-pork', beef: 'af-beef', fish: 'af-fish', shrimp: 'af-shrimp', vegetable: 'af-veg' };
    prefix = afMap[meat] || 'af-veg';
  } else {
    const aMap = { chicken: 'a-chi', pork: 'a-pork', beef: 'a-beef', fish: 'a-fish', shrimp: 'a-shrimp', lamb: 'a-lamb', duck: 'a-duck', shellfish: 'a-shell', vegetable: 'a-veg' };
    prefix = aMap[meat] || 'a-veg';
  }
  const n = (counters.get(prefix) || 0) + 1;
  counters.set(prefix, n);
  return `${prefix}-${n}`;
}

/**
 * 单道菜融合：爬取参考 → LLM 融合 → 约束覆盖
 * @param {string} dishHint - 搜索关键词，如 "羊肉 空气炸锅 酸爽"
 * @param {object} [constraints] - 强制字段：meat, taste, flavor_profile, cook_type
 * @param {{ autoReview?: boolean }} [options]
 * @returns {Promise<{ recipe: object, refRecipes: array, review?: object, fusedAt: string }>}
 */
export async function fuseOneRecipe(dishHint, constraints = {}, options = {}) {
  const systemPrompt = loadFusionSystemPrompt();
  const refs = await crawlRefRecipes(dishHint, {
    maxPerSite: 2,
    sites: FUSION_SITES,
  });
  const validRefs = (refs || []).filter(
    (r) =>
      Array.isArray(r.ingredients) &&
      r.ingredients.length >= MIN_INGREDIENTS &&
      Array.isArray(r.steps) &&
      r.steps.length >= MIN_STEPS
  );
  if (validRefs.length === 0) {
    throw new Error(`未获取到有效参考菜谱（至少 ${MIN_INGREDIENTS} 种食材、${MIN_STEPS} 步），请换关键词或稍后重试`);
  }

  const constraintsJson = JSON.stringify(constraints, null, 2);
  const refsPayload = validRefs.slice(0, 5).map((r) => ({
    title: r.title,
    url: r.url,
    ingredients: r.ingredients,
    steps: r.steps,
  }));
  const userMessage = [
    '## 目标描述',
    dishHint,
    '',
    '## 约束字段（必须原样使用）',
    constraintsJson,
    '',
    '## 参考菜谱',
    JSON.stringify(refsPayload, null, 2),
    '',
    '请输出一个 JSON 对象，仅包含键 "recipe"，值为融合后的菜谱对象。',
  ].join('\n');

  const raw = await callLlmForJson(systemPrompt, userMessage, {
    maxTokens: 4096,
    temperature: 0.4,
  });
  let recipe = extractRecipe(raw);
  if (!recipe || !recipe.name) {
    throw new Error('LLM 返回中未解析出有效 recipe（需含 name）');
  }

  // 强制覆盖约束字段
  if (constraints.meat) recipe.meat = constraints.meat;
  if (constraints.taste) recipe.taste = constraints.taste;
  if (constraints.flavor_profile) recipe.flavor_profile = constraints.flavor_profile;
  if (constraints.cook_type) recipe.cook_type = constraints.cook_type;
  if (constraints.cuisine) recipe.cuisine = constraints.cuisine;

  const fusedAt = new Date().toISOString();
  let review;
  if (options.autoReview) {
    try {
      const { reviewRecipeWithRefs } = await import('./lib/recipe-reviewer.js');
      review = await reviewRecipeWithRefs(recipe, validRefs);
    } catch (_) {
      review = { overall: 0, verdict: 'fail', suggestions: [] };
    }
  }

  return {
    recipe,
    refRecipes: validRefs,
    review,
    fusedAt,
  };
}

/**
 * 将 batch-planner 的 gap 转为融合用 slot（dishHint + constraints）
 * @param {object} gap - { meat, taste?, flavor?, cook_type?, cuisine?, hint? }
 * @param {object} labelMap - MEAT_CN, TASTE_CN, FLAVOR_CN, COOK_CN, CUISINE_CN
 * @returns {{ dishHint: string, constraints: object }}
 */
export function gapToSlot(gap, labelMap = {}) {
  const { MEAT_CN, TASTE_CN, FLAVOR_CN, COOK_CN, CUISINE_CN } = labelMap;
  const meat = gap.meat;
  const parts = [];
  if (gap.cuisine && CUISINE_CN) parts.push(CUISINE_CN[gap.cuisine] || gap.cuisine);
  if (MEAT_CN && meat) parts.push(MEAT_CN[meat] || meat);
  if (gap.cook_type && COOK_CN) parts.push(COOK_CN[gap.cook_type] || gap.cook_type);
  if (gap.taste && TASTE_CN) parts.push(TASTE_CN[gap.taste] || gap.taste);
  if (gap.flavor && FLAVOR_CN) parts.push(FLAVOR_CN[gap.flavor] || gap.flavor);
  const dishHint = gap.hint || parts.join(' ');
  const constraints = {
    meat: gap.meat,
    taste: gap.taste || undefined,
    flavor_profile: gap.flavor || undefined,
    cook_type: gap.cook_type || undefined,
    cuisine: gap.cuisine || undefined,
  };
  return { dishHint, constraints };
}

/**
 * 批量融合：串行执行，写草稿文件，通过 onProgress 回调报告进度
 * @param {Array<{ dishHint: string, constraints: object }>} slots
 * @param {object} [options]
 * @param {number} [options.intervalMs]
 * @param {boolean} [options.autoReview]
 * @param {string} [options.draftsDir]
 * @param {(ev: { done: number, total: number, currentDish?: string, recipe?: object, error?: string }) => void} [options.onProgress]
 * @returns {Promise<{ filename: string, path: string, stats: { ok: number, failed: number } }>}
 */
export async function fuseBatch(slots, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const autoReview = options.autoReview ?? false;
  const draftsDir = options.draftsDir ?? path.join(__dirname, 'drafts');
  const onProgress = options.onProgress || (() => {});

  const idCounters = new Map();
  const results = [];
  const total = slots.length;

  for (let i = 0; i < slots.length; i++) {
    const { dishHint, constraints } = slots[i];
    try {
      const out = await fuseOneRecipe(dishHint, constraints, { autoReview });
      let recipe = out.recipe;
      recipe.id = assignId(recipe, idCounters);
      recipe.type = 'adult';
      results.push({
        status: 'pending_review',
        recipe,
        ref_recipes: out.refRecipes,
        review: out.review,
        fusedAt: out.fusedAt,
      });
      onProgress({ done: i + 1, total, currentDish: recipe.name, recipe });
    } catch (err) {
      results.push({
        status: 'failed',
        error: err.message,
        dishHint,
        constraints,
      });
      onProgress({ done: i + 1, total, currentDish: dishHint, error: err.message });
    }
    if (i < slots.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  const filename = `${new Date().toISOString().slice(0, 10)}_fusion_batch.json`;
  if (!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, { recursive: true });
  const draftPath = path.join(draftsDir, filename);
  const payload = {
    generated_at: new Date().toISOString(),
    source: 'recipe-fusion-spider',
    items: results,
  };
  fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');

  const ok = results.filter((r) => r.status === 'pending_review').length;
  const failed = results.length - ok;
  return {
    filename,
    path: draftPath,
    stats: { ok, failed },
  };
}

/**
 * CLI：从 batch-planner 取缺口，生成 slots，执行批量融合或 dry-run
 */
async function runCli() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const singleIdx = args.indexOf('--single');
  const countIdx = args.indexOf('--count');
  const count = countIdx >= 0 && args[countIdx + 1] ? parseInt(args[countIdx + 1], 10) : 10;
  const singleQuery = singleIdx >= 0 && args[singleIdx + 1] ? args[singleIdx + 1] : null;

  if (singleQuery) {
    if (dryRun) {
      console.log('[dry-run] 将融合单道菜:', singleQuery);
      return;
    }
    const result = await fuseOneRecipe(singleQuery, {}, { autoReview: true });
    console.log(JSON.stringify({ recipe: result.recipe, review: result.review }, null, 2));
    return;
  }

  const {
    loadRecipes,
    buildMatrix,
    buildCuisineMatrix,
    findMatrixGaps,
    findCookTypeGaps,
    findCuisineGaps,
    generateBatchPlan,
    MEAT_CN,
    TASTE_CN,
    FLAVOR_CN,
    COOK_CN,
    CUISINE_CN,
  } = await import('./batch-planner.js');

  const { adults } = await loadRecipes(false);
  const seen = new Set();
  const unique = adults.filter((r) => {
    if (!r || !r.name || seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
  const { matrix, cookMatrix } = buildMatrix(unique);
  const matrixGaps = findMatrixGaps(matrix);
  const cookTypeGaps = findCookTypeGaps(cookMatrix);
  const cuisineMatrix = buildCuisineMatrix(unique);
  const cuisineGaps = findCuisineGaps(cuisineMatrix);
  const babyGaps = []; // not used for fusion slots
  const batches = generateBatchPlan(matrixGaps, cookTypeGaps, babyGaps, {
    batchSize: Math.max(count, 20),
    maxBatches: 6,
    focus: 'all',
    cuisineGaps,
  });

  const slots = [];
  const labelMap = { MEAT_CN, TASTE_CN, FLAVOR_CN, COOK_CN, CUISINE_CN };
  for (const batch of batches) {
    for (const s of batch.slots || []) {
      const gap = {
        meat: s.meat,
        taste: s.taste,
        flavor: s.flavor_profile,
        cook_type: s.cook_type,
        cuisine: s.cuisine,
        hint: s.hint,
      };
      slots.push(gapToSlot(gap, labelMap));
      if (slots.length >= count) break;
    }
    if (slots.length >= count) break;
  }
  const toRun = slots.slice(0, count);

  if (dryRun) {
    console.log('[dry-run] 将融合以下', toRun.length, '道（按优先级）：');
    toRun.forEach((s, i) => console.log(`  ${i + 1}. ${s.dishHint}`));
    return;
  }

  console.log(`开始批量融合 ${toRun.length} 道…（间隔 ${DEFAULT_INTERVAL_MS / 1000}s）`);
  const result = await fuseBatch(toRun, {
    intervalMs: 120000, // 2 min per dish as in plan
    autoReview: true,
    onProgress: (ev) => {
      if (ev.error) console.error(`  [${ev.done}/${ev.total}] ${ev.currentDish}: ${ev.error}`);
      else console.log(`  [${ev.done}/${ev.total}] ${ev.currentDish} 完成`);
    },
  });
  console.log('草稿已写入:', result.path);
  console.log('统计:', result.stats);
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  runCli().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
