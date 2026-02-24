/**
 * Fridge Store — 冰箱数据层
 *
 * 纯本地 Storage，管理食材的录入、查询、临期检测、消耗扣减。
 * Storage key: 'fridge_items'
 */

var STORAGE_KEY = 'fridge_items';

// ============ 食材智能识别映射表 ============

var INGREDIENT_RECOGNIZE = {
  '牛肉':   { category: 'beef',      icon: '🥩', fridge: 3,  freezer: 30 },
  '牛排':   { category: 'beef',      icon: '🥩', fridge: 2,  freezer: 30 },
  '牛腱':   { category: 'beef',      icon: '🥩', fridge: 3,  freezer: 30 },
  '肥牛':   { category: 'beef',      icon: '🥩', fridge: 2,  freezer: 30 },
  '羊肉':   { category: 'lamb',      icon: '🥩', fridge: 3,  freezer: 30 },
  '羊排':   { category: 'lamb',      icon: '🥩', fridge: 3,  freezer: 30 },
  '猪肉':   { category: 'pork',      icon: '🥓', fridge: 3,  freezer: 30 },
  '排骨':   { category: 'pork',      icon: '🥓', fridge: 3,  freezer: 30 },
  '五花肉': { category: 'pork',      icon: '🥓', fridge: 3,  freezer: 30 },
  '里脊':   { category: 'pork',      icon: '🥓', fridge: 2,  freezer: 30 },
  '肉末':   { category: 'pork',      icon: '🥓', fridge: 1,  freezer: 30 },
  '肉馅':   { category: 'pork',      icon: '🥓', fridge: 1,  freezer: 30 },
  '鸡肉':   { category: 'chicken',   icon: '🍗', fridge: 2,  freezer: 30 },
  '鸡腿':   { category: 'chicken',   icon: '🍗', fridge: 2,  freezer: 30 },
  '鸡翅':   { category: 'chicken',   icon: '🍗', fridge: 2,  freezer: 30 },
  '鸡胸':   { category: 'chicken',   icon: '🍗', fridge: 2,  freezer: 30 },
  '鸡蛋':   { category: 'egg',       icon: '🥚', fridge: 14, freezer: 0  },
  '鸭肉':   { category: 'duck',      icon: '🦆', fridge: 2,  freezer: 30 },
  '虾':     { category: 'shrimp',    icon: '🦐', fridge: 1,  freezer: 60 },
  '虾仁':   { category: 'shrimp',    icon: '🦐', fridge: 1,  freezer: 60 },
  '大虾':   { category: 'shrimp',    icon: '🦐', fridge: 1,  freezer: 60 },
  '鱼':     { category: 'fish',      icon: '🐟', fridge: 1,  freezer: 30 },
  '鲈鱼':   { category: 'fish',      icon: '🐟', fridge: 1,  freezer: 30 },
  '三文鱼': { category: 'fish',      icon: '🐟', fridge: 1,  freezer: 30 },
  '鳕鱼':   { category: 'fish',      icon: '🐟', fridge: 1,  freezer: 30 },
  '带鱼':   { category: 'fish',      icon: '🐟', fridge: 1,  freezer: 30 },
  '螃蟹':   { category: 'fish',      icon: '🦀', fridge: 1,  freezer: 30 },
  '蛤蜊':   { category: 'shellfish', icon: '🐚', fridge: 1,  freezer: 30 },
  '扇贝':   { category: 'shellfish', icon: '🐚', fridge: 1,  freezer: 30 },
  '鲍鱼':   { category: 'shellfish', icon: '🐚', fridge: 1,  freezer: 30 },
  '小卷':   { category: 'shellfish', icon: '🦑', fridge: 1,  freezer: 30 },
  '鱿鱼':   { category: 'shellfish', icon: '🦑', fridge: 1,  freezer: 30 },
  '墨鱼':   { category: 'shellfish', icon: '🦑', fridge: 1,  freezer: 30 },
  '豆腐':   { category: 'tofu',      icon: '🧈', fridge: 3,  freezer: 0  },
  '豆干':   { category: 'tofu',      icon: '🧈', fridge: 5,  freezer: 0  },
  '白菜':   { category: 'vegetable', icon: '🥬', fridge: 5,  freezer: 0  },
  '青菜':   { category: 'vegetable', icon: '🥬', fridge: 3,  freezer: 0  },
  '菠菜':   { category: 'vegetable', icon: '🥬', fridge: 3,  freezer: 0  },
  '生菜':   { category: 'vegetable', icon: '🥬', fridge: 3,  freezer: 0  },
  '番茄':   { category: 'vegetable', icon: '🍅', fridge: 5,  freezer: 0  },
  '西红柿': { category: 'vegetable', icon: '🍅', fridge: 5,  freezer: 0  },
  '黄瓜':   { category: 'vegetable', icon: '🥒', fridge: 5,  freezer: 0  },
  '土豆':   { category: 'vegetable', icon: '🥔', fridge: 7,  freezer: 0  },
  '胡萝卜': { category: 'vegetable', icon: '🥕', fridge: 10, freezer: 0  },
  '萝卜':   { category: 'vegetable', icon: '🥕', fridge: 7,  freezer: 0  },
  '茄子':   { category: 'vegetable', icon: '🍆', fridge: 5,  freezer: 0  },
  '西兰花': { category: 'vegetable', icon: '🥦', fridge: 5,  freezer: 0  },
  '花菜':   { category: 'vegetable', icon: '🥦', fridge: 5,  freezer: 0  },
  '包菜':   { category: 'vegetable', icon: '🥬', fridge: 7,  freezer: 0  },
  '豆角':   { category: 'vegetable', icon: '🫘', fridge: 4,  freezer: 0  },
  '芹菜':   { category: 'vegetable', icon: '🥬', fridge: 5,  freezer: 0  },
  '蘑菇':   { category: 'vegetable', icon: '🍄', fridge: 3,  freezer: 0  },
  '香菇':   { category: 'vegetable', icon: '🍄', fridge: 5,  freezer: 0  },
  '杏鲍菇': { category: 'vegetable', icon: '🍄', fridge: 5,  freezer: 0  },
  '木耳':   { category: 'vegetable', icon: '🍄', fridge: 5,  freezer: 0  },
  '玉米':   { category: 'vegetable', icon: '🌽', fridge: 3,  freezer: 30 },
  '南瓜':   { category: 'vegetable', icon: '🎃', fridge: 7,  freezer: 0  },
  '洋葱':   { category: 'vegetable', icon: '🧅', fridge: 14, freezer: 0  },
  '秋葵':   { category: 'vegetable', icon: '🥬', fridge: 3,  freezer: 0  },
  '藕':     { category: 'vegetable', icon: '🥬', fridge: 5,  freezer: 0  }
};

var DEFAULT_ITEM = { category: 'other', icon: '🍽', fridge: 3, freezer: 30 };

// ============ 存储读写 ============

function _load() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}

function _save(items) {
  try {
    wx.setStorageSync(STORAGE_KEY, items);
  } catch (e) { /* ignore */ }
}

// ============ 食材识别 ============

/**
 * 识别单个食材名称，返回 { category, icon, shelfDays }
 * 优先精确匹配，其次包含匹配
 */
function _recognize(name) {
  if (!name) return null;
  var trimmed = name.trim();
  if (!trimmed) return null;

  if (INGREDIENT_RECOGNIZE[trimmed]) {
    return INGREDIENT_RECOGNIZE[trimmed];
  }
  for (var key in INGREDIENT_RECOGNIZE) {
    if (INGREDIENT_RECOGNIZE.hasOwnProperty(key)) {
      if (trimmed.indexOf(key) !== -1 || key.indexOf(trimmed) !== -1) {
        return INGREDIENT_RECOGNIZE[key];
      }
    }
  }
  return null;
}

/**
 * 解析用户输入文本，拆分为食材名数组
 * 支持空格、逗号、顿号、换行分隔
 */
function _parseInput(text) {
  if (!text || typeof text !== 'string') return [];
  return text.split(/[\s,，、\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}

// ============ 核心方法 ============

/**
 * 批量添加食材
 * @param {string} text - 用户输入（如 "牛肉 鸡腿 虾"）
 * @param {string} storage - 'fridge' | 'freezer'
 * @returns {Array} 新增的食材项数组
 */
function addItems(text, storage) {
  var names = _parseInput(text);
  if (names.length === 0) return [];

  var storageType = storage === 'freezer' ? 'freezer' : 'fridge';
  var items = _load();
  var added = [];
  var now = Date.now();

  for (var i = 0; i < names.length; i++) {
    var info = _recognize(names[i]) || DEFAULT_ITEM;
    var shelfDays = storageType === 'freezer' ? (info.freezer || 30) : (info.fridge || 3);
    if (shelfDays === 0) shelfDays = info.fridge || 3;

    var item = {
      id: 'f_' + now + '_' + i,
      name: names[i],
      category: info.category,
      icon: info.icon,
      storage: storageType,
      addedAt: now,
      expiresAt: now + shelfDays * 86400000,
      shelfDays: shelfDays,
      consumed: false
    };
    items.push(item);
    added.push(item);
  }

  _save(items);
  return added;
}

/**
 * 获取所有未消耗食材，按临期优先排序
 */
function getAll() {
  var items = _load();
  return items
    .filter(function (it) { return !it.consumed; })
    .sort(function (a, b) { return a.expiresAt - b.expiresAt; });
}

/**
 * 获取 N 天内过期的食材
 * @param {number} [days=2]
 * @returns {Array}
 */
function getExpiringSoon(days) {
  var d = (typeof days === 'number' && days > 0) ? days : 2;
  var cutoff = Date.now() + d * 86400000;
  return getAll().filter(function (it) { return it.expiresAt <= cutoff; });
}

/**
 * 返回临期食材的 category 数组（去重）
 */
function getExpiringCategories(days) {
  var expiring = getExpiringSoon(days);
  var cats = {};
  var result = [];
  for (var i = 0; i < expiring.length; i++) {
    var cat = expiring[i].category;
    if (!cats[cat]) {
      cats[cat] = true;
      result.push(cat);
    }
  }
  return result;
}

/**
 * 返回临期食材名称列表（供 prompt 注入）
 * @param {number} [days=2]
 * @returns {Array<string>}
 */
function getExpiringNames(days) {
  return getExpiringSoon(days).map(function (it) { return it.name; });
}

/**
 * 按大类消耗最临期的一项
 * @param {string} category - 食材大类
 * @returns {Object|null} 被消耗的食材，或 null
 */
function consumeByCategory(category) {
  if (!category) return null;
  var items = _load();
  var CATEGORY_MAP = {
    beef: ['beef'], pork: ['pork'], chicken: ['chicken'],
    fish: ['fish'], shrimp: ['shrimp'],
    vegetable: ['vegetable', 'tofu']
  };
  var targets = CATEGORY_MAP[category] || [category];

  var bestIdx = -1;
  var bestExpires = Infinity;
  for (var i = 0; i < items.length; i++) {
    if (items[i].consumed) continue;
    if (targets.indexOf(items[i].category) !== -1 && items[i].expiresAt < bestExpires) {
      bestIdx = i;
      bestExpires = items[i].expiresAt;
    }
  }

  if (bestIdx === -1) return null;
  items[bestIdx].consumed = true;
  _save(items);
  return items[bestIdx];
}

/**
 * 删除单项
 */
function removeItem(id) {
  var items = _load();
  var filtered = items.filter(function (it) { return it.id !== id; });
  _save(filtered);
}

/**
 * 切换冷藏/冷冻，重算保鲜期
 */
function toggleStorage(id) {
  var items = _load();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      var item = items[i];
      var info = _recognize(item.name) || DEFAULT_ITEM;
      item.storage = item.storage === 'fridge' ? 'freezer' : 'fridge';
      var newShelfDays = item.storage === 'freezer' ? (info.freezer || 30) : (info.fridge || 3);
      if (newShelfDays === 0) newShelfDays = info.fridge || 3;
      item.shelfDays = newShelfDays;
      item.expiresAt = item.addedAt + newShelfDays * 86400000;
      _save(items);
      return item;
    }
  }
  return null;
}

/**
 * 计算剩余天数
 * @returns {number} 正数=还剩N天，0=今天到期，负数=已过期N天
 */
function getDaysLeft(item) {
  if (!item || !item.expiresAt) return 0;
  return Math.ceil((item.expiresAt - Date.now()) / 86400000);
}

/**
 * 获取冰箱食材总数（未消耗）
 */
function getCount() {
  return getAll().length;
}

// ============ 导出 ============

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  addItems: addItems,
  getAll: getAll,
  getExpiringSoon: getExpiringSoon,
  getExpiringCategories: getExpiringCategories,
  getExpiringNames: getExpiringNames,
  consumeByCategory: consumeByCategory,
  removeItem: removeItem,
  toggleStorage: toggleStorage,
  getDaysLeft: getDaysLeft,
  getCount: getCount
};
