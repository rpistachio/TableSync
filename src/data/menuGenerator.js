import { adultRecipes, babyRecipes } from './recipes.js';

// 主料中文名（用于“今日共用xxx”等展示）
const MEAT_LABEL = {
  chicken: '鸡肉',
  pork: '猪肉',
  beef: '牛肉',
  fish: '鳕鱼',
  shrimp: '虾仁'
};

// 中文 -> 英文 meat 键（参数归一化）
const MEAT_KEY_MAP = {
  鸡肉: 'chicken',
  猪肉: 'pork',
  牛肉: 'beef',
  鱼肉: 'fish',
  虾仁: 'shrimp',
  chicken: 'chicken',
  pork: 'pork',
  beef: 'beef',
  fish: 'fish',
  shrimp: 'shrimp'
};

function normalizeMeat(meat) {
  const key = MEAT_KEY_MAP[meat] || meat;
  return typeof key === 'string' ? key : 'chicken';
}

/** 月龄 6–36，返回 suffix / action / salt（用于替换 {{process_action}}、{{seasoning_hint}}） */
function getBabyConfig(month) {
  const m = Math.min(36, Math.max(6, Number(month) || 6));
  if (m <= 8) return { suffix: '泥', action: '打成细腻泥糊状', salt: '⚠️ 此时期严禁加盐、酱油或糖，保持食材原味以保护肾脏。' };
  if (m <= 12) return { suffix: '末', action: '切碎成末（米粒大小）', salt: '⚠️ 此时期严禁加盐、酱油或糖，保持食材原味以保护肾脏。' };
  if (m <= 18) return { suffix: '丁', action: '切成小丁', salt: '🧂 少量调味：全天盐 <1g (约一个黄豆大小) 或低钠酱油 2滴。' };
  if (m <= 24) return { suffix: '块', action: '切成小块', salt: '🧂 适度调味：全天盐 <2g，建议优先使用天然香料（如香菇粉）。' };
  return { suffix: '块', action: '正常切块', salt: '🥗 过渡饮食：可少量尝试成人餐，但需保持低油低盐，避免重口味。' };
}

/**
 * 核心筛选逻辑：参数归一化、严禁占位、动态替换月龄文案
 */
export function generateMenu(taste, meat, babyMonth, hasBaby, adultCount = 2) {
  const meatKey = normalizeMeat(meat);
  const m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  const config = getBabyConfig(m);

  // 成人菜：按 taste + meat 筛选，无则全库随机
  let aPool = adultRecipes.filter((r) => r.taste === taste && r.meat === meatKey);
  const adultRaw = (aPool.length > 0 ? aPool : adultRecipes)[
    Math.floor(Math.random() * (aPool.length || adultRecipes.length))
  ];
  let adult = adultRaw ? JSON.parse(JSON.stringify(adultRaw)) : null;

  // 宝宝菜：按 meat 筛选，fish 首选 b-fish-detail，无则从 babyRecipes 挑，hasBaby 为 true 时强制实例化
  let bPool = babyRecipes.filter((r) => r.meat === meatKey);
  let rawBaby;
  if (meatKey === 'fish') {
    rawBaby = bPool.find(r => r.id === 'b-fish-detail') || bPool[0] || babyRecipes[0];
  } else {
    rawBaby = (bPool.length > 0 ? bPool : babyRecipes)[
      Math.floor(Math.random() * (bPool.length || babyRecipes.length))
    ];
  }

  let baby = null;
  if (hasBaby) {
    // 强制实例化，确保 baby 不为 null
    rawBaby = rawBaby || babyRecipes[0];
    if (rawBaby) {
      baby = JSON.parse(JSON.stringify(rawBaby));
      const baseName = (baby.name || '宝宝餐').replace(/(泥|末|丁|块)$/, '');
      baby.name = baseName + config.suffix;
      baby.meat = meatKey;
      baby.month = m; // 存储月龄信息
      baby.steps = (baby.steps || []).map((s) => {
        const step = typeof s === 'string' ? { action: 'cook', text: s } : { ...s };
        let t = String(step.text ?? '');
        if (step.action === 'process') t = config.action;
        if (step.action === 'seasoning') t = config.salt;
        t = t.replace(/\{\{process_action\}\}/g, config.action).replace(/\{\{seasoning_hint\}\}/g, config.salt);
        return { ...step, text: t };
      });
    }
  }

  if (adult && Array.isArray(adult.steps)) {
    const scale = Math.max(1, Number(adultCount) || 2) / 2;
    const scaleText = scale % 1 === 0 ? String(scale) : scale.toFixed(1);
    adult.steps = adult.steps.map((s) => {
      const step = typeof s === 'string' ? { action: 'prep', text: s } : { ...s };
      const text = String(step.text ?? '').replace(/\{\{scale_hint\}\}/g, scaleText);
      return { ...step, text };
    });
  }

  // 根据步骤文案估算菜谱总时长（分钟），供菜单页与总耗时展示
  function estimateRecipeTime(recipe) {
    if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) return 0;
    let sum = 0;
    for (const step of recipe.steps) {
      const text = typeof step === 'string' ? step : (step?.text ?? '');
      sum += estimateMinutes(text);
    }
    return Math.min(120, sum);
  }
  if (adult) adult.time = adult.time ?? estimateRecipeTime(adult);
  if (baby) baby.time = baby.time ?? estimateRecipeTime(baby);

  return { adultRecipe: adult, babyRecipe: baby };
}

function getStepText(step) {
  if (step == null) return '';
  return typeof step === 'string' ? step : String((step?.text ?? '') || '');
}

/**
 * 从 recipe 中按 action 分类提取步骤文案，防御空步骤、单步骤、畸形数据。
 * 必须使用可选链 ?. 并在提取 text 时提供空字符串回退 || ''，严禁报 Cannot read property 'text' of undefined。
 */
function getStepsByAction(recipe) {
  const getSafeText = (s) => (typeof s === 'object' ? s?.text : s) || '';
  const steps = Array.from(recipe?.steps || []);
  
  const prep = steps
    .filter((s) => s != null && ((typeof s === 'object' && s?.action === 'prep') || !s?.action))
    .map(getSafeText)
    .filter((t) => t !== '');
  
  const cook = steps
    .filter((s) => s != null && typeof s === 'object' && s?.action === 'cook')
    .map(getSafeText)
    .filter((t) => t !== '');
  
  const process = steps
    .filter((s) => s != null && typeof s === 'object' && s?.action === 'process')
    .map(getSafeText)
    .filter((t) => t !== '');
  
  const seasoning = steps
    .filter((s) => s != null && typeof s === 'object' && s?.action === 'seasoning')
    .map(getSafeText)
    .filter((t) => t !== '');
  
  // 确保每个数组至少有一个空字符串成员
  return {
    prep: prep.length > 0 ? prep : [''],
    cook: cook.length > 0 ? cook : [''],
    process: process.length > 0 ? process : [''],
    seasoning: seasoning.length > 0 ? seasoning : ['']
  };
}

function estimateMinutes(text) {
  if (!text || typeof text !== 'string') return 5;
  const t = text;
  if (/\d+\s*小时|炖\s*[12]|煲\s*1\.5/.test(t)) return 60;
  if (/\d+\s*小时|炖\s*\d+|煲\s*\d+/.test(t)) return 90;
  if (/蒸\s*\d+|蒸约\s*\d+/.test(t)) {
    const m = t.match(/蒸\s*(\d+)|蒸约\s*(\d+)/);
    return m ? Math.max(10, parseInt(m[1] || m[2], 10) + 5) : 15;
  }
  if (/焯水|洗净|腌制|切/.test(t)) return 8;
  if (/炒|煎|淋/.test(t)) return 5;
  return 5;
}

/**
 * 厨房管家逻辑：三步按【联合备菜】->【并行工序】->【分锅收尾】，体现共用食材与高效并行
 */
export function generateSteps(adultRecipe, babyRecipe) {
  const steps = [];
  let id = 1;

  const hasAdult = adultRecipe && Array.isArray(adultRecipe.steps) && adultRecipe.steps.length > 0;
  const hasBaby = babyRecipe && Array.isArray(babyRecipe.steps) && babyRecipe.steps.length > 0;

  if (hasAdult && !hasBaby) {
    (adultRecipe.steps || []).forEach((step, i) => {
      const text = getStepText(step);
      if (!text) return;
      steps.push({ id: id++, title: `步骤 ${i + 1}`, details: [text], role: 'adult', completed: false, duration: estimateMinutes(text) });
    });
    return steps;
  }

  if (hasBaby && !hasAdult) {
    (babyRecipe.steps || []).forEach((s, i) => {
      const text = getStepText(s);
      if (!text) return;
      steps.push({ id: id++, title: `步骤 ${i + 1}`, details: [text], role: 'baby', completed: false, duration: estimateMinutes(text) });
    });
    return steps;
  }

  const adultSteps = getStepsByAction(adultRecipe);
  const babySteps = getStepsByAction(babyRecipe);
  const sharedMain = MEAT_LABEL[adultRecipe?.meat] || MEAT_LABEL[babyRecipe?.meat] || '主料';
  const babySteamMins = babySteps.cook.reduce((sum, t) => sum + estimateMinutes(t), 0) || 15;
  const adultPrepText = adultSteps.prep[0] || '肉类腌制与配菜切配。';
  
  // 获取宝宝月龄配置
  const babyMonth = babyRecipe?.month || 6;
  const config = getBabyConfig(babyMonth);

  // 1. 联合备菜
  steps.push({
    id: id++,
    title: '步骤 1：联合备菜',
    details: [
      `✨ 今日共用食材：${sharedMain}。`,
      `👨 【大人端】🔥 请一次性洗净、去刺/去腥，按比例预留份量。`,
      `👶 【宝宝端】🔥 从中分出约 50g 单独装小碗备用，剩余留给大人。`
    ],
    role: 'both',
    completed: false,
    duration: 10
  });

  // 2. 并行工序（利用宝宝蒸煮间隙处理成人菜）
  steps.push({
    id: id++,
    title: '步骤 2：并行烹饪（利用宝宝蒸煮间隙处理成人菜）',
    details: [
      `👶 【宝宝端】🔥 宝宝端先上火蒸（计时 ${babySteamMins}min），蒸至熟软。`,
      `👨 【大人端】⏳ 大人端利用间隙：${adultPrepText}`,
      `✨ 省时窍门：共用蒸锅可分层放置，一锅同蒸省时省气。`
    ],
    role: 'both',
    completed: false,
    duration: Math.max(babySteamMins, adultSteps.prep.reduce((s, t) => s + estimateMinutes(t), 0) || 10)
  });

  // 3. 分锅收尾
  const adultCook = adultSteps.cook.slice(0, 2).map((t) => t).join('；') || '大火快炒、调味装盘。';
  steps.push({
    id: id++,
    title: '步骤 3：分锅调味',
    details: [
      `👶 【宝宝端】✨ ${config.action}，${config.salt}`,
      `👨 【大人端】🔥 ${adultCook}`,
      `✨ 宝宝与大人分别调味，按需装盘即可。`
    ],
    role: 'both',
    completed: false,
    duration: 10
  });

  return steps;
}

export function generateExplanation(adultRecipe, babyRecipe) {
  const a = adultRecipe?.name ? `成人餐：${adultRecipe.name}` : '';
  const b = babyRecipe?.name ? `宝宝餐：${babyRecipe.name}` : '';
  return [a, b].filter(Boolean).join('；') || '请选择口味与主食材后生成菜单';
}

function getIngredientNames(list) {
  if (!Array.isArray(list)) return [];
  return list.map((it) => (typeof it === 'string' ? it : (it?.name ?? it?.ingredient ?? ''))).filter(Boolean);
}

export function generateShoppingList(adultRecipe, babyRecipe) {
  const aNames = new Set(getIngredientNames(adultRecipe?.ingredients));
  const bNames = new Set(getIngredientNames(babyRecipe?.ingredients));
  const sharedNames = [...aNames].filter((n) => bNames.has(n));

  const items = [];
  const seen = new Set();
  const add = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((it) => {
      const name = typeof it === 'string' ? it : (it?.name ?? it?.ingredient ?? '');
      if (!name || seen.has(name)) return;
      seen.add(name);
      items.push({
        name,
        category: typeof it === 'object' && it != null ? (it.category ?? '其他') : '其他',
        isShared: sharedNames.includes(name)
      });
    });
  };
  add(adultRecipe?.ingredients);
  add(babyRecipe?.ingredients);
  return items;
}

/**
 * 从 amount 字符串中提取数值和单位（如 g, kg, 个, 盒）。
 * 无法解析（如「适量」）时返回 { value: null, unit: '', raw }。
 */
function parseAmount(amountStr) {
  if (amountStr == null || typeof amountStr !== 'string') {
    return { value: null, unit: '', raw: '适量' };
  }
  const s = String(amountStr).trim();
  if (!s) return { value: null, unit: '', raw: '适量' };
  const match = s.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]*)/);
  if (!match) return { value: null, unit: '', raw: s };
  const value = parseFloat(match[1]);
  const unit = (match[2] || '').trim();
  return { value, unit, raw: s };
}

/**
 * 周食材动态合算：按名称 Map 聚合，同名同单位数值累加，同名不同单位用「、」分隔，无法提取数值则仅合并名称。
 * 返回 { name, amount, category, isShared, isWeekly }。
 */
const AGGREGATE_EMPTY_PLACEHOLDER = [{ name: '暂无全周食材数据', amount: '-', category: '其他', isShared: false, isWeekly: true }];

export function aggregateWeeklyIngredients(ingredientsArray) {
  if (!Array.isArray(ingredientsArray) || ingredientsArray.length === 0) {
    return AGGREGATE_EMPTY_PLACEHOLDER;
  }
  // 解析：/(\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]*)/ 解析 amount
  const re = /(\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]*)/;
  /** @type {Map<string, { category: string, byUnit: Map<string, number> }> */
  const map = new Map();
  const getCategory = (it) => (typeof it === 'object' && it != null ? (it.category ?? '其他') : '其他');

  ingredientsArray.forEach((it) => {
    const name = typeof it === 'string' ? it : (it?.name ?? it?.ingredient ?? '');
    if (!name) return;
    if (!map.has(name)) map.set(name, { category: getCategory(it), byUnit: new Map() });
    const row = map.get(name);
    const amountStr = typeof it === 'object' && it != null ? String(it.amount ?? '适量').trim() : '适量';
    const match = amountStr.match(re);
    if (!match) return;
    const value = parseFloat(match[1]);
    const unit = (match[2] || '').trim() || '份';
    row.byUnit.set(unit, (row.byUnit.get(unit) || 0) + value);
  });

  const items = [];
  for (const [name, { category, byUnit }] of map) {
    let amount;
    if (byUnit.size === 0) {
      amount = '适量';
    } else {
      const parts = [];
      for (const [unit, sum] of byUnit) {
        const display = Number.isInteger(sum) ? sum : parseFloat(sum.toFixed(2));
        const suffix = unit === '份' ? '' : unit;
        parts.push(`${display}${suffix} (全周累计)`);
      }
      amount = parts.join('、');
    }
    items.push({ name, amount, category, isShared: false, isWeekly: true });
  }
  if (items.length === 0) {
    return AGGREGATE_EMPTY_PLACEHOLDER;
  }
  return items;
}
