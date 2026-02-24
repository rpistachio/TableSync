// cloudfunctions/recipeImport/lib/kimi.js
// Kimi（月之暗面）OpenAI 兼容接口封装

const https = require('https');

const API_HOST = 'api.moonshot.cn';
const API_PATH = '/v1/chat/completions';

/**
 * 调用 Kimi chat/completions 接口
 * @param {Object} opts
 * @param {string} opts.apiKey - Moonshot API Key
 * @param {string} opts.model - 如 moonshot-v1-8k-vision-preview / moonshot-v1-8k
 * @param {Array} opts.messages - [{ role, content }]，content 可为 string 或 array（多模态）
 * @param {number} [opts.max_tokens=4096]
 * @param {number} [opts.temperature=0.3]
 * @returns {Promise<string>} 助手回复文本
 */
function chat(opts) {
  const { apiKey, model, messages, max_tokens = 4096, temperature = 0.3 } = opts;
  if (!apiKey || !model || !messages || !messages.length) {
    return Promise.reject(new Error('[Kimi] apiKey、model、messages 必填'));
  }
  const cleanKey = String(apiKey).trim().replace(/\s+/g, '');

  const body = JSON.stringify({
    model,
    messages,
    max_tokens,
    temperature,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path: API_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
        timeout: 45000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            reject(new Error(`${res.statusCode} ${raw}`));
            return;
          }
          try {
            const data = JSON.parse(raw);
            const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (text == null) {
              reject(new Error('[Kimi] 响应无 content: ' + raw.slice(0, 300)));
              return;
            }
            resolve(String(text));
          } catch (e) {
            reject(new Error('[Kimi] 解析响应失败: ' + e.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('[Kimi] 请求超时'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = { chat };
