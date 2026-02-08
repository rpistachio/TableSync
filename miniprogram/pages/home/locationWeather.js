/**
 * 位置与天气工具（带缓存）- 首页用，与 utils/locationWeather 逻辑一致
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

function getWeather() {
  var cached = _getCache(WEATHER_CACHE_KEY, WEATHER_CACHE_TTL_MS);
  if (cached) return Promise.resolve(cached);
  return getLocation().then(function (loc) {
    if (!loc) return null;
    return new Promise(function (resolve) {
      wx.cloud.callFunction({
        name: 'getWeather',
        data: { lat: loc.latitude, lng: loc.longitude }
      }).then(function (res) {
        var out = res.result;
        var result = (out && out.code === 0 && out.data) ? out.data : null;
        if (result) _setCache(WEATHER_CACHE_KEY, result, WEATHER_CACHE_TTL_MS);
        resolve(result);
      }).catch(function () {
        resolve(null);
      });
    });
  });
}

module.exports = {
  getLocation: getLocation,
  getWeather: getWeather
};
