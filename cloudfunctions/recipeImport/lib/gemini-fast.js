// cloudfunctions/recipeImport/lib/gemini-fast.js
// Gemini 免费层极速解析 —— 仅提取食材和分量，支持图片 + 文本多模态

const https = require('https');

const GEMINI_HOST = 'generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.0-flash';

/** 极简 System Prompt：仅提取食材和分量 */
const FAST_SYSTEM_PROMPT = `仅提取食材和分量，以 JSON 数组形式返回，不要任何解释。
格式：{"name":"菜名","ingredients":[{"name":"食材","amount":500,"unit":"g","category":"肉类"}]}
category 只能是：肉类|蔬菜|调料|蛋类|豆制品|菌菇|海鲜|主食|乳制品|水果|干货|其他。
调料类 amount 写 0，unit 写 适量或少许。`;

/**
 * 调用 Gemini generateContent API
 * @param {Object} opts
 * @param {string} opts.apiKey - Gemini API Key
 * @param {Array<{base64: string, mediaType: string}>} [opts.images] - 图片数组（可选）
 * @param {string} [opts.text] - 文本内容（链接抓取或补充说明）
 * @returns {Promise<string>} 模型返回的文本
 */
function callGemini(opts) {
  const { apiKey, images = [], text = '' } = opts;
  if (!apiKey || !apiKey.trim()) {
    return Promise.reject(new Error('[Gemini] apiKey 为空'));
  }

  const parts = [];

  // 图片部分（最多 5 张，每张 base64 需清理前缀）
  for (let i = 0; i < Math.min(images.length, 5); i++) {
    const img = images[i];
    const mimeType = img.mediaType || 'image/jpeg';
    let data = (img.base64 || '').replace(/^data:image\/\w+;base64,/, '');
    if (data) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: data,
        },
      });
    }
  }

  // 文本部分（Gemini 要求 parts 中至少有一个 text）
  const userText = text
    ? (parts.length > 0 ? '请从图片/文本中提取菜谱食材。\n\n' : '') + text.slice(0, 8000)
    : (parts.length > 0 ? '请从图片中提取菜谱食材。' : '');
  parts.push({ text: userText || '请提取菜谱食材。' });

  if (parts.length === 0) {
    return Promise.reject(new Error('[Gemini] 未提供图片或文本'));
  }

  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: FAST_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: parts,
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      topP: 0.95,
    },
  });

  const path = `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GEMINI_HOST,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            reject(new Error(`[Gemini] ${res.statusCode} ${raw.slice(0, 300)}`));
            return;
          }
          try {
            const data = JSON.parse(raw);
            const candidate = data.candidates && data.candidates[0];
            const content = candidate && candidate.content;
            const part = content && content.parts && content.parts[0];
            const textOut = part && part.text;
            if (!textOut) {
              const reason = (candidate && candidate.finishReason) || '无 content';
              reject(new Error(`[Gemini] 无有效回复: ${reason}`));
              return;
            }
            resolve(String(textOut));
          } catch (e) {
            reject(new Error('[Gemini] 解析响应失败: ' + e.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('[Gemini] 请求超时'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 安全解析 JSON（处理 markdown 代码块等）
 */
function safeParseJson(raw) {
  let text = (raw || '').trim();
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fencedMatch) text = fencedMatch[1].trim();
  if (!text.startsWith('{')) {
    const si = text.indexOf('{');
    const ei = text.lastIndexOf('}');
    if (si !== -1 && ei > si) text = text.slice(si, ei + 1);
  }
  return JSON.parse(text);
}

/**
 * 极速解析：仅提取食材和菜名
 * @param {Object} opts
 * @param {Array<{base64: string, mediaType: string}>} [opts.images] - 图片数组
 * @param {string} [opts.text] - 文本内容（链接抓取）
 * @param {string} opts.apiKey - Gemini API Key
 * @returns {Promise<{name: string, ingredients: Array}>}
 */
async function fastParse(opts) {
  const { images = [], text = '', apiKey } = opts;
  const rawText = await callGemini({ apiKey, images, text });
  const parsed = safeParseJson(rawText);
  const name = (parsed.name || '未命名菜谱').trim();
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  return { name, ingredients };
}

module.exports = { fastParse, callGemini };
