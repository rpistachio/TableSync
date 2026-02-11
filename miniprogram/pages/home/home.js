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

var HOME_BG_CLOUD_PATH = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/frontpage_stickers/Rona_Prompt_Ultra-minimalist_flat_layout_for_a_cooking_app_in_7f423079-ed33-4f7e-b466-c9bc4f6d174f_3.png';

// ====== Zen Mode 背景氛围图 (2026 需求：视觉差异化与氛围渲染) ======
// 键名 = cookStatus + '_' + cookWho, 值 = 云存储 fileID
var ZEN_BG_CLOUD_PATHS = {
  // 心情还好 + 自己做 → 暖色调灶台烟火
  ok_self: HOME_BG_CLOUD_PATH,
  // 疲惫 + 自己做 → 舒缓冷色调（沙发、毛毯、猫咪景观）
  tired_self: 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/frontpage_stickers/Gemini_Generated_Image_rqjsbsrqjsbsrqjs.png',
  // 心情还好 + 别人做 → 互助感（递出的咖啡、信笺）
  ok_ayi: HOME_BG_CLOUD_PATH,
  // 疲惫 + 别人做 → 互助感 + 治愈
  tired_ayi: 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/frontpage_stickers/Gemini_Generated_Image_rqjsbsrqjsbsrqjs.png'
};

Page({
  data: (function () {
    return {
      currentDate: getCurrentDate(),
      vibeWeather: '',
      vibeGreeting: getDefaultVibeGreeting(),
      showAdvanced: false,
      cookWho: 'self',
      cookStatus: 'ok',
      homeBgUrl: '',
      // Zen Mode 背景氛围切换
      zenBgUrl: '',          // 当前 Zen 背景 URL（用于渲染）
      zenBgFading: false,    // 淡入淡出动画控制
      zenBgIndicator: '',    // 核心指标文案 ("效率提升 +42%" / "上手难度：极简")
      showStickerDrop: false,
      stickerDropName: '',
      stickerDropId: ''
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
    var savedStatus = wx.getStorageSync('zen_cook_status') || 'ok';
    this.setData({
      cookStatus: savedStatus
    });
    this._zenBgUrlMap = {};  // 初始化，onReady 中批量解析后填充
  },

  onReady: function () {
    var that = this;
    if (wx.cloud && wx.cloud.getTempFileURL) {
      // 批量解析所有 Zen 背景云文件 ID → HTTPS 临时链接
      var pathSet = {};     // 去重
      var keys = Object.keys(ZEN_BG_CLOUD_PATHS);
      var fileIds = [];
      for (var i = 0; i < keys.length; i++) {
        var fid = ZEN_BG_CLOUD_PATHS[keys[i]];
        if (fid && !pathSet[fid]) { pathSet[fid] = true; fileIds.push(fid); }
      }
      // 同时包含首页默认背景
      if (!pathSet[HOME_BG_CLOUD_PATH]) fileIds.push(HOME_BG_CLOUD_PATH);

      wx.cloud.getTempFileURL({ fileList: fileIds }).then(function (res) {
        var urlMap = {};     // cloudPath → tempFileURL
        var fileList = (res && res.fileList) || [];
        for (var j = 0; j < fileList.length; j++) {
          if (fileList[j] && fileList[j].tempFileURL) {
            urlMap[fileList[j].fileID] = fileList[j].tempFileURL;
          }
        }
        // 缓存解析结果供后续切换使用
        that._zenBgUrlMap = {};
        for (var k = 0; k < keys.length; k++) {
          that._zenBgUrlMap[keys[k]] = urlMap[ZEN_BG_CLOUD_PATHS[keys[k]]] || '';
        }
        // 设置首页默认背景
        var homeUrl = urlMap[HOME_BG_CLOUD_PATH] || '';
        that.setData({ homeBgUrl: homeUrl });
        // 立即根据当前 cookStatus / cookWho 设置 Zen 背景
        that._updateZenBackground();
      }).catch(function () {});
    }
  },

  onShow: function () {
    var that = this;
    var pending = getApp().globalData.pendingStickerDrop;
    if (pending && pending.name) {
      that.setData({
        showStickerDrop: true,
        stickerDropName: pending.name,
        stickerDropId: pending.stickerId || ''
      });
    }
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

  /** Zen Mode: 切换今日状态 */
  onToggleCookStatus: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ cookStatus: val });
    wx.setStorageSync('zen_cook_status', val);
    this._updateZenBackground();
  },

  /**
   * Zen Mode 背景氛围切换（0.8s 淡入淡出）
   * 根据 cookStatus（ok/tired）+ cookWho（self/ayi）选择对应背景图和指标文案
   */
  _updateZenBackground: function () {
    var that = this;
    var status = this.data.cookStatus || 'ok';
    var stateKey = status + '_self';  // cookWho 始终为 self

    var urlMap = this._zenBgUrlMap || {};
    var newUrl = urlMap[stateKey] || urlMap['ok_self'] || this.data.homeBgUrl || '';

    // 核心指标文案
    var indicator = '';
    if (status === 'tired') {
      indicator = '空气炸锅模式 · 极致减负';
    } else {
      indicator = '效率提升 +42%';
    }

    // 如果 URL 没变只更新文案
    if (newUrl === this.data.zenBgUrl) {
      this.setData({ zenBgIndicator: indicator });
      return;
    }

    // 触发淡出
    this.setData({ zenBgFading: true });

    // 0.4s 后换图 + 淡入（总计 0.8s 视觉过渡）
    setTimeout(function () {
      that.setData({
        zenBgUrl: newUrl,
        zenBgIndicator: indicator,
        homeBgUrl: newUrl   // 同步更新首页主背景
      });
      // 下一帧移除 fading 触发淡入
      setTimeout(function () {
        that.setData({ zenBgFading: false });
      }, 50);
    }, 400);
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
    getApp().globalData.pendingStickerDrop = null;
    this.setData({ showStickerDrop: false, stickerDropName: '', stickerDropId: '' });
  },

  onGoCollection: function () {
    wx.navigateTo({ url: '/pages/collection/collection' });
  }
});
