var coverService = require('../../data/recipeCoverSlugs.js');
var recipeResources = require('../../data/recipeResources.js');
var menuHistory = require('../../utils/menuHistory.js');
var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var seedUserService = require('../../utils/seedUserService.js');
var tasteProfile = require('../../data/tasteProfile.js');
var scheduleEngine = require('../../utils/scheduleEngine.js');

var ENV_ID = 'cloud1-7g5mdmib90e9f670';
var CLOUD_ROOT = recipeResources && recipeResources.CLOUD_ROOT ? recipeResources.CLOUD_ROOT : ('cloud://' + ENV_ID);

function toFullFileId(fileId) {
  if (typeof fileId !== 'string') return '';
  var envPrefix = 'cloud://' + ENV_ID + '/';
  // 传入的是 env 简写形式：cloud://env-id/xxx → cloud://env-id.<appid>/xxx
  if (fileId.indexOf(envPrefix) === 0 && CLOUD_ROOT && CLOUD_ROOT.indexOf('cloud://' + ENV_ID + '.') === 0) {
    return CLOUD_ROOT + '/' + fileId.slice(envPrefix.length);
  }
  return fileId;
}

function toEnvOnlyFileId(fileId) {
  if (typeof fileId !== 'string') return '';
  var fullPrefix = CLOUD_ROOT ? (CLOUD_ROOT + '/') : '';
  if (fullPrefix && fileId.indexOf(fullPrefix) === 0) {
    return 'cloud://' + ENV_ID + '/' + fileId.slice(fullPrefix.length);
  }
  return fileId;
}

function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

var OMAKASE_COPY_POOL = {
  tired: [
    '一点酸甜，卸下今天的疲惫',
    '不用动脑，今晚吃顿舒服的',
    '热气升腾，把烦恼挡在锅外',
    '给自己十分钟，胃口会感谢你',
    '今天辛苦了，吃点好的补补'
  ],
  expiring: [
    '{ingredient}在等你，今晚让它大放异彩',
    '赶在风味流失前，把它变成杰作',
    '冰箱里的老朋友，今天做主角',
    '不浪费食材，是主厨的最高修养'
  ],
  heavy: [
    '今天痛快吃，卡路里明天再说',
    '恰到好处的火辣，专治胃口不佳',
    '用一点重口味，叫醒疲惫的味蕾',
    '无肉不欢的夜晚，就选这一道'
  ],
  light: [
    '给肠胃放个假，尝点食材本味',
    '无需重料点缀，吃的就是清爽',
    '低卡零负担，今晚好好爱自己',
    '保留山野之气，一口吃到春天'
  ],
  random: [
    '既然拿不定主意，相信我的直觉',
    '缘分摇出来的菜，通常都不会差',
    '别纠结了，这道菜肯定对你胃口',
    '随机的惊喜，往往是最优解'
  ],
  regional: {
    cantonese: [
      '主厨嗅探到{region}的气息，今晚来一顿地道的{dish}，熨帖肠胃',
      '靓汤已经在心里煲上了，{region}的夜晚值得一碗好汤',
      '一份{region}味道，抚慰街角熟悉的胃口'
    ],
    sichuan: [
      '想念{region}的麻辣？主厨懂你，今晚微辣刚刚好',
      '一道{dish}，唤醒{region}街巷深处的记忆',
      '今晚用{region}的烟火气，叫醒味蕾'
    ],
    jiangzhe: [
      '主厨为你选了{region}的清淡本味，{dish}刚刚好',
      '{region}的鲜甜，都在这道{dish}里'
    ],
    dongbei: [
      '主厨嗅到{region}的豪迈，{dish}管饱又暖心',
      '一份{region}的实在，今晚吃得踏实'
    ],
    minyue: [
      '主厨为你选了{region}的鲜甜清淡，{dish}刚刚好',
      '{region}的汤汤水水，今晚慰劳你的胃'
    ],
    yungui: [
      '酸辣鲜香，{region}的烟火气都在{dish}里',
      '主厨嗅到{region}的酸汤味，今晚来一道'
    ],
    xibei: [
      '主厨嗅到{region}的豪迈，{dish}管饱又香',
      '一份{region}的扎实风味，今晚吃得过瘾'
    ],
    huaiyang: [
      '主厨为你选了{region}的家常咸鲜，{dish}下饭又熨帖',
      '{region}的踏实味道，今晚好好吃一顿'
    ],
    generic: [
      '主厨嗅探到你想念{region}的风味，这份菜单是最好的回应',
      '今晚用一桌{region}味道，治愈漂泊的胃',
      '身在{region}，主厨为你选了最对味的一道'
    ]
  }
};

function pickOmakaseCopy(context) {
  if (!context) context = {};
  var pool = OMAKASE_COPY_POOL.random;
  var key = 'random';
  var regionTriggered = false;
  try { regionTriggered = (typeof getApp === 'function' && getApp() && getApp().globalData && getApp().globalData.lastRegionWeightTriggered) === true; } catch (e) {}
  if (context.regionLabel && context.regionCuisineKey && OMAKASE_COPY_POOL.regional && regionTriggered) {
    var regionalPool = OMAKASE_COPY_POOL.regional[context.regionCuisineKey] || OMAKASE_COPY_POOL.regional.generic;
    if (Array.isArray(regionalPool) && regionalPool.length > 0) {
      pool = regionalPool;
      key = 'regional';
    }
  }
  if (key !== 'regional') {
    if (context.isTired) {
      pool = OMAKASE_COPY_POOL.tired;
      key = 'tired';
    } else if (context.hasExpiringIngredient && context.heroIngredient) {
      pool = OMAKASE_COPY_POOL.expiring;
      key = 'expiring';
    } else if (context.heroFlavor === 'spicy' || context.heroCookType === 'braise' || context.heroCookType === 'fry') {
      pool = OMAKASE_COPY_POOL.heavy;
      key = 'heavy';
    } else if (context.heroFlavor === 'light' || context.heroCookType === 'steam' || context.heroCookType === 'boil') {
      pool = OMAKASE_COPY_POOL.light;
      key = 'light';
    }
  }
  if (!Array.isArray(pool) || pool.length === 0) pool = OMAKASE_COPY_POOL.random;
  var line = pool[Math.floor(Math.random() * pool.length)];
  if (key === 'expiring' && context.heroIngredient) {
    line = line.replace(/\{ingredient\}/g, context.heroIngredient);
  }
  if (key === 'regional' && context.regionLabel) {
    line = line.replace(/\{region\}/g, context.regionLabel);
    line = line.replace(/\{dish\}/g, context.heroName || '这道菜');
  }
  return line;
}

function injectRegionCopyContext(context, heroName) {
  if (!context) return context;
  if (context.heroName == null && heroName) context.heroName = heroName;
  try {
    var activeRegion = tasteProfile.getActiveRegion();
    if (activeRegion) {
      var regionCuisineMap = require('../../data/regionCuisineMap.js');
      var regionLabel = activeRegion.manual || activeRegion.city || activeRegion.province || '你所在的城市';
      var regionCuisineKey = activeRegion.manual
        ? (regionCuisineMap.getCuisineKeyByCity(activeRegion.manual) || 'generic')
        : regionCuisineMap.getCuisineKeyByCity(activeRegion.city, activeRegion.province);
      context.regionLabel = regionLabel;
      context.regionCuisineKey = regionCuisineKey || 'generic';
    }
  } catch (e) {}
  return context;
}

var COOK_TYPE_HINTS = {
  steam: '清蒸锁鲜，简单不费事',
  stir_fry: '大火快炒，锅气十足',
  cold_dress: '凉拌开胃，清爽解腻',
  stew: '慢火炖煮，越炖越香',
  braise: '酱香浓郁，下饭一绝',
  boil: '一锅煮好，轻松省心',
  fry: '外酥里嫩，香气四溢'
};
var FLAVOR_HINTS = {
  light: '清淡适口',
  spicy: '微辣开胃',
  sour_fresh: '酸爽开胃',
  salty_umami: '咸鲜下饭',
  sweet_sour: '酸甜可口'
};

function buildReasonFallback(recipe) {
  if (!recipe) return '';
  var parts = [];
  var ct = recipe.cook_type;
  var fp = recipe.flavor_profile;
  var mins = recipe.cook_minutes || 0;
  if (ct && COOK_TYPE_HINTS[ct]) {
    parts.push(COOK_TYPE_HINTS[ct]);
  }
  if (mins > 0 && mins <= 15) {
    parts.push('仅需' + mins + '分钟');
  } else if (mins > 0) {
    parts.push(mins + '分钟搞定');
  }
  if (parts.length === 0 && fp && FLAVOR_HINTS[fp]) {
    parts.push(FLAVOR_HINTS[fp]);
  }
  return parts.length > 0 ? parts[0] : '';
}

Page({
  data: {
    previewMenuRows: [],
    previewCountText: '',
    previewComboName: '',
    previewBalanceTip: '',
    previewFallbackMessage: '',
    previewTips: [],
    previewDashboard: { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' },
    previewHasSharedBase: false,
    previewHasBaby: false,
    previewRhythmRings: [],
    previewNarrativeText: '',
    previewMenuSubtitle: '',
    professionalTalkBgUrl: '',
    isImageReady: false,
    isEntering: false,
    chefReportText: '',
    isHelperMode: false,
    isTiredMode: false,
    previewPageTitle: '今日菜单',
    previewPrimaryCta: '开始做饭',
    helperData: { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' },
    adultCount: 2,
    showPersonPicker: false,
    showBabyPicker: false,
    babyMonthLabel: '',
    shuffleBtnText: '换一换',
    avoidCapsules: [
      { key: 'spicy', label: '忌辣', active: false },
      { key: 'seafood', label: '忌海鲜', active: false },
      { key: 'peanut', label: '忌花生', active: false },
      { key: 'egg', label: '忌蛋', active: false },
      { key: 'soy', label: '忌豆制品', active: false },
      { key: 'beef_lamb', label: '忌牛羊', active: false },
      { key: 'lactose', label: '忌乳制品', active: false },
      { key: 'cilantro', label: '忌香菜', active: false }
    ],
    showPickerPanel: false,
    pickerTab: 'native',
    pickerNativeFilter: 'all',
    pickerFilterOptions: [
      { value: 'all', label: '全部' },
      { value: 'chicken', label: '鸡肉' },
      { value: 'pork', label: '猪肉' },
      { value: 'beef', label: '牛肉' },
      { value: 'fish', label: '鱼类' },
      { value: 'shrimp', label: '虾类' },
      { value: 'vegetable', label: '素菜' }
    ],
    pickerNativeRecipes: [],
    pickerFilteredNativeRecipes: [],
    pickerImportedRecipes: [],
    tweakText: '',
    kitchenBurners: 2,
    kitchenHasMicrowave: false,
    kitchenHasAirFryer: false,
    kitchenHasSteamer: false,
    kitchenHasOven: false,
    isRecalculating: false,
    schedulePreview: { totalTime: 0, serialTime: 0, savedTime: 0, efficiency: 0, cookingOrder: [], parallelPercent: 0 },
    isOmakase: false,
    omakaseVisible: false,
    omakaseHeroImage: '',
    omakaseCopy: '',
    omakaseBgUrl: '',
    professionalSuggestionCoverUrl: '',
    omakaseHeroName: '',
    omakaseComboText: '',
    omakaseDishList: [],
    omakaseRefreshing: false,
    isVip: false,
    vibeRegionLocked: false,
    vibeRegion: '',
    showVibeCustomInput: false,
    vibeCustomText: ''
  },

  onShareAppMessage: function () {
    var payload = getApp().globalData.menuPreview || {};
    var menus = payload.menus || getApp().globalData.todayMenus || [];
    var pref = Object.assign(
      {},
      payload.preference || getApp().globalData.preference || {},
      { adultCount: this.data.adultCount, avoidList: this._getActiveAvoidList() }
    );
    var adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || 2));
    var avoidList = Array.isArray(pref.avoidList) ? pref.avoidList : [];
    var avoidParam = avoidList.length > 0 ? '&avoid=' + encodeURIComponent(avoidList.join(',')) : '';
    var ids = menus.map(function (m) {
      return m.adultRecipe ? (m.adultRecipe.id || m.adultRecipe._id || '') : '';
    }).filter(Boolean).join(',');
    var helperData = this.data.helperData || payload.helperData || {};
    var title = (helperData.mergedTitle && helperData.mergedTitle.trim())
      ? helperData.mergedTitle.trim()
      : '辛苦啦，今晚想吃：' + menus.map(function (m) { return (m.adultRecipe && m.adultRecipe.name) || ''; }).filter(Boolean).join('、');
    if (!title || title === '辛苦啦，今晚想吃：') title = '帮我做今晚的饭，步骤都准备好了';
    var sharePath = '/pages/steps/steps?role=helper&recipeIds=' + encodeURIComponent(ids) + '&adultCount=' + adultCount + avoidParam;
    sharePath = seedUserService.appendChannelToPath(sharePath, 'wechat');
    return {
      title: title,
      path: sharePath,
      imageUrl: CLOUD_ROOT + '/background_pic/help_background.png'
    };
  },

  onLoad: function (options) {
    this._pageAlive = true;
    this._shuffleExcludeHistory = [];
    var that = this;
    var isOmakaseEntry = options && options.omakase === 'true';
    try {
      var fallbackMessage = (getApp().globalData && getApp().globalData.previewFallbackMessage) ? getApp().globalData.previewFallbackMessage : '';
      // 图片（cloud://）解析放到 onReady：避免渲染层过早创建 <image> 导致 500 / 被当作本地资源
      that.setData({ isImageReady: false });
      that._pageReady = false;
      that._pendingResolve = false;

      // 1. 优先从 Storage 读取核心数据
      var menusJson = wx.getStorageSync('today_menus');
      if (!menusJson) {
        wx.showModal({
          title: '提示',
          content: '数据已失效，请重新生成',
          showCancel: false,
          success: function () { wx.navigateBack(); }
        });
        return;
      }

      var menus = JSON.parse(menusJson);
      // 若为精简格式（如从「开始做饭」存下来的），还原为完整菜单
      if (menuData.isSlimMenuFormat && menuData.isSlimMenuFormat(menus)) {
        var prefRaw = '';
        try { prefRaw = wx.getStorageSync('today_menus_preference') || ''; } catch (e) {}
        var storedPref = prefRaw ? JSON.parse(prefRaw) : (getApp().globalData.preference || {});
        menus = menuData.deserializeMenusFromStorage(menus, storedPref);
        if (storedPref && Object.keys(storedPref).length) getApp().globalData.preference = storedPref;
      }
      // 防御：若历史数据中有同名重复菜，只保留每道菜第一次出现
      var seenNames = {};
      menus = menus.filter(function (m) {
        var name = (m.adultRecipe && m.adultRecipe.name) || '';
        if (!name) return true;
        if (seenNames[name]) return false;
        seenNames[name] = true;
        return true;
      });
      if (menus.length > 0) {
        try { wx.setStorageSync('today_menus', JSON.stringify(menus)); } catch (e) {}
      }

      var pref = getApp().globalData.preference || {};
      var hasBaby = !!(pref && pref.hasBaby);
      if (!hasBaby) menus.forEach(function (m) { m.babyRecipe = null; });
      var who = 'self';
      var isTimeSave = pref.isTimeSave === true || pref.is_time_save === true || (wx.getStorageSync('zen_cook_status') === 'tired');

      // 从 tasteProfile 读取厨房配置，初始化火力面板
      var tpKc = (tasteProfile.get() && tasteProfile.get().kitchenConfig) || {};
      var prefKc = (pref && pref.kitchenConfig) || {};
      var initBurners = prefKc.burners || tpKc.burners || 2;
      that._kitchenConfig = {
        burners: initBurners,
        hasSteamer: !!(prefKc.hasSteamer || tpKc.hasSteamer),
        hasAirFryer: !!(prefKc.hasAirFryer || tpKc.hasAirFryer),
        hasOven: !!(prefKc.hasOven || tpKc.hasOven),
        hasMicrowave: !!(prefKc.hasMicrowave || tpKc.hasMicrowave)
      };
      var isHelperMode = false; // 本机始终为标准视图；分享链接通过 role=helper 进入纸条模式
      var isTiredMode = isTimeSave;

      // 主厨报告：读取 AI reasoning
      var chefReportText = getApp().globalData.chefReportText || '';
      var dishHighlights = getApp().globalData.dishHighlights || {};

      // 2. 映射 UI 渲染所需的 rows 结构
      var rows = menus.map(function (m, idx) {
        var recipeName = m.adultRecipe ? m.adultRecipe.name : '';
        var babyName = m.babyRecipe ? m.babyRecipe.name : '';
        var recipeId = m.adultRecipe ? (m.adultRecipe.id || m.adultRecipe._id || '') : '';
        var highlight = dishHighlights[recipeId] || '';
        var cookType = (m.adultRecipe && m.adultRecipe.cook_type) || '';
        return {
          adultName: recipeName || '未知菜谱',
          babyName: babyName,
          showSharedHint: hasBaby && !!babyName && idx === 0,
          recommendReason: highlight || (m.adultRecipe ? (m.adultRecipe.recommend_reason || buildReasonFallback(m.adultRecipe)) : ''),
          checked: true,
          cookType: cookType,
          coverUrl: coverService.getRecipeCoverImageUrl(recipeName),
          coverTempUrl: '',
          hasCover: true
        };
      });

      // 3. 计算看板数据（Dashboard）与统筹预览
      var dashboard = {};
      if (typeof that._computePreviewDashboard === 'function') {
        dashboard = that._computePreviewDashboard(menus, pref);
      }
      var schedulePreview = that._computeSchedulePreview(menus);

      // 4. 一次性 setData
      var hasSharedBase = rows.some(function (r) { return r.showSharedHint; });
      var tips = that._buildPreviewTips(dashboard, hasSharedBase, '', fallbackMessage);
      var previewPageTitle = isHelperMode ? '给 Ta 的菜单' : '今日菜单';
      var previewPrimaryCta = isHelperMode ? '把纸条贴给 Ta' : '开始做饭';
      var helperData = { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' };
      if (isHelperMode && menus.length > 0) {
        try {
          var shoppingList = menuData.generateShoppingListFromMenus(pref, menus) || [];
          var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var result = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (result.steps && result.steps.length > 0 && menuGen.formatForHelperFromResult) {
            helperData = menuGen.formatForHelperFromResult(result, pref);
          } else if (menuGen.formatForHelper) {
            helperData = menuGen.formatForHelper(menus, pref, shoppingList);
          }
        } catch (e) {
          console.warn('helperData (formatForHelperFromResult/formatForHelper) failed:', e);
        }
      }
      var adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || 2));
      var avoidList = Array.isArray(pref.avoidList) ? pref.avoidList : [];
      var avoidCapsules = that.data.avoidCapsules.slice().map(function (cap) {
        return { key: cap.key, label: cap.label, active: avoidList.indexOf(cap.key) !== -1 };
      });

      var omakasePayload = { isOmakase: false, omakaseVisible: false, omakaseCopy: '', omakaseHeroImage: '', omakaseHeroName: '', omakaseComboText: '', omakaseDishList: [] };
      if (isOmakaseEntry && menus.length > 0) {
        var heroMenu = menus.filter(function (m) { return m.meat && m.meat !== 'vegetable'; })[0] || menus[0];
        var heroName = (heroMenu.adultRecipe && heroMenu.adultRecipe.name) || '这道菜';
        var otherNames = menus.filter(function (m) { return m !== heroMenu; }).map(function (m) {
          return (m.adultRecipe && m.adultRecipe.name) || '';
        }).filter(Boolean);
        var comboText = otherNames.join(' · ');
        var dishList = menus.map(function (m) {
          var ar = m.adultRecipe;
          var dishType = ar ? (ar.dish_type || '') : '';
          var meat = ar ? (ar.meat || '') : '';
          var role = dishType === 'soup' ? '汤' : (meat === 'vegetable' ? '素' : '荤');
          return {
            id: ar ? (ar.id || ar._id || '') : '',
            name: ar ? (ar.name || '') : '',
            role: role,
            locked: false
          };
        }).filter(function (d) { return d.name; });
        var copyContext = {
          isTired: isTiredMode,
          hasExpiringIngredient: !!(pref.heroIngredient || (Array.isArray(pref.fridgeExpiring) && pref.fridgeExpiring.length > 0)),
          heroIngredient: pref.heroIngredient || (Array.isArray(pref.fridgeExpiring) && pref.fridgeExpiring[0]) || '',
          heroFlavor: (heroMenu.adultRecipe && heroMenu.adultRecipe.flavor_profile) || '',
          heroCookType: (heroMenu.adultRecipe && heroMenu.adultRecipe.cook_type) || ''
        };
        injectRegionCopyContext(copyContext, heroName);
        var aiCopy = (getApp().globalData && getApp().globalData.omakaseCopy) ? String(getApp().globalData.omakaseCopy).trim() : '';
        var microCopy = (aiCopy && aiCopy.length <= 15) ? aiCopy : pickOmakaseCopy(copyContext);
        omakasePayload = {
          isOmakase: true,
          omakaseVisible: true,
          omakaseCopy: microCopy,
          omakaseHeroImage: '',
          omakaseHeroName: heroName,
          omakaseComboText: comboText,
          omakaseDishList: dishList
        };
        that._omakaseHeroRowIndex = menus.indexOf(heroMenu);
      } else {
        that._omakaseHeroRowIndex = null;
      }

      that._omakaseRejectCount = 0;
      var todayKey = 'omakase_reject_' + getTodayDateKey();
      try {
        var stored = parseInt(wx.getStorageSync(todayKey), 10);
        if (!isNaN(stored) && stored > 0) that._omakaseRejectCount = stored;
      } catch (e) {}

      that.setData({
        previewMenuRows: rows,
        previewDashboard: dashboard,
        schedulePreview: schedulePreview,
        previewHasBaby: hasBaby,
        babyMonthLabel: hasBaby ? that._babyMonthToLabel(pref.babyMonth) : '',
        previewHasSharedBase: hasSharedBase,
        previewComboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : ''),
        previewRhythmRings: isHelperMode ? [] : that._buildPreviewRhythmRings(menus),
        chefReportText: chefReportText,
        previewNarrativeText: that._buildNarrativeText(dashboard, chefReportText),
        previewMenuSubtitle: isHelperMode ? '' : that._buildMenuSubtitle(rows),
        previewFallbackMessage: fallbackMessage,
        previewTips: tips,
        isHelperMode: isHelperMode,
        isTiredMode: isTiredMode,
        previewPageTitle: previewPageTitle,
        previewPrimaryCta: previewPrimaryCta,
        helperData: helperData,
        adultCount: adultCount,
        avoidCapsules: avoidCapsules.length ? avoidCapsules : that.data.avoidCapsules,
        isOmakase: omakasePayload.isOmakase,
        omakaseVisible: omakasePayload.omakaseVisible,
        omakaseCopy: omakasePayload.omakaseCopy,
        omakaseHeroImage: omakasePayload.omakaseHeroImage,
        omakaseHeroName: omakasePayload.omakaseHeroName || '',
        omakaseComboText: omakasePayload.omakaseComboText || '',
        omakaseDishList: omakasePayload.omakaseDishList || [],
        isVip: !!getApp().globalData.isVip,
        kitchenBurners: that._kitchenConfig.burners,
        kitchenHasSteamer: that._kitchenConfig.hasSteamer,
        kitchenHasMicrowave: that._kitchenConfig.hasMicrowave,
        kitchenHasAirFryer: that._kitchenConfig.hasAirFryer,
        kitchenHasOven: that._kitchenConfig.hasOven
      }, function () {
        // rows 真正进入视图层后，再按 onReady 规则触发图片解析
        if (that._pageReady) that._resolvePreviewImages();
        else that._pendingResolve = true;
      });

      

      // 5. 延迟触发微缩转盘入场动画
      setTimeout(function () {
        if (that._pageAlive) that.setData({ isEntering: true });
      }, 300);

      // 6. 将解析后的对象同步回 globalData 以便「换一换」逻辑使用
      that._fullPreviewMenus = menus;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.menuPreview = {
        menus: menus,
        rows: rows,
        preference: pref,
        dashboard: dashboard,
        comboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : ''),
        balanceTip: '',
        hasSharedBase: rows.some(function (r) { return r.showSharedHint; })
      };

      // 7. helper 模式：同步云端菜谱后刷新纸条步骤，确保与 spec 8 一致（步骤从当前缓存按 id 解析）
      if (isHelperMode && menus.length > 0) {
        var app = getApp();
        if (app.syncCloudRecipes && typeof app.syncCloudRecipes === 'function') {
          app.syncCloudRecipes().then(function () {
            if (!that._pageAlive) return;
            try {
              var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
              var result = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
              if (result.steps && result.steps.length > 0 && menuGen.formatForHelperFromResult) {
                var nextHelperData = menuGen.formatForHelperFromResult(result, pref);
                that.setData({ helperData: nextHelperData });
              }
            } catch (err) {
              console.warn('[preview] 云端同步后刷新 helperData 失败:', err);
            }
          }).catch(function () {});
        }
      }
    } catch (e) {
      console.error('Preview onLoad Error:', e);
      wx.showModal({
        title: '提示',
        content: '数据已失效，请返回首页重新生成',
        showCancel: false,
        success: function () { wx.navigateBack(); }
      });
    }
  },
  
  onShow: function () {
    this._pageAlive = true;
    this.setData({ isVip: !!getApp().globalData.isVip });
    if (this.data.isOmakase) this._startOmakaseShake();
  },

  onHide: function () {
    this._pageAlive = false;
    this._stopOmakaseShake();
  },

  onUnload: function () {
    this._pageAlive = false;
    this._stopOmakaseShake();
  },

  onReady: function () {
    // 统一在 onReady 解析 cloud:// 到临时 HTTPS URL，
    // 并用 isImageReady 门控，让 <image> 只在 URL 就绪后才出现在 WXML 中。
    this._pageReady = true;
    if (this._pendingResolve) {
      this._pendingResolve = false;
      this._resolvePreviewImages();
      return;
    }
    // 兜底：如果 rows 已经在 onLoad 中写入，则正常执行；否则稍后由 onLoad 的 setData callback 触发
    if ((this.data.previewMenuRows || []).length > 0) {
      this._resolvePreviewImages();
    }
  },

  _swapImageExt: function (fileId) {
    if (typeof fileId !== 'string') return '';
    if (/\.png$/i.test(fileId)) return fileId.replace(/\.png$/i, '.jpg');
    if (/\.jpe?g$/i.test(fileId)) return fileId.replace(/\.jpe?g$/i, '.png');
    return '';
  },

  _resolvePreviewImages: function () {
    var that = this;
    if (!(wx.cloud && wx.cloud.getTempFileURL)) {
      // 没有云能力时不渲染任何云图，避免 src 走本地路径触发异常
      that.setData({ isImageReady: false });
      return;
    }

    var rows = that.data.previewMenuRows || [];
    var fileIds = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].hasCover && typeof rows[i].coverUrl === 'string' && rows[i].coverUrl.indexOf('cloud://') === 0) {
        fileIds.push(toFullFileId(rows[i].coverUrl));
      }
    }

    // 营养师插图
    var talkBgCloudId = CLOUD_ROOT + '/background_pic/professional_talk_background.png';
    fileIds.push(talkBgCloudId);
    // 手账风 Omakase：牛皮纸背景、营养师问候头像
    var omakaseBgCloudId = CLOUD_ROOT + '/background_pic/hero_image_background.png';
    var suggestionCoverCloudId = CLOUD_ROOT + '/background_pic/professional_suggestion_cover.png';
    fileIds.push(omakaseBgCloudId);
    fileIds.push(suggestionCoverCloudId);

    // 去重，避免重复请求
    var uniq = [];
    var seen = Object.create(null);
    for (var u = 0; u < fileIds.length; u++) {
      var id = fileIds[u];
      if (!id || seen[id]) continue;
      seen[id] = true;
      uniq.push(id);
    }

    that.setData({ isImageReady: false });

    function applyTempUrls(tempMap) {
      var newRows = rows.map(function (r) {
        if (!r || !r.hasCover) return r;
        var cloudId = (typeof r.coverUrl === 'string' && r.coverUrl.indexOf('cloud://') === 0) ? r.coverUrl : '';
        if (!cloudId) return r;
        var tmp = tempMap[cloudId];
        if (!tmp) return Object.assign({}, r, { coverTempUrl: '' });
        return Object.assign({}, r, { coverTempUrl: tmp });
      });

      // 营养师插图 URL
      var talkUrl = tempMap[talkBgCloudId] || '';
      var omakaseBgUrl = tempMap[omakaseBgCloudId] || '';
      var professionalSuggestionCoverUrl = tempMap[suggestionCoverCloudId] || '';

      var omakaseHeroNext = {};
      if (that.data.isOmakase && that._omakaseHeroRowIndex != null && newRows[that._omakaseHeroRowIndex]) {
        omakaseHeroNext.omakaseHeroImage = newRows[that._omakaseHeroRowIndex].coverTempUrl || '';
      }

      that.setData(Object.assign({
        previewMenuRows: newRows,
        isImageReady: true,
        professionalTalkBgUrl: talkUrl,
        omakaseBgUrl: omakaseBgUrl,
        professionalSuggestionCoverUrl: professionalSuggestionCoverUrl
      }, omakaseHeroNext));

      // 同步回 globalData：确保后续页面/逻辑读到的是可渲染的 URL
      try {
        var payload = getApp().globalData.menuPreview;
        if (payload && Array.isArray(payload.rows)) {
          payload.rows = newRows;
        }
      } catch (e) {}
    }

    wx.cloud.getTempFileURL({
      fileList: uniq,
      success: function (res) {
        var list = (res && res.fileList) ? res.fileList : [];
        var tempMap = Object.create(null);
        var failed = [];

        for (var i = 0; i < list.length; i++) {
          var it = list[i] || {};
          if (it.fileID && it.tempFileURL) {
            tempMap[it.fileID] = it.tempFileURL;
            // 同时写一份 env 简写 key，方便用原 coverUrl(简写) 来取
            tempMap[toEnvOnlyFileId(it.fileID)] = it.tempFileURL;
          } else if (it.fileID) {
            failed.push(it.fileID);
          }
        }

        // 兜底：若扩展名不匹配（png/jpg），尝试自动切换扩展名再取一次
        var retry = [];
        for (var j = 0; j < failed.length; j++) {
          var alt = that._swapImageExt(failed[j]);
          if (alt) retry.push(alt);
        }

        if (retry.length === 0) {
          applyTempUrls(tempMap);
          return;
        }

        wx.cloud.getTempFileURL({
          fileList: retry,
          success: function (res2) {
            var list2 = (res2 && res2.fileList) ? res2.fileList : [];
            for (var k = 0; k < list2.length; k++) {
              var it2 = list2[k] || {};
              if (it2.fileID && it2.tempFileURL) {
                // 把 alt fileID 也映射回原 fileID（通过 swap 反推）
                var back = that._swapImageExt(it2.fileID);
                if (back) {
                  tempMap[back] = it2.tempFileURL;
                  tempMap[toEnvOnlyFileId(back)] = it2.tempFileURL;
                }
                tempMap[it2.fileID] = it2.tempFileURL;
                tempMap[toEnvOnlyFileId(it2.fileID)] = it2.tempFileURL;
              }
            }
            applyTempUrls(tempMap);
          },
          fail: function () {
            applyTempUrls(tempMap);
          }
        });
      },
      fail: function () {
        that.setData({ isImageReady: false });
      }
    });
  },

  onOmakaseReveal: function () {
    var that = this;
    this._stopOmakaseShake();
    if (getApp().globalData) getApp().globalData.omakaseCopy = '';
    this.setData({ omakaseVisible: false });
    setTimeout(function () {
      if (that._pageAlive) that.setData({ isOmakase: false });
    }, 450);
  },

  onOmakaseReshuffle: function () {
    var that = this;
    wx.vibrateLong();
    that.setData({ omakaseRefreshing: true });

    setTimeout(function () {
      if (!that._pageAlive) return;
      var currentDishList = that.data.omakaseDishList || [];
      var currentMenus = getApp().globalData.todayMenus || [];
      var lockedIndices = [];
      var lockedNames = [];
      for (var li = 0; li < currentDishList.length; li++) {
        if (currentDishList[li].locked) {
          lockedIndices.push(li);
          lockedNames.push(currentDishList[li].name || (currentMenus[li] && currentMenus[li].adultRecipe && currentMenus[li].adultRecipe.name) || '');
        }
      }

      if (lockedIndices.length > 0 && currentMenus.length > 0) {
        try {
          var menuService = require('../../data/menuData.js');
          var payload = getApp().globalData.menuPreview;
          var pref = Object.assign(
            {},
            payload && payload.preference ? payload.preference : that._defaultPreference(),
            { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() }
          );
          var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
          var history = Array.isArray(that._shuffleExcludeHistory) ? that._shuffleExcludeHistory : [];
          var seen = {};
          var mergedExclude = [];
          currentNames.concat(history).forEach(function (n) { if (n && !seen[n]) { seen[n] = true; mergedExclude.push(n); } });
          lockedNames.forEach(function (n) { if (n && !seen[n]) { seen[n] = true; mergedExclude.push(n); } });
          pref.excludeRecipeNames = mergedExclude;
          var result = menuService.getTodayMenusByCombo(pref);
          var rawMenus = result.menus || result;
          var hasBaby = pref.hasBaby === true;
          if (!hasBaby) rawMenus.forEach(function (m) { m.babyRecipe = null; });
          var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
          for (var o = 0; o < lockedIndices.length; o++) {
            newMenus[lockedIndices[o]] = currentMenus[lockedIndices[o]];
          }
          var newRows = [];
          for (var idx = 0; idx < newMenus.length; idx++) {
            var m = newMenus[idx];
            var ar = m.adultRecipe;
            var adultName = (ar && ar.name) ? ar.name : '—';
            var stage = hasBaby && menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
            var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
            var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar);
            var sameAsAdultHint = (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '';
            newRows.push({
              adultName: adultName,
              babyName: babyName,
              showSharedHint: hasBaby && babyName && idx === 0,
              checked: true,
              recommendReason: reason,
              sameAsAdultHint: sameAsAdultHint,
              cookType: (ar && ar.cook_type) || '',
              coverUrl: coverService.getRecipeCoverImageUrl(adultName),
              coverTempUrl: '',
              hasCover: true
            });
          }
          var newDishList = newMenus.map(function (m, idx) {
            var ar = m.adultRecipe;
            var dishType = ar ? (ar.dish_type || '') : '';
            var meat = ar ? (ar.meat || '') : '';
            var role = dishType === 'soup' ? '汤' : (meat === 'vegetable' ? '素' : '荤');
            var isLocked = lockedIndices.indexOf(idx) !== -1;
            return {
              id: ar ? (ar.id || ar._id || '') : '',
              name: ar ? (ar.name || '') : '',
              role: role,
              locked: isLocked
            };
          }).filter(function (d) { return d.name; });
          var dashboard = that._computePreviewDashboard(newMenus, pref);
          var schedulePreview = that._computeSchedulePreview(newMenus);
          var heroMenu = newMenus.filter(function (m) { return m.meat && m.meat !== 'vegetable'; })[0] || newMenus[0];
          var heroName = (heroMenu.adultRecipe && heroMenu.adultRecipe.name) || '这道菜';
          var otherNames = newMenus.filter(function (m) { return m !== heroMenu; }).map(function (m) {
            return (m.adultRecipe && m.adultRecipe.name) || '';
          }).filter(Boolean);
          if (getApp().globalData.menuPreview) {
            getApp().globalData.menuPreview.menus = newMenus;
            getApp().globalData.menuPreview.rows = newRows;
            getApp().globalData.menuPreview.preference = pref;
            getApp().globalData.menuPreview.dashboard = dashboard;
          }
          getApp().globalData.preference = pref;
          getApp().globalData.todayMenus = newMenus;
          that._omakaseHeroRowIndex = newMenus.indexOf(heroMenu);
          var copyContext = {
            isTired: pref.isTimeSave === true || pref.is_time_save === true || (wx.getStorageSync('zen_cook_status') === 'tired'),
            hasExpiringIngredient: !!(pref.heroIngredient || (Array.isArray(pref.fridgeExpiring) && pref.fridgeExpiring.length > 0)),
            heroIngredient: pref.heroIngredient || (Array.isArray(pref.fridgeExpiring) && pref.fridgeExpiring[0]) || '',
            heroFlavor: (heroMenu.adultRecipe && heroMenu.adultRecipe.flavor_profile) || '',
            heroCookType: (heroMenu.adultRecipe && heroMenu.adultRecipe.cook_type) || ''
          };
          injectRegionCopyContext(copyContext, heroName);
          that.setData({
            previewMenuRows: newRows,
            previewDashboard: dashboard,
            schedulePreview: schedulePreview,
            omakaseDishList: newDishList,
            omakaseHeroName: heroName,
            omakaseComboText: otherNames.join(' · '),
            omakaseCopy: pickOmakaseCopy(copyContext),
            omakaseHeroImage: '',
            omakaseRefreshing: false,
            isImageReady: false
          }, function () { if (that._pageReady) that._resolvePreviewImages(); });
        } catch (err) {
          console.error('onOmakaseReshuffle merge failed:', err);
          that.setData({ omakaseRefreshing: false });
        }
        return;
      }

      that.handleShuffle();

      var menus = getApp().globalData.todayMenus || [];
      if (menus.length > 0) {
        var heroMenu = menus.filter(function (m) { return m.meat && m.meat !== 'vegetable'; })[0] || menus[0];
        var heroName = (heroMenu.adultRecipe && heroMenu.adultRecipe.name) || '这道菜';
        var otherNames = menus.filter(function (m) { return m !== heroMenu; }).map(function (m) {
          return (m.adultRecipe && m.adultRecipe.name) || '';
        }).filter(Boolean);
        var pref = getApp().globalData.preference || {};
        var isTiredMode = pref.isTimeSave === true || pref.is_time_save === true || (wx.getStorageSync('zen_cook_status') === 'tired');
        var copyContext = {
          isTired: isTiredMode,
          hasExpiringIngredient: !!(pref.heroIngredient || (Array.isArray(pref.fridgeExpiring) && pref.fridgeExpiring.length > 0)),
          heroIngredient: pref.heroIngredient || (Array.isArray(pref.fridgeExpiring) && pref.fridgeExpiring[0]) || '',
          heroFlavor: (heroMenu.adultRecipe && heroMenu.adultRecipe.flavor_profile) || '',
          heroCookType: (heroMenu.adultRecipe && heroMenu.adultRecipe.cook_type) || ''
        };
        injectRegionCopyContext(copyContext, heroName);
        that._omakaseHeroRowIndex = menus.indexOf(heroMenu);
        var dishList = menus.map(function (m, idx) {
          var ar = m.adultRecipe;
          var dishType = ar ? (ar.dish_type || '') : '';
          var meat = ar ? (ar.meat || '') : '';
          var role = dishType === 'soup' ? '汤' : (meat === 'vegetable' ? '素' : '荤');
          return {
            id: ar ? (ar.id || ar._id || '') : '',
            name: ar ? (ar.name || '') : '',
            role: role,
            locked: false
          };
        }).filter(function (d) { return d.name; });
        that.setData({
          omakaseHeroName: heroName,
          omakaseComboText: otherNames.join(' · '),
          omakaseDishList: dishList,
          omakaseCopy: pickOmakaseCopy(copyContext),
          omakaseHeroImage: '',
          omakaseRefreshing: false
        });
      } else {
        that.setData({ omakaseRefreshing: false });
      }
    }, 220);
  },

  onToggleLockDish: function (e) {
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var list = (this.data.omakaseDishList || []).slice();
    if (!list[index]) return;
    var willLock = !list[index].locked;
    if (willLock && !getApp().globalData.isVip) {
      wx.showModal({
        title: '解锁主厨记忆',
        content: '想要锁住喜欢的菜、只换掉不想要的？解锁 Pro 特权，让我记住你的每一次挑剔。',
        confirmText: '了解 Pro',
        confirmColor: '#B8976A',
        cancelText: '暂不需要',
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/pro/pro?source=omakase_lock' });
          }
        }
      });
      return;
    }
    list[index].locked = willLock;
    this.setData({ omakaseDishList: list });
    if (list[index].locked && list[index].id) {
      tasteProfile.recordLockSignal(list[index].id);
    }
  },

  onVibeTagSelect: function (e) {
    var key = e.currentTarget.dataset.region;
    if (!key) return;
    var regionCuisineMap = require('../../data/regionCuisineMap.js');
    var label = regionCuisineMap.getLabelByCuisineKey(key) || key;
    tasteProfile.setManualRegion(label);
    this.setData({ vibeRegion: key, showVibeCustomInput: false, vibeCustomText: '' });
  },

  onVibeCustomInput: function () {
    this.setData({ showVibeCustomInput: true, vibeRegion: 'custom' });
  },

  onVibeCustomTextInput: function (e) {
    this.setData({ vibeCustomText: (e.detail && e.detail.value) || '' });
  },

  onVibeCustomConfirm: function () {
    var text = (this.data.vibeCustomText || '').trim();
    tasteProfile.setManualRegion(text || null);
    this.setData({ showVibeCustomInput: false, vibeCustomText: '', vibeRegion: text ? 'custom' : '' });
  },

  onRejectSingleDish: function (e) {
    var that = this;
    var recipeId = e.currentTarget.dataset.recipeId;
    var FREE_LIMIT = 2;
    var isFoundingMember = false;
    try { isFoundingMember = !!wx.getStorageSync('pro_founding_member'); } catch (e) {}
    if (isFoundingMember) FREE_LIMIT = 999;
    var todayKey = 'omakase_reject_' + getTodayDateKey();
    var count = that._omakaseRejectCount || 0;

    if (count >= FREE_LIMIT) {
      wx.showModal({
        title: '解锁主厨记忆',
        content: '想要永久屏蔽这道菜？解锁【私人主厨】特权，让我记住你的每一次挑剔。',
        confirmText: '了解特权',
        confirmColor: '#B8976A',
        cancelText: '暂不需要',
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/pro/pro?source=omakase_reject' });
          }
        }
      });
      return;
    }

    var payload = getApp().globalData.menuPreview;
    var menus = (payload && payload.menus ? payload.menus : getApp().globalData.todayMenus || []).slice();
    var rows = (that.data.previewMenuRows || []).slice();
    var targetIdx = -1;
    for (var i = 0; i < menus.length; i++) {
      var rid = menus[i].adultRecipe ? (menus[i].adultRecipe.id || menus[i].adultRecipe._id || '') : '';
      if (rid === recipeId) { targetIdx = i; break; }
    }
    if (targetIdx < 0 || !menus[targetIdx]) {
      wx.showToast({ title: '未找到该菜品', icon: 'none' });
      return;
    }

    var currentDishList = that.data.omakaseDishList || [];
    var keptIds = [];
    for (var k = 0; k < currentDishList.length; k++) {
      if (currentDishList[k].locked && currentDishList[k].id && currentDishList[k].id !== recipeId) {
        keptIds.push(currentDishList[k].id);
      }
    }
    if (keptIds.length > 0 || currentDishList.some(function (d) { return d.locked; })) {
      tasteProfile.recordCombinationRejection(keptIds, recipeId);
    }

    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : that._defaultPreference(),
      { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() }
    );
    var hasBaby = !!pref.hasBaby;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || 2;
    var firstMeatIndex = -1;
    for (var f = 0; f < menus.length; f++) {
      if (menus[f].meat !== 'vegetable') { firstMeatIndex = f; break; }
    }

    try {
      var generator = require('../../data/menuGenerator.js');
      var menuService = require('../../data/menuData.js');
      var selectedMenus = [];
      var checkedMeats = [];
      for (var j = 0; j < menus.length; j++) {
        if (j !== targetIdx) {
          selectedMenus.push(menus[j]);
          var m = (menus[j].adultRecipe && menus[j].adultRecipe.meat) || menus[j].meat;
          if (m && checkedMeats.indexOf(m) === -1) checkedMeats.push(m);
        }
      }
      var counts = menuService.getFlavorAndCookCounts(selectedMenus);
      var forceLight = (counts.spicy + counts.savory) > 2;
      var curStirFry = counts.stirFry;
      var curStew = counts.stew;
      var hasBabyThis = hasBaby && menus[targetIdx].meat !== 'vegetable' && targetIdx === firstMeatIndex;
      var constraints = { forceLight: forceLight, currentStirFry: curStirFry, currentStew: curStew, excludeMeats: checkedMeats };
      var picked = menuService.pickReplacementFromCache(menus[targetIdx].meat, constraints, pref);
      var res;
      if (picked) {
        res = generator.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
      } else {
        var filters = { preferredFlavor: forceLight ? 'light' : null, preferQuick: curStew >= 1, userPreference: pref };
        res = generator.generateMenuWithFilters(menus[targetIdx].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
      }
      var newSlot = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || menus[targetIdx].meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || menus[targetIdx].taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null,
        checked: true
      };
      menus[targetIdx] = newSlot;
      var ar = newSlot.adultRecipe;
      var st = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
      var adultNameNew = (ar && ar.name) ? ar.name : '—';
      rows[targetIdx] = {
        adultName: adultNameNew,
        babyName: hasBaby ? ((st && st.name) || (newSlot.babyRecipe && newSlot.babyRecipe.name) || '') : '',
        showSharedHint: hasBaby && newSlot.babyRecipe && targetIdx === firstMeatIndex,
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
        sameAsAdultHint: (st && st.same_as_adult_hint) ? '与大人同款，分装即可' : '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(adultNameNew),
        coverTempUrl: '',
        hasCover: true
      };

      var prevDishList = that.data.omakaseDishList || [];
      var dishList = menus.map(function (m, idx) {
        var ar2 = m.adultRecipe;
        var dishType = ar2 ? (ar2.dish_type || '') : '';
        var meat = ar2 ? (ar2.meat || '') : '';
        var role = dishType === 'soup' ? '汤' : (meat === 'vegetable' ? '素' : '荤');
        var rid = ar2 ? (ar2.id || ar2._id || '') : '';
        var prev = prevDishList[idx];
        var locked = !!(prev && prev.locked && (idx === targetIdx ? false : prev.id === rid));
        return {
          id: rid,
          name: ar2 ? (ar2.name || '') : '',
          role: role,
          locked: locked
        };
      }).filter(function (d) { return d.name; });

      var heroMenu = menus.filter(function (m) { return m.meat && m.meat !== 'vegetable'; })[0] || menus[0];
      var heroName = (heroMenu.adultRecipe && heroMenu.adultRecipe.name) || '这道菜';
      var otherNames = menus.filter(function (m) { return m !== heroMenu; }).map(function (m) {
        return (m.adultRecipe && m.adultRecipe.name) || '';
      }).filter(Boolean);
      that._omakaseHeroRowIndex = menus.indexOf(heroMenu);

      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = menus;
        getApp().globalData.menuPreview.rows = rows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = that._computePreviewDashboard(menus, pref);
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;

      count++;
      that._omakaseRejectCount = count;
      try { wx.setStorageSync(todayKey, count); } catch (err) {}

      var setDataPayload = {
        previewMenuRows: rows,
        omakaseDishList: dishList,
        omakaseHeroName: heroName,
        omakaseComboText: otherNames.join(' · '),
        previewDashboard: that._computePreviewDashboard(menus, pref),
        schedulePreview: that._computeSchedulePreview(menus),
        isImageReady: false
      };
      if (targetIdx === that._omakaseHeroRowIndex) {
        setDataPayload.omakaseHeroImage = '';
      }
      that.setData(setDataPayload, function () {
        if (that._pageReady) that._resolvePreviewImages();
      });
      wx.showToast({ title: '已为你换了一道', icon: 'none' });
    } catch (err) {
      console.error('onRejectSingleDish replace failed:', err);
      wx.showToast({ title: '换菜失败', icon: 'none' });
    }
  },

  _startOmakaseShake: function () {
    var that = this;
    wx.startAccelerometer({ interval: 'normal' });
    this._omakaseShakeHandler = function (res) {
      var mag = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z);
      if (mag > 2.5 && !that._omakaseShakeCooldown && that.data.omakaseVisible) {
        that._omakaseShakeCooldown = true;
        wx.vibrateLong();
        that.onOmakaseReshuffle();
        setTimeout(function () { that._omakaseShakeCooldown = false; }, 3000);
      }
    };
    wx.onAccelerometerChange(this._omakaseShakeHandler);
  },

  _stopOmakaseShake: function () {
    wx.stopAccelerometer();
    if (this._omakaseShakeHandler) {
      wx.offAccelerometerChange(this._omakaseShakeHandler);
      this._omakaseShakeHandler = null;
    }
  },

  onCheckRow: function (e) {
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = (this.data.previewMenuRows || []).slice();
    if (!menus[index] || !rows[index]) return;
    var newChecked = !menus[index].checked;
    menus[index].checked = newChecked;
    rows[index] = Object.assign({}, rows[index], { checked: newChecked });
    if (payload) payload.menus = menus;
    if (payload) payload.rows = rows;
    this.setData({ previewMenuRows: rows });
  },

  onReplaceSingle: function (e) {
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = (this.data.previewMenuRows || []).slice();
    if (!menus[index] || !rows[index]) return;

    var recipeId = (menus[index].adultRecipe && menus[index].adultRecipe.id) || '';
    var that = this;

    wx.showActionSheet({
      itemList: ['太复杂了', '不喜欢这食材', '最近吃过了', '直接换'],
      success: function (res) {
        var reasons = ['complex', 'ingredient', 'eaten', 'skip'];
        var reason = reasons[res.tapIndex];
        if (reason !== 'skip' && recipeId) {
          tasteProfile.addDislikedRecipe(recipeId, reason);
        }
        menus[index].checked = false;
        rows[index] = Object.assign({}, rows[index], { checked: false });
        if (payload) { payload.menus = menus; payload.rows = rows; }
        that.setData({ previewMenuRows: rows }, function () {
          that.handleReplaceUnchecked();
        });
      }
    });
  },

  onRemoveDish: function (e) {
    var that = this;
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = (this.data.previewMenuRows || []).slice();
    if (!menus[index] || !rows[index]) return;
    if (menus.length <= 1) {
      wx.showToast({ title: '至少保留一道菜', icon: 'none' });
      return;
    }
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    pref = Object.assign({}, pref, { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() });
    var newMenus = menus.slice();
    var newRows = rows.slice();
    newMenus.splice(index, 1);
    newRows.splice(index, 1);
    var dashboard = that._computePreviewDashboard(newMenus, pref);
    var schedulePreview = that._computeSchedulePreview(newMenus);
    var nextHelperData = that.data.helperData;
    if (that.data.isHelperMode && newMenus.length > 0) {
      try {
        var menuService = require('../../data/menuData.js');
        var menuGen = require('../../data/menuGenerator.js');
        var shopList = menuService.generateShoppingListFromMenus(pref, newMenus) || [];
        var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
        var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
        if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
          nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
        } else {
          nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
        }
      } catch (err) { console.warn('onRemoveDish helperData failed:', err); }
    }
    if (getApp().globalData.menuPreview) {
      getApp().globalData.menuPreview.menus = newMenus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.menuPreview.dashboard = dashboard;
    }
    getApp().globalData.todayMenus = newMenus;
    that.setData({
      previewMenuRows: newRows,
      previewDashboard: dashboard,
      schedulePreview: schedulePreview,
      helperData: nextHelperData,
      isImageReady: false
    }, function () { if (that._pageReady) that._resolvePreviewImages(); });
    wx.showToast({ title: '已删掉一道菜', icon: 'none' });
  },

  onTweakInput: function (e) {
    this.setData({ tweakText: (e.detail.value || '').slice(0, 50) });
  },

  onTweakSubmit: function () {
    var text = (this.data.tweakText || '').trim();
    if (!text) return;
    var that = this;
    getApp().globalData._userTweak = text;
    wx.showLoading({ title: '主厨重新搭配中…' });

    var pref = getApp().globalData.preference || {};
    var source = menuData.getRecipeSource ? menuData.getRecipeSource() : null;
    var adultRecipes = (source && source.adultRecipes) || [];

    // 从 tweak 文本中提取食材关键词，提升匹配候选的权重
    var TWEAK_MEAT_KEYWORDS = {
      '猪肉': 'pork', '排骨': 'pork', '五花': 'pork', '里脊': 'pork',
      '牛肉': 'beef', '牛腩': 'beef', '牛柳': 'beef',
      '鸡肉': 'chicken', '鸡腿': 'chicken', '鸡翅': 'chicken', '鸡胸': 'chicken',
      '鱼': 'fish', '鲈鱼': 'fish', '鳕鱼': 'fish', '三文鱼': 'fish',
      '虾': 'shrimp', '虾仁': 'shrimp', '海鲜': 'shrimp',
      '蔬菜': 'vegetable', '素菜': 'vegetable'
    };
    var tweakMeatTypes = {};
    for (var kw in TWEAK_MEAT_KEYWORDS) {
      if (TWEAK_MEAT_KEYWORDS.hasOwnProperty(kw) && text.indexOf(kw) !== -1) {
        tweakMeatTypes[TWEAK_MEAT_KEYWORDS[kw]] = true;
      }
    }
    var hasTweakMeatHint = Object.keys(tweakMeatTypes).length > 0;

    // 优先匹配 tweak 食材的候选排在前面，确保 AI 有足够的相关选项
    var boosted = [];
    var rest = [];
    for (var ri = 0; ri < adultRecipes.length; ri++) {
      var r = adultRecipes[ri];
      if (hasTweakMeatHint && r.meat && tweakMeatTypes[r.meat]) {
        boosted.push(r);
      } else {
        rest.push(r);
      }
    }
    var sorted = boosted.concat(rest);
    var candidatePool = sorted.length > 500 ? sorted.slice(0, 500) : sorted;
    var candidates = candidatePool.map(function (r) {
      return { id: r.id || r._id, _id: r._id || r.id, name: r.name, meat: r.meat, cook_type: r.cook_type, flavor_profile: r.flavor_profile, dish_type: r.dish_type, cook_minutes: r.cook_minutes || 0, tags: r.tags || [] };
    });

    wx.cloud.callFunction({
      name: 'smartMenuGen',
      data: {
        preference: pref,
        mood: '随便',
        weather: {},
        recentDishNames: '',
        candidates: candidates,
        userTweak: text
      }
    }).then(function (res) {
      wx.hideLoading();
      var out = res.result;
      if (out && out.code === 0 && out.data && Array.isArray(out.data.recipeIds) && out.data.recipeIds.length > 0) {
        getApp().globalData.chefReportText = out.data.reasoning || '';
        getApp().globalData.dishHighlights = out.data.dishHighlights || {};
        var allRecipes = (source && source.adultRecipes) || [];
        var recipeMap = {};
        for (var i = 0; i < allRecipes.length; i++) {
          var rid = allRecipes[i].id || allRecipes[i]._id;
          if (rid) recipeMap[rid] = allRecipes[i];
        }
        var newMenus = out.data.recipeIds.map(function (id) {
          var r = recipeMap[id];
          if (!r) return null;
          return { adultRecipe: r, babyRecipe: null, checked: true, meat: r.meat, taste: r.taste || r.flavor_profile };
        }).filter(Boolean);

        if (newMenus.length > 0) {
          try {
            wx.setStorageSync('today_menus', JSON.stringify(newMenus));
          } catch (e) {}
          getApp().globalData._userTweak = '';
          that.setData({ tweakText: '' });
          that.onLoad();
          wx.showToast({ title: '已按你的要求重新搭配', icon: 'none' });
          return;
        }
      }
      wx.showToast({ title: '推荐失败，请稍后再试', icon: 'none' });
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '网络出问题了', icon: 'none' });
    });
  },

  handleShuffle: function () {
    var that = this;
    var rows = that.data.previewMenuRows || [];
    var hasUnchecked = rows.some(function (r) { return !r.checked; });
    if (hasUnchecked) {
      that.handleReplaceUnchecked();
      return;
    }
    try {
      var menuService = require('../../data/menuData.js');
      var payload = getApp().globalData.menuPreview;
      var pref = Object.assign(
        {},
        payload && payload.preference ? payload.preference : that._defaultPreference(),
        { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() }
      );
      var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
      var history = Array.isArray(that._shuffleExcludeHistory) ? that._shuffleExcludeHistory : [];
      var seen = {};
      var mergedExclude = [];
      currentNames.concat(history).forEach(function (n) { if (n && !seen[n]) { seen[n] = true; mergedExclude.push(n); } });
      if (mergedExclude.length > 0) pref.excludeRecipeNames = mergedExclude;
      var result = menuService.getTodayMenusByCombo(pref);
      var rawMenus = result.menus || result;
      var hasBaby = pref.hasBaby === true;
      if (!hasBaby) rawMenus.forEach(function (m) { m.babyRecipe = null; });
      var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
      var newRows = [];
      for (var idx = 0; idx < newMenus.length; idx++) {
        var m = newMenus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar);
        var sameAsAdultHint = (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '';
        newRows.push({
          adultName: adultName,
          babyName: babyName,
          showSharedHint: hasBaby && babyName && idx === 0,
          checked: true,
          recommendReason: reason,
          sameAsAdultHint: sameAsAdultHint,
          cookType: (ar && ar.cook_type) || '',
          coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: '',
          hasCover: true
        });
      }
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var schedulePreview = that._computeSchedulePreview(newMenus);
      var hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
      var balanceTip = '';
      var hasSpicy = false, hasLightOrSweet = false;
      for (var b = 0; b < newMenus.length; b++) {
        var fl = (newMenus[b].adultRecipe && newMenus[b].adultRecipe.flavor_profile) || '';
        if (fl === 'spicy') hasSpicy = true;
        if (fl === 'light' || fl === 'sweet_sour' || fl === 'sour_fresh') hasLightOrSweet = true;
      }
      if (hasSpicy && hasLightOrSweet) balanceTip = '口味互补：辣配清淡/酸甜，味觉更舒适';
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = dashboard;
        getApp().globalData.menuPreview.hasSharedBase = hasSharedBase;
        getApp().globalData.menuPreview.comboName = result.comboName || '';
        getApp().globalData.menuPreview.balanceTip = balanceTip;
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      if (!Array.isArray(that._shuffleExcludeHistory)) that._shuffleExcludeHistory = [];
      currentNames.forEach(function (n) {
        if (n && that._shuffleExcludeHistory.indexOf(n) === -1) that._shuffleExcludeHistory.push(n);
      });
      if (that._shuffleExcludeHistory.length > 30) that._shuffleExcludeHistory = that._shuffleExcludeHistory.slice(-20);
      var tips = that._buildPreviewTips(dashboard, hasSharedBase, balanceTip, that.data.previewFallbackMessage);
      var nextHelperData = that.data.helperData || { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' };
      if (that.data.isHelperMode && newMenus.length > 0) {
        try {
          var menuGen = require('../../data/menuGenerator.js');
          var shopList = menuService.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('helperData on shuffle failed:', e); }
      }
      that.setData(
        {
          previewMenuRows: newRows,
          previewComboName: result.comboName || '',
          previewBalanceTip: balanceTip,
          previewDashboard: dashboard,
          schedulePreview: schedulePreview,
          previewHasSharedBase: hasSharedBase,
          previewHasBaby: hasBaby,
          babyMonthLabel: hasBaby ? that._babyMonthToLabel(pref.babyMonth) : '',
          previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
          previewNarrativeText: that._buildNarrativeText(dashboard, ''),
          previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
          helperData: nextHelperData,
          isImageReady: false,
          chefReportText: '',
          previewTips: tips
        },
        function () { if (that._pageReady) that._resolvePreviewImages(); }
      );

    } catch (e) {
      console.error('换一换失败:', e);
      wx.showToast({ title: '换一换失败', icon: 'none' });
    }
  },

  handleReplaceUnchecked: function () {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = that.data.previewMenuRows || [];
    if (menus.length === 0 || rows.length === 0) return;
    var uncheckedIndices = [];
    for (var u = 0; u < rows.length; u++) {
      if (!rows[u].checked) uncheckedIndices.push(u);
    }
    if (uncheckedIndices.length === 0) {
      wx.showToast({ title: '请先取消勾选要换掉的菜品', icon: 'none' });
      return;
    }
    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : that._defaultPreference(),
      { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() }
    );
    var hasBaby = pref.hasBaby;
    var babyMonth = pref.babyMonth;
    var adultCount = pref.adultCount;
    var firstMeatIndex = -1;
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].meat !== 'vegetable') { firstMeatIndex = i; break; }
    }
    try {
      var generator = require('../../data/menuGenerator.js');
      var menuService = require('../../data/menuData.js');
      var selectedMenus = [];
      var checkedMeats = [];
      for (var j = 0; j < menus.length; j++) {
        if (rows[j].checked) {
          selectedMenus.push(menus[j]);
          var m = (menus[j].adultRecipe && menus[j].adultRecipe.meat) || menus[j].meat;
          if (m && checkedMeats.indexOf(m) === -1) checkedMeats.push(m);
        }
      }
      var counts = menuService.getFlavorAndCookCounts(selectedMenus);
      var forceLight = (counts.spicy + counts.savory) > 2;
      var curStirFry = counts.stirFry;
      var curStew = counts.stew;
      var balanceTip = '';
      if (forceLight) balanceTip = '当前偏重下饭，已为您补充清爽汤品';
      else if (curStew >= 1) balanceTip = '已有炖菜，已为您补充快手小炒';
      var newMenus = [];
      var newRows = [];
      for (var i = 0; i < menus.length; i++) {
        if (rows[i].checked) {
          newMenus.push(menus[i]);
          newRows.push(rows[i]);
        } else {
          var hasBabyThis = hasBaby && menus[i].meat !== 'vegetable' && i === firstMeatIndex;
          var constraints = { forceLight: forceLight, currentStirFry: curStirFry, currentStew: curStew, excludeMeats: checkedMeats };
          var picked = menuService.pickReplacementFromCache(menus[i].meat, constraints, pref);
          var res;
          if (picked) {
            res = generator.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
          } else {
            var filters = { preferredFlavor: forceLight ? 'light' : null, preferQuick: curStew >= 1, userPreference: pref };
            res = generator.generateMenuWithFilters(menus[i].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
          }
          var newSlot = {
            meat: (res.adultRecipe && res.adultRecipe.meat) || menus[i].meat,
            taste: (res.adultRecipe && res.adultRecipe.taste) || menus[i].taste,
            adultRecipe: res.adultRecipe || null,
            babyRecipe: res.babyRecipe || null,
            checked: true
          };
          newMenus.push(newSlot);
          if (newSlot.adultRecipe) {
            var ct = newSlot.adultRecipe.cook_type || '';
            if (ct === 'stir_fry') curStirFry++;
            else if (ct === 'stew') curStew++;
          }
          var ar = newSlot.adultRecipe;
          var st = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
          var adultNameNew = (ar && ar.name) ? ar.name : '—';
          newRows.push({
            adultName: adultNameNew,
            babyName: hasBaby ? ((st && st.name) || (newSlot.babyRecipe && newSlot.babyRecipe.name) || '') : '',
            showSharedHint: hasBaby && newSlot.babyRecipe && i === firstMeatIndex,
            checked: true,
            recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
            sameAsAdultHint: (st && st.same_as_adult_hint) ? '与大人同款，分装即可' : '',
            cookType: (ar && ar.cook_type) || '',
            coverUrl: coverService.getRecipeCoverImageUrl(adultNameNew),
            coverTempUrl: '',
            hasCover: true
          });
        }
      }
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = that._computePreviewDashboard(newMenus, pref);
        getApp().globalData.menuPreview.hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
        getApp().globalData.menuPreview.balanceTip = balanceTip;
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var schedulePreview = that._computeSchedulePreview(newMenus);
      var tips = that._buildPreviewTips(dashboard, newRows.some(function (r) { return r.showSharedHint; }), balanceTip, that.data.previewFallbackMessage);
      var nextHelperData = that.data.helperData || { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' };
      if (that.data.isHelperMode && newMenus.length > 0) {
        try {
          var menuData = require('../../data/menuData.js');
          var menuGen = require('../../data/menuGenerator.js');
          var shopList = menuData.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('helperData on replace failed:', e); }
      }
      that.setData({
        previewMenuRows: newRows,
        previewBalanceTip: balanceTip,
        previewDashboard: dashboard,
        schedulePreview: schedulePreview,
        previewHasSharedBase: newRows.some(function (r) { return r.showSharedHint; }),
        previewHasBaby: !!(pref && pref.hasBaby),
        babyMonthLabel: pref && pref.hasBaby ? that._babyMonthToLabel(pref.babyMonth) : '',
        previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
        previewNarrativeText: that._buildNarrativeText(dashboard, ''),
        previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
        helperData: nextHelperData,
        isImageReady: false,
        previewTips: tips,
        chefReportText: ''
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });

      // 局部换菜后，主厨报告已不准确，清除
      wx.showToast({ title: '已为您选出更均衡的搭配', icon: 'none' });
    } catch (e) {
      console.error('换掉未勾选失败:', e);
      wx.showToast({ title: '替换失败', icon: 'none' });
    }
  },

  onToggleBurner: function (e) {
    var val = parseInt(e.currentTarget.dataset.val, 10);
    if (val !== 1 && val !== 2) return;
    if (val === this.data.kitchenBurners) return;
    this._kitchenConfig = this._kitchenConfig || {};
    this._kitchenConfig.burners = val;
    var that = this;
    that.setData({ kitchenBurners: val });
    that._refreshScheduleAfterKitchenChange();
  },

  onToggleAppliance: function (e) {
    var key = e.currentTarget.dataset.key;
    var fieldMap = { microwave: 'kitchenHasMicrowave', airFryer: 'kitchenHasAirFryer', steamer: 'kitchenHasSteamer', oven: 'kitchenHasOven' };
    var configMap = { microwave: 'hasMicrowave', airFryer: 'hasAirFryer', steamer: 'hasSteamer', oven: 'hasOven' };
    var field = fieldMap[key];
    var cfgKey = configMap[key];
    if (!field || !cfgKey) return;
    var newVal = !this.data[field];
    this._kitchenConfig = this._kitchenConfig || {};
    this._kitchenConfig[cfgKey] = newVal;
    var patch = {};
    patch[field] = newVal;
    this.setData(patch);
    this._refreshScheduleAfterKitchenChange();
  },

  _refreshScheduleAfterKitchenChange: function () {
    var that = this;
    var menus = (that._fullPreviewMenus || []);
    var prevTotalTime = (that.data.schedulePreview && that.data.schedulePreview.totalTime) || 0;
    var prevSerialTime = (that.data.schedulePreview && that.data.schedulePreview.serialTime) || 0;

    that.setData({ isRecalculating: true });

    var delay = 400 + Math.floor(Math.random() * 200);

    setTimeout(function () {
      if (!that._pageAlive) return;

      try { tasteProfile.update({ kitchenConfig: that._kitchenConfig }); } catch (e) {}
      var pref = getApp().globalData.preference || {};
      pref.kitchenConfig = that._kitchenConfig;
      getApp().globalData.preference = pref;

      if (!menus || menus.length < 2) {
        that.setData({ isRecalculating: false });
        return;
      }

      var schedulePreview = that._computeSchedulePreview(menus);
      var dashboard = that._computePreviewDashboard(menus, pref);

      var totalUnchanged = (schedulePreview.totalTime === prevTotalTime && schedulePreview.serialTime === prevSerialTime);

      that.setData({
        isRecalculating: false,
        schedulePreview: schedulePreview,
        previewDashboard: dashboard
      });

      try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}

      if (totalUnchanged) {
        wx.showToast({
          title: '✨ 当前菜谱已处于最优物理排程',
          icon: 'none',
          duration: 2000
        });
      }
    }, delay);
  },

  _getKitchenConfig: function () {
    return this._kitchenConfig || { burners: 2, hasSteamer: false, hasAirFryer: false, hasOven: false, hasMicrowave: false };
  },

  confirmAndGo: function () {
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : this._defaultPreference(),
      { adultCount: this.data.adultCount, avoidList: this._getActiveAvoidList(), kitchenConfig: this._getKitchenConfig() }
    );
    if (!menus || menus.length === 0) {
      wx.showToast({ title: '请先生成菜单', icon: 'none' });
      return;
    }
    try {
      var menuService = require('../../data/menuData.js');
      var shoppingList = menuService.generateShoppingListFromMenus(pref, menus);

      wx.setStorageSync('cart_ingredients', shoppingList || []);
      // 使用精简格式存储菜单（仅含菜谱 ID），缩减 storage 体积
      var slimMenus = menuService.serializeMenusForStorage(menus);
      wx.setStorageSync('today_menus', JSON.stringify(slimMenus));
      // 同时存储 preference，用于还原时传递参数
      wx.setStorageSync('today_menus_preference', JSON.stringify(pref));
      wx.setStorageSync('menu_generated_date', getTodayDateKey());

      var dishNames = [];
      menus.forEach(function (m) {
        if (m.adultRecipe && m.adultRecipe.name) dishNames.push(m.adultRecipe.name);
      });
      wx.setStorageSync('selected_dish_name', dishNames.length > 0 ? dishNames.join('、') : '定制食谱');

      var prepTime = 0;
      var allergens = [];
      menus.forEach(function (m) {
        [m.adultRecipe, m.babyRecipe].forEach(function (r) {
          if (!r) return;
          if (typeof r.prep_time === 'number' && r.prep_time > prepTime) prepTime = r.prep_time;
          if (Array.isArray(r.common_allergens)) r.common_allergens.forEach(function (a) { if (a && allergens.indexOf(a) === -1) allergens.push(a); });
        });
      });
      wx.setStorageSync('today_prep_time', prepTime);
      wx.setStorageSync('today_allergens', JSON.stringify(allergens));

      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.mergedShoppingList = shoppingList;

      // 保存到历史记录（供"再来一次"推荐使用）
      try {
        menuHistory.saveToHistory(menus, pref);
      } catch (e) {
        console.warn('保存历史记录失败:', e);
      }

      try {
        var getStepsKey = require('../steps/steps.js').stepsStorageKey;
        if (typeof getStepsKey === 'function') wx.removeStorageSync(getStepsKey());
      } catch (e) {}
      wx.navigateTo({ url: '/pages/shopping/shopping' });
    } catch (e) {
      console.error('开始做饭失败:', e);
      wx.showModal({ title: '提示', content: (e && e.message ? e.message : String(e)), showCancel: false });
    }
  },

  handleSwapOptions: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['换一换', '换掉未勾选'],
      success: function (res) {
        if (res.tapIndex === 0) that.handleShuffle();
        if (res.tapIndex === 1) that.handleReplaceUnchecked();
      }
    });
  },

  _defaultPreference: function () {
    return { adultCount: 2, hasBaby: false, babyMonth: 12, meatCount: 1, vegCount: 1, soupCount: 0, avoidList: [] };
  },

  /** 人数 -> 荤/素道数：2人=1荤1素，3人=2荤1素，4人=2荤2素（疲惫模式与常规一致，不再限制各最多1） */
  _computeDishCounts: function (adultCount, isTimeSave) {
    var m = Math.ceil(adultCount / 2);
    var v = Math.floor(adultCount / 2);
    return { meatCount: m, vegCount: v };
  },

  /** 统一重算：按当前 preference 缩放食材、刷新购物清单、重建 rows/helperData */
  _recalcWithPreference: function () {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    if (!menus || menus.length === 0) return;
    // 人数与菜数量联动：按当前人数 + 是否疲惫模式算出荤素道数，写入 preference，保证展示与逻辑一致
    var dishCounts = that._computeDishCounts(that.data.adultCount, that.data.isTiredMode);
    pref = Object.assign({}, pref, {
      adultCount: that.data.adultCount,
      avoidList: that._getActiveAvoidList(),
      meatCount: dishCounts.meatCount,
      vegCount: dishCounts.vegCount
    });
    var hasBaby = !!pref.hasBaby;
    try {
      for (var i = 0; i < menus.length; i++) {
        var ar = menus[i].adultRecipe;
        if (!ar || !(ar.id || ar._id)) continue;
        var raw = menuData.getAdultRecipeById && menuData.getAdultRecipeById(ar.id || ar._id);
        if (raw) {
          var copy = JSON.parse(JSON.stringify(raw));
          if (menuGen.dynamicScaling) menuGen.dynamicScaling(copy, pref.adultCount);
          menus[i].adultRecipe = copy;
        } else if (menuGen.dynamicScaling) {
          menuGen.dynamicScaling(ar, pref.adultCount);
        }
      }
      var newRows = [];
      for (var idx = 0; idx < menus.length; idx++) {
        var m = menus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuData.getBabyVariantByAge && menuData.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        newRows.push({
          adultName: adultName,
          babyName: babyName,
          showSharedHint: hasBaby && babyName && idx === 0,
          checked: true,
          recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
          sameAsAdultHint: (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '',
          cookType: (ar && ar.cook_type) || '',
          coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: (that.data.previewMenuRows[idx] && that.data.previewMenuRows[idx].coverTempUrl) || '',
          hasCover: true
        });
      }
      var dashboard = that._computePreviewDashboard(menus, pref);
      var schedulePreview = that._computeSchedulePreview(menus);
      var shoppingList = menuData.generateShoppingListFromMenus(pref, menus) || [];
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.menuPreview.menus = menus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.menuPreview.dashboard = dashboard;
      getApp().globalData.mergedShoppingList = shoppingList;
      var nextHelperData = that.data.helperData;
      if (that.data.isHelperMode && menus.length > 0) {
        try {
          var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(menus, pref, shoppingList);
          }
        } catch (e) { console.warn('_recalcWithPreference helperData failed:', e); }
      }
      that.setData({
        previewMenuRows: newRows,
        previewDashboard: dashboard,
        schedulePreview: schedulePreview,
        previewComboName: (pref.meatCount || 0) + '荤' + (pref.vegCount || 0) + '素' + (pref.soupCount ? '1汤' : ''),
        helperData: nextHelperData
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
    } catch (e) {
      console.error('_recalcWithPreference failed:', e);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  _getActiveAvoidList: function () {
    var caps = this.data.avoidCapsules || [];
    return caps.filter(function (c) { return c.active; }).map(function (c) { return c.key; });
  },

  onChangeAdultCount: function (e) {
    var val = parseInt(e.currentTarget.dataset.value, 10);
    if (isNaN(val) || val < 1 || val > 4) return;
    var oldCount = this.data.adultCount;
    this.setData({ adultCount: val, showPersonPicker: false });

    // 判断菜品道数是否因人数变化而需要调整
    var isTired = this.data.isTiredMode;
    var oldDish = this._computeDishCounts(oldCount, isTired);
    var newDish = this._computeDishCounts(val, isTired);
    var needRegenerate = (oldDish.meatCount !== newDish.meatCount || oldDish.vegCount !== newDish.vegCount);

    if (needRegenerate) {
      // 菜品道数变化 → 重新生成整桌菜单
      this._regenerateMenuForNewCounts(newDish.meatCount, newDish.vegCount);
    } else {
      // 道数不变 → 仅缩放食材份量
      this._recalcWithPreference();
    }
  },

  /** 根据新荤/素道数重新生成菜单 */
  _regenerateMenuForNewCounts: function (meatCount, vegCount) {
    var that = this;
    try {
      var menuService = require('../../data/menuData.js');
      var payload = getApp().globalData.menuPreview;
      var pref = Object.assign(
        {},
        payload && payload.preference ? payload.preference : that._defaultPreference(),
        { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList(), meatCount: meatCount, vegCount: vegCount }
      );
      // 排除当前菜品，尽量保证新鲜感
      var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
      if (currentNames.length > 0) pref.excludeRecipeNames = currentNames;
      var result = menuService.getTodayMenusByCombo(pref);
      var rawMenus = result.menus || result;
      var hasBaby = pref.hasBaby === true;
      if (!hasBaby) rawMenus.forEach(function (m) { m.babyRecipe = null; });
      var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
      var newRows = [];
      for (var idx = 0; idx < newMenus.length; idx++) {
        var m = newMenus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuData.getBabyVariantByAge && menuData.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar);
        newRows.push({
          adultName: adultName,
          babyName: babyName,
          showSharedHint: hasBaby && babyName && idx === 0,
          checked: true,
          recommendReason: reason,
          sameAsAdultHint: (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '',
          cookType: (ar && ar.cook_type) || '',
          coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: '',
          hasCover: true
        });
      }
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var schedulePreview = that._computeSchedulePreview(newMenus);
      var hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
      var tips = that._buildPreviewTips(dashboard, hasSharedBase, '', that.data.previewFallbackMessage);
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = dashboard;
        getApp().globalData.menuPreview.hasSharedBase = hasSharedBase;
        getApp().globalData.menuPreview.comboName = result.comboName || '';
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      that._fullPreviewMenus = newMenus;
      that.setData({
        previewMenuRows: newRows,
        previewComboName: result.comboName || (meatCount + '荤' + vegCount + '素' + (pref.soupCount ? '1汤' : '')),
        previewDashboard: dashboard,
        schedulePreview: schedulePreview,
        previewHasSharedBase: hasSharedBase,
        previewHasBaby: hasBaby,
        babyMonthLabel: hasBaby ? that._babyMonthToLabel(pref.babyMonth) : '',
        previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
        previewNarrativeText: that._buildNarrativeText(dashboard, ''),
        previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
        previewTips: tips,
        isImageReady: false,
        chefReportText: ''
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
      wx.showToast({ title: (that.data.adultCount || 2) + '人份，已调整菜品', icon: 'none' });
    } catch (e) {
      console.error('_regenerateMenuForNewCounts failed:', e);
      // 降级：至少做份量缩放
      that._recalcWithPreference();
    }
  },

  onTogglePersonPicker: function () {
    this.setData({ showPersonPicker: !this.data.showPersonPicker });
  },

  _babyMonthToLabel: function (month) {
    var m = Math.min(36, Math.max(6, Number(month) || 6));
    if (m <= 8) return '6-8月';
    if (m <= 12) return '9-12月';
    if (m <= 18) return '13-18月';
    if (m <= 24) return '19-24月';
    return '25-36月';
  },

  onToggleBabyPicker: function (e) {
    if (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.stop) return;
    if (this.data.previewHasBaby) return;
    this.setData({
      showBabyPicker: !this.data.showBabyPicker,
      showPersonPicker: false
    });
  },

  onSelectBabyMonth: function (e) {
    var month = parseInt(e.currentTarget.dataset.month, 10);
    if (isNaN(month) || month < 6 || month > 36) return;
    var that = this;
    var menuService = require('../../data/menuData.js');
    var payload = getApp().globalData.menuPreview;
    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : that._defaultPreference(),
      { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList(), hasBaby: true, babyMonth: month }
    );
    var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
    if (currentNames.length > 0) pref.excludeRecipeNames = currentNames;
    var result = menuService.getTodayMenusByCombo(pref);
    var rawMenus = result.menus || result;
    var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
    var newRows = [];
    for (var idx = 0; idx < newMenus.length; idx++) {
      var m = newMenus[idx];
      var ar = m.adultRecipe;
      var adultName = (ar && ar.name) ? ar.name : '—';
      var stage = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
      var babyName = (stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '';
      newRows.push({
        adultName: adultName,
        babyName: babyName,
        showSharedHint: !!babyName && idx === 0,
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
        sameAsAdultHint: (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(adultName),
        coverTempUrl: '',
        hasCover: true
      });
    }
    var dashboard = that._computePreviewDashboard(newMenus, pref);
    var schedulePreview = that._computeSchedulePreview(newMenus);
    if (getApp().globalData.menuPreview) {
      getApp().globalData.menuPreview.menus = newMenus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.menuPreview.dashboard = dashboard;
      getApp().globalData.menuPreview.hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
    }
    getApp().globalData.preference = pref;
    getApp().globalData.todayMenus = newMenus;
    that.setData({
      showBabyPicker: false,
      previewMenuRows: newRows,
      previewDashboard: dashboard,
      schedulePreview: schedulePreview,
      previewHasBaby: true,
      babyMonthLabel: that._babyMonthToLabel(month),
      previewHasSharedBase: newRows.some(function (r) { return r.showSharedHint; }),
      previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
      previewNarrativeText: that._buildNarrativeText(dashboard, ''),
      previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
      previewTips: that._buildPreviewTips(dashboard, newRows.some(function (r) { return r.showSharedHint; }), '', that.data.previewFallbackMessage),
      isImageReady: false
    }, function () { if (that._pageReady) that._resolvePreviewImages(); });
    wx.showToast({ title: '已开启宝宝辅食', icon: 'none' });
  },

  onRemoveBaby: function (e) {
    if (e && e.currentTarget) e.stopPropagation && e.stopPropagation();
    var that = this;
    var menuService = require('../../data/menuData.js');
    var payload = getApp().globalData.menuPreview;
    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : that._defaultPreference(),
      { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList(), hasBaby: false }
    );
    var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
    if (currentNames.length > 0) pref.excludeRecipeNames = currentNames;
    var result = menuService.getTodayMenusByCombo(pref);
    var rawMenus = result.menus || result;
    rawMenus.forEach(function (m) { m.babyRecipe = null; });
    var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
    var newRows = [];
    for (var idx = 0; idx < newMenus.length; idx++) {
      var m = newMenus[idx];
      var ar = m.adultRecipe;
      var adultName = (ar && ar.name) ? ar.name : '—';
      newRows.push({
        adultName: adultName,
        babyName: '',
        showSharedHint: false,
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
        sameAsAdultHint: '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(adultName),
        coverTempUrl: '',
        hasCover: true
      });
    }
    var dashboard = that._computePreviewDashboard(newMenus, pref);
    var schedulePreview = that._computeSchedulePreview(newMenus);
    if (getApp().globalData.menuPreview) {
      getApp().globalData.menuPreview.menus = newMenus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.menuPreview.dashboard = dashboard;
      getApp().globalData.menuPreview.hasSharedBase = false;
    }
    getApp().globalData.preference = pref;
    getApp().globalData.todayMenus = newMenus;
    that.setData({
      showBabyPicker: false,
      previewMenuRows: newRows,
      previewDashboard: dashboard,
      schedulePreview: schedulePreview,
      previewHasBaby: false,
      babyMonthLabel: '',
      previewHasSharedBase: false,
      previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
      previewNarrativeText: that._buildNarrativeText(dashboard, ''),
      previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
      previewTips: that._buildPreviewTips(dashboard, false, '', that.data.previewFallbackMessage),
      isImageReady: false
    }, function () { if (that._pageReady) that._resolvePreviewImages(); });
    wx.showToast({ title: '已关闭宝宝辅食', icon: 'none' });
  },

  onAddDish: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['再来个汤', '加个素菜', '加个荤菜', '自选菜谱'],
      success: function (res) {
        if (res.tapIndex === 3) {
          that._openPickerPanel();
          return;
        }
        var type = ['soup', 'vegetable', 'meat'][res.tapIndex];
        if (type) that.recommendExtra(type);
      }
    });
  },

  _openPickerPanel: function () {
    var that = this;
    var menuService = require('../../data/menuData.js');
    var source = menuService.getRecipeSource && menuService.getRecipeSource();
    var nativeRecipes = (source && source.adultRecipes) || [];
    var PICKER_MEAT_LABELS = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼类', shrimp: '虾类', vegetable: '素菜' };
    var PICKER_COOK_LABELS = { stir_fry: '炒/煎', stew: '炖煮', steam: '蒸/白灼', cold_dress: '凉拌', quick_stir_fry: '快炒', braise: '红烧', fry: '煎炸', boil: '煮' };
    for (var i = 0; i < nativeRecipes.length; i++) {
      var r = nativeRecipes[i];
      r._meatLabel = PICKER_MEAT_LABELS[r.meat] || r.meat || '其他';
      r._cookTypeLabel = PICKER_COOK_LABELS[r.cook_type] || '';
    }
    var importedRecipes = [];
    try {
      var raw = wx.getStorageSync('imported_recipes_cache');
      if (raw) {
        var list = JSON.parse(raw);
        importedRecipes = Array.isArray(list) ? list : [];
      }
    } catch (e) {}
    that.setData({
      showPickerPanel: true,
      pickerTab: 'native',
      pickerNativeFilter: 'all',
      pickerNativeRecipes: nativeRecipes,
      pickerFilteredNativeRecipes: nativeRecipes,
      pickerImportedRecipes: importedRecipes
    });
  },

  _closePickerPanel: function () {
    this.setData({ showPickerPanel: false });
  },

  onPickerSwitchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ pickerTab: tab });
  },

  onPickerNativeFilter: function (e) {
    var filter = e.currentTarget.dataset.filter;
    var list = this.data.pickerNativeRecipes || [];
    var filtered = filter === 'all' ? list : list.filter(function (r) { return r.meat === filter; });
    this.setData({ pickerNativeFilter: filter, pickerFilteredNativeRecipes: filtered });
  },

  onPickerSelectNative: function (e) {
    var idx = e.currentTarget.dataset.index;
    var recipe = (this.data.pickerFilteredNativeRecipes || [])[idx];
    if (recipe) this._addPickedRecipe(recipe, 'native');
  },

  onPickerSelectImported: function (e) {
    var idx = e.currentTarget.dataset.index;
    var recipe = (this.data.pickerImportedRecipes || [])[idx];
    if (recipe) this._addPickedRecipe(recipe, 'external');
  },

  _addPickedRecipe: function (recipe, sourceType) {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = that.data.previewMenuRows || [];
    var existingNames = menus.map(function (m) { return (m.adultRecipe && m.adultRecipe.name) || ''; }).filter(Boolean);
    var name = recipe.name || (recipe.adultRecipe && recipe.adultRecipe.name) || '';
    if (name && existingNames.indexOf(name) !== -1) {
      wx.showToast({ title: '「' + name + '」已在菜单中', icon: 'none' });
      return;
    }
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    pref = Object.assign({}, pref, { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() });
    var hasBaby = !!pref.hasBaby;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || 2;
    try {
      var menuService = require('../../data/menuData.js');
      var generator = require('../../data/menuGenerator.js');
      var res;
      if (sourceType === 'external') {
        res = generator.generateMenuFromExternalRecipe(recipe, adultCount);
      } else {
        res = generator.generateMenuFromRecipe(recipe, babyMonth, hasBaby, adultCount, 'soft_porridge');
      }
      var newSlot = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || (res.meat || 'pork'),
        taste: (res.adultRecipe && res.adultRecipe.taste) || (res.taste || 'quick_stir_fry'),
        adultRecipe: res.adultRecipe || null,
        babyRecipe: hasBaby ? (res.babyRecipe || null) : null,
        checked: true
      };
      if (!newSlot.adultRecipe) {
        wx.showToast({ title: '暂无可追加的菜', icon: 'none' });
        return;
      }
      var ar = newSlot.adultRecipe;
      var adultName = (ar && ar.name) ? ar.name : '—';
      var newMenus = menus.concat([newSlot]);
      var newRow = {
        adultName: adultName,
        babyName: hasBaby ? ((res.babyRecipe && res.babyRecipe.name) || '') : '',
        showSharedHint: false,
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
        sameAsAdultHint: '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(ar.name),
        coverTempUrl: '',
        hasCover: !!coverService.RECIPE_NAME_TO_SLUG[ar.name]
      };
      var newRows = rows.concat([newRow]);
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var schedulePreview = that._computeSchedulePreview(newMenus);
      var nextHelperData = that.data.helperData;
      if (that.data.isHelperMode) {
        try {
          var shopList = menuService.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('_addPickedRecipe helperData failed:', e); }
      }
      getApp().globalData.menuPreview.menus = newMenus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      that.setData({
        previewMenuRows: newRows,
        previewDashboard: dashboard,
        schedulePreview: schedulePreview,
        helperData: nextHelperData,
        isImageReady: false,
        showPickerPanel: false
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
      wx.showToast({ title: '已添加「' + adultName + '」', icon: 'none' });
    } catch (e) {
      console.error('_addPickedRecipe failed:', e);
      wx.showToast({ title: '加菜失败', icon: 'none' });
    }
  },

  recommendExtra: function (type) {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    pref = Object.assign({}, pref, { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() });
    var hasBaby = !!pref.hasBaby;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || 2;
    var excludeNames = menus.map(function (m) { return (m.adultRecipe && m.adultRecipe.name) || ''; }).filter(Boolean);
    if (excludeNames.length > 0) pref.excludeRecipeNames = excludeNames;
    try {
      var menuService = require('../../data/menuData.js');
      var generator = require('../../data/menuGenerator.js');
      var userPreference = { avoidList: pref.avoidList || [], isTimeSave: pref.isTimeSave, kitchenConfig: pref.kitchenConfig };
      var res;
      if (type === 'soup') {
        var source = menuService.getRecipeSource && menuService.getRecipeSource();
        var adultRecipes = (source && source.adultRecipes) || [];
        var soups = (generator.getSoupRecipes && generator.getSoupRecipes(adultRecipes)) || [];
        var excludeSet = {};
        excludeNames.forEach(function (n) { excludeSet[n] = true; });
        var pick = soups.filter(function (r) { return r.name && !excludeSet[r.name]; });
        if (pick.length === 0) {
          wx.showToast({ title: '暂无可追加的汤', icon: 'none' });
          return;
        }
        var soupRecipe = pick[Math.floor(Math.random() * pick.length)];
        res = generator.generateMenuFromRecipe(soupRecipe, babyMonth, false, adultCount, 'soft_porridge');
      } else {
        var meat = type === 'vegetable' ? 'vegetable' : 'pork';
        var filters = { userPreference: userPreference, existingMenus: menus, stewCountRef: { stewCount: 0 } };
        res = generator.generateMenuWithFilters(meat, babyMonth, false, adultCount, 'soft_porridge', filters);
      }
      var newSlot = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || (type === 'vegetable' ? 'vegetable' : 'pork'),
        taste: (res.adultRecipe && res.adultRecipe.taste) || 'quick_stir_fry',
        adultRecipe: res.adultRecipe || null,
        babyRecipe: null,
        checked: true
      };
      if (!newSlot.adultRecipe) {
        wx.showToast({ title: '暂无可追加的菜', icon: 'none' });
        return;
      }
      var ar = newSlot.adultRecipe;
      var newMenus = menus.concat([newSlot]);
      var newRow = {
        adultName: (ar && ar.name) ? ar.name : '—',
        babyName: '',
        showSharedHint: false,
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
        sameAsAdultHint: '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(ar.name),
        coverTempUrl: '',
        hasCover: true
      };
      var newRows = (that.data.previewMenuRows || []).concat([newRow]);
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var schedulePreview = that._computeSchedulePreview(newMenus);
      var nextHelperData = that.data.helperData;
      if (that.data.isHelperMode) {
        try {
          var shopList = menuService.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('recommendExtra helperData failed:', e); }
      }
      getApp().globalData.menuPreview.menus = newMenus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      that.setData({
        previewMenuRows: newRows,
        previewDashboard: dashboard,
        schedulePreview: schedulePreview,
        helperData: nextHelperData,
        isImageReady: false
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
      wx.showToast({ title: '已加一道菜', icon: 'none' });
    } catch (e) {
      console.error('recommendExtra failed:', e);
      wx.showToast({ title: '加菜失败', icon: 'none' });
    }
  },

  onToggleAvoid: function (e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    var caps = (this.data.avoidCapsules || []).slice();
    for (var i = 0; i < caps.length; i++) {
      if (caps[i].key === key) {
        caps[i].active = !caps[i].active;
        break;
      }
    }
    this.setData({ avoidCapsules: caps });

    // 同步持久化到 tasteProfile
    try {
      var tasteProfile = require('../../data/tasteProfile.js');
      tasteProfile.setAvoidList(this._getActiveAvoidList());
    } catch (err) {}

    this._checkAndReplaceAvoidConflicts();
    this._recalcWithPreference();
  },

  _checkAndReplaceAvoidConflicts: function () {
    var that = this;
    var avoidList = that._getActiveAvoidList();
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    pref = Object.assign({}, pref, { avoidList: avoidList });
    var menuService = require('../../data/menuData.js');
    var generator = require('../../data/menuGenerator.js');
    var hasBaby = !!pref.hasBaby;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || that.data.adultCount;
    var firstMeatIndex = -1;
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].meat !== 'vegetable') { firstMeatIndex = i; break; }
    }
    var changed = false;
    for (var idx = 0; idx < menus.length; idx++) {
      var r = menus[idx].adultRecipe;
      if (!r) continue;
      var hit = generator.recipeContainsAvoid ? generator.recipeContainsAvoid(r, avoidList) : false;
      if (!hit) continue;
      var hasBabyThis = hasBaby && menus[idx].meat !== 'vegetable' && idx === firstMeatIndex;
      var filters = { userPreference: pref, existingMenus: menus, stewCountRef: { stewCount: 0 } };
      var res = generator.generateMenuWithFilters(menus[idx].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
      var newSlot = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || menus[idx].meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || menus[idx].taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null,
        checked: true
      };
      menus[idx] = newSlot;
      changed = true;
    }
    if (!changed) return;
    var newRows = [];
    for (var j = 0; j < menus.length; j++) {
      var m = menus[j];
      var ar = m.adultRecipe;
      var adultName = (ar && ar.name) ? ar.name : '—';
      var st = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
      newRows.push({
        adultName: adultName,
        babyName: (st && st.name) || (m.babyRecipe && m.babyRecipe.name) || '',
        showSharedHint: hasBaby && j === firstMeatIndex && (m.babyRecipe || st),
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : buildReasonFallback(ar),
        sameAsAdultHint: (st && st.same_as_adult_hint) ? '与大人同款，分装即可' : '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: (that.data.previewMenuRows[j] && that.data.previewMenuRows[j].coverTempUrl) || '',
          hasCover: true
      });
    }
    getApp().globalData.menuPreview.menus = menus;
    getApp().globalData.menuPreview.rows = newRows;
    getApp().globalData.menuPreview.preference = pref;
    getApp().globalData.todayMenus = menus;
    var dashboard = that._computePreviewDashboard(menus, pref);
    var schedulePreview = that._computeSchedulePreview(menus);
    var nextHelperData = that.data.helperData;
    if (that.data.isHelperMode && menus.length > 0) {
      try {
        var shopList = menuService.generateShoppingListFromMenus(pref, menus) || [];
        var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
        var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
        if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
          nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
        } else {
          nextHelperData = menuGen.formatForHelper(menus, pref, shopList);
        }
      } catch (e) { console.warn('_checkAndReplaceAvoidConflicts helperData failed:', e); }
    }
    that.setData({
      previewMenuRows: newRows,
      previewDashboard: dashboard,
      schedulePreview: schedulePreview,
      helperData: nextHelperData,
      isImageReady: false
    }, function () { if (that._pageReady) that._resolvePreviewImages(); });
  },

  _buildPreviewRhythmRings: function (menus) {
    if (!Array.isArray(menus) || menus.length === 0) return [];
    var rings = [];
    var colors = ['#E84A27', '#D4421F', '#6cb58b'];
    var radius = 44;
    var circumference = 2 * Math.PI * radius;
    for (var i = 0; i < menus.length && rings.length < 3; i++) {
      var name = (menus[i].adultRecipe && menus[i].adultRecipe.name) || '未命名菜品';
      var percent = 0;
      var dash = (circumference * percent / 100).toFixed(2);
      var dashArray = dash + ' ' + (circumference - dash).toFixed(2);
      rings.push({
        name: name,
        percent: percent,
        dashArray: dashArray,
        color: colors[rings.length % colors.length]
      });
    }
    return rings;
  },

  _buildMenuSubtitle: function (rows) {
    var names = (rows || []).map(function (r) { return r && r.adultName ? r.adultName : ''; }).filter(Boolean);
    if (names.length === 0) return '';
    var subtitle = names.slice(0, 2).join('、');
    if (names.length > 2) subtitle += '等';
    return subtitle;
  },

  _buildNarrativeText: function (dashboard, chefReportText) {
    if (chefReportText) return chefReportText;
    var parts = [];
    if (dashboard && dashboard.nutritionHint) parts.push(dashboard.nutritionHint);
    if (dashboard && dashboard.prepAheadHint) parts.push(dashboard.prepAheadHint);
    if (dashboard && dashboard.prepOrderHint) parts.push(dashboard.prepOrderHint);
    if (parts.length > 0) return parts.join('；');
    return '今天搭了荤素均衡的一桌菜，备好葱姜蒜就能开做，轻松搞定。';
  },

  _buildPreviewTips: function (dashboard, hasSharedBase, balanceTip, fallbackMessage) {
    var tips = [];
    if (fallbackMessage) tips.push(fallbackMessage);
    if (balanceTip) tips.push(balanceTip);
    if (hasSharedBase) tips.push('大人孩子可共用基底，一锅出省时省力');
    if (dashboard && dashboard.sharedIngredientsHint) tips.push(dashboard.sharedIngredientsHint);
    if (dashboard && dashboard.nutritionHint) tips.push(dashboard.nutritionHint);
    if (dashboard && dashboard.prepAheadHint) tips.push(dashboard.prepAheadHint);
    if (dashboard && dashboard.prepOrderHint) tips.push(dashboard.prepOrderHint);
    return tips.slice(0, 2);
  },

  _computeSchedulePreview: function (menus) {
    var empty = { totalTime: 0, serialTime: 0, savedTime: 0, efficiency: 0, cookingOrder: [], parallelPercent: 0 };
    if (!menus || menus.length < 2) return empty;
    var recipes = [];
    for (var i = 0; i < menus.length; i++) {
      var r = menus[i].adultRecipe;
      if (r) recipes.push(r);
    }
    if (recipes.length < 2) return empty;
    var result = scheduleEngine.computeSchedulePreview(recipes, this._getKitchenConfig());
    if (!result || result.serialTime <= 0) return empty;
    result.parallelPercent = Math.round(result.totalTime / result.serialTime * 100);
    return result;
  },

  _computePreviewDashboard: function (menus, pref) {
    if (!menus || menus.length === 0) return { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' };
    var maxMinutes = 0;
    var maxPrep = 0;
    var hasStirFry = false, hasStew = false, hasSteam = false;
    var catSet = {};
    var catOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 3, '干货': 4, '其他': 5 };
    for (var i = 0; i < menus.length; i++) {
      var r = menus[i].adultRecipe;
      if (!r) continue;
      var prep = typeof r.prep_time === 'number' ? r.prep_time : 0;
      if (prep > maxPrep) maxPrep = prep;
      var cook = r.cook_minutes != null ? r.cook_minutes : (r.taste === 'slow_stew' ? 60 : 15);
      if (prep + cook > maxMinutes) maxMinutes = prep + cook;
      var ct = r.cook_type || '';
      if (ct === 'stir_fry') hasStirFry = true;
      else if (ct === 'stew') hasStew = true;
      else if (ct === 'steam') hasSteam = true;
      var ings = r.ingredients;
      if (Array.isArray(ings)) {
        for (var j = 0; j < ings.length; j++) {
          var c = (ings[j] && ings[j].category) ? String(ings[j].category).trim() : '';
          if (c && c !== '调料') catSet[c] = (catOrder[c] != null ? catOrder[c] : 99);
        }
      }
      var br = menus[i].babyRecipe;
      if (br && Array.isArray(br.ingredients)) {
        for (var k = 0; k < br.ingredients.length; k++) {
          var bc = (br.ingredients[k] && br.ingredients[k].category) ? String(br.ingredients[k].category).trim() : '';
          if (bc && bc !== '调料') catSet[bc] = (catOrder[bc] != null ? catOrder[bc] : 99);
        }
      }
    }
    var estimatedMinutes = maxMinutes + 10;
    var stoveCount = (hasStirFry ? 1 : 0) + (hasStew ? 1 : 0) + (hasSteam ? 1 : 0);
    var cats = Object.keys(catSet).sort(function (a, b) { return (catSet[a] || 99) - (catSet[b] || 99); });
    var categoryLabels = cats.length > 0 ? cats.join('、') : '';
    var nutritionParts = [];
    if (cats.indexOf('肉类') !== -1) nutritionParts.push('肉');
    if (cats.indexOf('蔬菜') !== -1) nutritionParts.push('菜');
    if (cats.indexOf('蛋类') !== -1) nutritionParts.push('蛋');
    if (cats.indexOf('干货') !== -1) nutritionParts.push('干货');
    var nutritionHint = nutritionParts.length > 0 ? '有' + nutritionParts.join('有') + '，营养搭着来，吃着放心' : '';
    var orderParts = [];
    if (hasStew) orderParts.push('炖/煲');
    if (hasSteam) orderParts.push('蒸');
    if (hasStirFry) orderParts.push('快炒');
    var prepOrderHint = orderParts.length >= 2 ? '先把' + orderParts[0] + '的放上，再来' + orderParts.slice(1).join('、') + '，时间刚刚好' : '';
    var prepAheadHint = '';
    if (maxPrep >= 10) prepAheadHint = '提前 ' + maxPrep + ' 分钟把葱姜蒜备好、肉腌上，到时候下锅就行';
    var sharedIngredientsHint = '';
    var ingCount = {};
    for (var si = 0; si < menus.length; si++) {
      var rec = menus[si].adultRecipe;
      if (!rec || !Array.isArray(rec.ingredients)) continue;
      var seen = {};
      for (var sj = 0; sj < rec.ingredients.length; sj++) {
        var ing = rec.ingredients[sj];
        if (!ing || (ing.category && String(ing.category).trim() === '调料')) continue;
        var n = (ing.name && String(ing.name).trim()) || '';
        if (n && !seen[n]) { seen[n] = true; ingCount[n] = (ingCount[n] || 0) + 1; }
      }
    }
    var shared = [];
    for (var name in ingCount) { if (ingCount[name] >= 2) shared.push(name); }
    if (shared.length > 0) {
      shared = shared.slice(0, 6);
      sharedIngredientsHint = shared.join('、') + '几道菜都用得上，一起备好就行';
    }
    return {
      estimatedTime: estimatedMinutes > 0 ? estimatedMinutes + ' 分钟' : '',
      stoveCount: stoveCount,
      categoryLabels: categoryLabels,
      nutritionHint: nutritionHint,
      prepOrderHint: prepOrderHint,
      prepAheadHint: prepAheadHint,
      sharedIngredientsHint: sharedIngredientsHint
    };
  }
});
