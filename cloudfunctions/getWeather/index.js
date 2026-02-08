// cloudfunctions/getWeather/index.js
// 根据经纬度获取实时天气（和风天气 API），避免在客户端暴露 Key

const https = require('https');

const QWEATHER_HOST = 'devapi.qweather.com';
const CACHE_TTL_MS = 30 * 60 * 1000;

let SECRET_CONFIG = {};
try {
  SECRET_CONFIG = require('./secret-config.json');
} catch (_) {}

function getConfig(key) {
  const raw = SECRET_CONFIG[key] || process.env[key] || '';
  return typeof raw === 'string' ? raw.trim() : raw;
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://${QWEATHER_HOST}${path}`,
      { timeout: 8000 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
  });
}

/**
 * 云函数入口
 * event: { lat: number, lng: number }
 * 返回: { code, data?: { temp, text, city, fullText }, message? }
 */
exports.main = async (event, context) => {
  const key = getConfig('QWEATHER_KEY');
  if (!key) {
    return { code: 0, data: null, message: 'QWEATHER_KEY 未配置' };
  }

  const lat = event.lat;
  const lng = event.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { code: 400, data: null, message: '请提供 lat、lng' };
  }

  const location = `${lng},${lat}`;

  try {
    const nowRes = await get(`/v7/weather/now?location=${location}&key=${key}`);
    if (nowRes.code !== '200' || !nowRes.now) {
      return { code: 500, data: null, message: nowRes.code || '天气接口异常' };
    }

    const now = nowRes.now;
    const temp = now.temp != null ? String(now.temp) : '';
    const text = now.text || '';

    const data = {
      temp: temp,
      text: text,
      fullText: temp && text ? `${text} ${temp}°C` : text || temp || ''
    };

    return { code: 0, data };
  } catch (err) {
    console.error('[getWeather]', err);
    return { code: 500, data: null, message: err.message || '网络异常' };
  }
};
