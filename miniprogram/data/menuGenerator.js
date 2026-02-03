/**
 * 菜单与步骤生成逻辑（微信小程序版 - CommonJS）
 *
 * 【接口人 Exports】页面必须通过 require 引入并只使用以下三个核心函数：
 *   - filterByPreference(recipes, userPreference)  过滤忌口，纯函数
 *   - calculateScaling(recipe, totalCount)         份额缩放，纯函数
 *   - computeDashboard(menus, pref)                看板计算，纯函数
 *
 * 【数据协议】页面传给逻辑层的 userPreference 统一格式：
 *   { avoidList: string[], dietStyle: string, isTimeSave: boolean }
 *   可选兼容字段：allergens(=avoidList), dietary_preference(=dietStyle)
 *
 * 【纯函数】逻辑层不调用 wx.setStorageSync / this.setData，输入→输出由页面层处理。
 *
 * 【数据源】优先使用云端菜谱（cloudRecipeService），降级到本地 recipes.js
 *
 * 三层统筹架构（核心生成逻辑）：
 * 1. Pre-Filter：忌口与主料冲突、口味偏好与 tags 不符则剔除
 * 2. Core Selection & Balancing：抽选时 stewCount，stew > 1 则舍弃并重抽非炖煮替代
 * 3. Dynamic Scaling：非调料项 amount = (totalCount / base_serving) * baseAmount
 */
var recipes = require('./recipes.js');
var cloudRecipeService = null;

// 延迟加载云端菜谱服务，避免循环依赖
function getCloudRecipeService() {
  if (!cloudRecipeService) {
    try {
      cloudRecipeService = require('../utils/cloudRecipeService.js');
    } catch (e) {
      cloudRecipeService = null;
    }
  }
  return cloudRecipeService;
}

/**
 * 获取大人菜谱列表（优先云端，降级本地）
 * @returns {Array}
 */
function getAdultRecipesList() {
  var service = getCloudRecipeService();
  if (service) {
    var cloudData = service.getAdultRecipes();
    if (cloudData && cloudData.length > 0) {
      return cloudData;
    }
  }
  return recipes.adultRecipes || [];
}

/**
 * 获取宝宝菜谱列表（优先云端，降级本地）
 * @returns {Array}
 */
function getBabyRecipesList() {
  var service = getCloudRecipeService();
  if (service) {
    var cloudData = service.getBabyRecipes();
    if (cloudData && cloudData.length > 0) {
      return cloudData;
    }
  }
  return recipes.babyRecipes || [];
}

// 使用动态获取而非静态引用
var adultRecipes = getAdultRecipesList();
var babyRecipes = getBabyRecipesList();

var MEAT_LABEL = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鳕鱼', shrimp: '虾仁', vegetable: '素菜' };
var MEAT_KEY_MAP = { 鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp', 素菜: 'vegetable', chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp', vegetable: 'vegetable' };

/** 忌口/过敏原 key → 对应 main_ingredients 中可能出现的名称（用于前置过滤） */
/**
 * avoidOptions value → 对应主料名列表
 * 与 home.js 的 avoidOptions 保持一致：
 * - spicy: 不吃辣（按 flavor_profile 过滤，非主料）
 * - seafood: 海鲜过敏
 * - peanut: 花生过敏
 * - lactose: 乳糖不耐
 * - gluten: 麸质过敏
 * - beef_lamb / egg / soy: 保留原有映射
 */
var ALLERGEN_TO_MAIN_NAMES = {
  seafood: ['鳕鱼', '鲈鱼', '虾', '虾仁', '鲜虾', '海鲜', '鱼', '蟹', '贝', '扇贝', '蛤蜊', '鱿鱼', '墨鱼'],
  spicy: [],  // 辣味通过 flavor_profile === 'spicy' 过滤，非主料匹配
  peanut: ['花生', '花生米', '花生碎', '花生酱'],
  lactose: ['牛奶', '鲜奶', '奶油', '黄油', '奶酪', '芝士', '乳酪'],
  gluten: ['面粉', '小麦', '面条', '馒头', '面包', '饺子皮', '馄饨皮'],
  beef_lamb: ['牛肉', '牛腩', '牛柳', '牛里脊', '羊肉', '羊排'],
  egg: ['鸡蛋', '蛋', '蛋黄', '蛋白'],
  soy: ['豆腐', '嫩豆腐', '大豆', '豆浆', '豆皮', '腐竹']
};

/**
 * dietOptions value → 菜品需具备的 tags 之一
 * 与 home.js 的 dietOptions 保持一致：
 * - home: 家常（无特殊限制，全部菜谱可选）
 * - light: 清淡
 * - rich: 下饭（偏好重口味、高蛋白）
 * - quick: 快手
 */
var DIETARY_PREFERENCE_TAGS = {
  home: [],  // 家常：无特殊标签要求，全量菜谱可选
  light: ['light', 'no_oil', 'vegetarian', 'steamed'],
  rich: ['high_protein', 'spicy', 'salty_umami', 'hearty'],
  quick: ['quick', 'stir_fry'],
  hearty: ['high_protein', 'spicy', 'soup']  // 保留原有映射以兼容
};

// ============ 数据协议：统一 userPreference 格式（纯函数，不依赖 wx/this） ============
/**
 * 将页面传入的偏好规范为逻辑层统一格式，避免字段名混淆。
 * @param {Object} pref - 页面传入的偏好，可为 { avoidList, dietStyle, isTimeSave } 或兼容 allergens/dietary_preference
 * @returns {Object} { avoidList, dietStyle, isTimeSave, allergens, dietary_preference } 供内部 preFilter 使用
 */
function normalizeUserPreference(pref) {
  if (!pref || typeof pref !== 'object') {
    return { avoidList: [], dietStyle: '', isTimeSave: false, allergens: [], dietary_preference: '' };
  }
  var avoidList = Array.isArray(pref.avoidList) ? pref.avoidList : (Array.isArray(pref.allergens) ? pref.allergens : []);
  var dietStyle = pref.dietStyle != null ? String(pref.dietStyle) : (pref.dietary_preference != null ? String(pref.dietary_preference) : '');
  var isTimeSave = pref.isTimeSave === true || pref.is_time_save === true;
  return {
    avoidList: avoidList,
    dietStyle: dietStyle,
    isTimeSave: isTimeSave,
    allergens: avoidList,
    dietary_preference: dietStyle
  };
}

// ============ 第一层：Pre-Filter（前置过滤） ============
/**
 * 输入：allRecipes, userPreference
 * 逻辑：filter。若 userPreference.allergens 与菜品 main_ingredients 有交集则剔除；
 *       若 dietary_preference 有值且菜品 tags 不包含对应偏好标签则剔除。
 * @param {Array} allRecipes - 全量菜谱
 * @param {Object} userPreference - { allergens, dietary_preference }，allergens 可为 avoidList 或 allergens
 * @returns {Array} 过滤后的菜谱池
 */
function preFilter(allRecipes, userPreference) {
  if (!Array.isArray(allRecipes) || allRecipes.length === 0) return allRecipes;
  if (!userPreference) return allRecipes.slice();

  var allergens = userPreference.allergens || userPreference.avoidList || [];
  var dietaryPreference = userPreference.dietary_preference || userPreference.dietStyle || '';

  return allRecipes.filter(function (recipe) {
    var mainIng = recipe.main_ingredients || [];
    if (!Array.isArray(mainIng)) mainIng = [];

    // 过敏原/忌口处理
    for (var a = 0; a < allergens.length; a++) {
      var key = allergens[a];

      // 特殊处理：spicy（不吃辣）按 flavor_profile 过滤
      if (key === 'spicy') {
        if ((recipe.flavor_profile || '') === 'spicy') return false;
        continue;
      }

      // 常规主料匹配：展开后的主料名出现在 main_ingredients 则剔除
      var names = ALLERGEN_TO_MAIN_NAMES[key];
      if (names && names.length > 0) {
        for (var n = 0; n < mainIng.length; n++) {
          var m = String(mainIng[n] || '').trim();
          for (var j = 0; j < names.length; j++) {
            if (m.indexOf(names[j]) !== -1 || names[j].indexOf(m) !== -1) return false;
          }
        }
      }
      // 若 allergen 直接为主料名（如「鸡蛋」）
      for (var k = 0; k < mainIng.length; k++) {
        if (String(mainIng[k] || '').indexOf(key) !== -1) return false;
      }
    }

    // dietary_preference：有要求且标签列表非空时，菜品 tags 需包含对应偏好之一
    // 注意：home（家常）对应空数组，表示无特殊要求，不过滤
    if (dietaryPreference && DIETARY_PREFERENCE_TAGS[dietaryPreference]) {
      var requiredTags = DIETARY_PREFERENCE_TAGS[dietaryPreference];
      if (requiredTags.length > 0) {
        var recipeTags = recipe.tags || [];
        var match = false;
        for (var t = 0; t < requiredTags.length; t++) {
          if (recipeTags.indexOf(requiredTags[t]) !== -1) { match = true; break; }
        }
        if (!match) return false;
      }
      // requiredTags 为空数组时（如 home），不过滤任何菜谱
    }

    return true;
  });
}

/**
 * 【接口人】过滤忌口 - 纯函数：输入 (recipes, userPreference)，输出 (filteredRecipes)。
 * 不调用 wx / this。userPreference 统一格式：{ avoidList: [], dietStyle: '', isTimeSave: false }。
 * @param {Array} recipes - 全量菜谱
 * @param {Object} userPreference - 统一偏好对象
 * @returns {Array} 过滤后的菜谱数组（新数组，不修改原数组）
 */
function filterByPreference(recipes, userPreference) {
  if (!Array.isArray(recipes)) return [];
  var normalized = normalizeUserPreference(userPreference);
  return preFilter(recipes, normalized);
}

// ============ 第二层：Core Selection & Balancing（核心筛选与做法均衡） ============

/**
 * ========== 设备互斥算法 ==========
 * 
 * 核心思想：不同 cook_type 映射到不同设备，每种设备有数量上限。
 * 生成菜单时自动平衡，避免同时抢占同一设备（如两个锅同时炒）。
 * 
 * 示例组合：
 * - 1个炖菜 + 1个快炒 + 1个凉菜（炖锅、炒锅、无设备，不冲突）
 * - 1个蒸菜 + 2个炒菜（蒸锅 + 炒锅，不冲突）
 * - 避免：2个炖菜 + 1个炒菜（2个炖菜同时占用灶台太久）
 */

/** cook_type → 设备类型映射 */
var COOK_TYPE_TO_DEVICE = {
  stir_fry: 'wok',           // 炒菜 → 炒锅
  quick_stir_fry: 'wok',     // 快炒 → 炒锅
  fry: 'wok',                // 煎炸 → 炒锅
  braise: 'wok',             // 红烧 → 炒锅
  stew: 'stove_long',        // 炖菜 → 长时间占灶（炖锅/砂锅）
  steam: 'steamer',          // 蒸菜 → 蒸锅
  cold: 'none',              // 凉菜 → 无需设备
  salad: 'none',             // 拌菜 → 无需设备
  boil: 'pot'                // 煮汤 → 汤锅
};

/** 设备数量限制（普通家庭厨房配置） */
var DEVICE_LIMITS = {
  wok: 2,                    // 最多 2 道炒菜（1-2 个炒锅）
  stove_long: 1,             // 最多 1 道长时间占灶（炖菜）
  steamer: 1,                // 最多 1 道蒸菜
  pot: 1,                    // 最多 1 道汤
  none: 99                   // 凉菜无限制
};

/**
 * 获取菜谱的设备类型
 * @param {Object} recipe - 菜谱对象
 * @returns {String} 设备类型
 */
function getRecipeDevice(recipe) {
  if (!recipe) return 'wok';
  var cookType = recipe.cook_type || recipe.cook_method || 'stir_fry';
  return COOK_TYPE_TO_DEVICE[cookType] || 'wok';
}

/**
 * 初始化设备计数器
 * @returns {Object} { wok: 0, stove_long: 0, steamer: 0, pot: 0, none: 0 }
 */
function initDeviceCounts() {
  return { wok: 0, stove_long: 0, steamer: 0, pot: 0, none: 0 };
}

/**
 * 从已有菜单计算当前设备占用
 * @param {Array} existingMenus - 已选菜单数组
 * @returns {Object} 设备计数
 */
function countDevicesFromMenus(existingMenus) {
  var counts = initDeviceCounts();
  if (!Array.isArray(existingMenus)) return counts;
  
  for (var i = 0; i < existingMenus.length; i++) {
    var recipe = existingMenus[i].adultRecipe;
    if (!recipe) continue;
    var device = getRecipeDevice(recipe);
    if (counts[device] != null) {
      counts[device]++;
    }
  }
  return counts;
}

/**
 * 检查添加某道菜后是否会超出设备限制
 * @param {Object} recipe - 待添加的菜谱
 * @param {Object} deviceCounts - 当前设备计数
 * @returns {Boolean} true = 会超限，应该跳过
 */
function wouldExceedDeviceLimit(recipe, deviceCounts) {
  if (!recipe) return false;
  var device = getRecipeDevice(recipe);
  var limit = DEVICE_LIMITS[device];
  if (limit == null) return false;
  var current = deviceCounts[device] || 0;
  return current >= limit;
}

/**
 * 过滤掉会导致设备超限的菜谱
 * @param {Array} pool - 候选菜谱池
 * @param {Object} deviceCounts - 当前设备计数
 * @returns {Array} 过滤后的池
 */
function filterByDeviceLimits(pool, deviceCounts) {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  
  var filtered = pool.filter(function (r) {
    return !wouldExceedDeviceLimit(r, deviceCounts);
  });
  
  // 如果全部超限，返回原池（避免无菜可选）
  return filtered.length > 0 ? filtered : pool;
}

/**
 * 【升级版】从池中随机抽一道，综合考虑设备互斥约束。
 * 
 * 算法流程：
 * 1. 根据当前设备计数过滤候选池，排除会导致超限的菜谱
 * 2. 从过滤后的池中随机抽选
 * 3. 更新设备计数并返回
 * 
 * @param {Array} pool - 已做 preFilter 的池
 * @param {Object} deviceCountsRef - { wok, stove_long, steamer, pot, none }，会原地更新
 * @returns {{ recipe: Object, deviceCounts: Object }} 选中的菜谱与更新后的设备计数
 */
function pickOneWithDeviceBalance(pool, deviceCountsRef) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return { recipe: null, deviceCounts: deviceCountsRef || initDeviceCounts() };
  }
  
  var counts = deviceCountsRef || initDeviceCounts();
  
  // 过滤掉会导致设备超限的菜谱
  var availablePool = filterByDeviceLimits(pool, counts);
  
  // 随机抽选
  var pick = availablePool[Math.floor(Math.random() * availablePool.length)];
  
  // 更新设备计数
  if (pick) {
    var device = getRecipeDevice(pick);
    if (counts[device] != null) {
      counts[device]++;
    }
  }
  
  return { recipe: pick, deviceCounts: counts };
}

/**
 * 【兼容旧版】从池中随机抽一道；若当前已有 stewCount >= 1 且抽到的是 stew，则舍弃并改从「非炖煮」池中重抽。
 * 
 * 注意：此函数保留用于向后兼容，内部已升级为使用 pickOneWithDeviceBalance。
 * 
 * @param {Array} pool - 已做 preFilter 的池
 * @param {number} stewCount - 当前已选中的 stew 数量
 * @returns {{ recipe: Object, stewCount: number }} 选中的菜谱与更新后的 stewCount
 */
function pickOneWithStewBalance(pool, stewCount) {
  if (!Array.isArray(pool) || pool.length === 0) return { recipe: null, stewCount: stewCount };

  // 将 stewCount 转换为设备计数格式
  var deviceCounts = initDeviceCounts();
  deviceCounts.stove_long = stewCount || 0;
  
  // 使用新的设备平衡算法
  var result = pickOneWithDeviceBalance(pool, deviceCounts);
  
  // 返回兼容旧格式的结果
  return {
    recipe: result.recipe,
    stewCount: result.deviceCounts.stove_long
  };
}

// ============ 第三层：Dynamic Scaling（动态缩放） ============
/**
 * 在返回结果前遍历 ingredients：非调料项 item.amount = (totalCount / recipe.base_serving) * item.baseAmount
 * 调料类不缩放。为避免污染缓存，对 ingredient 做浅拷贝并写入 amount。
 * @param {Object} recipe - 菜谱对象（会替换为带 amount 的 ingredients）
 * @param {number} totalCount - 总人数
 * @returns {Object} 同一 recipe 引用
 */
function dynamicScaling(recipe, totalCount) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return recipe;

  var baseServing = recipe.base_serving != null ? Number(recipe.base_serving) : 2;
  var total = Math.max(1, Number(totalCount) || 2);
  var ratio = total / baseServing;

  recipe.ingredients = recipe.ingredients.map(function (item) {
    var out = {};
    for (var k in item) {
      if (item.hasOwnProperty(k)) out[k] = item[k];
    }
    if (out.category !== '调料') {
      var baseAmount = out.baseAmount != null ? Number(out.baseAmount) : 0;
      out.amount = ratio * baseAmount;
    }
    return out;
  });

  return recipe;
}

/**
 * 【接口人】份额缩放 - 纯函数：输入 (recipe, totalCount)，输出带缩放后 amount 的菜谱（不修改入参）。
 * 不调用 wx / this。调料不缩放。
 * @param {Object} recipe - 单道菜谱（含 ingredients、base_serving）
 * @param {number} totalCount - 总人数
 * @returns {Object} 新菜谱对象（含缩放后的 ingredients[].amount），原 recipe 不变
 */
function calculateScaling(recipe, totalCount) {
  if (!recipe) return null;
  var clone = {};
  for (var k in recipe) {
    if (recipe.hasOwnProperty(k)) clone[k] = recipe[k];
  }
  if (!Array.isArray(recipe.ingredients)) return clone;
  clone.ingredients = recipe.ingredients.map(function (item) {
    var out = {};
    for (var j in item) {
      if (item.hasOwnProperty(j)) out[j] = item[j];
    }
    var baseServing = recipe.base_serving != null ? Number(recipe.base_serving) : 2;
    var total = Math.max(1, Number(totalCount) || 2);
    var ratio = total / baseServing;
    if (out.category !== '调料') {
      var baseAmount = out.baseAmount != null ? Number(out.baseAmount) : 0;
      out.amount = ratio * baseAmount;
    }
    return out;
  });
  return clone;
}

// ---------- 兼容旧调用：过滤/均衡/缩放工具函数（供 menuData 等使用） ----------
function recipeContainsAvoid(recipe, avoidList) {
  if (!recipe || !Array.isArray(avoidList) || avoidList.length === 0) return false;
  var mainIng = recipe.main_ingredients || [];
  if (!Array.isArray(mainIng)) mainIng = [];
  for (var a = 0; a < avoidList.length; a++) {
    var names = ALLERGEN_TO_MAIN_NAMES[avoidList[a]];
    if (names) {
      for (var n = 0; n < mainIng.length; n++) {
        var m = String(mainIng[n] || '');
        for (var j = 0; j < names.length; j++) {
          if (m.indexOf(names[j]) !== -1) return true;
        }
      }
    }
  }
  return false;
}

function recipeDietScore(recipe, dietStyle, isTimeSave) {
  if (!recipe) return 0;
  var score = 10;
  var tags = recipe.tags || [];
  if (dietStyle && DIETARY_PREFERENCE_TAGS[dietStyle]) {
    for (var i = 0; i < DIETARY_PREFERENCE_TAGS[dietStyle].length; i++) {
      if (tags.indexOf(DIETARY_PREFERENCE_TAGS[dietStyle][i]) !== -1) { score += 15; break; }
    }
  }
  if (isTimeSave && tags.indexOf('quick') !== -1) score += 15;
  return score;
}

function filterRecipePool(pool, userPreference) {
  return preFilter(pool || [], userPreference);
}

function countCookMethod(menus, cookMethod) {
  if (!Array.isArray(menus)) return 0;
  var count = 0;
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (r && (r.cook_method || r.cook_type) === cookMethod) count++;
  }
  return count;
}

function balanceFilterPool(pool, existingMenus, constraints) {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  var maxStew = (constraints && constraints.maxStew) != null ? constraints.maxStew : 1;
  var current = countCookMethod(existingMenus || [], 'stew');
  if (current >= maxStew) {
    var nonStew = pool.filter(function (r) { return (r.cook_method || r.cook_type) !== 'stew'; });
    if (nonStew.length > 0) return nonStew;
  }
  return pool;
}

function scaleRecipeIngredients(recipe, adultCount) {
  return dynamicScaling(recipe, adultCount);
}

function getScaledAmount(ingredient) {
  if (!ingredient) return 0;
  if (ingredient.amount != null) return Number(ingredient.amount);
  if (ingredient.baseAmount != null) return Number(ingredient.baseAmount);
  return 0;
}

/** 模糊调料词汇 → 阿姨更有体感的分量单位（勺=汤匙） */
var VAGUE_SEASONING_TO_PORTION = { '适量': '约1勺', '少许': '半勺', '少量': '半勺', '一点': '半勺', '若干': '约1勺' };

/** 将单个用量文案替换为分量单位，用于购物清单/备菜/步骤展示 */
function formatSeasoningAmountForDisplay(amount) {
  if (amount == null || String(amount).trim() === '') return '约1勺';
  var s = String(amount).trim();
  return VAGUE_SEASONING_TO_PORTION[s] != null ? VAGUE_SEASONING_TO_PORTION[s] : s;
}

/** 将步骤文案中的模糊调料词替换为分量单位，便于阿姨执行 */
function replaceVagueSeasoningInText(text) {
  if (!text || typeof text !== 'string') return text;
  var t = text;
  t = t.replace(/一点点/g, '约半勺');
  t = t.replace(/适量/g, '约1勺');
  t = t.replace(/少许/g, '半勺');
  t = t.replace(/少量/g, '半勺');
  t = t.replace(/若干/g, '约1勺');
  t = t.replace(/一点/g, '半勺');
  return t;
}

function normalizeMeat(meat) {
  var key = MEAT_KEY_MAP[meat] || meat;
  return typeof key === 'string' ? key : 'chicken';
}

function getBabyConfig(month) {
  var m = Math.min(36, Math.max(6, Number(month) || 6));
  if (m <= 8) return { action: '打成细腻泥糊状', salt: '⚠️ 此时期严禁加盐、酱油或糖，保持食材原味以保护肾脏。' };
  if (m <= 12) return { action: '切碎成末（米粒大小）', salt: '⚠️ 此时期严禁加盐、酱油或糖，保持食材原味以保护肾脏。' };
  if (m <= 18) return { action: '切成小丁', salt: '🧂 少量调味：全天盐 <1g (约一个黄豆大小) 或低钠酱油 2滴。' };
  if (m <= 24) return { action: '切成小块', salt: '🧂 适度调味：全天盐 <2g，建议优先使用天然香料（如香菇粉）。' };
  return { action: '正常切块', salt: '🥗 过渡饮食：可少量尝试成人餐，但需保持低油低盐，避免重口味。' };
}

/** 根据 babyMonth 返回第一个 month <= max_month 的 stage 对象；无匹配用最后一项 */
function getBabyVariantByAge(recipe, babyMonth) {
  if (!recipe || !recipe.baby_variant || !Array.isArray(recipe.baby_variant.stages) || recipe.baby_variant.stages.length === 0)
    return null;
  var stages = recipe.baby_variant.stages.slice();
  stages.sort(function (a, b) { return (a.max_month || 0) - (b.max_month || 0); });
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  for (var i = 0; i < stages.length; i++) {
    if (m <= (stages[i].max_month != null ? stages[i].max_month : 999))
      return stages[i];
  }
  return stages[stages.length - 1] || null;
}

/** 浅拷贝菜谱并仅克隆 steps，避免整份 JSON 深拷贝带来的卡顿 */
function copyAdultRecipe(r) {
  if (!r) return null;
  var out = {};
  for (var k in r) { if (r.hasOwnProperty(k) && k !== 'steps') out[k] = r[k]; }
  out.steps = (r.steps || []).map(function (s) {
    return typeof s === 'string' ? { action: 'prep', text: s } : Object.assign({}, s);
  });
  return out;
}

function copyBabyRecipe(r) {
  if (!r) return null;
  var out = {};
  for (var k in r) { if (r.hasOwnProperty(k) && k !== 'steps') out[k] = r[k]; }
  out.steps = (r.steps || []).map(function (s) {
    return typeof s === 'string' ? { action: 'cook', text: s } : Object.assign({}, s);
  });
  return out;
}

var _adultPoolCache = {};
var _adultPoolCacheVersion = 0;  // 用于判断缓存是否需要刷新

/**
 * 获取成人菜谱池（带降级追踪）
 * @param {String} taste - 口味类型
 * @param {String} meatKey - 肉类类型
 * @param {Object} userPreference - 用户偏好
 * @returns {{ pool: Array, fallbackReason: String|null }} pool 为菜谱数组，fallbackReason 为降级原因（null 表示无降级）
 */
function getAdultPool(taste, meatKey, userPreference) {
  // 动态获取最新菜谱列表
  var currentAdultRecipes = getAdultRecipesList();
  
  // 检查数据源是否变化，如果变化则清空缓存
  var service = getCloudRecipeService();
  var currentVersion = service ? service.getSyncState().syncCount : 0;
  if (currentVersion !== _adultPoolCacheVersion) {
    _adultPoolCache = {};
    _adultPoolCacheVersion = currentVersion;
  }
  
  var baseKey = (taste || '') + '_' + (meatKey || '');
  var fallbackReason = null;
  
  if (!_adultPoolCache[baseKey]) {
    var arr = currentAdultRecipes.filter(function (r) { return r.taste === taste && r.meat === meatKey; });
    if (meatKey === 'vegetable' && arr.length === 0) {
      arr = currentAdultRecipes.filter(function (r) { return r.meat === 'vegetable'; });
    }
    if (arr.length === 0) {
      arr = currentAdultRecipes;
      fallbackReason = 'taste_meat_empty'; // 口味+主料无匹配
    }
    _adultPoolCache[baseKey] = arr;
  }
  var basePool = _adultPoolCache[baseKey].slice();
  var filtered = preFilter(basePool, userPreference);
  
  // 如果过滤后为空，说明忌口/偏好过滤太严格
  if (filtered.length === 0 && basePool.length > 0) {
    fallbackReason = 'preference_filter_empty'; // 忌口/偏好过滤后为空
    filtered = basePool.slice();
  }
  
  return { pool: filtered, fallbackReason: fallbackReason };
}

/**
 * 获取成人菜谱池（兼容旧调用，仅返回数组）
 * @deprecated 请使用 getAdultPoolWithMeta
 */
function getAdultPoolSimple(taste, meatKey, userPreference) {
  var result = getAdultPool(taste, meatKey, userPreference);
  return result.pool;
}

/**
 * 生成菜单 - 三层统筹：Pre-Filter → Core Selection & Stew 均衡 → Dynamic Scaling
 * @param {String} taste - 口味类型
 * @param {String} meat - 肉类类型
 * @param {number} babyMonth - 宝宝月龄
 * @param {boolean} hasBaby - 是否有宝宝
 * @param {number} adultCount - 大人人数
 * @param {String} babyTaste - 宝宝口味
 * @param {Object} userPreference - { allergens/avoidList, dietary_preference/dietStyle }
 * @param {Array} existingMenus - 已选菜单（可选）
 * @param {Object} stewCountRef - 可选，{ stewCount: number }，用于跨槽位限制 stew 数量，会原地更新
 * @returns {{ adultRecipe, babyRecipe, fallbackReason? }} fallbackReason 存在时表示发生了降级
 */
function generateMenu(taste, meat, babyMonth, hasBaby, adultCount, babyTaste, userPreference, existingMenus, stewCountRef) {
  adultCount = adultCount == null ? 2 : adultCount;
  var meatKey = normalizeMeat(meat);
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  var config = getBabyConfig(m);
  var validBabyTastes = ['soft_porridge', 'finger_food', 'braised_mash'];
  var babyTasteKey = (babyTaste && validBabyTastes.indexOf(babyTaste) !== -1) ? babyTaste : 'soft_porridge';

  var currentStew = 0;
  if (stewCountRef && typeof stewCountRef.stewCount === 'number') currentStew = stewCountRef.stewCount;

  // 第一层：前置过滤（带降级追踪）
  var poolResult = getAdultPool(taste, meatKey, userPreference);
  var aPool = poolResult.pool;
  var fallbackReason = poolResult.fallbackReason;
  
  // 二次兜底：如果仍为空，使用全量菜谱
  if (aPool.length === 0) {
    aPool = getAdultRecipesList().slice();
    fallbackReason = 'all_filters_empty'; // 所有过滤条件下都无匹配
  }

  // 第二层：核心筛选与做法均衡（stewCount > 1 则舍弃当前炖菜、重抽非炖煮）
  var pickResult = pickOneWithStewBalance(aPool, currentStew);
  var adultRaw = pickResult.recipe;
  if (stewCountRef && typeof stewCountRef.stewCount === 'number') stewCountRef.stewCount = pickResult.stewCount;

  var adult = adultRaw ? copyAdultRecipe(adultRaw) : null;

  // 第三层：动态缩放（item.amount = (totalCount / base_serving) * item.baseAmount，调料不缩放）
  if (adult) {
    dynamicScaling(adult, adultCount);
  }

  var baby = null;
  if (meatKey !== 'vegetable') {
    // 动态获取最新宝宝菜谱列表
    var currentBabyRecipes = getBabyRecipesList();
    var bPool = currentBabyRecipes.filter(function (r) {
      return r.meat === meatKey && (r.taste === babyTasteKey || (r.taste == null && babyTasteKey === 'soft_porridge'));
    });
    if (bPool.length === 0) bPool = currentBabyRecipes.filter(function (r) { return r.meat === meatKey; });
    var rawBaby;
    if (meatKey === 'fish') {
      rawBaby = bPool.find(function (r) { return r.id === 'b-fish-detail'; }) || bPool[0] || currentBabyRecipes[0];
    } else {
      rawBaby = (bPool.length > 0 ? bPool : currentBabyRecipes)[Math.floor(Math.random() * (bPool.length || currentBabyRecipes.length))];
    }
    if (hasBaby && rawBaby) {
      baby = copyBabyRecipe(rawBaby);
      var stage = getBabyVariantByAge(adult, babyMonth);
      baby.name = (stage && stage.name) || (rawBaby.name || '宝宝餐');
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
    var baseServing = adult.base_serving != null ? adult.base_serving : 2;
    var scale = Math.max(1, Number(adultCount) || 2) / baseServing;
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

  var result = { adultRecipe: adult, babyRecipe: baby };
  if (fallbackReason) result.fallbackReason = fallbackReason;
  return result;
}

/** 从指定菜谱构建一档（含人数缩放与可选宝宝餐），用于模板按名解析 */
function generateMenuFromRecipe(recipe, babyMonth, hasBaby, adultCount, babyTaste) {
  if (!recipe) return { adultRecipe: null, babyRecipe: null };
  adultCount = adultCount == null ? 2 : adultCount;
  var babyTasteKey = (babyTaste && ['soft_porridge', 'finger_food', 'braised_mash'].indexOf(babyTaste) !== -1) ? babyTaste : 'soft_porridge';
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  var config = getBabyConfig(m);
  var meatKey = normalizeMeat(recipe.meat);
  var adult = copyAdultRecipe(recipe);

  if (adult) {
    dynamicScaling(adult, adultCount);
  }

  if (adult && Array.isArray(adult.steps)) {
    var baseServing = adult.base_serving || 2;
    var scale = Math.max(1, Number(adultCount) || 2) / baseServing;
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
  adult.time = adult.time != null ? adult.time : estimateRecipeTime(adult);

  var baby = null;
  if (meatKey !== 'vegetable' && hasBaby) {
    // 动态获取最新宝宝菜谱列表
    var currentBabyRecipes = getBabyRecipesList();
    var bPool = currentBabyRecipes.filter(function (r) {
      return r.meat === meatKey && (r.taste === babyTasteKey || (r.taste == null && babyTasteKey === 'soft_porridge'));
    });
    if (bPool.length === 0) bPool = currentBabyRecipes.filter(function (r) { return r.meat === meatKey; });
    var rawBaby = (bPool.length > 0 ? bPool : currentBabyRecipes)[Math.floor(Math.random() * (bPool.length || currentBabyRecipes.length))];
    if (rawBaby) {
      baby = copyBabyRecipe(rawBaby);
      var stage = getBabyVariantByAge(recipe, babyMonth);
      baby.name = (stage && stage.name) || (rawBaby.name || '宝宝餐');
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
      baby.time = baby.time != null ? baby.time : estimateRecipeTime(baby);
    }
  }
  return { adultRecipe: adult, babyRecipe: baby };
}

/**
 * 口味分类常量
 * - strong: 重口味（辣、咸重），需要搭配清淡解腻
 * - sour: 酸味系（酸甜、酸爽），可解腻开胃
 * - sweet: 甜味系（酸甜、甜香），适度调节口感
 * - light: 清淡系（清淡、原味），万能搭配
 * - umami: 鲜味系（海鲜、菌菇、番茄等天然鲜味）
 */
var FLAVOR_CATEGORIES = {
  strong: ['spicy', 'salty_umami'],        // 重口味
  sour: ['sweet_sour', 'sour_fresh'],       // 酸味系
  sweet: ['sweet_sour', 'sweet'],           // 甜味系
  light: ['light'],                         // 清淡系
  umami: ['umami', 'salty_umami']           // 鲜味系
};

/** 鲜味食材关键词（用于检测菜品是否含有天然鲜味） */
var UMAMI_INGREDIENTS = ['虾', '蟹', '贝', '鱼', '菌', '菇', '香菇', '番茄', '西红柿', '海带', '紫菜', '豆豉', '蚝油'];

/**
 * 检测菜品是否含有天然鲜味食材
 * @param {Object} recipe - 菜谱对象
 * @returns {Boolean}
 */
function hasUmamiIngredient(recipe) {
  if (!recipe) return false;
  var name = recipe.name || '';
  var ingredients = recipe.ingredients || [];
  // 检测菜名
  for (var i = 0; i < UMAMI_INGREDIENTS.length; i++) {
    if (name.indexOf(UMAMI_INGREDIENTS[i]) !== -1) return true;
  }
  // 检测食材列表
  for (var j = 0; j < ingredients.length; j++) {
    var ingName = typeof ingredients[j] === 'string' ? ingredients[j] : (ingredients[j].name || '');
    for (var k = 0; k < UMAMI_INGREDIENTS.length; k++) {
      if (ingName.indexOf(UMAMI_INGREDIENTS[k]) !== -1) return true;
    }
  }
  return false;
}

/**
 * 获取菜品的口味分类统计
 * @param {Object} recipe - 菜谱对象
 * @returns {Object} { isStrong, isSour, isSweet, isLight, isUmami }
 */
function getFlavorCategories(recipe) {
  if (!recipe) return { isStrong: false, isSour: false, isSweet: false, isLight: false, isUmami: false };
  var f = recipe.flavor_profile || '';
  return {
    isStrong: FLAVOR_CATEGORIES.strong.indexOf(f) !== -1,
    isSour: FLAVOR_CATEGORIES.sour.indexOf(f) !== -1,
    isSweet: FLAVOR_CATEGORIES.sweet.indexOf(f) !== -1,
    isLight: FLAVOR_CATEGORIES.light.indexOf(f) !== -1,
    isUmami: FLAVOR_CATEGORIES.umami.indexOf(f) !== -1 || hasUmamiIngredient(recipe)
  };
}

/**
 * 口味互补检测 v2：支持辣/咸/酸/甜/鲜多维度分析
 * @param {Array} menus - 已选菜单数组
 * @returns {Object} {
 *   preferredFlavor: 建议补位的口味,
 *   preferQuick: 是否建议快手菜,
 *   flavorStats: 口味统计详情,
 *   balanceTips: 口味平衡建议数组,
 *   needUmami: 是否缺乏鲜味
 * }
 */
function checkFlavorBalance(menus) {
  if (!Array.isArray(menus) || menus.length === 0) {
    return { preferredFlavor: null, preferQuick: false, flavorStats: {}, balanceTips: [], needUmami: false };
  }

  // 口味统计
  var stats = {
    spicy: 0,        // 辣味数量
    salty_umami: 0,  // 咸鲜数量
    sweet_sour: 0,   // 酸甜数量
    sour_fresh: 0,   // 酸爽数量
    light: 0,        // 清淡数量
    umami: 0,        // 鲜味数量（含天然鲜味食材）
    total: 0         // 总菜品数
  };
  var hasLongCook = false;

  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (!r) continue;
    stats.total++;
    var f = r.flavor_profile || '';
    if (f === 'spicy') stats.spicy++;
    if (f === 'salty_umami') stats.salty_umami++;
    if (f === 'sweet_sour') stats.sweet_sour++;
    if (f === 'sour_fresh') stats.sour_fresh++;
    if (f === 'light') stats.light++;
    if (hasUmamiIngredient(r) || f === 'salty_umami') stats.umami++;
    if ((r.cook_type || r.cook_method || '') === 'stew') hasLongCook = true;
  }

  // 分析口味平衡并生成建议
  var preferredFlavor = null;
  var balanceTips = [];
  var needUmami = false;

  // 规则 1：辣菜过多（>1），建议清淡或酸甜解腻
  if (stats.spicy > 1) {
    preferredFlavor = 'light';
    balanceTips.push('辣味菜品较多，建议搭配清淡或酸甜菜品解辣');
  } else if (stats.spicy === 1 && stats.light === 0 && stats.sour_fresh === 0) {
    // 有辣但缺少解辣菜品
    preferredFlavor = preferredFlavor || 'light';
    balanceTips.push('有辣味菜品，建议搭配清淡菜品平衡口感');
  }

  // 规则 2：咸鲜过重（>半数），建议酸爽解腻
  var strongCount = stats.spicy + stats.salty_umami;
  if (strongCount > stats.total / 2 && stats.total >= 2) {
    if (!preferredFlavor) preferredFlavor = stats.sour_fresh === 0 ? 'sour_fresh' : 'light';
    if (stats.sour_fresh === 0 && stats.sweet_sour === 0) {
      balanceTips.push('重口味较多，建议搭配酸爽或清淡菜品解腻');
    }
  }

  // 规则 3：酸味过多（>半数），建议咸鲜或清淡平衡
  var sourCount = stats.sweet_sour + stats.sour_fresh;
  if (sourCount > stats.total / 2 && stats.total >= 2) {
    if (!preferredFlavor) preferredFlavor = 'salty_umami';
    balanceTips.push('酸味菜品较多，建议搭配咸鲜或清淡菜品');
  }

  // 规则 4：全是清淡，可适度增加风味
  if (stats.light === stats.total && stats.total >= 2) {
    preferredFlavor = preferredFlavor || 'salty_umami';
    balanceTips.push('菜品口味偏淡，可适当加入咸鲜或酸甜菜品提味');
  }

  // 规则 5：缺乏鲜味（无海鲜、菌菇、番茄等）
  if (stats.umami === 0 && stats.total >= 2) {
    needUmami = true;
    balanceTips.push('建议搭配含海鲜、菌菇或番茄的菜品，增加鲜味层次');
  }

  // 规则 6：甜味检测（sweet_sour 较多时提示）
  if (stats.sweet_sour > 1) {
    balanceTips.push('酸甜菜品较多，注意糖分摄入，可搭配清炒时蔬');
  }

  return {
    preferredFlavor: preferredFlavor,
    preferQuick: hasLongCook,
    flavorStats: stats,
    balanceTips: balanceTips,
    needUmami: needUmami
  };
}

/**
 * 应用口味平衡策略过滤候选池
 * @param {Array} pool - 候选菜谱池
 * @param {Object} balanceResult - checkFlavorBalance 返回的结果
 * @returns {Array} 过滤后的候选池（优先返回符合平衡要求的，否则返回原池）
 */
function applyFlavorBalance(pool, balanceResult) {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  if (!balanceResult) return pool;

  var preferredFlavor = balanceResult.preferredFlavor;
  var needUmami = balanceResult.needUmami;
  var flavorStats = balanceResult.flavorStats || {};

  // 如果无特殊偏好，直接返回
  if (!preferredFlavor && !needUmami) return pool;

  var filtered = [];

  // 优先级 1：同时满足口味偏好和鲜味需求
  if (preferredFlavor && needUmami) {
    filtered = pool.filter(function (r) {
      var f = r.flavor_profile || '';
      var matchFlavor = (preferredFlavor === 'light' && f === 'light') ||
                        (preferredFlavor === 'sour_fresh' && (f === 'sour_fresh' || f === 'sweet_sour')) ||
                        (preferredFlavor === 'salty_umami' && f === 'salty_umami') ||
                        (f === preferredFlavor);
      return matchFlavor && hasUmamiIngredient(r);
    });
    if (filtered.length > 0) return filtered;
  }

  // 优先级 2：满足口味偏好
  if (preferredFlavor) {
    filtered = pool.filter(function (r) {
      var f = r.flavor_profile || '';
      // 清淡偏好：匹配 light
      if (preferredFlavor === 'light') return f === 'light';
      // 酸爽偏好：匹配 sour_fresh 或 sweet_sour
      if (preferredFlavor === 'sour_fresh') return f === 'sour_fresh' || f === 'sweet_sour';
      // 其他直接匹配
      return f === preferredFlavor;
    });
    if (filtered.length > 0) return filtered;
  }

  // 优先级 3：仅满足鲜味需求
  if (needUmami) {
    filtered = pool.filter(function (r) {
      return hasUmamiIngredient(r);
    });
    if (filtered.length > 0) return filtered;
  }

  // 降级：避免选择已过量的口味
  if (flavorStats.spicy > 1) {
    var nonSpicy = pool.filter(function (r) { return (r.flavor_profile || '') !== 'spicy'; });
    if (nonSpicy.length > 0) return nonSpicy;
  }

  return pool;
}

/** 菜谱是否包含指定食材名之一（排除调料），ingredientNames 用 Set 做 O(1) 查找 */
function recipeUsesAnyIngredient(recipe, ingredientNames) {
  if (!recipe || !Array.isArray(recipe.ingredients) || !Array.isArray(ingredientNames) || ingredientNames.length === 0) return false;
  var set = {};
  for (var j = 0; j < ingredientNames.length; j++) {
    var t = ingredientNames[j] && String(ingredientNames[j]).trim();
    if (t) set[t] = true;
  }
  for (var i = 0; i < recipe.ingredients.length; i++) {
    var ing = recipe.ingredients[i];
    if (ing && ing.category && String(ing.category).trim() === '调料') continue;
    var n = (ing && ing.name && String(ing.name).trim()) || '';
    if (n && set[n]) return true;
  }
  return false;
}

/**
 * 按口味/共用食材等补位筛选，并走三层：Pre-Filter → Stew 均衡 → Dynamic Scaling
 * @param {Object} filters.userPreference - { allergens/avoidList, dietary_preference/dietStyle }
 * @param {Array} filters.existingMenus - 已选菜单
 * @param {Object} filters.stewCountRef - 可选，{ stewCount: number }
 * @returns {{ adultRecipe, babyRecipe, fallbackReason? }} fallbackReason 存在时表示发生了降级
 */
function generateMenuWithFilters(meat, babyMonth, hasBaby, adultCount, babyTaste, filters) {
  adultCount = adultCount == null ? 2 : adultCount;
  var meatKey = normalizeMeat(meat);
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  var config = getBabyConfig(m);
  var validBabyTastes = ['soft_porridge', 'finger_food', 'braised_mash'];
  var babyTasteKey = (babyTaste && validBabyTastes.indexOf(babyTaste) !== -1) ? babyTaste : 'soft_porridge';
  var preferredFlavor = (filters && filters.preferredFlavor) || null;
  var preferQuick = (filters && filters.preferQuick) === true;
  var preferredIngredients = (filters && Array.isArray(filters.preferredIngredients)) ? filters.preferredIngredients : null;
  var userPreference = (filters && filters.userPreference) || null;
  var existingMenus = (filters && filters.existingMenus) || [];
  var stewCountRef = (filters && filters.stewCountRef) || null;
  
  var fallbackReason = null;
  var originalPoolSize = 0;

  // 动态获取最新菜谱列表
  var currentAdultRecipes = getAdultRecipesList();
  
  var aPool = currentAdultRecipes.filter(function (r) { return r.meat === meatKey; });
  if (meatKey === 'vegetable' && aPool.length === 0) aPool = currentAdultRecipes.filter(function (r) { return r.meat === 'vegetable'; });
  
  originalPoolSize = aPool.length;
  aPool = preFilter(aPool, userPreference);
  
  // 追踪忌口过滤导致的降级
  if (aPool.length === 0 && originalPoolSize > 0) {
    fallbackReason = 'preference_filter_empty';
  }

  if (preferredFlavor === 'light') aPool = aPool.filter(function (r) { var f = r.flavor_profile || ''; return f === 'light' || f === 'sour_fresh'; });
  else if (preferredFlavor) aPool = aPool.filter(function (r) { return (r.flavor_profile || '') === preferredFlavor; });
  if (preferQuick && aPool.length > 0) {
    var quickPool = aPool.filter(function (r) { return (r.cook_type || r.cook_method) === 'stir_fry'; });
    if (quickPool.length > 0) aPool = quickPool;
  }
  if (preferredIngredients && preferredIngredients.length > 0 && aPool.length > 0) {
    var overlapPool = aPool.filter(function (r) { return recipeUsesAnyIngredient(r, preferredIngredients); });
    if (overlapPool.length > 0) aPool = overlapPool;
  }
  if (aPool.length === 0) {
    aPool = currentAdultRecipes.filter(function (r) { return r.meat === meatKey; });
    if (!fallbackReason) fallbackReason = 'flavor_filter_empty'; // 口味过滤导致为空
  }
  if (aPool.length === 0 && meatKey === 'vegetable') aPool = currentAdultRecipes.filter(function (r) { return r.meat === 'vegetable'; });

  var currentStew = stewCountRef && typeof stewCountRef.stewCount === 'number' ? stewCountRef.stewCount : 0;
  var pickResult = pickOneWithStewBalance(aPool, currentStew);
  if (stewCountRef && typeof stewCountRef.stewCount === 'number') stewCountRef.stewCount = pickResult.stewCount;

  var adultRaw = pickResult.recipe;
  var adult = adultRaw ? copyAdultRecipe(adultRaw) : null;

  if (adult) {
    dynamicScaling(adult, adultCount);
  }

  var baby = null;
  if (meatKey !== 'vegetable') {
    // 动态获取最新宝宝菜谱列表
    var currentBabyRecipes = getBabyRecipesList();
    var bPool = currentBabyRecipes.filter(function (r) {
      return r.meat === meatKey && (r.taste === babyTasteKey || (r.taste == null && babyTasteKey === 'soft_porridge'));
    });
    if (bPool.length === 0) bPool = currentBabyRecipes.filter(function (r) { return r.meat === meatKey; });
    var rawBaby = (meatKey === 'fish') ? (bPool.find(function (r) { return r.id === 'b-fish-detail'; }) || bPool[0] || currentBabyRecipes[0])
      : ((bPool.length > 0 ? bPool : currentBabyRecipes)[Math.floor(Math.random() * (bPool.length || currentBabyRecipes.length))]);
    if (meatKey !== 'vegetable' && hasBaby && rawBaby) {
      baby = copyBabyRecipe(rawBaby);
      var stage = getBabyVariantByAge(adult, babyMonth);
      baby.name = (stage && stage.name) || (rawBaby.name || '宝宝餐');
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
    var baseServing = adult.base_serving || 2;
    var scale = Math.max(1, Number(adultCount) || 2) / baseServing;
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
  
  var result = { adultRecipe: adult, babyRecipe: baby };
  if (fallbackReason) result.fallbackReason = fallbackReason;
  return result;
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
    mainParts.push(name + ' (' + formatSeasoningAmountForDisplay(amount) + ')');
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
  var babyCookTexts = (babySteps.cook || []).map(function (t) { return replaceStepPlaceholders(t, babyRecipe, list, ''); }).filter(Boolean);
  if (babyCookTexts.length === 0) babyCookTexts = ['宝宝端先上火蒸（计时 ' + babySteamMins + 'min），蒸至熟软。'];
  var babyMonth = (babyRecipe && babyRecipe.month) || 6;
  var config = getBabyConfig(babyMonth);
  var adultCanShare = adultRecipe && adultRecipe.can_share_base === true;
  var babyCanShare = babyRecipe && babyRecipe.can_share_base === true;
  var shareBase = adultCanShare && babyCanShare;

  if (shareBase) {
    var sharedMain = (adultRecipe && MEAT_LABEL[adultRecipe.meat]) || (babyRecipe && MEAT_LABEL[babyRecipe.meat]) || '主料';
    steps.push({ id: id++, title: '步骤 1：联合备菜', details: ['✨ 今日共用食材：' + sharedMain + '。', '👨 【大人端】🔥 ' + adultPrepText, '👶 【宝宝端】🔥 从中分出约 50g 单独装小碗备用，剩余留给大人。'], role: 'both', completed: false, duration: 10 });
    var parallelDetails = babyCookTexts.map(function (line) { return '👶 【宝宝端】🔥 ' + line; });
    parallelDetails.push('✨ 省时窍门：共用蒸锅可分层放置，一锅同蒸省时省气。');
    steps.push({ id: id++, title: '步骤 2：并行烹饪（利用宝宝蒸煮间隙处理成人菜）', details: parallelDetails, role: 'both', completed: false, duration: Math.max(babySteamMins, adultSteps.prep.reduce(function (s, t) { return s + estimateMinutes(t); }, 0) || 10) });
  } else {
    var babyPrepRaw = babySteps.prep[0] || '宝宝食材洗净切配。';
    var babyPrepText = replaceStepPlaceholders(babyPrepRaw, babyRecipe, list, '');
    steps.push({ id: id++, title: '步骤 1：大人备菜', details: ['👨 【大人端】🔥 ' + adultPrepText], role: 'adult', completed: false, duration: 10 });
    steps.push({ id: id++, title: '步骤 2：宝宝备菜', details: ['👶 【宝宝端】🔥 ' + babyPrepText], role: 'baby', completed: false, duration: 10 });
    var parallelDetailsNoShare = babyCookTexts.map(function (line) { return '👶 【宝宝端】🔥 ' + line; });
    parallelDetailsNoShare.push('👨 【大人端】⏳ 大人端：' + (adultSteps.cook.slice(0, 2).join('；') || '大火快炒、调味装盘。'));
    steps.push({ id: id++, title: '步骤 3：并行烹饪', details: parallelDetailsNoShare, role: 'both', completed: false, duration: Math.max(babySteamMins, adultSteps.prep.reduce(function (s, t) { return s + estimateMinutes(t); }, 0) || 10) });
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

var TASTE_ORDER = { slow_stew: 0, steamed_salad: 1, quick_stir_fry: 2 };
var TASTE_LABEL = { slow_stew: '暖心炖煮', steamed_salad: '精选蒸/拌', quick_stir_fry: '快手小炒' };

function buildMergedPrepLine(shoppingList) {
  var list = Array.isArray(shoppingList) ? shoppingList : [];
  var parts = [];
  list.forEach(function (item) {
    if (!item || item.name == null) return;
    var name = item.name;
    var amount = (item.amount != null && String(item.amount).trim() !== '') ? String(item.amount).trim() : '适量';
    parts.push(name + ' (' + formatSeasoningAmountForDisplay(amount) + ')');
  });
  if (parts.length === 0) return '洗净、切配今日所需食材。';
  return '准备好 ' + parts.join('、') + ' 并切配。';
}

function getBabyReserveHint(menu) {
  if (!menu || !menu.babyRecipe || !menu.adultRecipe) return null;
  if (menu.adultRecipe.can_share_base !== true || menu.babyRecipe.can_share_base !== true) return null;
  var baby = menu.babyRecipe;
  var ingredients = baby.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length === 0) return null;
  for (var i = 0; i < ingredients.length; i++) {
    var it = ingredients[i];
    var category = typeof it === 'object' && it != null && it.category ? it.category : '';
    if (category !== '肉类') continue;
    var name = typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : ''));
    if (!name) continue;
    var baseAmount = (typeof it === 'object' && it != null && typeof it.baseAmount === 'number') ? it.baseAmount : 0;
    var unit = (typeof it === 'object' && it != null && it.unit != null) ? String(it.unit).trim() : 'g';
    var amountStr = (baseAmount === 0 || unit === '适量') ? formatSeasoningAmountForDisplay('适量') : baseAmount + unit;
    return '[分拨] 预留宝宝所需的 ' + amountStr + ' ' + name + '，暂不调味。';
  }
  return null;
}

/**
 * 多菜并行：统筹做饭步骤
 * Step 1 全局备菜：合并所有食材为一句（如：准备好 鸡腿(600g)、番茄(250g)、姜片 适量 并切配）；若 hasBaby 且 can_share_base 则追加分拨提示。
 * Step 2+ 烹饪按优先级：slow_stew 先下锅 → steamed_salad 中场蒸 → quick_stir_fry 最后冲刺（保证上菜时都是热的）。
 */
function generateUnifiedSteps(menus, shoppingList) {
  var list = Array.isArray(shoppingList) ? shoppingList : [];
  var steps = [];
  var id = 1;

  if (!Array.isArray(menus) || menus.length === 0) {
    return steps;
  }

  var prepDetails = [];
  var mergedPrep = buildMergedPrepLine(list);
  prepDetails.push(mergedPrep);
  var firstMenu = menus[0];
  var reserveHint = getBabyReserveHint(firstMenu);
  if (reserveHint) prepDetails.push(reserveHint);

  steps.push({ id: id++, title: '步骤 1：全局备菜', details: prepDetails, role: 'both', completed: false, duration: 15 });

  var babyMenu = null;
  for (var b = 0; b < menus.length; b++) {
    if (menus[b].babyRecipe && menus[b].babyRecipe.steps && menus[b].babyRecipe.steps.length > 0) {
      babyMenu = menus[b];
      break;
    }
  }
  if (babyMenu && babyMenu.babyRecipe) {
    var babyRecipe = babyMenu.babyRecipe;
    var babyStepsByAction = getStepsByAction(babyRecipe);
    var babyPrepLines = (babyStepsByAction.prep || []).map(function (t) { return replaceStepPlaceholders(t, babyRecipe, list, ''); }).filter(Boolean);
    var babyCookLines = (babyStepsByAction.cook || []).map(function (t) { return replaceStepPlaceholders(t, babyRecipe, list, ''); }).filter(Boolean);
    var babyDetails = babyPrepLines.concat(babyCookLines);
    if (babyDetails.length === 0) babyDetails = ['👶 按宝宝月龄处理：蒸熟/压泥/切碎后装盘。'];
    else babyDetails = babyDetails.map(function (line) { return '👶 ' + line; });
    var babyDur = babyCookLines.reduce(function (sum, t) { return sum + estimateMinutes(t); }, 0) || 10;
    steps.push({
      id: id++,
      title: '步骤 2：宝宝餐 - ' + (babyRecipe.name || '辅食'),
      details: babyDetails,
      role: 'baby',
      completed: false,
      duration: babyDur
    });
  }

  var sortedMenus = menus.slice().sort(function (a, b) {
    var oa = TASTE_ORDER[a.taste] != null ? TASTE_ORDER[a.taste] : 3;
    var ob = TASTE_ORDER[b.taste] != null ? TASTE_ORDER[b.taste] : 3;
    return oa - ob;
  });

  var stepNum = (babyMenu && babyMenu.babyRecipe) ? 3 : 2;
  sortedMenus.forEach(function (menu) {
    var adult = menu.adultRecipe;
    if (!adult) return;
    var adultSteps = getStepsByAction(adult);
    var cookTexts = adultSteps.cook;
    var tasteLabel = TASTE_LABEL[menu.taste] || menu.taste;
    var dishName = adult.name || '主菜';
    var lines = cookTexts.map(function (t) { return replaceStepPlaceholders(t, adult, list, ''); }).filter(Boolean);
    if (lines.length === 0) lines = ['大火烹制、调味装盘。'];
    var dur = lines.reduce(function (sum, t) { return sum + estimateMinutes(t); }, 0) || 10;
    steps.push({
      id: id++,
      title: '步骤 ' + stepNum + '：' + tasteLabel + ' - ' + dishName,
      details: lines,
      role: 'adult',
      completed: false,
      duration: dur
    });
    stepNum++;
  });

  return steps;
}

/*
 * 2荤1素 步骤模拟（验证排序）：
 * 假设 menus = [
 *   { taste: 'slow_stew',  adultRecipe: { name: '栗子焖鸡', ... }, babyRecipe: null },
 *   { taste: 'steamed_salad', adultRecipe: { name: '蒜香蒸排骨', ... }, babyRecipe: null },
 *   { taste: 'quick_stir_fry', adultRecipe: { name: '手撕包菜', ... }, babyRecipe: null }
 * ]
 * 输出步骤顺序：
 *   步骤 1：全局备菜 — 准备好 鸡腿(300g)、排骨(300g)、包菜(400g)、板栗(100g)、姜片 适量、… 并切配。
 *   步骤 2：暖心炖煮 - 栗子焖鸡（先下锅，炖约 1 小时）
 *   步骤 3：精选蒸/拌 - 蒜香蒸排骨（炖菜进行到一半时启动蒸锅）
 *   步骤 4：快手小炒 - 手撕包菜（最后下锅，保证锅气）
 * 排序正确：slow_stew → steamed_salad → quick_stir_fry，上菜时均为热的。
 */

function getIngredientNames(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function (it) { return typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : '')); }).filter(Boolean);
}

/** 摊平并合并成人/宝宝食材，不按 category 或 meat 过滤，鱼虾等一律进入清单 */
function generateShoppingListRaw(adultRecipe, babyRecipe) {
  var items = [];
  function add(list, isFromBaby) {
    if (!Array.isArray(list)) return;
    list.forEach(function (it) {
      var name = typeof it === 'string' ? it : (it && (it.name != null ? it.name : it.ingredient != null ? it.ingredient : ''));
      if (!name) return;
      var category = (typeof it === 'object' && it != null && it.category != null) ? String(it.category).trim() : '其他';
      if (category === '海鲜' || category === '鱼类' || category === 'seafood') category = '肉类';
      var subType = (category === '肉类' && typeof it === 'object' && it != null && it.sub_type != null) ? it.sub_type : undefined;
      // 优先使用缩放后的用量（scaledAmount），否则使用原始 baseAmount
      var baseAmount = getScaledAmount(it);
      if (baseAmount === 0 && typeof it === 'object' && it != null && typeof it.baseAmount === 'number') {
        baseAmount = it.baseAmount;
      }
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

// ============ Logic 层：Dashboard、套餐选项（页面只做 UI 绑定） ============
var logicDashboard = require('../logic/dashboard.js');
var logicCombo = require('../logic/comboOptions.js');

/** 【接口人】看板计算 - 纯函数：输入 (menus, pref)，输出 dashboard 对象。不调用 wx / this。 */
var computeDashboard = logicDashboard.computePreviewDashboard;

// ============ 降级提示：将内部原因码转为用户友好消息 ============
var FALLBACK_REASON_MESSAGES = {
  'taste_meat_empty': '当前口味与主料组合无精准匹配，已为您推荐相近菜品',
  'preference_filter_empty': '当前忌口设置较严格，部分菜品已放宽筛选',
  'flavor_filter_empty': '当前口味偏好下菜品较少，已为您扩展推荐范围',
  'all_filters_empty': '当前条件下无完全匹配菜品，已为您智能推荐'
};

/**
 * 将降级原因码转为用户友好提示
 * @param {String|String[]} reasons - 单个原因码或原因码数组
 * @returns {String} 用户友好的提示消息，无降级时返回空字符串
 */
function getFallbackMessage(reasons) {
  if (!reasons) return '';
  var arr = Array.isArray(reasons) ? reasons : [reasons];
  var uniqueReasons = [];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] && uniqueReasons.indexOf(arr[i]) === -1) uniqueReasons.push(arr[i]);
  }
  if (uniqueReasons.length === 0) return '';
  // 优先返回最严重的降级提示
  var priorityOrder = ['all_filters_empty', 'preference_filter_empty', 'flavor_filter_empty', 'taste_meat_empty'];
  for (var p = 0; p < priorityOrder.length; p++) {
    if (uniqueReasons.indexOf(priorityOrder[p]) !== -1) {
      return FALLBACK_REASON_MESSAGES[priorityOrder[p]] || '';
    }
  }
  return FALLBACK_REASON_MESSAGES[uniqueReasons[0]] || '';
}

// ============ 从 menuData 提取的纯计算函数 ============

/** 从菜谱列表中筛出汤品，优先使用 dish_type 字段判断，兼容名称检测 */
function getSoupRecipes(adultRecipes) {
  if (!Array.isArray(adultRecipes)) return [];
  var out = [];
  for (var i = 0; i < adultRecipes.length; i++) {
    var r = adultRecipes[i];
    if (r.dish_type === 'soup' || (r.name && r.name.indexOf('汤') !== -1)) out.push(r);
  }
  return out;
}

/** 统计套餐内口味和做法数量 */
function getFlavorAndCookCounts(menus) {
  var spicy = 0, savory = 0, stirFry = 0, stew = 0;
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

module.exports = {
  // ---------- 接口人（页面必须通过 require 引入并使用） ----------
  filterByPreference: filterByPreference,
  calculateScaling: calculateScaling,
  computeDashboard: computeDashboard,
  normalizeUserPreference: normalizeUserPreference,
  getFallbackMessage: getFallbackMessage,
  // ---------- 原有导出（兼容与内部使用） ----------
  generateMenu: generateMenu,
  generateMenuFromRecipe: generateMenuFromRecipe,
  generateMenuWithFilters: generateMenuWithFilters,
  getBabyVariantByAge: getBabyVariantByAge,
  checkFlavorBalance: checkFlavorBalance,
  generateSteps: generateSteps,
  generateUnifiedSteps: generateUnifiedSteps,
  generateExplanation: generateExplanation,
  generateShoppingList: generateShoppingListRaw,
  formatSeasoningAmountForDisplay: formatSeasoningAmountForDisplay,
  replaceVagueSeasoningInText: replaceVagueSeasoningInText,
  preFilter: preFilter,
  pickOneWithStewBalance: pickOneWithStewBalance,
  dynamicScaling: dynamicScaling,
  filterRecipePool: filterRecipePool,
  balanceFilterPool: balanceFilterPool,
  scaleRecipeIngredients: scaleRecipeIngredients,
  recipeContainsAvoid: recipeContainsAvoid,
  recipeDietScore: recipeDietScore,
  countCookMethod: countCookMethod,
  getScaledAmount: getScaledAmount,
  computePreviewDashboard: logicDashboard.computePreviewDashboard,
  computeBalanceTip: logicDashboard.computeBalanceTip,
  menusToPreviewRows: logicDashboard.menusToPreviewRows,
  getComboOptionsForCount: logicCombo.getComboOptionsForCount,
  findComboInList: logicCombo.findComboInList,
  // ---------- 从 menuData 提取的统计函数 ----------
  getSoupRecipes: getSoupRecipes,
  getFlavorAndCookCounts: getFlavorAndCookCounts,
  getFlavorProfileCounts: getFlavorProfileCounts
};
