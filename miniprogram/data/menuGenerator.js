/**
 * 菜单与步骤生成逻辑（微信小程序版 - CommonJS）
 * 
 * 三层统筹架构：
 * 1. 过滤层：根据 userPreference 剔除忌口食材和不符合偏好的菜品
 * 2. 均衡层：做法去重，stew 类菜品不超过 1 个
 * 3. 缩放层：根据 adultCount 和 base_serving 动态计算食材用量
 */
var recipes = require('./recipes.js');
var adultRecipes = recipes.adultRecipes;
var babyRecipes = recipes.babyRecipes;

var MEAT_LABEL = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鳕鱼', shrimp: '虾仁', vegetable: '素菜' };
var MEAT_KEY_MAP = { 鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp', 素菜: 'vegetable', chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp', vegetable: 'vegetable' };

/**
 * ============ 第一层：过滤层（忌口 + 偏好） ============
 */

/** 忌口类型 → 需排除的食材关键词 / meat 类型 */
var AVOID_INGREDIENT_MAP = {
  seafood: { meats: ['fish', 'shrimp'], keywords: ['鳕鱼', '鲈鱼', '虾', '虾仁', '鲜虾', '海鲜', '蟹', '贝'] },
  spicy: { meats: [], keywords: ['辣椒', '干辣椒', '小米椒', '花椒', '豆瓣', '泡椒'], flavorExclude: ['spicy'] },
  beef_lamb: { meats: ['beef'], keywords: ['牛肉', '牛腩', '牛柳', '牛里脊', '羊肉', '羊肉片'] },
  egg: { meats: [], keywords: ['鸡蛋', '蛋'] },
  soy: { meats: [], keywords: ['豆腐', '嫩豆腐', '豆豉', '豆瓣', '大豆'] }
};

/** 饮食偏好 → 筛选条件 */
var DIET_STYLE_FILTERS = {
  light: { preferFlavors: ['light', 'sour_fresh'], preferCookMethods: ['steam', 'cold_dress'] },
  hearty: { preferFlavors: ['salty_umami', 'spicy', 'sweet_sour'], preferCookMethods: ['stir_fry', 'stew'] },
  quick: { preferCookMethods: ['stir_fry', 'cold_dress'], maxCookMinutes: 25 }
};

/**
 * 检测菜谱是否包含忌口食材
 * @param {Object} recipe - 菜谱对象
 * @param {Array} avoidList - 忌口列表，如 ['seafood', 'spicy']
 * @returns {boolean} true=包含忌口，应排除
 */
function recipeContainsAvoid(recipe, avoidList) {
  if (!recipe || !Array.isArray(avoidList) || avoidList.length === 0) return false;
  
  for (var i = 0; i < avoidList.length; i++) {
    var avoidKey = avoidList[i];
    var rule = AVOID_INGREDIENT_MAP[avoidKey];
    if (!rule) continue;
    
    // 检查 meat 类型
    if (rule.meats && rule.meats.length > 0) {
      if (rule.meats.indexOf(recipe.meat) !== -1) return true;
    }
    
    // 检查 flavor_profile
    if (rule.flavorExclude && rule.flavorExclude.length > 0) {
      if (rule.flavorExclude.indexOf(recipe.flavor_profile) !== -1) return true;
    }
    
    // 检查食材关键词
    if (rule.keywords && rule.keywords.length > 0 && Array.isArray(recipe.ingredients)) {
      for (var j = 0; j < recipe.ingredients.length; j++) {
        var ing = recipe.ingredients[j];
        var ingName = (ing && ing.name) ? String(ing.name) : '';
        for (var k = 0; k < rule.keywords.length; k++) {
          if (ingName.indexOf(rule.keywords[k]) !== -1) return true;
        }
      }
    }
  }
  return false;
}

/**
 * 检测菜谱是否符合饮食偏好
 * @param {Object} recipe - 菜谱对象
 * @param {String} dietStyle - 饮食偏好：light | hearty | quick
 * @param {boolean} isTimeSave - 是否启用省时模式
 * @returns {number} 匹配分数，越高越优先
 */
function recipeDietScore(recipe, dietStyle, isTimeSave) {
  if (!recipe) return 0;
  var score = 10; // 基础分
  
  // 省时模式：优先 quick 标签或短时间菜谱
  if (isTimeSave) {
    var tags = recipe.tags || [];
    if (tags.indexOf('quick') !== -1) score += 20;
    var cookMins = recipe.cook_minutes || 15;
    var prepTime = recipe.prep_time || 10;
    if (cookMins + prepTime <= 25) score += 15;
    else if (cookMins + prepTime >= 45) score -= 10;
  }
  
  // 饮食偏好筛选
  if (dietStyle && DIET_STYLE_FILTERS[dietStyle]) {
    var filter = DIET_STYLE_FILTERS[dietStyle];
    
    // 口味偏好
    if (filter.preferFlavors && filter.preferFlavors.length > 0) {
      if (filter.preferFlavors.indexOf(recipe.flavor_profile) !== -1) score += 15;
    }
    
    // 烹饪方式偏好
    if (filter.preferCookMethods && filter.preferCookMethods.length > 0) {
      var cookMethod = recipe.cook_method || recipe.cook_type || 'stir_fry';
      if (filter.preferCookMethods.indexOf(cookMethod) !== -1) score += 10;
    }
    
    // 时间限制
    if (filter.maxCookMinutes) {
      var totalTime = (recipe.cook_minutes || 15) + (recipe.prep_time || 10);
      if (totalTime <= filter.maxCookMinutes) score += 10;
      else score -= 5;
    }
  }
  
  return score;
}

/**
 * 过滤层主函数：根据 userPreference 过滤菜谱池
 * @param {Array} pool - 原始菜谱池
 * @param {Object} userPreference - { avoidList, dietStyle, is_time_save }
 * @returns {Array} 过滤后的菜谱池（按匹配度排序）
 */
function filterRecipePool(pool, userPreference) {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  if (!userPreference) return pool;
  
  var avoidList = userPreference.avoidList || [];
  var dietStyle = userPreference.dietStyle || '';
  var isTimeSave = userPreference.is_time_save === true;
  
  // 第一步：排除忌口
  var filtered = pool.filter(function (r) {
    return !recipeContainsAvoid(r, avoidList);
  });
  
  // 如果过滤后为空，返回原池（避免无菜可选）
  if (filtered.length === 0) filtered = pool.slice();
  
  // 第二步：按偏好打分排序
  if (dietStyle || isTimeSave) {
    filtered.sort(function (a, b) {
      var scoreA = recipeDietScore(a, dietStyle, isTimeSave);
      var scoreB = recipeDietScore(b, dietStyle, isTimeSave);
      return scoreB - scoreA; // 高分优先
    });
  }
  
  return filtered;
}

/**
 * ============ 第二层：均衡层（做法去重） ============
 */

/**
 * 检查菜单中某种烹饪方式的数量
 * @param {Array} menus - 已选菜单数组
 * @param {String} cookMethod - 烹饪方式
 * @returns {number} 数量
 */
function countCookMethod(menus, cookMethod) {
  if (!Array.isArray(menus)) return 0;
  var count = 0;
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (r) {
      var method = r.cook_method || r.cook_type || 'stir_fry';
      if (method === cookMethod) count++;
    }
  }
  return count;
}

/**
 * 均衡层过滤：从池中排除会导致做法冲突的菜谱
 * @param {Array} pool - 菜谱池
 * @param {Array} existingMenus - 已选菜单
 * @param {Object} constraints - { maxStew: 1 }
 * @returns {Array} 过滤后的菜谱池
 */
function balanceFilterPool(pool, existingMenus, constraints) {
  if (!Array.isArray(pool) || pool.length === 0) return pool;
  constraints = constraints || { maxStew: 1 };
  
  var currentStew = countCookMethod(existingMenus, 'stew');
  
  // 如果炖菜已达上限，排除新的炖菜
  if (currentStew >= (constraints.maxStew || 1)) {
    var filtered = pool.filter(function (r) {
      var method = r.cook_method || r.cook_type || 'stir_fry';
      return method !== 'stew';
    });
    // 如果过滤后为空，返回原池
    if (filtered.length > 0) return filtered;
  }
  
  return pool;
}

/**
 * ============ 第三层：缩放层（食材用量计算） ============
 */

/**
 * 根据人数和基准份量缩放食材用量
 * @param {Object} recipe - 菜谱对象（将被修改）
 * @param {number} adultCount - 实际用餐人数
 * @returns {Object} 缩放后的菜谱
 */
function scaleRecipeIngredients(recipe, adultCount) {
  if (!recipe || !Array.isArray(recipe.ingredients)) return recipe;
  
  var baseServing = recipe.base_serving || 2;
  var totalCount = Math.max(1, Number(adultCount) || 2);
  var scaleFactor = totalCount / baseServing;
  
  // 克隆 ingredients 避免污染原数据
  recipe.ingredients = recipe.ingredients.map(function (ing) {
    var newIng = {};
    for (var k in ing) {
      if (ing.hasOwnProperty(k)) newIng[k] = ing[k];
    }
    
    // 调料类不缩放
    if (newIng.category === '调料' || newIng.baseAmount === 0 || newIng.unit === '适量') {
      return newIng;
    }
    
    // 计算缩放后的用量
    if (typeof newIng.baseAmount === 'number') {
      var scaled = newIng.baseAmount * scaleFactor;
      // 保留合理精度
      newIng.scaledAmount = Math.round(scaled * 10) / 10;
    }
    
    return newIng;
  });
  
  return recipe;
}

/**
 * 从食材中获取实际用量（优先使用缩放后的值）
 * @param {Object} ingredient - 食材对象
 * @returns {number|string} 用量
 */
function getScaledAmount(ingredient) {
  if (!ingredient) return 0;
  if (ingredient.scaledAmount != null) return ingredient.scaledAmount;
  if (ingredient.baseAmount != null) return ingredient.baseAmount;
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
function getAdultPool(taste, meatKey, userPreference, existingMenus) {
  // 基础缓存 key（不含动态过滤）
  var baseKey = (taste || '') + '_' + (meatKey || '');
  
  // 获取基础池
  var basePool;
  if (!_adultPoolCache[baseKey]) {
    var arr = adultRecipes.filter(function (r) { return r.taste === taste && r.meat === meatKey; });
    if (meatKey === 'vegetable' && arr.length === 0) arr = adultRecipes.filter(function (r) { return r.meat === 'vegetable'; });
    if (arr.length === 0) arr = adultRecipes;
    _adultPoolCache[baseKey] = arr;
  }
  basePool = _adultPoolCache[baseKey].slice();
  
  // 应用三层过滤
  // 第一层：过滤层（忌口 + 偏好）
  var filtered = filterRecipePool(basePool, userPreference);
  
  // 第二层：均衡层（做法去重）
  filtered = balanceFilterPool(filtered, existingMenus, { maxStew: 1 });
  
  return filtered.length > 0 ? filtered : basePool;
}

/**
 * 生成菜单 - 集成三层统筹架构
 * @param {String} taste - 口味类型
 * @param {String} meat - 肉类类型
 * @param {number} babyMonth - 宝宝月龄
 * @param {boolean} hasBaby - 是否有宝宝
 * @param {number} adultCount - 大人人数
 * @param {String} babyTaste - 宝宝口味
 * @param {Object} userPreference - 用户偏好 { avoidList, dietStyle, is_time_save }
 * @param {Array} existingMenus - 已选菜单（用于均衡层）
 */
function generateMenu(taste, meat, babyMonth, hasBaby, adultCount, babyTaste, userPreference, existingMenus) {
  adultCount = adultCount == null ? 2 : adultCount;
  var meatKey = normalizeMeat(meat);
  var m = Math.min(36, Math.max(6, Number(babyMonth) || 6));
  var config = getBabyConfig(m);
  var validBabyTastes = ['soft_porridge', 'finger_food', 'braised_mash'];
  var babyTasteKey = (babyTaste && validBabyTastes.indexOf(babyTaste) !== -1) ? babyTaste : 'soft_porridge';

  // 获取过滤后的菜谱池
  var aPool = getAdultPool(taste, meatKey, userPreference, existingMenus);
  var fallbackPool = aPool.length > 0 ? aPool : adultRecipes;
  
  // 随机选择（已按偏好排序，前几个更优先）
  var pickIndex = Math.floor(Math.random() * Math.min(fallbackPool.length, Math.max(3, Math.ceil(fallbackPool.length * 0.5))));
  var adultRaw = fallbackPool[pickIndex] || fallbackPool[0];
  var adult = adultRaw ? copyAdultRecipe(adultRaw) : null;
  
  // 第三层：缩放层 - 根据人数缩放食材
  if (adult) {
    adult = scaleRecipeIngredients(adult, adultCount);
  }

  var baby = null;
  if (meatKey !== 'vegetable') {
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
  }
  if (meatKey !== 'vegetable' && hasBaby) {
    rawBaby = rawBaby || babyRecipes[0];
    if (rawBaby) {
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

  return { adultRecipe: adult, babyRecipe: baby };
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
  
  // 第三层：缩放层 - 根据人数缩放食材
  if (adult) {
    adult = scaleRecipeIngredients(adult, adultCount);
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
    var bPool = babyRecipes.filter(function (r) {
      return r.meat === meatKey && (r.taste === babyTasteKey || (r.taste == null && babyTasteKey === 'soft_porridge'));
    });
    if (bPool.length === 0) bPool = babyRecipes.filter(function (r) { return r.meat === meatKey; });
    var rawBaby = (bPool.length > 0 ? bPool : babyRecipes)[Math.floor(Math.random() * (bPool.length || babyRecipes.length))];
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

/** 口味互补检测：已选菜中辣/咸过多则建议补位用清淡；已有长耗时炖菜则建议补位用快手炒 */
function checkFlavorBalance(menus) {
  if (!Array.isArray(menus) || menus.length === 0) return { preferredFlavor: null, preferQuick: false };
  var strongCount = 0;
  var hasLongCook = false;
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (!r) continue;
    var f = r.flavor_profile || '';
    if (f === 'spicy' || f === 'salty_umami') strongCount++;
    if ((r.cook_type || '') === 'stew') hasLongCook = true;
  }
  var preferredFlavor = strongCount > menus.length / 2 ? 'light' : null;
  var preferQuick = hasLongCook;
  return { preferredFlavor: preferredFlavor, preferQuick: preferQuick };
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
 * 按口味/烹饪方式/共用食材筛选补位：meat + filters(preferredFlavor, preferQuick, preferredIngredients)
 * 支持三层统筹架构
 * @param {Object} filters.userPreference - 用户偏好 { avoidList, dietStyle, is_time_save }
 * @param {Array} filters.existingMenus - 已选菜单（用于均衡层）
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

  var aPool = adultRecipes.filter(function (r) { return r.meat === meatKey; });
  if (meatKey === 'vegetable' && aPool.length === 0) aPool = adultRecipes.filter(function (r) { return r.meat === 'vegetable'; });
  
  // 第一层：过滤层（忌口 + 偏好）
  aPool = filterRecipePool(aPool, userPreference);
  
  // 第二层：均衡层（做法去重）
  aPool = balanceFilterPool(aPool, existingMenus, { maxStew: 1 });
  
  if (preferredFlavor === 'light') aPool = aPool.filter(function (r) { var f = r.flavor_profile || ''; return f === 'light' || f === 'sour_fresh'; });
  else if (preferredFlavor) aPool = aPool.filter(function (r) { return (r.flavor_profile || '') === preferredFlavor; });
  if (preferQuick && aPool.length > 0) {
    var quickPool = aPool.filter(function (r) { return (r.cook_type || '') === 'stir_fry'; });
    if (quickPool.length > 0) aPool = quickPool;
  }
  if (preferredIngredients && preferredIngredients.length > 0 && aPool.length > 0) {
    var overlapPool = aPool.filter(function (r) { return recipeUsesAnyIngredient(r, preferredIngredients); });
    if (overlapPool.length > 0) aPool = overlapPool;
  }
  if (aPool.length === 0) aPool = adultRecipes.filter(function (r) { return r.meat === meatKey; });
  if (aPool.length === 0 && meatKey === 'vegetable') aPool = adultRecipes.filter(function (r) { return r.meat === 'vegetable'; });

  var adultRaw = aPool[Math.floor(Math.random() * (aPool.length || 1))];
  var adult = adultRaw ? copyAdultRecipe(adultRaw) : null;
  
  // 第三层：缩放层 - 根据人数缩放食材
  if (adult) {
    adult = scaleRecipeIngredients(adult, adultCount);
  }

  var baby = null;
  if (meatKey !== 'vegetable') {
    var bPool = babyRecipes.filter(function (r) {
      return r.meat === meatKey && (r.taste === babyTasteKey || (r.taste == null && babyTasteKey === 'soft_porridge'));
    });
    if (bPool.length === 0) bPool = babyRecipes.filter(function (r) { return r.meat === meatKey; });
    var rawBaby = (meatKey === 'fish') ? (bPool.find(function (r) { return r.id === 'b-fish-detail'; }) || bPool[0] || babyRecipes[0])
      : ((bPool.length > 0 ? bPool : babyRecipes)[Math.floor(Math.random() * (bPool.length || babyRecipes.length))]);
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

module.exports = {
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
  // 三层统筹架构导出
  filterRecipePool: filterRecipePool,
  balanceFilterPool: balanceFilterPool,
  scaleRecipeIngredients: scaleRecipeIngredients,
  recipeContainsAvoid: recipeContainsAvoid,
  recipeDietScore: recipeDietScore,
  countCookMethod: countCookMethod,
  getScaledAmount: getScaledAmount
};
