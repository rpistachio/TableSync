// cloudfunctions/recipeCoverGen/lib/openai-image.js
// 调用 OpenAI Images API（DALL·E 2）生成图片，返回 Buffer

const https = require('https');

/**
 * 调用 OpenAI 生成图片
 * @param {string} apiKey - OPENAI_API_KEY
 * @param {string} prompt - 英文 prompt
 * @returns {Promise<Buffer>} 图片 buffer（PNG）
 */
function generateImage(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-2',
      prompt: prompt.slice(0, 1000),
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'OpenAI API error'));
              return;
            }
            const b64 = json.data && json.data[0] && json.data[0].b64_json;
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
