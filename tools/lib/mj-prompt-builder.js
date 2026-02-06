import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedTemplates = null;

function loadTemplates() {
  if (cachedTemplates) return cachedTemplates;
  const p = path.join(__dirname, '..', 'templates', 'mj-style-template.md');
  const raw = fs.readFileSync(p, 'utf8');
  const lines = raw.split('\n').map((l) => l.trim());
  const t = lines.filter((l) => l.startsWith('`') && l.endsWith('`')).map((l) => l.slice(1, -1));
  if (t.length < 3) {
    throw new Error('mj-style-template.md 模版不足 3 条');
  }
  cachedTemplates = t.slice(0, 3);
  return cachedTemplates;
}

function inferContainer(recipe) {
  const isSoup = recipe.dish_type === 'soup' || (recipe.name || '').includes('汤');
  if (isSoup) {
    return 'in a dark ceramic bowl on a dark textured surface';
  }
  return 'on a dark textured plate on a dark textured surface';
}

function defaultEnglishName(chineseName, recipe) {
  // LLM 一般会给英文名，如果没有，则做一个简单的占位
  if (recipe && recipe.english_name) return recipe.english_name;
  return `Chinese home-style dish for ${chineseName}`;
}

/**
 * 基于模版为单个 item 生成 3 条 MJ prompts。
 * 如果 item 中已经有 mj_prompts，则只做补齐和规范化。
 */
export function buildPromptsForItem(item) {
  const recipe = item.recipe || {};
  const chineseName = recipe.name || '未知菜品';
  const englishName = defaultEnglishName(chineseName, recipe);
  const container = inferContainer(recipe);

  const templates = loadTemplates();

  const buildFromTemplate = (tpl) =>
    tpl
      .replace(/{{english_name}}/g, englishName)
      .replace(/{{chinese_name}}/g, chineseName)
      .replace(/{{container}}/g, container);

  const basePrompts = templates.map(buildFromTemplate);

  // 如果 LLM 已经提供 prompts，则优先使用原始，再用模版补齐长度至 3
  const fromModel = Array.isArray(item.mj_prompts) ? item.mj_prompts.filter(Boolean) : [];
  const merged = [...fromModel];
  for (let i = 0; i < basePrompts.length && merged.length < 3; i += 1) {
    merged.push(basePrompts[i]);
  }
  return merged.slice(0, 3);
}

/**
 * 对整批 items 进行 MJ prompt 填充。
 */
export function ensurePromptsForItems(raw) {
  if (!raw || !Array.isArray(raw.items)) return raw;
  return {
    ...raw,
    items: raw.items.map((it) => ({
      ...it,
      mj_prompts: buildPromptsForItem(it)
    }))
  };
}

