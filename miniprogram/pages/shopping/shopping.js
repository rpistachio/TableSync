var menuData = require('../../data/menuData.js');
var recipeResources = require('../../data/recipeResources.js');
var IMAGE_CONFIG = recipeResources.IMAGE_CONFIG;

var STORAGE_KEY_TODAY = 'tablesync_shopping_checked_today';
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

Page({
  data: {
    sortOptions: [{ text: '默认顺序', value: 'default' }, { text: '按食材种类', value: 'category' }],
    sortIndex: 0,
    sortMode: 'default',
    todayItems: [],
    groupedTodayItems: [],
    ingredientsList: [],
    currentDishName: '未选菜品',
    isEmpty: true,
    todayPrepTime: 0,
    todayAllergens: [],
    todayAllergensText: '',
    todayTips: [],
    heroCoverImage: ''
  },

  onLoad: function () {
    this.setData({ heroCoverImage: IMAGE_CONFIG.pageCovers.shopping });
    this.updateList();
  },

  onShow: function () {
    var list = wx.getStorageSync('cart_ingredients') || [];
    var dishName = wx.getStorageSync('selected_dish_name') || '未选菜品';
    var prepTime = wx.getStorageSync('today_prep_time');
    var allergensRaw = wx.getStorageSync('today_allergens');
    var allergens = [];
    try {
      if (allergensRaw) allergens = JSON.parse(allergensRaw);
      if (!Array.isArray(allergens)) allergens = [];
    } catch (e) {}

    this.setData({
      ingredientsList: list,
      currentDishName: dishName,
      isEmpty: list.length === 0,
      todayPrepTime: typeof prepTime === 'number' ? prepTime : 0,
      todayAllergens: allergens,
      todayAllergensText: Array.isArray(allergens) && allergens.length > 0 ? allergens.join('、') : ''
    });
  },

  updateList: function () {
    var pref = getPreference();
    var cart = wx.getStorageSync('cart_ingredients') || [];
    var isPlaceholder = Array.isArray(cart) && cart.length === 1 && cart[0].name === '请先生成菜单后查看清单';
    var todayItems = (Array.isArray(cart) && cart.length > 0 && !isPlaceholder)
      ? cart.slice()
      : menuData.generateShoppingList(pref);
    restoreChecked(todayItems, STORAGE_KEY_TODAY);

    // 为混合来源食材计算来源菜品文本描述
    todayItems.forEach(function (item) {
      if (Array.isArray(item.fromRecipes) && item.fromRecipes.length > 1) {
        item.fromRecipesText = item.fromRecipes.join('、');
      } else {
        item.fromRecipesText = '';
      }
    });

    var sortMode = this.data.sortMode;
    if (sortMode === 'category') {
      todayItems.sort(function (a, b) {
        if (a.category === b.category) return a.id - b.id;
        return (a.category || '').localeCompare(b.category || '', 'zh-CN');
      });
    } else {
      todayItems.sort(function (a, b) { return (a.order - b.order) || (a.id - b.id); });
    }

    var groupedToday = groupByCategory(todayItems);

    var hasFish = todayItems.some(function (it) { return (it.name || '').indexOf('鱼') !== -1; });
    var hasShrimp = todayItems.some(function (it) { return (it.name || '').indexOf('虾') !== -1; });
    var todayTips = [];
    if (hasFish) todayTips.push('记得让摊主处理好内脏和鱼鳞');
    if (hasShrimp) todayTips.push('可选冷冻虾仁或鲜虾');

    this.setData({
      todayItems: todayItems,
      groupedTodayItems: groupedToday,
      todayTips: todayTips
    });
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
      if (row.checked) {
        wx.vibrateShort({ type: 'light' });
      }
      persistChecked(items, STORAGE_KEY_TODAY);
      this.setData({ todayItems: items, groupedTodayItems: groupByCategory(items) });
    }
  },

  goToSteps: function () {
    wx.navigateTo({ url: '/pages/steps/steps' });
  }
});

