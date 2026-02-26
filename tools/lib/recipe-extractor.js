/**
 * AI 菜谱内容提取：处理 URL（YouTube/抖音/网页）或粘贴文本，输出标准化 RefRecipe。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { callLlmForJson } from './llm-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * @typedef {Object} RefRecipe
 * @property {string} source - "xiachufang" | "icook" | "youtube" | "douyin" | "manual"
 * @property {string} [url]
 * @property {string} title
 * @property {{ name: string, amount?: string }[]} ingredients
 * @property {{ index: number, text: string }[]} steps
 * @property {string} crawled_at
 */

function loadExtractPrompt() {
  const p = path.join(__dirname, '..', 'templates', 'recipe-extract-prompt.md');
  if (!fs.existsSync(p)) throw new Error(`Extract prompt not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

/**
 * 从 URL 拉取 HTML 并提取正文文本（去标签、压缩空白）
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchTextFromUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, iframe, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text.slice(0, 30000);
}

/**
 * 从用户输入（URL 或纯文本）提取一条 RefRecipe
 * @param {string} input - URL 或粘贴的文本/字幕
 * @param {{ sourceLabel?: string }} [options] - 可选来源标签，如 "YouTube"、"抖音"
 * @returns {Promise<RefRecipe>}
 */
export async function extractRefRecipeFromInput(input, options = {}) {
  const systemPrompt = loadExtractPrompt();
  let userContent = input.trim();
  let urlUsed = '';

  if (/^https?:\/\//i.test(userContent)) {
    urlUsed = userContent;
    try {
      userContent = await fetchTextFromUrl(userContent);
      if (!userContent || userContent.length < 50) {
        userContent = input + '\n\n（上述 URL 页面正文过短，请根据 URL 或已知信息尽量推断菜谱。）';
      }
    } catch (e) {
      userContent = input + `\n\n（获取页面失败: ${e.message}，请根据 URL 或用户描述尽量推断菜谱。）`;
    }
  }

  const userMessage = `请从以下内容中提取菜谱信息，只输出一个 JSON 对象。\n\n内容：\n${userContent}`;
  const raw = await callLlmForJson(systemPrompt, userMessage, { maxTokens: 4096, temperature: 0.2 });

  const title = raw.title && String(raw.title).trim() || '未知菜名';
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((it) => ({
        name: (it && it.name) ? String(it.name).trim() : '',
        amount: (it && it.amount != null) ? String(it.amount).trim() : ''
      })).filter((it) => it.name)
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((s, i) => ({
        index: (s && typeof s.index === 'number') ? s.index : i + 1,
        text: (s && s.text) ? String(s.text).trim() : ''
      })).filter((s) => s.text)
    : [];

  let source = 'manual';
  const label = (raw.source_label && String(raw.source_label).trim()) || options.sourceLabel || '';
  if (/youtube|youtu\.be|油管/i.test(label) || /youtube|youtu\.be/i.test(urlUsed)) source = 'youtube';
  else if (/抖音|douyin|tiktok/i.test(label) || /douyin|iesdouyin/i.test(urlUsed)) source = 'douyin';
  else if (urlUsed) source = 'manual';

  return {
    source,
    url: urlUsed || undefined,
    title,
    ingredients,
    steps,
    crawled_at: new Date().toISOString()
  };
}

export default { extractRefRecipeFromInput };
