// tools/lib/minimax-image.js
// 调用 MiniMax 文生图 API（image-01），使用与 MJ 风格一致的 prompt，返回 Buffer

import https from 'https';

const DEFAULT_HOST = 'api.minimaxi.com';

function request(apiKey, body, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const useBearer = true;
  const authHeader = useBearer ? `Bearer ${apiKey}` : apiKey;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: '/v1/image_generation',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const baseResp = json.base_resp || {};
            if (baseResp.status_code !== 0 && baseResp.status_code !== undefined) {
              const msg = baseResp.status_msg || '';
              const codeSuffix = baseResp.status_code != null ? ` [code=${baseResp.status_code}]` : '';
              if (!useBearer && /secret key|Authorization|未授权|1004|invalid api key/i.test(msg)) {
                reject(new Error(msg + codeSuffix + '（请确认使用「按量付费」创建的 API Key，且复制完整无空格；若用国际站请在 tools/.env 或 secret-config.json 中设置 MINIMAX_HOST=api.minimax.io）'));
                return;
              }
              if (useBearer && /secret key|Authorization|请携带/i.test(msg)) {
                request(apiKey, body, { ...options }).then(resolve).catch(reject);
                return;
              }
              reject(new Error((msg || 'MiniMax API error') + codeSuffix));
              return;
            }
            const list = json.data && (json.data.image_base64 || json.data.image_base64_list);
            const b64 = Array.isArray(list) ? list[0] : (json.data && json.data.image_base64);
            if (!b64) {
              reject(new Error('No image data in response'));
              return;
            }
            resolve(Buffer.from(b64, 'base64'));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 调用 MiniMax 文生图（与云函数 recipeCoverGen 同一套 API）
 * @param {string} apiKey - MINIMAX_API_KEY（按量付费创建的完整 Key）
 * @param {string} prompt - 英文 prompt（MJ 风格，如 Krautkopf style, professional food photography...）
 * @param {{ host?: string, model?: string, referenceImageUrl?: string }} [options] - 可选 host、model；referenceImageUrl 为参考图公网 URL 时走图生图
 * @returns {Promise<Buffer>} 图片 buffer（JPEG）
 */
export function generateImage(apiKey, prompt, options = {}) {
  if (!apiKey || !apiKey.trim()) {
    return Promise.reject(new Error('MINIMAX_API_KEY 为空，请在 tools/.env 中配置 MINIMAX_API_KEY'));
  }
  const key = apiKey.trim();
  const model = (options.model || 'image-01').trim() || 'image-01';
  const payload = {
    model,
    prompt: prompt.slice(0, 1500),
    aspect_ratio: '1:1',
    response_format: 'base64',
    n: 1,
    prompt_optimizer: false,
  };
  const refUrl = (options.referenceImageUrl || '').trim();
  if (refUrl) {
    payload.subject_reference = [{ type: 'character', image_file: refUrl }];
  }
  const body = JSON.stringify(payload);
  return request(key, body, options);
}
