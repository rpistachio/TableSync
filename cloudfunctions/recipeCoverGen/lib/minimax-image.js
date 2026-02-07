// cloudfunctions/recipeCoverGen/lib/minimax-image.js
// 调用 MiniMax 文生图 API（image-01），同一套「暗调高级感」prompt，返回 Buffer

const https = require('https');

/**
 * 调用 MiniMax 生成图片（与 DALL·E 使用相同的英文 prompt，可生成同样风格）
 * @param {string} apiKey - MINIMAX_API_KEY
 * @param {string} prompt - 英文 prompt（professional food photography, moody tones 等）
 * @returns {Promise<Buffer>} 图片 buffer（JPEG）
 */
function generateImage(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'image-01',
      prompt: prompt.slice(0, 1500),
      aspect_ratio: '1:1',
      response_format: 'base64',
      n: 1,
      prompt_optimizer: false,
    });

    const authHeader = apiKey ? `Bearer ${apiKey}` : '';
    if (!authHeader) {
      reject(new Error('MINIMAX_API_KEY 为空，请在 secret-config.json 中配置完整的 API Key'));
      return;
    }
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
              reject(new Error(baseResp.status_msg || 'MiniMax API error'));
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

module.exports = { generateImage };
