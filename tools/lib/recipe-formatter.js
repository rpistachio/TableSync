import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

function loadExistingAdultRecipes() {
  const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
  // CommonJS 模块，直接 require
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const recipesModule = require(recipesPath);
  return recipesModule.adultRecipes || [];
}

function buildIdCounters(existing) {
  const counters = {
    'a-soup': 0,
    'a-chi': 0,
    'a-pork': 0,
    'a-beef': 0,
    'a-fish': 0,
    'a-shrimp': 0,
    'a-veg': 0
  };
  existing.forEach((r) => {
    if (!r.id || typeof r.id !== 'string') return;
    // 只统计标准格式 a-xxx-N，忽略 a-veg-test-1 等非数字后缀，删除测试数据后不会产生 ID 冲突
    const m = r.id.match(/^(a\-(soup|chi|pork|beef|fish|shrimp|veg))\-(\d+)$/);
    if (!m) return;
    const prefix = m[1];
    const n = Number(m[3]) || 0;
    counters[prefix] = Math.max(counters[prefix], n);
  });
  return counters;
}

function pickPrefix(recipe) {
  if (recipe.dish_type === 'soup') return 'a-soup';
  switch (recipe.meat) {
    case 'chicken': return 'a-chi';
    case 'pork': return 'a-pork';
    case 'beef': return 'a-beef';
    case 'fish': return 'a-fish';
    case 'shrimp': return 'a-shrimp';
    default: return 'a-veg';
  }
}

/**
 * 为 LLM 生成的 items 分配不冲突的 ID，并做基础校验。
 * @param {{items: Array}} raw
 * @returns {{items: Array}} same shape, 但 recipe.id 已规范化
 */
export function normalizeGeneratedItems(raw) {
  if (!raw || !Array.isArray(raw.items)) {
    throw new Error('LLM 返回结果格式错误：缺少 items 数组');
  }

  const existing = loadExistingAdultRecipes();
  const nameSet = new Set(existing.map((r) => r.name));
  const counters = buildIdCounters(existing);

  const skipped = [];
  const normalizedItems = [];

  for (let idx = 0; idx < raw.items.length; idx++) {
    const item = raw.items[idx];
    const recipe = item.recipe || {};
    if (!recipe.name) {
      console.warn(`⚠ 第 ${idx + 1} 个条目缺少 recipe.name，已跳过`);
      skipped.push({ idx, reason: '缺少 name' });
      continue;
    }
    if (nameSet.has(recipe.name)) {
      console.warn(`⚠ 菜名已存在，自动跳过重复：${recipe.name}`);
      skipped.push({ idx, reason: `重复: ${recipe.name}` });
      continue;
    }

    // 标记为已使用，防止同一批次内部重复
    nameSet.add(recipe.name);

    const prefix = pickPrefix(recipe);
    counters[prefix] += 1;
    const id = `${prefix}-${counters[prefix]}`;

    const fixed = {
      type: 'adult',
      taste: recipe.taste || inferTaste(recipe),
      meat: recipe.meat || inferMeat(recipe),
      prep_time: recipe.prep_time || 15,
      is_baby_friendly: recipe.is_baby_friendly ?? false,
      common_allergens: recipe.common_allergens || [],
      can_share_base: recipe.can_share_base ?? false,
      dish_type: recipe.dish_type,
      flavor_profile: recipe.flavor_profile || inferFlavorProfile(recipe),
      cook_type: recipe.cook_type || inferCookType(recipe),
      cook_minutes: recipe.cook_minutes || (recipe.taste === 'slow_stew' ? 90 : 15),
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || []
    };

    normalizedItems.push({
      ...item,
      recipe: {
        ...recipe,
        ...fixed,
        id
      }
    });
  }

  if (skipped.length > 0) {
    console.warn(`\n共跳过 ${skipped.length} 条：${skipped.map(s => s.reason).join('、')}`);
  }
  if (normalizedItems.length === 0) {
    throw new Error('所有菜谱都已存在或无效，没有可用的新菜谱');
  }

  return { items: normalizedItems };
}

function inferTaste(recipe) {
  const name = recipe.name || '';
  if (name.includes('凉拌') || name.includes('沙拉')) return 'steamed_salad';
  if (name.includes('汤') || name.includes('炖') || name.includes('煲')) return 'slow_stew';
  return 'quick_stir_fry';
}

function inferMeat(recipe) {
  const name = recipe.name || '';
  if (name.includes('乌鸡') || name.includes('鸡')) return 'chicken';
  if (name.includes('排骨') || name.includes('猪') || name.includes('猪蹄')) return 'pork';
  if (name.includes('牛')) return 'beef';
  if (name.includes('虾')) return 'shrimp';
  if (name.includes('鱼')) return 'fish';
  return 'vegetable';
}

function inferFlavorProfile(recipe) {
  const name = recipe.name || '';
  if (name.includes('辣')) return 'spicy';
  if (name.includes('番茄') || name.includes('番茄') || name.includes('糖醋')) return 'sweet_sour';
  if (name.includes('柠檬') || name.includes('凉拌')) return 'sour_fresh';
  if (recipe.taste === 'steamed_salad') return 'light';
  return 'salty_umami';
}

function inferCookType(recipe) {
  if (recipe.taste === 'slow_stew' || recipe.dish_type === 'soup') return 'stew';
  if (recipe.taste === 'steamed_salad') return 'steam';
  return 'stir_fry';
}

