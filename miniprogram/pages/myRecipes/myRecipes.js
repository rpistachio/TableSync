// pages/myRecipes/myRecipes.js
// 我的菜谱库 —— 导入历史管理，支持「今天继续做」与「加入组餐」

var CACHE_KEY = 'imported_recipes_cache';

/**
 * 从本地缓存获取已导入菜谱列表
 */
function getLocalImportedRecipes() {
  try {
    var raw = wx.getStorageSync(CACHE_KEY);
    if (!raw) return [];
    var list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * 合并云端与本地列表：以 id 去重，云端优先，按 importedAt 降序
 */
function mergeRecipeLists(cloudList, localList) {
  var byId = {};
  var i;
  for (i = 0; i < cloudList.length; i++) {
    var r = cloudList[i];
    var id = r.id || r._id;
    if (id) byId[id] = r;
  }
  for (i = 0; i < localList.length; i++) {
    var r2 = localList[i];
    id = r2.id;
    if (id && !byId[id]) byId[id] = r2;
  }
  var merged = [];
  for (id in byId) {
    if (Object.prototype.hasOwnProperty.call(byId, id)) merged.push(byId[id]);
  }
  merged.sort(function (a, b) {
    var ta = a.importedAt || a.createdAt || 0;
    var tb = b.importedAt || b.createdAt || 0;
    return tb - ta;
  });
  return merged;
}

Page({
  data: {
    recipeList: [],
    loading: true,
    empty: false,
    fromMix: false
  },

  onLoad: function (options) {
    var fromMix = (options && options.from === 'mix');
    this.setData({ fromMix: fromMix });
    this._loadRecipes();
  },

  onShow: function () {
    // 从混合组餐返回或从导入页保存后返回时刷新列表
    this._loadRecipes();
  },

  _loadRecipes: function () {
    var that = this;
    that.setData({ loading: true });

    var localList = getLocalImportedRecipes();

    wx.cloud.database().collection('imported_recipes').get({
      success: function (res) {
        var cloudList = (res.data || []).map(function (doc) {
          var r = Object.assign({}, doc);
          if (doc._id && !r.id) r.id = r.id || doc._id;
          return r;
        });
        var list = mergeRecipeLists(cloudList, localList);
        that.setData({
          recipeList: list,
          loading: false,
          empty: list.length === 0
        });
      },
      fail: function (err) {
        console.warn('[myRecipes] 云数据库获取失败，使用本地缓存', err);
        that.setData({
          recipeList: localList,
          loading: false,
          empty: localList.length === 0
        });
      }
    });
  },

  /** 今天做：单道菜直接进入步骤页 */
  onCookToday: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.recipeList;
    var recipe = list[idx];
    if (!recipe || !recipe.name) return;

    getApp().globalData.importedRecipe = recipe;
    wx.setStorageSync('imported_recipe', JSON.stringify(recipe));

    wx.navigateTo({
      url: '/pages/steps/steps?source=import&recipeName=' + encodeURIComponent(recipe.name)
    });
  },

  /** 加入组餐：带入混合组餐页并自动加入已选 */
  onAddToMix: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.recipeList;
    var recipe = list[idx];
    if (!recipe || !recipe.name) return;

    getApp().globalData._pendingMixRecipe = recipe;

    wx.navigateTo({
      url: '/pages/mix/mix'
    });
  },

  onGoImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  }
});
