import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config.js';

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

/**
 * 调用 LLM，将原始输入（文本 / URL 描述 / 关键词）转换为结构化菜谱 JSON
 * 返回值严格为 JS 对象，而非字符串。
 * @param {Object} params
 * @param {string} params.mode - trending | url | text
 * @param {string} params.input - 用户输入
 * @param {number} params.count - 生成数量
 * @param {string[]} [params.excludeNames] - 已有菜名列表，LLM 应避免生成
 */
export async function generateRecipesFromInput({ mode, input, count, excludeNames }) {
  if (!CONFIG.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置，请在 tools/.env 中设置');
  }

  const opts = { apiKey: CONFIG.anthropicApiKey };
  // 支持第三方中转站：在 .env 中设置 ANTHROPIC_BASE_URL（不带 /v1）
  if (process.env.ANTHROPIC_BASE_URL) {
    opts.baseURL = process.env.ANTHROPIC_BASE_URL;
  }
  const client = new Anthropic(opts);
  const systemPrompt = loadSystemPrompt(excludeNames);

  const userInstruction = buildUserInstruction(mode, input, count);

  const msg = await client.messages.create({
    model: CONFIG.llmModel,
    max_tokens: 8192,
    temperature: 0.6,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userInstruction
      }
    ]
  });

  const text = (msg.content && msg.content[0] && msg.content[0].text) || '';
  return safeParseJson(text);
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
  // 兼容 ```json ... ``` 包裹的情况
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    lines.shift();
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    text = lines.join('\n');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`解析 LLM JSON 失败，请检查 system prompt 约束是否足够严格。\n原始内容片段：\n${text.slice(0, 300)}...`);
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
  if (!CONFIG.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置，请在 tools/.env 中设置');
  }

  const opts = { apiKey: CONFIG.anthropicApiKey };
  if (process.env.ANTHROPIC_BASE_URL) {
    opts.baseURL = process.env.ANTHROPIC_BASE_URL;
  }
  const client = new Anthropic(opts);
  const systemPrompt = loadOptimizeSystemPrompt();
  const userMessage = `请对以下 ${recipes.length} 道菜谱分别进行优化，严格按模板只返回每道菜的 id、ingredients、steps、baby_variant（若原无则补充）。\n\n输入菜谱 JSON：\n${JSON.stringify(recipes, null, 2)}`;

  const msg = await client.messages.create({
    model: CONFIG.llmModel,
    max_tokens: 8192,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  const text = (msg.content && msg.content[0] && msg.content[0].text) || '';
  return safeParseJson(text);
}
