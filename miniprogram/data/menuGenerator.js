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

function generateMenu(taste, meat, babyMonth, hasBaby, adultCount, babyTaste) {
  adultCount = adultCount == null ? 2 : adultCount;
  var meatKey = normalizeMeat(meat);
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  var config = getBabyConfig(m);
  var validBabyTastes = ['soft_porridge', 'finger_food', 'braised_mash'];
  var babyTasteKey = (babyTaste && validBabyTastes.indexOf(babyTaste) !== -1) ? babyTaste : 'soft_porridge';

  var aPool = adultRecipes.filter(function (r) { return r.taste === taste && r.meat === meatKey; });
  var adultRaw = (aPool.length > 0 ? aPool : adultRecipes)[Math.floor(Math.random() * (aPool.length || adultRecipes.length))];
  var adult = adultRaw ? JSON.parse(JSON.stringify(adultRaw)) : null;

  var bPool = babyRecipes.filter(function (r) {
    return r.meat === meatKey && (r.taste === babyTasteKey || (r.taste == null && babyTasteKey === 'soft_porridge'));
  });
  if (bPool.length === 0) bPool = babyRecipes.filter(function (r) { return r.meat === meatKey; });
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

function buildIngredientsInfo(recipe, shoppingList) {
  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return '主食材';
  var amountByKey = {};
  if (Array.isArray(shoppingList)) {
    shoppingList.forEach(function (item) {
      if (item && item.name != null) {
        var key = item.name + '\u0001' + (item.sub_type != null ? item.sub_type : '');
        amountByKey[key] = item.amount != null ? item.amount : '适量';
      }
    });
  }
  var mainParts = [];
  recipe.ingredients.forEach(function (it) {
    var name = typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : ''));
    if (!name) return;
    var category = typeof it === 'object' && it != null && it.category != null ? it.category : '';
    if (category !== '肉类' && category !== '蔬菜' && category !== '其他' && category !== '干货') return;
    var subType = (typeof it === 'object' && it != null && it.sub_type != null) ? it.sub_type : '';
    var key = name + '\u0001' + subType;
    var amount = amountByKey[key] != null ? amountByKey[key] : '适量';
    mainParts.push(name + ' (' + amount + ')');
  });
  if (mainParts.length === 0) return '主食材';
  return '主食材 ' + mainParts.join('、');
}

function replaceStepPlaceholders(text, recipe, shoppingList, scaleText) {
  if (!text || typeof text !== 'string') return text;
  var out = text;
  var ingredientsInfo = buildIngredientsInfo(recipe, shoppingList);
  out = out.replace(/\{\{ingredients_info\}\}/g, ingredientsInfo);
  if (scaleText != null) out = out.replace(/\{\{scale_hint\}\}/g, scaleText);
  return out;
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

function generateSteps(adultRecipe, babyRecipe, shoppingList) {
  var steps = [];
  var id = 1;
  var hasAdult = adultRecipe && Array.isArray(adultRecipe.steps) && adultRecipe.steps.length > 0;
  var hasBaby = babyRecipe && Array.isArray(babyRecipe.steps) && babyRecipe.steps.length > 0;
  var list = Array.isArray(shoppingList) ? shoppingList : [];

  if (hasAdult && !hasBaby) {
    (adultRecipe.steps || []).forEach(function (step, i) {
      var raw = getStepText(step);
      if (!raw) return;
      var text = replaceStepPlaceholders(raw, adultRecipe, list, '');
      steps.push({ id: id++, title: '步骤 ' + (i + 1), details: [text], role: 'adult', completed: false, duration: estimateMinutes(text) });
    });
    return steps;
  }
  if (hasBaby && !hasAdult) {
    (babyRecipe.steps || []).forEach(function (s, i) {
      var raw = getStepText(s);
      if (!raw) return;
      var text = replaceStepPlaceholders(raw, babyRecipe, list, '');
      steps.push({ id: id++, title: '步骤 ' + (i + 1), details: [text], role: 'baby', completed: false, duration: estimateMinutes(text) });
    });
    return steps;
  }

  var adultSteps = getStepsByAction(adultRecipe);
  var babySteps = getStepsByAction(babyRecipe);
  var babySteamMins = babySteps.cook.reduce(function (sum, t) { return sum + estimateMinutes(t); }, 0) || 15;
  var adultPrepRaw = adultSteps.prep[0] || '肉类腌制与配菜切配。';
  var adultPrepText = replaceStepPlaceholders(adultPrepRaw, adultRecipe, list, '');
  var babyMonth = (babyRecipe && babyRecipe.month) || 6;
  var config = getBabyConfig(babyMonth);
  var adultCanShare = adultRecipe && adultRecipe.can_share_base === true;
  var babyCanShare = babyRecipe && babyRecipe.can_share_base === true;
  var shareBase = adultCanShare && babyCanShare;

  if (shareBase) {
    var sharedMain = (adultRecipe && MEAT_LABEL[adultRecipe.meat]) || (babyRecipe && MEAT_LABEL[babyRecipe.meat]) || '主料';
    steps.push({ id: id++, title: '步骤 1：联合备菜', details: ['✨ 今日共用食材：' + sharedMain + '。', '👨 【大人端】🔥 请一次性洗净、去刺/去腥，按比例预留份量。', '👶 【宝宝端】🔥 从中分出约 50g 单独装小碗备用，剩余留给大人。'], role: 'both', completed: false, duration: 10 });
    steps.push({ id: id++, title: '步骤 2：并行烹饪（利用宝宝蒸煮间隙处理成人菜）', details: ['👶 【宝宝端】🔥 宝宝端先上火蒸（计时 ' + babySteamMins + 'min），蒸至熟软。', '👨 【大人端】⏳ 大人端利用间隙：' + adultPrepText, '✨ 省时窍门：共用蒸锅可分层放置，一锅同蒸省时省气。'], role: 'both', completed: false, duration: Math.max(babySteamMins, adultSteps.prep.reduce(function (s, t) { return s + estimateMinutes(t); }, 0) || 10) });
  } else {
    var babyPrepRaw = babySteps.prep[0] || '宝宝食材洗净切配。';
    var babyPrepText = replaceStepPlaceholders(babyPrepRaw, babyRecipe, list, '');
    steps.push({ id: id++, title: '步骤 1：大人备菜', details: ['👨 【大人端】🔥 ' + adultPrepText], role: 'adult', completed: false, duration: 10 });
    steps.push({ id: id++, title: '步骤 2：宝宝备菜', details: ['👶 【宝宝端】🔥 ' + babyPrepText], role: 'baby', completed: false, duration: 10 });
    steps.push({ id: id++, title: '步骤 3：并行烹饪', details: ['👶 【宝宝端】🔥 宝宝端先上火蒸（计时 ' + babySteamMins + 'min），蒸至熟软。', '👨 【大人端】⏳ 大人端：' + (adultSteps.cook.slice(0, 2).join('；') || '大火快炒、调味装盘。')], role: 'both', completed: false, duration: Math.max(babySteamMins, adultSteps.prep.reduce(function (s, t) { return s + estimateMinutes(t); }, 0) || 10) });
  }
  var adultCook = adultSteps.cook.slice(0, 2).join('；') || '大火快炒、调味装盘。';
  steps.push({ id: id++, title: shareBase ? '步骤 3：分锅调味' : '步骤 4：分锅调味', details: ['👶 【宝宝端】✨ ' + config.action + '，' + config.salt, '👨 【大人端】🔥 ' + adultCook, '✨ 宝宝与大人分别调味，按需装盘即可。'], role: 'both', completed: false, duration: 10 });
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
  var items = [];
  function add(list, isFromBaby) {
    if (!Array.isArray(list)) return;
    list.forEach(function (it) {
      var name = typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : ''));
      if (!name) return;
      var category = (typeof it === 'object' && it != null && it.category != null) ? it.category : '其他';
      var subType = (category === '肉类' && typeof it === 'object' && it != null && it.sub_type != null) ? it.sub_type : undefined;
      var baseAmount = (typeof it === 'object' && it != null && typeof it.baseAmount === 'number') ? it.baseAmount : 1;
      var unit = (typeof it === 'object' && it != null && it.unit != null) ? String(it.unit) : '份';
      items.push({ name: name, sub_type: subType, category: category, baseAmount: baseAmount, unit: unit, isFromBaby: !!isFromBaby });
    });
  }
  add(adultRecipe && adultRecipe.ingredients, false);
  add(babyRecipe && babyRecipe.ingredients, true);
  if (items.length === 0) {
    var main = adultRecipe || babyRecipe;
    if (main && main.meat) {
      var mainName = MEAT_LABEL[main.meat] || main.meat;
      items.push({ name: mainName, sub_type: undefined, category: '肉类', baseAmount: 200, unit: 'g', isFromBaby: false });
    }
    if (items.length === 0) items.push({ name: '主料', sub_type: undefined, category: '其他', baseAmount: 1, unit: '份', isFromBaby: false });
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
    var value;
    var unit;
    if (typeof it === 'object' && it != null && typeof it.baseAmount === 'number' && it.unit != null) {
      value = it.baseAmount;
      unit = String(it.unit).trim() || '份';
      if (unit === '适量') return;
    } else {
      var amountStr = (typeof it === 'object' && it != null && it.amount != null) ? String(it.amount).trim() : '适量';
      var match = amountStr.match(re);
      if (!match) return;
      value = parseFloat(match[1]);
      unit = (match[2] || '').trim() || '份';
    }
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
