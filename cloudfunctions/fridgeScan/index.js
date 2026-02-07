// cloudfunctions/fridgeScan/index.js
// 冰箱扫描云函数 —— 主入口
// 管线：图片下载 → Vision 识别 → 菜谱匹配打分 → AI 组餐推荐 → 返回结果

const cloud = require('wx-server-sdk');
const { recognizeIngredients } = require('./lib/vision');
const { matchRecipes } = require('./lib/matcher');
const { composeMeal } = require('./lib/composer');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ── 密钥配置 ──────────────────────────────────────────────────
// 部署时放置 secret-config.json（已 gitignore），或通过微信云开发环境变量配置
let SECRET_CONFIG = {};
try {
  SECRET_CONFIG = require('./secret-config.json');
} catch (_) {
  console.warn('[fridgeScan] secret-config.json 未找到，将尝试从环境变量读取');
}

function getConfig(key) {
  const raw = SECRET_CONFIG[key] || process.env[key] || '';
  return typeof raw === 'string' ? raw.trim() : raw;
}

// ── 常量 ───────────────────────────────────────────────────────

/** 图片 base64 最大长度（约 1.5MB 原始文件 → base64 膨胀约 4/3 → ~2MB） */
const MAX_BASE64_LENGTH = 2 * 1024 * 1024;

/** 图片 base64 警告阈值（超过此值记录警告，仍正常处理） */
const WARN_BASE64_LENGTH = 1.5 * 1024 * 1024;

/** 数据库单次查询上限（微信云数据库限制） */
const DB_BATCH_LIMIT = 1000;

/** 候选菜谱数量：传给组餐模块的 top N（适当减少可缩短组餐 prompt 与响应） */
const TOP_CANDIDATES = 8;

/** 返回给前端的全量匹配结果数 */
const ALL_MATCHED_LIMIT = 20;

// ── 主入口 ─────────────────────────────────────────────────────

/**
 * 云函数入口
 * @param {Object} event - { fileID: string } 或 { imageUrl: string }
 * @param {Object} context - 云函数调用上下文
 * @returns {Object} { code: number, data?: Object, message?: string }
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  const timings = {};
  const { fileID, imageUrl } = event;

  console.log('[fridgeScan] 云函数启动', {
    fileID: fileID ? `${fileID.slice(0, 60)}...` : undefined,
    imageUrl: imageUrl ? `${imageUrl.slice(0, 60)}...` : undefined,
    requestId: context && context.request_id,
  });

  // ── 参数校验 ────────────────────────────────────────────────
  if (!fileID && !imageUrl) {
    return { code: 400, message: '请提供 fileID 或 imageUrl' };
  }

  const apiKey = getConfig('MOONSHOT_API_KEY');
  const visionModel = getConfig('MOONSHOT_VISION_MODEL') || 'moonshot-v1-8k-vision-preview';
  const textModel = getConfig('MOONSHOT_TEXT_MODEL') || 'moonshot-v1-8k';

  if (!apiKey) {
    return { code: 500, message: 'MOONSHOT_API_KEY 未配置，请在 secret-config.json 中配置（Kimi 月之暗面 API Key）' };
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // Step 1: 获取图片 base64
    // ═══════════════════════════════════════════════════════════
    let stepStart = Date.now();
    let imageBase64;
    let mediaType = 'image/jpeg';

    if (fileID) {
      const result = await downloadFromCloudStorage(fileID);
      imageBase64 = result.base64;
      mediaType = result.mediaType;
    } else {
      const result = await downloadFromUrl(imageUrl);
      imageBase64 = result.base64;
      mediaType = result.mediaType;
    }

    // 图片大小检查
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      const sizeMB = (imageBase64.length * 0.75 / 1024 / 1024).toFixed(2);
      return {
        code: 413,
        message: `图片过大（约 ${sizeMB} MB），请压缩至 1.5MB 以内再上传`,
      };
    }
    if (imageBase64.length > WARN_BASE64_LENGTH) {
      const sizeMB = (imageBase64.length * 0.75 / 1024 / 1024).toFixed(2);
      console.warn(`[Step1] 图片偏大（约 ${sizeMB} MB），可能影响响应速度`);
    }

    timings.step1_image_download_ms = Date.now() - stepStart;
    console.log(`[Step1] 图片获取完成，类型: ${mediaType}，base64长度: ${imageBase64.length}，耗时: ${timings.step1_image_download_ms}ms`);

    // Step 2 + 3 并行：Vision 识图 与 拉取菜谱 同时进行，减少总耗时
    stepStart = Date.now();
    const [visionResult, allRecipes] = await Promise.all([
      recognizeIngredients({ imageBase64, mediaType, apiKey, model: visionModel }),
      fetchAllAdultRecipes(),
    ]);
    timings.step2_vision_ms = Date.now() - stepStart; // 实际为两者最大值
    console.log(`[Step2] Vision 识别完成，识别到 ${(visionResult.ingredients || []).length} 种食材，置信度: ${visionResult.confidence}，耗时: ${timings.step2_vision_ms}ms`);

    // 未识别到食材：提前返回
    if (!visionResult || !visionResult.ingredients || visionResult.ingredients.length === 0) {
      return {
        code: 200,
        data: {
          ingredients: [],
          confidence: visionResult ? visionResult.confidence : 0,
          notes: visionResult ? visionResult.notes : '',
          recommendations: [],
          meal_summary: '',
          shopping_list: [],
          allMatched: [],
          timings,
          total_ms: Date.now() - startTime,
        },
        message: '未能从图片中识别出食材，请拍摄冰箱内部照片重试',
      };
    }

    // Step 3: 匹配打分（allRecipes 已在上面并行拉取）
    stepStart = Date.now();

    if (allRecipes.length === 0) {
      console.warn('[Step3] 数据库中没有 type=adult 的菜谱，返回仅识别结果');
      return {
        code: 200,
        data: {
          ingredients: visionResult.ingredients,
          confidence: visionResult.confidence,
          notes: visionResult.notes,
          recommendations: [],
          meal_summary: '数据库中暂无菜谱，无法生成推荐',
          shopping_list: [],
          allMatched: [],
          timings,
          total_ms: Date.now() - startTime,
        },
      };
    }
    console.log(`[Step3] 数据库共 ${allRecipes.length} 道菜谱，开始匹配`);

    const ranked = matchRecipes(visionResult.ingredients, allRecipes);
    timings.step3_match_ms = Date.now() - stepStart;
    console.log(`[Step3] 匹配打分完成，有效结果 ${ranked.length} 条，最高分: ${ranked.length > 0 ? ranked[0].score : 'N/A'}，耗时: ${timings.step3_match_ms}ms`);

    // 如果所有菜谱匹配分都是 0，说明没有可用的食材匹配
    if (ranked.length === 0 || ranked[0].score === 0) {
      console.warn('[Step3] 所有菜谱匹配分为 0，跳过组餐步骤');
      return {
        code: 200,
        data: {
          ingredients: visionResult.ingredients,
          confidence: visionResult.confidence,
          notes: visionResult.notes,
          recommendations: [],
          meal_summary: '识别到的食材暂未匹配到合适的菜谱',
          shopping_list: [],
          allMatched: [],
          timings,
          total_ms: Date.now() - startTime,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════
    // Step 4: AI 组餐推荐
    // ═══════════════════════════════════════════════════════════
    stepStart = Date.now();

    const topCandidates = ranked.slice(0, TOP_CANDIDATES);
    const meal = await composeMeal({
      ingredients: visionResult.ingredients,
      candidates: topCandidates,
      apiKey,
      model: textModel,
    });

    timings.step4_compose_ms = Date.now() - stepStart;
    console.log(`[Step4] AI 组餐完成，推荐 ${(meal.recommendations || []).length} 道菜，耗时: ${timings.step4_compose_ms}ms`);

    // ═══════════════════════════════════════════════════════════
    // Step 5: 组装并返回结果
    // ═══════════════════════════════════════════════════════════
    const totalMs = Date.now() - startTime;
    timings.total_ms = totalMs;

    console.log(`[fridgeScan] 管线全部完成，总耗时: ${totalMs}ms`, timings);

    return {
      code: 200,
      data: {
        // 食材识别结果
        ingredients: visionResult.ingredients,
        confidence: visionResult.confidence,
        notes: visionResult.notes,

        // AI 组餐推荐
        recommendations: meal.recommendations || [],
        meal_summary: meal.meal_summary || '',
        shopping_list: meal.shopping_list || [],

        // 全量匹配排行（前端可选展示"更多推荐"）
        allMatched: ranked.slice(0, ALL_MATCHED_LIMIT).map((r) => ({
          id: r.id || r._id,
          name: r.name,
          score: r.score,
          matchedIngredients: r.matchedIngredients,
          missingIngredients: r.missingIngredients,
          meat: r.meat,
          cook_type: r.cook_type,
          dish_type: r.dish_type,
        })),

        // 性能指标（调试用，前端可忽略）
        timings,
      },
    };
  } catch (err) {
    const totalMs = Date.now() - startTime;
    console.error('[fridgeScan] 云函数执行出错:', {
      message: err.message,
      stack: err.stack,
      timings,
      total_ms: totalMs,
    });
    const rawError = err.message || '';
    const is401 = rawError.includes('401') || rawError.includes('无效的令牌');
    const hint = is401
      ? ' 请到 https://platform.moonshot.cn 确认 Kimi API Key 已复制完整并重新部署。'
      : '';
    return {
      code: 500,
      message: '识别失败，请稍后重试' + hint,
      error: rawError,
    };
  }
};

// ── 辅助函数 ──────────────────────────────────────────────────

/**
 * 从微信云存储下载图片并转为 base64
 * @param {string} fileID - 云文件 ID
 * @returns {Promise<{ base64: string, mediaType: string }>}
 */
async function downloadFromCloudStorage(fileID) {
  console.log(`[Step1] 从云存储下载: ${fileID}`);

  const fileRes = await cloud.downloadFile({ fileID });

  if (!fileRes || !fileRes.fileContent) {
    throw new Error('[Step1] 云存储下载失败：fileContent 为空');
  }

  const base64 = fileRes.fileContent.toString('base64');

  // 根据文件后缀推断 mediaType
  let mediaType = 'image/jpeg';
  const lower = fileID.toLowerCase();
  if (lower.endsWith('.png')) mediaType = 'image/png';
  else if (lower.endsWith('.webp')) mediaType = 'image/webp';
  else if (lower.endsWith('.gif')) mediaType = 'image/gif';

  return { base64, mediaType };
}

/**
 * 通过 URL 下载图片并转为 base64
 * 支持 http 和 https 协议，检查响应状态码
 * @param {string} url - 图片 URL
 * @returns {Promise<{ base64: string, mediaType: string }>}
 */
async function downloadFromUrl(url) {
  console.log(`[Step1] 从 URL 下载: ${url.slice(0, 100)}`);

  // 根据协议选择模块
  const isHttps = url.startsWith('https');
  const httpModule = isHttps ? require('https') : require('http');

  const buffer = await new Promise((resolve, reject) => {
    const req = httpModule.get(url, (res) => {
      // 处理重定向（3xx）
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`[Step1] URL 重定向 ${res.statusCode} -> ${res.headers.location}`);
        const redirectModule = res.headers.location.startsWith('https') ? require('https') : require('http');
        redirectModule.get(res.headers.location, (redirectRes) => {
          if (redirectRes.statusCode !== 200) {
            reject(new Error(`[Step1] 重定向后 HTTP 状态码: ${redirectRes.statusCode}`));
            return;
          }
          collectBody(redirectRes, resolve, reject);
        }).on('error', reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`[Step1] HTTP 下载失败，状态码: ${res.statusCode}`));
        return;
      }

      collectBody(res, resolve, reject);
    });

    req.on('error', (err) => {
      reject(new Error(`[Step1] 网络请求错误: ${err.message}`));
    });

    // 30 秒超时
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('[Step1] URL 下载超时（30s）'));
    });
  });

  const base64 = buffer.toString('base64');

  // 从 URL 后缀或内容推断 mediaType
  let mediaType = 'image/jpeg';
  const lower = url.toLowerCase().split('?')[0]; // 去掉查询参数
  if (lower.endsWith('.png')) mediaType = 'image/png';
  else if (lower.endsWith('.webp')) mediaType = 'image/webp';
  else if (lower.endsWith('.gif')) mediaType = 'image/gif';

  return { base64, mediaType };
}

/**
 * 收集 HTTP 响应体为 Buffer
 */
function collectBody(res, resolve, reject) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => resolve(Buffer.concat(chunks)));
  res.on('error', (err) => reject(new Error(`[Step1] 数据接收错误: ${err.message}`)));
}

/**
 * 分页拉取全部 type=adult 的菜谱
 * 微信云数据库单次最多返回 1000 条，超过时需要分页
 * @returns {Promise<Array>} 菜谱数组
 */
async function fetchAllAdultRecipes() {
  const collection = db.collection('recipes');

  // 先获取总数
  const countRes = await collection.where({ type: 'adult' }).count();
  const total = countRes.total || 0;

  console.log(`[Step3] recipes 集合中 type=adult 共 ${total} 条`);

  if (total === 0) return [];

  // 单批次足够，直接查询
  if (total <= DB_BATCH_LIMIT) {
    const res = await collection
      .where({ type: 'adult' })
      .limit(DB_BATCH_LIMIT)
      .get();
    return res.data || [];
  }

  // 多批次分页查询
  const batchCount = Math.ceil(total / DB_BATCH_LIMIT);
  const tasks = [];
  for (let i = 0; i < batchCount; i++) {
    tasks.push(
      collection
        .where({ type: 'adult' })
        .skip(i * DB_BATCH_LIMIT)
        .limit(DB_BATCH_LIMIT)
        .get()
    );
  }

  const results = await Promise.all(tasks);
  const allRecipes = [];
  for (const res of results) {
    if (res.data) {
      allRecipes.push(...res.data);
    }
  }

  console.log(`[Step3] 分 ${batchCount} 批拉取，实际获取 ${allRecipes.length} 条`);
  return allRecipes;
}
