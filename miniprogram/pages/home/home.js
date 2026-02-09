var basket = require('../../data/inspirationBasket.js');
var menuHistory = require('../../utils/menuHistory.js');

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
    this._pageAlive = true;
    getApp().onBasketChange = function (count) {
      if (that._pageAlive && count != null) that.setData({ basketCount: count });
    };
    this._refreshBasketAsync();
  },

  onHide: function () {
    this._pageAlive = false;
    getApp().onBasketChange = null;
  },
  
  onUnload: function () {
    this._pageAlive = false;
    getApp().onBasketChange = null;
  },

  /**
   * 先快速更新角标与跨天清空，再异步拉取历史推荐，避免首帧卡顿。
   */
  _refreshBasketAsync: function () {
    var that = this;
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
    var app = getApp();
    if (app && app.globalData) app.globalData.inspirationBasket = list;

    // 先只更新角标，保证首帧不卡
    that.setData({ basketCount: count });

    // 历史推荐较耗时，延后执行，避免阻塞滚动/交互
    if (count === 0) {
      setTimeout(function () {
        if (!that._pageAlive) return;
        var recs = menuHistory.getSmartRecommendations(7, 3);
        var showHistoryHint = false;
        var historyDishNames = [];
        if (recs && recs.length > 0) {
          showHistoryHint = true;
          historyDishNames = recs.map(function (r) { return r.name; });
        }
        that.setData({ showHistoryHint: showHistoryHint, historyDishNames: historyDishNames });
      }, 0);
    } else {
      that.setData({ showHistoryHint: false, historyDishNames: [] });
    }
  },

  /**
   * Zen Mode: 「想想吃什么」→ 直接生成菜谱并进入 preview（不经过今日灵感页）。
   * 遵循 spec 3.1：先尝试 smartMenuGen，失败则本地 getTodayMenusByCombo 降级。
   */
  onZenGo: function () {
    var that = this;
    if (that._zenGenerating) return;
    that._zenGenerating = true;
    wx.showLoading({ title: '生成中...' });

    // 按需加载大模块，避免首页首帧卡顿（R-10 模块路径）
    var menuData = require('../../data/menuData.js');
    var menuGen = require('../../data/menuGenerator.js');
    var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');

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
    } catch (e) { /* ignore */ }

    var recentDishNames = '';
    try {
      var stored = wx.getStorageSync('today_menus');
      var dateKey = wx.getStorageSync('menu_generated_date');
      if (dateKey && dateKey !== getTodayDateKey() && stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          recentDishNames = parsed.map(function (m) {
            return (m.adultRecipe && m.adultRecipe.name) || '';
          }).filter(Boolean).join('、');
        }
      }
    } catch (e) {}

    function finish(menus, fallbackMsg) {
      if (!menus || menus.length === 0) {
        wx.hideLoading();
        that._zenGenerating = false;
        return;
      }
      if (fallbackMsg) wx.showToast({ title: fallbackMsg, icon: 'none', duration: 2500 });
      that._zenNavigateToPreview(menus, pref);
      wx.hideLoading();
      that._zenGenerating = false;
    }

    if (!wx.cloud || !wx.cloud.callFunction) {
      var localResult = that._zenApplyLocalMenus(pref, menuData, menuGen, recipeCoverSlugs);
      if (localResult.menus) finish(localResult.menus, localResult.fallbackMessage);
      else {
        wx.hideLoading();
        that._zenGenerating = false;
      }
      return;
    }

    wx.cloud.callFunction({
      name: 'smartMenuGen',
      data: {
        preference: pref,
        mood: moodText,
        weather: {},
        recentDishNames: recentDishNames,
        candidates: candidates,
        basketItems: basketItems.length > 0 ? basketItems : undefined
      }
    }).then(function (res) {
      var out = res.result;
      if (out && out.code === 0 && out.data && Array.isArray(out.data.recipeIds) && out.data.recipeIds.length > 0) {
        var reasoning = (out.data && out.data.reasoning) || '';
        var dishHighlights = (out.data && out.data.dishHighlights) || {};
        getApp().globalData.chefReportText = reasoning;
        getApp().globalData.dishHighlights = dishHighlights;
        getApp().globalData.lastBasketItems = basketItems.length > 0 ? basketItems : [];
        var menus = that._zenRecipeIdsToMenus(out.data.recipeIds, pref, menuData, menuGen, recipeCoverSlugs);
        if (menus && menus.length > 0) {
          finish(menus);
          return;
        }
      }
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      getApp().globalData.lastBasketItems = [];
      var localResult = that._zenApplyLocalMenus(pref, menuData, menuGen, recipeCoverSlugs);
      if (localResult.menus) finish(localResult.menus, localResult.fallbackMessage);
      else {
        wx.hideLoading();
        that._zenGenerating = false;
      }
    }).catch(function () {
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      getApp().globalData.lastBasketItems = [];
      var localResult = that._zenApplyLocalMenus(pref, menuData, menuGen, recipeCoverSlugs);
      if (localResult.menus) finish(localResult.menus, localResult.fallbackMessage);
      else {
        wx.hideLoading();
        that._zenGenerating = false;
      }
    });
  },

  /** Zen 默认偏好：2 人、1 荤 1 素、无汤、无宝宝；cookStatus=tired 时省时模式（spec 4.3） */
  _buildZenPreference: function () {
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
      isTimeSave: this.data.cookStatus === 'tired'
    };
  },

  /** 将 AI 返回的 recipeIds 转为 menus（与 spinner _applyAiMenus 逻辑一致） */
  _zenRecipeIdsToMenus: function (recipeIds, pref, menuData, menuGen, recipeCoverSlugs) {
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

  /** 本地降级生成菜单（spec 5.1），返回 { menus, fallbackMessage } 或 { menus: null } */
  _zenApplyLocalMenus: function (pref, menuData, menuGen, recipeCoverSlugs) {
    try {
      try {
        var stored = wx.getStorageSync('today_menus');
        if (stored) {
          var parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            pref.excludeRecipeNames = parsed.map(function (m) {
              return (m.adultRecipe && m.adultRecipe.name) || '';
            }).filter(Boolean);
          }
        }
      } catch (e) {}
      var result = menuData.getTodayMenusByCombo(pref);
      var menus = result.menus || result;
      if (!menus || menus.length === 0) throw new Error('未匹配到符合条件的菜谱');
      var hasBaby = pref.hasBaby === true;
      menus.forEach(function (m) {
        m.checked = true;
        if (!hasBaby) m.babyRecipe = null;
        if (m.adultRecipe && m.adultRecipe.name) {
          m.adultRecipe.coverImage = recipeCoverSlugs.getRecipeCoverImageUrl(m.adultRecipe.name);
        }
      });
      return { menus: menus, fallbackMessage: result.fallbackMessage || '' };
    } catch (err) {
      wx.showModal({ title: '生成失败', content: err.message || '请稍后重试', showCancel: false });
      return { menus: null };
    }
  },

  /** 写入 Storage 与 globalData 后跳转 preview（与 spinner _prepareAndNavigate 一致，spec 3.1） */
  _zenNavigateToPreview: function (menus, pref) {
    var menuData = require('../../data/menuData.js');
    getApp().globalData.preference = pref;
    getApp().globalData.todayMenus = menus;

    // #region agent log
    if (typeof fetch === 'function') {
      fetch('http://127.0.0.1:7243/ingest/2601ac33-4192-4086-adc2-d77ecd51bad3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'F',location:'home.js:_zenNavigateToPreview',message:'about to generate shopping list',data:{menuCount:Array.isArray(menus)?menus.length:null,sample:Array.isArray(menus)?menus.slice(0,3).map(function(m){return {name:(m.adultRecipe&&m.adultRecipe.name)||'',adultIng:Array.isArray(m.adultRecipe&&m.adultRecipe.ingredients)?m.adultRecipe.ingredients.length:null};}):[]},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
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
