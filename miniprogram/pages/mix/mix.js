// pages/mix/mix.js
// 混合组餐页面 —— 自由搭配原生 + 外部导入菜谱，一键统筹做饭

var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var scheduleEngine = require('../../utils/scheduleEngine.js');
var coverService = require('../../data/recipeCoverSlugs.js');
var imageLib = require('../../utils/imageLib.js');

/** 烹饪方式中文映射 */
var COOK_TYPE_LABELS = {
  'stir_fry': '炒/煎', 'stew': '炖煮', 'steam': '蒸/白灼',
  'cold_dress': '凉拌', 'quick_stir_fry': '快炒', 'braise': '红烧',
  'fry': '煎炸', 'boil': '煮'
};

/** 肉类中文映射 */
var MEAT_LABELS = {
  'chicken': '鸡肉', 'pork': '猪肉', 'beef': '牛肉',
  'fish': '鱼类', 'shrimp': '虾类', 'vegetable': '素菜'
};

/** 口味中文映射 */
var FLAVOR_LABELS = {
  'spicy': '香辣', 'salty_umami': '咸鲜', 'light': '清淡',
  'sweet_sour': '酸甜', 'sour_fresh': '酸爽'
};

/** 本地导入菜谱缓存 key */
var IMPORT_CACHE_KEY = 'imported_recipes_cache';

/** 混合组餐草稿缓存 key */
var MIX_DRAFT_KEY = 'mix_menu_draft';

/** 为菜谱数组添加中文标签字段（供列表渲染用） */
function annotateRecipeLabels(recipes) {
  if (!Array.isArray(recipes)) return recipes;
  for (var i = 0; i < recipes.length; i++) {
    var r = recipes[i];
    r._meatLabel = MEAT_LABELS[r.meat] || r.meat || '其他';
    r._cookTypeLabel = COOK_TYPE_LABELS[r.cook_type] || '';
  }
  return recipes;
}

/** 最大选择菜品数 */
var MAX_DISHES = 6;

/**
 * 从本地缓存获取已导入菜谱列表
 * @returns {Array}
 */
function getImportedRecipes() {
  try {
    var raw = wx.getStorageSync(IMPORT_CACHE_KEY);
    if (!raw) return [];
    var list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * 获取原生菜谱列表
 * @returns {Array}
 */
function getNativeRecipes() {
  try {
    var source = menuData.getRecipeSource();
    return source.adultRecipes || [];
  } catch (e) {
    return [];
  }
}

Page({
  data: {
    // 已选菜谱列表 [{ ...recipe, _sourceType: 'native'|'external' }]
    selectedRecipes: [],

    // 统筹预览
    schedulePreview: {
      totalTime: 0, serialTime: 0, savedTime: 0,
      stoveCount: 0, devices: [],
      firstDish: '', cookingOrder: [], tips: [],
      prepTime: 0, cookTime: 0, efficiency: 0,
      hasStew: false, hasSteam: false, hasStirFry: false, hasCold: false
    },

    // 是否显示添加面板
    showAddPanel: false,

    // 添加面板当前标签页：'native' | 'imported'
    addPanelTab: 'native',

    // 原生菜谱列表（用于选择）
    nativeRecipes: [],
    // 原生菜谱按分类过滤
    nativeFilter: 'all', // 'all'|'chicken'|'pork'|'beef'|'fish'|'shrimp'|'vegetable'
    nativeFilterOptions: [
      { value: 'all', label: '全部' },
      { value: 'chicken', label: '鸡肉' },
      { value: 'pork', label: '猪肉' },
      { value: 'beef', label: '牛肉' },
      { value: 'fish', label: '鱼类' },
      { value: 'shrimp', label: '虾类' },
      { value: 'vegetable', label: '素菜' }
    ],
    filteredNativeRecipes: [],

    // 已导入菜谱列表
    importedRecipes: [],

    // 可选的用餐人数
    adultCount: 2,
    maxDishes: MAX_DISHES
  },

  onLoad: function (options) {
    var that = this;

    // 获取用户偏好
    var app = getApp();
    var pref = (app && app.globalData && app.globalData.preference) || {};
    var adultCount = Number(pref.adultCount) || 2;

    that.setData({ adultCount: adultCount });

    // 加载原生菜谱
    var nativeRecipes = getNativeRecipes();
    that._nativeRecipes = nativeRecipes;

    // 加载已导入菜谱
    var importedRecipes = getImportedRecipes();

    annotateRecipeLabels(nativeRecipes);

    // 为原生菜谱预置封面 HTTP 直链（无需 getTempFileURL）
    for (var ci = 0; ci < nativeRecipes.length; ci++) {
      nativeRecipes[ci]._coverHttpUrl = coverService.getRecipeCoverHttpUrl(nativeRecipes[ci].name);
      nativeRecipes[ci]._coverCloudUrl = '';
      nativeRecipes[ci]._coverTempUrl = '';
    }

    that.setData({
      nativeRecipes: nativeRecipes,
      filteredNativeRecipes: nativeRecipes,
      importedRecipes: importedRecipes
    });

    // 恢复草稿（如果有）
    that._restoreDraft();

    // 如果从 import 页面带入了菜谱
    if (options && options.addRecipe) {
      try {
        var recipe = JSON.parse(decodeURIComponent(options.addRecipe));
        if (recipe && recipe.name) {
          that._addRecipeToSelection(recipe, recipe.source === 'external' ? 'external' : 'native');
        }
      } catch (e) {
        console.warn('[mix] 解析传入菜谱失败:', e);
      }
    }
  },

  onShow: function () {
    // 允许本页本次展示时再上报一次统筹预览
    this._hasTrackedSchedulePreview = false;
    // 刷新已导入菜谱（用户可能从 import 页面添加了新的）
    var importedRecipes = getImportedRecipes();
    // 为导入菜谱预置封面字段
    for (var ii = 0; ii < importedRecipes.length; ii++) {
      if (!importedRecipes[ii]._coverCloudUrl) {
        importedRecipes[ii]._coverCloudUrl = importedRecipes[ii].coverUrl || '';
      }
      if (!importedRecipes[ii]._coverTempUrl) {
        importedRecipes[ii]._coverTempUrl = '';
      }
    }
    this.setData({ importedRecipes: importedRecipes });

    // 检查 globalData 中是否有待添加的菜谱
    var app = getApp();
    if (app && app.globalData && app.globalData._pendingMixRecipe) {
      var recipe = app.globalData._pendingMixRecipe;
      app.globalData._pendingMixRecipe = null;
      if (recipe && recipe.name) {
        this._addRecipeToSelection(recipe, recipe.source === 'external' ? 'external' : 'native');
        return; // _addRecipeToSelection 内部已调用 _resolveCoverImages
      }
    }

    // 页面重新可见时刷新封面（外部导入菜的封面可能在后台生成完成了）
    if (this.data.selectedRecipes.length > 0) {
      this._resolveCoverImages();
    }
  },

  onHide: function () {
    this._saveDraft();
  },

  onUnload: function () {
    this._saveDraft();
  },

  // ── 草稿管理 ────────────────────────────────────────────────

  _saveDraft: function () {
    try {
      var recipes = this.data.selectedRecipes;
      if (recipes.length > 0) {
        wx.setStorageSync(MIX_DRAFT_KEY, JSON.stringify(recipes));
      } else {
        wx.removeStorageSync(MIX_DRAFT_KEY);
      }
    } catch (e) {}
  },

  _restoreDraft: function () {
    try {
      var raw = wx.getStorageSync(MIX_DRAFT_KEY);
      if (!raw) return;
      var recipes = JSON.parse(raw);
      if (Array.isArray(recipes) && recipes.length > 0) {
        // 为草稿中的菜谱补全封面字段（旧草稿可能没有 _coverCloudUrl）
        for (var i = 0; i < recipes.length; i++) {
          var r = recipes[i];
          if (r._sourceType === 'native') {
            if (!r._coverHttpUrl) r._coverHttpUrl = coverService.getRecipeCoverHttpUrl(r.name);
            r._coverCloudUrl = r._coverCloudUrl || '';
            if (!r._coverTempUrl) r._coverTempUrl = '';
          } else {
            if (!r._coverCloudUrl) r._coverCloudUrl = r.coverUrl || '';
            if (!r._coverTempUrl) r._coverTempUrl = '';
          }
        }
        this.setData({ selectedRecipes: recipes });
        this._updateSchedulePreview();
        this._resolveCoverImages();
      }
    } catch (e) {}
  },

  // ── 添加菜谱 ────────────────────────────────────────────────

  onShowAddPanel: function () {
    this.setData({ showAddPanel: true });
    // 懒加载：首次打开面板时解析原生菜谱封面
    if (!this._pickerCoversResolved) {
      this._resolvePickerCoverImages();
    }
    // 导入菜谱封面也尝试解析
    this._resolveImportedPickerCovers();
  },

  onHideAddPanel: function () {
    this.setData({ showAddPanel: false });
  },

  onSwitchAddTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ addPanelTab: tab });
  },

  // ── 原生菜谱过滤 ─────────────────────────────────────────────

  onNativeFilter: function (e) {
    var filter = e.currentTarget.dataset.filter;
    var filtered;
    if (filter === 'all') {
      filtered = this._nativeRecipes || [];
    } else {
      filtered = (this._nativeRecipes || []).filter(function (r) {
        return r.meat === filter;
      });
    }
    annotateRecipeLabels(filtered);
    this.setData({
      nativeFilter: filter,
      filteredNativeRecipes: filtered
    });
  },

  // ── 选择原生菜谱 ─────────────────────────────────────────────

  onSelectNativeRecipe: function (e) {
    var idx = e.currentTarget.dataset.index;
    var recipe = this.data.filteredNativeRecipes[idx];
    if (!recipe) return;
    this._addRecipeToSelection(recipe, 'native');
  },

  // ── 选择已导入菜谱 ─────────────────────────────────────────────

  onSelectImportedRecipe: function (e) {
    var idx = e.currentTarget.dataset.index;
    var recipe = this.data.importedRecipes[idx];
    if (!recipe) return;
    this._addRecipeToSelection(recipe, 'external');
  },

  // ── 跳转导入新菜谱 ─────────────────────────────────────────────

  onGoImportNew: function () {
    this.setData({ showAddPanel: false });
    wx.navigateTo({ url: '/pages/import/import' });
  },

  /** 跳转我的菜谱库（可选择菜谱后加入组餐） */
  onGoMyRecipes: function () {
    this.setData({ showAddPanel: false });
    wx.navigateTo({ url: '/pages/myRecipes/myRecipes?from=mix' });
  },

  // ── 添加菜谱到已选列表 ────────────────────────────────────────

  _addRecipeToSelection: function (recipe, sourceType) {
    var selected = this.data.selectedRecipes.slice();

    // 检查上限
    if (selected.length >= MAX_DISHES) {
      wx.showToast({ title: '最多选择 ' + MAX_DISHES + ' 道菜', icon: 'none' });
      return;
    }

    // 检查重复
    var isDuplicate = selected.some(function (r) {
      return (r.id && r.id === recipe.id) || (r.name && r.name === recipe.name);
    });
    if (isDuplicate) {
      wx.showToast({ title: '「' + recipe.name + '」已在列表中', icon: 'none' });
      return;
    }

    // 添加来源标记
    var newRecipe = {};
    for (var k in recipe) {
      if (recipe.hasOwnProperty(k)) newRecipe[k] = recipe[k];
    }
    newRecipe._sourceType = sourceType;
    newRecipe._sourceLabel = sourceType === 'external' ? '外部导入' : '原生';
    newRecipe._cookTypeLabel = COOK_TYPE_LABELS[recipe.cook_type] || '炒/煎';
    newRecipe._meatLabel = MEAT_LABELS[recipe.meat] || '其他';
    newRecipe._flavorLabel = FLAVOR_LABELS[recipe.flavor_profile] || '';

    // 封面图：原生用 HTTP 直链；外部导入用云数据库 coverUrl（需 getTempFileURL 解析）
    if (sourceType === 'native') {
      newRecipe._coverHttpUrl = coverService.getRecipeCoverHttpUrl(recipe.name);
      newRecipe._coverCloudUrl = '';
      newRecipe._coverTempUrl = '';
    } else {
      newRecipe._coverHttpUrl = '';
      newRecipe._coverCloudUrl = recipe.coverUrl || '';
      newRecipe._coverTempUrl = '';
    }

    selected.push(newRecipe);

    var that = this;
    that.setData({
      selectedRecipes: selected,
      showAddPanel: false
    });

    that._updateSchedulePreview();
    that._resolveCoverImages();
    wx.showToast({ title: '已添加「' + recipe.name + '」', icon: 'success', duration: 1500 });
  },

  // ── 移除已选菜谱 ────────────────────────────────────────────

  onRemoveRecipe: function (e) {
    var idx = e.currentTarget.dataset.index;
    var selected = this.data.selectedRecipes.slice();
    var removed = selected.splice(idx, 1);
    this.setData({ selectedRecipes: selected });
    this._updateSchedulePreview();

    if (removed.length > 0) {
      wx.showToast({ title: '已移除「' + removed[0].name + '」', icon: 'none', duration: 1000 });
    }
  },

  // ── 清空已选 ────────────────────────────────────────────────

  onClearAll: function () {
    var that = this;
    wx.showModal({
      title: '确认清空',
      content: '是否清空当前选择的所有菜谱？',
      confirmText: '清空',
      cancelText: '取消',
      success: function (res) {
        if (res.confirm) {
          that.setData({ selectedRecipes: [] });
          that._updateSchedulePreview();
          try { wx.removeStorageSync(MIX_DRAFT_KEY); } catch (e) {}
        }
      }
    });
  },

  // ── 更新统筹预览 ────────────────────────────────────────────

  _updateSchedulePreview: function () {
    var selectedRecipes = this.data.selectedRecipes || [];
    var preview = scheduleEngine.computeSchedulePreview(selectedRecipes);
    this.setData({ schedulePreview: preview });
    // 统筹预览展示时自动记录轨迹（每页一次）
    if (selectedRecipes.length > 0 && !this._hasTrackedSchedulePreview) {
      this._hasTrackedSchedulePreview = true;
      try {
        var tracker = require('../../utils/tracker.js');
        tracker.trackEvent('schedule_preview_view', {
          recipe_count: selectedRecipes.length,
          total_time: preview.totalTime,
          efficiency: preview.efficiency,
          stove_count: preview.stoveCount
        });
      } catch (e) { /* ignore */ }
    }
  },

  // ── 封面图解析 ────────────────────────────────────────────────

  /**
   * 批量将 cloud:// 封面地址解析为可渲染的临时 HTTPS URL
   * 同时为没有 coverUrl 的外部导入菜谱尝试从云数据库补全
   */
  _resolveCoverImages: function () {
    var that = this;
    if (!(wx.cloud && wx.cloud.getTempFileURL)) return;

    var recipes = that.data.selectedRecipes || [];
    if (recipes.length === 0) return;

    // 1. 先为没有 _coverCloudUrl 的外部导入菜尝试从云数据库补全
    var needDbQuery = [];
    for (var n = 0; n < recipes.length; n++) {
      var r = recipes[n];
      if (r._sourceType === 'external' && !r._coverCloudUrl && r.id) {
        needDbQuery.push({ index: n, id: r.id });
      }
    }

    if (needDbQuery.length > 0) {
      that._queryExternalCovers(needDbQuery, function () {
        that._doResolveTempUrls();
      });
    } else {
      that._doResolveTempUrls();
    }
  },

  /**
   * 从云数据库查询外部导入菜谱的 coverUrl（异步补全后回调）
   */
  _queryExternalCovers: function (needDbQuery, done) {
    var that = this;
    try {
      var db = wx.cloud.database();
      var ids = needDbQuery.map(function (q) { return q.id; });
      db.collection('imported_recipes').where({
        id: db.command.in(ids)
      }).field({ id: true, coverUrl: true }).get({
        success: function (res) {
          var docs = (res && res.data) || [];
          if (docs.length > 0) {
            var coverMap = {};
            for (var d = 0; d < docs.length; d++) {
              if (docs[d].coverUrl) coverMap[docs[d].id] = docs[d].coverUrl;
            }
            var recipes = that.data.selectedRecipes.slice();
            var changed = false;
            for (var q = 0; q < needDbQuery.length; q++) {
              var idx = needDbQuery[q].index;
              var cUrl = coverMap[needDbQuery[q].id];
              if (cUrl && recipes[idx]) {
                recipes[idx] = Object.assign({}, recipes[idx], { _coverCloudUrl: cUrl, coverUrl: cUrl });
                changed = true;
              }
            }
            if (changed) that.setData({ selectedRecipes: recipes });
          }
          done();
        },
        fail: function () { done(); }
      });
    } catch (e) {
      done();
    }
  },

  /**
   * 将 _coverCloudUrl 中的 cloud:// 地址批量转为临时 HTTPS URL（使用全局缓存）
   */
  _doResolveTempUrls: function () {
    var that = this;
    var recipes = that.data.selectedRecipes || [];
    var cloudIds = [];
    for (var i = 0; i < recipes.length; i++) {
      var url = recipes[i]._coverCloudUrl;
      if (url && typeof url === 'string' && url.indexOf('cloud://') === 0) {
        cloudIds.push(url);
      }
    }
    if (cloudIds.length === 0) return;

    imageLib.batchResolveTempUrls(cloudIds, function (map) {
      var updated = recipes.map(function (r) {
        var tmp = (r._coverCloudUrl && map[r._coverCloudUrl]) || '';
        if (tmp) return Object.assign({}, r, { _coverTempUrl: tmp });
        return r;
      });
      that.setData({ selectedRecipes: updated });
    });
  },

  // ── 面板菜谱封面解析 ─────────────────────────────────────────

  /**
   * 批量解析原生菜谱列表中的封面（首次打开面板时调用一次）
   * getTempFileURL 一次最多 50 个，原生菜谱库可能超出，需分批
   */
  _resolvePickerCoverImages: function () {
    var that = this;

    var allRecipes = that._nativeRecipes || [];
    var cloudIds = [];
    for (var i = 0; i < allRecipes.length; i++) {
      var url = allRecipes[i]._coverCloudUrl;
      if (url && typeof url === 'string' && url.indexOf('cloud://') === 0) {
        cloudIds.push(url);
      }
    }
    if (cloudIds.length === 0) {
      that._pickerCoversResolved = true;
      return;
    }

    imageLib.batchResolveTempUrls(cloudIds, function (urlMap) {
      if (Object.keys(urlMap).length === 0) return;
      var allNative = that._nativeRecipes || [];
      for (var k = 0; k < allNative.length; k++) {
        var tmp = urlMap[allNative[k]._coverCloudUrl] || '';
        if (tmp) allNative[k]._coverTempUrl = tmp;
      }
      var currentFilter = that.data.nativeFilter || 'all';
      var filtered = currentFilter === 'all' ? allNative : allNative.filter(function (r) { return r.meat === currentFilter; });
      that.setData({
        nativeRecipes: allNative,
        filteredNativeRecipes: filtered
      });
      that._pickerCoversResolved = true;
    });
  },

  /**
   * 解析导入菜谱列表的封面（从云数据库补全 coverUrl 后转临时 URL）
   */
  _resolveImportedPickerCovers: function () {
    var that = this;
    if (!(wx.cloud && wx.cloud.getTempFileURL)) return;

    var imported = that.data.importedRecipes || [];
    if (imported.length === 0) return;

    // 1. 收集需要从 DB 补全的 ID
    var needDb = [];
    var haveCloud = [];
    for (var i = 0; i < imported.length; i++) {
      var r = imported[i];
      if (r._coverTempUrl) continue; // 已有临时 URL，跳过
      if (r._coverCloudUrl && r._coverCloudUrl.indexOf('cloud://') === 0) {
        haveCloud.push(r._coverCloudUrl);
      } else if (r.id) {
        needDb.push({ index: i, id: r.id });
      }
    }

    function resolveCloudUrls() {
      var list = that.data.importedRecipes || [];
      var cloudIds = [];
      for (var c = 0; c < list.length; c++) {
        var url = list[c]._coverCloudUrl;
        if (url && typeof url === 'string' && url.indexOf('cloud://') === 0 && !list[c]._coverTempUrl) {
          cloudIds.push(url);
        }
      }
      if (cloudIds.length === 0) return;

      imageLib.batchResolveTempUrls(cloudIds, function (map) {
        var updated = (that.data.importedRecipes || []).map(function (r) {
          var tmp = r._coverCloudUrl && map[r._coverCloudUrl];
          if (tmp) return Object.assign({}, r, { _coverTempUrl: tmp });
          return r;
        });
        that.setData({ importedRecipes: updated });
      });
    }

    if (needDb.length > 0) {
      try {
        var db = wx.cloud.database();
        var ids = needDb.map(function (q) { return q.id; });
        db.collection('imported_recipes').where({
          id: db.command.in(ids)
        }).field({ id: true, coverUrl: true }).get({
          success: function (res) {
            var docs = (res && res.data) || [];
            if (docs.length > 0) {
              var coverMap = {};
              for (var d = 0; d < docs.length; d++) {
                if (docs[d].coverUrl) coverMap[docs[d].id] = docs[d].coverUrl;
              }
              var list = (that.data.importedRecipes || []).slice();
              for (var q = 0; q < needDb.length; q++) {
                var idx = needDb[q].index;
                var cUrl = coverMap[needDb[q].id];
                if (cUrl && list[idx]) {
                  list[idx] = Object.assign({}, list[idx], { _coverCloudUrl: cUrl, coverUrl: cUrl });
                }
              }
              that.setData({ importedRecipes: list });
            }
            resolveCloudUrls();
          },
          fail: function () { resolveCloudUrls(); }
        });
      } catch (e) { resolveCloudUrls(); }
    } else {
      resolveCloudUrls();
    }
  },

  // ── 人数调整 ────────────────────────────────────────────────

  onAdultCountMinus: function () {
    var count = Math.max(1, this.data.adultCount - 1);
    this.setData({ adultCount: count });
  },

  onAdultCountPlus: function () {
    var count = Math.min(6, this.data.adultCount + 1);
    this.setData({ adultCount: count });
  },

  // ── 生成购物清单 + 做饭步骤 ──────────────────────────────────

  onGenerate: function () {
    var that = this;
    var selectedRecipes = that.data.selectedRecipes;
    var adultCount = that.data.adultCount;

    if (selectedRecipes.length === 0) {
      wx.showToast({ title: '请先添加菜谱', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在生成统筹方案...' });

    try {
      // 构建 menus 数组（兼容统筹引擎格式）
      var menus = [];
      for (var i = 0; i < selectedRecipes.length; i++) {
        var recipe = selectedRecipes[i];
        var menu;

        if (recipe._sourceType === 'external') {
          // 外部导入菜谱：已经是完整结构，直接包装成 menu
          menu = menuGen.generateMenuFromExternalRecipe
            ? menuGen.generateMenuFromExternalRecipe(recipe, adultCount)
            : { adultRecipe: recipe, babyRecipe: null, meat: recipe.meat || 'vegetable', taste: recipe.taste || 'quick_stir_fry' };
        } else {
          // 原生菜谱：使用 generator 处理人数缩放等
          menu = menuGen.generateMenuFromRecipe(recipe, 12, false, adultCount, 'soft_porridge');
          menu.meat = recipe.meat || 'vegetable';
          menu.taste = recipe.taste || recipe.flavor_profile || 'quick_stir_fry';
        }

        menus.push(menu);
      }

      // 生成购物清单
      var preference = { adultCount: adultCount };
      var shoppingList = menuData.generateShoppingListFromMenus(preference, menus);

      // 生成统筹步骤
      var steps;
      if (menus.length > 1 && menuGen.generateUnifiedSteps) {
        steps = menuGen.generateUnifiedSteps(menus, shoppingList);
      } else if (menus.length === 1) {
        steps = menuGen.generateSteps(menus[0].adultRecipe, menus[0].babyRecipe, shoppingList);
      } else {
        steps = [];
      }

      // 存储到全局数据
      var app = getApp();
      if (app && app.globalData) {
        app.globalData.mixMenus = menus;
        app.globalData.mergedShoppingList = shoppingList;
        app.globalData.todayMenus = menus;

        // 与 preview 一致：写入 slim + preference + cart，冷启或分享进 steps/shopping 可读到 mix 这桌菜
        wx.setStorageSync('cart_ingredients', shoppingList || []);
        var pref = { adultCount: that.data.adultCount || 2, hasBaby: false, babyMonth: 12 };
        app.globalData.preference = pref;
        if (menuData.serializeMenusForStorage) {
          var slimMenus = menuData.serializeMenusForStorage(menus);
          wx.setStorageSync('today_menus', JSON.stringify(slimMenus));
          wx.setStorageSync('today_menus_preference', JSON.stringify(pref));
        }
      }

      // 清除草稿
      try { wx.removeStorageSync(MIX_DRAFT_KEY); } catch (e) {}

      wx.hideLoading();

      // 跳转到步骤页
      var recipeNames = selectedRecipes.map(function (r) { return r.name || ''; }).filter(Boolean);
      wx.navigateTo({
        url: '/pages/steps/steps?source=mix&recipeNames=' + encodeURIComponent(recipeNames.join(','))
      });
    } catch (err) {
      wx.hideLoading();
      console.error('[mix] 生成统筹方案失败:', err);
      wx.showToast({ title: '生成失败: ' + (err.message || '未知错误'), icon: 'none' });
    }
  },

  // ── 让别人做：写入同「直接开始做」后跳转预览页，在预览页可「发给别人」进入 helper 模式
  onGoHelperMode: function () {
    var that = this;
    var selectedRecipes = that.data.selectedRecipes;
    var adultCount = that.data.adultCount;

    if (selectedRecipes.length === 0) {
      wx.showToast({ title: '请先添加菜谱', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在生成...' });

    try {
      var menus = [];
      for (var i = 0; i < selectedRecipes.length; i++) {
        var recipe = selectedRecipes[i];
        var menu;
        if (recipe._sourceType === 'external') {
          menu = menuGen.generateMenuFromExternalRecipe
            ? menuGen.generateMenuFromExternalRecipe(recipe, adultCount)
            : { adultRecipe: recipe, babyRecipe: null, meat: recipe.meat || 'vegetable', taste: recipe.taste || 'quick_stir_fry' };
        } else {
          menu = menuGen.generateMenuFromRecipe(recipe, 12, false, adultCount, 'soft_porridge');
          menu.meat = recipe.meat || 'vegetable';
          menu.taste = recipe.taste || recipe.flavor_profile || 'quick_stir_fry';
        }
        menus.push(menu);
      }

      var preference = { adultCount: adultCount || 2, hasBaby: false, babyMonth: 12 };
      var shoppingList = menuData.generateShoppingListFromMenus(preference, menus);
      var app = getApp();

      if (app && app.globalData) {
        app.globalData.mixMenus = menus;
        app.globalData.mergedShoppingList = shoppingList;
        app.globalData.todayMenus = menus;
        app.globalData.preference = preference;
        wx.setStorageSync('cart_ingredients', shoppingList || []);

        var canSlim = menuData.canSafelySlimMenus && menuData.canSafelySlimMenus(menus);
        if (canSlim && menuData.serializeMenusForStorage) {
          var slimMenus = menuData.serializeMenusForStorage(menus);
          wx.setStorageSync('today_menus', JSON.stringify(slimMenus));
        } else {
          wx.setStorageSync('today_menus', JSON.stringify(menus));
        }
        wx.setStorageSync('today_menus_preference', JSON.stringify(preference));
      }

      try { wx.removeStorageSync(MIX_DRAFT_KEY); } catch (e) {}
      wx.hideLoading();
      wx.navigateTo({ url: '/pages/preview/preview' });
    } catch (err) {
      wx.hideLoading();
      console.error('[mix] 让别人做失败:', err);
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  // ── 仅生成购物清单 ──────────────────────────────────────────

  onGenerateShoppingOnly: function () {
    var that = this;
    var selectedRecipes = that.data.selectedRecipes;
    var adultCount = that.data.adultCount;

    if (selectedRecipes.length === 0) {
      wx.showToast({ title: '请先添加菜谱', icon: 'none' });
      return;
    }

    try {
      var menus = [];
      for (var i = 0; i < selectedRecipes.length; i++) {
        var recipe = selectedRecipes[i];
        var menu;
        if (recipe._sourceType === 'external') {
          menu = menuGen.generateMenuFromExternalRecipe
            ? menuGen.generateMenuFromExternalRecipe(recipe, adultCount)
            : { adultRecipe: recipe, babyRecipe: null, meat: recipe.meat || 'vegetable', taste: recipe.taste || 'quick_stir_fry' };
        } else {
          menu = menuGen.generateMenuFromRecipe(recipe, 12, false, adultCount, 'soft_porridge');
          menu.meat = recipe.meat || 'vegetable';
          menu.taste = recipe.taste || recipe.flavor_profile || 'quick_stir_fry';
        }
        menus.push(menu);
      }

      var preference = { adultCount: adultCount, hasBaby: false, babyMonth: 12 };
      var shoppingList = menuData.generateShoppingListFromMenus(preference, menus);

      var app = getApp();
      if (app && app.globalData) {
        app.globalData.mergedShoppingList = shoppingList;
        app.globalData.todayMenus = menus;
        app.globalData.preference = preference;
        wx.setStorageSync('cart_ingredients', shoppingList || []);
        if (menuData.serializeMenusForStorage) {
          var slimMenus = menuData.serializeMenusForStorage(menus);
          wx.setStorageSync('today_menus', JSON.stringify(slimMenus));
          wx.setStorageSync('today_menus_preference', JSON.stringify(preference));
        }
      }

      wx.navigateTo({ url: '/pages/shopping/shopping' });
    } catch (err) {
      console.error('[mix] 生成购物清单失败:', err);
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  // ── 返回首页 ────────────────────────────────────────────────

  onGoHome: function () {
    wx.navigateBack({ delta: 1 });
  }
});
