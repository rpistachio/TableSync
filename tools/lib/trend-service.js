/**
 * 时令与热点服务：为 trend-hunter 提供季节/节气/节日关键词，并调用 LLM 获取社媒热点。
 */
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config.js';

/** 公历 1–12 月时令字典：季节主题、当季食材、饮食主题 */
const SEASONAL_BY_MONTH = {
  1: {
    season: '寒冬暖身进补',
    ingredients: ['羊肉', '萝卜', '白菜', '莲藕', '山药'],
    themes: ['腊月家常菜', '小寒大寒暖胃', '年菜备料']
  },
  2: {
    season: '新春开年菜',
    ingredients: ['韭菜', '豆芽', '春饼', '鸡肉', '鱼肉'],
    themes: ['春节家宴', '立春咬春', '元宵节汤圆配菜']
  },
  3: {
    season: '初春暖身养肝',
    ingredients: ['春笋', '香椿', '荠菜', '菠菜', '豌豆'],
    themes: ['惊蛰应季', '清明踏青便当', '开春养肝']
  },
  4: {
    season: '暮春清淡鲜嫩',
    ingredients: ['蚕豆', '芦笋', '莴笋', '马兰头', '河虾'],
    themes: ['谷雨尝鲜', '春夏交替清淡菜']
  },
  5: {
    season: '初夏清热开胃',
    ingredients: ['黄瓜', '番茄', '茄子', '蒜苔', '小龙虾'],
    themes: ['立夏饭', '小满祛湿', '入夏快手菜']
  },
  6: {
    season: '盛夏消暑祛湿',
    ingredients: ['冬瓜', '苦瓜', '丝瓜', '绿豆', '黄鳝'],
    themes: ['芒种忙种', '端午时令', '夏至凉拌']
  },
  7: {
    season: '伏天解暑养心',
    ingredients: ['莲藕', '莲子', '毛豆', '姜', '鸭肉'],
    themes: ['小暑大暑', '三伏天汤品', '夏日快手凉菜']
  },
  8: {
    season: '夏末秋初润燥',
    ingredients: ['玉米', '南瓜', '秋葵', '菱角', '梨'],
    themes: ['立秋贴秋膘', '处暑清热', '开学季便当']
  },
  9: {
    season: '仲秋进补贴膘',
    ingredients: ['芋头', '板栗', '莲藕', '螃蟹', '柿子'],
    themes: ['中秋家宴', '白露润燥', '秋分平衡饮食']
  },
  10: {
    season: '深秋暖胃滋阴',
    ingredients: ['山药', '红薯', '萝卜', '羊肉', '大闸蟹'],
    themes: ['寒露养阴', '霜降进补', '秋冬炖汤']
  },
  11: {
    season: '初冬温补驱寒',
    ingredients: ['白菜', '白萝卜', '羊肉', '栗子', '红枣'],
    themes: ['立冬补冬', '小雪暖身', '冬日家常炖菜']
  },
  12: {
    season: '寒冬滋补年味',
    ingredients: ['羊肉', '牛肉', '冬笋', '腊味', '八宝'],
    themes: ['大雪进补', '冬至饺子配菜', '腊味年菜']
  }
};

/**
 * 节日/节气覆盖：公历月-日 命中时优先于月份字典。
 * 每条 { month, dayStart, dayEnd?, name } 表示当月 dayStart 至 dayEnd（含）或单日。
 */
const FESTIVAL_OVERRIDES = [
  { month: 1, dayStart: 1, dayEnd: 7, season: '新春家宴', ingredients: ['鱼', '鸡', '饺子', '年糕', '腊味'], themes: ['春节年夜饭', '开年吉祥菜'] },
  { month: 2, dayStart: 2, dayEnd: 2, season: '龙抬头', ingredients: ['猪头肉', '春饼', '豆芽'], themes: ['二月二龙抬头'] },
  { month: 5, dayStart: 1, dayEnd: 5, season: '五一假期家常', ingredients: ['时令蔬菜', '小龙虾', '烧烤配菜'], themes: ['小长假快手菜'] },
  { month: 6, dayStart: 8, dayEnd: 18, season: '端午时令', ingredients: ['黄鱼', '黄鳝', '咸鸭蛋', '艾草'], themes: ['端午家宴', '夏日祛湿'] },
  { month: 8, dayStart: 15, dayEnd: 25, season: '中秋团圆', ingredients: ['芋头', '鸭子', '螃蟹', '莲藕'], themes: ['中秋家宴', '秋日进补'] },
  { month: 9, dayStart: 28, dayEnd: 30, season: '国庆家宴', ingredients: ['时令鲜货', '螃蟹', '板栗'], themes: ['国庆聚餐', '金秋尝鲜'] },
  { month: 10, dayStart: 1, dayEnd: 7, season: '国庆假期', ingredients: ['时令鲜货', '秋蟹', '板栗'], themes: ['国庆家常菜'] },
  { month: 12, dayStart: 21, dayEnd: 24, season: '冬至进补', ingredients: ['羊肉', '汤圆', '饺子', '鸡汤'], themes: ['冬至暖冬', '数九进补'] },
  { month: 12, dayStart: 28, dayEnd: 31, season: '跨年家宴', ingredients: ['鱼', '鸡', '腊味', '年糕'], themes: ['跨年菜', '迎新年'] }
];

/**
 * 根据日期取节日覆盖项（若有）
 * @param {Date} date
 * @returns {typeof FESTIVAL_OVERRIDES[0] | null}
 */
function getFestivalOverride(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const f of FESTIVAL_OVERRIDES) {
    if (f.month !== m) continue;
    const end = f.dayEnd ?? f.dayStart;
    if (d >= f.dayStart && d <= end) return f;
  }
  return null;
}

/**
 * 纯本地时令字典，同步返回当日的季节主题、当季食材、饮食主题。
 * @param {Date} [date=new Date()]
 * @returns {{ season: string, ingredients: string[], themes: string[] }}
 */
export function getSeasonalKeywords(date = new Date()) {
  const override = getFestivalOverride(date);
  if (override) {
    return {
      season: override.season,
      ingredients: [...(override.ingredients || [])],
      themes: [...(override.themes || [])]
    };
  }
  const month = date.getMonth() + 1;
  const entry = SEASONAL_BY_MONTH[month] || SEASONAL_BY_MONTH[1];
  return {
    season: entry.season,
    ingredients: [...entry.ingredients],
    themes: [...entry.themes]
  };
}

/**
 * 从 LLM 返回文本中解析出最多 3 个关键词（支持换行、序号、顿号等）。
 * @param {string} text
 * @returns {string[]}
 */
function parseKeywordsFromResponse(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = text.trim();
  // 先按换行拆，再按常见分隔符拆
  let parts = raw.split(/\n+/).flatMap((line) => line.split(/[,，、;；\s]+/));
  const keywords = parts
    .map((s) => s.replace(/^\d+[.)．]\s*/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 30);
  return [...new Set(keywords)].slice(0, 3);
}

/**
 * 调用 LLM 获取当前中国社交媒体（微博、抖音、小红书）上最火的 3 个家常菜食材或烹饪话题。
 * 若未配置 ANTHROPIC_API_KEY 或请求失败，返回空数组。
 * @returns {Promise<string[]>}
 */
export async function fetchTrendingTopics() {
  if (!CONFIG.anthropicApiKey) {
    return [];
  }

  const systemPrompt = '你是中国社交媒体热点观察员。请用简洁中文回答，只输出关键词，不要解释。';
  const userPrompt = '请告诉我今天在中国社交媒体（微博、抖音、小红书）上最火的 3 个家常菜食材或烹饪话题。直接列出 3 个关键词即可，每行一个或用顿号分隔。';

  const opts = { apiKey: CONFIG.anthropicApiKey };
  if (process.env.ANTHROPIC_BASE_URL) {
    opts.baseURL = process.env.ANTHROPIC_BASE_URL;
  }
  const client = new Anthropic(opts);

  try {
    const msg = await client.messages.create({
      model: CONFIG.llmModel,
      max_tokens: 512,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    const text = (msg.content && msg.content[0] && msg.content[0].text) || '';
    return parseKeywordsFromResponse(text);
  } catch (err) {
    console.warn('[trend-service] fetchTrendingTopics 请求失败，将仅使用时令关键词:', err?.message || err);
    return [];
  }
}

/**
 * 组合最终输入字符串：时令 + 主题 + 食材，供 generate.js --input 使用。
 * 格式：季节主题｜饮食主题（含热点、额外）｜核心食材
 * @param {Object} opts
 * @param {{ season: string, ingredients: string[], themes: string[] }} [opts.seasonal]
 * @param {string[]} [opts.trending]
 * @param {string} [opts.extra] 用户额外关键词，逗号或空格分隔
 * @returns {string}
 */
export function composeInput({ seasonal, trending = [], extra = '' }) {
  const parts = [];
  const season = seasonal?.season || '当季家常';
  const themes = [...(seasonal?.themes || [])];
  if (Array.isArray(trending) && trending.length > 0) {
    themes.push(...trending);
  }
  if (typeof extra === 'string' && extra.trim()) {
    themes.push(...extra.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean));
  }
  parts.push(season);
  parts.push(themes.length > 0 ? themes.join('、') : '家常菜');
  const ingredients = seasonal?.ingredients || [];
  parts.push(ingredients.length > 0 ? ingredients.join('、') : '时令蔬菜');
  return parts.join('｜');
}
