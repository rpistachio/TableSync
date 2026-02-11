/**
 * 烟火集：贴纸收集数据层
 * Storage Key: sticker_collection
 * 掉落触发：疲惫模式完成烹饪、成功分享纸条
 */

var STORAGE_KEY = 'sticker_collection';

var STICKER_DEFS = {
  tired_done: { id: 'tired_done', name: '疲惫治愈', desc: '完成一次疲惫模式烹饪' },
  share_memo: { id: 'share_memo', name: '纸条传情', desc: '成功分享给帮手' }
};

function loadCollection() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveCollection(arr) {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    return false;
  }
}

function hasSticker(collection, stickerId) {
  return collection.some(function (item) { return item.stickerId === stickerId; });
}

/**
 * 尝试掉落贴纸（去重：同一 stickerId 不重复掉落）
 * @param {string} stickerId - 贴纸 ID（如 'tired_done', 'share_memo'）
 * @param {string} source - 来源描述（如 'steps_complete', 'preview_share'）
 * @returns {{ dropped: boolean, sticker?: object }} 是否新掉落、贴纸信息
 */
function tryDropSticker(stickerId, source) {
  var def = STICKER_DEFS[stickerId];
  if (!def) return { dropped: false };
  var list = loadCollection();
  if (hasSticker(list, stickerId)) return { dropped: false, sticker: def };
  var item = {
    stickerId: stickerId,
    name: def.name,
    earnedAt: Date.now(),
    source: source || ''
  };
  list.push(item);
  saveCollection(list);
  return { dropped: true, sticker: def };
}

function getStickerDef(stickerId) {
  return STICKER_DEFS[stickerId] || null;
}

function getAllDefs() {
  return Object.keys(STICKER_DEFS).map(function (id) { return STICKER_DEFS[id]; });
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  loadCollection: loadCollection,
  saveCollection: saveCollection,
  hasSticker: hasSticker,
  tryDropSticker: tryDropSticker,
  getStickerDef: getStickerDef,
  getAllDefs: getAllDefs,
  STICKER_DEFS: STICKER_DEFS
};
