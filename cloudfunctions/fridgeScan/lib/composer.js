// cloudfunctions/fridgeScan/lib/composer.js
// 智能组餐推荐模块 —— 基于 Kimi 文本模型，从候选菜谱中选出均衡晚餐

const { chat } = require('./kimi');

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

/** 推荐菜品数量范围 */
const MIN_RECOMMENDATIONS = 2;
const MAX_RECOMMENDATIONS = 3;

/** cook_type 中文映射（用于让 AI 更好理解烹饪方式多样性） */
const COOK_TYPE_LABELS = {
  stir_fry: '炒',
  stew: '炖/煲',
  steam: '蒸',
  cold_dress: '凉拌',
};

/** flavor_profile 中文映射 */
const FLAVOR_LABELS = {
  salty_umami: '咸鲜',
  light: '清淡',
  spicy: '辣',
  sweet_sour: '酸甜',
  sour_fresh: '酸爽',
};

// ── System Prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `你是一位经验丰富的家庭营养晚餐搭配顾问。你需要根据用户冰箱里现有的食材和一组按匹配度排序的候选菜谱，精选 2-3 道菜组成一顿合理的晚餐。

## 搭配原则（按优先级排列）

1. **食材利用率**：优先选匹配度高、需要额外购买食材最少的菜谱
2. **荤素均衡**：至少 1 荤 1 素；若选 3 道则建议 1-2 荤 + 1-2 素，或含一道汤
3. **烹饪方式多样**：不要全选同一种烹饪方式（如全是"炒"），尽量覆盖 炒/蒸/炖/凉拌 中的 2 种以上
4. **口味互补**：避免全选重口味或全选清淡，理想搭配如"1咸鲜 + 1清淡 + 1酸甜"
5. **时间可行性**：如果候选中有 1 道炖菜（耗时长），其余尽量选快手菜（prep+cook < 30分钟）
6. **汤品搭配**：如候选中有合适的汤，可以替代 1 道素菜的位置

## 输出要求

严格返回以下 JSON 格式，不要添加任何多余文字、注释或 markdown 标记：
{
  "recommendations": [
    {
      "id": "菜谱ID（必须来自候选列表）",
      "name": "菜名",
      "role": "main_meat 或 sub_meat 或 veg 或 soup（标注此菜在晚餐中的角色）",
      "reason": "选这道菜的理由（1句话，包含食材利用情况）",
      "missing_ingredients": ["需要额外购买的主料1", "主料2"],
      "cook_minutes": 预估总用时（数字，分钟）
    }
  ],
  "meal_summary": "这顿晚餐的整体搭配亮点（1-2句话，包含荤素、口味、烹饪方式的描述）",
  "shopping_list": ["所有推荐菜合计需要额外购买的食材（去重）"]
}`;

// ── 主函数 ────────────────────────────────────────────────────

/**
 * 基于识别食材 + 候选菜谱，调用 Kimi 进行智能组餐推荐
 */
async function composeMeal({ ingredients, candidates, apiKey, model }) {
  if (!apiKey || !model) throw new Error('[Composer] apiKey、model 不能为空');
  if (!Array.isArray(ingredients) || ingredients.length === 0) throw new Error('[Composer] ingredients 必须为非空数组');
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('[Composer] candidates 必须为非空数组');

  console.log(`[Composer] Kimi 组餐，食材: ${ingredients.length} 种，候选: ${candidates.length} 道，模型: ${model}`);
  const userMessage = buildUserMessage(ingredients, candidates);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      const rawText = await chat({
        apiKey,
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.4,
      });
      if (!rawText) throw new Error('[Composer] API 返回内容为空');
      const parsed = safeParseJson(rawText);
      const validated = validateAndNormalize(parsed, candidates);
      console.log(`[Composer] 组餐完成，推荐 ${validated.recommendations.length} 道: ${validated.recommendations.map((r) => r.name).join('、')}`);
      return validated;
    } catch (err) {
      lastError = err;
      if (isTransientError(err) && attempt < MAX_RETRIES) continue;
      break;
    }
  }
  throw lastError;
}

// ── 辅助函数 ──────────────────────────────────────────────────

/**
 * 构建发送给 Kimi 的 user message
 * 包含冰箱食材清单和简化的候选菜谱信息
 */
const MAX_INGREDIENTS_IN_PROMPT = 10;

function buildUserMessage(ingredients, candidates) {
  const simplifiedCandidates = candidates.map((r) => {
    const mains = (r.main_ingredients || []).map((i) => (typeof i === 'string' ? i : i.name)).slice(0, MAX_INGREDIENTS_IN_PROMPT);
    const missing = (r.missingIngredients || []).slice(0, MAX_INGREDIENTS_IN_PROMPT);
    const item = {
      id: r.id || r._id,
      name: r.name,
      meat: r.meat || '未知',
      cook_type: COOK_TYPE_LABELS[r.cook_type] || r.cook_type || '未知',
      flavor: FLAVOR_LABELS[r.flavor_profile] || r.flavor_profile || '未知',
      main_ingredients: mains,
      matchScore: r.score,
      matchedIngredients: (r.matchedIngredients || []).slice(0, MAX_INGREDIENTS_IN_PROMPT),
      missingIngredients: missing,
    };
    if (r.dish_type === 'soup') item.dish_type = 'soup';
    if (r.prep_time != null || r.cook_minutes != null) {
      item.total_minutes = (r.prep_time || 0) + (r.cook_minutes || 0);
    }
    return item;
  });

  return `## 冰箱里有的食材
${ingredients.map((i) => `- ${i.name}（${i.quantity || '适量'}，${i.category || '未分类'}）`).join('\n')}

## 候选菜谱（按匹配度排序）
${JSON.stringify(simplifiedCandidates)}

请从候选菜谱中选出 ${MIN_RECOMMENDATIONS}-${MAX_RECOMMENDATIONS} 道组成今晚的晚餐，严格返回 JSON。`;
}

/**
 * 安全解析 JSON，兼容 \`\`\`json ... \`\`\` 包裹以及前后多余文字
 */
function safeParseJson(raw) {
  let text = raw.trim();

  // 兼容 ```json ... ``` 包裹
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fencedMatch) {
    text = fencedMatch[1].trim();
  }

  // 尝试提取第一个 { ... } 块（应对 LLM 偶尔在 JSON 前后输出多余文字）
  if (!text.startsWith('{')) {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      text = text.slice(startIdx, endIdx + 1);
    }
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      `[Composer] 解析 JSON 失败: ${e.message}\n原始内容片段: ${text.slice(0, 500)}`
    );
  }
}

/**
 * 校验并归一化组餐返回结构
 * 确保 recommendations 中引用的菜谱 ID 在候选列表中存在
 *
 * @param {Object} parsed    - Kimi 返回的原始 JSON
 * @param {Array}  candidates - 候选菜谱列表（用于交叉校验）
 * @returns {{ recommendations: Array, meal_summary: string, shopping_list: string[] }}
 */
function validateAndNormalize(parsed, candidates) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[Composer] 返回结果不是有效的 JSON 对象');
  }

  // 构建候选 ID 到菜谱的映射，用于交叉验证
  const candidateMap = {};
  for (const c of candidates) {
    const cid = c.id || c._id;
    if (cid) {
      candidateMap[cid] = c;
    }
  }

  // ── 验证 recommendations ───────────────────────────────
  const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

  if (rawRecs.length === 0) {
    console.warn('[Composer] AI 返回了空的推荐列表，将使用候选列表前 2 道作为降级方案');
    return buildFallback(candidates);
  }

  const VALID_ROLES = ['main_meat', 'sub_meat', 'veg', 'soup'];
  const recommendations = [];

  for (const rec of rawRecs) {
    if (!rec || typeof rec !== 'object') continue;

    const id = rec.id || '';
    const name = rec.name || '';

    // 验证菜谱 ID 是否在候选列表中（允许 AI 返回候选中的菜谱）
    // 如果 ID 不匹配但菜名匹配，尝试通过菜名找回
    let resolvedId = id;
    if (!candidateMap[id]) {
      const byName = candidates.find(
        (c) => c.name === name || c.name === rec.name
      );
      if (byName) {
        resolvedId = byName.id || byName._id;
        console.warn(`[Composer] 推荐菜 "${name}" 的 ID "${id}" 不匹配，已通过菜名修正为 "${resolvedId}"`);
      } else {
        console.warn(`[Composer] 推荐菜 "${name}"（ID: ${id}）不在候选列表中，跳过`);
        continue;
      }
    }

    recommendations.push({
      id: resolvedId,
      name: name || (candidateMap[resolvedId] && candidateMap[resolvedId].name) || '未知菜名',
      role: VALID_ROLES.includes(rec.role) ? rec.role : 'veg',
      reason: typeof rec.reason === 'string' ? rec.reason.trim() : '',
      missing_ingredients: Array.isArray(rec.missing_ingredients)
        ? rec.missing_ingredients.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
        : [],
      cook_minutes: typeof rec.cook_minutes === 'number' && rec.cook_minutes > 0
        ? rec.cook_minutes
        : estimateCookMinutes(candidateMap[resolvedId]),
    });
  }

  // 如果校验后推荐数不足，降级处理
  if (recommendations.length < MIN_RECOMMENDATIONS) {
    console.warn(
      `[Composer] 校验后推荐数(${recommendations.length})不足 ${MIN_RECOMMENDATIONS}，使用降级方案补充`
    );
    return buildFallback(candidates, recommendations);
  }

  // 限制最多 MAX_RECOMMENDATIONS 道
  const finalRecs = recommendations.slice(0, MAX_RECOMMENDATIONS);

  // ── meal_summary ────────────────────────────────────────
  const mealSummary = typeof parsed.meal_summary === 'string'
    ? parsed.meal_summary.trim()
    : generateDefaultSummary(finalRecs);

  // ── shopping_list ───────────────────────────────────────
  let shoppingList = [];
  if (Array.isArray(parsed.shopping_list)) {
    shoppingList = parsed.shopping_list
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => s.trim());
  } else {
    // 如果 AI 没返回 shopping_list，从各推荐菜的 missing_ingredients 汇总
    const seen = new Set();
    for (const rec of finalRecs) {
      for (const item of rec.missing_ingredients) {
        if (!seen.has(item)) {
          seen.add(item);
          shoppingList.push(item);
        }
      }
    }
  }

  return {
    recommendations: finalRecs,
    meal_summary: mealSummary,
    shopping_list: shoppingList,
  };
}

/**
 * 从候选菜谱中构建降级推荐方案
 * 策略：优先选匹配分最高的 1 荤 + 1 素
 *
 * @param {Array} candidates      - 候选菜谱列表（已按 score 降序）
 * @param {Array} [existingRecs]  - 已有的有效推荐（可选，用于补充而非替换）
 * @returns {{ recommendations: Array, meal_summary: string, shopping_list: string[] }}
 */
function buildFallback(candidates, existingRecs) {
  const existing = existingRecs || [];
  const existingIds = new Set(existing.map((r) => r.id));
  const needed = MIN_RECOMMENDATIONS - existing.length;

  if (needed <= 0) {
    return {
      recommendations: existing,
      meal_summary: generateDefaultSummary(existing),
      shopping_list: collectShoppingList(existing),
    };
  }

  // 从候选中选取未被推荐过的菜谱
  const remaining = candidates.filter((c) => {
    const cid = c.id || c._id;
    return !existingIds.has(cid);
  });

  // 优先选 1 荤 + 1 素
  const meatDish = remaining.find((c) => c.meat && c.meat !== 'vegetable');
  const vegDish = remaining.find((c) => c.meat === 'vegetable');

  const fallbackPicks = [];
  if (meatDish) fallbackPicks.push(meatDish);
  if (vegDish) fallbackPicks.push(vegDish);

  // 如果荤素都没有，取 score 最高的
  if (fallbackPicks.length === 0 && remaining.length > 0) {
    fallbackPicks.push(remaining[0]);
  }

  const fallbackRecs = fallbackPicks.slice(0, needed).map((c) => ({
    id: c.id || c._id,
    name: c.name,
    role: c.meat === 'vegetable' ? 'veg' : 'main_meat',
    reason: `匹配度最高的候选菜谱（得分 ${c.score || 0}）`,
    missing_ingredients: c.missingIngredients || [],
    cook_minutes: estimateCookMinutes(c),
  }));

  const allRecs = [...existing, ...fallbackRecs];

  return {
    recommendations: allRecs,
    meal_summary: generateDefaultSummary(allRecs),
    shopping_list: collectShoppingList(allRecs),
  };
}

/**
 * 根据菜谱字段估算总烹饪时间
 */
function estimateCookMinutes(recipe) {
  if (!recipe) return 30;
  return (recipe.prep_time || 10) + (recipe.cook_minutes || 15);
}

/**
 * 生成默认的 meal_summary（当 AI 返回为空时使用）
 */
function generateDefaultSummary(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return '暂无推荐';
  }
  const names = recommendations.map((r) => r.name).join('、');
  return `今晚推荐：${names}，荤素搭配，营养均衡。`;
}

/**
 * 从推荐列表中汇总去重的购物清单
 */
function collectShoppingList(recommendations) {
  const seen = new Set();
  const list = [];
  for (const rec of recommendations) {
    for (const item of (rec.missing_ingredients || [])) {
      if (!seen.has(item)) {
        seen.add(item);
        list.push(item);
      }
    }
  }
  return list;
}

/**
 * 判断是否为可重试的瞬态错误
 */
function isTransientError(err) {
  if (!err) return false;

  const status = err.status || err.statusCode;
  if (status === 429 || status === 529 || (status >= 500 && status < 600)) {
    return true;
  }

  // 网络层错误
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('overloaded')
  ) {
    return true;
  }

  return false;
}

/**
 * Promise 化的 sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { composeMeal };
