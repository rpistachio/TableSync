// cloudfunctions/recipeCoverGen/lib/minimax-image.js
// 调用 MiniMax 文生图 API（image-01），同一套「暗调高级感」prompt，返回 Buffer

const https = require('https');

function requestWithAuth(apiKey, body, useBearer, resolve, reject) {
  const authHeader = useBearer ? `Bearer ${apiKey}` : apiKey;
  const req = https.request(
    {
      hostname: 'api.minimaxi.com',
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
            if (!useBearer && /secret key|Authorization|未授权|1004/i.test(msg)) {
              reject(new Error(msg + '（请确认使用「按量付费」创建的 API Key，且复制完整无空格）'));
              return;
            }
            if (useBearer && /secret key|Authorization|请携带/i.test(msg)) {
              requestWithAuth(apiKey, body, false, resolve, reject);
              return;
            }
            reject(new Error(msg || 'MiniMax API error'));
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
}

/**
 * 调用 MiniMax 生成图片
 * @param {string} apiKey - MINIMAX_API_KEY（按量付费创建的完整 Key）
 * @param {string} prompt - 英文 prompt
 * @returns {Promise<Buffer>} 图片 buffer（JPEG）
 */
function generateImage(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    if (!apiKey || !apiKey.trim()) {
      reject(new Error('MINIMAX_API_KEY 为空，请在 secret-config.json 中配置完整的 API Key'));
      return;
    }
    const key = apiKey.trim();
    const body = JSON.stringify({
      model: 'image-01',
      prompt: prompt.slice(0, 1500),
      aspect_ratio: '1:1',
      response_format: 'base64',
      n: 1,
      prompt_optimizer: false,
    });
    requestWithAuth(key, body, true, resolve, reject);
  });
}

module.exports = { generateImage };
