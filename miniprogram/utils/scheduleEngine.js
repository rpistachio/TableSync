/**
 * 统筹预览计算引擎（与 JIT 甘特图对齐，消除选菜页与步骤页时间打架）
 * 供 mix 与 preview 页面共用
 */

const DEVICE_LABELS = {
  wok: '炒锅', stove_long: '炖锅', steamer: '蒸锅',
  pot: '汤锅', none: '无需设备', air_fryer: '空气炸锅'
};

const COOK_TYPE_TO_DEVICE = {
  stir_fry: 'wok', quick_stir_fry: 'wok', fry: 'wok', braise: 'wok',
  stew: 'stove_long', steam: 'steamer', cold: 'none',
  salad: 'none', cold_dress: 'none', boil: 'pot', air_fryer: 'air_fryer'
};

const COLD_COOK_TYPES = ['cold', 'cold_dress', 'salad'];
const ASYNC_MARINATE = /腌制|腌渍|腌\s*\d/;
const ASYNC_SOAK = /泡发|浸泡/;
const LONG_STEW_ACTIVE_MIN = 5;

/** 从菜谱步骤中估算异步等待时间（腌制/泡发），用于折叠扣除 */
function getAsyncWaitMinutes(recipe) {
  if (!recipe || !Array.isArray(recipe.steps)) return 0;
  let wait = 0;
  for (const step of recipe.steps) {
    const text = (step.text || step.details && step.details[0]) || '';
    const dur = typeof step.duration_num === 'number' ? step.duration_num : (text.match(/\d+/) ? parseInt(text.match(/\d+/)[0], 10) : 0);
    if (ASYNC_MARINATE.test(text) || ASYNC_SOAK.test(text)) {
      wait += dur;
    }
  }
  return wait;
}

/** 从步骤估算备菜主动时间（扣除异步等待后的 prep） */
function getPrepActiveMinutes(recipe) {
  if (!recipe || !Array.isArray(recipe.steps)) return recipe.prep_time || 10;
  let prep = 0;
  for (const step of recipe.steps) {
    const action = step.action || step.step_type;
    if (action === 'prep') {
      const text = (step.text || step.details && step.details[0]) || '';
      if (ASYNC_MARINATE.test(text) || ASYNC_SOAK.test(text)) {
        prep += 1;
      } else {
        prep += typeof step.duration_num === 'number' ? step.duration_num : 8;
      }
    }
  }
  return prep > 0 ? prep : (recipe.prep_time || 10);
}

/**
 * 计算统筹预览信息（与 JIT 引擎对齐：异步折叠、双灶并发、长炖降权、冷菜免计）
 *
 * 目标：选菜页预估与甘特图实际误差 < 10 分钟
 */
function computeSchedulePreview(selectedRecipes, kitchenConfig) {
  const empty = {
    totalTime: 0, serialTime: 0, savedTime: 0,
    stoveCount: 0, devices: [],
    firstDish: '', cookingOrder: [], tips: [],
    prepTime: 0, cookTime: 0, efficiency: 0,
    hasStew: false, hasSteam: false, hasStirFry: false, hasCold: false, hasAirFry: false
  };
  if (!selectedRecipes || selectedRecipes.length === 0) return empty;

  const airFryDishes = [];
  const stewDishes = [];
  const steamDishes = [];
  const stirFryDishes = [];
  const coldDishes = [];
  let totalPrepActive = 0;
  let asyncFoldedTotal = 0;
  const deviceCounts = {};

  for (const r of selectedRecipes) {
    const cookType = r.cook_type || 'stir_fry';
    const device = COOK_TYPE_TO_DEVICE[cookType] || 'wok';
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;

    const prepActive = getPrepActiveMinutes(r);
    const asyncWait = getAsyncWaitMinutes(r);
    totalPrepActive += prepActive;
    asyncFoldedTotal += asyncWait;

    const cookRaw = r.cook_minutes != null ? r.cook_minutes : 15;
    const isCold = COLD_COOK_TYPES.indexOf(cookType) !== -1;
    const isLongStew = cookType === 'stew' && cookRaw > 45;
    const cook = isCold ? 0 : (isLongStew ? LONG_STEW_ACTIVE_MIN : cookRaw);

    const dish = { name: r.name || '未命名', prep: prepActive, cook, cookType, device };

    if (cookType === 'air_fryer') {
      airFryDishes.push(dish);
    } else if (cookType === 'stew') {
      stewDishes.push(dish);
    } else if (cookType === 'steam') {
      steamDishes.push(dish);
    } else if (isCold) {
      coldDishes.push(dish);
    } else {
      stirFryDishes.push(dish);
    }
  }

  const maxAirFryCook = airFryDishes.length ? Math.max(...airFryDishes.map((d) => d.cook)) : 0;
  const maxStewCook = stewDishes.length ? Math.max(...stewDishes.map((d) => d.cook)) : 0;
  const maxSteamCook = steamDishes.length ? Math.max(...steamDishes.map((d) => d.cook)) : 0;
  const totalStirFryCook = stirFryDishes.reduce((s, d) => s + d.cook, 0);

  const kc = kitchenConfig || {};
  const burners = Math.max(1, Math.min(4, kc.burners != null ? kc.burners : 2));
  const effectivePrepTime = Math.round(totalPrepActive * 0.6);
  const parallelWindow = Math.max(maxAirFryCook, maxStewCook, maxSteamCook);

  let totalTime;
  if (burners <= 1) {
    // 单灶：炖煮/蒸 占唯一火眼时，快炒只能等；快炒也串行
    const stewSteamSeq = maxStewCook + maxSteamCook;
    totalTime = Math.max(effectivePrepTime + stewSteamSeq + totalStirFryCook + maxAirFryCook, 10);
  } else {
    totalTime = Math.max(effectivePrepTime + parallelWindow + totalStirFryCook, 10);
  }

  let serialTime = totalPrepActive + asyncFoldedTotal;
  for (const r of selectedRecipes) {
    const ct = r.cook_type || 'stir_fry';
    if (COLD_COOK_TYPES.indexOf(ct) !== -1) continue;
    serialTime += (ct === 'stew' && (r.cook_minutes || 0) > 45) ? LONG_STEW_ACTIVE_MIN : (r.cook_minutes || 15);
  }
  const savedTime = Math.max(serialTime - totalTime, 0);

  let peakStoves = 0;
  if (stewDishes.length > 0) peakStoves += Math.min(stewDishes.length, 2);
  if (steamDishes.length > 0) peakStoves += 1;
  if (stirFryDishes.length > 0) peakStoves += 1;

  const devices = [];
  for (const d of Object.keys(deviceCounts)) {
    if (deviceCounts[d] > 0 && d !== 'none') {
      devices.push({ name: DEVICE_LABELS[d] || d, count: deviceCounts[d], key: d });
    }
  }

  const cookingOrder = [];
  if (airFryDishes.length > 0) {
    cookingOrder.push({
      phase: '先启动空气炸锅',
      icon: '🍟',
      dishes: airFryDishes.map((d) => d.name),
      dishesText: airFryDishes.map((d) => d.name).join('、'),
      note: '空炸期间无需看管',
      time: maxAirFryCook + ' 分钟',
      noWatch: true
    });
  }
  if (stewDishes.length > 0) {
    cookingOrder.push({
      phase: '先启动炖煮',
      icon: '🍲',
      dishes: stewDishes.map((d) => d.name),
      dishesText: stewDishes.map((d) => d.name).join('、'),
      note: '炖煮期间无需看管',
      time: maxStewCook + ' 分钟',
      noWatch: true
    });
  }
  if (steamDishes.length > 0) {
    cookingOrder.push({
      phase: '同时上蒸锅',
      icon: '♨️',
      dishes: steamDishes.map((d) => d.name),
      dishesText: steamDishes.map((d) => d.name).join('、'),
      note: '蒸制期间可备其他菜',
      time: maxSteamCook + ' 分钟',
      noWatch: true
    });
  }
  if (stirFryDishes.length > 0) {
    cookingOrder.push({
      phase: '最后快炒',
      icon: '🔥',
      dishes: stirFryDishes.map((d) => d.name),
      dishesText: stirFryDishes.map((d) => d.name).join('、'),
      note: '逐道翻炒，趁热上桌',
      time: totalStirFryCook + ' 分钟'
    });
  }
  if (coldDishes.length > 0) {
    cookingOrder.push({
      phase: '凉菜随时',
      icon: '🥗',
      dishes: coldDishes.map((d) => d.name),
      dishesText: coldDishes.map((d) => d.name).join('、'),
      note: '贴近开饭前拌好即可',
      time: '不占灶'
    });
  }

  const tips = [];
  if (savedTime >= 10) {
    tips.push('统筹并行比逐道做可节省约 ' + savedTime + ' 分钟');
  }
  if (airFryDishes.length > 0 && (stewDishes.length > 0 || stirFryDishes.length > 0)) {
    tips.push('先启动空气炸锅，利用空炸时间备菜或做其他菜');
  }
  if (stewDishes.length > 0 && stirFryDishes.length > 0) {
    tips.push('先启动炖菜，利用炖煮时间备菜和快炒');
  }
  if (deviceCounts.wok > 2) {
    tips.push('炒菜较多（' + deviceCounts.wok + ' 道），建议分批操作');
  }
  if (peakStoves > 3) {
    tips.push('灶台需求较高，建议减少一道需要火眼的菜');
  }
  if (stewDishes.length > 1) {
    tips.push('有 ' + stewDishes.length + ' 道炖菜，注意灶台分配');
  }

  let efficiency = 0;
  if (serialTime > 0) {
    efficiency = Math.round((1 - totalTime / serialTime) * 100);
    efficiency = Math.max(0, Math.min(99, efficiency));
  }

  return {
    totalTime,
    serialTime,
    savedTime,
    stoveCount: peakStoves,
    devices,
    firstDish: airFryDishes.length > 0 ? airFryDishes[0].name
      : stewDishes.length > 0 ? stewDishes[0].name
      : steamDishes.length > 0 ? steamDishes[0].name : '',
    cookingOrder,
    tips,
    prepTime: effectivePrepTime,
    cookTime: parallelWindow + totalStirFryCook,
    efficiency,
    hasStew: stewDishes.length > 0,
    hasSteam: steamDishes.length > 0,
    hasStirFry: stirFryDishes.length > 0,
    hasCold: coldDishes.length > 0,
    hasAirFry: airFryDishes.length > 0
  };
}

module.exports = {
  computeSchedulePreview: computeSchedulePreview,
  DEVICE_LABELS: DEVICE_LABELS
};
