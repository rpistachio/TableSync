// cloudfunctions/fridgeScan/lib/kimi-client.js
// Kimi（月之暗面）OpenAI 兼容接口封装，用于 Vision 识图与文本组餐

const https = require('https');

const API_HOST = 'api.moonshot.cn';
const API_PATH = '/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * 调用 Kimi Chat Completions API（OpenAI 兼容格式）
 * @param {Object} params
 * @param {string} params.apiKey   - Moonshot API Key（Bearer）
 * @param {string} params.model    - 如 moonshot-v1-8k-vision-preview / moonshot-v1-8k
 * @param {Array}  params.messages  - [{ role: 'system'|'user'|'assistant', content: string | Array }]
 * @param {number} [params.max_tokens=2048]
 * @param {number} [params.temperature=0.3]
 * @returns {Promise<{ text: string }>}
 */
function callChatCompletions({ apiKey, model, messages, max_tokens = 2048, temperature = 0.3 }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      max_tokens,
      temperature,
    });

    const options = {
      hostname: API_HOST,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
      timeout: DEFAULT_TIMEOUT_MS,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          const err = new Error(`Kimi API ${res.statusCode}: ${raw.slice(0, 300)}`);
          err.statusCode = res.statusCode;
          reject(err);
          return;
        }
        try {
          const data = JSON.parse(raw);
          const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (text == null) {
            reject(new Error(`Kimi API 返回格式异常: ${raw.slice(0, 200)}`));
            return;
          }
          resolve({ text });
        } catch (e) {
          reject(new Error(`Kimi API 解析失败: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Kimi API 请求超时'));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { callChatCompletions };
