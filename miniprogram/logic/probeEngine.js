/**
 * Probe Engine — 需求探针选择引擎 v2
 *
 * 核心改动：探针分为 Volatile（每次必问）和 Persistent（仅问一次）两轨。
 *   Volatile:   scene / taste — 每次进首页都展示，带智能默认值
 *   Persistent:  constraint / kitchen — 档案有答案就跳过
 *   Conditional: inventory（冰箱临期数据驱动）、ingredient（首次补问）
 *
 * Session 追踪通过模块级 _sessionAnswered 实现，onLoad 时 resetSession。
 */

var tasteProfile = require('../data/tasteProfile.js');
var fridgeStore = require('../data/fridgeStore.js');

// ============ Session 追踪（模块级，页面生命周期内有效） ============

var _sessionAnswered = {};

function resetSession() {
  _sessionAnswered = {};
}

function isSessionAnswered(type) {
  return !!_sessionAnswered[type];
}

// ============ 探针题库 ============

var SCENE_PROBE = {
  type: 'scene',
  question: '今晚什么局？',
  options: [
    { key: 'solo',      label: '就我',     icon: '🧑‍🍳' },
    { key: 'couple',    label: '两个人',   icon: '👫' },
    { key: 'family',    label: '一家人',   icon: '👨‍👩‍👧' },
    { key: 'gathering', label: '来客人了', icon: '🎉' }
  ],
  confirmTemplate: function (key) {
    var map = {
      solo: '好的，今晚一个人，简单吃',
      couple: '已记下，今晚两个人',
      family: '好的，一家人一起吃',
      gathering: '来客人了，整丰盛点'
    };
    return map[key] || '已记下';
  }
};

var INVENTORY_PROBE = {
  type: 'inventory',
  question: '冰箱有要用掉的食材吗？',
  options: [
    { key: 'meat',      label: '肉类要用掉', icon: '🥩' },
    { key: 'vegetable', label: '蔬菜要用掉', icon: '🥬' },
    { key: 'seafood',   label: '海鲜要用掉', icon: '🦐' },
    { key: null,        label: '没有',       icon: '✓' }
  ],
  confirmTemplate: function (key) {
    if (!key) return '';
    var map = {
      meat: '好的，先消灭冰箱里的肉',
      vegetable: '好的，先把菜用掉',
      seafood: '好的，海鲜不能放了'
    };
    return map[key] || '';
  }
};

var CONSTRAINT_PROBE = {
  type: 'constraint',
  question: '有啥不能吃的？',
  multiSelect: true,
  options: [
    { key: 'spicy',   label: '不吃辣',    icon: '🌶' },
    { key: 'seafood', label: '海鲜过敏',  icon: '🦀' },
    { key: 'peanut',  label: '花生过敏',  icon: '🥜' },
    { key: 'lactose', label: '乳糖不耐',  icon: '🥛' },
    { key: 'gluten',  label: '麸质过敏',  icon: '🌾' },
    { key: null,      label: '都能吃',    icon: '✓' }
  ],
  confirmTemplate: function (keys) {
    if (!keys || keys.length === 0 || (keys.length === 1 && keys[0] === null)) {
      return '好的，百无禁忌';
    }
    var LABELS = { spicy: '辣', seafood: '海鲜', peanut: '花生', lactose: '乳糖', gluten: '麸质' };
    var names = [];
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] && LABELS[keys[i]]) names.push(LABELS[keys[i]]);
    }
    return '已记下，忌' + names.join('、');
  }
};

/** 口味探针动态星期文案 */
var TASTE_WEEKDAY_QUESTIONS = [
  '周日慵懒，今天嘴馋什么味？',
  '新的一周，想吃点什么味？',
  '周二了，今天想什么口味？',
  '周三过半，嘴馋什么味？',
  '周四了，快到周末，今天想吃啥味？',
  '周五犒劳日，想来点什么？',
  '周末愉快，今天想吃什么味？'
];

var TASTE_PROBE = {
  type: 'taste',
  question: '今天嘴馋什么味？',
  options: [
    { key: 'light',       label: '清淡点',   icon: '🥗' },
    { key: 'spicy',       label: '来点辣的', icon: '🌶' },
    { key: 'sour_fresh',  label: '酸酸的',   icon: '🍋' },
    { key: 'salty_umami', label: '咸香下饭', icon: '🍚' },
    { key: null,          label: '随便',     icon: '🎲' }
  ],
  confirmTemplate: function (key) {
    if (!key) return '好的，随心搭配';
    var map = {
      light: '好的，今天吃清淡点',
      spicy: '好的，来点辣的过过瘾',
      sour_fresh: '好的，来点酸的开开胃',
      salty_umami: '好的，整点下饭硬菜'
    };
    return map[key] || '已记下';
  }
};

var INGREDIENT_PROBE = {
  type: 'ingredient',
  question: '今天想吃点什么？',
  options: [
    { key: 'seafood',   label: '海鲜',   icon: '🦐' },
    { key: 'beef',      label: '牛羊肉', icon: '🥩' },
    { key: 'chicken',   label: '鸡鸭',   icon: '🍗' },
    { key: 'vegetable', label: '多吃素', icon: '🥬' },
    { key: null,        label: '都行',   icon: '🎲' }
  ],
  confirmTemplate: function (key) {
    if (!key) return '好的，荤素搭着来';
    var map = {
      seafood: '好的，今天安排海鲜',
      beef: '好的，来点牛羊肉',
      chicken: '好的，安排鸡鸭',
      vegetable: '好的，今天多吃素'
    };
    return map[key] || '已记下';
  }
};

var KITCHEN_PROBE = {
  type: 'kitchen',
  question: '家里有哪些厨具？',
  multiSelect: true,
  options: [
    { key: 'hasAirFryer', label: '空气炸锅', icon: '🍟' },
    { key: 'hasSteamer',  label: '蒸锅',     icon: '♨️' },
    { key: 'hasOven',     label: '烤箱',     icon: '🔥' },
    { key: null,          label: '就灶台',   icon: '🍳' }
  ],
  confirmTemplate: function (keys) {
    if (!keys || keys.length === 0 || (keys.length === 1 && keys[0] === null)) {
      return '好的，灶台搞定一切';
    }
    var LABELS = { hasAirFryer: '空气炸锅', hasSteamer: '蒸锅', hasOven: '烤箱' };
    var names = [];
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] && LABELS[keys[i]]) names.push(LABELS[keys[i]]);
    }
    return '已记下，有' + names.join('、');
  }
};

// ============ 辅助函数 ============

function _hasPositiveValues(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && obj[k] > 0) return true;
  }
  return false;
}

function _isDefaultKitchen(profile) {
  var kc = profile.kitchenConfig || {};
  return !kc.hasAirFryer && !kc.hasSteamer && !kc.hasOven;
}

function _buildFridgeProbe(expiring) {
  var names = expiring.slice(0, 3).map(function (it) { return it.name; });
  var firstCategory = expiring[0].category;
  var CATEGORY_TO_URGENT = {
    beef: 'meat', pork: 'meat', chicken: 'meat',
    fish: 'seafood', shrimp: 'seafood',
    vegetable: 'vegetable', tofu: 'vegetable',
    egg: 'meat', other: 'meat'
  };
  var urgentKey = CATEGORY_TO_URGENT[firstCategory] || 'meat';

  return {
    type: 'inventory',
    question: '优先消耗即将过期的【' + names.join('、') + '】吗？',
    options: [
      { key: urgentKey, label: '好的，优先用掉', icon: '✓' },
      { key: null,      label: '不用了',        icon: '✗' }
    ],
    _fridgeExpiring: expiring,
    confirmTemplate: function (key) {
      if (!key) return '';
      return '好的，今天优先消耗' + names.join('、');
    }
  };
}

/** 为口味探针注入动态星期文案 */
function _withDynamicQuestion(probe) {
  var dayOfWeek = new Date().getDay();
  var copy = {};
  for (var k in probe) {
    if (probe.hasOwnProperty(k)) copy[k] = probe[k];
  }
  copy.question = TASTE_WEEKDAY_QUESTIONS[dayOfWeek] || probe.question;
  return copy;
}

// ============ 核心选择逻辑 ============

/**
 * 选择下一个要展示的探针
 * Volatile 双轨：scene → taste（每次 session 必问，_sessionAnswered 控制）
 * Persistent 单轨：constraint → ingredient → kitchen（档案有答案就跳过）
 * Conditional：冰箱临期（插在 volatile 之后）
 */
function selectNextProbe() {
  var profile = tasteProfile.get();
  var visitCount = profile.visitCount || 0;

  // Volatile 1: 场景探针 — 本次 session 未回答就展示
  if (!_sessionAnswered.scene) {
    return SCENE_PROBE;
  }

  // Volatile 2: 口味探针 — 本次 session 未回答就展示（动态文案）
  if (!_sessionAnswered.taste) {
    return _withDynamicQuestion(TASTE_PROBE);
  }

  // Conditional: 冰箱临期联动
  if (!_sessionAnswered.inventory) {
    try {
      var expiring = fridgeStore.getExpiringSoon(2);
      if (expiring.length > 0 && !profile.urgentIngredient) {
        return _buildFridgeProbe(expiring);
      }
    } catch (e) {}
  }

  // Persistent 1: 约束探针（仅首次）
  if (!_sessionAnswered.constraint && !profile.constraintDone) {
    return CONSTRAINT_PROBE;
  }

  // Persistent 2: 食材档案空 → 首次补问
  if (!_sessionAnswered.ingredient && !profile.ingredientDone && !_hasPositiveValues(profile.ingredientAffinity)) {
    return INGREDIENT_PROBE;
  }

  // Persistent 3: 厨房配置（visit 4-8 之间问一次）
  if (!_sessionAnswered.kitchen && _isDefaultKitchen(profile) && visitCount >= 4 && visitCount <= 8) {
    return KITCHEN_PROBE;
  }

  return null;
}

/**
 * 获取某个 volatile 探针的"上次选择" key
 * @param {string} probeType - 'scene' | 'taste'
 * @returns {string|null}
 */
function getLastChoice(probeType) {
  var profile = tasteProfile.get();
  if (probeType === 'scene') {
    return profile.scene || null;
  }
  if (probeType === 'taste') {
    return tasteProfile.getTopFlavorKey(profile.flavorAffinity);
  }
  return null;
}

// ============ 回答处理 ============

function handleProbeAnswer(probeType, value) {
  var confirmText = '';

  // 标记 volatile 探针已回答
  _sessionAnswered[probeType] = true;

  if (probeType === 'scene') {
    tasteProfile.setScene(value);
    confirmText = SCENE_PROBE.confirmTemplate(value);
  } else if (probeType === 'inventory') {
    if (value) {
      tasteProfile.setUrgent(value);
      try {
        var expNames = fridgeStore.getExpiringSoon(2).slice(0, 3).map(function (it) { return it.name; });
        confirmText = expNames.length > 0 ? '好的，今天优先消耗' + expNames.join('、') : '已记下，优先用掉冰箱食材';
      } catch (e) {
        confirmText = '已记下，优先用掉冰箱食材';
      }
    }
  } else if (probeType === 'constraint') {
    var list = Array.isArray(value) ? value.filter(function (v) { return v !== null; }) : [];
    tasteProfile.setAvoidList(list);
    tasteProfile.markConstraintDone();
    confirmText = CONSTRAINT_PROBE.confirmTemplate(list);
  } else if (probeType === 'taste') {
    if (value && value !== 'null') {
      tasteProfile.voteFlavorAffinity(value);
    }
    confirmText = TASTE_PROBE.confirmTemplate(value);
  } else if (probeType === 'ingredient') {
    if (value && value !== 'null') {
      tasteProfile.voteIngredientAffinity(value);
    }
    tasteProfile.markIngredientDone();
    confirmText = INGREDIENT_PROBE.confirmTemplate(value);
  } else if (probeType === 'kitchen') {
    var devices = Array.isArray(value) ? value.filter(function (v) { return v !== null; }) : [];
    tasteProfile.setKitchenDevices(devices);
    confirmText = KITCHEN_PROBE.confirmTemplate(devices);
  }

  return confirmText;
}

// ============ 综合文案 ============

var SCENE_LABELS = { solo: '一个人', couple: '两个人', family: '一家人', gathering: '来客人了' };
var TASTE_LABELS = { light: '清淡', spicy: '辣味', sour_fresh: '酸爽', salty_umami: '咸香', sweet_sour: '酸甜' };

/**
 * 生成综合确认文案
 * @param {boolean} [skipped] - 用户跳过探针直接点了 CTA
 * @returns {string}
 */
function buildSessionSummary(skipped) {
  var profile = tasteProfile.get();
  var parts = [];

  if (profile.scene) {
    parts.push('今晚' + (SCENE_LABELS[profile.scene] || ''));
  }

  var flavorResult = tasteProfile.getTopFlavors(profile.flavorAffinity);
  if (flavorResult.ambiguous && flavorResult.second) {
    parts.push('偏好' + (TASTE_LABELS[flavorResult.top] || flavorResult.top) + '或' + (TASTE_LABELS[flavorResult.second] || flavorResult.second));
  } else if (flavorResult.top && TASTE_LABELS[flavorResult.top]) {
    parts.push('偏好' + TASTE_LABELS[flavorResult.top]);
  }

  if (profile.urgentIngredient) {
    parts.push(tasteProfile.getUrgentLabel(profile.urgentIngredient));
  }

  if (parts.length === 0) return '';
  var prefix = skipped ? '沿用上次：' : '已记下：';
  return prefix + parts.join('，');
}

// ============ 导出 ============

module.exports = {
  SCENE_PROBE: SCENE_PROBE,
  INVENTORY_PROBE: INVENTORY_PROBE,
  CONSTRAINT_PROBE: CONSTRAINT_PROBE,
  TASTE_PROBE: TASTE_PROBE,
  INGREDIENT_PROBE: INGREDIENT_PROBE,
  KITCHEN_PROBE: KITCHEN_PROBE,
  selectNextProbe: selectNextProbe,
  resetSession: resetSession,
  resetVolatile: resetSession,
  isSessionAnswered: isSessionAnswered,
  getLastChoice: getLastChoice,
  handleProbeAnswer: handleProbeAnswer,
  buildSessionSummary: buildSessionSummary
};
