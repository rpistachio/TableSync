/**
 * 历史菜单管理模块
 * 存储结构：menu_history = { "2026-02-03": [...menus], "2026-02-02": [...menus], ... }
 */

var STORAGE_KEY = 'menu_history';
var MAX_HISTORY_DAYS = 7;

/**
 * 获取日期 Key（YYYY-MM-DD 格式）
 */
function getDateKey(date) {
  var d = date || new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

/**
 * 获取昨天的日期 Key
 */
function getYesterdayKey() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return getDateKey(d);
}

/**
 * 获取过去 N 天的日期 Key 列表（不含今天）
 */
function getPastDaysKeys(days) {
  var keys = [];
  for (var i = 1; i <= days; i++) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

/**
 * 格式化日期显示（如：2月3日 周一）
 */
function formatDateDisplay(dateKey) {
  var parts = dateKey.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var day = parseInt(parts[2], 10);
  var d = new Date(year, month - 1, day);
  var weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return month + '月' + day + '日 ' + weekDays[d.getDay()];
}

/**
 * 获取相对日期描述（昨天、前天、几天前）
 */
function getRelativeDay(dateKey) {
  var today = new Date();
  var parts = dateKey.split('-');
  var target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  return diffDays + '天前';
}

/**
 * 读取所有历史记录
 */
function getAllHistory() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === 'string') {
      return JSON.parse(raw);
    }
    return {};
  } catch (e) {
    return {};
  }
}

/**
 * 存储当日菜单到历史记录
 * @param {Array} menus - 菜单数组
 * @param {Object} preference - 用户偏好（可选）
 */
function saveToHistory(menus, preference) {
  if (!menus || !Array.isArray(menus) || menus.length === 0) {
    return false;
  }
  try {
    var history = getAllHistory();
    var todayKey = getDateKey();
    
    // 构建存储数据：只保存关键字段，减少存储空间
    var slimMenus = menus.map(function(m) {
      var item = {
        meat: m.meat,
        adultName: (m.adultRecipe && m.adultRecipe.name) || '',
        adultSlug: (m.adultRecipe && m.adultRecipe.slug) || ''
      };
      if (m.babyRecipe && m.babyRecipe.name) {
        item.babyName = m.babyRecipe.name;
      }
      return item;
    });
    
    history[todayKey] = {
      menus: slimMenus,
      preference: preference || null,
      savedAt: Date.now()
    };
    
    // 清理超过7天的旧记录
    var validKeys = [todayKey].concat(getPastDaysKeys(MAX_HISTORY_DAYS));
    var cleanedHistory = {};
    validKeys.forEach(function(key) {
      if (history[key]) {
        cleanedHistory[key] = history[key];
      }
    });
    
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(cleanedHistory));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 获取过去 N 天的历史记录（带日期和菜品名称）
 * @param {Number} days - 天数，默认7天
 * @returns {Array} - [{ dateKey, dateDisplay, relativeDay, menus: [...] }, ...]
 */
function getRecentHistory(days) {
  days = days || MAX_HISTORY_DAYS;
  var history = getAllHistory();
  var pastKeys = getPastDaysKeys(days);
  var result = [];
  
  pastKeys.forEach(function(key) {
    if (history[key] && history[key].menus && history[key].menus.length > 0) {
      result.push({
        dateKey: key,
        dateDisplay: formatDateDisplay(key),
        relativeDay: getRelativeDay(key),
        menus: history[key].menus,
        preference: history[key].preference
      });
    }
  });
  
  return result;
}

/**
 * 检查菜品是否在昨天的菜单中
 * @param {String} dishName - 菜品名称
 * @returns {Boolean}
 */
function wasEatenYesterday(dishName) {
  if (!dishName) return false;
  var history = getAllHistory();
  var yesterdayKey = getYesterdayKey();
  var yesterdayData = history[yesterdayKey];
  
  if (!yesterdayData || !yesterdayData.menus) return false;
  
  return yesterdayData.menus.some(function(m) {
    return m.adultName === dishName || m.babyName === dishName;
  });
}

/**
 * 获取昨天吃过的菜品名称列表
 * @returns {Array<String>}
 */
function getYesterdayDishes() {
  var history = getAllHistory();
  var yesterdayKey = getYesterdayKey();
  var yesterdayData = history[yesterdayKey];
  
  if (!yesterdayData || !yesterdayData.menus) return [];
  
  var dishes = [];
  yesterdayData.menus.forEach(function(m) {
    if (m.adultName) dishes.push(m.adultName);
    if (m.babyName) dishes.push(m.babyName);
  });
  return dishes;
}

/**
 * 获取本周（过去 7 天）吃过的菜品名称列表（去重）
 * @param {Number} maxItems - 最多返回数量，默认 20
 * @returns {Array<String>}
 */
function getWeekDishNames(maxItems) {
  maxItems = maxItems || 20;
  var recent = getRecentHistory(MAX_HISTORY_DAYS);
  var set = {};
  for (var i = 0; i < recent.length; i++) {
    var day = recent[i];
    if (day.menus && Array.isArray(day.menus)) {
      day.menus.forEach(function (m) {
        if (m.adultName && !set[m.adultName]) set[m.adultName] = true;
        if (m.babyName && !set[m.babyName]) set[m.babyName] = true;
      });
    }
  }
  var list = Object.keys(set);
  return list.length > maxItems ? list.slice(0, maxItems) : list;
}

/**
 * 获取菜品制作频率（过去 N 天内每道菜做了几次）
 * @param {Number} days - 统计天数，默认7天
 * @returns {Object} - { dishName: count, ... }
 */
function getDishFrequency(days) {
  days = days || MAX_HISTORY_DAYS;
  var recent = getRecentHistory(days);
  var freq = {};
  for (var i = 0; i < recent.length; i++) {
    var day = recent[i];
    if (day.menus && Array.isArray(day.menus)) {
      day.menus.forEach(function (m) {
        if (m.adultName) freq[m.adultName] = (freq[m.adultName] || 0) + 1;
      });
    }
  }
  return freq;
}

/**
 * 智能推荐：基于频率、新鲜度、多样性的综合排序
 * - 频率高 → 说明喜欢 → 加分
 * - 昨天刚做过 → 轻微降权（避免连续重复）
 * - 太久没做 → 略微降权（可能不喜欢）
 * @param {Number} days - 统计天数
 * @param {Number} maxItems - 最多返回数量
 * @returns {Array} - [{ name, score, frequency, lastDayIdx, relativeDay }]
 */
function getSmartRecommendations(days, maxItems) {
  days = days || MAX_HISTORY_DAYS;
  maxItems = maxItems || 10;
  var recent = getRecentHistory(days);
  if (!recent || recent.length === 0) return [];

  // 收集每道菜的出现记录
  var dishMap = {};
  for (var i = 0; i < recent.length; i++) {
    var day = recent[i];
    if (!day.menus) continue;
    for (var j = 0; j < day.menus.length; j++) {
      var name = day.menus[j].adultName;
      if (!name) continue;
      if (!dishMap[name]) {
        dishMap[name] = {
          name: name,
          frequency: 0,
          lastDayIdx: i,
          relativeDay: day.relativeDay,
          dateKey: day.dateKey
        };
      }
      dishMap[name].frequency++;
    }
  }

  // 计算综合分数
  var dishes = Object.keys(dishMap).map(function (name) {
    var d = dishMap[name];
    // 频率分：做过多次说明喜欢（上限3分）
    var freqScore = Math.min(d.frequency, 3);
    // 新鲜度惩罚：昨天刚做过的轻微降权（避免连续重复）
    var recencyPenalty = d.lastDayIdx === 0 ? -1.5 : 0;
    // 时间衰减：2天内做过的优先，太久远的降权
    var timeFactor = d.lastDayIdx <= 2 ? 1 : (d.lastDayIdx <= 4 ? 0.5 : 0.2);
    d.score = freqScore + recencyPenalty + timeFactor;
    return d;
  });

  // 按分数降序排列
  dishes.sort(function (a, b) { return b.score - a.score; });
  return dishes.slice(0, maxItems);
}

/**
 * 获取指定日期的历史记录
 * @param {String} dateKey - 日期 Key
 * @returns {Object|null}
 */
function getHistoryByDate(dateKey) {
  var history = getAllHistory();
  return history[dateKey] || null;
}

/**
 * 清空所有历史记录
 */
function clearAllHistory() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  getDateKey: getDateKey,
  getYesterdayKey: getYesterdayKey,
  formatDateDisplay: formatDateDisplay,
  getRelativeDay: getRelativeDay,
  saveToHistory: saveToHistory,
  getRecentHistory: getRecentHistory,
  wasEatenYesterday: wasEatenYesterday,
  getYesterdayDishes: getYesterdayDishes,
  getWeekDishNames: getWeekDishNames,
  getDishFrequency: getDishFrequency,
  getSmartRecommendations: getSmartRecommendations,
  getHistoryByDate: getHistoryByDate,
  clearAllHistory: clearAllHistory
};
