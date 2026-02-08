// cloudfunctions/smartMenuGen/index.js
// 根据天气、心情、家庭画像与候选菜谱，用 Kimi 联网能力生成智能"心情套餐"
// 失败则客户端降级到 menuGenerator.generateMenuWithFilters() 本地随机

const { buildSystemPrompt, buildUserMessage, normalizeMood } = require('./lib/prompt-builder');
const { chat } = require('./lib/kimi');

/* ───── 配置加载 ───── */

let SECRET_CONFIG = {};
try {
  SECRET_CONFIG = require('./secret-config.json');
} catch (_) {}

function getConfig(key) {
  const raw = SECRET_CONFIG[key] || process.env[key] || '';
  return typeof raw === 'string' ? raw.trim() : raw;
}

/* ───── JSON 安全解析 ───── */

function safeParseJson(raw) {
  let text = (raw && String(raw)).trim();

  // 剥离 markdown 代码块围栏
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  // 尝试从文本中提取 JSON 对象
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('JSON 解析失败: ' + e.message + ' | 原文: ' + text.slice(0, 200));
  }
}

/* ───── 菜谱 ID 校验 ───── */

/**
 * 校验 AI 返回的 recipeIds 是否满足套餐结构
 * @param {Array} recipeIds  - AI 返回的 id 数组
 * @param {Array} candidates - 候选列表 { id, meat, dish_type, name }
 * @param {Object} preference - { meatCount, vegCount, soupCount }
 * @returns {Array|null} 通过校验返回 id 数组，否则返回 null
 */
function validateRecipeIds(recipeIds, candidates, preference) {
  const meatCount = preference.meatCount || 1;
  const vegCount = preference.vegCount || 1;
  const soupCount = preference.soupCount || 0;
  const total = meatCount + vegCount + soupCount;

  const idSet = new Set((candidates || []).map((c) => c.id || c._id).filter(Boolean));
  const byId = {};
  (candidates || []).forEach((c) => {
    const id = c.id || c._id;
    if (id) byId[id] = c;
  });

  const list = Array.isArray(recipeIds) ? recipeIds.filter((id) => idSet.has(id)) : [];
  if (list.length < total) return null;

  const ordered = list.slice(0, total);
  let idx = 0;

  // 验证荤菜
  for (let i = 0; i < meatCount && idx < ordered.length; i++) {
    const c = byId[ordered[idx]];
    if (!c || c.meat === 'vegetable' || c.dish_type === 'soup' || (c.name && c.name.indexOf('汤') !== -1)) return null;
    idx++;
  }

  // 验证素菜
  for (let i = 0; i < vegCount && idx < ordered.length; i++) {
    const c = byId[ordered[idx]];
    if (!c || c.meat !== 'vegetable') return null;
    idx++;
  }

  // 验证汤品
  for (let i = 0; i < soupCount && idx < ordered.length; i++) {
    const c = byId[ordered[idx]];
    if (!c) return null;
    const isSoup = c.dish_type === 'soup' || (c.name && c.name.indexOf('汤') !== -1);
    if (!isSoup) return null;
    idx++;
  }

  return ordered;
}

/* ───── 主入口 ───── */

exports.main = async (event, context) => {
  const apiKey = getConfig('MOONSHOT_API_KEY');
  const model = getConfig('MOONSHOT_TEXT_MODEL') || 'moonshot-v1-8k';

  if (!apiKey) {
    return { code: 500, fallback: true, message: 'MOONSHOT_API_KEY 未配置' };
  }

  const { preference, mood, weather, recentDishNames, candidates } = event || {};
  if (!preference || !Array.isArray(candidates) || candidates.length === 0) {
    return { code: 400, fallback: true, message: '缺少 preference 或 candidates' };
  }

  try {
    // 构建 Prompt
    const systemContent = buildSystemPrompt();
    const userContent = buildUserMessage({
      preference,
      mood: mood || 'random',
      weather: weather || {},
      recentDishNames: recentDishNames || '',
      candidates,
    });

    // 判断是否启用联网搜索
    // 当有明确心情（非 random）或有天气信息时，启用 Kimi 联网能力
    // 联网搜索可获取当季时令推荐、心情饮食建议等额外知识
    const normalizedMood = normalizeMood(mood);
    const hasWeather = weather && (weather.text || weather.temp != null);
    const hasMoodContext = normalizedMood !== 'random';
    const useSearch = hasMoodContext || hasWeather;

    console.log('[smartMenuGen] mood:', normalizedMood, '| weather:', JSON.stringify(weather || {}), '| search:', useSearch, '| candidates:', (candidates || []).length);

    // 调用 Kimi API
    const rawText = await chat({
      apiKey,
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1024,
      temperature: 0.4,
      use_search: useSearch,
    });

    if (!rawText) {
      return { code: 500, fallback: true, message: 'AI 返回为空' };
    }

    // 解析 AI 响应
    const parsed = safeParseJson(rawText);
    const recipeIds = parsed.recipeIds;
    const reasoning = parsed.reasoning || '';
    const validated = validateRecipeIds(recipeIds, candidates, preference);

    if (!validated) {
      console.warn('[smartMenuGen] AI 返回不满足套餐结构:', JSON.stringify(parsed));
      return { code: 500, fallback: true, message: 'AI 返回的菜谱不满足套餐结构' };
    }

    console.log('[smartMenuGen] 推荐成功:', validated.join(', '), '| 思路:', reasoning);

    // 返回结果 (reasoning 为可选扩展字段, 遵循 spec 6.3 加法兼容原则)
    return {
      code: 0,
      data: {
        recipeIds: validated,
        reasoning: reasoning,
      },
    };
  } catch (err) {
    console.error('[smartMenuGen]', err);
    return { code: 500, fallback: true, message: err.message || '智能推荐失败' };
  }
};
