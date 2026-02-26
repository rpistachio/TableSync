/**
 * Taste Profile — 用户口味档案数据层
 *
 * 职责：读写 localStorage、场景→菜品结构推导、口味/食材亲和度推导、
 *       urgentIngredient 单次消费机制。
 *
 * Storage key: 'taste_profile'
 * 与 today_menus_preference（单次会话偏好）共存，本模块管理长期画像。
 */

var STORAGE_KEY = 'taste_profile';
var RECIPE_COOK_LOG_KEY = 'recipe_cook_log';
var MAX_RECIPE_HISTORY = 5;

/** 场景 → 菜品结构映射（黄金配比）*/
var SCENE_CONFIGS = {
  solo:      { adultCount: 1, meatCount: 1, vegCount: 1, soupCount: 0, hasBaby: false },
  couple:    { adultCount: 2, meatCount: 1, vegCount: 1, soupCount: 0, hasBaby: false },
  family:    { adultCount: 3, meatCount: 2, vegCount: 1, soupCount: 0, hasBaby: false },
  gathering: { adultCount: 4, meatCount: 2, vegCount: 2, soupCount: 1, hasBaby: false }
};

/** 口味亲和度 key → dietStyle 映射（取最高亲和度） */
var FLAVOR_TO_DIET = {
  light: 'light',
  spicy: 'rich',
  sour_fresh: 'light',
  salty_umami: 'home',
  sweet_sour: 'home'
};

/** 食材亲和度 key → meat 枚举映射 */
var INGREDIENT_TO_MEAT = {
  seafood: ['fish', 'shrimp', 'shellfish'],
  beef: ['beef'],
  chicken: ['chicken'],
  pork: ['pork'],
  lamb: ['lamb'],
  duck: ['duck'],
  vegetable: ['vegetable']
};

/** 库存急用 → 中文确认文案 */
var URGENT_LABELS = {
  meat: '先消灭冰箱里的肉',
  vegetable: '先把菜用掉',
  seafood: '海鲜不能放了'
};

function createEmpty() {
  var now = _dateKey();
  return {
    scene: null,
    headcount: 2,
    flavorAffinity: {},
    ingredientAffinity: {},
    avoidList: [],
    constraintDone: false,
    urgentIngredient: null,
    kitchenConfig: {
      burners: 2,
      hasSteamer: false,
      hasAirFryer: false,
      hasOven: false,
      hasRiceCooker: false,
      hasMicrowave: false
    },
    createdAt: now,
    lastProbeAt: null,
    lastDecayAt: null,
    dislikedRecipes: [],
    totalCooks: 0,
    visitCount: 0,
    version: 1
  };
}

function _dateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

/**
 * 读取完整档案，缺失则返回空档案
 * @returns {Object}
 */
function get() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === 'object') {
      return raw;
    }
    if (typeof raw === 'string' && raw) {
      return JSON.parse(raw);
    }
  } catch (e) { /* ignore */ }
  return createEmpty();
}

/**
 * 写入完整档案
 * @param {Object} profile
 */
function save(profile) {
  try {
    wx.setStorageSync(STORAGE_KEY, profile);
  } catch (e) { /* ignore */ }
}

/**
 * 合并更新部分字段
 * @param {Object} patch - 需要更新的字段
 * @returns {Object} 更新后的完整档案
 */
function update(patch) {
  var profile = get();
  for (var key in patch) {
    if (patch.hasOwnProperty(key)) {
      profile[key] = patch[key];
    }
  }
  profile.lastProbeAt = _dateKey();
  save(profile);
  return profile;
}

/**
 * 递增访问计数
 * @returns {number} 更新后的 visitCount
 */
function incrementVisit() {
  var profile = get();
  profile.visitCount = (profile.visitCount || 0) + 1;
  save(profile);
  return profile.visitCount;
}

/**
 * 判断是否首次使用（无 scene 且 visitCount <= 1）
 * @returns {boolean}
 */
function isFirstVisit() {
  var profile = get();
  return !profile.scene && (profile.visitCount || 0) <= 1;
}

// ============ 场景相关 ============

/**
 * 设置场景并自动推导 headcount（volatile，不写 lastProbeAt）
 * @param {string} scene - 'solo'|'couple'|'family'|'gathering'
 * @returns {Object} 更新后的档案
 */
function setScene(scene) {
  var config = SCENE_CONFIGS[scene] || SCENE_CONFIGS.couple;
  var profile = get();
  profile.scene = scene;
  profile.headcount = config.adultCount;
  save(profile);
  return profile;
}

/**
 * 获取当前场景配置
 * @returns {Object} { adultCount, meatCount, vegCount, soupCount, hasBaby }
 */
function getSceneConfig() {
  var profile = get();
  return SCENE_CONFIGS[profile.scene] || SCENE_CONFIGS.couple;
}

// ============ 口味亲和度 ============

/**
 * 口味投票：累加亲和度
 * @param {string} flavorKey - 'light'|'spicy'|'sour_fresh'|'salty_umami'|'sweet_sour'
 */
function voteFlavorAffinity(flavorKey) {
  var profile = get();
  if (!profile.flavorAffinity) profile.flavorAffinity = {};
  profile.flavorAffinity[flavorKey] = (profile.flavorAffinity[flavorKey] || 0) + 1;
  profile.lastProbeAt = _dateKey();
  save(profile);
}

/**
 * 从口味亲和度推导 dietStyle
 * @param {Object} [affinity] - 可选，默认从档案读取
 * @returns {string} 'home'|'light'|'rich'|'quick'
 */
function inferDietStyle(affinity) {
  var aff = affinity || get().flavorAffinity || {};
  var maxKey = null;
  var maxVal = 0;
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > maxVal) {
      maxVal = aff[k];
      maxKey = k;
    }
  }
  if (!maxKey) return 'home';
  return FLAVOR_TO_DIET[maxKey] || 'home';
}

/**
 * 生成口味亲和度的自然语言提示（供 AI prompt 注入）
 * @param {Object} [affinity]
 * @returns {string} 如 "偏好辣味、清淡"，空则返回 ''
 */
function getFlavorHint(affinity) {
  var aff = affinity || get().flavorAffinity || {};
  var LABELS = { light: '清淡', spicy: '辣味', sour_fresh: '酸爽', salty_umami: '咸鲜', sweet_sour: '酸甜' };
  var sorted = [];
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > 0) {
      sorted.push({ key: k, val: aff[k] });
    }
  }
  if (sorted.length === 0) return '';
  sorted.sort(function (a, b) { return b.val - a.val; });
  var top = sorted.slice(0, 2).map(function (item) {
    return (LABELS[item.key] || item.key) + '(' + item.val + '次)';
  });
  return '偏好' + top.join('、');
}

/**
 * 返回亲和度最高的口味 key（用于语义对齐）
 * @param {Object} [affinity]
 * @returns {string|null}
 */
function getTopFlavorKey(affinity) {
  var aff = affinity || get().flavorAffinity || {};
  var topKey = null;
  var topVal = 0;
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > topVal) {
      topVal = aff[k];
      topKey = k;
    }
  }
  return topKey;
}

/**
 * 返回前两名口味及是否模糊（第二名得分 >= 第一名 70%）
 * @param {Object} [affinity]
 * @returns {{ top: string|null, second: string|null, ambiguous: boolean }}
 */
function getTopFlavors(affinity) {
  var aff = affinity || get().flavorAffinity || {};
  var sorted = [];
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > 0) {
      sorted.push({ key: k, val: aff[k] });
    }
  }
  if (sorted.length === 0) return { top: null, second: null, ambiguous: false };
  sorted.sort(function (a, b) { return b.val - a.val; });
  var top = sorted[0];
  var second = sorted.length > 1 ? sorted[1] : null;
  var ambiguous = second && top.val > 0 && (second.val / top.val) >= 0.7;
  return {
    top: top.key,
    second: second ? second.key : null,
    ambiguous: !!ambiguous
  };
}

// ============ 食材亲和度 ============

/**
 * 食材投票
 * @param {string} ingredientKey - 'seafood'|'beef'|'chicken'|'pork'|'vegetable'
 */
function voteIngredientAffinity(ingredientKey) {
  var profile = get();
  if (!profile.ingredientAffinity) profile.ingredientAffinity = {};
  profile.ingredientAffinity[ingredientKey] = (profile.ingredientAffinity[ingredientKey] || 0) + 1;
  profile.lastProbeAt = _dateKey();
  save(profile);
}

/**
 * 从食材亲和度推导推荐主料列表
 * @param {Object} [affinity]
 * @returns {Array<string>} 如 ['beef', 'chicken']
 */
function inferPreferredMeats(affinity) {
  var aff = affinity || get().ingredientAffinity || {};
  var sorted = [];
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > 0) {
      sorted.push({ key: k, val: aff[k] });
    }
  }
  if (sorted.length === 0) return [];
  sorted.sort(function (a, b) { return b.val - a.val; });
  var result = [];
  var top = sorted.slice(0, 2);
  for (var i = 0; i < top.length; i++) {
    var meats = INGREDIENT_TO_MEAT[top[i].key];
    if (meats) {
      for (var j = 0; j < meats.length; j++) {
        if (result.indexOf(meats[j]) === -1) result.push(meats[j]);
      }
    }
  }
  return result;
}

// ============ 衰减算法 ============

/** 衰减因子：每次触发时所有亲和度值乘以此系数 */
var DECAY_FACTOR = 0.85;
/** 衰减触发间隔（天）：两次衰减之间至少间隔 7 天 */
var DECAY_INTERVAL_DAYS = 7;

/**
 * 对所有亲和度值执行衰减（指数衰减），防止历史数据权重过高。
 * 每次进入首页时调用，但仅在距离上次衰减 >= DECAY_INTERVAL_DAYS 天时生效。
 * @returns {boolean} 是否实际执行了衰减
 */
function maybeDecay() {
  var profile = get();
  var today = _dateKey();
  var lastDecay = profile.lastDecayAt || profile.createdAt || '';
  if (!lastDecay) {
    profile.lastDecayAt = today;
    save(profile);
    return false;
  }
  var daysDiff = _daysBetween(lastDecay, today);
  if (daysDiff < DECAY_INTERVAL_DAYS) return false;

  _decayObject(profile.flavorAffinity);
  _decayObject(profile.ingredientAffinity);
  profile.lastDecayAt = today;
  save(profile);
  return true;
}

function _decayObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && typeof obj[k] === 'number') {
      obj[k] = Math.round(obj[k] * DECAY_FACTOR * 10) / 10;
      if (obj[k] < 0.5) obj[k] = 0;
    }
  }
}

function _daysBetween(dateStr1, dateStr2) {
  try {
    var d1 = new Date(dateStr1.replace(/-/g, '/'));
    var d2 = new Date(dateStr2.replace(/-/g, '/'));
    return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
  } catch (e) {
    return 0;
  }
}

// ============ 做完饭后隐式反馈 ============

/**
 * 记录一次烹饪完成，递增 totalCooks
 */
function recordCookComplete() {
  var profile = get();
  profile.totalCooks = (profile.totalCooks || 0) + 1;
  save(profile);
}

/**
 * 根据做饭后反馈更新亲和度
 * @param {string} feedback - 'like'|'ok'|'dislike'
 * @param {Array<Object>} recipes - 本次烹饪的菜谱数组 [{meat, flavor_profile, ...}]
 */
function applyPostCookFeedback(feedback, recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) return;
  var profile = get();
  if (!profile.flavorAffinity) profile.flavorAffinity = {};
  if (!profile.ingredientAffinity) profile.ingredientAffinity = {};

  var delta = 0;
  if (feedback === 'like') delta = 2;
  else if (feedback === 'ok') delta = 0;
  else if (feedback === 'dislike') delta = -1;

  if (delta === 0) {
    save(profile);
    return;
  }

  for (var i = 0; i < recipes.length; i++) {
    var r = recipes[i];
    if (r.flavor_profile && delta !== 0) {
      var fv = (profile.flavorAffinity[r.flavor_profile] || 0) + delta;
      profile.flavorAffinity[r.flavor_profile] = Math.max(0, fv);
    }
    if (r.meat && r.meat !== 'vegetable' && delta !== 0) {
      var meatKey = _meatToIngredientKey(r.meat);
      if (meatKey) {
        var iv = (profile.ingredientAffinity[meatKey] || 0) + delta;
        profile.ingredientAffinity[meatKey] = Math.max(0, iv);
      }
    }
    if (r.meat === 'vegetable' && delta !== 0) {
      var vv = (profile.ingredientAffinity.vegetable || 0) + delta;
      profile.ingredientAffinity.vegetable = Math.max(0, vv);
    }
  }

  profile.lastProbeAt = _dateKey();
  save(profile);

  // 同步写入 recipe_cook_log，供「做过的菜」Tab 展示与回溯
  var source = (arguments.length >= 3 && arguments[2]) ? arguments[2] : 'self';
  for (var j = 0; j < recipes.length; j++) {
    var rec = recipes[j];
    if (rec && rec.name) recordRecipeFeedback(rec.name, feedback, '', source);
  }
}

function _meatToIngredientKey(meat) {
  var map = { fish: 'seafood', shrimp: 'seafood', beef: 'beef', chicken: 'chicken', pork: 'pork' };
  return map[meat] || null;
}

// ============ recipe_cook_log（做过的菜 + 单菜反馈） ============

function _loadRecipeCookLogRaw() {
  try {
    var raw = wx.getStorageSync(RECIPE_COOK_LOG_KEY);
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function _saveRecipeCookLogRaw(obj) {
  try {
    wx.setStorageSync(RECIPE_COOK_LOG_KEY, JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 记录单次烹饪反馈到 recipe_cook_log（applyPostCookFeedback 内部调用，或 helper 完成时写入）
 * @param {string} recipeName - 菜名
 * @param {string} feedback - 'like'|'ok'|'dislike'
 * @param {string} note - 用户备注
 * @param {string} source - 'self'|'helper'
 */
function recordRecipeFeedback(recipeName, feedback, note, source) {
  if (!recipeName) return;
  var log = _loadRecipeCookLogRaw();
  var now = Date.now();
  var src = source === 'helper' ? 'helper' : 'self';
  var entry = log[recipeName];
  if (!entry) {
    entry = { count: 0, lastCookedAt: 0, lastFeedback: null, note: '', history: [] };
    log[recipeName] = entry;
  }
  entry.count = (entry.count || 0) + 1;
  entry.lastCookedAt = now;
  entry.lastFeedback = feedback;
  entry.note = typeof note === 'string' ? note : '';
  var histItem = { feedback: feedback, cookedAt: now, note: entry.note, source: src };
  if (!Array.isArray(entry.history)) entry.history = [];
  entry.history.unshift(histItem);
  if (entry.history.length > MAX_RECIPE_HISTORY) entry.history = entry.history.slice(0, MAX_RECIPE_HISTORY);
  _saveRecipeCookLogRaw(log);
}

/**
 * 获取做过的菜列表（按最近烹饪时间降序），供「做过的菜」Tab 使用
 * @returns {Array<{ name: string, count: number, lastCookedAt: number, lastFeedback: string|null, note: string, history: Array, lastSource: string }>}
 */
function getRecipeCookLog() {
  var log = _loadRecipeCookLogRaw();
  var list = [];
  for (var name in log) {
    if (!Object.prototype.hasOwnProperty.call(log, name)) continue;
    var e = log[name];
    list.push({
      name: name,
      count: e.count || 0,
      lastCookedAt: e.lastCookedAt || 0,
      lastFeedback: e.lastFeedback || null,
      note: e.note || '',
      history: Array.isArray(e.history) ? e.history : [],
      lastSource: (e.history && e.history[0]) ? e.history[0].source : 'self'
    });
  }
  list.sort(function (a, b) { return (b.lastCookedAt || 0) - (a.lastCookedAt || 0); });
  return list;
}

/**
 * 改评价：更新某道菜的 lastFeedback 和 note，并反向修正全局亲和度后应用新 delta
 * @param {string} recipeName - 菜名
 * @param {string} newFeedback - 'like'|'ok'|'dislike'
 * @param {string} newNote - 新备注
 * @param {Object} recipeInfo - { meat, flavor_profile } 用于亲和度修正
 */
function updateRecipeFeedback(recipeName, newFeedback, newNote, recipeInfo) {
  var log = _loadRecipeCookLogRaw();
  var entry = log[recipeName];
  if (!entry) return;
  var oldFeedback = entry.lastFeedback;
  entry.lastFeedback = newFeedback;
  entry.note = typeof newNote === 'string' ? newNote : '';
  if (Array.isArray(entry.history) && entry.history.length > 0) {
    entry.history[0].feedback = newFeedback;
    entry.history[0].note = entry.note;
  }
  _saveRecipeCookLogRaw(log);

  var profile = get();
  if (!profile.flavorAffinity) profile.flavorAffinity = {};
  if (!profile.ingredientAffinity) profile.ingredientAffinity = {};
  var recipe = recipeInfo || {};

  function deltaFor(fb) {
    if (fb === 'like') return 2;
    if (fb === 'dislike') return -1;
    return 0;
  }
  var oldDelta = deltaFor(oldFeedback);
  var newDelta = deltaFor(newFeedback);
  var diff = newDelta - oldDelta;
  if (diff === 0) {
    save(profile);
    return;
  }
  if (recipe.flavor_profile) {
    var fv = (profile.flavorAffinity[recipe.flavor_profile] || 0) + diff;
    profile.flavorAffinity[recipe.flavor_profile] = Math.max(0, fv);
  }
  var meatKey = recipe.meat ? _meatToIngredientKey(recipe.meat) : null;
  if (meatKey) {
    var iv = (profile.ingredientAffinity[meatKey] || 0) + diff;
    profile.ingredientAffinity[meatKey] = Math.max(0, iv);
  }
  if (recipe.meat === 'vegetable') {
    var vv = (profile.ingredientAffinity.vegetable || 0) + diff;
    profile.ingredientAffinity.vegetable = Math.max(0, vv);
  }
  profile.lastProbeAt = _dateKey();
  save(profile);
}

/**
 * 生成口味画像摘要（供烟火集展示）
 * @returns {Object} { topFlavors, topIngredients, totalCooks, avoidList }
 */
function getTastePortrait() {
  var profile = get();
  var FLAVOR_LABELS = { light: '清淡', spicy: '辣味', sour_fresh: '酸爽', salty_umami: '咸鲜', sweet_sour: '酸甜' };
  var INGREDIENT_LABELS = { seafood: '海鲜', beef: '牛羊', chicken: '鸡鸭', pork: '猪肉', vegetable: '素菜' };
  var AVOID_LABELS = { spicy: '辣', seafood: '海鲜', peanut: '花生', lactose: '乳糖', gluten: '麸质' };

  var topFlavors = _sortedEntries(profile.flavorAffinity, FLAVOR_LABELS);
  var topIngredients = _sortedEntries(profile.ingredientAffinity, INGREDIENT_LABELS);
  var avoidNames = (profile.avoidList || []).map(function (k) { return AVOID_LABELS[k] || k; });

  return {
    topFlavors: topFlavors,
    topIngredients: topIngredients,
    totalCooks: profile.totalCooks || 0,
    avoidList: avoidNames,
    hasData: topFlavors.length > 0 || topIngredients.length > 0
  };
}

function _sortedEntries(obj, labels) {
  if (!obj) return [];
  var arr = [];
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && obj[k] > 0) {
      arr.push({ key: k, label: labels[k] || k, value: obj[k] });
    }
  }
  arr.sort(function (a, b) { return b.value - a.value; });
  return arr.slice(0, 4);
}

// ============ 负面约束（dislikedRecipes） ============

var DISLIKE_TTL_DAYS = 30;

/**
 * 记录一道不喜欢的菜
 * @param {string} id - recipe ID
 * @param {string} reason - 'complex'|'ingredient'|'eaten'
 */
function addDislikedRecipe(id, reason) {
  if (!id) return;
  var profile = get();
  if (!Array.isArray(profile.dislikedRecipes)) profile.dislikedRecipes = [];
  for (var i = 0; i < profile.dislikedRecipes.length; i++) {
    if (profile.dislikedRecipes[i].id === id) {
      profile.dislikedRecipes[i].reason = reason;
      profile.dislikedRecipes[i].ts = Date.now();
      save(profile);
      return;
    }
  }
  profile.dislikedRecipes.push({ id: id, reason: reason, ts: Date.now() });
  save(profile);
}

/**
 * 返回 30 天内被标记的 recipe IDs
 * 同时清理过期记录
 * @returns {Array<string>}
 */
function getDislikedRecipeIds() {
  var profile = get();
  if (!Array.isArray(profile.dislikedRecipes)) return [];
  var cutoff = Date.now() - DISLIKE_TTL_DAYS * 86400000;
  var valid = [];
  var ids = [];
  for (var i = 0; i < profile.dislikedRecipes.length; i++) {
    var item = profile.dislikedRecipes[i];
    if (item.ts >= cutoff) {
      valid.push(item);
      ids.push(item.id);
    }
  }
  if (valid.length !== profile.dislikedRecipes.length) {
    profile.dislikedRecipes = valid;
    save(profile);
  }
  return ids;
}

/**
 * 返回 30 天内被标记的菜名（用于注入 prompt）
 * @param {Array<Object>} allRecipes - 所有菜谱（含 id + name）
 * @returns {Array<string>} 菜名数组
 */
function getDislikedRecipeNames(allRecipes) {
  var ids = getDislikedRecipeIds();
  if (ids.length === 0 || !Array.isArray(allRecipes)) return [];
  var idSet = {};
  for (var i = 0; i < ids.length; i++) idSet[ids[i]] = true;
  var names = [];
  for (var j = 0; j < allRecipes.length; j++) {
    var r = allRecipes[j];
    if (idSet[r.id] || idSet[r._id]) names.push(r.name);
  }
  return names;
}

// ============ 厨房配置 ============

/**
 * 通过探针设置厨房设备（多选 key 数组）
 * @param {Array<string>} deviceKeys - ['hasAirFryer', 'hasSteamer', 'hasOven'] 的子集
 */
function setKitchenDevices(deviceKeys) {
  var keys = Array.isArray(deviceKeys) ? deviceKeys : [];
  var kc = {
    burners: 2,
    hasAirFryer: keys.indexOf('hasAirFryer') !== -1,
    hasSteamer: keys.indexOf('hasSteamer') !== -1,
    hasOven: keys.indexOf('hasOven') !== -1,
    hasRiceCooker: keys.indexOf('hasRiceCooker') !== -1,
    hasMicrowave: keys.indexOf('hasMicrowave') !== -1
  };
  update({ kitchenConfig: kc });
}

/**
 * 生成食材亲和度的自然语言提示（供 AI prompt 注入）
 * @param {Object} [affinity]
 * @returns {string} 如 "偏好牛羊(5次)、海鲜(2次)"，空则返回 ''
 */
function getIngredientHint(affinity) {
  var aff = affinity || get().ingredientAffinity || {};
  var LABELS = { seafood: '海鲜', beef: '牛羊', chicken: '鸡鸭', pork: '猪肉', vegetable: '素菜' };
  var sorted = [];
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > 0) {
      sorted.push({ key: k, val: aff[k] });
    }
  }
  if (sorted.length === 0) return '';
  sorted.sort(function (a, b) { return b.val - a.val; });
  var top = sorted.slice(0, 2).map(function (item) {
    return (LABELS[item.key] || item.key) + '(' + item.val + '次)';
  });
  return '偏好' + top.join('、');
}

// ============ 约束（avoidList） ============

/**
 * 设置忌口列表
 * @param {Array<string>} list - ['spicy', 'seafood', ...]
 */
function setAvoidList(list) {
  update({ avoidList: Array.isArray(list) ? list : [] });
}

/**
 * 标记约束探针已完成（无论选忌口还是「都能吃」）
 */
function markConstraintDone() {
  update({ constraintDone: true });
}

/**
 * 标记食材探针已完成（无论选具体食材还是「都行」）
 */
function markIngredientDone() {
  update({ ingredientDone: true });
}

// ============ 库存急用（单次消费） ============

/**
 * 设置库存急用食材（volatile，不写 lastProbeAt）
 * @param {string|null} type - 'meat'|'vegetable'|'seafood'|null
 */
function setUrgent(type) {
  var profile = get();
  profile.urgentIngredient = type || null;
  save(profile);
}

/**
 * 消费并清除 urgentIngredient（调用一次后归零）
 * @returns {string|null} 被消费的值
 */
function consumeUrgent() {
  var profile = get();
  var val = profile.urgentIngredient || null;
  if (val) {
    profile.urgentIngredient = null;
    save(profile);
  }
  return val;
}

/**
 * 获取库存急用的中文确认文案
 * @param {string} type
 * @returns {string}
 */
function getUrgentLabel(type) {
  return URGENT_LABELS[type] || '';
}

// ============ 今日主角食材 (Hero Ingredient) ============

var SEASONAL_INGREDIENTS = {
  1:  ['白萝卜', '大白菜', '羊肉'],
  2:  ['菠菜', '韭菜', '鲈鱼'],
  3:  ['春笋', '荠菜', '鲫鱼'],
  4:  ['豌豆', '蚕豆', '鲳鱼'],
  5:  ['黄瓜', '番茄', '小龙虾'],
  6:  ['茄子', '丝瓜', '基围虾'],
  7:  ['冬瓜', '豆角', '鳝鱼'],
  8:  ['莲藕', '毛豆', '鲈鱼'],
  9:  ['芋头', '南瓜', '大闸蟹'],
  10: ['山药', '板栗', '花蛤'],
  11: ['白萝卜', '花菜', '带鱼'],
  12: ['冬笋', '大白菜', '羊肉']
};

/**
 * 选取今日主角食材：冰箱临期 > 时令 > 用户高频偏好
 * @param {Array<string>} fridgeExpiringNames
 * @returns {string|null}
 */
function pickHeroIngredient(fridgeExpiringNames) {
  if (Array.isArray(fridgeExpiringNames) && fridgeExpiringNames.length > 0) {
    return fridgeExpiringNames[0];
  }
  var month = new Date().getMonth() + 1;
  var seasonal = SEASONAL_INGREDIENTS[month] || [];
  if (seasonal.length > 0) {
    var dayOfMonth = new Date().getDate();
    return seasonal[dayOfMonth % seasonal.length];
  }
  var profile = get();
  var aff = profile.ingredientAffinity || {};
  var LABELS = { seafood: '海鲜', beef: '牛肉', chicken: '鸡肉', pork: '猪肉', vegetable: '时蔬' };
  var topKey = null;
  var topVal = 0;
  for (var k in aff) {
    if (aff.hasOwnProperty(k) && aff[k] > topVal) {
      topVal = aff[k];
      topKey = k;
    }
  }
  return topKey ? (LABELS[topKey] || null) : null;
}

// ============ 导出 ============

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  SCENE_CONFIGS: SCENE_CONFIGS,
  get: get,
  save: save,
  update: update,
  createEmpty: createEmpty,
  incrementVisit: incrementVisit,
  isFirstVisit: isFirstVisit,
  setScene: setScene,
  getSceneConfig: getSceneConfig,
  voteFlavorAffinity: voteFlavorAffinity,
  inferDietStyle: inferDietStyle,
  getFlavorHint: getFlavorHint,
  getTopFlavorKey: getTopFlavorKey,
  getTopFlavors: getTopFlavors,
  voteIngredientAffinity: voteIngredientAffinity,
  inferPreferredMeats: inferPreferredMeats,
  getIngredientHint: getIngredientHint,
  setKitchenDevices: setKitchenDevices,
  setAvoidList: setAvoidList,
  markConstraintDone: markConstraintDone,
  markIngredientDone: markIngredientDone,
  addDislikedRecipe: addDislikedRecipe,
  getDislikedRecipeIds: getDislikedRecipeIds,
  getDislikedRecipeNames: getDislikedRecipeNames,
  setUrgent: setUrgent,
  consumeUrgent: consumeUrgent,
  getUrgentLabel: getUrgentLabel,
  maybeDecay: maybeDecay,
  recordCookComplete: recordCookComplete,
  applyPostCookFeedback: applyPostCookFeedback,
  getTastePortrait: getTastePortrait,
  pickHeroIngredient: pickHeroIngredient,
  recordRecipeFeedback: recordRecipeFeedback,
  getRecipeCookLog: getRecipeCookLog,
  updateRecipeFeedback: updateRecipeFeedback
};
