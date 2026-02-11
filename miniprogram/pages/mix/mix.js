// pages/mix/mix.js
// 混合组餐页面 —— 自由搭配原生 + 外部导入菜谱，一键统筹做饭

var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var scheduleEngine = require('../../utils/scheduleEngine.js');

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
    this.setData({ importedRecipes: importedRecipes });

    // 检查 globalData 中是否有待添加的菜谱
    var app = getApp();
    if (app && app.globalData && app.globalData._pendingMixRecipe) {
      var recipe = app.globalData._pendingMixRecipe;
      app.globalData._pendingMixRecipe = null;
      if (recipe && recipe.name) {
        this._addRecipeToSelection(recipe, recipe.source === 'external' ? 'external' : 'native');
      }
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
        this.setData({ selectedRecipes: recipes });
        this._updateSchedulePreview();
      }
    } catch (e) {}
  },

  // ── 添加菜谱 ────────────────────────────────────────────────

  onShowAddPanel: function () {
    this.setData({ showAddPanel: true });
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

    selected.push(newRecipe);

    this.setData({
      selectedRecipes: selected,
      showAddPanel: false
    });

    this._updateSchedulePreview();
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

        // 存储购物清单到 Storage
        wx.setStorageSync('cart_ingredients', shoppingList);
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

      var preference = { adultCount: adultCount };
      var shoppingList = menuData.generateShoppingListFromMenus(preference, menus);

      var app = getApp();
      if (app && app.globalData) {
        app.globalData.mergedShoppingList = shoppingList;
        app.globalData.todayMenus = menus;
        wx.setStorageSync('cart_ingredients', shoppingList);
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
