// cloudfunctions/recipeImport/index.js
// 外部菜谱导入云函数 —— 主入口
// 管线：截图下载 → Kimi Vision 识别 → 结构化提取 → 标准化 → 返回

const cloud = require('wx-server-sdk');
const { extractRecipeFromImages } = require('./lib/recipe-extractor');
const { normalizeRecipe } = require('./lib/normalizer');
const { fetchPageContent, extractTextFromHtml, detectPlatform } = require('./lib/link-fetcher');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ── 密钥配置 ──────────────────────────────────────────────────
let SECRET_CONFIG = {};
try {
  SECRET_CONFIG = require('./secret-config.json');
} catch (_) {
  console.warn('[recipeImport] secret-config.json 未找到，将尝试从环境变量读取');
}

function getConfig(key) {
  const raw = SECRET_CONFIG[key] || process.env[key] || '';
  return typeof raw === 'string' ? raw.trim() : raw;
}

// ── 常量 ───────────────────────────────────────────────────────

/** 图片 base64 最大长度（约 1.5MB 原始文件 → base64 膨胀约 4/3 → ~2MB） */
const MAX_BASE64_LENGTH = 2 * 1024 * 1024;

/** 最多处理的图片数量 */
const MAX_IMAGES = 5;

// ── 主入口 ─────────────────────────────────────────────────────

/**
 * 云函数入口
 * @param {Object} event
 *   截图导入: { mode: 'image', fileIDs: string[] }
 *   链接导入: { mode: 'link', url: string }
 * @param {Object} context - 云函数调用上下文
 * @returns {Object} { code, data?, message? }
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  const timings = {};
  const { mode = 'image', fileIDs = [], url = '' } = event;

  console.log('[recipeImport] 云函数启动', {
    mode,
    fileIDCount: fileIDs.length,
    url: url ? url.slice(0, 80) : '',
    requestId: context && context.request_id,
  });

  // ── 参数校验 ────────────────────────────────────────────────
  if (mode === 'image') {
    if (!fileIDs || fileIDs.length === 0) {
      return { code: 400, message: '请提供截图文件 fileIDs' };
    }
    if (fileIDs.length > MAX_IMAGES) {
      return { code: 400, message: `最多支持 ${MAX_IMAGES} 张截图` };
    }
  } else if (mode === 'link') {
    if (!url || typeof url !== 'string') {
      return { code: 400, message: '请提供有效的链接 URL' };
    }
    if (!detectPlatform(url)) {
      return { code: 400, message: '暂不支持该平台，目前支持小红书和抖音链接' };
    }
  } else if (mode === 'generateSteps') {
    const { recipeName, ingredients, rawText } = event;
    if (!recipeName || !Array.isArray(ingredients)) {
      return { code: 400, message: 'generateSteps 需要 recipeName 和 ingredients' };
    }
  } else {
    return { code: 400, message: `不支持的模式: ${mode}，当前支持 image、link、generateSteps` };
  }

  const apiKey = getConfig('MOONSHOT_API_KEY');
  const geminiKey = getConfig('GEMINI_API_KEY'); // 可选：配置后优先用 Gemini 极速解析（免费层）
  const visionModel = getConfig('MOONSHOT_VISION_MODEL') || 'moonshot-v1-8k-vision-preview';
  const textModel = getConfig('MOONSHOT_TEXT_MODEL') || 'moonshot-v1-8k';

  // generateSteps 必须用 Kimi
  if (mode === 'generateSteps' && !apiKey) {
    return {
      code: 500,
      message: 'MOONSHOT_API_KEY 未配置，生成步骤需要 Kimi。请在 secret-config.json 中配置',
    };
  }
  // 截图模式只用 Kimi Vision，必须配置 MOONSHOT_API_KEY
  if (mode === 'image' && !apiKey) {
    return {
      code: 500,
      message: '截图导入需要配置 MOONSHOT_API_KEY（在 secret-config.json）',
    };
  }
  // 链接模式至少需要 Gemini 或 Kimi 其一
  if (mode === 'link' && !geminiKey && !apiKey) {
    return {
      code: 500,
      message: '请至少配置 GEMINI_API_KEY 或 MOONSHOT_API_KEY 其一（在 secret-config.json）',
    };
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // 路由到不同处理模式
    // ═══════════════════════════════════════════════════════════
    if (mode === 'generateSteps') {
      return await handleGenerateSteps({
        recipeName: event.recipeName,
        ingredients: event.ingredients,
        rawText: event.rawText || '',
        apiKey,
        textModel,
        timings,
        startTime,
      });
    }

    if (mode === 'link') {
      if (geminiKey) {
        try {
          const fastResult = await handleFastLinkImport({ url, apiKey: geminiKey, timings, startTime });
          if (fastResult) return fastResult;
        } catch (e) {
          console.warn('[recipeImport] Gemini 链接解析失败:', e.message);
          if (!apiKey) {
            const hint = /timeout|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(e.message)
              ? '（国内云函数可能无法访问 Google API，建议配置 MOONSHOT_API_KEY 使用 Kimi）'
              : '';
            return {
              code: 500,
              message: 'Gemini 解析失败: ' + (e.message || '未知错误') + hint,
            };
          }
        }
      }
      if (!apiKey) {
        return { code: 500, message: '请配置 GEMINI_API_KEY 或 MOONSHOT_API_KEY（在 secret-config.json）' };
      }
      // 仅用 Kimi 极速解析（云函数 60 秒限制，完整解析易超时）
      return await handleFastKimiLinkImport({ url, apiKey, textModel, timings, startTime });
    }

    // ═══════════════════════════════════════════════════════════
    // mode === 'image': 截图导入流程（Kimi Vision 完整提取）
    // ═══════════════════════════════════════════════════════════

    // Step 1: 下载截图并转为 base64
    let stepStart = Date.now();
    console.log(`[Step1] 开始下载 ${fileIDs.length} 张截图`);

    const downloadResults = await Promise.all(
      fileIDs.map((fid) => downloadFromCloudStorage(fid))
    );

    // 过滤有效图片
    const validImages = downloadResults.filter((img) => {
      return img && img.base64 && img.base64.length <= MAX_BASE64_LENGTH;
    });

    if (validImages.length === 0) {
      return { code: 400, message: '没有有效的截图可处理，请确保图片大小在 1.5MB 以内' };
    }

    timings.step1_download_ms = Date.now() - stepStart;
    console.log(`[Step1] 下载完成，有效图片 ${validImages.length} 张，耗时: ${timings.step1_download_ms}ms`);

    // Step 2: Kimi Vision 完整提取（一次性返回食材+步骤）
    stepStart = Date.now();
    const extractResult = await extractRecipeFromImages({
      images: validImages,
      apiKey,
      model: visionModel,
    });
    timings.step2_extract_ms = Date.now() - stepStart;
    console.log(`[Step2] 菜谱提取完成，耗时: ${timings.step2_extract_ms}ms`);

    if (extractResult.error) {
      return {
        code: 422,
        message: extractResult.error || '无法从截图中识别出菜谱',
        data: { confidence: extractResult.confidence },
      };
    }

    if (!extractResult.recipe || !extractResult.recipe.name) {
      return {
        code: 422,
        message: '未能从截图中识别出有效菜谱，请确保截图包含完整的菜谱信息',
      };
    }

    // Step 3: 标准化菜谱
    stepStart = Date.now();

    const normalizedRecipe = normalizeRecipe(extractResult.recipe, {
      sourcePlatform: 'screenshot',
      sourceUrl: '',
      sourceAuthor: extractResult.source_author || '',
    });

    timings.step3_normalize_ms = Date.now() - stepStart;
    console.log(`[Step3] 标准化完成: "${normalizedRecipe.name}"，cook_type=${normalizedRecipe.cook_type}，meat=${normalizedRecipe.meat}，耗时: ${timings.step3_normalize_ms}ms`);

    // Step 4: 返回结果
    const totalMs = Date.now() - startTime;
    timings.total_ms = totalMs;

    console.log(`[recipeImport] 管线全部完成，总耗时: ${totalMs}ms`, timings);

    return {
      code: 200,
      data: {
        recipe: normalizedRecipe,
        confidence: extractResult.confidence,
        timings,
        fastParsed: !!extractResult._fastParsed,
      },
    };
  } catch (err) {
    const totalMs = Date.now() - startTime;
    console.error('[recipeImport] 云函数执行出错:', {
      message: err.message,
      stack: err.stack,
      timings,
      total_ms: totalMs,
    });

    const rawError = err.message || '';
    const is401 = rawError.includes('401') || rawError.includes('无效的令牌');
    const hint = is401
      ? ' 请到 https://platform.moonshot.cn 确认 Kimi API Key 并重新部署。'
      : '';

    return {
      code: 500,
      message: '菜谱识别失败，请稍后重试' + hint,
      error: rawError,
    };
  }
};

// ── Gemini 极速链接导入 ──────────────────────────────────────────

/**
 * Gemini 极速解析：仅提取食材，步骤留待二次请求
 */
async function handleFastLinkImport({ url, apiKey, timings, startTime }) {
  const { fastParse } = require('./lib/gemini-fast');
  const { fetchPageContent, extractTextFromHtml, detectPlatform } = require('./lib/link-fetcher');
  const { normalizeRecipe } = require('./lib/normalizer');

  let stepStart = Date.now();
  const { html, finalUrl, platform } = await fetchPageContent(url);
  const pageText = extractTextFromHtml(html);
  timings.step1_fetch_ms = Date.now() - stepStart;

  if (!pageText || pageText.length < 50) {
    return null;
  }

  stepStart = Date.now();
  const fastData = await fastParse({ text: pageText, apiKey });
  timings.step2_fast_ms = Date.now() - stepStart;

  const recipe = {
    name: fastData.name || '未命名菜谱',
    ingredients: fastData.ingredients || [],
    steps: [],
    cook_type: 'stir_fry',
    meat: 'vegetable',
    flavor_profile: 'salty_umami',
    prep_time: 0,
    cook_minutes: 0,
    base_serving: 2,
    _fastParsed: true,
  };

  const normalizedRecipe = normalizeRecipe(recipe, {
    sourcePlatform: platform === 'xiaohongshu' ? '小红书' : platform === 'douyin' ? '抖音' : 'unknown',
    sourceUrl: finalUrl || url,
    sourceAuthor: '',
  });
  normalizedRecipe.rawText = pageText.slice(0, 2000);
  normalizedRecipe._fastParsed = true;

  const totalMs = Date.now() - startTime;
  timings.total_ms = totalMs;

  return {
    code: 200,
    data: {
      recipe: normalizedRecipe,
      confidence: 0.75,
      timings,
      fastParsed: true,
    },
  };
}

// ── Kimi 极速链接导入（仅食材，步骤按需生成）────────────────────────

const KIMI_FAST_PROMPT = `仅提取食材和分量，严格输出 JSON，不要任何解释或 markdown。
必须包含字段：name（菜名）、ingredients（数组，每项含 name/amount/unit/category）。
示例：{"name":"蒜蓉粉丝虾","ingredients":[{"name":"虾仁","amount":200,"unit":"g","category":"海鲜"},{"name":"粉丝","amount":100,"unit":"g","category":"主食"}]}
category 限：肉类|蔬菜|调料|蛋类|豆制品|菌菇|海鲜|主食|乳制品|水果|干货|其他。`;

async function handleFastKimiLinkImport({ url, apiKey, textModel, timings, startTime }) {
  const { chat } = require('./lib/kimi');
  const { fetchPageContent, extractTextFromHtml } = require('./lib/link-fetcher');
  const { normalizeRecipe } = require('./lib/normalizer');

  let stepStart = Date.now();
  const { html, finalUrl, platform } = await fetchPageContent(url);
  const pageText = extractTextFromHtml(html);
  timings.step1_fetch_ms = Date.now() - stepStart;

  if (!pageText || pageText.length < 50) {
    return {
      code: 422,
      message: '无法从链接中提取到有效内容，可能是页面需要登录或内容被保护。请尝试使用截图方式导入。',
    };
  }

  stepStart = Date.now();
  const rawText = await chat({
    apiKey,
    model: textModel,
    messages: [
      { role: 'system', content: KIMI_FAST_PROMPT },
      { role: 'user', content: '请从以下文本中提取菜谱食材：\n\n' + pageText.slice(0, 4000) },
    ],
    max_tokens: 1024,
    temperature: 0.1,
  });
  timings.step2_fast_ms = Date.now() - stepStart;

  let parsed;
  try {
    let text = (rawText || '').trim();
    const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (m) text = m[1].trim();
    if (!text.startsWith('{')) {
      const si = text.indexOf('{');
      const ei = text.lastIndexOf('}');
      if (si !== -1 && ei > si) text = text.slice(si, ei + 1);
    }
    text = text.replace(/,(\s*[}\]])/g, '$1');
    parsed = JSON.parse(text);
  } catch (e) {
    console.warn('[recipeImport] Kimi 极速 JSON 解析失败:', e.message, 'raw 前 200 字:', (rawText || '').slice(0, 200));
    return { code: 422, message: '食材解析失败，请重试' };
  }

  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients
    : Array.isArray(parsed.食材) ? parsed.食材
    : [];
  const name = (parsed.name || parsed.菜名 || '未命名菜谱').trim();
  if (!name) {
    return { code: 422, message: '未识别到菜名，请重试' };
  }

  const recipe = {
    name: name,
    ingredients: ingredients,
    steps: [],
    cook_type: 'stir_fry',
    meat: 'vegetable',
    flavor_profile: 'salty_umami',
    prep_time: 0,
    cook_minutes: 0,
    base_serving: 2,
    _fastParsed: true,
  };

  const normalizedRecipe = normalizeRecipe(recipe, {
    sourcePlatform: platform === 'xiaohongshu' ? '小红书' : platform === 'douyin' ? '抖音' : 'unknown',
    sourceUrl: finalUrl || url,
    sourceAuthor: '',
  });
  normalizedRecipe.rawText = pageText.slice(0, 2000);
  normalizedRecipe._fastParsed = true;

  const totalMs = Date.now() - startTime;
  timings.total_ms = totalMs;

  return {
    code: 200,
    data: {
      recipe: normalizedRecipe,
      confidence: 0.75,
      timings,
      fastParsed: true,
    },
  };
}

// ── 生成步骤（二次请求）──────────────────────────────────────────

/**
 * 根据食材补全烹饪步骤（Kimi）
 */
async function handleGenerateSteps({ recipeName, ingredients, rawText, apiKey, textModel, timings, startTime }) {
  if (!apiKey) {
    return { code: 500, message: 'MOONSHOT_API_KEY 未配置' };
  }

  const { chat } = require('./lib/kimi');

  const STEPS_PROMPT = `根据菜名和食材列表，生成烹饪步骤。只输出 JSON，不要多余文字。
格式：{"steps":[{"action":"prep|cook","text":"步骤描述","duration_num":5}],"cook_type":"stir_fry|stew|steam|cold_dress","prep_time":10,"cook_minutes":15}
action 只能是 prep（备菜）或 cook（烹饪）。`;

  const userContent = `菜名：${recipeName}\n食材：${JSON.stringify(ingredients)}\n${rawText ? '原文参考：' + rawText.slice(0, 1500) : ''}`;

  let rawText2;
  try {
    rawText2 = await chat({
      apiKey,
      model: textModel,
      messages: [
        { role: 'system', content: STEPS_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });
  } catch (e) {
    return { code: 500, message: '步骤生成失败: ' + (e.message || '未知错误') };
  }

  let parsed;
  try {
    let text = (rawText2 || '').trim();
    const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (m) text = m[1].trim();
    if (!text.startsWith('{')) {
      const si = text.indexOf('{');
      const ei = text.lastIndexOf('}');
      if (si !== -1 && ei > si) text = text.slice(si, ei + 1);
    }
    parsed = JSON.parse(text);
  } catch (e) {
    return { code: 422, message: '步骤解析失败' };
  }

  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  const cook_type = ['stir_fry', 'stew', 'steam', 'cold_dress', 'bake'].includes(parsed.cook_type) ? parsed.cook_type : 'stir_fry';
  const prep_time = parseInt(parsed.prep_time, 10) || 0;
  const cook_minutes = parseInt(parsed.cook_minutes, 10) || 0;

  return {
    code: 200,
    data: {
      steps,
      cook_type,
      prep_time,
      cook_minutes,
    },
  };
}

// ── 链接导入处理（Kimi 完整）──────────────────────────────────────

/**
 * 链接导入管线：抓取页面 → 提取文本 → LLM 结构化 → 标准化
 */
async function handleLinkImport({ url, apiKey, textModel, timings, startTime }) {
  const { chat } = require('./lib/kimi');

  // Step 1: 抓取页面内容
  let stepStart = Date.now();
  console.log(`[Link-Step1] 开始抓取页面: ${url.slice(0, 80)}`);

  const { html, finalUrl, platform } = await fetchPageContent(url);
  const pageText = extractTextFromHtml(html);

  timings.step1_fetch_ms = Date.now() - stepStart;
  console.log(`[Link-Step1] 页面抓取完成，文本长度: ${pageText.length}，耗时: ${timings.step1_fetch_ms}ms`);

  if (!pageText || pageText.length < 50) {
    return {
      code: 422,
      message: '无法从链接中提取到有效内容，可能是页面需要登录或内容被保护。请尝试使用截图方式导入。',
    };
  }

  // Step 2: LLM 结构化提取
  stepStart = Date.now();
  console.log(`[Link-Step2] 开始 LLM 结构化提取`);

  const LINK_SYSTEM_PROMPT = `你是一个菜谱结构化提取助手。用户会发送从网页上抓取的文本内容（来自小红书、抖音等平台），你需要从文本中提取菜谱信息并输出结构化 JSON。

## 核心原则
- **只提取文本中明确出现的菜谱内容**，不要凭空编造食材或步骤
- 如果文本不包含菜谱信息，在 error 字段说明原因
- 如果文本包含多个菜谱，只提取最主要的那一个
- 对于网页噪音（广告、导航、评论等），请忽略，只关注菜谱内容

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
- cook_type：推断烹饪方式，必须是 stir_fry | stew | steam | cold_dress | bake 之一
- meat：推断主料类型，必须是 chicken | pork | beef | fish | shrimp | lamb | duck | shellfish | vegetable 之一
- flavor_profile：推断风味，必须是 spicy | salty_umami | light | sweet_sour | sour_fresh 之一
- prep_time：备菜总时间（分钟），从 prep 步骤累加
- cook_minutes：烹饪总时间（分钟），从 cook 步骤累加
- source_author：原作者/博主名（如文中可见）
- serving：几人份（如文中可见，否则默认 2）

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

  const messages = [
    { role: 'system', content: LINK_SYSTEM_PROMPT },
    { role: 'user', content: '以下是从网页抓取的文本内容，请从中提取菜谱信息：\n\n' + pageText },
  ];

  const rawText = await chat({
    apiKey,
    model: textModel,
    messages,
    max_tokens: 2048,
    temperature: 0.2,
  });

  if (!rawText) {
    return { code: 422, message: 'AI 无法从链接内容中识别出菜谱' };
  }

  // 解析 JSON
  let parsed;
  try {
    let text = rawText.trim();
    const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fencedMatch) text = fencedMatch[1].trim();
    if (!text.startsWith('{')) {
      const si = text.indexOf('{');
      const ei = text.lastIndexOf('}');
      if (si !== -1 && ei > si) text = text.slice(si, ei + 1);
    }
    parsed = JSON.parse(text);
  } catch (e) {
    return { code: 422, message: '菜谱内容解析失败，请尝试截图方式导入' };
  }

  timings.step2_llm_ms = Date.now() - stepStart;
  console.log(`[Link-Step2] LLM 提取完成，耗时: ${timings.step2_llm_ms}ms`);

  const recipe = parsed.recipe;
  if (!recipe || !recipe.name) {
    return {
      code: 422,
      message: parsed.error || '未能从链接中识别出有效菜谱',
    };
  }

  // 确保数组字段
  if (!Array.isArray(recipe.ingredients)) recipe.ingredients = [];
  if (!Array.isArray(recipe.steps)) recipe.steps = [];
  recipe.prep_time = parseInt(recipe.prep_time, 10) || 0;
  recipe.cook_minutes = parseInt(recipe.cook_minutes, 10) || 0;
  recipe.base_serving = parseInt(recipe.base_serving, 10) || 2;

  let confidence = parseFloat(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) confidence = 0.5;

  // Step 3: 标准化菜谱
  stepStart = Date.now();

  const normalizedRecipe = normalizeRecipe(recipe, {
    sourcePlatform: platform,
    sourceUrl: finalUrl || url,
    sourceAuthor: parsed.source_author || '',
  });

  // 保存原始文本用于后续优化
  normalizedRecipe.rawText = pageText.slice(0, 2000);

  timings.step3_normalize_ms = Date.now() - stepStart;
  console.log(`[Link-Step3] 标准化完成: "${normalizedRecipe.name}"，耗时: ${timings.step3_normalize_ms}ms`);

  // 返回结果
  const totalMs = Date.now() - startTime;
  timings.total_ms = totalMs;

  console.log(`[recipeImport-link] 管线全部完成，总耗时: ${totalMs}ms`, timings);

  return {
    code: 200,
    data: {
      recipe: normalizedRecipe,
      confidence: Math.round(confidence * 100) / 100,
      timings,
    },
  };
}

// ── 辅助函数 ──────────────────────────────────────────────────

/**
 * 从微信云存储下载图片并转为 base64
 * @param {string} fileID - 云文件 ID
 * @returns {Promise<{ base64: string, mediaType: string }>}
 */
async function downloadFromCloudStorage(fileID) {
  console.log(`[Download] 从云存储下载: ${fileID.slice(0, 60)}...`);

  try {
    const fileRes = await cloud.downloadFile({ fileID });

    if (!fileRes || !fileRes.fileContent) {
      console.warn(`[Download] 文件下载失败: ${fileID}`);
      return null;
    }

    const base64 = fileRes.fileContent.toString('base64');

    // 根据后缀推断 mediaType
    let mediaType = 'image/jpeg';
    const lower = fileID.toLowerCase();
    if (lower.endsWith('.png')) mediaType = 'image/png';
    else if (lower.endsWith('.webp')) mediaType = 'image/webp';
    else if (lower.endsWith('.gif')) mediaType = 'image/gif';

    return { base64, mediaType };
  } catch (err) {
    console.warn(`[Download] 下载失败: ${fileID}`, err.message);
    return null;
  }
}
