// smartMenuGen/lib/kimi.js
// Kimi (月之暗面) 文本模型封装 — 支持联网搜索 (web_search)

const https = require('https');

const API_HOST = 'api.moonshot.cn';
const API_PATH = '/v1/chat/completions';

/**
 * 调用 Kimi Chat Completions API
 *
 * @param {Object} opts
 * @param {string} opts.apiKey        - Moonshot API Key
 * @param {string} opts.model         - 模型名, 如 'moonshot-v1-8k'
 * @param {Array}  opts.messages      - 消息列表 [{ role, content }]
 * @param {number} [opts.max_tokens=2048]
 * @param {number} [opts.temperature=0.3]
 * @param {boolean} [opts.use_search=false] - 是否启用 Kimi 联网搜索能力
 * @returns {Promise<string>} AI 响应文本
 */
function chat(opts) {
  const {
    apiKey,
    model,
    messages,
    max_tokens = 2048,
    temperature = 0.3,
    use_search = false,
  } = opts;

  if (!apiKey || !model || !messages || !messages.length) {
    return Promise.reject(new Error('[Kimi] apiKey、model、messages 必填'));
  }

  const cleanKey = String(apiKey).trim().replace(/\s+/g, '');

  // 构建请求 payload
  const payload = {
    model,
    messages,
    max_tokens,
    temperature,
  };

  // 启用 Kimi 联网搜索能力
  // Kimi API 通过 builtin_function 类型的 tool 来激活内置联网搜索
  // 模型会自主决定是否执行搜索，搜索过程在服务端完成，最终返回整合后的文本
  if (use_search) {
    payload.tools = [
      {
        type: 'builtin_function',
        function: { name: 'web_search' },
      },
    ];
  }

  const body = JSON.stringify(payload);

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
        // 云函数 60s 超时，给 JSON 解析和返回留 5s buffer
        timeout: 55000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            reject(new Error(`[Kimi] HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
            return;
          }
          try {
            const data = JSON.parse(raw);
            const text =
              data.choices &&
              data.choices[0] &&
              data.choices[0].message &&
              data.choices[0].message.content;
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
      reject(new Error('[Kimi] 请求超时 (55s)'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = { chat };
