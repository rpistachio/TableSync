// TableSync 微信小程序入口
var cloudRecipeService = require('./utils/cloudRecipeService.js');
var cloudInit = require('./utils/cloudInitRecipes.js');
var tracker = require('./utils/tracker.js');
var seedUserService = require('./utils/seedUserService.js');

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
    // VIP 状态，与 storage key tablesync_user_vip 同步
    isVip: false,
    // 设备平台信息（wx.getSystemInfoSync 结果），用于 Android/iOS 物理隔离
    platformInfo: null,
    // 种子用户信息 { seq, channel, isNew }
    seedUser: null,
    // AI 主厨报告文本（reasoning）
    chefReportText: '',
    // AI 返回的每道菜选择理由
    dishHighlights: {},
    // 云端菜谱同步状态
    cloudSyncState: {
      initialized: false,
      syncing: false,
      lastSync: null,
      error: null
    },
    // IP 静默粗定位结果（6h 缓存），供地域文案等使用
    userRegion: null
  },

  onLaunch: function(options) {
    var self = this;
    ensureFetch();

    // 设备平台与 VIP 状态：用于甘特图付费拦截与 iOS 合规隔离
    try {
      if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
        self.globalData.platformInfo = wx.getSystemInfoSync();
      }
      if (typeof wx !== 'undefined' && wx.getStorageSync) {
        var stored = wx.getStorageSync('tablesync_user_vip');
        self.globalData.isVip = stored === true || stored === '1';
      }
    } catch (e) {}

    // 埋点队列补报（spec 9.4.3）
    try { tracker.flushTrackingQueue(); } catch (e) {}

    // ====== 种子用户：渠道追踪 & 先锋主厨注册 ======
    var channel = seedUserService.parseChannel(options);
    if (channel && channel !== 'organic') {
      seedUserService.saveChannel(channel);
    }

    // 初始化云开发环境（同步执行，确保页面 onLoad 中可用）
    // 若控制台报 access_token missing：多为模拟器未登录，请用「真机预览」扫码或「真机调试」获得登录态
    if (typeof wx !== 'undefined' && wx.cloud) {
      try {
        wx.cloud.init({
          env: cloudInit.DEFAULT_ENV,
          traceUser: true
        });
      } catch (e) {
        // 同步异常静默处理（重复 init 等场景）
      }
    }

    // 种子用户注册（异步，在云 init 之后执行，避免触发未初始化的 cloud）
    function runSeedUserRegister() {
      seedUserService.registerSeedUser(channel).then(function (seedInfo) {
        self.globalData.seedUser = seedInfo;
        console.log('[SeedUser]', seedInfo.isNew ? '新注册' : '已注册',
          '编号:', seedInfo.seq, '渠道:', seedInfo.channel);
      }).catch(function (err) {
        console.warn('[SeedUser] 注册失败:', err);
      });
    }
    setTimeout(runSeedUserRegister, 100);

    // IP 静默粗定位（异步，不阻塞启动，6h 缓存）
    self._silentDetectRegion();

    // 初始化云端菜谱服务（异步，不阻塞启动）
    cloudRecipeService.init({
      autoSync: true,
      forceRefresh: false
    }).then(function(result) {
      self.globalData.cloudSyncState.initialized = true;
      // 首次启动时强制全量同步；仅同步成功后才标记，避免真机首次同步失败后永远不重试
      if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) {
        var forceKey = 'cloud_recipes_force_refresh_once';
        var forced = wx.getStorageSync(forceKey);
        if (!forced) {
          cloudInit.initRecipesCollection({ force: false }).catch(function () {});
          self.syncCloudRecipes({ forceRefresh: true })
            .then(function(res) {
              if (res && (res.fromCloud === true || (res.adultCount > 0 || res.babyCount > 0))) {
                wx.setStorageSync(forceKey, '1');
              }
            })
            .catch(function() {});
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
   * 静默调用 getRegionByIP 云函数，缓存到 globalData.userRegion 与 storage（6h TTL）
   */
  _silentDetectRegion: function() {
    var self = this;
    var CACHE_KEY = 'user_region';
    var TTL_MS = 6 * 60 * 60 * 1000;
    try {
      var cached = wx.getStorageSync(CACHE_KEY);
      if (cached && cached.ts && (Date.now() - cached.ts < TTL_MS) && cached.data) {
        self.globalData.userRegion = cached.data;
        var tasteProfile = require('./data/tasteProfile.js');
        if (tasteProfile && tasteProfile.setDetectedRegion) tasteProfile.setDetectedRegion(cached.data);
        console.log('[LBS] 使用缓存地域', cached.data);
        return;
      }
    } catch (e) {}
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) {
      console.warn('[LBS] 无云能力，跳过 IP 嗅探');
      return;
    }
    wx.cloud.callFunction({ name: 'getRegionByIP' }).then(function(res) {
      var result = res.result;
      if (result && result.code === 0 && result.data) {
        self.globalData.userRegion = result.data;
        try {
          wx.setStorageSync(CACHE_KEY, { data: result.data, ts: Date.now() });
        } catch (e) {}
        var tasteProfile = require('./data/tasteProfile.js');
        if (tasteProfile && tasteProfile.setDetectedRegion) tasteProfile.setDetectedRegion(result.data);
        console.log('[LBS] IP 嗅探成功', result.data);
      } else {
        console.warn('[LBS] 云函数返回无地域', result ? result.message : '');
      }
    }).catch(function(err) {
      console.warn('[LBS] getRegionByIP 调用失败', err && err.errMsg ? err.errMsg : err);
    });
  },

  /**
   * 设置 VIP 状态并持久化到 storage
   * @param {Boolean} val - 是否为 VIP
   */
  setVip: function(val) {
    this.globalData.isVip = !!val;
    try {
      if (typeof wx !== 'undefined' && wx.setStorageSync) {
        wx.setStorageSync('tablesync_user_vip', val ? true : false);
      }
    } catch (e) {}
  },

});
