// smartMenuGen/lib/prompt-builder.js
// 聚合天气、心情、家庭画像、历史与候选菜谱，生成 system + user prompt
// v2: 深度心情套餐推荐 + Kimi 联网搜索指引

/* ═══════════════════════════════════════════
   常量与映射表
   ═══════════════════════════════════════════ */

/**
 * 中文 → 英文枚举 fallback (旧版客户端兼容)
 * spec v1.1: "开心" → "celebratory", "疲惫" → "exhausted" 等
 */
const MOOD_CN_MAP = {
  '开心': 'celebratory',
  '疲惫': 'exhausted',
  '想吃轻食': 'health_conscious',
  '馋了': 'craving_heavy',
  '随便': 'random',
  '主厨包办': 'omakase',
};

/**
 * 每种心情对应的 AI 推荐策略
 * label   — 中文显示名
 * goal    — 核心目标描述
 * rules   — 具体选菜规则（注入 user message）
 * dietStyleOverride — 心情可覆盖的 dietStyle（仅当用户原始值为 home 时生效）
 */
const MOOD_STRATEGY = {
  exhausted: {
    label: '疲惫',
    goal: '快手省力、高蛋白恢复体力',
    rules: [
      '优先选择 cook_minutes ≤ 20 的菜品（标签中含 quick 者加分）',
      '优先 cook_type 为 stir_fry 或 steam（快炒/蒸 = 少步骤、少油烟）',
      '套餐总烹饪时间应控制在 30 分钟以内',
      '适当偏向高蛋白食材（鸡肉、鱼、蛋、豆腐）帮助恢复精力',
      '避免需要长时间炖煮（stew）或复杂工序的菜式',
    ],
    dietStyleOverride: 'quick',
  },
  celebratory: {
    label: '开心 / 庆祝',
    goal: '丰盛大餐、色香味俱全',
    rules: [
      '可大胆选择 cook_minutes 较高的硬菜（红烧、炖煲均可）',
      '荤菜应选不同主料类型（如一鸡一鱼），增加菜品丰富度',
      '搭配至少一道「色彩鲜艳」或「有仪式感」的菜（如糖醋类、干锅类）',
      '如有汤品需求，优先推荐炖品 / 煲汤，增加宴席感',
      '整体风味可大胆对比搭配（如酸甜 + 咸鲜），避免全部同一口味',
    ],
    dietStyleOverride: 'rich',
  },
  health_conscious: {
    label: '想吃轻食',
    goal: '低油低盐、清淡养生',
    rules: [
      '优先 cook_type 为 steam 或 cold_dress（蒸 / 凉拌）',
      '优先 flavor_profile 为 light 或 sour_fresh 的清淡菜品',
      '蔬菜类菜品（meat=vegetable）占比应尽量高',
      '避免 flavor_profile 为 spicy 或 salty_umami 的重口味菜品',
      '可推荐白灼、清蒸、沙拉类菜式',
    ],
    dietStyleOverride: 'light',
  },
  craving_heavy: {
    label: '馋了 / 想解馋',
    goal: '下饭硬菜、满足味蕾',
    rules: [
      '优先 flavor_profile 为 salty_umami 或 spicy 的菜品',
      '肉类菜品应选味道浓郁的做法（红烧、酱焖、干煸）',
      '优先 cook_type 为 stir_fry 或 braise（煎炒 / 红烧）',
      '至少一道经典下饭菜（如宫保鸡丁、红烧肉、鱼香肉丝等）',
      '素菜也应选风味突出的（如干煸、蒜蓉、酸辣口味）',
    ],
    dietStyleOverride: 'rich',
  },
  random: {
    label: '随便',
    goal: '均衡搭配、口味多样',
    rules: [
      '不附加特殊偏向，完全按用户 preference 和菜品多样性选择',
      '注重荤素搭配的口味差异化（避免全部咸鲜或全部清淡）',
      '优先选择 flavor_profile 不重复的菜品组合',
    ],
    dietStyleOverride: null,
  },
  omakase: {
    label: '主厨包办',
    goal: '惊喜感优先、兼顾口味偏好的定向盲盒',
    rules: [
      '在用户偏好的大框架下，优先选择用户近期未做过的菜品',
      '注重视觉冲击力：优先选封面质量高、色彩丰富的菜品',
      '口味组合追求惊喜感——不要完全安全牌，可以搭配一道略出圈的菜',
      '荤素搭配必须均衡，但具体菜品选择大胆一些',
      '套餐整体应有「故事感」：如一道经典 + 一道新尝试 + 一道安慰系',
    ],
    dietStyleOverride: null,
  },
};

/** 烹饪方式中文标签 */
const COOK_LABELS = {
  stir_fry: '炒',
  stew: '炖/煲',
  steam: '蒸',
  cold_dress: '凉拌',
  fry: '煎/炸',
  braise: '红烧/焖',
  boil: '煮',
};

/** 风味画像中文标签 */
const FLAVOR_LABELS = {
  salty_umami: '咸鲜',
  light: '清淡',
  spicy: '辣',
  sweet_sour: '酸甜',
  sour_fresh: '酸爽',
};

const MEAT_LABELS = {
  pork: '猪肉',
  beef: '牛肉',
  chicken: '鸡肉',
  fish: '鱼',
  shrimp: '虾/海鲜',
  vegetable: '蔬菜',
  egg: '蛋',
  tofu: '豆腐',
};

/** 口味语义对齐：将抽象口味标签翻译为具体烹饪指令（Layer 3: Semantic Alignment） */
const FLAVOR_SEMANTICS = {
  light:       '偏好清蒸、白灼、水煮等方式，减少勾芡和重油，突出食材本味',
  spicy:       '偏好川湘风格，适当使用干辣椒、花椒或豆瓣酱提味',
  sour_fresh:  '偏好酸汤、柠檬汁、番茄等带酸味的菜式，开胃爽口',
  salty_umami: '偏好酱香浓郁、咸鲜下饭的家常菜，如红烧、酱炒',
  sweet_sour:  '偏好糖醋、蜜汁等甜酸交融的菜式，色彩鲜艳',
};

/* ═══════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════ */

/**
 * 归一化心情值：支持中文 → 英文枚举映射
 * @param {string} mood
 * @returns {string} 标准枚举值
 */
function normalizeMood(mood) {
  if (!mood) return 'random';
  const val = String(mood).trim();
  if (MOOD_STRATEGY[val]) return val;          // 已是标准枚举
  return MOOD_CN_MAP[val] || 'random';         // 中文映射或兜底
}

/**
 * 根据天气信息生成 AI 可理解的饮食建议
 * @param {Object} weather - { text, temp }
 * @returns {string} 天气饮食建议文案
 */
function getWeatherHint(weather) {
  if (!weather || (!weather.text && weather.temp == null)) return '';
  const hints = [];
  const temp = weather.temp;
  const text = weather.text || '';

  // 温度区间 → 菜式建议
  if (temp != null) {
    if (temp <= 5) {
      hints.push('气温很低（≤5°C），适合炖汤、红烧、砂锅等暖身菜，热汤加分');
    } else if (temp <= 15) {
      hints.push('天气偏凉（5-15°C），煲汤和炒菜都合适，可搭配一道温热汤品');
    } else if (temp <= 25) {
      hints.push('气温适中（15-25°C），菜式选择空间大，荤素均衡即可');
    } else if (temp <= 33) {
      hints.push('天气偏热（25-33°C），优先凉拌、清蒸、快炒等清爽菜式');
    } else {
      hints.push('高温酷暑（>33°C），建议凉拌/冷食为主，避免油腻，注意补充水分');
    }
  }

  // 天气状况 → 额外建议
  if (text.includes('雨') || text.includes('雪')) {
    hints.push('雨雪天，暖身汤品和炖菜更能带来慰藉感');
  }
  if (text.includes('阴') || text.includes('多云')) {
    hints.push('阴天适合色彩丰富的菜品，提升用餐愉悦感');
  }
  if (text.includes('风') || text.includes('大风')) {
    hints.push('大风天适合热食为主，炖煮类菜品');
  }

  return hints.join('；');
}

/**
 * 获取当前季节的食材建议关键词（供联网搜索参考）
 * @returns {string}
 */
function getSeasonalHint() {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return '春季（时令：春笋、荠菜、香椿、豌豆等）';
  if (month >= 6 && month <= 8) return '夏季（时令：丝瓜、苦瓜、茄子、毛豆等）';
  if (month >= 9 && month <= 11) return '秋季（时令：莲藕、山药、栗子、南瓜等）';
  return '冬季（时令：白萝卜、大白菜、冬笋、羊肉等）';
}

/* ═══════════════════════════════════════════
   核心 Prompt 构建
   ═══════════════════════════════════════════ */

/**
 * 构建 system prompt — 定义 AI 角色与决策框架
 * @returns {string}
 */
function buildSystemPrompt() {
  return `你是「桌同步」App 的家庭晚餐 AI 搭配顾问。你兼具专业营养师视角和中式家常菜搭配经验。你的表达风格像一位懂营养的老朋友，专业但不端着，温暖而不啰嗦。

你的核心任务：根据用户当下的天气、心情、家庭画像和忌口，从候选菜谱中精准挑选出一组最完美的「心情套餐」。

## 决策框架（按优先级排列）

### P0 — 红线约束（不可违反）
- **忌口/过敏**：用户标注的忌口食材必须严格排除，零容忍
- **套餐结构**：必须精确满足用户要求的「N荤 + N素 + N汤」结构
- **ID 合法性**：返回的每个 recipeId 必须来自用户提供的候选列表

### P1 — 心情适配
- 根据用户当前心情（exhausted/celebratory/health_conscious/craving_heavy/random），执行对应的选菜策略
- 用户消息中会给出详细的心情策略规则，请严格遵循

### P2 — 天气适配
- 寒冷/雨雪天 → 炖汤、红烧、暖身菜品优先
- 炎热/晴天 → 凉拌、清蒸、快炒等清爽菜品优先
- 可结合联网搜索查看当季时令食材推荐，优先应季菜品

### P3 — 营养与口味平衡
- 同套餐中 flavor_profile 尽量不重复（如不要两道都是咸鲜）
- 同套餐中 cook_type 尽量不重复（如不要两道都是炒）
- 同套餐中 meat（主料类型）尽量不重复（如不要两道都用鸡肉）
- 荤菜提供蛋白质，素菜提供膳食纤维+维生素，汤品补充水分

### P3.5 — 口味档案适配
- 如果用户提供了口味档案（偏好口味、偏好食材），在满足以上约束的前提下，优先选择用户历史偏好的口味和食材类型
- 如果用户有"库存急用"标记，该食材类型的优先级高于口味偏好（类似灵感篮子 high priority）
- 口味档案是软约束（best effort），不是硬红线

### P4 — 灵感篮子优先
- 如果用户提供了"灵感篮子"（用户主动收藏或冰箱匹配的菜谱），在满足套餐结构和红线约束的前提下，优先从篮子中选择
- 篮子中 priority 为 "high" 的菜谱（冰箱即将过期食材），应最优先使用
- 篮子中的菜谱可能不在候选列表中（外部导入），此时可直接使用篮子中的菜谱 ID 和名称
- 篮子只是优先建议，不是强制约束。如果篮子中的菜不适合当前套餐结构/心情/忌口，可以跳过

### P5 — 去重
- 如果用户提供了最近做过的菜名，避开同名菜和相似主料的菜

### P6 — 联网增强（可选）
当你需要额外的饮食搭配灵感时，可使用联网搜索获取：
- 当季时令食材推荐
- 特定心情/天气下的营养搭配建议
- 经典菜品组合参考
注意：联网搜索是辅助手段，最终推荐必须从候选列表中选择。

## 输出格式

**严格返回纯 JSON，不要包含任何 markdown 标记、代码块围栏或额外文字：**
{
  "reasoning": "用朋友聊天的语气，亲切地告诉用户今天为什么选了这几道菜（2-3句，≤100字）。要体现营养搭配的用心，但不要用术语，像跟家人说话一样自然温暖。例：'天冷了来碗暖暖的鱼片，配个酸甜的番茄炒蛋，简单又开胃，正好暖暖身子。'如果用了灵感篮子中的菜谱，自然地提一句为什么选了它。",
  "recipeIds": ["id1", "id2", ...],
  "dishHighlights": { "id1": "这道菜的亮点或选择理由（≤20字）", "id2": "..." }
}

dishHighlights 为必填字段，为每道菜给出一句因果关联的推荐理由（≤20字）。理由必须与"今日主角食材"、"用户口味偏好"或"天气/季节"挂钩，如"及时享用，冰箱里的牛肉正鲜嫩"、"快手12分钟，适合今天的节奏"、"鲈鱼正当季，清蒸最鲜"。禁止"好吃"、"推荐"等空泛词。
recipeIds 顺序必须严格遵循：先所有荤菜 → 再所有素菜 → 最后汤（若有）。`;
}

/**
 * 构建 user message — 注入所有上下文信息
 * @param {Object} opts
 * @param {Object} opts.preference  - 用户偏好
 * @param {string} opts.mood        - 心情（标准枚举或中文）
 * @param {Object} opts.weather     - { text, temp }
 * @param {string} [opts.recentDishNames] - 最近做过的菜名（逗号分隔）
 * @param {Array}  opts.candidates  - 候选菜谱精简对象数组
 * @returns {string}
 */
function buildUserMessage(opts) {
  const { preference, mood, weather, recentDishNames, dislikedDishNames, fridgeExpiring, fridgeAll, heroIngredient, candidates, basketItems, userTweak } = opts;
  const meatCount = preference.meatCount || 1;
  const vegCount = preference.vegCount || 1;
  const soupCount = preference.soupCount || 0;
  const total = meatCount + vegCount + soupCount;

  const normalizedMood = normalizeMood(mood);
  const strategy = MOOD_STRATEGY[normalizedMood] || MOOD_STRATEGY.random;
  const weatherHint = getWeatherHint(weather);
  const seasonalHint = getSeasonalHint();

  const parts = [];

  // ── Section 0: 用户特别要求（最高优先级自然语言约束） ──
  if (userTweak && typeof userTweak === 'string' && userTweak.trim()) {
    parts.push('## ⚡ 用户特别要求（最高优先级，务必遵守）');
    parts.push(userTweak.trim());
    parts.push('');
  }

  // ── Section 0.5: 冰箱食材（全量 + 临期标注） ──
  const hasFridgeAll = Array.isArray(fridgeAll) && fridgeAll.length > 0;
  const hasFridgeExpiring = Array.isArray(fridgeExpiring) && fridgeExpiring.length > 0;
  if (hasFridgeAll) {
    parts.push('## 🧊 用户冰箱食材（核心约束：必须尽量全部用上）');
    parts.push('用户已将以下食材录入冰箱，**本次菜单必须尽可能覆盖所有食材**，每种食材至少对应一道菜：');
    const lines = fridgeAll.map(item => {
      const urgent = item.daysLeft <= 2 ? ' ⚠️急' : '';
      return `- ${item.name}（剩${item.daysLeft}天${urgent}）`;
    });
    parts.push(lines.join('\n'));
    if (hasFridgeExpiring) {
      parts.push(`\n其中【${fridgeExpiring.join('、')}】即将过期，请务必最优先安排。`);
    }
    parts.push('如果食材种类超过菜品道数，优先保证临期食材入选，其余尽量覆盖。');
    parts.push('');
  } else if (hasFridgeExpiring) {
    parts.push('## 🧊 冰箱临期食材（请务必优先使用）');
    parts.push(`以下食材即将过期，请在本次菜单中尽量安排使用：${fridgeExpiring.join('、')}`);
    parts.push('');
  }

  // ── Section 0.6: 今日主角食材（锚点） ──
  if (heroIngredient) {
    parts.push('## 🌟 今日主角食材');
    parts.push(`今天重点围绕【${heroIngredient}】来组菜单。请确保至少有一道菜使用该食材。`);
    parts.push('');
  }

  // ── Section 1: 家庭画像 ──
  parts.push('## 家庭画像');
  parts.push(`- 用餐人数：${preference.adultCount || 2} 位成人`);
  if (preference.hasBaby) {
    parts.push(`- 宝宝：${preference.babyMonth || 12} 月龄（需辅食兼容，避免辣椒、花椒、整颗坚果、过硬食材）`);
  }
  parts.push(`- 套餐结构：${meatCount} 荤 + ${vegCount} 素${soupCount ? ' + 1 汤' : ''}（共 ${total} 道菜）`);

  if (preference.avoidList && preference.avoidList.length > 0) {
    parts.push(`- ⚠️ 严格忌口：${preference.avoidList.join('、')}（红线！必须排除含这些成分的所有菜）`);
  }

  // 饮食风格：心情可覆盖默认 home
  const effectiveStyle = (preference.dietStyle === 'home' && strategy.dietStyleOverride)
    ? strategy.dietStyleOverride
    : preference.dietStyle;
  if (effectiveStyle && effectiveStyle !== 'home') {
    const styleLabels = { light: '清淡养生', rich: '丰盛大餐', quick: '快手省时' };
    parts.push(`- 饮食风格：${styleLabels[effectiveStyle] || effectiveStyle}`);
  }

  if (preference.isTimeSave) {
    parts.push('- ⏱ 省时模式已开启：优先选择 cook_minutes 低的菜品');
  }

  // 口味档案注入（语义对齐：将抽象偏好翻译为具体烹饪指令）
  if (preference.flavorHint) {
    const topFlavorKey = preference.topFlavorKey;
    const secondFlavorKey = preference.secondFlavorKey;
    const topSemantic = topFlavorKey && FLAVOR_SEMANTICS[topFlavorKey];
    const secondSemantic = secondFlavorKey && FLAVOR_SEMANTICS[secondFlavorKey];

    if (preference.flavorAmbiguous && topSemantic && secondSemantic) {
      const LABELS = { light: '清淡', spicy: '辣味', sour_fresh: '酸爽', salty_umami: '咸鲜', sweet_sour: '酸甜' };
      const topLabel = LABELS[topFlavorKey] || topFlavorKey;
      const secondLabel = LABELS[secondFlavorKey] || secondFlavorKey;
      parts.push(`- 🎯 口味偏好：用户平时爱吃${topLabel}和${secondLabel}（${preference.flavorHint}），两种方向都可以，请在套餐中灵活搭配`);
      parts.push(`  - ${topLabel}方向：${topSemantic}`);
      parts.push(`  - ${secondLabel}方向：${secondSemantic}`);
    } else if (topSemantic) {
      parts.push(`- 🎯 口味偏好：${topSemantic}（${preference.flavorHint}）`);
    } else {
      parts.push(`- 🎯 口味档案：${preference.flavorHint}`);
    }
  }
  if (Array.isArray(preference.preferredMeats) && preference.preferredMeats.length > 0) {
    const meatLabels = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼肉', shrimp: '虾仁', vegetable: '素菜' };
    const names = preference.preferredMeats.map(m => meatLabels[m] || m).join('、');
    parts.push(`- 🎯 偏好食材：${names}（在满足套餐结构和多样性前提下，适当偏向这些食材）`);
  }

  // 库存急用注入（单次高优约束，类似灵感篮子 high priority）
  if (preference.urgentIngredient) {
    const urgentLabels = { meat: '肉类', vegetable: '蔬菜', seafood: '海鲜' };
    const urgentName = urgentLabels[preference.urgentIngredient] || preference.urgentIngredient;
    parts.push(`- ⚡ 库存急用：用户冰箱有【${urgentName}】需要尽快消耗，请优先选择含${urgentName}的菜品（优先级高于口味偏好）`);
  }

  // ── Section 2: 天气上下文 ──
  parts.push('');
  parts.push('## 今日天气');
  if (weather && (weather.text || weather.temp != null)) {
    const tempStr = weather.temp != null ? ` ${weather.temp}°C` : '';
    parts.push(`- 实况：${weather.text || '未知'}${tempStr}`);
    if (weatherHint) parts.push(`- 饮食建议：${weatherHint}`);
  } else {
    parts.push('- 天气信息不可用，请忽略天气因素');
  }
  parts.push(`- 当前季节：${seasonalHint}`);

  // ── Section 3: 心情 + 选菜策略 ──
  parts.push('');
  parts.push(`## 今日心情：${strategy.label}`);
  parts.push(`🎯 搭配目标：${strategy.goal}`);
  parts.push('');
  parts.push('请严格执行以下选菜策略：');
  strategy.rules.forEach((rule, i) => {
    parts.push(`${i + 1}. ${rule}`);
  });

  // ── Section 3.5: 灵感篮子（用户收藏 / 冰箱匹配的备选菜谱，必带 sourceDetail）──
  if (Array.isArray(basketItems) && basketItems.length > 0) {
    parts.push('');
    parts.push('## 灵感篮子（用户主动收藏的备选菜谱，请优先考虑）');
    const highPriority = basketItems.filter(b => b.priority === 'high');
    const normalPriority = basketItems.filter(b => b.priority !== 'high');
    const fmt = (b) => `- ${b.name}（ID: ${b.id}，来源: ${b.source}，来源说明: ${b.sourceDetail || b.source || '-'}）`;
    if (highPriority.length > 0) {
      parts.push('⚡ 高优先（冰箱食材即将过期，请务必优先使用）：');
      highPriority.forEach(b => { parts.push(fmt(b)); });
    }
    if (normalPriority.length > 0) {
      parts.push('普通优先（用户收藏，尽量选用）：');
      normalPriority.forEach(b => { parts.push(fmt(b)); });
    }
    parts.push('注意：篮子中的菜谱 ID 可能不在候选列表中（来自外部导入），但如果 ID 匹配候选列表中的菜谱，应优先选择。');
    parts.push('【必达】reasoning 话术中必须体现「我看到了你的灵感」并点名具体来源（如：来自冰箱匹配、小红书导入、菜谱库收藏等），与上述来源说明一致。');
  }

  // ── Section 4: 去重 + 负面约束 ──
  if (recentDishNames) {
    parts.push('');
    parts.push('## 最近做过的菜（请避免重复或相似主料）');
    parts.push(recentDishNames);
  }

  if (Array.isArray(dislikedDishNames) && dislikedDishNames.length > 0) {
    parts.push('');
    parts.push('## 用户近期不想吃的菜（严格回避！）');
    parts.push(dislikedDishNames.join('、'));
    parts.push('这些菜品曾被用户明确换掉，必须排除，不要推荐同名或高度相似的菜。');
  }

  // ── Section 5: 候选菜谱 ──
  parts.push('');
  const candidateCount = (candidates || []).length;
  parts.push(`## 候选菜谱（共 ${candidateCount} 道，请严格只从中选择）`);

  // 动态候选策略：≤500 全量发送，>500 按主料均衡截断
  const CANDIDATE_CAP = 500;
  const rawCandidates = candidates || [];
  let pool = rawCandidates;
  if (rawCandidates.length > CANDIDATE_CAP) {
    const buckets = {};
    rawCandidates.forEach(r => {
      const m = r.meat || 'other';
      if (!buckets[m]) buckets[m] = [];
      buckets[m].push(r);
    });
    const meatTypes = Object.keys(buckets);
    const perBucket = Math.max(Math.floor(CANDIDATE_CAP / meatTypes.length), 20);
    pool = [];
    meatTypes.forEach(m => {
      pool = pool.concat(buckets[m].slice(0, perBucket));
    });
    if (pool.length < CANDIDATE_CAP) {
      const picked = new Set(pool.map(r => r.id || r._id));
      for (let i = 0; i < rawCandidates.length && pool.length < CANDIDATE_CAP; i++) {
        const rid = rawCandidates[i].id || rawCandidates[i]._id;
        if (!picked.has(rid)) { pool.push(rawCandidates[i]); picked.add(rid); }
      }
    }
  }

  const simplified = pool.map((r) => {
    const isSoup = r.dish_type === 'soup' || (r.name && r.name.includes('汤'));
    const isVeg = r.meat === 'vegetable';
    const meatLabel = MEAT_LABELS[r.meat] || r.meat || '';
    const obj = {
      id: r.id || r._id,
      name: r.name,
      类型: isVeg ? '素' : (isSoup ? '汤' : '荤'),
      主料: meatLabel || (isVeg ? '蔬菜' : '-'),
      烹饪: COOK_LABELS[r.cook_type] || r.cook_type || '-',
      风味: FLAVOR_LABELS[r.flavor_profile] || r.flavor_profile || '-',
    };
    if (r.cook_minutes) obj.耗时 = r.cook_minutes + 'min';
    if (r.tags && r.tags.length > 0) obj.标签 = r.tags.join(',');
    return obj;
  });
  parts.push(JSON.stringify(simplified, null, 0));

  // ── Section 6: 输出指令 ──
  parts.push('');
  parts.push('## 请输出');
  parts.push(`综合以上天气、心情、家庭画像，从候选列表中选出恰好 ${total} 道菜，组成一份完美的「${strategy.label}心情套餐」。`);
  parts.push(`顺序：${meatCount} 个荤菜 id → ${vegCount} 个素菜 id${soupCount ? ' → 1 个汤 id' : ''}。`);

  // dishHighlights 因果理由要求
  const highlightRules = [];
  highlightRules.push('dishHighlights 是每道菜的推荐理由（≤20字），必须让用户感到"AI 懂我"：');
  highlightRules.push('- 理由必须与"今日主角食材"、"用户口味偏好"或"天气/季节"产生因果关联');
  if (heroIngredient) {
    highlightRules.push(`- 使用了【${heroIngredient}】的菜：理由应点明食材来源，如"冰箱里的${heroIngredient}正新鲜"或"${heroIngredient}正当季，清蒸最鲜"`);
  }
  highlightRules.push('- 其他菜：结合烹饪方式或耗时给出实用理由，如"快手12分钟，下班不用等"、"蒸一蒸就好，清爽不腻"');
  highlightRules.push('- 禁止空泛理由如"好吃"、"推荐"、"经典菜"');

  parts.push(highlightRules.join('\n'));

  if (normalizedMood === 'omakase') {
    parts.push('');
    parts.push('## 动态微文案（omakaseCopy）');
    parts.push('请额外返回一个 omakaseCopy 字段（字符串）。你必须严格遵守以下 4 条铁律，否则系统将报错：');
    parts.push('1. 极度克制：总长度绝对不能超过 15 个中文字符，不要任何标点符号结尾。');
    parts.push('2. 彻底拒绝 AI 腔调：禁止出现"为您推荐"、"希望你喜欢"、"不仅...还..."等机器客服用语。');
    parts.push('3. 角色设定：你是一位自信、内敛的私人主厨。用类似手账笔记的口吻，像朋友一样给出一个做这道菜的感性理由。');
    parts.push('4. 触发逻辑：根据当前条件（用户疲惫/临期食材/重口味/清淡）选择一个切入点，只说一句话。');
    parts.push('');
    parts.push('语料参考（照此风格生成，勿照抄）：');
    parts.push('- 用户疲惫：一点酸甜卸下今天的疲惫、不用动脑今晚吃顿舒服的、热气升腾把烦恼挡在锅外、今天辛苦了吃点好的补补');
    parts.push('- 临期食材：番茄在等你今晚让它大放异彩、赶在风味流失前把它变成杰作、冰箱里的老朋友今天做主角');
    parts.push('- 重口味：今天痛快吃卡路里明天再说、恰到好处的火辣专治胃口不佳、无肉不欢的夜晚就选这一道');
    parts.push('- 清淡：给肠胃放个假尝点食材本味、低卡零负担今晚好好爱自己、保留山野之气一口吃到春天');
    parts.push('- 盲盒兜底：既然拿不定主意相信我的直觉、缘分摇出来的菜通常都不会差、随机的惊喜往往是最优解');
    parts.push('');
    parts.push('返回纯 JSON：{ "reasoning": "...", "recipeIds": ["id1", ...], "dishHighlights": { "id1": "因果理由（≤20字）", ... }, "omakaseCopy": "一句≤15字无标点结尾的微文案" }');
  } else {
    parts.push('返回纯 JSON：{ "reasoning": "用朋友聊天的语气，亲切告诉用户今天为什么选了这几道菜（2-3句，≤100字，自然温暖，不用术语）", "recipeIds": ["id1", ...], "dishHighlights": { "id1": "因果理由（≤20字）", ... } }');
  }

  return parts.join('\n');
}

/* ═══════════════════════════════════════════
   导出
   ═══════════════════════════════════════════ */

module.exports = {
  buildSystemPrompt,
  buildUserMessage,
  normalizeMood,
  getWeatherHint,
  getSeasonalHint,
  MOOD_STRATEGY,
  MOOD_CN_MAP,
  COOK_LABELS,
  FLAVOR_LABELS,
};
