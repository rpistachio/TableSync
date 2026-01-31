/**
 * 唯一对外出口：组合封装（微信小程序版 - CommonJS）
 */
var generator = require('./menuGenerator.js');

var MEAT_LABEL_MAP = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼肉', shrimp: '虾仁' };
exports.MEAT_KEY_MAP = { 鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp', chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp' };

var VALID_ADULT_TASTES = ['quick_stir_fry', 'slow_stew', 'steamed_salad'];
var VALID_BABY_TASTES = ['soft_porridge', 'finger_food', 'braised_mash'];
var VALID_MEATS = ['chicken', 'pork', 'beef', 'fish', 'shrimp'];
var categoryOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 2, '干货': 2, '调料': 3, '辅食': 4, '其他': 5 };
var cache = {};

function normalizePreference(preference) {
  if (preference == null || typeof preference !== 'object') {
    return { adultTaste: 'quick_stir_fry', babyTaste: 'soft_porridge', meat: 'chicken', adultCount: 2, babyMonth: 6, hasBaby: false };
  }
  var adultTaste = preference.adultTaste != null ? preference.adultTaste : preference.taste;
  var babyTaste = preference.babyTaste;
  var meat = preference.meat;
  var adultCount = Math.min(6, Math.max(1, Number(preference.adultCount) || 2));
  var babyMonth = Math.min(36, Math.max(6, Number(preference.babyMonth) || 6));
  var hasBaby = preference.hasBaby === '1' || preference.hasBaby === true;
  if (VALID_ADULT_TASTES.indexOf(adultTaste) === -1) adultTaste = 'quick_stir_fry';
  if (VALID_BABY_TASTES.indexOf(babyTaste) === -1) babyTaste = 'soft_porridge';
  meat = exports.MEAT_KEY_MAP[meat] || (VALID_MEATS.indexOf(meat) !== -1 ? meat : 'chicken');
  return { adultTaste: adultTaste, babyTaste: babyTaste, meat: meat, adultCount: adultCount, babyMonth: babyMonth, hasBaby: hasBaby };
}

function getAdaptedRecipes(preference) {
  var norm = normalizePreference(preference);
  var key = norm.adultTaste + '_' + norm.babyTaste + '_' + norm.meat + '_' + norm.babyMonth + '_' + norm.adultCount + '_' + norm.hasBaby;
  if (!cache[key]) {
    cache[key] = generator.generateMenu(norm.adultTaste, norm.meat, norm.babyMonth, norm.hasBaby, norm.adultCount, norm.babyTaste);
  }
  var res = cache[key];
  return { adultTaste: norm.adultTaste, babyTaste: norm.babyTaste, meat: norm.meat, adultRecipe: res.adultRecipe || null, babyRecipe: res.babyRecipe || null };
}

/**
 * 仅接收已处理好的 adapted 数据，不再内部调用 getAdaptedRecipes，避免循环调用
 */
function buildMenuFromAdapted(adapted) {
  var adultRecipe = adapted.adultRecipe;
  var babyRecipe = adapted.babyRecipe;
  var meat = adapted.meat;

  var adultMenu = adultRecipe ? [{ name: adultRecipe.name, time: adultRecipe.time != null ? adultRecipe.time : 0 }] : [{ name: '今日主菜（请选择口味与主食材后重新生成）', time: 0 }];
  var babyMenu = babyRecipe ? { name: babyRecipe.name, from: '共用食材：' + MEAT_LABEL_MAP[meat] } : { name: MEAT_LABEL_MAP[meat] + '系列辅食', from: '共用食材：' + MEAT_LABEL_MAP[meat] + '，正在根据月龄定制' };

  var totalTime = (adultRecipe && babyRecipe) ? Math.max(adultRecipe.time != null ? adultRecipe.time : 0, babyRecipe.time != null ? babyRecipe.time : 0) : ((adultRecipe && adultRecipe.time != null ? adultRecipe.time : 0) || (babyRecipe && babyRecipe.time != null ? babyRecipe.time : 0) || 0);
  var totalTimeDisplay = totalTime > 0 ? totalTime : 25;
  var explanation = generator.generateExplanation(adultRecipe, babyRecipe);

  return { taste: adapted.adultTaste, meat: meat, adultMenu: adultMenu, babyMenu: babyMenu, totalTime: totalTimeDisplay, explanation: explanation };
}

exports.getTodayMenu = function (preference) {
  var adapted = getAdaptedRecipes(preference);
  var menu = buildMenuFromAdapted(adapted);
  return Object.assign({}, menu, { adultRecipe: adapted.adultRecipe || null, babyRecipe: adapted.babyRecipe || null });
};

exports.generateSteps = function (preference) {
  var adapted = getAdaptedRecipes(preference);
  var shoppingList = exports.generateShoppingList(preference);
  return generator.generateSteps(adapted.adultRecipe, adapted.babyRecipe, shoppingList);
};

function formatAmount(value) {
  if (value == null || isNaN(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  var v = parseFloat(value.toFixed(2));
  return v % 1 === 0 ? String(Math.round(v)) : String(v);
}

exports.generateShoppingList = function (preference) {
  var adapted = getAdaptedRecipes(preference);
  var adultCount = preference && typeof preference.adultCount !== 'undefined' ? Math.min(6, Math.max(1, Number(preference.adultCount) || 2)) : 2;
  var raw = generator.generateShoppingList(adapted.adultRecipe, adapted.babyRecipe);
  var groupKey = function (item) { return (item.name != null ? item.name : '') + '\u0001' + (item.sub_type != null ? item.sub_type : ''); };
  var groups = {};
  raw.forEach(function (item) {
    var key = groupKey(item);
    if (!groups[key]) groups[key] = { name: item.name, sub_type: item.sub_type, category: item.category != null ? item.category : '其他', unit: (item.unit != null && String(item.unit).trim() !== '') ? String(item.unit).trim() : '份', rows: [] };
    groups[key].rows.push(item);
  });
  var list = [];
  var idx = 0;
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    var totalRaw = 0;
    var isLiang = g.unit === '适量' || g.rows.every(function (r) { var b = (r.baseAmount != null && typeof r.baseAmount === 'number') ? r.baseAmount : 1; return b === 0; });
    g.rows.forEach(function (row) {
      var base = (row.baseAmount != null && typeof row.baseAmount === 'number') ? row.baseAmount : 1;
      if (g.category === '肉类' || g.category === '蔬菜') {
        totalRaw += row.isFromBaby ? base : base * adultCount;
      } else if (g.category === '调料' || g.category === '干货') {
        if (!isLiang) totalRaw += row.isFromBaby ? base : base * (1 + 0.2 * (adultCount - 1));
      } else {
        totalRaw += row.isFromBaby ? base : base * adultCount;
      }
    });
    var amountDisplay;
    if (g.category === '肉类' || g.category === '蔬菜') {
      amountDisplay = formatAmount(totalRaw) + g.unit;
    } else if (g.category === '调料' || g.category === '干货') {
      if (isLiang || totalRaw === 0) amountDisplay = '适量';
      else amountDisplay = formatAmount(totalRaw) + g.unit;
    } else {
      if (g.unit === '适量' || totalRaw === 0) amountDisplay = '适量';
      else amountDisplay = formatAmount(totalRaw) + g.unit;
    }
    list.push({
      id: ++idx,
      name: g.name != null ? g.name : '未知',
      sub_type: g.sub_type,
      amount: amountDisplay,
      rawAmount: totalRaw,
      unit: g.unit,
      checked: false,
      category: g.category,
      order: categoryOrder[g.category] != null ? categoryOrder[g.category] : 5,
      isShared: g.rows.some(function (r) { return r.isFromBaby; }) && g.rows.some(function (r) { return !r.isFromBaby; })
    });
  });
  if (list.length === 0) {
    list = [{ id: 1, name: '请先生成菜单后查看清单', sub_type: undefined, amount: '—', rawAmount: 0, unit: '—', checked: false, category: '其他', order: 99, isShared: false }];
  }
  return list;
};

function getWeeklyPlaceholder() {
  return [{ id: 1, name: '请先在首页生成菜单', amount: '-', checked: false, category: '其他', order: 99 }];
}

var MEAT_LABEL_MAP_WEEKLY = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼肉', shrimp: '虾仁' };

exports.generateWeeklyShoppingList = function (weeklyPreferences) {
  var prefs = Array.isArray(weeklyPreferences) ? weeklyPreferences.slice(0, 7) : [];
  if (prefs.length === 0) return getWeeklyPlaceholder();
  var allIngredients = [];
  for (var i = 0; i < prefs.length; i++) {
    var p = prefs[i];
    var norm = normalizePreference(p);
    var res = generator.generateMenu(norm.adultTaste, norm.meat, norm.babyMonth, norm.hasBaby, norm.adultCount, norm.babyTaste);
    if (res.adultRecipe && res.adultRecipe.ingredients && res.adultRecipe.ingredients.length > 0) {
      allIngredients = allIngredients.concat(res.adultRecipe.ingredients);
    }
    if (res.babyRecipe && res.babyRecipe.ingredients && res.babyRecipe.ingredients.length > 0) {
      allIngredients = allIngredients.concat(res.babyRecipe.ingredients);
    }
    if ((!res.adultRecipe || !res.adultRecipe.ingredients || res.adultRecipe.ingredients.length === 0) &&
        (!res.babyRecipe || !res.babyRecipe.ingredients || res.babyRecipe.ingredients.length === 0)) {
      var mainName = MEAT_LABEL_MAP_WEEKLY[norm.meat] || norm.meat;
      allIngredients.push({ name: mainName, amount: '1 份', category: '肉类' });
    }
  }
  var raw = generator.aggregateWeeklyIngredients(allIngredients);
  var list = raw.map(function (item, idx) {
    return { id: idx + 1, name: item.name != null ? item.name : '未知', amount: item.amount != null ? item.amount : '适量', checked: false, category: item.category != null ? item.category : '其他', order: categoryOrder[item.category] != null ? categoryOrder[item.category] : 5, isShared: item.isShared || false, isWeekly: item.isWeekly !== false };
  });
  if (list.length === 0) list = [{ id: 1, name: '请设置一周偏好后查看清单', amount: '—', checked: false, category: '其他', order: 99 }];
  return list;
};
