/**
 * 烟火集：贴纸收集数据层
 * Storage Keys:
 *   sticker_collection    — 已获得贴纸列表
 *   cook_recipe_history   — 每道菜完成次数 { [recipeName]: count }
 *
 * 掉落触发：
 *   tired_done    疲惫模式完成烹饪
 *   share_memo    成功分享纸条（预留）
 *   first_cook    首次完成烹饪
 *   night_cook    深夜（22:00-2:00）完成
 *   morning_cook  清晨（6:00-9:00）完成
 *   hesitant_go   犹豫后最终开始并完成
 *   favorite_dish 同一道菜制作 3 次
 *   lucky_cat     随机彩蛋（可重复，最多 5 次）
 *   monthly_all   月度全勤（预留）
 */

var STORAGE_KEY = 'sticker_collection';
var COOK_HISTORY_KEY = 'cook_recipe_history';

// ====== 贴纸定义 ======

var STICKER_DEFS = {
  first_cook:    { id: 'first_cook',    name: '初见火光',       emoji: '🔥', desc: '第一次完成烹饪',                  category: 'milestone',  repeatable: false },
  tired_done:    { id: 'tired_done',    name: '疲惫治愈',       emoji: '🛋️', desc: '完成一次疲惫模式烹饪',             category: 'milestone',  repeatable: false },
  share_memo:    { id: 'share_memo',    name: '纸条传情',       emoji: '💌', desc: '成功分享给帮手',                  category: 'social',     repeatable: false },
  night_cook:    { id: 'night_cook',    name: '月亮守望者',     emoji: '🌙', desc: '深夜 22:00–2:00 完成烹饪',         category: 'time',       repeatable: false },
  morning_cook:  { id: 'morning_cook',  name: '晨曦主厨',       emoji: '🌅', desc: '清晨 6:00–9:00 完成烹饪',          category: 'time',       repeatable: false },
  hesitant_go:   { id: 'hesitant_go',   name: '心定时刻',       emoji: '🍃', desc: '犹豫之后，终于迈出这一步',          category: 'emotion',    repeatable: false },
  favorite_dish: { id: 'favorite_dish', name: '偏爱这一味',     emoji: '❤️', desc: '同一道菜制作满 3 次',               category: 'habit',      repeatable: false },
  lucky_cat:     { id: 'lucky_cat',     name: '流浪的小猫',     emoji: '🐱', desc: '随机掉落的神秘彩蛋',               category: 'surprise',   repeatable: true, maxCount: 5 },
  monthly_all:   { id: 'monthly_all',   name: '月度全勤',       emoji: '📅', desc: '一个月内每周至少烹饪一次',          category: 'milestone',  repeatable: false }
};

// ====== 存储读写 ======

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

// ====== 查询工具 ======

function hasSticker(collection, stickerId) {
  return collection.some(function (item) { return item.stickerId === stickerId; });
}

function countSticker(collection, stickerId) {
  var c = 0;
  for (var i = 0; i < collection.length; i++) {
    if (collection[i].stickerId === stickerId) c++;
  }
  return c;
}

// ====== 掉落 ======

/**
 * 尝试掉落贴纸（去重：同一 stickerId 不重复掉落；repeatable 类型有上限）
 * @param {string} stickerId
 * @param {string} source - 来源描述
 * @returns {{ dropped: boolean, sticker?: object }}
 */
function tryDropSticker(stickerId, source) {
  var def = STICKER_DEFS[stickerId];
  if (!def) return { dropped: false };
  var list = loadCollection();

  if (def.repeatable) {
    var count = countSticker(list, stickerId);
    if (count >= (def.maxCount || 1)) return { dropped: false, sticker: def };
  } else {
    if (hasSticker(list, stickerId)) return { dropped: false, sticker: def };
  }

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

// ====== 完成时的批量贴纸检测 ======

/**
 * 完成烹饪时统一检测所有可能的贴纸掉落
 * @param {object} ctx - 上下文
 * @param {boolean}  ctx.isTired       - 是否疲惫模式
 * @param {boolean}  ctx.isHesitant    - 是否"犹豫后启动"
 * @param {string[]} ctx.recipeNames   - 本次完成的菜名列表
 * @returns {Array<{ stickerId: string, name: string, emoji: string }>} 新掉落贴纸列表
 */
function checkAllDropsOnComplete(ctx) {
  var drops = [];

  function tryDrop(id, src) {
    var r = tryDropSticker(id, src);
    if (r.dropped && r.sticker) {
      drops.push({ stickerId: r.sticker.id, name: r.sticker.name, emoji: r.sticker.emoji || '✨' });
    }
  }

  // 1. 初见火光：首次完成
  tryDrop('first_cook', 'steps_complete');

  // 2. 疲惫治愈
  if (ctx.isTired) {
    tryDrop('tired_done', 'steps_complete');
  }

  // 3. 时间段
  var hour = new Date().getHours();
  if (hour >= 22 || hour < 2) {
    tryDrop('night_cook', 'steps_complete');
  }
  if (hour >= 6 && hour < 9) {
    tryDrop('morning_cook', 'steps_complete');
  }

  // 4. 心定时刻
  if (ctx.isHesitant) {
    tryDrop('hesitant_go', 'steps_complete');
  }

  // 5. 偏爱这一味：更新历史并检测
  if (ctx.recipeNames && ctx.recipeNames.length > 0) {
    var history = loadCookHistory();
    var triggered = false;
    for (var i = 0; i < ctx.recipeNames.length; i++) {
      var rn = ctx.recipeNames[i];
      if (!rn) continue;
      history[rn] = (history[rn] || 0) + 1;
      if (history[rn] === 3 && !triggered) {
        triggered = true;
      }
    }
    saveCookHistory(history);
    if (triggered) {
      tryDrop('favorite_dish', 'steps_complete');
    }
  }

  // 6. 随机彩蛋（5% 概率）
  if (Math.random() < 0.05) {
    tryDrop('lucky_cat', 'steps_complete_random');
  }

  return drops;
}

// ====== 烹饪历史 ======

function loadCookHistory() {
  try {
    var raw = wx.getStorageSync(COOK_HISTORY_KEY);
    if (!raw) return {};
    var obj = JSON.parse(raw);
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveCookHistory(obj) {
  try {
    wx.setStorageSync(COOK_HISTORY_KEY, JSON.stringify(obj || {}));
  } catch (e) {}
}

// ====== 查询 ======

function getStickerDef(stickerId) {
  return STICKER_DEFS[stickerId] || null;
}

function getAllDefs() {
  return Object.keys(STICKER_DEFS).map(function (id) { return STICKER_DEFS[id]; });
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  COOK_HISTORY_KEY: COOK_HISTORY_KEY,
  STICKER_DEFS: STICKER_DEFS,
  loadCollection: loadCollection,
  saveCollection: saveCollection,
  hasSticker: hasSticker,
  countSticker: countSticker,
  tryDropSticker: tryDropSticker,
  checkAllDropsOnComplete: checkAllDropsOnComplete,
  loadCookHistory: loadCookHistory,
  saveCookHistory: saveCookHistory,
  getStickerDef: getStickerDef,
  getAllDefs: getAllDefs
};
