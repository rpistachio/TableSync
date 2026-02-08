/**
 * 位置与天气工具（带缓存）
 * - 位置缓存 1 小时
 * - 天气缓存 30 分钟（由云函数 getWeather 返回后写入）
 */

var LOCATION_CACHE_KEY = 'location_weather_location_cache';
var LOCATION_CACHE_TTL_MS = 60 * 60 * 1000;
var WEATHER_CACHE_KEY = 'location_weather_weather_cache';
var WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

function _getCache(key, ttlMs) {
  try {
    var raw = wx.getStorageSync(key);
    if (!raw) return null;
    var obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || obj.expireAt == null) return null;
    if (Date.now() > obj.expireAt) return null;
    return obj.data;
  } catch (e) {
    return null;
  }
}

function _setCache(key, data, ttlMs) {
  try {
    wx.setStorageSync(key, JSON.stringify({
      data: data,
      expireAt: Date.now() + ttlMs
    }));
  } catch (e) {}
}

/**
 * 获取当前经纬度（先读缓存，无缓存再调 wx.getLocation）
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
function getLocation() {
  var cached = _getCache(LOCATION_CACHE_KEY, LOCATION_CACHE_TTL_MS);
  if (cached && typeof cached.latitude === 'number' && typeof cached.longitude === 'number') {
    return Promise.resolve(cached);
  }
  return new Promise(function (resolve) {
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        var data = { latitude: res.latitude, longitude: res.longitude };
        _setCache(LOCATION_CACHE_KEY, data, LOCATION_CACHE_TTL_MS);
        resolve(data);
      },
      fail: function () {
        resolve(null);
      }
    });
  });
}

/**
 * 获取天气信息：先读缓存，无缓存则取位置并调用云函数 getWeather
 * @returns {Promise<{temp: string, text: string, city?: string, fullText?: string} | null>}
 */
function getWeather() {
  var cached = _getCache(WEATHER_CACHE_KEY, WEATHER_CACHE_TTL_MS);
  if (cached) {
    return Promise.resolve(cached);
  }
  return getLocation().then(function (loc) {
    if (!loc) return null;
    return new Promise(function (resolve) {
      wx.cloud.callFunction({
        name: 'getWeather',
        data: { lat: loc.latitude, lng: loc.longitude }
      }).then(function (res) {
        var out = res.result;
        var result = (out && out.code === 0 && out.data) ? out.data : null;
        if (result) {
          _setCache(WEATHER_CACHE_KEY, result, WEATHER_CACHE_TTL_MS);
        }
        resolve(result);
      }).catch(function () {
        resolve(null);
      });
    });
  });
}

/**
 * 获取逆地理编码后的地址摘要（如「杭州西湖区」）
 * 可由云函数 getWeather 一并返回，或单独云函数；此处先返回空，Phase 2 上下文条用 location 占位
 * @returns {Promise<string>}
 */
function getLocationSummary() {
  var cached = _getCache(LOCATION_CACHE_KEY, LOCATION_CACHE_TTL_MS);
  if (cached && cached.city) return Promise.resolve(cached.city);
  return getWeather().then(function (w) {
    return (w && w.city) ? w.city : '';
  });
}

module.exports = {
  getLocation: getLocation,
  getWeather: getWeather,
  getLocationSummary: getLocationSummary
};
