/**
 * 统筹预览计算引擎（串行 vs 并行时间、效率得分、烹饪顺序）
 * 供 mix 与 preview 页面共用
 */

var DEVICE_LABELS = {
  'wok': '炒锅', 'stove_long': '炖锅', 'steamer': '蒸锅',
  'pot': '汤锅', 'none': '无需设备'
};

var COOK_TYPE_TO_DEVICE = {
  stir_fry: 'wok', quick_stir_fry: 'wok', fry: 'wok', braise: 'wok',
  stew: 'stove_long', steam: 'steamer', cold: 'none',
  salad: 'none', cold_dress: 'none', boil: 'pot'
};

/**
 * 计算统筹预览信息（精细版）
 *
 * 算法思路：
 *   1. 按烹饪方式分类：炖煮（无需看管，可并行）、蒸制（可并行）、快炒（需连续关注，串行）、凉菜（不占灶）
 *   2. 并行优化时间 = 备菜(0.6折) + max(炖煮, 蒸制) + sum(快炒) - 备菜与炖煮重叠
 *   3. 峰值灶台 = 同时运行的炖锅数(≤2) + 蒸锅(可叠蒸=1) + 炒锅(串行=1)
 *   4. 生成分阶段烹饪顺序建议 & 效率得分
 *
 * @param {Array} selectedRecipes - 已选菜谱（含 prep_time, cook_minutes, cook_type, name）
 * @returns {Object}
 */
function computeSchedulePreview(selectedRecipes) {
  var empty = {
    totalTime: 0, serialTime: 0, savedTime: 0,
    stoveCount: 0, devices: [],
    firstDish: '', cookingOrder: [], tips: [],
    prepTime: 0, cookTime: 0, efficiency: 0,
    hasStew: false, hasSteam: false, hasStirFry: false, hasCold: false
  };
  if (!selectedRecipes || selectedRecipes.length === 0) return empty;

  var stewDishes = [];
  var steamDishes = [];
  var stirFryDishes = [];
  var coldDishes = [];

  var totalPrepTime = 0;
  var deviceCounts = {};
  var i;

  for (i = 0; i < selectedRecipes.length; i++) {
    var r = selectedRecipes[i];
    var prep = r.prep_time || 10;
    var cook = r.cook_minutes || 15;
    totalPrepTime += prep;

    var cookType = r.cook_type || 'stir_fry';
    var device = COOK_TYPE_TO_DEVICE[cookType] || 'wok';
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;

    var dish = { name: r.name || '未命名', prep: prep, cook: cook, cookType: cookType, device: device };

    if (cookType === 'stew') {
      stewDishes.push(dish);
    } else if (cookType === 'steam') {
      steamDishes.push(dish);
    } else if (cookType === 'cold_dress' || cookType === 'cold' || cookType === 'salad') {
      coldDishes.push(dish);
    } else {
      stirFryDishes.push(dish);
    }
  }

  var maxStewCook = 0;
  var maxSteamCook = 0;
  var totalStirFryCook = 0;
  for (i = 0; i < stewDishes.length; i++) {
    if (stewDishes[i].cook > maxStewCook) maxStewCook = stewDishes[i].cook;
  }
  for (i = 0; i < steamDishes.length; i++) {
    if (steamDishes[i].cook > maxSteamCook) maxSteamCook = steamDishes[i].cook;
  }
  for (i = 0; i < stirFryDishes.length; i++) {
    totalStirFryCook += stirFryDishes[i].cook;
  }

  var parallelCookTime = Math.max(maxStewCook, maxSteamCook) + totalStirFryCook;
  var effectivePrepTime = Math.round(totalPrepTime * 0.6);
  var overlapWindow = Math.max(maxStewCook, maxSteamCook);
  var prepOverlapSavings = Math.min(effectivePrepTime, overlapWindow);
  var totalTime = Math.max(effectivePrepTime + parallelCookTime - prepOverlapSavings, 10);

  var serialTime = totalPrepTime;
  for (i = 0; i < selectedRecipes.length; i++) {
    serialTime += (selectedRecipes[i].cook_minutes || 15);
  }
  var savedTime = Math.max(serialTime - totalTime, 0);

  var peakStoves = 0;
  if (stewDishes.length > 0) peakStoves += Math.min(stewDishes.length, 2);
  if (steamDishes.length > 0) peakStoves += 1;
  if (stirFryDishes.length > 0) peakStoves += 1;

  var devices = [];
  for (var d in deviceCounts) {
    if (deviceCounts.hasOwnProperty(d) && deviceCounts[d] > 0 && d !== 'none') {
      devices.push({ name: DEVICE_LABELS[d] || d, count: deviceCounts[d], key: d });
    }
  }

  var cookingOrder = [];
  if (stewDishes.length > 0) {
    var stewNames = [];
    for (i = 0; i < stewDishes.length; i++) stewNames.push(stewDishes[i].name);
    cookingOrder.push({
      phase: '先启动炖煮',
      icon: '🍲',
      dishes: stewNames,
      dishesText: stewNames.join('、'),
      note: '炖煮期间无需看管',
      time: maxStewCook + ' 分钟',
      noWatch: true
    });
  }
  if (steamDishes.length > 0) {
    var steamNames = [];
    for (i = 0; i < steamDishes.length; i++) steamNames.push(steamDishes[i].name);
    cookingOrder.push({
      phase: '同时上蒸锅',
      icon: '♨️',
      dishes: steamNames,
      dishesText: steamNames.join('、'),
      note: '蒸制期间可备其他菜',
      time: maxSteamCook + ' 分钟',
      noWatch: true
    });
  }
  if (stirFryDishes.length > 0) {
    var sfNames = [];
    for (i = 0; i < stirFryDishes.length; i++) sfNames.push(stirFryDishes[i].name);
    cookingOrder.push({
      phase: '最后快炒',
      icon: '🔥',
      dishes: sfNames,
      dishesText: sfNames.join('、'),
      note: '逐道翻炒，趁热上桌',
      time: totalStirFryCook + ' 分钟'
    });
  }
  if (coldDishes.length > 0) {
    var coldNames = [];
    for (i = 0; i < coldDishes.length; i++) coldNames.push(coldDishes[i].name);
    cookingOrder.push({
      phase: '凉菜随时',
      icon: '🥗',
      dishes: coldNames,
      dishesText: coldNames.join('、'),
      note: '提前拌好即可',
      time: '不占灶'
    });
  }

  var tips = [];
  if (savedTime >= 10) {
    tips.push('统筹并行比逐道做可节省约 ' + savedTime + ' 分钟');
  }
  if (stewDishes.length > 0 && stirFryDishes.length > 0) {
    tips.push('先启动炖菜，利用炖煮时间备菜和快炒');
  }
  if (deviceCounts['wok'] > 2) {
    tips.push('炒菜较多（' + deviceCounts['wok'] + ' 道），建议分批操作');
  }
  if (peakStoves > 3) {
    tips.push('灶台需求较高，建议减少一道需要火眼的菜');
  }
  if (stewDishes.length > 1) {
    tips.push('有 ' + stewDishes.length + ' 道炖菜，注意灶台分配');
  }

  var efficiency = 0;
  if (serialTime > 0) {
    efficiency = Math.round((1 - totalTime / serialTime) * 100);
    efficiency = Math.max(0, Math.min(99, efficiency));
  }

  return {
    totalTime: totalTime,
    serialTime: serialTime,
    savedTime: savedTime,
    stoveCount: peakStoves,
    devices: devices,
    firstDish: stewDishes.length > 0 ? stewDishes[0].name
             : steamDishes.length > 0 ? steamDishes[0].name : '',
    cookingOrder: cookingOrder,
    tips: tips,
    prepTime: effectivePrepTime,
    cookTime: parallelCookTime,
    efficiency: efficiency,
    hasStew: stewDishes.length > 0,
    hasSteam: steamDishes.length > 0,
    hasStirFry: stirFryDishes.length > 0,
    hasCold: coldDishes.length > 0
  };
}

module.exports = {
  computeSchedulePreview: computeSchedulePreview,
  DEVICE_LABELS: DEVICE_LABELS
};
