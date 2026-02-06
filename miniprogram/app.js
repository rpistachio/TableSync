// TableSync 微信小程序入口
var cloudRecipeService = require('./utils/cloudRecipeService.js');
var cloudInit = require('./utils/cloudInitRecipes.js');

App({
  globalData: {
    // 跨页传递的偏好参数，供 menu/steps/shopping 使用
    preference: null,
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
  }
});
