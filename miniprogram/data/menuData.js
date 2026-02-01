/**
 * 唯一对外出口：组合封装（微信小程序版 - CommonJS）
 */
var generator = require('./menuGenerator.js');

var MEAT_LABEL_MAP = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼肉', shrimp: '虾仁', vegetable: '素菜' };
exports.MEAT_KEY_MAP = { 鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp', 素菜: 'vegetable', chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp', vegetable: 'vegetable' };

/** 根据 babyMonth 从 recipe.baby_variant.stages 取展示名，供预览弹窗 babyName 使用 */
exports.getBabyVariantByAge = function (recipe, babyMonth) {
  return (generator.getBabyVariantByAge && generator.getBabyVariantByAge(recipe, babyMonth)) || null;
};

var VALID_ADULT_TASTES = ['quick_stir_fry', 'slow_stew', 'steamed_salad'];
var VALID_BABY_TASTES = ['soft_porridge', 'finger_food', 'braised_mash'];
var VALID_MEATS = ['chicken', 'pork', 'beef', 'fish', 'shrimp'];
var categoryOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 2, '干货': 2, '调料': 3, '辅食': 4, '其他': 5 };
var cache = {};
var adultByNameCache = null;
var adultByFlavorCache = null;
var adultByMeatCache = null;

/** 无感构建：仅用一次遍历 adultRecipes 同时填满 ByName / ByFlavor / ByMeat，不重复扫描 */
function ensureAdultCache(recipesModule, adultRecipesList) {
  if (adultByNameCache != null) return;
  var list = adultRecipesList || (recipesModule && recipesModule.adultRecipes) || [];
  adultByNameCache = {};
  adultByFlavorCache = { light: [], salty_umami: [], spicy: [], sweet_sour: [], sour_fresh: [] };
  adultByMeatCache = { chicken: [], pork: [], beef: [], fish: [], shrimp: [], vegetable: [] };
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.name) adultByNameCache[r.name] = r;
    var f = r.flavor_profile || 'salty_umami';
    if (adultByFlavorCache[f]) adultByFlavorCache[f].push(r);
    var m = r.meat || 'vegetable';
    if (adultByMeatCache[m]) adultByMeatCache[m].push(r);
  }
}

function normalizePreference(preference) {
  if (preference == null || typeof preference !== 'object') {
    return { adultTaste: 'quick_stir_fry', babyTaste: 'soft_porridge', meat: 'chicken', adultCount: 2, babyMonth: 6, hasBaby: false, meatCount: 1, vegCount: 1 };
  }
  var adultTaste = preference.adultTaste != null ? preference.adultTaste : preference.taste;
  var babyTaste = preference.babyTaste;
  var meat = preference.meat;
  var adultCount = Math.min(6, Math.max(1, Number(preference.adultCount) || 2));
  var babyMonth = Math.min(36, Math.max(6, Number(preference.babyMonth) || 6));
  var hasBaby = preference.hasBaby === '1' || preference.hasBaby === true;
  var meatCount = Math.min(3, Math.max(0, Number(preference.meatCount) || 1));
  var vegCount = Math.min(2, Math.max(0, Number(preference.vegCount) || 1));
  if (VALID_ADULT_TASTES.indexOf(adultTaste) === -1) adultTaste = 'quick_stir_fry';
  if (VALID_BABY_TASTES.indexOf(babyTaste) === -1) babyTaste = 'soft_porridge';
  meat = exports.MEAT_KEY_MAP[meat] || (VALID_MEATS.indexOf(meat) !== -1 ? meat : 'chicken');
  return { adultTaste: adultTaste, babyTaste: babyTaste, meat: meat, adultCount: adultCount, babyMonth: babyMonth, hasBaby: hasBaby, meatCount: meatCount, vegCount: vegCount };
}

function getDishCountByAdultCount(adultCount) {
  var n = Math.min(6, Math.max(1, Number(adultCount) || 2));
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  return 3;
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
 * 根据 adultCount 推荐多道主食：≤2人→1道，3-4人→2道，5人以上→3道。
 * 多道菜之间 meat 互斥，尽量包含一道 slow_stew；多菜时强制其中 1 道为素菜类。
 * 宝宝辅食仅在第一道中。
 */
exports.getTodayMenus = function (preference) {
  var norm = normalizePreference(preference);
  var dishCount = getDishCountByAdultCount(norm.adultCount);
  var meats = [norm.meat];
  if (dishCount >= 2) {
    meats.push('vegetable');
  }
  if (dishCount >= 3) {
    for (var i = 0; i < VALID_MEATS.length && meats.length < dishCount; i++) {
      if (meats.indexOf(VALID_MEATS[i]) === -1) {
        meats.push(VALID_MEATS[i]);
        break;
      }
    }
  }
  var tastes = [norm.adultTaste];
  if (dishCount >= 2) tastes.push('quick_stir_fry');
  if (dishCount >= 3) {
    var thirdTaste = norm.adultTaste !== 'slow_stew' ? 'slow_stew' : 'steamed_salad';
    tastes.push(thirdTaste);
  }
  var menus = [];
  for (var k = 0; k < dishCount; k++) {
    var hasBabyThis = (k === 0 && norm.hasBaby);
    var tasteK = tastes[k] != null ? tastes[k] : norm.adultTaste;
    var res = generator.generateMenu(tasteK, meats[k], norm.babyMonth, hasBabyThis, norm.adultCount, norm.babyTaste);
    menus.push({
      meat: meats[k],
      taste: tasteK,
      adultRecipe: res.adultRecipe || null,
      babyRecipe: res.babyRecipe || null
    });
  }
  return menus;
};

/** 打乱数组（用于随机抽荤） */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 预设经典套餐（3–4 人标准搭配），口味均衡 */
var PREDEFINED_COMBOS = [
  { meatCount: 1, vegCount: 1, slots: [ { meat: 'chicken', taste: 'quick_stir_fry' }, { meat: 'vegetable', taste: 'quick_stir_fry' } ] },
  { meatCount: 1, vegCount: 1, slots: [ { meat: 'fish', taste: 'steamed_salad' }, { meat: 'vegetable', taste: 'quick_stir_fry' } ] },
  { meatCount: 1, vegCount: 1, slots: [ { meat: 'pork', taste: 'slow_stew' }, { meat: 'vegetable', taste: 'steamed_salad' } ] },
  { meatCount: 1, vegCount: 1, slots: [ { meat: 'shrimp', taste: 'steamed_salad' }, { meat: 'vegetable', taste: 'quick_stir_fry' } ] },
  { meatCount: 2, vegCount: 1, slots: [ { meat: 'chicken', taste: 'quick_stir_fry' }, { meat: 'pork', taste: 'slow_stew' }, { meat: 'vegetable', taste: 'quick_stir_fry' } ] },
  { meatCount: 2, vegCount: 1, slots: [ { meat: 'fish', taste: 'steamed_salad' }, { meat: 'beef', taste: 'quick_stir_fry' }, { meat: 'vegetable', taste: 'steamed_salad' } ] },
  { meatCount: 2, vegCount: 2, slots: [ { meat: 'chicken', taste: 'quick_stir_fry' }, { meat: 'fish', taste: 'steamed_salad' }, { meat: 'vegetable', taste: 'quick_stir_fry' }, { meat: 'vegetable', taste: 'steamed_salad' } ] }
];
exports.PREDEFINED_COMBOS = PREDEFINED_COMBOS;

/** 从菜谱列表中筛出名称含「汤」的汤品，用于汤品槽位 */
function getSoupRecipes(adultRecipes) {
  if (!Array.isArray(adultRecipes)) return [];
  var out = [];
  for (var i = 0; i < adultRecipes.length; i++) {
    if (adultRecipes[i].name && adultRecipes[i].name.indexOf('汤') !== -1) out.push(adultRecipes[i]);
  }
  return out;
}

/**
 * 按荤素汤配比生成今日菜单（规模优先）。
 * 支持 soupCount：1 时增加 1 道汤品槽位（名称含「汤」的菜谱）；meatCount 可为 0（1素1汤）。
 * 2荤2素无汤时优先从 templateCombos 随机抽一套；否则从 PREDEFINED_COMBOS 或随机。
 * 返回 { menus, comboName }，comboName 来自模板名或空。
 */
exports.getTodayMenusByCombo = function (preference) {
  var adultCount = Math.min(6, Math.max(1, Number(preference && preference.adultCount) || 2));
  var hasBaby = preference && (preference.hasBaby === true || preference.hasBaby === '1');
  var babyMonth = Math.min(36, Math.max(6, Number(preference && preference.babyMonth) || 6));
  var babyTaste = 'soft_porridge';
  var meatCount = Math.min(3, Math.max(0, Number(preference && preference.meatCount) || 1));
  var vegCount = Math.min(3, Math.max(0, Number(preference && preference.vegCount) || 1));
  var soupCount = Math.min(1, Math.max(0, Number(preference && preference.soupCount) || 0));
  if (meatCount === 0 && vegCount === 0 && soupCount === 0) vegCount = 1;

  var comboName = '';
  var menus = [];

  if (meatCount === 2 && vegCount === 2 && soupCount === 0 && Math.random() < 0.7) {
    try {
      var recipes = require('./recipes.js');
      var templateCombos = recipes.templateCombos || [];
      var adultRecipes = recipes.adultRecipes || [];
      if (templateCombos.length > 0) {
        ensureAdultCache(recipes, adultRecipes);
        var template = templateCombos[Math.floor(Math.random() * templateCombos.length)];
        var items = (template.items || []).slice(0, 4);
        var babyLinkIndex = typeof template.baby_link_index === 'number' ? template.baby_link_index : 1;
        for (var k = 0; k < items.length; k++) {
          var item = items[k];
          var byName = adultByNameCache[item.name];
          var res;
          if (byName) {
            res = generator.generateMenuFromRecipe(byName, babyMonth, hasBaby && k === babyLinkIndex && byName.meat !== 'vegetable', adultCount, babyTaste);
          } else {
            var meat = item.meat || 'vegetable';
            var taste = item.taste || 'quick_stir_fry';
            res = generator.generateMenu(taste, meat, babyMonth, hasBaby && k === babyLinkIndex && meat !== 'vegetable', adultCount, babyTaste);
          }
          var recipe = (res && res.adultRecipe) || null;
          menus.push({
            meat: recipe ? recipe.meat : (item.meat || 'vegetable'),
            taste: recipe ? recipe.taste : (item.taste || 'quick_stir_fry'),
            adultRecipe: recipe,
            babyRecipe: res && res.babyRecipe ? res.babyRecipe : null
          });
        }
        comboName = template.name || '';
      }
    } catch (e) {}
  }

  if (menus.length === 0) {
    var slots = null;
    if (soupCount === 0) {
      var comboPool = PREDEFINED_COMBOS.filter(function (c) { return c.meatCount === meatCount && c.vegCount === vegCount; });
      if (comboPool.length > 0 && Math.random() < 0.5) {
        var combo = comboPool[Math.floor(Math.random() * comboPool.length)];
        slots = combo.slots;
      }
    }
    if (!slots || slots.length === 0) {
      slots = [];
      var meats = shuffle(VALID_MEATS).slice(0, meatCount);
      var i;
      for (i = 0; i < meatCount; i++) slots.push({ meat: meats[i], taste: VALID_ADULT_TASTES[Math.floor(Math.random() * VALID_ADULT_TASTES.length)] });
      for (i = 0; i < vegCount; i++) slots.push({ meat: 'vegetable', taste: VALID_ADULT_TASTES[Math.floor(Math.random() * VALID_ADULT_TASTES.length)] });
      for (i = 0; i < soupCount; i++) slots.push({ meat: 'vegetable', taste: 'quick_stir_fry', isSoup: true });
    }
    var firstMeatIndex = -1;
    for (var s = 0; s < slots.length; s++) { if (slots[s].meat !== 'vegetable') { firstMeatIndex = s; break; } }
    var recipesModule = null;
    var soupRecipes = [];
    for (var k = 0; k < slots.length; k++) {
      var slot = slots[k];
      var hasBabyThis = hasBaby && slot.meat !== 'vegetable' && k === firstMeatIndex;
      var res;
      if (slot.isSoup) {
        if (!recipesModule) {
          recipesModule = require('./recipes.js');
          soupRecipes = getSoupRecipes(recipesModule.adultRecipes || []);
        }
        if (soupRecipes.length > 0) {
          var pickedSoup = soupRecipes[Math.floor(Math.random() * soupRecipes.length)];
          res = generator.generateMenuFromRecipe(pickedSoup, babyMonth, false, adultCount, babyTaste);
        } else {
          res = generator.generateMenu('quick_stir_fry', 'vegetable', babyMonth, false, adultCount, babyTaste);
        }
      } else {
        if (k > 0 && slot.meat === 'vegetable') {
          var preferredNames = [];
          for (var pi = 0; pi < k && preferredNames.length < 8; pi++) {
            var rec = menus[pi].adultRecipe;
            if (!rec || !Array.isArray(rec.ingredients)) continue;
            for (var pj = 0; pj < rec.ingredients.length && preferredNames.length < 8; pj++) {
              var ing = rec.ingredients[pj];
              if (!ing || (ing.category && String(ing.category).trim() === '调料')) continue;
              var nm = (ing.name && String(ing.name).trim()) || '';
              if (nm && preferredNames.indexOf(nm) === -1) preferredNames.push(nm);
            }
          }
          if (preferredNames.length > 0) {
            res = generator.generateMenuWithFilters(slot.meat, babyMonth, hasBabyThis, adultCount, babyTaste, { preferredIngredients: preferredNames });
          } else {
            res = generator.generateMenu(slot.taste, slot.meat, babyMonth, hasBabyThis, adultCount, babyTaste);
          }
        } else {
          res = generator.generateMenu(slot.taste, slot.meat, babyMonth, hasBabyThis, adultCount, babyTaste);
        }
      }
      menus.push({
        meat: (res.adultRecipe && res.adultRecipe.meat) || slot.meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || slot.taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null
      });
    }
  }

  menus = applyFlavorBalance(menus, {
    adultCount: adultCount,
    hasBaby: hasBaby,
    babyMonth: babyMonth
  });

  return { menus: menus, comboName: comboName };
};

exports.getFlavorAndCookCounts = function (menus) {
  var spicy = 0;
  var savory = 0;
  var stirFry = 0;
  var stew = 0;
  if (!Array.isArray(menus)) return { spicy: 0, savory: 0, stirFry: 0, stew: 0 };
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (!r) continue;
    var f = r.flavor_profile || '';
    if (f === 'spicy') spicy++;
    else if (f === 'salty_umami') savory++;
    var ct = r.cook_type || '';
    if (ct === 'stir_fry') stirFry++;
    else if (ct === 'stew') stew++;
  }
  return { spicy: spicy, savory: savory, stirFry: stirFry, stew: stew };
}

/** 统计套餐内各口味数量，用于口味互补 */
function getFlavorProfileCounts(menus) {
  var spicy = 0, light = 0, sweet_sour = 0, sour_fresh = 0, salty_umami = 0;
  if (!Array.isArray(menus)) return { spicy: 0, light: 0, sweet_sour: 0, sour_fresh: 0, salty_umami: 0 };
  for (var i = 0; i < menus.length; i++) {
    var f = (menus[i].adultRecipe && menus[i].adultRecipe.flavor_profile) || '';
    if (f === 'spicy') spicy++;
    else if (f === 'light') light++;
    else if (f === 'sweet_sour') sweet_sour++;
    else if (f === 'sour_fresh') sour_fresh++;
    else if (f === 'salty_umami') salty_umami++;
  }
  return { spicy: spicy, light: light, sweet_sour: sweet_sour, sour_fresh: sour_fresh, salty_umami: salty_umami };
}

/**
 * 口味互补：辣菜不超过 1 道，有辣必配至少 1 道清淡/酸甜解腻。
 * 餐厅思路：浓→淡→甜，辣菜必配清淡或酸甜，避免味觉疲劳。
 */
function applyFlavorBalance(menus, preference) {
  if (!menus || menus.length === 0) return menus;
  var adultCount = Math.min(6, Math.max(1, Number(preference && preference.adultCount) || 2));
  var hasBaby = preference && (preference.hasBaby === true || preference.hasBaby === '1');
  var babyMonth = Math.min(36, Math.max(6, Number(preference && preference.babyMonth) || 6));
  var babyTaste = 'soft_porridge';
  var firstMeatIndex = -1;
  for (var i = 0; i < menus.length; i++) {
    if (menus[i].meat !== 'vegetable') { firstMeatIndex = i; break; }
  }
  var counts = getFlavorProfileCounts(menus);
  var lightOrSweet = counts.light + counts.sweet_sour + counts.sour_fresh;

  function isSoupSlot(idx) {
    var name = (menus[idx].adultRecipe && menus[idx].adultRecipe.name) || '';
    return name.indexOf('汤') !== -1;
  }

  if (counts.spicy > 1) {
    var spicyIndices = [];
    for (var s = 0; s < menus.length; s++) {
      if (isSoupSlot(s)) continue;
      if ((menus[s].adultRecipe && menus[s].adultRecipe.flavor_profile) === 'spicy') spicyIndices.push(s);
    }
    if (spicyIndices.length > 0) {
      var replaceIdx = spicyIndices[Math.floor(Math.random() * spicyIndices.length)];
      var meat = menus[replaceIdx].meat;
      var hasBabyThis = hasBaby && meat !== 'vegetable' && replaceIdx === firstMeatIndex;
      var res = generator.generateMenuWithFilters(meat, babyMonth, hasBabyThis, adultCount, babyTaste, { preferredFlavor: 'light' });
      menus[replaceIdx] = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || menus[replaceIdx].taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null
      };
      counts = getFlavorProfileCounts(menus);
      lightOrSweet = counts.light + counts.sweet_sour + counts.sour_fresh;
    }
  }

  if (counts.spicy >= 1 && lightOrSweet === 0) {
    var nonSpicyIndices = [];
    for (var n = 0; n < menus.length; n++) {
      if (isSoupSlot(n)) continue;
      var f = (menus[n].adultRecipe && menus[n].adultRecipe.flavor_profile) || '';
      if (f !== 'spicy' && menus[n].adultRecipe) nonSpicyIndices.push(n);
    }
    if (nonSpicyIndices.length > 0) {
      var replaceIdx = nonSpicyIndices[Math.floor(Math.random() * nonSpicyIndices.length)];
      var meat = menus[replaceIdx].meat;
      var hasBabyThis = hasBaby && meat !== 'vegetable' && replaceIdx === firstMeatIndex;
      var complementFlavor = Math.random() < 0.5 ? 'light' : 'sweet_sour';
      var res = generator.generateMenuWithFilters(meat, babyMonth, hasBabyThis, adultCount, babyTaste, { preferredFlavor: complementFlavor });
      menus[replaceIdx] = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || menus[replaceIdx].taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null
      };
    }
  }

  return menus;
}

/** 灶台约束：quick_stir_fry 最多 3，slow_stew 最多 2；反向过滤：辣/咸>2 时强制选 light；excludeMeats 与已勾选肉类不重复 */
function pickReplacementFromCache(meat, constraints) {
  var recipes = require('./recipes.js');
  var list = recipes.adultRecipes || [];
  ensureAdultCache(recipes, list);
  var forceLight = (constraints && constraints.forceLight) === true;
  var currentStirFry = (constraints && constraints.currentStirFry) || 0;
  var currentStew = (constraints && constraints.currentStew) || 0;
  var excludeMeats = (constraints && constraints.excludeMeats) || [];
  var meatKey = meat === 'vegetable' ? 'vegetable' : (exports.MEAT_KEY_MAP[meat] || meat);
  var pool = [];
  if (adultByMeatCache) {
    if (excludeMeats.length > 0) {
      for (var mk in adultByMeatCache) {
        if (excludeMeats.indexOf(mk) === -1 && adultByMeatCache[mk].length)
          pool = pool.concat(adultByMeatCache[mk]);
      }
    } else {
      if (adultByMeatCache[meatKey]) pool = adultByMeatCache[meatKey].slice();
    }
  }
  if (forceLight && adultByFlavorCache && adultByFlavorCache.light && pool.length > 0) {
    var lightOnly = [];
    for (var j = 0; j < pool.length; j++) {
      if ((pool[j].flavor_profile || '') === 'light' || (pool[j].flavor_profile || '') === 'sour_fresh') lightOnly.push(pool[j]);
    }
    if (lightOnly.length > 0) pool = lightOnly;
  }
  if (pool.length === 0) return null;
  var allowed = [];
  for (var k = 0; k < pool.length; k++) {
    var rec = pool[k];
    var ct = rec.cook_type || '';
    if (ct === 'stir_fry' && currentStirFry >= 3) continue;
    if (ct === 'stew' && currentStew >= 2) continue;
    allowed.push(rec);
  }
  if (allowed.length === 0) allowed = pool;
  return allowed[Math.floor(Math.random() * allowed.length)];
}

exports.pickReplacementFromCache = pickReplacementFromCache;

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
  var app = typeof getApp === 'function' ? getApp() : null;
  var todayMenus = app && app.globalData ? app.globalData.todayMenus : null;
  if (!todayMenus || todayMenus.length === 0) {
    try {
      var raw = typeof wx !== 'undefined' && wx.getStorageSync ? wx.getStorageSync('today_menus') : '';
      if (raw && typeof JSON.parse === 'function') {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          todayMenus = parsed;
          if (app && app.globalData) app.globalData.todayMenus = parsed;
          if (app && app.globalData && (!app.globalData.mergedShoppingList || app.globalData.mergedShoppingList.length === 0))
            app.globalData.mergedShoppingList = wx.getStorageSync('cart_ingredients') || [];
        }
      }
    } catch (e) {}
  }
  if (todayMenus && todayMenus.length > 0) {
    var first = todayMenus[0];
    var list = (app && app.globalData && app.globalData.mergedShoppingList && app.globalData.mergedShoppingList.length > 0) ? app.globalData.mergedShoppingList : exports.generateShoppingListFromMenus(preference, todayMenus);
    if (todayMenus.length > 1 && generator.generateUnifiedSteps) {
      return generator.generateUnifiedSteps(todayMenus, list);
    }
    return generator.generateSteps(first.adultRecipe, first.babyRecipe, list);
  }
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

/** 海鲜/鱼类统一按肉类处理，确保采购清单不遗漏鱼虾等食材 */
function normalizeIngredientCategory(cat) {
  if (cat == null || cat === '') return '其他';
  var c = String(cat).trim();
  if (c === '海鲜' || c === '鱼类' || c === 'seafood' || c === 'fish' || c === 'shrimp') return '肉类';
  return c;
}

/** 多菜合并时「根/个」单位合理上限，避免出现 72 根葱、几十个土豆等不符合常识的数量 */
function getReasonableCap(name, unit) {
  if (unit === '根') {
    if (name === '葱' || name === '大葱') return 12;
    if (name === '黄瓜' || name === '丝瓜' || name === '胡萝卜' || name === '甜玉米' || name === '玉米') return 6;
    if (name === '长茄子') return 4;
    return 10;
  }
  if (unit === '个') {
    if (name === '土豆') return 6;
    if (name === '鸡蛋' || name.indexOf('鸡蛋') !== -1) return 12;
    if (name === '番茄' || name === '青椒' || name === '洋葱') return 6;
    return 8;
  }
  return null;
}

function buildMergedShoppingList(rawItems, adultCount) {
  adultCount = adultCount == null ? 2 : Math.min(6, Math.max(1, Number(adultCount) || 2));
  var groupKey = function (item) { return (item.name != null ? item.name : '') + '\u0001' + (item.sub_type != null ? item.sub_type : ''); };
  var groups = {};
  ;(rawItems || []).forEach(function (item) {
    var key = groupKey(item);
    var category = normalizeIngredientCategory(item.category);
    if (!groups[key]) groups[key] = { name: item.name, sub_type: item.sub_type, category: category, unit: (item.unit != null && String(item.unit).trim() !== '') ? String(item.unit).trim() : '份', rows: [] };
    groups[key].rows.push(item);
  });
  var list = [];
  var idx = 0;
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    var isLiang = g.unit === '适量' || g.rows.every(function (r) { var b = (r.baseAmount != null && typeof r.baseAmount === 'number') ? r.baseAmount : 1; return b === 0; });
    var sumBase = 0;
    g.rows.forEach(function (row) {
      var base = (row.baseAmount != null && typeof row.baseAmount === 'number') ? row.baseAmount : 1;
      sumBase += row.isFromBaby ? base : base;
    });
    var totalRaw = sumBase;
    if (g.category === '肉类' || g.category === '蔬菜' || g.category === '蛋类') {
      totalRaw = sumBase * (1 + 0.15 * (adultCount - 1));
    } else if (g.category === '调料' || g.category === '干货' && !isLiang) {
      totalRaw = sumBase * (1 + 0.1 * (adultCount - 1));
    }
    var cap = getReasonableCap(g.name, g.unit);
    if (cap != null && totalRaw > cap) totalRaw = cap;
    var amountDisplay;
    if (g.category === '肉类' || g.category === '蔬菜' || g.category === '蛋类') {
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
}

exports.generateShoppingList = function (preference) {
  var adapted = getAdaptedRecipes(preference);
  var adultCount = preference && typeof preference.adultCount !== 'undefined' ? Math.min(6, Math.max(1, Number(preference.adultCount) || 2)) : 2;
  var raw = generator.generateShoppingList(adapted.adultRecipe, adapted.babyRecipe);
  return buildMergedShoppingList(raw, adultCount);
}

/** 合并所有选中菜单的食材，不按 category/meat 过滤，确保鱼虾等均进入清单 */
exports.generateShoppingListFromMenus = function (preference, menus) {
  var adultCount = preference && typeof preference.adultCount !== 'undefined' ? Math.min(6, Math.max(1, Number(preference.adultCount) || 2)) : 2;
  var raw = [];
  ;(menus || []).forEach(function (m) {
    if (m.adultRecipe || m.babyRecipe) {
      raw = raw.concat(generator.generateShoppingList(m.adultRecipe || null, m.babyRecipe || null));
    }
  });
  return buildMergedShoppingList(raw, adultCount);
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
