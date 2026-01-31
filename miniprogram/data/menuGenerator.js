/**
 * 菜单与步骤生成逻辑（微信小程序版 - CommonJS）
 */
var recipes = require('./recipes.js');
var adultRecipes = recipes.adultRecipes;
var babyRecipes = recipes.babyRecipes;

var MEAT_LABEL = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鳕鱼', shrimp: '虾仁' };
var MEAT_KEY_MAP = { 鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp', chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp' };

function normalizeMeat(meat) {
  var key = MEAT_KEY_MAP[meat] || meat;
  return typeof key === 'string' ? key : 'chicken';
}

function getBabyConfig(month) {
  var m = Math.min(36, Math.max(6, Number(month) || 6));
  if (m <= 8) return { suffix: '泥', action: '打成细腻泥糊状', salt: '⚠️ 此时期严禁加盐、酱油或糖，保持食材原味以保护肾脏。' };
  if (m <= 12) return { suffix: '末', action: '切碎成末（米粒大小）', salt: '⚠️ 此时期严禁加盐、酱油或糖，保持食材原味以保护肾脏。' };
  if (m <= 18) return { suffix: '丁', action: '切成小丁', salt: '🧂 少量调味：全天盐 <1g (约一个黄豆大小) 或低钠酱油 2滴。' };
  if (m <= 24) return { suffix: '块', action: '切成小块', salt: '🧂 适度调味：全天盐 <2g，建议优先使用天然香料（如香菇粉）。' };
  return { suffix: '块', action: '正常切块', salt: '🥗 过渡饮食：可少量尝试成人餐，但需保持低油低盐，避免重口味。' };
}

function generateMenu(taste, meat, babyMonth, hasBaby, adultCount) {
  adultCount = adultCount == null ? 2 : adultCount;
  var meatKey = normalizeMeat(meat);
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  var config = getBabyConfig(m);

  var aPool = adultRecipes.filter(function (r) { return r.taste === taste && r.meat === meatKey; });
  var adultRaw = (aPool.length > 0 ? aPool : adultRecipes)[Math.floor(Math.random() * (aPool.length || adultRecipes.length))];
  var adult = adultRaw ? JSON.parse(JSON.stringify(adultRaw)) : null;

  var bPool = babyRecipes.filter(function (r) { return r.meat === meatKey; });
  var rawBaby;
  if (meatKey === 'fish') {
    rawBaby = bPool.find(function (r) { return r.id === 'b-fish-detail'; }) || bPool[0] || babyRecipes[0];
  } else {
    rawBaby = (bPool.length > 0 ? bPool : babyRecipes)[Math.floor(Math.random() * (bPool.length || babyRecipes.length))];
  }

  var baby = null;
  if (hasBaby) {
    rawBaby = rawBaby || babyRecipes[0];
    if (rawBaby) {
      baby = JSON.parse(JSON.stringify(rawBaby));
      var baseName = (baby.name || '宝宝餐').replace(/(泥|末|丁|块)$/, '');
      baby.name = baseName + config.suffix;
      baby.meat = meatKey;
      baby.month = m;
      baby.steps = (baby.steps || []).map(function (s) {
        var step = typeof s === 'string' ? { action: 'cook', text: s } : Object.assign({}, s);
        var t = String(step.text != null ? step.text : '');
        if (step.action === 'process') t = config.action;
        if (step.action === 'seasoning') t = config.salt;
        t = t.replace(/\{\{process_action\}\}/g, config.action).replace(/\{\{seasoning_hint\}\}/g, config.salt);
        return Object.assign({}, step, { text: t });
      });
    }
  }

  if (adult && Array.isArray(adult.steps)) {
    var scale = Math.max(1, Number(adultCount) || 2) / 2;
    var scaleText = scale % 1 === 0 ? String(scale) : scale.toFixed(1);
    adult.steps = adult.steps.map(function (s) {
      var step = typeof s === 'string' ? { action: 'prep', text: s } : Object.assign({}, s);
      var text = String(step.text != null ? step.text : '').replace(/\{\{scale_hint\}\}/g, scaleText);
      return Object.assign({}, step, { text: text });
    });
  }

  function estimateRecipeTime(recipe) {
    if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < recipe.steps.length; i++) {
      var st = recipe.steps[i];
      var txt = typeof st === 'string' ? st : (st && st.text != null ? st.text : '');
      sum += estimateMinutes(txt);
    }
    return Math.min(120, sum);
  }
  if (adult) adult.time = adult.time != null ? adult.time : estimateRecipeTime(adult);
  if (baby) baby.time = baby.time != null ? baby.time : estimateRecipeTime(baby);

  return { adultRecipe: adult, babyRecipe: baby };
}

function getStepText(step) {
  if (step == null) return '';
  return typeof step === 'string' ? step : String((step && step.text != null ? step.text : '') || '');
}

function getStepsByAction(recipe) {
  var getSafeText = function (s) { return (typeof s === 'object' && s ? s.text : s) || ''; };
  var steps = (recipe && recipe.steps) ? recipe.steps.slice() : [];
  var prep = steps.filter(function (s) { return s != null && ((typeof s === 'object' && s && s.action === 'prep') || !(s && s.action)); }).map(getSafeText).filter(function (t) { return t !== ''; });
  var cook = steps.filter(function (s) { return s != null && typeof s === 'object' && s && s.action === 'cook'; }).map(getSafeText).filter(function (t) { return t !== ''; });
  var process = steps.filter(function (s) { return s != null && typeof s === 'object' && s && s.action === 'process'; }).map(getSafeText).filter(function (t) { return t !== ''; });
  var seasoning = steps.filter(function (s) { return s != null && typeof s === 'object' && s && s.action === 'seasoning'; }).map(getSafeText).filter(function (t) { return t !== ''; });
  return {
    prep: prep.length > 0 ? prep : [''],
    cook: cook.length > 0 ? cook : [''],
    process: process.length > 0 ? process : [''],
    seasoning: seasoning.length > 0 ? seasoning : ['']
  };
}

function estimateMinutes(text) {
  if (!text || typeof text !== 'string') return 5;
  var t = text;
  if (/\d+\s*小时|炖\s*[12]|煲\s*1\.5/.test(t)) return 60;
  if (/\d+\s*小时|炖\s*\d+|煲\s*\d+/.test(t)) return 90;
  var mat = t.match(/蒸\s*(\d+)|蒸约\s*(\d+)/);
  if (mat) return Math.max(10, parseInt(mat[1] || mat[2], 10) + 5);
  if (/焯水|洗净|腌制|切/.test(t)) return 8;
  if (/炒|煎|淋/.test(t)) return 5;
  return 5;
}

function generateSteps(adultRecipe, babyRecipe) {
  var steps = [];
  var id = 1;
  var hasAdult = adultRecipe && Array.isArray(adultRecipe.steps) && adultRecipe.steps.length > 0;
  var hasBaby = babyRecipe && Array.isArray(babyRecipe.steps) && babyRecipe.steps.length > 0;

  if (hasAdult && !hasBaby) {
    (adultRecipe.steps || []).forEach(function (step, i) {
      var text = getStepText(step);
      if (!text) return;
      steps.push({ id: id++, title: '步骤 ' + (i + 1), details: [text], role: 'adult', completed: false, duration: estimateMinutes(text) });
    });
    return steps;
  }
  if (hasBaby && !hasAdult) {
    (babyRecipe.steps || []).forEach(function (s, i) {
      var text = getStepText(s);
      if (!text) return;
      steps.push({ id: id++, title: '步骤 ' + (i + 1), details: [text], role: 'baby', completed: false, duration: estimateMinutes(text) });
    });
    return steps;
  }

  var adultSteps = getStepsByAction(adultRecipe);
  var babySteps = getStepsByAction(babyRecipe);
  var sharedMain = (adultRecipe && MEAT_LABEL[adultRecipe.meat]) || (babyRecipe && MEAT_LABEL[babyRecipe.meat]) || '主料';
  var babySteamMins = babySteps.cook.reduce(function (sum, t) { return sum + estimateMinutes(t); }, 0) || 15;
  var adultPrepText = adultSteps.prep[0] || '肉类腌制与配菜切配。';
  var babyMonth = (babyRecipe && babyRecipe.month) || 6;
  var config = getBabyConfig(babyMonth);

  steps.push({ id: id++, title: '步骤 1：联合备菜', details: ['✨ 今日共用食材：' + sharedMain + '。', '👨 【大人端】🔥 请一次性洗净、去刺/去腥，按比例预留份量。', '👶 【宝宝端】🔥 从中分出约 50g 单独装小碗备用，剩余留给大人。'], role: 'both', completed: false, duration: 10 });
  steps.push({ id: id++, title: '步骤 2：并行烹饪（利用宝宝蒸煮间隙处理成人菜）', details: ['👶 【宝宝端】🔥 宝宝端先上火蒸（计时 ' + babySteamMins + 'min），蒸至熟软。', '👨 【大人端】⏳ 大人端利用间隙：' + adultPrepText, '✨ 省时窍门：共用蒸锅可分层放置，一锅同蒸省时省气。'], role: 'both', completed: false, duration: Math.max(babySteamMins, adultSteps.prep.reduce(function (s, t) { return s + estimateMinutes(t); }, 0) || 10) });
  var adultCook = adultSteps.cook.slice(0, 2).join('；') || '大火快炒、调味装盘。';
  steps.push({ id: id++, title: '步骤 3：分锅调味', details: ['👶 【宝宝端】✨ ' + config.action + '，' + config.salt, '👨 【大人端】🔥 ' + adultCook, '✨ 宝宝与大人分别调味，按需装盘即可。'], role: 'both', completed: false, duration: 10 });
  return steps;
}

function generateExplanation(adultRecipe, babyRecipe) {
  var a = (adultRecipe && adultRecipe.name) ? '成人餐：' + adultRecipe.name : '';
  var b = (babyRecipe && babyRecipe.name) ? '宝宝餐：' + babyRecipe.name : '';
  return [a, b].filter(Boolean).join('；') || '请选择口味与主食材后生成菜单';
}

function getIngredientNames(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function (it) { return typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : '')); }).filter(Boolean);
}

function generateShoppingListRaw(adultRecipe, babyRecipe) {
  var aNames = new Set(getIngredientNames(adultRecipe && adultRecipe.ingredients));
  var bNames = new Set(getIngredientNames(babyRecipe && babyRecipe.ingredients));
  var sharedNames = Array.from(aNames).filter(function (n) { return bNames.has(n); });
  var items = [];
  var seen = new Set();
  function add(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (it) {
      var name = typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : ''));
      if (!name || seen.has(name)) return;
      seen.add(name);
      items.push({ name: name, category: (typeof it === 'object' && it != null && it.category != null) ? it.category : '其他', isShared: sharedNames.indexOf(name) !== -1 });
    });
  }
  add(adultRecipe && adultRecipe.ingredients);
  add(babyRecipe && babyRecipe.ingredients);
  // 菜谱数据无 ingredients 时，用主料生成至少一项，避免清单为空
  if (items.length === 0) {
    var main = adultRecipe || babyRecipe;
    if (main && main.meat) {
      var mainName = MEAT_LABEL[main.meat] || main.meat;
      items.push({ name: mainName, category: '肉类', isShared: false });
    }
    if (items.length === 0) items.push({ name: '主料', category: '其他', isShared: false });
  }
  return items;
}

var AGGREGATE_EMPTY_PLACEHOLDER = [{ name: '暂无全周食材数据', amount: '-', category: '其他', isShared: false, isWeekly: true }];

function aggregateWeeklyIngredients(ingredientsArray) {
  if (!Array.isArray(ingredientsArray) || ingredientsArray.length === 0) return AGGREGATE_EMPTY_PLACEHOLDER;
  var re = /(\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]*)/;
  var map = new Map();
  function getCategory(it) { return (typeof it === 'object' && it != null && it.category != null) ? it.category : '其他'; }
  ingredientsArray.forEach(function (it) {
    var name = typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : ''));
    if (!name) return;
    if (!map.has(name)) map.set(name, { category: getCategory(it), byUnit: new Map() });
    var row = map.get(name);
    var amountStr = (typeof it === 'object' && it != null && it.amount != null) ? String(it.amount).trim() : '适量';
    var match = amountStr.match(re);
    if (!match) return;
    var value = parseFloat(match[1]);
    var unit = (match[2] || '').trim() || '份';
    row.byUnit.set(unit, (row.byUnit.get(unit) || 0) + value);
  });
  var items = [];
  map.forEach(function (val, name) {
    var category = val.category;
    var byUnit = val.byUnit;
    var amount;
    if (byUnit.size === 0) amount = '适量';
    else {
      var parts = [];
      byUnit.forEach(function (sum, unit) {
        var display = Number.isInteger(sum) ? sum : parseFloat(sum.toFixed(2));
        var suffix = unit === '份' ? '' : unit;
        parts.push(display + suffix + ' (全周累计)');
      });
      amount = parts.join('、');
    }
    items.push({ name: name, amount: amount, category: category, isShared: false, isWeekly: true });
  });
  return items.length > 0 ? items : AGGREGATE_EMPTY_PLACEHOLDER;
}

module.exports = {
  generateMenu: generateMenu,
  generateSteps: generateSteps,
  generateExplanation: generateExplanation,
  generateShoppingList: generateShoppingListRaw,
  aggregateWeeklyIngredients: aggregateWeeklyIngredients
};
