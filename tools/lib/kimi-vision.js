/**
 * Kimi Vision ESM 封装，供 tools 下封面审核等脚本使用。
 * 复用 cloudfunctions/recipeImport/lib/kimi.js 逻辑，支持多模态（图片 + 文本）。
 */

import https from 'https';

const API_HOST = 'api.moonshot.cn';
const API_PATH = '/v1/chat/completions';

const SCORE_SYSTEM_PROMPT = `你是专业美食摄影评审，熟悉中餐视觉特质。请评估这张菜品封面图并返回严格 JSON。

评分维度（1-10 分）：
- match: 图片内容是否与菜名一致（主料、形态、品类是否对得上）
- appetizing: 是否诱人、有食欲。中餐专项：红烧/焖菜需色泽红亮、有酱香挂汁感（glistening sauce），不能发黑发灰；清蒸/小炒需颜色翠绿或清新，不能炒过头萎靡；汤类需汤色清亮或奶白自然
- style_consistency: 极简风格一致性。整体是否统一为「日食记」式极简风：背景干净（纯色或柔和渐变）、主体突出、无杂乱道具、无过度装饰；与 App 内其他封面风格一致则高分，西餐摆盘/网红滤镜/复杂布景则低分
- quality: 构图/光线/色彩是否专业，有无 AI 伪影、模糊、不自然元素
- chinese_authenticity: 中餐地道感。餐具是否中式（如白瓷盘、青瓷、中式碗盘），摆盘是否符合家常中餐风格，有无西餐化/“左宗棠鸡”式错位（如白菜粉丝煲被画成西式沙拉碗则低分）
- texture_realism: 质感真实度。芡汁是否匀整自然（不能像胶水）、有无“锅气”的视觉暗示、蛋花类是否为絮状/丝状（若被画成面条则直接低分）

计算 overall = match*0.22 + appetizing*0.22 + style_consistency*0.18 + quality*0.14 + chinese_authenticity*0.12 + texture_realism*0.12，保留一位小数。
verdict: overall >= 7 → "pass", 5 <= overall < 7 → "warn", overall < 5 → "fail"
issues: 具体问题列表（中文，数组），无问题则为空数组。

仅返回一个 JSON 对象，不要 markdown 代码块、不要其他文字。必须包含 match, appetizing, style_consistency, quality, chinese_authenticity, texture_realism, overall, verdict, issues。
格式示例：
{"match":8,"appetizing":7,"style_consistency":8,"quality":6,"chinese_authenticity":7,"texture_realism":7,"overall":7.2,"verdict":"pass","issues":[]}`;

/**
 * 调用 Kimi chat/completions（支持多模态）
 * @param {Object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {Array} opts.messages - [{ role, content }]，content 可为 string 或 array
 * @param {number} [opts.max_tokens=2048]
 * @param {number} [opts.temperature=0.2]
 * @returns {Promise<string>}
 */
export function chat(opts) {
  const { apiKey, model, messages, max_tokens = 2048, temperature = 0.2 } = opts;
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
        timeout: 60000,
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
            const text = data.choices?.[0]?.message?.content;
            if (text == null) {
              reject(new Error('[Kimi] 响应无 content: ' + raw.slice(0, 300)));
              return;
            }
            resolve(String(text).trim());
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

/**
 * 从模型回复中解析 JSON（允许被 markdown 包裹）
 * @param {string} raw
 * @returns {Object}
 */
function parseScoreJson(raw) {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('回复中未找到 JSON 对象');
  }
  return JSON.parse(jsonMatch[0]);
}

/**
 * 对一张封面图进行质量评分
 * @param {string} apiKey - Moonshot API Key
 * @param {string} imageBase64 - 图片 base64（可含或不含 data:xxx;base64, 前缀）
 * @param {string} dishName - 中文菜名
 * @param {Object} [opts]
 * @param {string} [opts.model] - Vision 模型，默认 moonshot-v1-8k-vision-preview
 * @returns {Promise<{ match: number, appetizing: number, style_consistency: number, quality: number, overall: number, verdict: string, issues: string[] }>}
 */
export async function scoreImage(apiKey, imageBase64, dishName, opts = {}) {
  const model = opts.model || 'moonshot-v1-8k-vision-preview';
  const cleanB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const imageUrl = `data:${mediaType};base64,${cleanB64}`;

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: imageUrl },
    },
    {
      type: 'text',
      text: `菜名：${dishName}\n\n请按系统指令评分，仅返回 JSON。`,
    },
  ];

  const messages = [
    { role: 'system', content: SCORE_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  const raw = await chat({ apiKey, model, messages, max_tokens: 1024, temperature: 0.2 });
  const parsed = parseScoreJson(raw);

  const match = typeof parsed.match === 'number' ? parsed.match : Number(parsed.match) || 5;
  const appetizing = typeof parsed.appetizing === 'number' ? parsed.appetizing : Number(parsed.appetizing) || 5;
  const styleConsistency = typeof parsed.style_consistency === 'number' ? parsed.style_consistency : Number(parsed.style_consistency) || 5;
  const quality = typeof parsed.quality === 'number' ? parsed.quality : Number(parsed.quality) || 5;
  const chineseAuthenticity = typeof parsed.chinese_authenticity === 'number' ? parsed.chinese_authenticity : Number(parsed.chinese_authenticity) || 5;
  const textureRealism = typeof parsed.texture_realism === 'number' ? parsed.texture_realism : Number(parsed.texture_realism) || 5;
  const overall = typeof parsed.overall === 'number' ? parsed.overall
    : match * 0.22 + appetizing * 0.22 + styleConsistency * 0.18 + quality * 0.14 + chineseAuthenticity * 0.12 + textureRealism * 0.12;
  const verdict = parsed.verdict === 'pass' || parsed.verdict === 'warn' || parsed.verdict === 'fail'
    ? parsed.verdict
    : (overall >= 7 ? 'pass' : overall >= 5 ? 'warn' : 'fail');
  const issues = Array.isArray(parsed.issues) ? parsed.issues : (parsed.issues ? [String(parsed.issues)] : []);

  return {
    match,
    appetizing,
    style_consistency: styleConsistency,
    quality,
    chinese_authenticity: chineseAuthenticity,
    texture_realism: textureRealism,
    overall: Math.round(overall * 10) / 10,
    verdict,
    issues,
  };
}
