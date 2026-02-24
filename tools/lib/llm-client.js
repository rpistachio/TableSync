import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic, { APIConnectionError } from '@anthropic-ai/sdk';
import { CONFIG } from '../config.js';

/** 网络/连接类错误时重试次数 */
const CONNECTION_RETRIES = 3;
/** 重试间隔基数（毫秒），指数退避 */
const RETRY_DELAY_MS = 2000;

function isRetryableConnectionError(err) {
  if (err instanceof APIConnectionError) return true;
  const code = err?.cause?.code ?? err?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNREFUSED';
}

async function withRetry(fn) {
  let lastErr;
  for (let attempt = 1; attempt <= CONNECTION_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === CONNECTION_RETRIES || !isRetryableConnectionError(err)) throw err;
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function wrapConnectionError(err, baseURL) {
  if (!(err instanceof APIConnectionError) && !isRetryableConnectionError(err)) return err;
  let host = 'api.anthropic.com';
  if (baseURL) {
    try {
      host = new URL(baseURL.startsWith('http') ? baseURL : `https://${baseURL}`).host;
    } catch (_) {}
  }
  const hint = baseURL
    ? `当前使用代理/中转: ${baseURL}。请检查：1) 网络/VPN 是否可达 ${host}；2) 代理服务是否正常。`
    : `请检查网络是否可访问 api.anthropic.com。`;
  const wrapped = new Error(`连接 API 失败 (${host})：${err.message}\n${hint}`);
  wrapped.cause = err;
  return wrapped;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 最多注入到 system prompt 的排除菜名数量，避免列表过长导致请求卡顿 */
const EXCLUDE_LIST_CAP = 50;

function loadSystemPrompt(excludeNames) {
  const p = path.join(__dirname, '..', 'templates', 'recipe-system-prompt.md');
  if (!fs.existsSync(p)) {
    throw new Error(`System prompt template not found: ${p}`);
  }
  let text = fs.readFileSync(p, 'utf8');

  let excludeList = '（无）';
  if (Array.isArray(excludeNames) && excludeNames.length > 0) {
    const total = excludeNames.length;
    const names = total <= EXCLUDE_LIST_CAP
      ? excludeNames
      : excludeNames.slice(0, EXCLUDE_LIST_CAP);
    excludeList = names.map((name) => `- ${name}`).join('\n');
    if (total > EXCLUDE_LIST_CAP) {
      excludeList += `\n\n（以上为部分列举，数据库中另有共 ${total} 道菜，请勿生成与任何已有菜名相同或高度相似的名称。）`;
    }
  }
  text = text.replace(/\{\{EXCLUDE_LIST\}\}/g, excludeList);
  return text;
}

/** 单次请求的 count 上限，超过则拆成多批并行（每批耗时更短） */
const BATCH_SIZE = 5;

/** 从 Anthropic 格式的 content 数组中取出全部 text（MiniMax 会先返回 thinking 再返回 text） */
function getTextFromContent(content) {
  if (!Array.isArray(content) || content.length === 0) return '';
  const parts = [];
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block && block.type === 'text' && block.text) {
      parts.push(block.text);
    }
  }
  return parts.join('\n').trim() || (content[0] && content[0].text) || '';
}

/**
 * 单次调用 LLM 生成 n 道菜
 */
async function generateOneBatch({ mode, input, count, excludeNames, client, systemPrompt, baseURL, model }) {
  const userInstruction = buildUserInstruction(mode, input, count);
  const msg = await withRetry(() =>
    client.messages.create({
      model: model || CONFIG.llmModel,
      max_tokens: 8192,
      temperature: 0.6,
      system: systemPrompt,
      messages: [{ role: 'user', content: userInstruction }]
    })
  );
  const text = getTextFromContent(msg.content);
  if (!text || text.length < 10) {
    const rawPreview = msg.content && msg.content.length
      ? `content 共 ${msg.content.length} 个 block，首个 type=${msg.content[0] && msg.content[0].type}`
      : 'content 为空';
    throw new Error(`LLM 返回内容过短或为空（${rawPreview}）。若使用 MiniMax，请确认模型返回了 text 而非仅 thinking。`);
  }
  return safeParseJson(text);
}

/**
 * 调用 LLM，将原始输入（文本 / URL 描述 / 关键词）转换为结构化菜谱 JSON
 * 返回值严格为 JS 对象，而非字符串。
 * count >= 6 时自动拆成两批并行请求，总耗时约减半。
 * @param {Object} params
 * @param {string} params.mode - trending | url | text
 * @param {string} params.input - 用户输入
 * @param {number} params.count - 生成数量
 * @param {string[]} [params.excludeNames] - 已有菜名列表，LLM 应避免生成
 */
export async function generateRecipesFromInput({ mode, input, count, excludeNames }) {
  const useMiniMax = CONFIG.llmProvider === 'minimax';

  if (useMiniMax) {
    if (!CONFIG.minimaxApiKey) {
      throw new Error('MiniMax 为默认 LLM 但 MINIMAX_API_KEY 未配置，请在 tools/.env 中设置（海外站用同一 Key）');
    }
  } else {
    if (!CONFIG.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY 未配置，请在 tools/.env 中设置（或改用 MiniMax：不设 LLM_PROVIDER 时默认 minimax）');
    }
  }

  const opts = useMiniMax
    ? {
        apiKey: CONFIG.minimaxApiKey,
        baseURL: `https://${CONFIG.minimaxHost}/anthropic`
      }
    : {
        apiKey: CONFIG.anthropicApiKey,
        baseURL: process.env.ANTHROPIC_BASE_URL
      };
  const client = new Anthropic(opts);
  const model = useMiniMax ? CONFIG.minimaxLlmModel : CONFIG.llmModel;
  const systemPrompt = loadSystemPrompt(excludeNames);
  const baseURL = opts.baseURL;

  const providerName = useMiniMax ? 'MiniMax' : 'Claude';
  const n = Math.max(1, Number(count) || CONFIG.defaultGenerateCount);

  if (n <= BATCH_SIZE) {
    console.log(`正在请求 ${providerName}（${model}，约 30 秒–1 分钟）…`);
    try {
      return await generateOneBatch({
        mode,
        input,
        count: n,
        excludeNames,
        client,
        systemPrompt,
        baseURL,
        model
      });
    } catch (err) {
      throw wrapConnectionError(err, baseURL);
    }
  }

  const n1 = Math.ceil(n / 2);
  const n2 = n - n1;
  console.log(`正在并行请求 ${providerName}（两批 ${n1}+${n2} 道，约 30 秒–1 分钟）…`);
  let res1;
  let res2;
  try {
    [res1, res2] = await Promise.all([
      generateOneBatch({
        mode,
        input,
        count: n1,
        excludeNames,
        client,
        systemPrompt,
        baseURL,
        model
      }),
      generateOneBatch({
        mode,
        input,
        count: n2,
        excludeNames,
        client,
        systemPrompt,
        baseURL,
        model
      })
    ]);
  } catch (err) {
    throw wrapConnectionError(err, baseURL);
  }

  const items1 = (res1 && res1.items) || [];
  const items2 = (res2 && res2.items) || [];
  const seen = new Set(items1.map((it) => (it.recipe && it.recipe.name) || '').filter(Boolean));
  const merged = [...items1];
  for (const it of items2) {
    const name = it.recipe && it.recipe.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      merged.push(it);
    } else if (!name) {
      merged.push(it);
    }
  }
  return { items: merged };
}

function buildUserInstruction(mode, input, count) {
  const n = count || CONFIG.defaultGenerateCount;

  if (mode === 'url') {
    return `根据下面菜谱网页的内容，抽取或补全信息，生成 ${n} 道"适合家庭实做"的菜谱，返回严格 JSON：\n\nURL:\n${input}`;
  }
  if (mode === 'text') {
    return `根据下面的自然语言需求，设计 ${n} 道菜谱并返回严格 JSON：\n\n需求描述：\n${input}`;
  }
  // 默认 trending 模式：根据主题 / 季节 / 热点（排除列表已在 system prompt 中）
  return `请根据中国家庭晚餐/社媒热榜，围绕主题"${input}"生成 ${n} 道新的家庭菜谱，贴合之前示例的口味与复杂度，严格按 JSON Schema 输出。`;
}

function safeParseJson(raw) {
  let text = raw.trim();
  // 兼容 ```json ... ``` 或 ```\n...\n``` 包裹
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else if (text.startsWith('```')) {
    const lines = text.split('\n');
    lines.shift();
    if (lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop();
    }
    text = lines.join('\n').trim();
  }
  // 取第一个 { 到最后一个 } 之间的内容（兼容前面有说明文字）
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  // 去掉 JSON 中常见的尾逗号（LLM 常多打逗号）
  text = text.replace(/,(\s*[}\]])/g, '$1');
  // 修复 LLM 常见错误：未加双引号的属性名（如 baseAmount: 150 → "baseAmount": 150）
  text = text.replace(/([{,])\s*([a-zA-Z_$][\w$]*)\s*:/g, '$1 "$2":');
  try {
    return JSON.parse(text);
  } catch (e) {
    const snippet = text.slice(0, 600);
    throw new Error(
      `解析 LLM JSON 失败（${e.message}）。\n原始内容片段：\n${snippet}${text.length > 600 ? '...' : ''}`
    );
  }
}

/**
 * 加载食谱优化专用 system prompt（无占位符）
 */
function loadOptimizeSystemPrompt() {
  const p = path.join(__dirname, '..', 'templates', 'recipe-optimize-prompt.md');
  if (!fs.existsSync(p)) {
    throw new Error(`Optimize prompt template not found: ${p}`);
  }
  return fs.readFileSync(p, 'utf8');
}

/**
 * 调用 LLM 优化一批菜谱的 ingredients、steps、baby_variant
 * @param {Object[]} recipes - 完整菜谱对象数组（含 id, name, ingredients, steps 等）
 * @returns {Promise<{ items: Array<{ id, ingredients, steps, baby_variant }> }>}
 */
export async function optimizeRecipesWithLlm(recipes) {
  const useMiniMax = CONFIG.llmProvider === 'minimax';
  if (useMiniMax && !CONFIG.minimaxApiKey) {
    throw new Error('MiniMax 为默认 LLM 但 MINIMAX_API_KEY 未配置，请在 tools/.env 中设置');
  }
  if (!useMiniMax && !CONFIG.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置，请在 tools/.env 中设置');
  }

  const opts = useMiniMax
    ? { apiKey: CONFIG.minimaxApiKey, baseURL: `https://${CONFIG.minimaxHost}/anthropic` }
    : { apiKey: CONFIG.anthropicApiKey, baseURL: process.env.ANTHROPIC_BASE_URL };
  const client = new Anthropic(opts);
  const model = useMiniMax ? CONFIG.minimaxLlmModel : CONFIG.llmModel;
  const systemPrompt = loadOptimizeSystemPrompt();
  const userMessage = `请对以下 ${recipes.length} 道菜谱分别进行优化，严格按模板只返回每道菜的 id、ingredients、steps、baby_variant（若原无则补充）。\n\n输入菜谱 JSON：\n${JSON.stringify(recipes, null, 2)}`;
  const baseURL = opts.baseURL;

  let msg;
  try {
    msg = await withRetry(() =>
      client.messages.create({
        model,
        max_tokens: 8192,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    );
  } catch (err) {
    throw wrapConnectionError(err, baseURL);
  }

  const text = getTextFromContent(msg.content);
  return safeParseJson(text);
}
