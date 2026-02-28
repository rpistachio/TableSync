// cloudfunctions/getRegionByIP/index.js
// 根据微信云函数上下文中的 CLIENTIP 调用腾讯位置服务 IP 定位，静默粗定位（无端侧授权）
// 若出现「来源IP未被授权」：控制台为该 Key 添加授权 IP（当前出口 IP）或启用 SN 校验并配置 SK。

const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

let SECRET_CONFIG = {};
try {
  SECRET_CONFIG = require('./secret-config.json');
} catch (_) {}

function getConfig(key) {
  const raw = SECRET_CONFIG[key] || process.env[key] || '';
  return typeof raw === 'string' ? raw.trim() : raw;
}

/**
 * 腾讯 WebServiceAPI GET 签名：路径 + "?" + 参数按名升序拼接 + SK，再 MD5 小写
 * 签名用原始参数值（不 urlencode），请求时再对参数做 encode
 */
function buildPathWithSig(pathname, params, sk) {
  const keys = Object.keys(params).sort();
  const queryRaw = keys.map((k) => k + '=' + params[k]).join('&');
  const sigStr = pathname + '?' + queryRaw + sk;
  const sig = crypto.createHash('md5').update(sigStr).digest('hex');
  const query = keys.map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
  return pathname + '?' + query + '&sig=' + sig;
}

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(
      'https://apis.map.qq.com' + path,
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
    ).on('error', reject);
  });
}

/**
 * 云函数入口
 * event: 无需参数，使用 wx 上下文 CLIENTIP
 * 返回: { code, data?: { city, province, district, nation }, message? }
 */
exports.main = async (event, context) => {
  const key = getConfig('TENCENT_MAP_KEY') || getConfig('QQ_MAP_KEY');
  if (!key) {
    return { code: 0, data: null, message: 'TENCENT_MAP_KEY 未配置' };
  }

  const wxCtx = cloud.getWXContext();
  const ip = wxCtx.CLIENTIP || wxCtx.CLIENTIPV6 || '';
  if (!ip) {
    return { code: 0, data: null, message: '无客户端 IP' };
  }

  const pathname = '/ws/location/v1/ip';
  const sk = getConfig('TENCENT_MAP_SK') || getConfig('QQ_MAP_SK') || '';
  let path;
  if (sk) {
    path = buildPathWithSig(pathname, { ip, key }, sk);
  } else {
    path = pathname + '?ip=' + encodeURIComponent(ip) + '&key=' + encodeURIComponent(key);
  }

  try {
    const res = await get(path);
    if (res.status !== 0 || !res.result || !res.result.ad_info) {
      return { code: 500, data: null, message: res.message || 'IP 定位异常' };
    }

    const ad = res.result.ad_info;
    const data = {
      nation: ad.nation || '',
      province: ad.province || '',
      city: ad.city || '',
      district: ad.district || ''
    };

    return { code: 0, data };
  } catch (err) {
    console.error('[getRegionByIP]', err);
    return { code: 500, data: null, message: err.message || '网络异常' };
  }
};
