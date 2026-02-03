/**
 * 云端菜谱同步服务（微信小程序云开发）
 *
 * 功能：
 * 1. 从云数据库拉取菜谱数据
 * 2. 本地缓存管理（localStorage + 内存缓存）
 * 3. 增量更新（基于 updateTime 字段）
 * 4. 离线兜底（无网络时使用本地 recipes.js）
 *
 * 使用方式：
 * - 在 app.js onLaunch 中调用 cloudRecipeService.init()
 * - 页面通过 cloudRecipeService.getAdultRecipes() 获取菜谱
 */

var cloudInit = require('./cloudInitRecipes.js');
var recipeSchema = require('../data/recipeSchema.js');

/** 缓存 key */
var STORAGE_KEY_ADULT = 'cloud_recipes_adult';
var STORAGE_KEY_BABY = 'cloud_recipes_baby';
var STORAGE_KEY_LAST_SYNC = 'cloud_recipes_last_sync';
var STORAGE_KEY_VERSION = 'cloud_recipes_version';

/** 当前版本号（用于判断是否需要强制刷新缓存） */
var CURRENT_CACHE_VERSION = '1.0.0';

/** 内存缓存 */
var _memoryCache = {
  adultRecipes: null,
  babyRecipes: null,
  lastSync: null,
  initialized: false
};

/** 同步状态 */
var _syncState = {
  syncing: false,
  lastError: null,
  syncCount: 0
};

/**
 * 获取云数据库实例
 * @returns {Object|null} 云数据库实例
 */
function getCloudDb() {
  var cloud = cloudInit.getCloudDb();
  return cloud && cloud.db ? cloud.db : null;
}

/**
 * 将云端菜谱格式转换为本地格式
 * 云端使用 main_ingredients + seasonings 分块，本地使用 ingredients 统一数组
 * @param {Object} cloudRecipe - 云端菜谱
 * @returns {Object} 本地格式菜谱
 */
function normalizeCloudRecipe(cloudRecipe) {
  if (!cloudRecipe) return null;

  var recipe = {};
  // 复制基础字段
  var basicFields = [
    'id', '_id', 'name', 'type', 'taste', 'meat', 'prep_time', 'cook_time',
    'cover_image_url', 'is_baby_friendly', 'can_share_base', 'common_allergens',
    'flavor_profile', 'cook_type', 'cook_method', 'recommend_reason', 'cook_minutes',
    'base_serving', 'tags', 'main_ingredients', 'difficulty', 'dish_type',
    'baby_variant', 'updateTime', 'createTime'
  ];
  
  for (var i = 0; i < basicFields.length; i++) {
    var field = basicFields[i];
    if (cloudRecipe[field] !== undefined) {
      recipe[field] = cloudRecipe[field];
    }
  }

  // 合并 main_ingredients 和 seasonings 为 ingredients
  var ingredients = [];
  if (Array.isArray(cloudRecipe.main_ingredients)) {
    cloudRecipe.main_ingredients.forEach(function(item) {
      ingredients.push({
        name: item.name,
        baseAmount: item.amount || item.baseAmount || 0,
        unit: item.unit || 'g',
        category: item.category || '其他',
        sub_type: item.sub_type
      });
    });
  }
  if (Array.isArray(cloudRecipe.seasonings)) {
    cloudRecipe.seasonings.forEach(function(item) {
      ingredients.push({
        name: item.name,
        baseAmount: item.amount || 0,
        unit: item.unit || '适量',
        category: '调料'
      });
    });
  }
  // 如果云端已有 ingredients 字段则直接使用
  if (ingredients.length === 0 && Array.isArray(cloudRecipe.ingredients)) {
    ingredients = cloudRecipe.ingredients;
  }
  recipe.ingredients = ingredients;

  // 标准化步骤
  if (Array.isArray(cloudRecipe.steps)) {
    recipe.steps = cloudRecipe.steps.map(function(step) {
      return recipeSchema.normalizeStep({
        action: step.action || (step.step_type === 'prep' ? 'prep' : 'cook'),
        text: step.text || '',
        step_type: step.step_type,
        duration_num: step.duration_num || step.duration_minutes,
        step_image_url: step.step_image_url
      });
    });
  } else {
    recipe.steps = [];
  }

  return recipe;
}

/**
 * 从云数据库拉取菜谱
 * @param {String} type - 'adult' | 'baby'
 * @param {Date} lastSyncTime - 上次同步时间（可选，用于增量更新）
 * @returns {Promise<Array>} 菜谱数组
 */
function fetchRecipesFromCloud(type, lastSyncTime) {
  return new Promise(function(resolve, reject) {
    var db = getCloudDb();
    if (!db) {
      reject(new Error('云数据库不可用'));
      return;
    }

    var collection = db.collection('recipes');
    var query = collection.where({
      type: type || 'adult'
    });

    // 增量更新：只拉取 updateTime 大于上次同步时间的记录
    if (lastSyncTime && lastSyncTime instanceof Date) {
      query = collection.where({
        type: type || 'adult',
        updateTime: db.command.gt(lastSyncTime)
      });
    }

    // 云数据库单次最多返回 100 条，需要分页
    var allRecipes = [];
    var pageSize = 100;

    function fetchPage(skip) {
      query.skip(skip).limit(pageSize).get().then(function(res) {
        var data = res.data || [];
        allRecipes = allRecipes.concat(data);
        
        if (data.length === pageSize) {
          // 可能还有更多数据，继续拉取
          fetchPage(skip + pageSize);
        } else {
          // 数据拉取完成
          resolve(allRecipes);
        }
      }).catch(function(err) {
        // 集合不存在等错误，返回空数组
        if (err.errCode === -1 || (err.errMsg && err.errMsg.indexOf('collection') !== -1)) {
          resolve([]);
        } else {
          reject(err);
        }
      });
    }

    fetchPage(0);
  });
}

/**
 * 从本地存储读取缓存的菜谱
 * @param {String} type - 'adult' | 'baby'
 * @returns {Array} 菜谱数组
 */
function loadFromStorage(type) {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return [];
  
  try {
    var key = type === 'baby' ? STORAGE_KEY_BABY : STORAGE_KEY_ADULT;
    var data = wx.getStorageSync(key);
    if (data && typeof data === 'string') {
      return JSON.parse(data);
    }
    if (Array.isArray(data)) {
      return data;
    }
  } catch (e) {
    console.warn('[cloudRecipeService] loadFromStorage error:', e);
  }
  return [];
}

/**
 * 将菜谱保存到本地存储
 * @param {String} type - 'adult' | 'baby'
 * @param {Array} recipes - 菜谱数组
 */
function saveToStorage(type, recipes) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) return;
  
  try {
    var key = type === 'baby' ? STORAGE_KEY_BABY : STORAGE_KEY_ADULT;
    wx.setStorageSync(key, JSON.stringify(recipes));
  } catch (e) {
    console.warn('[cloudRecipeService] saveToStorage error:', e);
  }
}

/**
 * 获取上次同步时间
 * @returns {Date|null}
 */
function getLastSyncTime() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return null;
  
  try {
    var timeStr = wx.getStorageSync(STORAGE_KEY_LAST_SYNC);
    if (timeStr) {
      return new Date(timeStr);
    }
  } catch (e) {}
  return null;
}

/**
 * 保存同步时间
 * @param {Date} time
 */
function saveLastSyncTime(time) {
  if (typeof wx === 'undefined' || !wx.setStorageSync) return;
  
  try {
    wx.setStorageSync(STORAGE_KEY_LAST_SYNC, time.toISOString());
  } catch (e) {}
}

/**
 * 检查缓存版本是否需要更新
 * @returns {Boolean}
 */
function needsCacheRefresh() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return false;
  
  try {
    var version = wx.getStorageSync(STORAGE_KEY_VERSION);
    return version !== CURRENT_CACHE_VERSION;
  } catch (e) {
    return true;
  }
}

/**
 * 保存缓存版本号
 */
function saveCacheVersion() {
  if (typeof wx === 'undefined' || !wx.setStorageSync) return;
  
  try {
    wx.setStorageSync(STORAGE_KEY_VERSION, CURRENT_CACHE_VERSION);
  } catch (e) {}
}

/**
 * 合并本地缓存与云端增量数据
 * @param {Array} localRecipes - 本地缓存
 * @param {Array} cloudRecipes - 云端新数据
 * @returns {Array} 合并后的菜谱数组
 */
function mergeRecipes(localRecipes, cloudRecipes) {
  if (!Array.isArray(cloudRecipes) || cloudRecipes.length === 0) {
    return localRecipes || [];
  }
  
  var local = Array.isArray(localRecipes) ? localRecipes : [];
  var idMap = {};
  
  // 以 id 为 key 建立索引
  local.forEach(function(recipe) {
    if (recipe && recipe.id) {
      idMap[recipe.id] = recipe;
    }
  });
  
  // 用云端数据覆盖或追加
  cloudRecipes.forEach(function(cloudRecipe) {
    var normalized = normalizeCloudRecipe(cloudRecipe);
    if (normalized && normalized.id) {
      idMap[normalized.id] = normalized;
    }
  });
  
  // 转回数组
  var result = [];
  for (var id in idMap) {
    if (idMap.hasOwnProperty(id)) {
      result.push(idMap[id]);
    }
  }
  
  return result;
}

/**
 * 执行云端同步
 * @param {Object} options
 * @param {Boolean} options.forceRefresh - 是否强制全量刷新
 * @param {Function} options.onProgress - 进度回调
 * @returns {Promise<{ adultCount: number, babyCount: number, fromCloud: boolean }>}
 */
function syncFromCloud(options) {
  options = options || {};
  var forceRefresh = options.forceRefresh === true || needsCacheRefresh();
  
  if (_syncState.syncing) {
    return Promise.resolve({ adultCount: 0, babyCount: 0, fromCloud: false, message: '同步进行中' });
  }
  
  _syncState.syncing = true;
  _syncState.lastError = null;

  var lastSyncTime = forceRefresh ? null : getLastSyncTime();
  var syncTime = new Date();

  return Promise.all([
    fetchRecipesFromCloud('adult', lastSyncTime),
    fetchRecipesFromCloud('baby', lastSyncTime)
  ]).then(function(results) {
    var cloudAdult = results[0] || [];
    var cloudBaby = results[1] || [];
    
    // 加载本地缓存
    var localAdult = forceRefresh ? [] : loadFromStorage('adult');
    var localBaby = forceRefresh ? [] : loadFromStorage('baby');
    
    // 合并数据
    var mergedAdult = mergeRecipes(localAdult, cloudAdult);
    var mergedBaby = mergeRecipes(localBaby, cloudBaby);
    
    // 保存到本地
    if (mergedAdult.length > 0) {
      saveToStorage('adult', mergedAdult);
    }
    if (mergedBaby.length > 0) {
      saveToStorage('baby', mergedBaby);
    }
    
    // 更新内存缓存
    if (mergedAdult.length > 0) {
      _memoryCache.adultRecipes = mergedAdult;
    }
    if (mergedBaby.length > 0) {
      _memoryCache.babyRecipes = mergedBaby;
    }
    _memoryCache.lastSync = syncTime;
    
    // 保存同步时间和版本
    saveLastSyncTime(syncTime);
    saveCacheVersion();
    
    _syncState.syncing = false;
    _syncState.syncCount++;
    
    var fromCloud = cloudAdult.length > 0 || cloudBaby.length > 0;
    
    console.log('[cloudRecipeService] 同步完成', {
      cloudAdult: cloudAdult.length,
      cloudBaby: cloudBaby.length,
      mergedAdult: mergedAdult.length,
      mergedBaby: mergedBaby.length,
      fromCloud: fromCloud
    });
    
    return {
      adultCount: mergedAdult.length,
      babyCount: mergedBaby.length,
      fromCloud: fromCloud,
      newAdult: cloudAdult.length,
      newBaby: cloudBaby.length
    };
  }).catch(function(err) {
    _syncState.syncing = false;
    _syncState.lastError = err;
    
    console.warn('[cloudRecipeService] 同步失败，使用本地缓存:', err);
    
    // 同步失败时，尝试加载本地缓存
    var localAdult = loadFromStorage('adult');
    var localBaby = loadFromStorage('baby');
    
    if (localAdult.length > 0) {
      _memoryCache.adultRecipes = localAdult;
    }
    if (localBaby.length > 0) {
      _memoryCache.babyRecipes = localBaby;
    }
    
    return {
      adultCount: localAdult.length,
      babyCount: localBaby.length,
      fromCloud: false,
      error: err.message || '同步失败'
    };
  });
}

/**
 * 获取大人菜谱列表
 * 优先返回云端/缓存数据，无数据时降级到本地 recipes.js
 * @returns {Array}
 */
function getAdultRecipes() {
  // 优先返回内存缓存
  if (_memoryCache.adultRecipes && _memoryCache.adultRecipes.length > 0) {
    return _memoryCache.adultRecipes;
  }
  
  // 尝试从本地存储加载
  var cached = loadFromStorage('adult');
  if (cached && cached.length > 0) {
    _memoryCache.adultRecipes = cached;
    return cached;
  }
  
  // 降级到本地 recipes.js
  try {
    var localRecipes = require('../data/recipes.js');
    return localRecipes.adultRecipes || [];
  } catch (e) {
    return [];
  }
}

/**
 * 获取宝宝菜谱列表
 * 优先返回云端/缓存数据，无数据时降级到本地 recipes.js
 * @returns {Array}
 */
function getBabyRecipes() {
  // 优先返回内存缓存
  if (_memoryCache.babyRecipes && _memoryCache.babyRecipes.length > 0) {
    return _memoryCache.babyRecipes;
  }
  
  // 尝试从本地存储加载
  var cached = loadFromStorage('baby');
  if (cached && cached.length > 0) {
    _memoryCache.babyRecipes = cached;
    return cached;
  }
  
  // 降级到本地 recipes.js
  try {
    var localRecipes = require('../data/recipes.js');
    return localRecipes.babyRecipes || [];
  } catch (e) {
    return [];
  }
}

/**
 * 根据 ID 获取大人菜谱
 * @param {String} id
 * @returns {Object|null}
 */
function getAdultRecipeById(id) {
  if (!id) return null;
  var recipes = getAdultRecipes();
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i] && recipes[i].id === id) {
      return recipes[i];
    }
  }
  return null;
}

/**
 * 根据 ID 获取宝宝菜谱
 * @param {String} id
 * @returns {Object|null}
 */
function getBabyRecipeById(id) {
  if (!id) return null;
  var recipes = getBabyRecipes();
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i] && recipes[i].id === id) {
      return recipes[i];
    }
  }
  return null;
}

/**
 * 初始化云端菜谱服务
 * 在 app.js onLaunch 中调用
 * @param {Object} options
 * @param {Boolean} options.autoSync - 是否自动同步（默认 true）
 * @param {Boolean} options.forceRefresh - 是否强制刷新缓存
 * @returns {Promise}
 */
function init(options) {
  options = options || {};
  var autoSync = options.autoSync !== false;
  
  if (_memoryCache.initialized) {
    return Promise.resolve({ initialized: true, cached: true });
  }
  
  // 先从本地缓存加载（快速启动）
  var localAdult = loadFromStorage('adult');
  var localBaby = loadFromStorage('baby');
  
  if (localAdult.length > 0) {
    _memoryCache.adultRecipes = localAdult;
  }
  if (localBaby.length > 0) {
    _memoryCache.babyRecipes = localBaby;
  }
  
  _memoryCache.initialized = true;
  
  // 异步从云端同步（不阻塞启动）
  if (autoSync) {
    // 使用 setTimeout 确保不阻塞主线程
    setTimeout(function() {
      syncFromCloud({ forceRefresh: options.forceRefresh }).then(function(result) {
        console.log('[cloudRecipeService] 后台同步完成:', result);
      }).catch(function(err) {
        console.warn('[cloudRecipeService] 后台同步失败:', err);
      });
    }, 1000); // 延迟 1 秒开始同步，避免与其他启动任务竞争
  }
  
  return Promise.resolve({
    initialized: true,
    localAdultCount: localAdult.length,
    localBabyCount: localBaby.length
  });
}

/**
 * 获取同步状态
 * @returns {Object}
 */
function getSyncState() {
  return {
    syncing: _syncState.syncing,
    lastError: _syncState.lastError,
    syncCount: _syncState.syncCount,
    lastSync: _memoryCache.lastSync,
    adultCount: (_memoryCache.adultRecipes || []).length,
    babyCount: (_memoryCache.babyRecipes || []).length
  };
}

/**
 * 清除本地缓存（调试用）
 */
function clearCache() {
  if (typeof wx === 'undefined' || !wx.removeStorageSync) return;
  
  try {
    wx.removeStorageSync(STORAGE_KEY_ADULT);
    wx.removeStorageSync(STORAGE_KEY_BABY);
    wx.removeStorageSync(STORAGE_KEY_LAST_SYNC);
    wx.removeStorageSync(STORAGE_KEY_VERSION);
    
    _memoryCache.adultRecipes = null;
    _memoryCache.babyRecipes = null;
    _memoryCache.lastSync = null;
    _memoryCache.initialized = false;
    
    console.log('[cloudRecipeService] 缓存已清除');
  } catch (e) {
    console.warn('[cloudRecipeService] clearCache error:', e);
  }
}

/**
 * 检查是否有云端数据可用
 * @returns {Boolean}
 */
function hasCloudData() {
  var adult = getAdultRecipes();
  var baby = getBabyRecipes();
  
  // 检查是否有来自云端的数据（云端数据通常有 _id 字段）
  var hasCloudAdult = adult.some(function(r) { return r && r._id; });
  var hasCloudBaby = baby.some(function(r) { return r && r._id; });
  
  return hasCloudAdult || hasCloudBaby;
}

module.exports = {
  // 初始化与同步
  init: init,
  syncFromCloud: syncFromCloud,
  
  // 数据获取
  getAdultRecipes: getAdultRecipes,
  getBabyRecipes: getBabyRecipes,
  getAdultRecipeById: getAdultRecipeById,
  getBabyRecipeById: getBabyRecipeById,
  
  // 状态查询
  getSyncState: getSyncState,
  hasCloudData: hasCloudData,
  
  // 调试工具
  clearCache: clearCache,
  
  // 内部工具函数（供测试使用）
  normalizeCloudRecipe: normalizeCloudRecipe,
  mergeRecipes: mergeRecipes
};
