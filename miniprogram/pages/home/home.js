var menuHistory = require('../../utils/menuHistory.js');
var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');
var recipeResources = require('../../data/recipeResources.js');
var vibeGreeting = require('../../utils/vibeGreeting.js');
var seedUserService = require('../../utils/seedUserService.js');

/** 首页云图 HTTP 直链（可直接用于 <image> src） */
var HOME_HTTP_ROOT = (recipeResources.CLOUD_HTTP_ROOT || '') + '/background_pic';
var HOME_ILLUSTRATION_URL = HOME_HTTP_ROOT + '/home_background.png';
var HOME_OK_ICON_URL = HOME_HTTP_ROOT + '/feeling_ok_button.png';
var HOME_TIRED_ICON_URL = HOME_HTTP_ROOT + '/feeling_tired_button.png';

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

Page({
  data: (function () {
    // 书脊时段模式初始值
    var _hour = new Date().getHours();
    var _initSpineMode = 'spine-day';
    if (_hour >= 22 || _hour < 5) _initSpineMode = 'spine-night';
    else if (_hour >= 5 && _hour < 9) _initSpineMode = 'spine-morning';
    var _initSealIcon = (_hour >= 22 || _hour < 5) ? '🪔' : '🔖';

    return {
      currentDate: getCurrentDate(),
      vibeGreeting: vibeGreeting.pickGreeting(null),
      showAdvanced: false,
      cookWho: 'self',
      cookStatus: 'ok',
      illustrationUrl: '',
      okIconUrl: '',
      tiredIconUrl: '',
      showStickerDrop: false,
      stickerDropQueue: [],    // [{ stickerId, name, emoji }]
      showCookingLoading: false,
      // ====== 烟火集悬浮书脊 ======
      spineMode: _initSpineMode,      // spine-day / spine-morning / spine-night / spine-night-tired
      spineSealIcon: _initSealIcon,    // 🔖 常规 / 🪔 深夜疲惫小油灯
      hasUnviewedCooks: false,         // 有新烹饪记录未查看 → 微光呼吸
      spineHighlight: false            // 贴纸收下后短暂高亮
    };
  })(),

  onLoad: function (options) {
    var todayKey = getTodayDateKey();
    var storedKey = wx.getStorageSync('menu_generated_date') || '';
    // 过期日清理延后执行，不阻塞首屏
    if (storedKey && storedKey !== todayKey) {
      setTimeout(function () {
        wx.removeStorageSync('today_menus');
        wx.removeStorageSync('menu_generated_date');
        wx.removeStorageSync('cart_ingredients');
        wx.removeStorageSync('selected_dish_name');
        wx.removeStorageSync('today_prep_time');
        wx.removeStorageSync('today_allergens');
      }, 0);
    }
    var savedStatus = wx.getStorageSync('zen_cook_status') || 'ok';
    var hour = new Date().getHours();
    var isTired = savedStatus === 'tired';
    var spineMode = 'spine-day';
    var spineSealIcon = '🔖';
    if ((hour >= 22 || hour < 5) && isTired) {
      spineMode = 'spine-night-tired';
      spineSealIcon = '🪔';
    } else if (hour >= 22 || hour < 5) {
      spineMode = 'spine-night';
    } else if (hour >= 5 && hour < 9) {
      spineMode = 'spine-morning';
    }
    this.setData({
      cookStatus: savedStatus,
      spineMode: spineMode,
      spineSealIcon: spineSealIcon
    });

    // ====== 种子用户：渠道追踪 + 先锋主厨问候语 ======
    var that = this;
    // 如果从分享链接进入首页，解析 channel 参数
    if (options && options.channel) {
      seedUserService.saveChannel(options.channel);
    }
    // 等待种子用户信息就绪后刷新问候语
    that._refreshPioneerGreeting();
    // 首页云图使用 HTTP 直链，直接 setData
    that.setData({
      illustrationUrl: HOME_ILLUSTRATION_URL,
      okIconUrl: HOME_OK_ICON_URL,
      tiredIconUrl: HOME_TIRED_ICON_URL
    });
  },

  onShow: function () {
    var that = this;
    this._homeShowTime = Date.now();
    this._toggleCount = 0;
    // 延后书脊/未读检测并合并为一次 setData，避免阻塞首屏
    setTimeout(function () {
      that._refreshSpineAndUnviewed();
    }, 0);
  },

  /** Zen Mode: 大按钮 -> 自动生成菜谱并进入 preview 页（不跳转今日灵感/spinner） */
  onZenGo: function () {
    if (this._zenGenerating) return;
    this._zenGenerating = true;

    // ====== 犹豫检测：停留 > 60s 或切换 >= 3 次 → 标记为犹豫 ======
    var dwellTime = this._homeShowTime ? (Date.now() - this._homeShowTime) : 0;
    var toggleCount = this._toggleCount || 0;
    if (dwellTime > 60000 || toggleCount >= 3) {
      getApp().globalData._hesitantStart = true;
    }
    // 重置追踪（下次回来重新计）
    this._homeShowTime = Date.now();
    this._toggleCount = 0;

    this.setData({ showCookingLoading: true });
    var that = this;
    var pref = that._buildZenPreference();
    var moodText = that.data.cookStatus === 'tired' ? '疲惫' : '随便';
    var source = menuData.getRecipeSource && menuData.getRecipeSource();
    var adultRecipes = (source && source.adultRecipes) || [];
    var candidates = adultRecipes.slice(0, 50).map(function (r) {
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
    wx.cloud.callFunction({
      name: 'smartMenuGen',
      data: {
        preference: pref,
        mood: moodText,
        weather: {},
        recentDishNames: '',
        candidates: candidates
      }
    }).then(function (res) {
      var out = res.result;
      if (out && out.code === 0 && out.data && Array.isArray(out.data.recipeIds) && out.data.recipeIds.length > 0) {
        getApp().globalData.chefReportText = (out.data && out.data.reasoning) || '';
        getApp().globalData.dishHighlights = (out.data && out.data.dishHighlights) || {};
        var menus = that._zenRecipeIdsToMenus(out.data.recipeIds, pref);
        if (menus.length > 0) {
          that._zenNavigateToPreview(menus, pref);
          return;
        }
      }
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      that._zenApplyLocalMenus(pref);
    }).catch(function () {
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      that._zenApplyLocalMenus(pref);
    });
  },

  /** Zen 默认偏好：2 人、1 荤 1 素、无汤、无宝宝；很累时省时模式 + 空气炸锅强制 */
  _buildZenPreference: function () {
    var status = this.data.cookStatus;
    var who = this.data.cookWho;
    var isTired = status === 'tired';
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
      isTimeSave: isTired,
      // 疲惫模式：强制开启空气炸锅（即使用户未在厨房配置中勾选）
      kitchenConfig: {
        burners: 2,
        hasSteamer: false,
        hasAirFryer: isTired,   // 疲惫时强制启用空气炸锅
        hasOven: false
      },
      // 2026 扩展：执行者角色（cookWho 始终为 self，不传 caregiver）
      who: undefined
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
      that.setData({ showCookingLoading: false });
      wx.showModal({ title: '生成失败', content: err.message || '请稍后重试', showCancel: false });
    }
  },

  /** 写入 Storage 与 globalData，并跳转 preview（异步 Storage 不阻塞主线程） */
  _zenNavigateToPreview: function (menus, pref) {
    this._zenGenerating = false;
    this.setData({ showCookingLoading: false });
    getApp().globalData.preference = pref;
    getApp().globalData.todayMenus = menus;
    var shoppingList = menuData.generateShoppingListFromMenus(pref, menus);
    var slimMenus = menuData.serializeMenusForStorage && menuData.serializeMenusForStorage(menus);
    var todayMenusStr = JSON.stringify(slimMenus && slimMenus.length > 0 ? slimMenus : menus);
    var maxPrepTime = 0;
    menus.forEach(function (m) {
      var p = (m.adultRecipe && m.adultRecipe.prep_time) || 0;
      if (p > maxPrepTime) maxPrepTime = p;
    });
    var todayKey = getTodayDateKey();
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
    var that = this;
    var setStorage = function (key, val) {
      return new Promise(function (resolve, reject) {
        wx.setStorage({
          key: key,
          data: val,
          success: resolve,
          fail: reject
        });
      });
    };
    Promise.all([
      setStorage('cart_ingredients', shoppingList || []),
      setStorage('today_menus', todayMenusStr),
      setStorage('today_menus_preference', JSON.stringify(pref)),
      setStorage('menu_generated_date', todayKey),
      setStorage('today_prep_time', maxPrepTime)
    ]).then(function () {
      wx.redirectTo({ url: '/pages/preview/preview' });
    }).catch(function () {
      wx.redirectTo({ url: '/pages/preview/preview' });
    });
  },

  /** Zen Mode: 切换今日状态 */
  onToggleCookStatus: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ cookStatus: val });
    wx.setStorageSync('zen_cook_status', val);
    // 犹豫追踪：累计切换次数
    this._toggleCount = (this._toggleCount || 0) + 1;
    // 书脊：状态切换影响深夜油灯模式
    this._updateSpineMode();
  },

  /** 展开高级功能入口 */
  onShowAdvanced: function () {
    this.setData({ showAdvanced: true });
  },

  /** 返回 Zen Mode */
  onHideAdvanced: function () {
    this.setData({ showAdvanced: false });
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

  onStickerDropClose: function () {
    this.setData({ showStickerDrop: false, stickerDropQueue: [] });
    // 书脊：贴纸收下后，火漆印章短暂高亮 → 暗示"已收入烟火集"
    var that = this;
    that.setData({ spineHighlight: true });
    setTimeout(function () {
      that.setData({ spineHighlight: false });
    }, 1300);
    // 同时刷新微光状态
    this._checkUnviewedCooks();
  },

  onGoCollection: function () {
    wx.navigateTo({ url: '/pages/collection/collection' });
  },

  // ====== 书脊：时段模式判断 ======
  _updateSpineMode: function () {
    var hour = new Date().getHours();
    var isTired = this.data.cookStatus === 'tired';
    var mode = 'spine-day';
    var sealIcon = '🔖';

    if ((hour >= 22 || hour < 5) && isTired) {
      mode = 'spine-night-tired';
      sealIcon = '🪔';       // 小油灯
    } else if (hour >= 22 || hour < 5) {
      mode = 'spine-night';
      sealIcon = '🔖';
    } else if (hour >= 5 && hour < 9) {
      mode = 'spine-morning';
      sealIcon = '🔖';
    }

    if (mode !== this.data.spineMode || sealIcon !== this.data.spineSealIcon) {
      this.setData({ spineMode: mode, spineSealIcon: sealIcon });
    }
  },

  /** 书脊 + 未读检测合并为一次异步读 + 一次 setData */
  _refreshSpineAndUnviewed: function () {
    var that = this;
    var keys = ['last_cook_complete_time', 'last_view_collection_time'];
    Promise.all(keys.map(function (k) {
      return new Promise(function (resolve) {
        wx.getStorage({
          key: k,
          success: function (res) { resolve(res.data); },
          fail: function () { resolve(0); }
        });
      });
    })).then(function (vals) {
      var lastCookTime = vals[0] || 0;
      var lastViewTime = vals[1] || 0;
      var hasUnviewed = lastCookTime > 0 && lastCookTime > lastViewTime;
      var hour = new Date().getHours();
      var isTired = that.data.cookStatus === 'tired';
      var mode = 'spine-day';
      var sealIcon = '🔖';
      if ((hour >= 22 || hour < 5) && isTired) {
        mode = 'spine-night-tired';
        sealIcon = '🪔';
      } else if (hour >= 22 || hour < 5) {
        mode = 'spine-night';
      } else if (hour >= 5 && hour < 9) {
        mode = 'spine-morning';
      }
      var patch = {};
      if (hasUnviewed !== that.data.hasUnviewedCooks) patch.hasUnviewedCooks = hasUnviewed;
      if (mode !== that.data.spineMode) patch.spineMode = mode;
      if (sealIcon !== that.data.spineSealIcon) patch.spineSealIcon = sealIcon;
      if (Object.keys(patch).length) that.setData(patch);
    });
  },

  // ====== 书脊：检测是否有新烹饪记录未查看（微光呼吸） ======
  _checkUnviewedCooks: function () {
    var lastCookTime = wx.getStorageSync('last_cook_complete_time') || 0;
    var lastViewTime = wx.getStorageSync('last_view_collection_time') || 0;
    var hasUnviewed = lastCookTime > 0 && lastCookTime > lastViewTime;
    if (hasUnviewed !== this.data.hasUnviewedCooks) {
      this.setData({ hasUnviewedCooks: hasUnviewed });
    }
  },

  // ====== 种子用户：先锋主厨问候语刷新 ======
  _refreshPioneerGreeting: function () {
    var that = this;
    // 优先使用本地缓存（秒级响应）
    var localInfo = seedUserService.getLocalSeedInfo();
    if (localInfo && localInfo.seq > 0 && localInfo.seq <= 100) {
      that.setData({
        vibeGreeting: vibeGreeting.pickGreeting(null, localInfo)
      });
      return;
    }
    // 等待 app.js 中异步注册完成
    var app = getApp();
    var checkInterval = setInterval(function () {
      var seedUser = app.globalData.seedUser;
      if (seedUser) {
        clearInterval(checkInterval);
        if (seedUser.seq > 0 && seedUser.seq <= 100) {
          that.setData({
            vibeGreeting: vibeGreeting.pickGreeting(null, seedUser)
          });
        }
      }
    }, 500);
    // 最多等 5 秒，超时则保持默认问候语
    setTimeout(function () {
      clearInterval(checkInterval);
    }, 5000);
  },

  // ====== 分享到好友：附带 channel 参数 ======
  onShareAppMessage: function () {
    return {
      title: 'TableSync - 想想今晚吃什么',
      path: seedUserService.getSharePath('wechat'),
      imageUrl: HOME_ILLUSTRATION_URL
    };
  },

  // ====== 分享到朋友圈：附带 channel 参数 ======
  onShareTimeline: function () {
    return {
      title: 'TableSync - 每天想想吃什么',
      query: 'channel=pyq'
    };
  }
});
