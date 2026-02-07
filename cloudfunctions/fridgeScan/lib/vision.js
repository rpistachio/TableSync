// cloudfunctions/fridgeScan/lib/vision.js
// Kimi 多模态 食材识别封装

const { chat } = require('./kimi');

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VALID_CATEGORIES = ['蔬菜', '肉类', '蛋类', '豆制品', '菌菇', '海鲜', '主食', '其他'];
const MAX_BASE64_LENGTH = 2 * 1024 * 1024;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

const SYSTEM_PROMPT = `你是一个严格的冰箱照片食材识别助手。用户会发送一张冰箱/厨房照片，你只能根据**图片中亲眼可见**的内容输出食材。

## 核心原则（必须遵守）
- **只输出图中明确出现的食材**：每一条 ingredients 必须能在照片里找到对应的可见物体（某块区域、某个容器里的东西）。不能根据常识、经验或“冰箱里常有”而添加图中没有的东西。
- **禁止猜测与脑补**：例如图中没有虾、没有鱼、没有某样菜，就绝不能把虾/鱼/那样菜写进 ingredients。拿不准的、看不清的，一律只写在 notes 里，不要列入 ingredients。
- **忽略**：饮料瓶、调味品瓶（酱油/醋/料酒等）、包装零食、保鲜膜/保鲜袋等非食材；水果除非可入菜（如柠檬）且图中可见。

## 输出规则
1. 只识别**可用于做菜的食材**且**必须在图中可见**（蔬菜、肉类、蛋类、豆制品、菌菇、海鲜等）。
2. quantity 尽量根据可见数量估计（如"2根"、"1块"、"约300g"），无法估计时写"适量"。
3. category 必须是以下之一：蔬菜、肉类、蛋类、豆制品、菌菇、海鲜、主食、其他。
4. name 用常见中文名（如"西红柿"而非"番茄"）。
5. 若照片不是冰箱/食材场景，或图中看不到任何食材，返回空数组 ingredients 并在 notes 说明。
6. confidence 取 0-1，表示你对「所列食材确实都在图中出现」的信心。

严格返回以下 JSON，不要多余文字或 markdown：
{
  "ingredients": [
    { "name": "食材名", "quantity": "估计数量", "category": "分类" }
  ],
  "confidence": 0.85,
  "notes": "补充说明（可为空字符串）"
}`;

async function recognizeIngredients({ imageBase64, mediaType, apiKey, model }) {
  if (!imageBase64 || !apiKey || !model) {
    throw new Error('[Vision] imageBase64、apiKey、model 不能为空');
  }
  const resolvedMediaType = mediaType || 'image/jpeg';
  if (!ALLOWED_MEDIA_TYPES.includes(resolvedMediaType)) {
    throw new Error(`[Vision] 不支持的图片类型: ${resolvedMediaType}`);
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    console.warn(`[Vision] 图片偏大，base64长度: ${imageBase64.length}`);
  }
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageUrl = `data:${resolvedMediaType};base64,${cleanBase64}`;

  console.log(`[Vision] Kimi 识图，模型: ${model}，base64长度: ${cleanBase64.length}`);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: '请只列出这张照片里**肉眼能直接看到**的、可用于做菜的食材。图中没有出现的东西不要写进列表，不确定的可以写在 notes 里。' },
      ],
    },
  ];

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
      const rawText = await chat({
        apiKey,
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.2,
      });
      if (!rawText) throw new Error('[Vision] API 返回内容为空');
      const parsed = safeParseJson(rawText);
      const validated = validateAndNormalize(parsed);
      console.log(`[Vision] 识别完成，共 ${validated.ingredients.length} 种食材，置信度: ${validated.confidence}`);
      return validated;
    } catch (err) {
      lastError = err;
      if (isTransientError(err) && attempt < MAX_RETRIES) continue;
      break;
    }
  }
  throw lastError;
}

function safeParseJson(raw) {
  let text = raw.trim();
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fencedMatch) text = fencedMatch[1].trim();
  if (!text.startsWith('{')) {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) text = text.slice(startIdx, endIdx + 1);
  }
  return JSON.parse(text);
}

function validateAndNormalize(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[Vision] 返回结果不是有效的 JSON 对象');
  }
  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const ingredients = rawIngredients
    .filter((item) => item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      quantity: (typeof item.quantity === 'string' && item.quantity.trim()) || '适量',
      category: VALID_CATEGORIES.includes(item.category) ? item.category : '其他',
    }));
  const seen = new Set();
  const deduped = ingredients.filter((ing) => {
    if (seen.has(ing.name)) return false;
    seen.add(ing.name);
    return true;
  });
  let confidence = parseFloat(parsed.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) confidence = 0.5;
  confidence = Math.round(confidence * 100) / 100;
  const notes = typeof parsed.notes === 'string' ? parsed.notes.trim() : '';
  return { ingredients: deduped, confidence, notes };
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

module.exports = { recognizeIngredients };
