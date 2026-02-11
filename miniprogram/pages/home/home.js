var basket = require('../../data/inspirationBasket.js');
var menuHistory = require('../../utils/menuHistory.js');
var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');

function getCurrentDate() {
  var d = new Date();
  var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
}

function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

/** Phase 1: 简单问候，Phase 2 可替换为天气/时段模板 */
function getDefaultVibeGreeting() {
  var d = new Date();
  var weekDay = d.getDay();
  var hour = d.getHours();
  var isWeekend = weekDay === 0 || weekDay === 6;
  if (hour >= 6 && hour < 10) return '早安，今天也要好好吃饭';
  if (hour >= 10 && hour < 14) return '午安，想好晚上吃什么了吗';
  if (hour >= 14 && hour < 18) return '下午好，晚饭可以开始想想啦';
  if (isWeekend) return '周末愉快，做顿好吃的犒劳自己';
  return '下班后，来顿称心的晚餐吧';
}

// 冷启动角标：首帧即从 Storage 读 basketCount，避免 0→N 闪烁（spec 10.7 / Donut）
function getInitialBasketCount() {
  try {
    var todayKey = basket.getTodayDateKey();
    var storedKey = wx.getStorageSync(basket.BASKET_DATE_KEY) || '';
    if (storedKey === todayKey) {
      var raw = wx.getStorageSync(basket.STORAGE_KEY) || '';
      var list = basket.parseBasket(raw);
      return basket.getCount(list);
    }
  } catch (e) { /* ignore */ }
  return 0;
}

var HOME_BG_CLOUD_PATH = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/frontpage_stickers/Rona_Prompt_Ultra-minimalist_flat_layout_for_a_cooking_app_in_7f423079-ed33-4f7e-b466-c9bc4f6d174f_3.png';

Page({
  data: (function () {
    return {
      currentDate: getCurrentDate(),
      vibeWeather: '',
      vibeGreeting: getDefaultVibeGreeting(),
      basketCount: getInitialBasketCount(),
      showAdvanced: false,
      cookWho: 'self',
      cookStatus: 'ok',
      showHistoryHint: false,
      historyDishNames: [],
      homeBgUrl: ''
    };
  })(),

  onLoad: function () {
    var todayKey = getTodayDateKey();
    var storedKey = wx.getStorageSync('menu_generated_date') || '';
    if (storedKey && storedKey !== todayKey) {
      wx.removeStorageSync('today_menus');
      wx.removeStorageSync('menu_generated_date');
      wx.removeStorageSync('cart_ingredients');
      wx.removeStorageSync('selected_dish_name');
      wx.removeStorageSync('today_prep_time');
      wx.removeStorageSync('today_allergens');
    }
    var savedWho = wx.getStorageSync('zen_cook_who') || 'self';
    var savedStatus = wx.getStorageSync('zen_cook_status') || 'ok';
    this.setData({
      cookWho: savedWho,
      cookStatus: savedStatus
    });
  },

  onReady: function () {
    var that = this;
    if (wx.cloud && wx.cloud.getTempFileURL) {
      wx.cloud.getTempFileURL({
        fileList: [HOME_BG_CLOUD_PATH]
      }).then(function (res) {
        var url = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
        if (url) that.setData({ homeBgUrl: url });
      }).catch(function () {});
    }
  },

  onShow: function () {
    var that = this;
    getApp().onBasketChange = function (count) {
      if (count != null) that.setData({ basketCount: count });
    };
    this._refreshBasket();
  },

  onHide: function () {
    getApp().onBasketChange = null;
  },

  /**
   * 读取本地 Storage 中的灵感篮子数据，处理跨天清空，
   * 更新页面角标数字 & globalData 缓存。单次 setData 更新角标与历史推荐，减少卡顿。
   */
  _refreshBasket: function () {
    var todayKey = basket.getTodayDateKey();
    var storedDateKey = '';
    try { storedDateKey = wx.getStorageSync(basket.BASKET_DATE_KEY) || ''; } catch (e) { /* ignore */ }

    var list;
    if (storedDateKey && storedDateKey !== todayKey) {
      list = basket.emptyBasket();
      try {
        wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(list));
        wx.setStorageSync(basket.BASKET_DATE_KEY, todayKey);
      } catch (e) { /* ignore */ }
    } else {
      var raw = '';
      try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
      list = basket.parseBasket(raw);
      if (list.length > 0 && !storedDateKey) {
        try { wx.setStorageSync(basket.BASKET_DATE_KEY, todayKey); } catch (e) { /* ignore */ }
      }
    }

    var count = basket.getCount(list);
    var showHistoryHint = false;
    var historyDishNames = [];
    if (count === 0) {
      var recs = menuHistory.getSmartRecommendations(7, 3);
      if (recs && recs.length > 0) {
        showHistoryHint = true;
        historyDishNames = recs.map(function (r) { return r.name; });
      }
    }
    this.setData({ basketCount: count, showHistoryHint: showHistoryHint, historyDishNames: historyDishNames });

    var app = getApp();
    if (app && app.globalData) app.globalData.inspirationBasket = list;
  },

  /** Zen Mode: 大按钮 -> 自动生成菜谱并进入 preview 页（不跳转今日灵感/spinner） */
  onZenGo: function () {
    if (this._zenGenerating) return;
    this._zenGenerating = true;
    wx.showLoading({ title: '生成中...' });
    var that = this;
    var pref = that._buildZenPreference();
    var moodText = that.data.cookStatus === 'tired' ? '疲惫' : '随便';
    var source = menuData.getRecipeSource && menuData.getRecipeSource();
    var adultRecipes = (source && source.adultRecipes) || [];
    var candidates = adultRecipes.slice(0, 100).map(function (r) {
      return {
        id: r.id || r._id,
        _id: r._id || r.id,
        name: r.name,
        meat: r.meat,
        cook_type: r.cook_type,
        flavor_profile: r.flavor_profile,
        dish_type: r.dish_type
      };
    });
    var basketItems = [];
    try {
      var raw = wx.getStorageSync(basket.STORAGE_KEY) || '';
      var bList = basket.parseBasket(raw);
      for (var bi = 0; bi < bList.length; bi++) {
        var bItem = bList[bi];
        basketItems.push({
          id: bItem.id,
          name: bItem.name,
          source: bItem.source,
          priority: bItem.priority || 'normal',
          meat: bItem.meat
        });
      }
    } catch (e) {}
    wx.cloud.callFunction({
      name: 'smartMenuGen',
      data: {
        preference: pref,
        mood: moodText,
        weather: {},
        recentDishNames: '',
        candidates: candidates,
        basketItems: basketItems.length > 0 ? basketItems : undefined
      }
    }).then(function (res) {
      var out = res.result;
      if (out && out.code === 0 && out.data && Array.isArray(out.data.recipeIds) && out.data.recipeIds.length > 0) {
        getApp().globalData.chefReportText = (out.data && out.data.reasoning) || '';
        getApp().globalData.dishHighlights = (out.data && out.data.dishHighlights) || {};
        getApp().globalData.lastBasketItems = basketItems.length > 0 ? basketItems : [];
        var menus = that._zenRecipeIdsToMenus(out.data.recipeIds, pref);
        if (menus.length > 0) {
          that._zenNavigateToPreview(menus, pref);
          return;
        }
      }
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      getApp().globalData.lastBasketItems = [];
      that._zenApplyLocalMenus(pref);
    }).catch(function () {
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      getApp().globalData.lastBasketItems = [];
      that._zenApplyLocalMenus(pref);
    });
  },

  /** Zen 默认偏好：2 人、1 荤 1 素、无汤、无宝宝；很累时省时模式 */
  _buildZenPreference: function () {
    var status = this.data.cookStatus;
    return {
      adultCount: 2,
      hasBaby: false,
      babyMonth: 12,
      meatCount: 1,
      vegCount: 1,
      soupCount: 0,
      soupType: null,
      avoidList: [],
      dietStyle: 'home',
      isTimeSave: status === 'tired'
    };
  },

  /** 将 AI 返回的 recipeIds 转成菜单数组（与 spinner _applyAiMenus 一致） */
  _zenRecipeIdsToMenus: function (recipeIds, pref) {
    var hasBaby = pref.hasBaby === true;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || 2;
    var firstMeatIndex = -1;
    var menus = [];
    for (var i = 0; i < recipeIds.length; i++) {
      var recipe = menuData.getAdultRecipeById && menuData.getAdultRecipeById(recipeIds[i]);
      if (!recipe) continue;
      if (firstMeatIndex < 0 && recipe.meat !== 'vegetable') firstMeatIndex = menus.length;
      var hasBabyThis = hasBaby && recipe.meat !== 'vegetable' && menus.length === firstMeatIndex;
      var slot = menuGen.generateMenuFromRecipe(recipe, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
      menus.push({
        meat: (slot.adultRecipe && slot.adultRecipe.meat) || recipe.meat,
        taste: (slot.adultRecipe && slot.adultRecipe.taste) || '',
        adultRecipe: slot.adultRecipe || null,
        babyRecipe: hasBaby ? (slot.babyRecipe || null) : null,
        checked: true
      });
    }
    menus.forEach(function (m) {
      if (m.adultRecipe && m.adultRecipe.name) {
        m.adultRecipe.coverImage = recipeCoverSlugs.getRecipeCoverImageUrl(m.adultRecipe.name);
      }
    });
    return menus;
  },

  /** 本地降级生成菜单，然后跳转 preview */
  _zenApplyLocalMenus: function (pref) {
    var that = this;
    try {
      var result = menuData.getTodayMenusByCombo(pref);
      var menus = result.menus || result;
      if (!menus || menus.length === 0) {
        throw new Error('未匹配到符合条件的菜谱');
      }
      menus.forEach(function (m) {
        m.checked = true;
        if (m.adultRecipe && m.adultRecipe.name) {
          m.adultRecipe.coverImage = recipeCoverSlugs.getRecipeCoverImageUrl(m.adultRecipe.name);
        }
      });
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      that._zenNavigateToPreview(menus, pref);
    } catch (err) {
      that._zenGenerating = false;
      wx.hideLoading();
      wx.showModal({ title: '生成失败', content: err.message || '请稍后重试', showCancel: false });
    }
  },

  /** 写入 Storage 与 globalData，并跳转 preview（与 spinner _prepareAndNavigate 一致） */
  _zenNavigateToPreview: function (menus, pref) {
    this._zenGenerating = false;
    wx.hideLoading();
    getApp().globalData.preference = pref;
    getApp().globalData.todayMenus = menus;
    var shoppingList = menuData.generateShoppingListFromMenus(pref, menus);
    wx.setStorageSync('cart_ingredients', shoppingList || []);
    wx.setStorageSync('today_menus', JSON.stringify(menus));
    wx.setStorageSync('menu_generated_date', getTodayDateKey());
    var maxPrepTime = 0;
    menus.forEach(function (m) {
      var p = (m.adultRecipe && m.adultRecipe.prep_time) || 0;
      if (p > maxPrepTime) maxPrepTime = p;
    });
    wx.setStorageSync('today_prep_time', maxPrepTime);
    var payload = menuData.buildPreviewPayload(menus, pref, {
      comboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : ''),
      countText: menus.length + '道菜'
    });
    getApp().globalData.menuPreview = {
      menus: menus,
      rows: payload.rows,
      dashboard: payload.dashboard,
      countText: payload.countText,
      comboName: payload.comboName,
      balanceTip: payload.balanceTip,
      hasSharedBase: payload.hasSharedBase,
      preference: pref
    };
    wx.redirectTo({ url: '/pages/preview/preview' });
  },

  /** Zen Mode: 切换谁做饭 */
  onToggleCookWho: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ cookWho: val });
    wx.setStorageSync('zen_cook_who', val);
  },

  /** Zen Mode: 切换今日状态 */
  onToggleCookStatus: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ cookStatus: val });
    wx.setStorageSync('zen_cook_status', val);
  },

  /** 展开高级功能入口 */
  onShowAdvanced: function () {
    this.setData({ showAdvanced: true });
  },

  /** 返回 Zen Mode */
  onHideAdvanced: function () {
    this.setData({ showAdvanced: false });
  },

  /** 跳转到「今天吃什么」Spinner 页 */
  onGoSpinner: function () {
    wx.navigateTo({ url: '/pages/spinner/spinner' });
  },

  onGoScan: function () {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  onGoImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  },

  onGoMix: function () {
    wx.navigateTo({ url: '/pages/mix/mix' });
  },

  onGoMyRecipes: function () {
    wx.navigateTo({ url: '/pages/myRecipes/myRecipes' });
  },

  /** 跳转到灵感篮子管理页 */
  onGoBasketPreview: function () {
    wx.navigateTo({ url: '/pages/basketPreview/basketPreview' });
  }
});
