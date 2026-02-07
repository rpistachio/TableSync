// cloudfunctions/recipeImport/lib/recipe-extractor.js
// 截图 → Kimi Vision → 结构化菜谱 JSON

const { chat } = require('./kimi');

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64_LENGTH = 2 * 1024 * 1024;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

/**
 * 菜谱提取 System Prompt
 * 让 Kimi 从截图中提取出结构化的菜谱信息
 */
const SYSTEM_PROMPT = `你是一个菜谱结构化提取助手。用户会发送 1-5 张菜谱截图（来自小红书、抖音、菜谱 App 等），你需要从图片中提取菜谱信息并输出结构化 JSON。

## 核心原则
- **只提取图中明确出现的菜谱内容**，不要凭空编造食材或步骤
- 如果图片不包含菜谱信息，在 error 字段说明原因
- 如果多张图是同一个菜谱的不同部分，合并为一个菜谱输出
- 如果多张图包含不同菜谱，只提取最主要的那一个

## 输出规则

### 食材（ingredients）
- name：用常见中文名
- amount：数值（如 500、3、0），调料类写 0
- unit：单位（g、个、根、块、适量、少许 等）
- category：必须是以下之一：肉类、蔬菜、干货、调料、蛋类、豆制品、菌菇、海鲜、主食、乳制品、水果、其他

### 步骤（steps）
- action：只能是 "prep"（备菜）或 "cook"（烹饪）
- text：具体操作描述，要详细、可执行
- duration_num：该步骤预计分钟数（整数），不确定时合理估计

### 其他字段
- name：菜名
- cook_type：推断烹饪方式，必须是 stir_fry | stew | steam | cold_dress 之一
- meat：推断主料类型，必须是 chicken | pork | beef | fish | shrimp | vegetable 之一
- flavor_profile：推断风味，必须是 spicy | salty_umami | light | sweet_sour | sour_fresh 之一
- prep_time：备菜总时间（分钟），从 prep 步骤累加
- cook_minutes：烹饪总时间（分钟），从 cook 步骤累加
- source_author：原作者/博主名（如图中可见）
- serving：几人份（如图中可见，否则默认 2）

## 严格输出以下 JSON，不要多余文字或 markdown：
{
  "recipe": {
    "name": "菜名",
    "cook_type": "stir_fry",
    "meat": "pork",
    "flavor_profile": "salty_umami",
    "prep_time": 15,
    "cook_minutes": 15,
    "base_serving": 2,
    "ingredients": [
      { "name": "食材名", "amount": 500, "unit": "g", "category": "肉类" }
    ],
    "steps": [
      { "action": "prep", "text": "步骤描述", "duration_num": 10 },
      { "action": "cook", "text": "步骤描述", "duration_num": 15 }
    ]
  },
  "source_author": "@博主名",
  "confidence": 0.85,
  "error": ""
}`;

/**
 * 从截图中提取菜谱
 * @param {Object} opts
 * @param {Array<{base64: string, mediaType: string}>} opts.images - 图片数组
 * @param {string} opts.apiKey - Kimi API Key
 * @param {string} opts.model - Vision 模型名
 * @returns {Promise<Object>} 提取结果 { recipe, source_author, confidence, error }
 */
async function extractRecipeFromImages(opts) {
  const { images, apiKey, model } = opts;

  if (!images || images.length === 0) {
    throw new Error('[RecipeExtractor] 没有提供图片');
  }
  if (!apiKey || !model) {
    throw new Error('[RecipeExtractor] apiKey 和 model 不能为空');
  }

  // 构建多图消息内容
  const contentParts = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const resolvedType = img.mediaType || 'image/jpeg';
    if (!ALLOWED_MEDIA_TYPES.includes(resolvedType)) {
      console.warn(`[RecipeExtractor] 跳过不支持的图片类型: ${resolvedType}`);
      continue;
    }
    const cleanBase64 = img.base64.replace(/^data:image\/\w+;base64,/, '');
    if (cleanBase64.length > MAX_BASE64_LENGTH) {
      console.warn(`[RecipeExtractor] 图片 ${i} 过大，跳过`);
      continue;
    }
    contentParts.push({
      type: 'image_url',
      image_url: { url: `data:${resolvedType};base64,${cleanBase64}` },
    });
  }

  if (contentParts.length === 0) {
    throw new Error('[RecipeExtractor] 没有有效的图片可处理');
  }

  contentParts.push({
    type: 'text',
    text: '请从这些截图中提取菜谱信息，输出结构化 JSON。如果多张图是同一个菜谱的不同部分（如食材图+步骤图），请合并为一个完整菜谱。',
  });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: contentParts },
  ];

  console.log(`[RecipeExtractor] 开始提取，共 ${contentParts.length - 1} 张图片，模型: ${model}`);

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
        console.log(`[RecipeExtractor] 第 ${attempt + 1} 次重试`);
      }

      const rawText = await chat({
        apiKey,
        model,
        messages,
        max_tokens: 4096,
        temperature: 0.2,
      });

      if (!rawText) throw new Error('[RecipeExtractor] API 返回内容为空');

      const parsed = safeParseJson(rawText);
      const validated = validateResult(parsed);

      console.log(`[RecipeExtractor] 提取成功: "${validated.recipe.name}"，${(validated.recipe.ingredients || []).length} 种食材，${(validated.recipe.steps || []).length} 个步骤`);

      return validated;
    } catch (err) {
      lastError = err;
      console.warn(`[RecipeExtractor] 尝试 ${attempt + 1} 失败:`, err.message);
      if (isTransientError(err) && attempt < MAX_RETRIES) continue;
      break;
    }
  }

  throw lastError;
}

/**
 * 安全解析 JSON（处理 markdown 代码块包裹等情况）
 */
function safeParseJson(raw) {
  let text = raw.trim();
  // 去除 markdown 代码块
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fencedMatch) text = fencedMatch[1].trim();
  // 提取 JSON 对象
  if (!text.startsWith('{')) {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) text = text.slice(startIdx, endIdx + 1);
  }
  return JSON.parse(text);
}

/**
 * 验证并规范化提取结果
 */
function validateResult(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[RecipeExtractor] 返回结果不是有效 JSON 对象');
  }

  const recipe = parsed.recipe;
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('[RecipeExtractor] 返回结果缺少 recipe 字段');
  }

  if (!recipe.name || typeof recipe.name !== 'string') {
    throw new Error('[RecipeExtractor] 菜谱缺少名称');
  }

  // 确保 ingredients 和 steps 是数组
  if (!Array.isArray(recipe.ingredients)) recipe.ingredients = [];
  if (!Array.isArray(recipe.steps)) recipe.steps = [];

  // 确保数值字段
  recipe.prep_time = parseInt(recipe.prep_time, 10) || 0;
  recipe.cook_minutes = parseInt(recipe.cook_minutes, 10) || 0;
  recipe.base_serving = parseInt(recipe.base_serving, 10) || 2;

  let confidence = parseFloat(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) confidence = 0.5;

  return {
    recipe: recipe,
    source_author: parsed.source_author || '',
    confidence: Math.round(confidence * 100) / 100,
    error: parsed.error || '',
  };
}

function isTransientError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('socket hang up');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { extractRecipeFromImages };
