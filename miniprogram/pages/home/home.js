var menuHistory = require('../../utils/menuHistory.js');
var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');
var vibeGreeting = require('../../utils/vibeGreeting.js');
var locationWeather = require('../../utils/locationWeather.js');

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
    // 书脊时段模式初始值
    var _hour = new Date().getHours();
    var _initSpineMode = 'spine-day';
    if (_hour >= 22 || _hour < 5) _initSpineMode = 'spine-night';
    else if (_hour >= 5 && _hour < 9) _initSpineMode = 'spine-morning';
    var _initSealIcon = (_hour >= 22 || _hour < 5) ? '🪔' : '🔖';

    return {
      currentDate: getCurrentDate(),
      vibeWeather: '',
      vibeGreeting: vibeGreeting.pickGreeting(null),
      showAdvanced: false,
      cookWho: 'self',
      cookStatus: 'ok',
      homeBgUrl: '',
      // Zen Mode 背景氛围切换
      zenBgUrl: '',          // 当前 Zen 背景 URL（用于渲染）
      zenBgFading: false,    // 淡入淡出动画控制
      showStickerDrop: false,
      stickerDropQueue: [],    // [{ stickerId, name, emoji }]
      // ====== 烟火集悬浮书脊 ======
      spineMode: _initSpineMode,      // spine-day / spine-morning / spine-night / spine-night-tired
      spineSealIcon: _initSealIcon,    // 🔖 常规 / 🪔 深夜疲惫小油灯
      hasUnviewedCooks: false,         // 有新烹饪记录未查看 → 微光呼吸
      spineHighlight: false            // 贴纸收下后短暂高亮
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
    // 书脊：根据已知状态更新模式
    this._updateSpineMode();

    var that = this;
    locationWeather.getWeather().then(function (weather) {
      var greeting = vibeGreeting.pickGreeting(weather);
      var weatherStr = '';
      if (weather && (weather.temp || weather.text)) {
        weatherStr = [weather.temp, weather.text].filter(Boolean).join(' ');
      }
      that.setData({ vibeGreeting: greeting, vibeWeather: weatherStr });
    }).catch(function () {});
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
    // ====== 烟火集：展示贴纸飘落队列 ======
    var pending = getApp().globalData.pendingStickerDrop;
    if (pending) {
      // 兼容旧格式（单对象）和新格式（数组）
      var queue = Array.isArray(pending) ? pending : (pending.name ? [pending] : []);
      if (queue.length > 0) {
        that.setData({
          showStickerDrop: true,
          stickerDropQueue: queue
        });
      }
    }
    // ====== 犹豫追踪：记录 onShow 时间戳 ======
    this._homeShowTime = Date.now();
    this._toggleCount = 0;
    // ====== 书脊：检测未查看的烹饪记录（微光呼吸） ======
    this._checkUnviewedCooks();
    // ====== 书脊：刷新时段模式 ======
    this._updateSpineMode();
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
    var slimMenus = menuData.serializeMenusForStorage && menuData.serializeMenusForStorage(menus);
    wx.setStorageSync('today_menus', JSON.stringify(slimMenus && slimMenus.length > 0 ? slimMenus : menus));
    wx.setStorageSync('today_menus_preference', JSON.stringify(pref));
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
    // 犹豫追踪：累计切换次数
    this._toggleCount = (this._toggleCount || 0) + 1;
    // 书脊：状态切换影响深夜油灯模式
    this._updateSpineMode();
  },

  /**
   * Zen Mode 背景氛围切换（0.8s 淡入淡出）
   * 根据 cookStatus（ok/tired）+ cookWho（self/ayi）选择对应背景图
   */
  _updateZenBackground: function () {
    var that = this;
    var status = this.data.cookStatus || 'ok';
    var stateKey = status + '_self';  // cookWho 始终为 self

    var urlMap = this._zenBgUrlMap || {};
    var newUrl = urlMap[stateKey] || urlMap['ok_self'] || this.data.homeBgUrl || '';

    if (newUrl === this.data.zenBgUrl) return;

    this.setData({ zenBgFading: true });

    setTimeout(function () {
      that.setData({
        zenBgUrl: newUrl,
        homeBgUrl: newUrl
      });
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

  // ====== 书脊：检测是否有新烹饪记录未查看（微光呼吸） ======
  _checkUnviewedCooks: function () {
    var lastCookTime = wx.getStorageSync('last_cook_complete_time') || 0;
    var lastViewTime = wx.getStorageSync('last_view_collection_time') || 0;
    var hasUnviewed = lastCookTime > 0 && lastCookTime > lastViewTime;
    if (hasUnviewed !== this.data.hasUnviewedCooks) {
      this.setData({ hasUnviewedCooks: hasUnviewed });
    }
  }
});
