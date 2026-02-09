// TableSync 微信小程序入口
var cloudRecipeService = require('./utils/cloudRecipeService.js');
var cloudInit = require('./utils/cloudInitRecipes.js');

// 兼容小程序环境：提供 fetch 轻量 shim，保证调试日志可发送
function ensureFetch() {
  if (typeof fetch === 'function') return;
  if (typeof wx !== 'undefined' && wx.request) {
    // 仅满足日志上报的最小实现（resolve/reject + headers/body）
    try {
      // eslint-disable-next-line no-global-assign
      fetch = function(url, options) {
        return new Promise(function(resolve, reject) {
          var method = options && options.method ? options.method : 'GET';
          var header = options && options.headers ? options.headers : {};
          var data = options && options.body ? (function() {
            try { return JSON.parse(options.body); } catch (e) { return options.body; }
          })() : undefined;
          wx.request({
            url: url,
            method: method,
            header: header,
            data: data,
            success: function(res) { resolve(res); },
            fail: function(err) { reject(err); }
          });
        });
      };
    } catch (e) {}
  }
}

App({
  globalData: {
    // 跨页传递的偏好参数，供 menu/steps/shopping 使用
    preference: null,
    // 灵感篮子：跨页面共享的当日备选池
    inspirationBasket: [],
    // AI 主厨报告文本（reasoning）
    chefReportText: '',
    // AI 返回的每道菜选择理由
    dishHighlights: {},
    // 最近一次生成时使用的篮子项，供 preview 页展示来源标签
    lastBasketItems: [],
    // 云端菜谱同步状态
    cloudSyncState: {
      initialized: false,
      syncing: false,
      lastSync: null,
      error: null
    }
  },

  onLaunch: function() {
    var self = this;
    ensureFetch();
    // #region agent log
    try {
      if (typeof fetch === 'function') {
        fetch('http://127.0.0.1:7243/ingest/2601ac33-4192-4086-adc2-d77ecd51bad3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'E',location:'app.js:onLaunch',message:'app launched and fetch shim ready',data:{hasFetch:typeof fetch === 'function',hasWxRequest:typeof wx !== 'undefined' && !!wx.request},timestamp:Date.now()})}).catch(()=>{});
      }
    } catch (e) {}
    // #endregion
    
    // 初始化云开发环境
    if (typeof wx !== 'undefined' && wx.cloud) {
      try {
        wx.cloud.init({
          env: cloudInit.DEFAULT_ENV,
          traceUser: true
        });
        // 云开发初始化成功
      } catch (e) {
        // 云开发初始化失败，静默处理
      }
    }

    // 初始化云端菜谱服务（异步，不阻塞启动）
    cloudRecipeService.init({
      autoSync: true,
      forceRefresh: false
    }).then(function(result) {
      self.globalData.cloudSyncState.initialized = true;
      // 一次性强制刷新/初始化（仅本地缓存层），避免重复触发
      if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) {
        var forceKey = 'cloud_recipes_force_refresh_once';
        var forced = wx.getStorageSync(forceKey);
        if (!forced) {
          // 尝试初始化云端集合（若已有数据则会跳过）
          cloudInit.initRecipesCollection({ force: false }).catch(function () {});
          // 强制全量刷新云端菜谱到本地缓存
          self.syncCloudRecipes({ forceRefresh: true }).catch(function () {});
          wx.setStorageSync(forceKey, '1');
        }
      }
    }).catch(function(err) {
      self.globalData.cloudSyncState.error = err;
    });
  },

  /**
   * 手动触发云端菜谱同步
   * @param {Object} options
   * @param {Boolean} options.forceRefresh - 是否强制全量刷新
   * @returns {Promise}
   */
  syncCloudRecipes: function(options) {
    var self = this;
    self.globalData.cloudSyncState.syncing = true;
    
    return cloudRecipeService.syncFromCloud(options).then(function(result) {
      self.globalData.cloudSyncState.syncing = false;
      self.globalData.cloudSyncState.lastSync = new Date();
      self.globalData.cloudSyncState.error = null;
      return result;
    }).catch(function(err) {
      self.globalData.cloudSyncState.syncing = false;
      self.globalData.cloudSyncState.error = err;
      throw err;
    });
  },

  /**
   * 获取云端菜谱同步状态
   * @returns {Object}
   */
  getCloudSyncState: function() {
    return Object.assign({}, this.globalData.cloudSyncState, cloudRecipeService.getSyncState());
  },

  /**
   * 获取菜谱数量统计（云端/缓存/本地）
   * @returns {Object}
   */
  getRecipeCounts: function() {
    return cloudRecipeService.getRecipeCounts();
  },

  /**
   * 初始化云端菜谱数据库（控制台调用）
   * 使用方式：getApp().initRecipesCollection()
   * @param {Object} options
   * @returns {Promise}
   */
  initRecipesCollection: function(options) {
    return cloudInit.initRecipesCollection(options);
  },

  /**
   * 清除云端菜谱缓存（调试用）
   * 使用方式：getApp().clearRecipeCache()
   */
  clearRecipeCache: function() {
    cloudRecipeService.clearCache();
  },

  /**
   * 篮子变更通知（可选）：入篮/出篮页写入后调用，home 在 onShow 时注册、onHide 时注销，用于 .basket-bar 平滑更新
   * @param {number} count - 当前篮子条数
   */
  onBasketChange: null
});
