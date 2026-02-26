var menuHistory = require('../../utils/menuHistory.js');
var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');
var recipeCoverAudit = require('../../data/recipeCoverAudit.js');
var vibeGreeting = require('../../utils/vibeGreeting.js');
var seedUserService = require('../../utils/seedUserService.js');
var tasteProfile = require('../../data/tasteProfile.js');
var probeEngine = require('../../logic/probeEngine.js');

/** 首页云图 fileID，需通过 getTempFileURL 转成 HTTPS 再显示（避免 simulator 把 cloud:// 当本地路径报 500） */
var HOME_CLOUD_FILE_IDS = [
  'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/background_pic/home_background.png',
  'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/background_pic/feeling_ok_button.png',
  'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/background_pic/feeling_tired_button.png'
];

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
      // ====== Context Dashboard Sheet ======
      showSheet: false,
      sheetScene: 'couple',
      sheetStatus: 'ok',
      sheetTaste: null,
      sheetTasteQuestion: '',
      sheetShowTaste: false,
      sheetSceneOptions: [],
      sheetTasteOptions: [],
      sheetKitchenOptions: [],
      sheetKitchen: [],
      sheetKitchenSet: {},        // 多选高亮用：{ hasAirFryer: true }
      // ====== 烟火集悬浮书脊 ======
      spineMode: _initSpineMode,      // spine-day / spine-morning / spine-night / spine-night-tired
      spineSealIcon: _initSealIcon,    // 🔖 常规 / 🪔 深夜疲惫小油灯
      hasUnviewedCooks: false,         // 有新烹饪记录未查看 → 微光呼吸
      spineHighlight: false,           // 贴纸收下后短暂高亮
      shakeBlur: false                 // 摇一摇触发时的模糊遮罩
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

    // ====== 需求探针：重置 session 追踪 + 递增访问 + 亲和度衰减 ======
    probeEngine.resetSession();
    tasteProfile.incrementVisit();
    tasteProfile.maybeDecay();

    // ====== 种子用户：渠道追踪 + 先锋主厨问候语 ======
    var that = this;
    // 如果从分享链接进入首页，解析 channel 参数
    if (options && options.channel) {
      seedUserService.saveChannel(options.channel);
    }
    // 等待种子用户信息就绪后刷新问候语
    that._refreshPioneerGreeting();
    // 云图：延后解析，等云 init 后再 getTempFileURL（未登录时静默失败，用占位）
    setTimeout(function () { that._resolveHomeCloudImages(); }, 500);
  },

  onShow: function () {
    var that = this;
    this._homeShowTime = Date.now();
    this._toggleCount = 0;
    // 延后书脊/未读检测并合并为一次 setData，避免阻塞首屏
    setTimeout(function () {
      that._refreshSpineAndUnviewed();
    }, 0);

    // 冰箱提示：高级功能入口动态文案
    that._refreshFridgeHint();

    // 摇一摇：启动加速计监听（仅首页前台）
    wx.startAccelerometer({ interval: 'normal' });
    this._shakeHandler = function (res) {
      var magnitude = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z);
      if (magnitude > 2.5 && !that._shakeCooldown && !that._zenGenerating) {
        that._shakeCooldown = true;
        that._onShakeDetected();
        setTimeout(function () { that._shakeCooldown = false; }, 3000);
      }
    };
    wx.onAccelerometerChange(this._shakeHandler);
  },

  onHide: function () {
    wx.stopAccelerometer();
    if (this._shakeHandler) {
      wx.offAccelerometerChange(this._shakeHandler);
    }
  },

  onUnload: function () {
    wx.stopAccelerometer();
    if (this._shakeHandler) {
      wx.offAccelerometerChange(this._shakeHandler);
    }
  },

  /** 摇一摇检测到：震动 + 模糊转场 + 触发 Omakase 版 onZenGo（跳过 Sheet） */
  _onShakeDetected: function () {
    if (this._zenGenerating) return;
    this._isOmakase = true;
    wx.vibrateLong();
    wx.setStorageSync('omakase_hint_seen', true);
    this.setData({ shakeBlur: true });
    this.onZenGo();
  },

  /** Zen Mode: 大按钮 -> 自动生成菜谱并进入 preview 页（不跳转今日灵感/spinner） */
  onZenGo: function () {
    if (this._zenGenerating) return;
    this._zenGenerating = true;

    var isOmakase = this._isOmakase === true;
    this._isOmakase = false;

    // ====== 犹豫检测：停留 > 60s 或切换 >= 3 次 → 标记为犹豫 ======
    var dwellTime = this._homeShowTime ? (Date.now() - this._homeShowTime) : 0;
    var toggleCount = this._toggleCount || 0;
    if (dwellTime > 60000 || toggleCount >= 3) {
      getApp().globalData._hesitantStart = true;
    }
    // 重置追踪（下次回来重新计）
    this._homeShowTime = Date.now();
    this._toggleCount = 0;

    // Omakase 或未经过 Sheet 时：用上次选择兜底
    if (!probeEngine.isSessionAnswered('scene')) {
      var lastScene = probeEngine.getLastChoice('scene');
      if (lastScene) {
        tasteProfile.setScene(lastScene);
      }
    }

    this.setData({ showCookingLoading: true });
    var that = this;
    var pref = that._buildZenPreference();

    var moodText = isOmakase ? '主厨包办' : (that.data.cookStatus === 'tired' ? '疲惫' : '随便');
    var source = menuData.getRecipeSource && menuData.getRecipeSource();
    var adultRecipes = (source && source.adultRecipes) || [];

    // Layer 1: 智能候选池 — 过滤忌口 → [Omakase] 视觉准入 → 按亲和度排序 → ≤500 全量，>500 智能截断
    var profile = tasteProfile.get();
    var filtered = menuGen.filterByPreference(adultRecipes, pref);
    var dislikedIds = tasteProfile.getDislikedRecipeIds ? tasteProfile.getDislikedRecipeIds() : [];
    if (dislikedIds.length > 0) {
      var dislikedSet = {};
      for (var di = 0; di < dislikedIds.length; di++) dislikedSet[dislikedIds[di]] = true;
      filtered = filtered.filter(function (r) { return !dislikedSet[r.id || r._id]; });
    }
    if (isOmakase) {
      var auditMap = recipeCoverAudit && typeof recipeCoverAudit === 'object' ? recipeCoverAudit : {};
      filtered = filtered.filter(function (r) {
        var a = auditMap[r.name] || auditMap[r.id] || auditMap[r._id];
        if (!a) return true;
        return (a.appetizing >= 8 && a.styleConsistency >= 8);
      });
    }
    profile._preferredMeats = pref.preferredMeats || [];
    var ranked = menuGen.rankByAffinity(filtered, profile);
    var candidatePool = ranked.length > 500 ? ranked.slice(0, 500) : ranked;
    var recentDishNames = that._buildRecentDishNames(isOmakase ? 14 : 7);
    if (recentDishNames) {
      var recentSet = {};
      recentDishNames.split('、').forEach(function (n) {
        if (n && n.trim()) recentSet[n.trim()] = true;
      });
      if (Object.keys(recentSet).length > 0) {
        candidatePool = candidatePool.filter(function (r) { return !recentSet[r.name]; });
      }
    }
    var candidates = candidatePool.map(function (r) {
      return {
        id: r.id || r._id,
        _id: r._id || r.id,
        name: r.name,
        meat: r.meat,
        cook_type: r.cook_type,
        flavor_profile: r.flavor_profile,
        dish_type: r.dish_type,
        cook_minutes: r.cook_minutes || 0,
        tags: r.tags || []
      };
    });
    var dislikedNames = tasteProfile.getDislikedRecipeNames(adultRecipes);
    wx.cloud.callFunction({
      name: 'smartMenuGen',
      data: {
        preference: pref,
        mood: moodText,
        weather: {},
        recentDishNames: recentDishNames,
        dislikedDishNames: dislikedNames,
        fridgeExpiring: pref.fridgeExpiring || [],
        heroIngredient: pref.heroIngredient || null,
        candidates: candidates
      }
    }).then(function (res) {
      var out = res.result;
      if (out && out.code === 0 && out.data && Array.isArray(out.data.recipeIds) && out.data.recipeIds.length > 0) {
        getApp().globalData.chefReportText = (out.data && out.data.reasoning) || '';
        getApp().globalData.dishHighlights = (out.data && out.data.dishHighlights) || {};
        if (isOmakase && out.data.omakaseCopy && typeof out.data.omakaseCopy === 'string') {
          getApp().globalData.omakaseCopy = out.data.omakaseCopy.trim().slice(0, 15);
        } else {
          getApp().globalData.omakaseCopy = '';
        }
        var menus = that._zenRecipeIdsToMenus(out.data.recipeIds, pref);
        if (menus.length > 0) {
          that._zenNavigateToPreview(menus, pref, isOmakase);
          return;
        }
      }
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      getApp().globalData.omakaseCopy = '';
      that._zenApplyLocalMenus(pref, isOmakase);
    }).catch(function () {
      getApp().globalData.chefReportText = '';
      getApp().globalData.dishHighlights = {};
      getApp().globalData.omakaseCopy = '';
      that._zenApplyLocalMenus(pref, isOmakase);
    });
  },

  /** 最近做过的菜名（用于防重复）：历史 + last_cook_dishes，逗号分隔 */
  _buildRecentDishNames: function (days) {
    var list = menuHistory.getWeekDishNames(30, days);
    try {
      var lastCook = wx.getStorageSync('last_cook_dishes');
      if (Array.isArray(lastCook) && lastCook.length > 0) {
        var set = {};
        list.forEach(function (name) { set[name] = true; });
        lastCook.forEach(function (name) {
          if (name && !set[name]) { set[name] = true; list.push(name); }
        });
      }
    } catch (e) {}
    return list.length > 0 ? list.join('、') : '';
  },

  /** Zen 偏好：从 Taste Profile 动态构建，疲惫模式叠加省时 + 空气炸锅 */
  _buildZenPreference: function () {
    var profile = tasteProfile.get();
    var isTired = this.data.cookStatus === 'tired';
    var sceneConfig = tasteProfile.getSceneConfig();
    var dietStyle = tasteProfile.inferDietStyle(profile.flavorAffinity);
    var preferredMeats = tasteProfile.inferPreferredMeats(profile.ingredientAffinity);
    var urgentIngredient = tasteProfile.consumeUrgent();
    var flavorResult = tasteProfile.getTopFlavors(profile.flavorAffinity);

    var kc = profile.kitchenConfig || {};
    return {
      adultCount: sceneConfig.adultCount,
      hasBaby: sceneConfig.hasBaby || false,
      babyMonth: 12,
      meatCount: sceneConfig.meatCount,
      vegCount: sceneConfig.vegCount,
      soupCount: sceneConfig.soupCount,
      soupType: null,
      avoidList: profile.avoidList || [],
      dietStyle: isTired ? 'quick' : dietStyle,
      isTimeSave: isTired,
      kitchenConfig: {
        burners: kc.burners || 2,
        hasSteamer: kc.hasSteamer || false,
        hasAirFryer: isTired ? true : (kc.hasAirFryer || false),
        hasOven: kc.hasOven || false,
        hasRiceCooker: kc.hasRiceCooker || false,
        hasMicrowave: kc.hasMicrowave || false
      },
      preferredMeats: preferredMeats,
      flavorAffinity: profile.flavorAffinity || {},
      flavorHint: tasteProfile.getFlavorHint(profile.flavorAffinity),
      topFlavorKey: flavorResult.top,
      secondFlavorKey: flavorResult.ambiguous ? flavorResult.second : null,
      flavorAmbiguous: flavorResult.ambiguous,
      urgentIngredient: urgentIngredient,
      fridgeExpiring: (function () {
        try { return require('../../data/fridgeStore.js').getExpiringNames(2); }
        catch (e) { return []; }
      })(),
      heroIngredient: tasteProfile.pickHeroIngredient(
        (function () {
          try { return require('../../data/fridgeStore.js').getExpiringNames(2); }
          catch (e) { return []; }
        })()
      ),
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
  _zenApplyLocalMenus: function (pref, isOmakase) {
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
      that._zenNavigateToPreview(menus, pref, isOmakase || false);
    } catch (err) {
      that._zenGenerating = false;
      that.setData({ showCookingLoading: false, shakeBlur: false });
      wx.showModal({ title: '生成失败', content: err.message || '请稍后重试', showCancel: false });
    }
  },

  /** 写入 Storage 与 globalData，并跳转 preview（异步 Storage 不阻塞主线程） */
  _zenNavigateToPreview: function (menus, pref, isOmakase) {
    this._zenGenerating = false;
    this.setData({ showCookingLoading: false, shakeBlur: false });
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
    var previewUrl = '/pages/preview/preview' + (isOmakase ? '?omakase=true' : '');
    Promise.all([
      setStorage('cart_ingredients', shoppingList || []),
      setStorage('today_menus', todayMenusStr),
      setStorage('today_menus_preference', JSON.stringify(pref)),
      setStorage('menu_generated_date', todayKey),
      setStorage('today_prep_time', maxPrepTime)
    ]).then(function () {
      wx.redirectTo({ url: previewUrl });
    }).catch(function () {
      wx.redirectTo({ url: previewUrl });
    });
  },

  /** Zen Mode: 切换今日状态（Sheet 内用 onSheetStatusToggle，此处保留供逻辑/书脊用） */
  onToggleCookStatus: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ cookStatus: val });
    wx.setStorageSync('zen_cook_status', val);
    this._toggleCount = (this._toggleCount || 0) + 1;
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

  onGoFridge: function () {
    wx.navigateTo({ url: '/pages/fridge/fridge' });
  },

  _refreshFridgeHint: function () {
    try {
      var fridgeStore = require('../../data/fridgeStore.js');
      var count = fridgeStore.getCount();
      var expiring = fridgeStore.getExpiringSoon(2);
      var hint = '';
      if (count === 0) {
        hint = '记录食材，AI 帮你优先消耗临期的';
      } else if (expiring.length > 0) {
        var names = expiring.slice(0, 2).map(function (it) { return it.name; }).join('、');
        hint = names + ' 快过期了，该吃掉了';
      } else {
        hint = '冰箱里有 ' + count + ' 种食材';
      }
      this.setData({ fridgeHint: hint });
    } catch (e) {}
  },

  onOpenSheet: function () {
    var scene = probeEngine.getLastChoice('scene') || 'couple';
    var status = wx.getStorageSync('zen_cook_status') || 'ok';
    var showTaste = !probeEngine.isSessionAnswered('taste');
    var tasteProbe = showTaste ? probeEngine.getTasteProbe() : null;
    var sceneOptions = probeEngine.getSceneOptions();
    var tasteOptions = tasteProbe ? (tasteProbe.options || []) : [];
    var tasteQuestion = tasteProbe ? (tasteProbe.question || '') : '';
    var lastTaste = probeEngine.getLastChoice('taste');
    var kitchenOptions = probeEngine.getKitchenOptions && probeEngine.getKitchenOptions();
    var kc = (tasteProfile.get() && tasteProfile.get().kitchenConfig) || {};
    var sheetKitchen = [];
    if (kc.hasAirFryer) sheetKitchen.push('hasAirFryer');
    if (kc.hasSteamer) sheetKitchen.push('hasSteamer');
    if (kc.hasOven) sheetKitchen.push('hasOven');
    if (kc.hasRiceCooker) sheetKitchen.push('hasRiceCooker');
    if (kc.hasMicrowave) sheetKitchen.push('hasMicrowave');
    var sheetKitchenSet = {};
    sheetKitchen.forEach(function (k) { sheetKitchenSet[k] = true; });
    this.setData({
      showSheet: true,
      sheetScene: scene,
      sheetStatus: status,
      sheetShowTaste: showTaste,
      sheetSceneOptions: sceneOptions || [],
      sheetTasteOptions: tasteOptions,
      sheetTasteQuestion: tasteQuestion,
      sheetTaste: lastTaste,
      sheetKitchenOptions: kitchenOptions || [],
      sheetKitchen: sheetKitchen,
      sheetKitchenSet: sheetKitchenSet
    });
  },

  onCloseSheet: function () {
    this.setData({ showSheet: false });
  },

  onSheetSceneSelect: function (e) {
    var key = e.currentTarget.dataset.key;
    this.setData({ sheetScene: key });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  onSheetTasteSelect: function (e) {
    var key = e.currentTarget.dataset.key;
    this.setData({ sheetTaste: key === 'null' || key === undefined ? null : key });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  onSheetStatusToggle: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ sheetStatus: val });
  },

  onSheetKitchenToggle: function (e) {
    var key = e.currentTarget.dataset.key;
    var list = (this.data.sheetKitchen || []).slice();
    if (key === null || key === 'null' || key === undefined || key === '' || (typeof key === 'string' && key.trim() === '')) {
      this.setData({ sheetKitchen: [], sheetKitchenSet: {} });
      return;
    }
    var idx = list.indexOf(key);
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      list.push(key);
    }
    var set = {};
    list.forEach(function (k) { set[k] = true; });
    this.setData({ sheetKitchen: list, sheetKitchenSet: set });
  },

  onSheetConfirm: function () {
    this.setData({ showSheet: false });
    var scene = this.data.sheetScene;
    var taste = this.data.sheetTaste;
    var status = this.data.sheetStatus;
    var sheetKitchen = this.data.sheetKitchen || [];

    probeEngine.handleProbeAnswer('scene', scene);
    if (this.data.sheetShowTaste && taste !== null && taste !== undefined && taste !== 'null') {
      probeEngine.handleProbeAnswer('taste', taste);
    }
    if (tasteProfile.setKitchenDevices) {
      tasteProfile.setKitchenDevices(Array.isArray(sheetKitchen) ? sheetKitchen : []);
    }
    this.setData({ cookStatus: status });
    wx.setStorageSync('zen_cook_status', status);
    this._updateSpineMode();
    this.onZenGo();
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

  // ====== 首页云图：cloud:// 转 HTTPS 再显示，避免 simulator 当本地路径报 500 ======
  _resolveHomeCloudImages: function () {
    var that = this;
    if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return;
    wx.cloud.getTempFileURL({
      fileList: HOME_CLOUD_FILE_IDS
    }).then(function (res) {
      var fileList = res.fileList || [];
      var illustrationUrl = '';
      var okIconUrl = '';
      var tiredIconUrl = '';
      if (fileList[0] && fileList[0].tempFileURL) illustrationUrl = fileList[0].tempFileURL;
      if (fileList[1] && fileList[1].tempFileURL) okIconUrl = fileList[1].tempFileURL;
      if (fileList[2] && fileList[2].tempFileURL) tiredIconUrl = fileList[2].tempFileURL;
      that.setData({ illustrationUrl: illustrationUrl, okIconUrl: okIconUrl, tiredIconUrl: tiredIconUrl });
    }).catch(function () {});
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

    // 构建用户状态上下文
    var profile = tasteProfile.get();
    var fridgeExpiringNames = [];
    try {
      var fridgeStore = require('../../data/fridgeStore.js');
      var expItems = fridgeStore.getExpiringSoon(2);
      fridgeExpiringNames = expItems.map(function (it) { return it.name; });
    } catch (e) {}
    var lastDishes = wx.getStorageSync('last_cook_dishes') || [];
    var ctx = {
      totalCooks: profile.totalCooks || 0,
      visitCount: profile.visitCount || 0,
      lastDishName: lastDishes.length > 0 ? lastDishes[0] : '',
      fridgeExpiringNames: fridgeExpiringNames,
      hour: new Date().getHours()
    };

    // 优先使用本地缓存（秒级响应）
    var localInfo = seedUserService.getLocalSeedInfo();
    if (localInfo && localInfo.seq > 0 && localInfo.seq <= 100) {
      that.setData({
        vibeGreeting: vibeGreeting.pickGreeting(null, localInfo, ctx)
      });
      return;
    }
    // 非种子用户 → 直接使用状态感知 + 天气文案
    that.setData({
      vibeGreeting: vibeGreeting.pickGreeting(null, null, ctx)
    });
    // 等待 app.js 中异步注册完成（种子用户可能尚未就绪）
    var app = getApp();
    var checkInterval = setInterval(function () {
      var seedUser = app.globalData.seedUser;
      if (seedUser) {
        clearInterval(checkInterval);
        if (seedUser.seq > 0 && seedUser.seq <= 100) {
          that.setData({
            vibeGreeting: vibeGreeting.pickGreeting(null, seedUser, ctx)
          });
        }
      }
    }, 500);
    setTimeout(function () {
      clearInterval(checkInterval);
    }, 5000);
  },

  // ====== 分享到好友：附带 channel 参数 ======
  onShareAppMessage: function () {
    return {
      title: 'TableSync - 想想今晚吃什么',
      path: seedUserService.getSharePath('wechat'),
      imageUrl: 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/background_pic/home_background.png'
    };
  },

  // ====== 分享到朋友圈：附带 channel 参数 ======
  onShareTimeline: function () {
    return {
      title: 'TableSync - 每天想想吃什么',
      query: 'channel=pyq'
    };
  },

});
