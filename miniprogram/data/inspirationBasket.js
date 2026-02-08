/**
 * 灵感篮子 (Inspiration Basket) 数据层
 * 纯函数设计，不调用 wx.*；Storage 读写由调用方完成。
 * 存储 key 与日期 key 用于调用方做每日清空判断。
 */

var STORAGE_KEY = 'inspiration_basket';
var BASKET_DATE_KEY = 'inspiration_basket_date';

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

/** menuGenerator 兼容：合法 meat 枚举，imported 项入篮时若无则按名称推导 */
var VALID_MEAT = { chicken: 1, pork: 1, beef: 1, fish: 1, shrimp: 1, vegetable: 1 };
function inferMeatFromName(name) {
  if (!name || typeof name !== 'string') return 'vegetable';
  var s = name.trim();
  if (/鸡|鸡丁|鸡翅|鸡胸|鸡腿|黄焖鸡/i.test(s)) return 'chicken';
  if (/猪|排骨|五花|红烧肉|肉丝|肉片|腊肉/i.test(s)) return 'pork';
  if (/牛|牛排|牛肉|肥牛/i.test(s)) return 'beef';
  if (/虾|虾仁|大虾|明虾/i.test(s)) return 'shrimp';
  if (/鱼|鲈鱼|带鱼|鲫鱼|鳕鱼|三文鱼|水煮鱼/i.test(s)) return 'fish';
  return 'vegetable';
}

/**
 * 创建一条篮子项（纯函数，不写存储）
 * source 为 imported 时必填 meat，若无则按名称推导以兼容 menuGenerator。
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

  // 唯一键：同源同菜只保留一条，用于 addItem 幂等去重（B-11）
  var stableId = (recipe.sourceUrl && typeof recipe.sourceUrl === 'string') ? recipe.sourceUrl : (id || '');
  var uniqueId = source + '_' + (stableId || '');
  var item = {
    id: id,
    uniqueId: uniqueId,
    name: name,
    source: source,
    sourceDetail: sourceDetail,
    addedAt: Date.now(),
    priority: options.priority || 'normal',
    meta: options.meta || {}
  };
  if (source === 'imported') {
    var meat = recipe.meat && VALID_MEAT[recipe.meat] ? recipe.meat : inferMeatFromName(name);
    item.meat = meat;
  }
  return item;
}

/**
 * 向篮子列表追加一条（去重：以 uniqueId 为准幂等，兼容旧数据按 id 判断）
 * @param {Array} list
 * @param {Object} item - createItem 的返回值（含 uniqueId）
 * @returns {Array} 新数组，不修改原数组
 */
function addItem(list, item) {
  if (!Array.isArray(list)) list = [];
  var id = item && item.id;
  var uid = item && item.uniqueId;
  if (!id && !uid) return list.slice();
  for (var i = 0; i < list.length; i++) {
    var existing = list[i];
    if (uid && existing.uniqueId === uid) return list.slice();
    if (existing.id === id) return list.slice();
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
 * 返回空篮子数组（用于跨天清空）
 * @returns {Array}
 */
function emptyBasket() {
  return [];
}

/**
 * 从篮子中移除已选入菜单的项（闭环清理，纯函数）
 * @param {Array} list - 当前篮子
 * @param {Array} menus - 完整菜单 [{ adultRecipe: { id, name }, ... }]
 * @returns {Array} 新列表
 */
function removeItemsByMenu(list, menus) {
  if (!Array.isArray(list) || list.length === 0) return list;
  if (!Array.isArray(menus) || menus.length === 0) return list.slice();
  var ids = {};
  var names = {};
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i] && menus[i].adultRecipe;
    if (r) {
      if (r.id) ids[r.id] = true;
      if (r.name && r.name.trim()) names[r.name.trim()] = true;
    }
  }
  return list.filter(function (x) {
    if (x.id && ids[x.id]) return false;
    if (x.name && names[(x.name || '').trim()]) return false;
    return true;
  });
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
  emptyBasket: emptyBasket,
  removeItemsByMenu: removeItemsByMenu,

  /** 兼容：getAll 即 parseBasket，由调用方先读 Storage 再传入 */
  getAll: function (raw) { return parseBasket(raw); },
  clear: function () { return []; }
};
