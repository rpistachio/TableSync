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
    this._loadRecipes();
  },

  onPullDownRefresh: function () {
    var that = this;
    that._loadRecipes(function () {
      wx.stopPullDownRefresh();
    });
  },

  onRefresh: function () {
    this._loadRecipes();
  },

  _loadRecipes: function (callback) {
    var that = this;
    if (typeof callback !== 'function') callback = function () {};
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
        var withCover = list.filter(function (r) { return r.coverUrl; });
        if (withCover.length) console.log('[myRecipes] 有封面的条数:', withCover.length, '首条 coverUrl:', withCover[0].coverUrl ? withCover[0].coverUrl.slice(0, 60) + '...' : '');
        that._fillCoverTempUrls(list, function (listWithCovers) {
          that.setData({
            recipeList: listWithCovers,
            loading: false,
            empty: listWithCovers.length === 0
          });
          callback();
        });
      },
      fail: function (err) {
        console.warn('[myRecipes] 云数据库获取失败，使用本地缓存', err);
        that.setData({
          recipeList: localList,
          loading: false,
          empty: localList.length === 0
        });
        callback();
      }
    });
  },

  /** 只把 cloud:// 或 http 视为有效封面地址，避免把 sourcePlatform 等字段（如 "screenshot"）当图片显示 */
  _isValidCoverUrl: function (url) {
    if (!url || typeof url !== 'string') return false;
    var u = url.trim();
    return u.indexOf('cloud://') === 0 || u.indexOf('https://') === 0 || u.indexOf('http://') === 0;
  },

  /** 将云文件 ID 转为临时 HTTPS 链接以便 image 组件正确显示（image 不能直接使用 cloud://） */
  _fillCoverTempUrls: function (list, done) {
    var that = this;
    var cloudIds = [];
    for (var i = 0; i < list.length; i++) {
      if (that._isValidCoverUrl(list[i].coverUrl) && list[i].coverUrl.indexOf('cloud://') === 0) {
        cloudIds.push(list[i].coverUrl);
      }
    }
    // 无云封面：仅 https/http 直接用于 displayCoverUrl，cloud:// 不赋给 image
    if (cloudIds.length === 0) {
      for (var n = 0; n < list.length; n++) {
        var cv = list[n].coverUrl;
        list[n].displayCoverUrl = (cv && (cv.indexOf('https://') === 0 || cv.indexOf('http://') === 0)) ? cv : '';
      }
      return done(list);
    }
    // getTempFileURL 单次最多 50 个，分批请求
    var BATCH = 50;
    var urlMap = {};
    var batchIndex = 0;
    function runNextBatch() {
      var start = batchIndex * BATCH;
      var end = Math.min(start + BATCH, cloudIds.length);
      if (start >= end) {
        applyUrlMap();
        return;
      }
      var batch = cloudIds.slice(start, end);
      // fileID 须为 cloud://envId.xxx/recipe_covers/xxx 格式，与云函数上传后写入的 coverUrl 一致
      wx.cloud.getTempFileURL({
        fileList: batch,
        success: function (res) {
          if (res.fileList && res.fileList.length) {
            var first = res.fileList[0];
            if (first && (batchIndex === 0)) {
              var tu = first.tempFileURL || first.tempFileUrl || '';
              var host = (tu && tu.indexOf('https://') === 0) ? tu.replace(/^https:\/\/([^/]+).*/, '$1') : '';
              if (tu) console.log('[myRecipes] 封面临时链接已获取，域名:', host, '— 若封面不显示请将该域名加入小程序 downloadFile 合法域名');
            }
            for (var j = 0; j < res.fileList.length; j++) {
              var f = res.fileList[j];
              var tempUrl = (f && (f.tempFileURL || f.tempFileUrl)) || '';
              if (f && f.fileID && tempUrl) urlMap[f.fileID] = tempUrl;
              var okMsg = f && (f.errMsg === 'getTempFileURL:ok' || f.errMsg === 'ok');
              if (f && f.fileID && !tempUrl && !okMsg) console.warn('[myRecipes] getTempFileURL 单项失败', f.fileID, f.errMsg);
            }
          }
          batchIndex++;
          runNextBatch();
        },
        fail: function (err) {
          console.warn('[myRecipes] getTempFileURL 失败', err && err.errMsg, 'coverUrl 示例:', cloudIds[0]);
          applyUrlMap();
        }
      });
    }
    function applyUrlMap() {
      var mapSize = Object.keys(urlMap).length;
      var filled = 0;
      for (var k = 0; k < list.length; k++) {
        var url = urlMap[list[k].coverUrl] || '';
        if (!url && list[k].coverUrl && list[k].coverUrl.indexOf('https://') === 0) url = list[k].coverUrl;
        if (!url && list[k].coverUrl && list[k].coverUrl.indexOf('http://') === 0) url = list[k].coverUrl;
        list[k].displayCoverUrl = url || '';
        if (list[k].displayCoverUrl) filled++;
      }
      if (cloudIds.length > 0 && mapSize === 0) console.warn('[myRecipes] 未获取到任何封面临时链接，请检查云存储权限与 coverUrl 是否为 fileID');
      if (cloudIds.length > 0 && mapSize > 0 && filled === 0) {
        var sampleKey = Object.keys(urlMap)[0] || '';
        var sampleCover = (list[0] && list[0].coverUrl) ? list[0].coverUrl : '';
        console.warn('[myRecipes] urlMap 有', mapSize, '条但未匹配到列表，示例 list.coverUrl:', sampleCover ? sampleCover.slice(0, 80) : '', 'urlMapKey:', sampleKey ? sampleKey.slice(0, 80) : '');
      }
      done(list);
    }
    runNextBatch();
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

  /** 删除菜谱：弹窗确认后同时删除云端和本地缓存 */
  onDeleteRecipe: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.recipeList;
    var recipe = list[idx];
    if (!recipe) return;

    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除「' + (recipe.name || '未知菜谱') + '」吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#e85d5d',
      success: function (res) {
        if (!res.confirm) return;

        var recipeId = recipe.id || recipe._id;
        var cloudDocId = recipe._id;

        // 1. 从本地缓存中删除
        that._removeFromLocalCache(recipeId);

        // 2. 从云数据库中删除（若有 _id）
        if (cloudDocId) {
          wx.cloud.database().collection('imported_recipes').doc(cloudDocId).remove({
            success: function () {
              console.log('[myRecipes] 云端删除成功:', cloudDocId);
            },
            fail: function (err) {
              console.warn('[myRecipes] 云端删除失败:', err);
            }
          });
        }

        // 3. 立即更新视图（乐观更新）
        var newList = list.filter(function (_, i) { return i !== idx; });
        that.setData({
          recipeList: newList,
          empty: newList.length === 0
        });

        wx.showToast({ title: '已删除', icon: 'success', duration: 1500 });
      }
    });
  },

  /** 从本地缓存中删除指定菜谱 */
  _removeFromLocalCache: function (recipeId) {
    if (!recipeId) return;
    try {
      var raw = wx.getStorageSync(CACHE_KEY);
      if (!raw) return;
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      list = list.filter(function (r) { return r.id !== recipeId && r._id !== recipeId; });
      wx.setStorageSync(CACHE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[myRecipes] _removeFromLocalCache 失败:', e);
    }
  },

  onGoImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  }
});
