/**
 * 唯一对外出口：组合封装（微信小程序版 - CommonJS）
 * 
 * 数据源优先级：
 * 1. 云端菜谱（cloudRecipeService 缓存/同步）
 * 2. 本地 recipes.js（离线兜底）
 */
var generator = require('./menuGenerator.js');
var cloudRecipeService = require('../utils/cloudRecipeService.js');

var MEAT_LABEL_MAP = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼肉', shrimp: '虾仁', vegetable: '素菜' };
exports.MEAT_KEY_MAP = { 鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp', 素菜: 'vegetable', chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp', vegetable: 'vegetable' };

/**
 * 获取菜谱数据源（优先云端，降级本地）
 * @returns {{ adultRecipes: Array, babyRecipes: Array, source: String }}
 */
function getRecipeSource() {
  // 优先使用云端菜谱服务
  var cloudAdult = cloudRecipeService.getAdultRecipes();
  var cloudBaby = cloudRecipeService.getBabyRecipes();
  
  // 如果云端有数据，使用云端
  if (cloudAdult && cloudAdult.length > 0) {
    return {
      adultRecipes: cloudAdult,
      babyRecipes: cloudBaby && cloudBaby.length > 0 ? cloudBaby : require('./recipes.js').babyRecipes,
      source: 'cloud'
    };
  }
  
  // 降级到本地
  var localRecipes = require('./recipes.js');
  return {
    adultRecipes: localRecipes.adultRecipes || [],
    babyRecipes: localRecipes.babyRecipes || [],
    source: 'local'
  };
}

/** 导出数据源获取函数 */
exports.getRecipeSource = getRecipeSource;

/** 根据 babyMonth 从 recipe.baby_variant.stages 取展示名，供预览弹窗 babyName 使用 */
exports.getBabyVariantByAge = function (recipe, babyMonth) {
  return (generator.getBabyVariantByAge && generator.getBabyVariantByAge(recipe, babyMonth)) || null;
};

/** 模糊调料用量 → 阿姨更有体感的分量单位（供购物清单/步骤页使用） */
exports.formatSeasoningAmountForDisplay = function (amount) { return generator.formatSeasoningAmountForDisplay ? generator.formatSeasoningAmountForDisplay(amount) : (amount || '约1勺'); };
exports.replaceVagueSeasoningInText = function (text) { return generator.replaceVagueSeasoningInText ? generator.replaceVagueSeasoningInText(text) : (text || ''); };

var VALID_ADULT_TASTES = ['quick_stir_fry', 'slow_stew', 'steamed_salad'];
var VALID_BABY_TASTES = ['soft_porridge', 'finger_food', 'braised_mash'];
var VALID_MEATS = ['chicken', 'pork', 'beef', 'fish', 'shrimp'];
var categoryOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 2, '干货': 2, '调料': 3, '辅食': 4, '其他': 5 };
var cache = {};
var adultByNameCache = null;
var adultByFlavorCache = null;
var adultByMeatCache = null;
var adultByIdCache = null;  // 按 ID 索引的缓存
var babyByIdCache = null;   // 宝宝菜谱按 ID 索引的缓存

/** 无感构建：仅用一次遍历 adultRecipes 同时填满 ByName / ByFlavor / ByMeat / ById，不重复扫描 */
function ensureAdultCache(recipesModule, adultRecipesList) {
  if (adultByNameCache != null) return;
  // 优先使用传入的列表，其次使用云端数据，最后降级到本地
  var list = adultRecipesList;
  if (!list || list.length === 0) {
    var source = getRecipeSource();
    list = source.adultRecipes;
  }
  if (!list || list.length === 0) {
    list = (recipesModule && recipesModule.adultRecipes) || [];
  }
  adultByNameCache = {};
  adultByFlavorCache = { light: [], salty_umami: [], spicy: [], sweet_sour: [], sour_fresh: [] };
  adultByMeatCache = { chicken: [], pork: [], beef: [], fish: [], shrimp: [], vegetable: [] };
  adultByIdCache = {};
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.name) adultByNameCache[r.name] = r;
    if (r.id) adultByIdCache[r.id] = r;
    var f = r.flavor_profile || 'salty_umami';
    if (adultByFlavorCache[f]) adultByFlavorCache[f].push(r);
    var m = r.meat || 'vegetable';
    if (adultByMeatCache[m]) adultByMeatCache[m].push(r);
  }
}

/** 构建宝宝菜谱 ID 缓存 */
function ensureBabyCache(recipesModule) {
  if (babyByIdCache != null) return;
  // 优先使用云端数据，降级到本地
  var source = getRecipeSource();
  var list = source.babyRecipes;
  if (!list || list.length === 0) {
    list = (recipesModule && recipesModule.babyRecipes) || [];
  }
  babyByIdCache = {};
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.id) babyByIdCache[r.id] = r;
  }
}

/** 根据 ID 获取大人菜谱（遵循 R-03 三级降级：云端缓存 → 本地 recipes.js） */
function getAdultRecipeById(id) {
  if (!id) return null;
  try {
    // 优先从 cloudRecipeService 获取（含完整 steps / ingredients 等字段）
    var cloudRecipe = cloudRecipeService.getAdultRecipeById
      ? cloudRecipeService.getAdultRecipeById(id)
      : null;
    if (cloudRecipe) return cloudRecipe;
    // 兜底到本地精简数据（可能不含 steps）
    var recipesModule = require('./recipes.js');
    ensureAdultCache(recipesModule, recipesModule.adultRecipes);
    return adultByIdCache[id] || null;
  } catch (e) {
    return null;
  }
}

/** 根据 ID 获取宝宝菜谱（遵循 R-03 三级降级：云端缓存 → 本地 recipes.js） */
function getBabyRecipeById(id) {
  if (!id) return null;
  try {
    var cloudRecipe = cloudRecipeService.getBabyRecipeById
      ? cloudRecipeService.getBabyRecipeById(id)
      : null;
    if (cloudRecipe) return cloudRecipe;
    var recipesModule = require('./recipes.js');
    ensureBabyCache(recipesModule);
    return babyByIdCache[id] || null;
  } catch (e) {
    return null;
  }
}

/**
 * ========== Menu 精简存储/还原 ==========
 * 
 * MenuSlim 格式（仅存 ID，缩减 storage 体积）：
 * {
 *   adultRecipeId: string | null,
 *   babyRecipeId: string | null,
 *   meat: string,
 *   taste: string,
 *   checked: boolean
 * }
 */

/**
 * 将完整菜单数组序列化为精简格式（仅含 ID）
 * @param {Array} menus - 完整菜单数组
 * @returns {Array} 精简格式数组
 */
exports.serializeMenusForStorage = function (menus) {
  if (!Array.isArray(menus)) return [];
  return menus.map(function (m) {
    return {
      adultRecipeId: (m.adultRecipe && m.adultRecipe.id) || null,
      babyRecipeId: (m.babyRecipe && m.babyRecipe.id) || null,
      meat: m.meat || 'vegetable',
      taste: m.taste || 'quick_stir_fry',
      checked: m.checked !== false
    };
  });
};

/**
 * 将精简格式还原为完整菜单数组
 * @param {Array} slimMenus - 精简格式数组
 * @param {Object} options - 可选参数 { babyMonth, adultCount, hasBaby, babyTaste }
 * @returns {Array} 完整菜单数组
 */
exports.deserializeMenusFromStorage = function (slimMenus, options) {
  if (!Array.isArray(slimMenus)) return [];
  var opts = options || {};
  var babyMonth = opts.babyMonth || 12;
  var adultCount = opts.adultCount || 2;
  var hasBaby = opts.hasBaby === true;
  var babyTaste = opts.babyTaste || 'soft_porridge';
  
  return slimMenus.map(function (slim, index) {
    var adultRecipe = null;
    var babyRecipe = null;
    
    // 还原大人菜谱
    if (slim.adultRecipeId) {
      var rawAdult = getAdultRecipeById(slim.adultRecipeId);
      if (rawAdult) {
        // 使用 generator 来处理人数缩放等逻辑
        var res = generator.generateMenuFromRecipe(rawAdult, babyMonth, false, adultCount, babyTaste);
        adultRecipe = res.adultRecipe;
      }
    }
    
    // 还原宝宝菜谱
    if (slim.babyRecipeId && hasBaby) {
      babyRecipe = getBabyRecipeById(slim.babyRecipeId);
      // 如果没有单独的宝宝菜谱 ID，且有大人菜谱，尝试从大人菜谱生成
      if (!babyRecipe && adultRecipe && slim.meat !== 'vegetable' && index === 0) {
        var rawAdult = getAdultRecipeById(slim.adultRecipeId);
        if (rawAdult) {
          var res = generator.generateMenuFromRecipe(rawAdult, babyMonth, true, adultCount, babyTaste);
          babyRecipe = res.babyRecipe;
        }
      }
    }
    
    return {
      adultRecipe: adultRecipe,
      babyRecipe: babyRecipe,
      meat: slim.meat || 'vegetable',
      taste: slim.taste || 'quick_stir_fry',
      checked: slim.checked !== false
    };
  });
};

/**
 * 判断是否为精简格式（有 adultRecipeId 字段）
 * @param {Array} menus - 菜单数组
 * @returns {boolean}
 */
exports.isSlimMenuFormat = function (menus) {
  if (!Array.isArray(menus) || menus.length === 0) return false;
  var first = menus[0];
  // 精简格式有 adultRecipeId，完整格式有 adultRecipe
  return first.hasOwnProperty('adultRecipeId') && !first.hasOwnProperty('adultRecipe');
};

/**
 * 根据菜单与偏好构建预览页所需 payload（Logic 层聚合，页面只做 setData）
 * @param {Array} menus - 完整菜单数组
 * @param {Object} pref - 偏好
 * @param {Object} opts - 可选 { comboName, countText }
 * @returns {Object} { rows, dashboard, balanceTip, hasSharedBase, countText, comboName }
 */
exports.buildPreviewPayload = function (menus, pref, opts) {
  if (!menus || menus.length === 0) {
    return { rows: [], dashboard: {}, balanceTip: '', hasSharedBase: false, countText: '', comboName: '' };
  }
  var getStage = exports.getBabyVariantByAge ? function (ar, month) { return exports.getBabyVariantByAge(ar, month); } : function () { return null; };
  var rows = generator.menusToPreviewRows ? generator.menusToPreviewRows(menus, pref, getStage) : [];
  var dashboard = generator.computePreviewDashboard ? generator.computePreviewDashboard(menus, pref) : {};
  var balanceTip = generator.computeBalanceTip ? generator.computeBalanceTip(menus) : '';
  var hasSharedBase = rows.some(function (r) { return r.showSharedHint; });
  var o = opts || {};
  return {
    rows: rows,
    dashboard: dashboard,
    balanceTip: balanceTip,
    hasSharedBase: hasSharedBase,
    countText: o.countText != null ? o.countText : menus.length + '道菜',
    comboName: o.comboName != null ? o.comboName : ''
  };
};

/** 根据名称获取大人菜谱 */
function getAdultRecipeByName(name) {
  if (!name) return null;
  try {
    var recipesModule = require('./recipes.js');
    ensureAdultCache(recipesModule, recipesModule.adultRecipes);
    return adultByNameCache[name] || null;
  } catch (e) {
    return null;
  }
}

/** 导出 ID / 名称查找函数供其他模块使用 */
exports.getAdultRecipeById = getAdultRecipeById;
exports.getBabyRecipeById = getBabyRecipeById;
exports.getAdultRecipeByName = getAdultRecipeByName;

/**
 * 根据菜谱 ID 或名称列表生成做饭步骤（供 scan -> steps 桥接使用）
 *
 * @param {string[]} idOrNames - 菜谱 ID 或名称的数组
 * @param {Object} preference  - 用户偏好
 * @returns {{ steps: Array, menus: Array }} steps 步骤数组，menus 构建的菜单数组（供上层做图片展示）
 */
exports.generateStepsFromRecipeIds = function (idOrNames, preference) {
  if (!Array.isArray(idOrNames) || idOrNames.length === 0) return { steps: [], menus: [] };
  var pref = preference || {};
  var babyMonth = Number(pref.babyMonth) || 12;
  var adultCount = Number(pref.adultCount) || 2;
  var hasBaby = pref.hasBaby === true || pref.hasBaby === '1';
  var babyTaste = pref.babyTaste || 'soft_porridge';

  var menus = [];
  for (var i = 0; i < idOrNames.length; i++) {
    var key = (idOrNames[i] || '').trim();
    if (!key) continue;
    // 先按 ID 查，再按名称查
    var recipe = getAdultRecipeById(key) || getAdultRecipeByName(key);
    if (!recipe) {
      console.warn('[menuData] generateStepsFromRecipeIds: 未找到菜谱 "' + key + '"，跳过');
      continue;
    }
    var menu = generator.generateMenuFromRecipe(recipe, babyMonth, hasBaby, adultCount, babyTaste);
    if (menu && menu.adultRecipe) {
      menu.meat = recipe.meat || 'vegetable';
      menu.taste = recipe.flavor_profile || 'quick_stir_fry';
      menus.push(menu);
    }
  }

  if (menus.length === 0) return { steps: [], menus: [] };

  // 生成购物清单
  var shoppingList = exports.generateShoppingListFromMenus(pref, menus);

  // 多菜 -> 统筹步骤；单菜 -> 单菜步骤
  var steps;
  if (menus.length > 1 && generator.generateUnifiedSteps) {
    steps = generator.generateUnifiedSteps(menus, shoppingList);
  } else if (menus.length === 1) {
    steps = generator.generateSteps(menus[0].adultRecipe, menus[0].babyRecipe, shoppingList);
  } else {
    steps = [];
  }

  return { steps: Array.isArray(steps) ? steps : [], menus: menus };
};

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

/** 从菜谱列表中筛出汤品 - 委托给 generator */
function getSoupRecipes(adultRecipes) {
  return generator.getSoupRecipes ? generator.getSoupRecipes(adultRecipes) : [];
}

/**
 * 按荤素汤配比生成今日菜单（规模优先）。
 * 支持 soupCount：1 时增加 1 道汤品槽位（dish_type: 'soup' 的菜谱）；meatCount 可为 0（1素1汤）。
 * 2荤2素无汤时优先从 templateCombos 随机抽一套；否则从 PREDEFINED_COMBOS 或随机。
 * 返回 { menus, comboName, fallbackReasons?, fallbackMessage? }
 *   - fallbackReasons: 降级原因码数组（仅发生降级时存在）
 *   - fallbackMessage: 用户友好的降级提示消息（仅发生降级时存在）
 */
exports.getTodayMenusByCombo = function (preference) {
  var adultCount = Math.min(6, Math.max(1, Number(preference && preference.adultCount) || 2));
  var hasBaby = preference && (preference.hasBaby === true || preference.hasBaby === '1');
  var babyMonth = Math.min(36, Math.max(6, Number(preference && preference.babyMonth) || 6));
  var babyTaste = 'soft_porridge';
  var meatCount = Math.min(3, Math.max(0, Number(preference && preference.meatCount) || 1));
  var vegCount = Math.min(3, Math.max(0, Number(preference && preference.vegCount) || 1));
  var soupCount = Math.min(1, Math.max(0, Number(preference && preference.soupCount) || 0));
  var soupType = (preference && preference.soupType) === 'meat' ? 'meat' : (preference && preference.soupType) === 'veg' ? 'veg' : null;
  if (meatCount === 0 && vegCount === 0 && soupCount === 0) vegCount = 1;

  var userPreference = {
    allergens: (preference && preference.avoidList) || (preference && preference.allergens) || [],
    dietary_preference: (preference && preference.dietStyle) || (preference && preference.dietary_preference) || '',
    avoidList: (preference && preference.avoidList) || [],
    dietStyle: (preference && preference.dietStyle) || ''
  };
  var stewCountRef = { stewCount: 0 };
  
  // 收集降级原因
  var fallbackReasons = [];

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
        // 检查模板自身有无重复菜名
        var templateNames = {};
        var templateHasDups = false;
        for (var ti = 0; ti < items.length; ti++) {
          if (items[ti].name && templateNames[items[ti].name]) { templateHasDups = true; break; }
          if (items[ti].name) templateNames[items[ti].name] = true;
        }
        if (!templateHasDups) {
          for (var k = 0; k < items.length; k++) {
            var item = items[k];
            var byName = adultByNameCache[item.name];
            var res;
            if (byName) {
              res = generator.generateMenuFromRecipe(byName, babyMonth, hasBaby && k === babyLinkIndex && byName.meat !== 'vegetable', adultCount, babyTaste);
            } else {
              var meat = item.meat || 'vegetable';
              var taste = item.taste || 'quick_stir_fry';
              res = generator.generateMenu(taste, meat, babyMonth, hasBaby && k === babyLinkIndex && meat !== 'vegetable', adultCount, babyTaste, userPreference, menus, stewCountRef);
            }
            // 收集降级原因
            if (res && res.fallbackReason) fallbackReasons.push(res.fallbackReason);
            var recipe = (res && res.adultRecipe) || null;
            menus.push({
              meat: recipe ? recipe.meat : (item.meat || 'vegetable'),
              taste: recipe ? recipe.taste : (item.taste || 'quick_stir_fry'),
              adultRecipe: recipe,
              babyRecipe: res && res.babyRecipe ? res.babyRecipe : null
            });
          }
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
          var adultRecipes = recipesModule.adultRecipes || [];
          soupRecipes = generator.getSoupRecipesByType
            ? generator.getSoupRecipesByType(adultRecipes, soupType)
            : getSoupRecipes(adultRecipes);
        }
        // 汤品也需要去重：排除已选菜谱
        var availableSoups = soupRecipes.filter(function (soup) {
          for (var si = 0; si < menus.length; si++) {
            var picked = menus[si] && menus[si].adultRecipe;
            if (picked && ((picked.id && picked.id === soup.id) || (picked.name && picked.name === soup.name))) return false;
          }
          return true;
        });
        if (availableSoups.length === 0) availableSoups = soupRecipes; // 兜底
        if (availableSoups.length > 0) {
          var pickedSoup = availableSoups[Math.floor(Math.random() * availableSoups.length)];
          res = generator.generateMenuFromRecipe(pickedSoup, babyMonth, false, adultCount, babyTaste);
        } else {
          res = generator.generateMenu('quick_stir_fry', 'vegetable', babyMonth, false, adultCount, babyTaste, userPreference, menus, stewCountRef);
        }
      } else {
        if (k > 0 && slot.meat === 'vegetable') {
          var excludeNames = [];
          for (var pi = 0; pi < k && excludeNames.length < 8; pi++) {
            var rec = menus[pi].adultRecipe;
            if (!rec || !Array.isArray(rec.ingredients)) continue;
            for (var pj = 0; pj < rec.ingredients.length && excludeNames.length < 8; pj++) {
              var ing = rec.ingredients[pj];
              if (!ing || (ing.category && String(ing.category).trim() === '调料')) continue;
              var nm = (ing.name && String(ing.name).trim()) || '';
              if (nm && excludeNames.indexOf(nm) === -1) excludeNames.push(nm);
            }
          }
          if (excludeNames.length > 0) {
            res = generator.generateMenuWithFilters(slot.meat, babyMonth, hasBabyThis, adultCount, babyTaste, { excludeIngredients: excludeNames, userPreference: userPreference, existingMenus: menus, stewCountRef: stewCountRef });
          } else {
            res = generator.generateMenu(slot.taste, slot.meat, babyMonth, hasBabyThis, adultCount, babyTaste, userPreference, menus, stewCountRef);
          }
        } else {
          res = generator.generateMenu(slot.taste, slot.meat, babyMonth, hasBabyThis, adultCount, babyTaste, userPreference, menus, stewCountRef);
        }
      }
      // 收集降级原因
      if (res && res.fallbackReason) fallbackReasons.push(res.fallbackReason);
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
    babyMonth: babyMonth,
    userPreference: userPreference
  });

  menus = applyVisualDiversity(menus, {
    adultCount: adultCount,
    hasBaby: hasBaby,
    babyMonth: babyMonth
  });

  menus = ensureAtMostOneSoup(menus, {
    adultCount: adultCount,
    hasBaby: hasBaby,
    babyMonth: babyMonth
  });

  // ★ 最终安全网：检测并替换重复菜品
  menus = deduplicateMenus(menus, {
    adultCount: adultCount,
    hasBaby: hasBaby,
    babyMonth: babyMonth,
    babyTaste: babyTaste,
    userPreference: userPreference,
    stewCountRef: stewCountRef
  });

  // 构建返回结果，包含降级信息
  var result = { menus: menus, comboName: comboName };
  if (fallbackReasons.length > 0) {
    result.fallbackReasons = fallbackReasons;
    result.fallbackMessage = generator.getFallbackMessage(fallbackReasons);
  }
  return result;
};

/**
 * ★ 最终去重安全网：
 * 遍历菜单，如果发现同名/同ID菜品，对后出现的那道进行重新抽取。
 * 最多重试 3 次，如果仍然重复则保留（极端情况下菜谱池太小无法避免）。
 */
function deduplicateMenus(menus, preference) {
  if (!menus || menus.length <= 1) return menus;
  var adultCount = (preference && preference.adultCount) || 2;
  var hasBaby = preference && preference.hasBaby;
  var babyMonth = (preference && preference.babyMonth) || 6;
  var babyTaste = (preference && preference.babyTaste) || 'soft_porridge';
  var userPreference = (preference && preference.userPreference) || null;
  var stewCountRef = (preference && preference.stewCountRef) || { stewCount: 0 };

  var seen = {};
  for (var i = 0; i < menus.length; i++) {
    var recipe = menus[i] && menus[i].adultRecipe;
    if (!recipe) continue;
    var key = recipe.name || recipe.id || '';
    if (!key) continue;

    if (!seen[key]) {
      seen[key] = true;
      continue;
    }

    // 发现重复，尝试重新抽取（显式排除当前这道，避免池子过小时再次抽到同名）
    var replaced = false;
    var duplicateName = recipe.name || '';
    var duplicateId = recipe.id || '';
    for (var attempt = 0; attempt < 3; attempt++) {
      var meat = menus[i].meat || 'vegetable';
      var res = generator.generateMenuWithFilters(meat, babyMonth, false, adultCount, babyTaste, {
        existingMenus: menus,
        userPreference: userPreference,
        stewCountRef: stewCountRef,
        excludeRecipeName: duplicateName,
        excludeRecipeId: duplicateId
      });
      if (res && res.adultRecipe) {
        var newName = res.adultRecipe.name || '';
        if (!seen[newName]) {
          menus[i] = {
            meat: res.adultRecipe.meat || meat,
            taste: res.adultRecipe.taste || menus[i].taste,
            adultRecipe: res.adultRecipe,
            babyRecipe: res.babyRecipe || null
          };
          seen[newName] = true;
          replaced = true;
          break;
        }
      }
    }
    // 替换失败也不阻塞，保留原菜（极端情况）
  }
  return menus;
}

/** 常识约束：整份菜单最多一道汤，多出的汤替换为同肉/同口味的非汤菜 */
function ensureAtMostOneSoup(menus, preference) {
  if (!menus || menus.length === 0) return menus;
  var soupIndices = [];
  for (var i = 0; i < menus.length; i++) {
    var recipe = menus[i].adultRecipe;
    // 优先使用 dish_type 字段判断，兼容名称检测
    var isSoup = (recipe && recipe.dish_type === 'soup') || (recipe && recipe.name && recipe.name.indexOf('汤') !== -1);
    if (isSoup) soupIndices.push(i);
  }
  if (soupIndices.length <= 1) return menus;
  var adultCount = Math.min(6, Math.max(1, Number(preference && preference.adultCount) || 2));
  var hasBaby = preference && (preference.hasBaby === true || preference.hasBaby === '1');
  var babyMonth = Math.min(36, Math.max(6, Number(preference && preference.babyMonth) || 6));
  var babyTaste = 'soft_porridge';
  var firstMeatIndex = -1;
  for (var f = 0; f < menus.length; f++) {
    if (menus[f].meat !== 'vegetable') { firstMeatIndex = f; break; }
  }
  var recipesModule;
  try {
    recipesModule = require('./recipes.js');
  } catch (e) {
    return menus;
  }
  var adultRecipes = recipesModule.adultRecipes || [];
  for (var s = 1; s < soupIndices.length; s++) {
    var idx = soupIndices[s];
    var slot = menus[idx];
    var meat = (slot.adultRecipe && slot.adultRecipe.meat) || slot.meat;
    var taste = (slot.adultRecipe && slot.adultRecipe.taste) || slot.taste;
    var hasBabyThis = hasBaby && meat !== 'vegetable' && idx === firstMeatIndex;
    var nonSoupPool = adultRecipes.filter(function (r) {
      if (!r || !r.name) return false;
      // 优先使用 dish_type 字段判断，兼容名称检测
      if (r.dish_type === 'soup' || r.name.indexOf('汤') !== -1) return false;
      return r.meat === meat && r.taste === taste;
    });
    if (nonSoupPool.length === 0) {
      nonSoupPool = adultRecipes.filter(function (r) {
        if (!r || !r.name) return false;
        // 优先使用 dish_type 字段判断，兼容名称检测
        if (r.dish_type === 'soup' || r.name.indexOf('汤') !== -1) return false;
        return r.meat === meat;
      });
    }
    if (nonSoupPool.length > 0) {
      var picked = nonSoupPool[Math.floor(Math.random() * nonSoupPool.length)];
      var res = generator.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, babyTaste);
      menus[idx] = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null
      };
    }
  }
  return menus;
}

/** 统计口味和做法数量 - 委托给 generator */
exports.getFlavorAndCookCounts = function (menus) {
  return generator.getFlavorAndCookCounts ? generator.getFlavorAndCookCounts(menus) : { spicy: 0, savory: 0, stirFry: 0, stew: 0 };
};

/** 统计套餐内各口味数量 - 委托给 generator */
function getFlavorProfileCounts(menus) {
  return generator.getFlavorProfileCounts ? generator.getFlavorProfileCounts(menus) : { spicy: 0, light: 0, sweet_sour: 0, sour_fresh: 0, salty_umami: 0 };
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
    var recipe = menus[idx].adultRecipe;
    // 优先使用 dish_type 字段判断，兼容名称检测
    return (recipe && recipe.dish_type === 'soup') || (recipe && recipe.name && recipe.name.indexOf('汤') !== -1);
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
      var res = generator.generateMenuWithFilters(meat, babyMonth, hasBabyThis, adultCount, babyTaste, { preferredFlavor: 'light', existingMenus: menus, excludeRecipeNames: (preference && preference.userPreference && preference.userPreference.excludeRecipeNames) || [] });
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
      var res = generator.generateMenuWithFilters(meat, babyMonth, hasBabyThis, adultCount, babyTaste, { preferredFlavor: complementFlavor, existingMenus: menus, excludeRecipeNames: (preference && preference.userPreference && preference.userPreference.excludeRecipeNames) || [] });
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

/**
 * 根据菜谱主料推断色系（用于视觉多样性）
 * @param {Object} recipe - adultRecipe
 * @returns {string} 色系：green / red / brown / white / yellow / other
 */
function getRecipeColor(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return 'other';
  var main = '';
  for (var i = 0; i < recipe.ingredients.length; i++) {
    var ing = recipe.ingredients[i];
    if (!ing || !ing.name) continue;
    if (ing.category && String(ing.category).trim() === '调料') continue;
    main = String(ing.name).trim();
    break;
  }
  if (!main) return 'other';
  if (/青|绿|西兰花|油麦|上海青|荷兰豆|娃娃菜|包菜|芹菜|黄瓜|豆角|蒜苔|韭菜|菠菜|空心菜|莴笋|芦笋|芥兰|油菜|茼蒿|秋葵|丝瓜/i.test(main)) return 'green';
  if (/番茄|西红柿|胡萝卜|红椒|辣椒|红萝卜|甜椒|彩椒|山楂/i.test(main)) return 'red';
  if (/鸡|猪|牛|羊|鱼|虾|肉|香菇|木耳|杏鲍菇|口蘑|棕|褐/i.test(main)) return 'brown';
  if (/土豆|山药|豆腐|萝卜|白萝卜|花菜|花椰菜|莲藕|白菜|白|冬瓜|芋头|洋葱/i.test(main)) return 'white';
  if (/蛋|南瓜|玉米|黄|韭黄|黄豆/i.test(main)) return 'yellow';
  return 'other';
}

/**
 * 视觉多样性：同色系不超过 2 道，若某色系 >= 3 则尝试将最后一道替换为不同色系。
 */
function applyVisualDiversity(menus, preference) {
  if (!menus || menus.length < 3) return menus;
  var adultCount = Math.min(6, Math.max(1, Number(preference && preference.adultCount) || 2));
  var hasBaby = preference && (preference.hasBaby === true || preference.hasBaby === '1');
  var babyMonth = Math.min(36, Math.max(6, Number(preference && preference.babyMonth) || 6));
  var babyTaste = 'soft_porridge';

  var colorCounts = {};
  var colorLastIndex = {};
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (!r) continue;
    var c = getRecipeColor(r);
    colorCounts[c] = (colorCounts[c] || 0) + 1;
    colorLastIndex[c] = i;
  }
  var overloadColor = null;
  for (var k in colorCounts) {
    if (colorCounts[k] >= 3) { overloadColor = k; break; }
  }
  if (!overloadColor) return menus;

  var replaceIdx = colorLastIndex[overloadColor];
  var meat = menus[replaceIdx].meat;
  var hasBabyThis = hasBaby && meat !== 'vegetable';
  var firstMeatIndex = -1;
  for (var j = 0; j < menus.length; j++) {
    if (menus[j].meat !== 'vegetable') { firstMeatIndex = j; break; }
  }
  if (replaceIdx === firstMeatIndex && hasBaby) hasBabyThis = true;

  var source = getRecipeSource();
  var allAdult = source.adultRecipes || [];
  var pickedIds = {};
  for (var p = 0; p < menus.length; p++) {
    var rec = menus[p].adultRecipe;
    if (rec && rec.id) pickedIds[rec.id] = true;
    if (rec && rec.name) pickedIds['__name__' + rec.name] = true;
  }
  var pool = allAdult.filter(function (r) {
    if (!r || r.meat !== meat) return false;
    if (r.id && pickedIds[r.id]) return false;
    if (r.name && pickedIds['__name__' + r.name]) return false;
    if (getRecipeColor(r) === overloadColor) return false;
    return true;
  });
  if (pool.length === 0) return menus;

  var picked = pool[Math.floor(Math.random() * pool.length)];
  var res = generator.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, babyTaste);
  menus[replaceIdx] = {
    meat: (res.adultRecipe && res.adultRecipe.meat) || meat,
    taste: (res.adultRecipe && res.adultRecipe.taste) || menus[replaceIdx].taste,
    adultRecipe: res.adultRecipe || null,
    babyRecipe: res.babyRecipe || null
  };
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

/**
 * 生成做菜步骤：
 * - 默认优先使用多菜并行流水线（generateUnifiedSteps）
 * - 在 options.forceLinear === true 时，强制退回按菜品顺序的线性逻辑
 *
 * @param {Object} preference - 用户偏好
 * @param {Object} [options]  - 可选项，如 { forceLinear: true }
 */
exports.generateSteps = function (preference, options) {
  var app = typeof getApp === 'function' ? getApp() : null;
  var todayMenus = app && app.globalData ? app.globalData.todayMenus : null;
  var storedPref = null;
  
  if (!todayMenus || todayMenus.length === 0) {
    try {
      var raw = typeof wx !== 'undefined' && wx.getStorageSync ? wx.getStorageSync('today_menus') : '';
      if (raw && typeof JSON.parse === 'function') {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 检查是否为精简格式，如果是则还原为完整格式
          if (exports.isSlimMenuFormat(parsed)) {
            // 读取存储的 preference
            try {
              var prefRaw = wx.getStorageSync('today_menus_preference');
              if (prefRaw) storedPref = JSON.parse(prefRaw);
            } catch (e) {}
            var restoreOptions = storedPref || preference || {};
            todayMenus = exports.deserializeMenusFromStorage(parsed, restoreOptions);
          } else {
            todayMenus = parsed;
          }
          if (app && app.globalData) app.globalData.todayMenus = todayMenus;
          if (app && app.globalData && (!app.globalData.mergedShoppingList || app.globalData.mergedShoppingList.length === 0))
            app.globalData.mergedShoppingList = wx.getStorageSync('cart_ingredients') || [];
        }
      }
    } catch (e) {}
  }
  
  // 使用存储的 preference 或传入的 preference
  var effectivePref = storedPref || preference || {};
  
  if (todayMenus && todayMenus.length > 0) {
    var first = todayMenus[0];
    var list = (app && app.globalData && app.globalData.mergedShoppingList && app.globalData.mergedShoppingList.length > 0)
      ? app.globalData.mergedShoppingList
      : exports.generateShoppingListFromMenus(effectivePref, todayMenus);

    var forceLinear = options && options.forceLinear === true;

    // 多菜场景：根据是否强制线性选择策略
    if (todayMenus.length > 1) {
      if (!forceLinear && generator.generateUnifiedSteps) {
        return generator.generateUnifiedSteps(todayMenus, list, {
          kitchenConfig: effectivePref.kitchenConfig
        });
      }
      if (generator.linearFallback) {
        return generator.linearFallback(todayMenus, list);
      }
    }

    // 单菜场景或兜底：退回旧版单菜 steps 生成逻辑
    var steps = generator.generateSteps(first.adultRecipe, first.babyRecipe, list);
    if (steps.length > 0 && !first.babyRecipe && first.adultRecipe && first.adultRecipe.baby_variant && effectivePref && (effectivePref.hasBaby === true || effectivePref.hasBaby === '1')) {
      var stage = exports.getBabyVariantByAge(first.adultRecipe, effectivePref.babyMonth);
      if (stage && stage.same_as_adult_hint) {
        var last = steps[steps.length - 1];
        if (last && Array.isArray(last.details)) last.details = last.details.concat(['✨ ' + stage.same_as_adult_hint]);
      }
    }
    return steps;
  }
  var adapted = getAdaptedRecipes(effectivePref);
  var shoppingList = exports.generateShoppingList(effectivePref);
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

function groupKey(item) {
  return (item.name != null ? item.name : '') + '\u0001' + (item.sub_type != null ? item.sub_type : '');
}

/** 将 Map<key, group> 转为最终清单项列表，避免重复逻辑 */
function groupsMapToList(groupsMap, adultCount) {
  adultCount = adultCount == null ? 2 : Math.min(6, Math.max(1, Number(adultCount) || 2));
  var list = [];
  var idx = 0;
  groupsMap.forEach(function (g) {
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
      if (isLiang || totalRaw === 0) amountDisplay = generator.formatSeasoningAmountForDisplay('适量');
      else amountDisplay = formatAmount(totalRaw) + g.unit;
    } else {
      if (g.unit === '适量' || totalRaw === 0) amountDisplay = generator.formatSeasoningAmountForDisplay('适量');
      else amountDisplay = formatAmount(totalRaw) + g.unit;
    }

    // 收集来源菜品名称（用于混合组餐场景下显示食材归属）
    var fromRecipes = [];
    var hasExternal = false;
    var hasNative = false;
    g.rows.forEach(function (row) {
      if (row.recipeName && fromRecipes.indexOf(row.recipeName) === -1) {
        fromRecipes.push(row.recipeName);
      }
      if (row.sourceType === 'external') hasExternal = true;
      else hasNative = true;
    });

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
      isShared: g.rows.some(function (r) { return r.isFromBaby; }) && g.rows.some(function (r) { return !r.isFromBaby; }),
      // 混合来源支持字段
      fromRecipes: fromRecipes,
      isMixedSource: hasExternal && hasNative,
      hasExternalSource: hasExternal
    });
  });
  if (list.length === 0) {
    list = [{ id: 1, name: '请先生成菜单后查看清单', sub_type: undefined, amount: '—', rawAmount: 0, unit: '—', checked: false, category: '其他', order: 99, isShared: false, fromRecipes: [], isMixedSource: false, hasExternalSource: false }];
  }
  return list;
}

/** 合并同名食材为最终清单，统一走 groupsMapToList 输出 */
function buildMergedShoppingList(rawItems, adultCount) {
  adultCount = adultCount == null ? 2 : Math.min(6, Math.max(1, Number(adultCount) || 2));
  var groupsMap = new Map();
  
  for (var i = 0; i < rawItems.length; i++) {
    var item = rawItems[i];
    var key = groupKey(item);
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        name: item.name,
        sub_type: item.sub_type,
        category: item.category || '其他',
        unit: item.unit || '份',
        rows: []
      });
    }
    groupsMap.get(key).rows.push(item);
  }
  
  return groupsMapToList(groupsMap, adultCount);
}

exports.generateShoppingList = function (preference) {
  var adapted = getAdaptedRecipes(preference);
  var adultCount = preference && typeof preference.adultCount !== 'undefined' ? Math.min(6, Math.max(1, Number(preference.adultCount) || 2)) : 2;
  var avoidList = (preference && preference.avoidList) || [];
  var raw = generator.generateShoppingList(adapted.adultRecipe, adapted.babyRecipe);
  
  // 根据忌口偏好过滤食材（如香菜）
  if (avoidList.indexOf('cilantro') !== -1) {
    raw = raw.filter(function (item) {
      var name = (item && item.name) || '';
      return name.indexOf('香菜') === -1 && name.indexOf('芫荽') === -1;
    });
  }
  
  var list = buildMergedShoppingList(raw, adultCount);

  // 离线降级标记
  var hasOffline = (adapted.adultRecipe && (!Array.isArray(adapted.adultRecipe.ingredients) || adapted.adultRecipe.ingredients.length === 0))
    || (adapted.babyRecipe && (!Array.isArray(adapted.babyRecipe.ingredients) || adapted.babyRecipe.ingredients.length === 0));
  if (hasOffline) {
    list._isOfflineFallback = true;
    list._offlineHint = '当前为离线模式，购物清单仅含主料参考。联网后可自动获取完整食材清单';
  }

  return list;
}

/** 合并所有选中菜单的食材，不按 category/meat 过滤，确保鱼虾等均进入清单 */
exports.generateShoppingListFromMenus = function (preference, menus) {
  var adultCount = preference && typeof preference.adultCount !== 'undefined' ? Math.min(6, Math.max(1, Number(preference.adultCount) || 2)) : 2;
  var avoidList = (preference && preference.avoidList) || [];

  // 检测是否存在无 ingredients 的精简版菜谱（离线降级）
  var offlineCount = 0;
  var totalCount = 0;
  ;(menus || []).forEach(function (m) {
    if (m.adultRecipe) {
      totalCount++;
      if (!Array.isArray(m.adultRecipe.ingredients) || m.adultRecipe.ingredients.length === 0) offlineCount++;
    }
    if (m.babyRecipe) {
      totalCount++;
      if (!Array.isArray(m.babyRecipe.ingredients) || m.babyRecipe.ingredients.length === 0) offlineCount++;
    }
  });

  var raw = [];
  ;(menus || []).forEach(function (m) {
    if (m.adultRecipe || m.babyRecipe) {
      raw = raw.concat(generator.generateShoppingList(m.adultRecipe || null, m.babyRecipe || null));
    }
  });
  
  // 根据忌口偏好过滤食材（如香菜）
  if (avoidList.indexOf('cilantro') !== -1) {
    raw = raw.filter(function (item) {
      var name = (item && item.name) || '';
      return name.indexOf('香菜') === -1 && name.indexOf('芫荽') === -1;
    });
  }
  
  var list = buildMergedShoppingList(raw, adultCount);

  // 离线降级标记：精简版 recipes.js 无 ingredients，购物清单仅含主料兜底
  if (offlineCount > 0 && totalCount > 0) {
    list._isOfflineFallback = true;
    list._offlineHint = '当前为离线模式，购物清单仅含主料参考。联网后可自动获取完整食材清单';
  }

  return list;
};

// ============ 云端菜谱同步相关 ============

/**
 * 刷新菜谱缓存（云端数据更新后调用）
 * 清空内存缓存，下次访问时会重新从云端/本地加载
 */
exports.refreshRecipeCache = function () {
  adultByNameCache = null;
  adultByFlavorCache = null;
  adultByMeatCache = null;
  adultByIdCache = null;
  babyByIdCache = null;
  cache = {};
};

/**
 * 获取云端菜谱同步状态
 * @returns {Object}
 */
exports.getCloudSyncState = function () {
  return cloudRecipeService.getSyncState();
};

/**
 * 触发云端菜谱同步
 * @param {Object} options
 * @param {Boolean} options.forceRefresh - 是否强制全量刷新
 * @returns {Promise}
 */
exports.syncCloudRecipes = function (options) {
  return cloudRecipeService.syncFromCloud(options).then(function (result) {
    // 同步完成后刷新缓存
    if (result.fromCloud) {
      exports.refreshRecipeCache();
    }
    return result;
  });
};

/**
 * 检查是否有云端数据可用
 * @returns {Boolean}
 */
exports.hasCloudData = function () {
  return cloudRecipeService.hasCloudData();
};

/**
 * 获取当前数据源信息
 * @returns {{ source: String, adultCount: Number, babyCount: Number }}
 */
exports.getDataSourceInfo = function () {
  var source = getRecipeSource();
  return {
    source: source.source,
    adultCount: source.adultRecipes.length,
    babyCount: source.babyRecipes.length
  };
};

// ============ 历史菜单管理 ============
var HISTORY_STORAGE_KEY = 'menu_history';
var HISTORY_MAX_DAYS = 7;

/** 格式化日期信息 */
function formatDateInfo(date) {
  var d = date || new Date();
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return {
    dateKey: year + '-' + month + '-' + day,
    dateLabel: month + '月' + day + '日',
    weekday: weekdays[d.getDay()]
  };
}

/**
 * 保存菜单到历史记录
 * @param {Array} menus - 完整菜单数组
 * @param {Object} preference - 偏好设置
 * @param {String} dateKey - 可选，指定日期 key
 */
exports.saveMenuToHistory = function (menus, preference, dateKey) {
  if (!Array.isArray(menus) || menus.length === 0) return;
  
  try {
    var history = wx.getStorageSync(HISTORY_STORAGE_KEY) || {};
    var dateInfo = formatDateInfo(new Date());
    var key = dateKey || dateInfo.dateKey;
    
    // 如果传入了自定义 dateKey，需要重新计算 dateLabel 和 weekday
    if (dateKey && dateKey !== dateInfo.dateKey) {
      var parts = dateKey.split('-');
      var customDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      dateInfo = formatDateInfo(customDate);
    }
    
    // 提取菜名列表
    var dishNames = [];
    menus.forEach(function (m) {
      if (m.adultRecipe && m.adultRecipe.name) {
        dishNames.push(m.adultRecipe.name);
      }
    });
    
    // 序列化菜单为精简格式
    var slimMenus = exports.serializeMenusForStorage(menus);
    
    // 保存到历史
    history[key] = {
      dateKey: key,
      dateLabel: dateInfo.dateLabel,
      weekday: dateInfo.weekday,
      menus: slimMenus,
      preference: preference || {},
      dishNames: dishNames,
      savedAt: new Date().toISOString()
    };
    
    // 清理超过 7 天的历史
    var keys = Object.keys(history).sort().reverse();
    if (keys.length > HISTORY_MAX_DAYS) {
      keys.slice(HISTORY_MAX_DAYS).forEach(function (oldKey) {
        delete history[oldKey];
      });
    }
    
    wx.setStorageSync(HISTORY_STORAGE_KEY, history);
  } catch (e) {
    // 保存历史菜单失败，静默处理
  }
};

/**
 * 获取历史菜单列表（按日期倒序）
 * @returns {Array} 历史记录数组 [{ dateKey, dateLabel, weekday, dishNames, ... }, ...]
 */
exports.getMenuHistory = function () {
  try {
    var history = wx.getStorageSync(HISTORY_STORAGE_KEY) || {};
    var keys = Object.keys(history).sort().reverse();
    return keys.map(function (key) {
      return history[key];
    });
  } catch (e) {
    return [];
  }
};

/**
 * 获取指定日期的历史菜单
 * @param {String} dateKey - 日期 key，格式 YYYY-MM-DD
 * @returns {Object|null} 历史记录对象，或 null
 */
exports.getMenuHistoryByDate = function (dateKey) {
  if (!dateKey) return null;
  try {
    var history = wx.getStorageSync(HISTORY_STORAGE_KEY) || {};
    return history[dateKey] || null;
  } catch (e) {
    return null;
  }
};

/**
 * 从历史记录还原完整菜单
 * @param {String} dateKey - 日期 key
 * @returns {Object|null} { menus, preference } 或 null
 */
exports.restoreMenuFromHistory = function (dateKey) {
  var record = exports.getMenuHistoryByDate(dateKey);
  if (!record || !record.menus) return null;
  
  try {
    var pref = record.preference || {};
    var opts = {
      babyMonth: pref.babyMonth || 12,
      adultCount: pref.adultCount || 2,
      hasBaby: pref.hasBaby === true,
      babyTaste: pref.babyTaste || 'soft_porridge'
    };
    var menus = exports.deserializeMenusFromStorage(record.menus, opts);
    return {
      menus: menus,
      preference: pref
    };
  } catch (e) {
    return null;
  }
};

/**
 * 删除指定日期的历史记录
 * @param {String} dateKey - 日期 key
 */
exports.deleteMenuHistory = function (dateKey) {
  if (!dateKey) return;
  try {
    var history = wx.getStorageSync(HISTORY_STORAGE_KEY) || {};
    if (history[dateKey]) {
      delete history[dateKey];
      wx.setStorageSync(HISTORY_STORAGE_KEY, history);
    }
  } catch (e) {
    // 删除历史菜单失败，静默处理
  }
};

/**
 * 清空所有历史记录
 */
exports.clearMenuHistory = function () {
  try {
    wx.removeStorageSync(HISTORY_STORAGE_KEY);
  } catch (e) {
    // 清空历史菜单失败，静默处理
  }
};

/**
 * 获取今天是否已有历史记录
 * @returns {Boolean}
 */
exports.hasTodayHistory = function () {
  var today = formatDateInfo(new Date()).dateKey;
  var record = exports.getMenuHistoryByDate(today);
  return !!(record && record.menus && record.menus.length > 0);
};

/**
 * 获取今天的历史菜单（快捷方法）
 * @returns {Object|null}
 */
exports.getTodayHistory = function () {
  var today = formatDateInfo(new Date()).dateKey;
  return exports.getMenuHistoryByDate(today);
};

