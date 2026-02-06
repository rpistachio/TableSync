#!/usr/bin/env node
/**
 * 批量将本地 recipes.js 中的所有菜谱（成人 + 宝宝）写入云数据库 recipes 集合。
 * - 自动跳过云端已存在的 id（避免重复写入）
 * - 自动拼接 coverFileID（根据 recipeCoverSlugs 映射）
 * - 支持 --dry-run 预览、--type 筛选、--force 强制覆盖
 *
 * 用法：
 *   node tools/batch-sync-recipes.js                     # 写入全部（跳过已有）
 *   node tools/batch-sync-recipes.js --dry-run            # 仅预览，不写入
 *   node tools/batch-sync-recipes.js --type adult         # 只写成人菜
 *   node tools/batch-sync-recipes.js --type baby          # 只写宝宝菜
 *   node tools/batch-sync-recipes.js --force              # 强制写入（即使云端已有同 id）
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Command } from 'commander';
import chalk from 'chalk';
import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

// ─── 云数据库 ───────────────────────────────────────────
let cachedApp = null;
let cachedDb = null;

function getDb() {
  if (cachedDb) return cachedDb;
  if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
    throw new Error('TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY 未配置');
  }
  cachedApp = cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey
  });
  cachedDb = cachedApp.database();
  return cachedDb;
}

// ─── 加载本地数据 ────────────────────────────────────────
function loadLocalRecipes() {
  const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
  const mod = require(recipesPath);
  return {
    adultRecipes: mod.adultRecipes || [],
    babyRecipes: mod.babyRecipes || []
  };
}

function loadSlugMap() {
  const slugsPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipeCoverSlugs.js');
  const mod = require(slugsPath);
  return {
    nameToSlug: mod.RECIPE_NAME_TO_SLUG || {},
    cloudBase: mod.CLOUD_STORAGE_BASE || ''
  };
}

// ─── 数据转换（复用 cloud-db.js 的逻辑）─────────────────
function splitIngredients(ingredients = []) {
  const main = [];
  const seasonings = [];
  ingredients.forEach((item) => {
    if (!item || !item.name) return;
    const cat = item.category || '';
    const isSeasoning = cat === '调料' || cat === '佐料' || (!cat && (item.unit === '适量' || item.unit === '少许'));
    if (isSeasoning) {
      seasonings.push({ name: item.name, amount: typeof item.baseAmount === 'number' ? item.baseAmount : 0, unit: item.unit || '适量' });
    } else {
      main.push({ name: item.name, amount: typeof item.baseAmount === 'number' ? item.baseAmount : 0, unit: item.unit || 'g', category: item.category || '其他', sub_type: item.sub_type });
    }
  });
  return { main_ingredients: main, seasonings };
}

function normalizeSteps(steps = []) {
  return steps.map((step, idx) => {
    const action = (step && step.action) || 'cook';
    const stepType = action === 'prep' ? 'prep' : 'cook';
    const duration = typeof step.duration_num === 'number' ? step.duration_num : (stepType === 'prep' ? 5 : 10);
    return {
      step_index: idx + 1,
      step_type: stepType,
      actionType: stepType === 'prep' ? 'idle_prep' : 'active',
      parallel: stepType === 'prep',
      waitTime: 0,
      duration_num: duration,
      action,
      text: (step && step.text) || '',
      step_image_url: (step && step.step_image_url) || ''
    };
  });
}

function normalizeBabyVariant(bv) {
  if (!bv || !Array.isArray(bv.stages) || bv.stages.length === 0) return null;
  const stages = bv.stages
    .filter(s => s && typeof s.name === 'string' && typeof s.action === 'string')
    .map(s => ({ max_month: typeof s.max_month === 'number' ? s.max_month : 12, name: s.name.trim(), action: s.action.trim() }));
  return stages.length > 0 ? { stages } : null;
}

function buildCloudDoc(recipe, type, slugMap) {
  const { ingredients, steps, cook_minutes, baby_variant, ...rest } = recipe;
  const ing = splitIngredients(Array.isArray(ingredients) ? ingredients : []);
  const normSteps = normalizeSteps(Array.isArray(steps) ? steps : []);

  const doc = { ...rest, ...ing, steps: normSteps, type };
  if (cook_minutes && typeof cook_minutes === 'number') doc.cook_time = cook_minutes;

  const bv = normalizeBabyVariant(baby_variant);
  if (bv) doc.baby_variant = bv;

  // 拼 coverFileID
  const slug = slugMap.nameToSlug[recipe.name];
  if (slug && slugMap.cloudBase) {
    doc.coverFileID = slugMap.cloudBase + '/' + slug;
  }

  doc.updateTime = new Date();
  return doc;
}

// ─── 查询云端已有 id ─────────────────────────────────────
async function fetchExistingIds() {
  const db = getDb();
  const coll = db.collection('recipes');
  const ids = new Set();
  const PAGE = 100;
  let offset = 0;
  while (true) {
    const res = await coll.field({ id: true }).skip(offset).limit(PAGE).get();
    if (!res.data || res.data.length === 0) break;
    res.data.forEach(r => { if (r.id) ids.add(r.id); });
    if (res.data.length < PAGE) break;
    offset += PAGE;
  }
  return ids;
}

// ─── 主流程 ──────────────────────────────────────────────
async function main() {
  const program = new Command();
  program
    .option('--dry-run', '仅预览，不写入云端', false)
    .option('--type <type>', '只写入指定类型: adult | baby', '')
    .option('--force', '强制写入（即使云端已有同 id 的记录）', false)
    .parse(process.argv);

  const opts = program.opts();
  const dryRun = !!opts.dryRun;
  const typeFilter = opts.type || '';
  const force = !!opts.force;

  const { adultRecipes, babyRecipes } = loadLocalRecipes();
  const slugMap = loadSlugMap();

  console.log(chalk.cyan(`\n[batch-sync] 本地菜谱：成人 ${adultRecipes.length} 道，宝宝 ${babyRecipes.length} 道`));

  // 构建待写入列表
  let toSync = [];
  if (!typeFilter || typeFilter === 'adult') {
    adultRecipes.forEach(r => toSync.push({ recipe: r, type: 'adult' }));
  }
  if (!typeFilter || typeFilter === 'baby') {
    babyRecipes.forEach(r => toSync.push({ recipe: r, type: 'baby' }));
  }
  console.log(chalk.cyan(`[batch-sync] 待处理：${toSync.length} 道（filter=${typeFilter || 'all'}）`));

  // 查询云端已有，跳过重复
  let existingIds = new Set();
  if (!force) {
    console.log(chalk.gray('[batch-sync] 正在查询云端已有记录…'));
    existingIds = await fetchExistingIds();
    console.log(chalk.gray(`[batch-sync] 云端已有 ${existingIds.size} 条记录`));
  }

  const skipped = [];
  const willSync = [];
  for (const item of toSync) {
    const id = item.recipe.id || item.recipe.name;
    if (!force && existingIds.has(id)) {
      skipped.push(item.recipe.name);
    } else {
      willSync.push(item);
    }
  }

  if (skipped.length > 0) {
    console.log(chalk.yellow(`[batch-sync] 跳过（云端已有）：${skipped.length} 道`));
  }
  console.log(chalk.cyan(`[batch-sync] 将写入：${willSync.length} 道\n`));

  if (willSync.length === 0) {
    console.log(chalk.green('所有菜谱已在云端，无需写入。'));
    return;
  }

  if (dryRun) {
    willSync.forEach((item, i) => {
      const doc = buildCloudDoc(item.recipe, item.type, slugMap);
      console.log(chalk.gray(`  [${i + 1}] (dry-run) ${item.type} | id=${doc.id} | ${doc.name} | cover=${doc.coverFileID || '无'}`));
    });
    console.log(chalk.yellow(`\n[dry-run] 以上 ${willSync.length} 道菜将写入云端。去掉 --dry-run 执行正式写入。`));
    return;
  }

  // 正式写入
  const db = getDb();
  const coll = db.collection('recipes');
  let success = 0;
  let fail = 0;

  for (let i = 0; i < willSync.length; i++) {
    const item = willSync[i];
    const doc = buildCloudDoc(item.recipe, item.type, slugMap);
    try {
      await coll.add(doc);
      success++;
      console.log(chalk.green(`  [${i + 1}/${willSync.length}] ${doc.name} (${doc.id}) ✓`));
    } catch (err) {
      fail++;
      console.error(chalk.red(`  [${i + 1}/${willSync.length}] ${doc.name} (${doc.id}) ✗ ${err.message}`));
    }
    // 避免触发云开发限频（每秒约 50 次），每 20 条休息 1 秒
    if ((i + 1) % 20 === 0 && i + 1 < willSync.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(chalk.cyan(`\n[batch-sync] 完成：成功 ${success}，失败 ${fail}，跳过 ${skipped.length}`));
}

main().catch((err) => {
  console.error(chalk.red('\n[batch-sync] 发生错误：'));
  console.error(err);
  process.exit(1);
});
