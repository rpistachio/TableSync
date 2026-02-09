/**
 * 灵感篮子 (Inspiration Basket) 数据层
 * 纯函数设计，不调用 wx.*；Storage 读写由调用方完成。
 * 存储 key 与日期 key 用于调用方做每日清空判断。
 * spec v1.5: 入篮时 source 为 imported 的项必须具备 meat 标签，以兼容 menuGenerator/smartMenuGen。
 */

var STORAGE_KEY = 'inspiration_basket';
var BASKET_DATE_KEY = 'inspiration_basket_date';

/** 与 menuData/menuGenerator 一致的肉类枚举，用于名称推导 */
var VALID_MEAT_KEYS = ['chicken', 'pork', 'beef', 'fish', 'shrimp', 'vegetable'];

/** 从菜名推导 meat 类型（纯函数，不调用 wx.*） */
var MEAT_NAME_PATTERNS = [
  { keys: ['鸡', '鸡肉', '鸡翅', '鸡腿', '鸡丁', '鸡块', '鸡胸', '鸡里脊'], meat: 'chicken' },
  { keys: ['猪', '猪肉', '排骨', '五花', '肉末', '肉丝', '肉片', '里脊'], meat: 'pork' },
  { keys: ['牛', '牛肉', '牛腩', '牛柳', '牛排'], meat: 'beef' },
  { keys: ['鱼', '鳕鱼', '鲈鱼', '三文鱼', '鲫鱼', '带鱼', '黄花鱼'], meat: 'fish' },
  { keys: ['虾', '虾仁', '大虾', '基围虾', '明虾'], meat: 'shrimp' },
  { keys: ['豆腐', '青菜', '白菜', '花菜', '西兰花', '茄子', '黄瓜', '冬瓜', '南瓜', '土豆', '番茄', '苦瓜', '韭菜', '菠菜', '芹菜', '花生', '木耳', '蘑菇', '口蘑', '地三鲜', '娃娃菜', '秋葵'], meat: 'vegetable' }
];
function inferMeatFromName(name) {
  if (!name) return '';
  for (var i = 0; i < MEAT_NAME_PATTERNS.length; i++) {
    var group = MEAT_NAME_PATTERNS[i];
    for (var j = 0; j < group.keys.length; j++) {
      if (name.indexOf(group.keys[j]) !== -1) return group.meat;
    }
  }
  return '';
}

/**
 * 返回当前日期的 YYYY-MM-DD，用于判断是否跨天清空
 * @returns {string}
 */
function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

/**
 * 解析本地存储的篮子 JSON
 * @param {string} raw
 * @returns {Array}
 */
function parseBasket(raw) {
  if (raw == null || raw === '') return [];
  try {
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/**
 * 序列化篮子为 JSON 字符串
 * @param {Array} list
 * @returns {string}
 */
function serializeBasket(list) {
  if (!Array.isArray(list)) return '[]';
  try {
    return JSON.stringify(list);
  } catch (e) {
    return '[]';
  }
}

/**
 * 创建一条篮子项（纯函数，不写存储）
 * @param {Object} recipe - 至少含 id, name；可含 sourcePlatform 等
 * @param {string} source - 'native' | 'imported' | 'fridge_match'
 * @param {Object} [options]
 * @param {string} [options.sourceDetail]
 * @param {string} [options.priority] - 'high' | 'normal'
 * @param {Object} [options.meta] - { fridgeIngredients, expiringIngredients, importPlatform }
 * @returns {Object} basket item
 */
function createItem(recipe, source, options) {
  options = options || {};
  var id = recipe.id || recipe._id || '';
  var name = (recipe.name || '').trim() || '未命名';
  var sourceDetail = options.sourceDetail || '';
  if (!sourceDetail && source === 'imported' && recipe.sourcePlatform) {
    sourceDetail = recipe.sourcePlatform === 'xiaohongshu' ? '小红书导入' : (recipe.sourcePlatform === 'douyin' ? '抖音导入' : '导入');
  }
  if (!sourceDetail && source === 'fridge_match') sourceDetail = '冰箱匹配';
  if (!sourceDetail && source === 'native') sourceDetail = '菜谱库收藏';

  // meat 推导：优先用调用方传入 → 原始 recipe 字段 → 从菜名推导
  var meat = '';
  if (options.meat && VALID_MEAT_KEYS.indexOf(options.meat) !== -1) {
    meat = options.meat;
  } else if (recipe.meat && VALID_MEAT_KEYS.indexOf(recipe.meat) !== -1) {
    meat = recipe.meat;
  } else {
    meat = inferMeatFromName(name);
  }

  return {
    id: id,
    name: name,
    source: source,
    sourceDetail: sourceDetail,
    addedAt: Date.now(),
    priority: options.priority || 'normal',
    meat: meat,
    meta: options.meta || {}
  };
}

/**
 * 向篮子列表追加一条（去重：同 id 不重复添加）
 * @param {Array} list
 * @param {Object} item - createItem 的返回值
 * @returns {Array} 新数组，不修改原数组
 */
function addItem(list, item) {
  if (!Array.isArray(list)) list = [];
  var id = item && item.id;
  if (!id) return list.slice();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list.slice();
  }
  return list.concat([item]);
}

/**
 * 从篮子列表中移除指定 id
 * @param {Array} list
 * @param {string} id
 * @returns {Array}
 */
function removeItemById(list, id) {
  if (!Array.isArray(list) || !id) return list ? list.slice() : [];
  return list.filter(function (x) { return x.id !== id; });
}

/**
 * 篮子条数
 * @param {Array} list
 * @returns {number}
 */
function getCount(list) {
  return Array.isArray(list) ? list.length : 0;
}

/**
 * 按来源筛选
 * @param {Array} list
 * @param {string} source - 'native' | 'imported' | 'fridge_match'
 * @returns {Array}
 */
function getBySource(list, source) {
  if (!Array.isArray(list) || !source) return [];
  return list.filter(function (x) { return x.source === source; });
}

/**
 * 判断指定 id 是否已在篮子中
 * @param {Array} list
 * @param {string} id
 * @returns {boolean}
 */
function hasItem(list, id) {
  if (!Array.isArray(list) || !id) return false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return true;
  }
  return false;
}

/**
 * 闭环清理：移除篮子中已选入菜单的项（按 id + name 双重匹配）
 * preview.js confirmAndGo() 在用户确认做饭后调用。
 * @param {Array} list - 当前篮子数组
 * @param {Array} menus - 菜单数组 [{ adultRecipe: { id, _id, name } }]
 * @returns {Array} 新数组（不修改原数组）
 */
function removeItemsByMenu(list, menus) {
  if (!Array.isArray(list) || !Array.isArray(menus)) return list ? list.slice() : [];
  var ids = {};
  var names = {};
  for (var i = 0; i < menus.length; i++) {
    var ar = menus[i] && menus[i].adultRecipe;
    if (!ar) continue;
    if (ar.id) ids[ar.id] = true;
    if (ar._id) ids[ar._id] = true;
    if (ar.name) names[ar.name] = true;
  }
  return list.filter(function (item) {
    if (item.id && ids[item.id]) return false;
    if (item.name && names[item.name]) return false;
    return true;
  });
}

/**
 * 批量向篮子列表追加多项（去重：同 id 不重复添加）
 * Preview 页「全员入篮」使用；不写 Storage，由调用方写入。
 * @param {Array} list - 当前篮子数组
 * @param {Array} recipes - 至少含 { id, name, meat? } 的数组
 * @param {string} source - 'native' | 'imported' | 'fridge_match'
 * @param {Function} [optionsFactory] - (recipe) => options，可选，为每项生成 createItem 的 options
 * @returns {Array} 新数组（不修改原数组）
 */
function batchAdd(list, recipes, source, optionsFactory) {
  if (!Array.isArray(list)) list = [];
  if (!Array.isArray(recipes)) return list.slice();
  var current = list.slice();
  for (var i = 0; i < recipes.length; i++) {
    var recipe = recipes[i];
    if (!recipe || (!recipe.id && !recipe._id)) continue;
    var opts = (typeof optionsFactory === 'function' ? optionsFactory(recipe) : {}) || {};
    var item = createItem(recipe, source, opts);
    current = addItem(current, item);
  }
  return current;
}

/**
 * 返回空篮子数组（用于跨天清空）
 * @returns {Array}
 */
function emptyBasket() {
  return [];
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  BASKET_DATE_KEY: BASKET_DATE_KEY,
  getTodayDateKey: getTodayDateKey,
  parseBasket: parseBasket,
  serializeBasket: serializeBasket,
  createItem: createItem,
  addItem: addItem,
  removeItemById: removeItemById,
  getCount: getCount,
  getBySource: getBySource,
  hasItem: hasItem,
  removeItemsByMenu: removeItemsByMenu,
  batchAdd: batchAdd,
  emptyBasket: emptyBasket,

  /** 兼容：getAll 即 parseBasket，由调用方先读 Storage 再传入 */
  getAll: function (raw) { return parseBasket(raw); },
  clear: function () { return []; }
};
