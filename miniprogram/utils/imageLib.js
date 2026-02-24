// miniprogram/utils/imageLib.js
// 图片“过滤器”：找不到图时返回默认图，避免页面白屏或报错

const { IMAGE_CONFIG } = require('../data/recipeResources.js');
const recipeCoverSlugs = require('../data/recipeCoverSlugs.js');

// cloud://fileID -> https 临时链接缓存（避免重复请求）
const _tempUrlCache = Object.create(null);

function _isCloudFileId(url) {
  return typeof url === 'string' && url.indexOf('cloud://') === 0;
}

/**
 * 根据菜名和类型返回菜谱封面图 URL，无匹配时返回默认图
 * 成人菜与 recipeCoverSlugs 保持一致（下划线+扩展名），避免 404
 * @param {string} name - 菜名（中文）
 * @param {string} type - 'adult' | 'baby'
 * @returns {string} 云存储图片 URL
 */
function getRecipeImage(name, type) {
  type = type || 'adult';
  if (!name) return IMAGE_CONFIG.defaultCover;

  if (type === 'adult') {
    // 与 recipeCoverSlugs 统一：文件名含扩展名，与云存储一致
    const fileName = recipeCoverSlugs.getCoverSlug(name);
    if (fileName && fileName !== recipeCoverSlugs.DEFAULT_COVER_SLUG) {
      return IMAGE_CONFIG.folders.adults + fileName;
    }
    return IMAGE_CONFIG.defaultCover;
  }

  const folder = IMAGE_CONFIG.folders.babies;
  const slug = name; // 宝宝餐目前简单匹配
  if (slug) {
    return `${folder}${slug}.jpg`;
  }
  return IMAGE_CONFIG.defaultCover;
}

/**
 * 获取页面固定头图 URL
 * @param {string} page - 页面标识，如 'shopping' | 'prep'
 * @returns {string} 云存储图片 URL
 */
function getPageCover(page) {
  return IMAGE_CONFIG.pageCovers[page] || IMAGE_CONFIG.defaultCover;
}

/**
 * 把 cloud:// fileID 解析成可直接渲染的临时 https URL
 * - 非 cloud:// 直接透传
 * - 失败时回退为 defaultCover（或透传原值）
 * @param {string} url
 * @param {(err: any, resolvedUrl: string) => void} cb
 */
function resolveImageUrl(url, cb) {
  if (typeof cb !== 'function') return;
  if (!url || typeof url !== 'string') return cb(null, IMAGE_CONFIG.defaultCover);

  if (!_isCloudFileId(url)) return cb(null, url);

  if (_tempUrlCache[url]) return cb(null, _tempUrlCache[url]);

  if (!wx || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
    // 没有云能力时，避免把 cloud:// 交给渲染层导致 /pages/xxx/cloud://... 500
    return cb(new Error('wx.cloud.getTempFileURL not available'), IMAGE_CONFIG.defaultCover);
  }

  wx.cloud.getTempFileURL({
    fileList: [url],
    success: function (res) {
      try {
        var list = res && res.fileList ? res.fileList : [];
        var temp = list[0] && list[0].tempFileURL;
        if (temp) {
          _tempUrlCache[url] = temp;
          cb(null, temp);
        } else {
          cb(new Error('tempFileURL missing'), IMAGE_CONFIG.defaultCover);
        }
      } catch (e) {
        cb(e, IMAGE_CONFIG.defaultCover);
      }
    },
    fail: function (err) {
      cb(err, IMAGE_CONFIG.defaultCover);
    }
  });
}

/**
 * 批量解析 cloud:// fileID（会去重 & 缓存）
 * @param {string[]} urls
 * @param {(resultMap: Record<string, string>) => void} cb  返回 { 原fileID: tempUrl }
 */
function resolveImageUrls(urls, cb) {
  if (typeof cb !== 'function') return;
  if (!Array.isArray(urls) || urls.length === 0) return cb({});

  var unique = [];
  var seen = Object.create(null);
  for (var i = 0; i < urls.length; i++) {
    var u = urls[i];
    if (!_isCloudFileId(u)) continue;
    if (_tempUrlCache[u]) continue;
    if (seen[u]) continue;
    seen[u] = true;
    unique.push(u);
  }

  // 都在缓存里 or 不需要解析
  if (unique.length === 0) {
    var map = {};
    for (var j = 0; j < urls.length; j++) {
      var u2 = urls[j];
      if (_tempUrlCache[u2]) map[u2] = _tempUrlCache[u2];
    }
    return cb(map);
  }

  if (!wx || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
    return cb({});
  }

  wx.cloud.getTempFileURL({
    fileList: unique,
    success: function (res) {
      var map = {};
      try {
        var list = res && res.fileList ? res.fileList : [];
        for (var k = 0; k < list.length; k++) {
          var item = list[k];
          if (item && item.fileID && item.tempFileURL) {
            _tempUrlCache[item.fileID] = item.tempFileURL;
            map[item.fileID] = item.tempFileURL;
          }
        }
      } catch (e) {
        // ignore
      }
      cb(map);
    },
    fail: function () {
      cb({});
    }
  });
}

/**
 * 查询全局缓存中某个 cloud:// fileID 对应的临时 URL
 * @param {string} cloudId
 * @returns {string} 临时 URL，未缓存则返回 ''
 */
function getCachedTempUrl(cloudId) {
  return (cloudId && _tempUrlCache[cloudId]) || '';
}

/**
 * 向全局缓存写入 cloud:// fileID -> 临时 URL 映射
 * @param {string} cloudId
 * @param {string} tempUrl
 */
function putCachedTempUrl(cloudId, tempUrl) {
  if (cloudId && tempUrl) _tempUrlCache[cloudId] = tempUrl;
}

/**
 * 批量向全局缓存写入映射（用于外部页面解析完后回写）
 * @param {Record<string, string>} map  { cloudId: tempUrl }
 */
function putCachedTempUrls(map) {
  if (!map || typeof map !== 'object') return;
  for (var key in map) {
    if (map.hasOwnProperty(key) && map[key]) {
      _tempUrlCache[key] = map[key];
    }
  }
}

/**
 * 批量解析 cloud:// fileID（自动查缓存 + 去重 + 分批 50 个 + 回写缓存）
 * @param {string[]} cloudIds - cloud:// fileID 数组
 * @param {(resultMap: Record<string, string>) => void} cb - 返回全部（含缓存命中的）映射
 */
function batchResolveTempUrls(cloudIds, cb) {
  if (typeof cb !== 'function') return;
  if (!Array.isArray(cloudIds) || cloudIds.length === 0) return cb({});

  var resultMap = {};
  var needResolve = [];
  var seen = Object.create(null);

  for (var i = 0; i < cloudIds.length; i++) {
    var id = cloudIds[i];
    if (!id || typeof id !== 'string' || id.indexOf('cloud://') !== 0) continue;
    if (seen[id]) continue;
    seen[id] = true;
    if (_tempUrlCache[id]) {
      resultMap[id] = _tempUrlCache[id];
    } else {
      needResolve.push(id);
    }
  }

  if (needResolve.length === 0) return cb(resultMap);
  if (!wx || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return cb(resultMap);

  var BATCH = 50;
  var batches = [];
  for (var b = 0; b < needResolve.length; b += BATCH) {
    batches.push(needResolve.slice(b, b + BATCH));
  }

  function runBatch(idx) {
    if (idx >= batches.length) {
      cb(resultMap);
      return;
    }
    wx.cloud.getTempFileURL({
      fileList: batches[idx],
      success: function (res) {
        var list = (res && res.fileList) || [];
        for (var k = 0; k < list.length; k++) {
          var it = list[k] || {};
          if (it.fileID && it.tempFileURL) {
            _tempUrlCache[it.fileID] = it.tempFileURL;
            resultMap[it.fileID] = it.tempFileURL;
          }
        }
      },
      complete: function () {
        runBatch(idx + 1);
      }
    });
  }
  runBatch(0);
}

module.exports = {
  getRecipeImage: getRecipeImage,
  getPageCover: getPageCover,
  resolveImageUrl: resolveImageUrl,
  resolveImageUrls: resolveImageUrls,
  getCachedTempUrl: getCachedTempUrl,
  putCachedTempUrl: putCachedTempUrl,
  putCachedTempUrls: putCachedTempUrls,
  batchResolveTempUrls: batchResolveTempUrls
};
