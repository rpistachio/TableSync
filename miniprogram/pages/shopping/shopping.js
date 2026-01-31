var menuData = require('../../data/menuData.js');

var STORAGE_KEY_TODAY = 'tablesync_shopping_checked_today';
var STORAGE_KEY_WEEKLY = 'tablesync_shopping_checked_weekly';
var MEAT_KEY_MAP = menuData.MEAT_KEY_MAP;

function getPreference() {
  var app = getApp();
  var p = app.globalData.preference || {};
  var rawMeat = p.meat;
  var meat = (rawMeat && MEAT_KEY_MAP[rawMeat]) ? MEAT_KEY_MAP[rawMeat] : (rawMeat || 'chicken');
  return {
    taste: p.taste || 'light',
    meat: meat,
    adultCount: Number(p.adultCount) || 2,
    babyMonth: Number(p.babyMonth) || 6,
    hasBaby: p.hasBaby === '1' || p.hasBaby === true
  };
}

function buildWeeklyPreferences() {
  var pref = getPreference();
  var meatKey = (typeof pref.meat === 'string' && /[\u4e00-\u9fa5]/.test(pref.meat)) ? (MEAT_KEY_MAP[pref.meat] || 'chicken') : (pref.meat || 'chicken');
  var arr = [];
  for (var i = 0; i < 7; i++) {
    arr.push({ taste: pref.taste, meat: meatKey, adultCount: pref.adultCount, babyMonth: pref.babyMonth, hasBaby: pref.hasBaby });
  }
  return arr;
}

function loadCheckedStorage(key) {
  try {
    var raw = wx.getStorageSync(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function restoreChecked(items, key) {
  var map = loadCheckedStorage(key);
  items.forEach(function (it) {
    if (Object.prototype.hasOwnProperty.call(map, it.name)) it.checked = !!map[it.name];
  });
}

function persistChecked(items, key) {
  try {
    var map = {};
    items.forEach(function (it) { map[it.name] = it.checked; });
    wx.setStorageSync(key, JSON.stringify(map));
  } catch (e) {}
}

function groupByCategory(list) {
  var map = new Map();
  list.forEach(function (item) {
    var c = item.category || '其他';
    if (!map.has(c)) map.set(c, { category: c, items: [] });
    map.get(c).items.push(item);
  });
  return Array.from(map.values());
}

function isWeeklyCore(item) {
  var c = (item.category || '').trim();
  var n = (item.name || '').trim();
  if (c === '肉类' || c === '蛋类') return true;
  if (/排骨|鳕鱼|鱼肉|鸡肉|猪肉|牛肉|虾仁|鸡腿|牛里脊/i.test(n)) return true;
  return false;
}

Page({
  data: {
    listMode: 'today',
    sortOptions: [{ text: '默认顺序', value: 'default' }, { text: '按食材种类', value: 'category' }],
    sortIndex: 0,
    sortMode: 'default',
    todayItems: [],
    weeklyItems: [],
    groupedTodayItems: [],
    groupedWeeklyItems: [],
    weeklyNoticeText: '',
    ingredientsList: [],
    currentDishName: '未选菜品',
    isEmpty: true
  },

  onLoad: function () {
    this.updateList();
  },

  onShow: function () {
    // 从缓存读取首页存入的配料
    var list = wx.getStorageSync('cart_ingredients') || [];
    var dishName = wx.getStorageSync('selected_dish_name') || '未选菜品';

    this.setData({
      ingredientsList: list,
      currentDishName: dishName,
      isEmpty: list.length === 0
    });
  },

  updateList: function () {
    var pref = getPreference();
    var weeklyPrefs = buildWeeklyPreferences();
    var todayItems = menuData.generateShoppingList(pref);
    var weeklyItems = wx.getStorageSync('weekly_ingredients') || [];
    if (!Array.isArray(weeklyItems) || weeklyItems.length === 0) {
      weeklyItems = menuData.generateWeeklyShoppingList(weeklyPrefs);
    }
    todayItems.forEach(function (it) { it.isWeeklyCore = false; });
    weeklyItems.forEach(function (it) { it.isWeeklyCore = isWeeklyCore(it); });
    restoreChecked(todayItems, STORAGE_KEY_TODAY);
    restoreChecked(weeklyItems, STORAGE_KEY_WEEKLY);

    var sortMode = this.data.sortMode;
    if (sortMode === 'category') {
      todayItems.sort(function (a, b) {
        if (a.category === b.category) return a.id - b.id;
        return (a.category || '').localeCompare(b.category || '', 'zh-CN');
      });
      weeklyItems.sort(function (a, b) {
        if (a.category === b.category) return a.id - b.id;
        return (a.category || '').localeCompare(b.category || '', 'zh-CN');
      });
    } else {
      todayItems.sort(function (a, b) { return (a.order - b.order) || (a.id - b.id); });
      weeklyItems.sort(function (a, b) { return (a.order - b.order) || (a.id - b.id); });
    }

    var groupedToday = groupByCategory(todayItems);
    var groupedWeekly = groupByCategory(weeklyItems);

    var meatCount = weeklyItems.filter(function (it) { return (it.category || '') === '肉类'; }).length;
    var weeklyNoticeText = weeklyItems.length === 0 ? '本周暂无食材数据，请先生成菜单。' : (meatCount > 0 ? '本周经营建议：本周共需肉类主料 ' + meatCount + ' 种，建议周一集中采购，分装冷冻可节省 30% 备菜时间。' : '本周经营建议：建议周一集中采购，按需分装冷藏/冷冻，可节省备菜时间。');

    this.setData({
      todayItems: todayItems,
      weeklyItems: weeklyItems,
      groupedTodayItems: groupedToday,
      groupedWeeklyItems: groupedWeekly,
      weeklyNoticeText: weeklyNoticeText
    });
  },

  onTabChange: function (e) {
    var mode = e.currentTarget.dataset.mode;
    this.setData({ listMode: mode });
    this.updateList();
  },

  onSortChange: function (e) {
    var idx = parseInt(e.detail.value, 10);
    var mode = this.data.sortOptions[idx].value;
    this.setData({ sortIndex: idx, sortMode: mode });
    this.updateList();
  },

  onCheckToday: function (e) {
    var item = e.currentTarget.dataset.item;
    var items = this.data.todayItems;
    var row = items.find(function (it) { return it.id === item.id; });
    if (row) {
      row.checked = !row.checked;
      persistChecked(items, STORAGE_KEY_TODAY);
      this.setData({ todayItems: items, groupedTodayItems: groupByCategory(items) });
    }
  },

  onCheckWeekly: function (e) {
    var item = e.currentTarget.dataset.item;
    var items = this.data.weeklyItems;
    var row = items.find(function (it) { return it.id === item.id; });
    if (row) {
      row.checked = !row.checked;
      persistChecked(items, STORAGE_KEY_WEEKLY);
      this.setData({ weeklyItems: items, groupedWeeklyItems: groupByCategory(items) });
    }
  },

  isWeeklyCore: function (row) {
    return isWeeklyCore(row);
  },

  copyList: function () {
    var listMode = this.data.listMode;
    var items = listMode === 'today' ? this.data.todayItems : this.data.weeklyItems;
    var lines = items.filter(function (item) { return !item.checked; }).map(function (item) { return item.name + ' ' + item.amount; });
    var text = lines.join('\n');
    var hint = listMode === 'today' ? '今日无需采购食材' : '本周无需采购食材';
    wx.setClipboardData({
      data: text || hint,
      success: function () { wx.showToast({ title: '清单已复制，可粘贴到微信或备忘录' }); },
      fail: function () { wx.showToast({ title: '复制失败', icon: 'none' }); }
    });
  }
});
