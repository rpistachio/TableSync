/**
 * AI 交叉校验：对待审菜谱对照参考菜谱打分，输出各维度分数与修改建议。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLlmForJson } from './llm-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OVERALL_PASS_THRESHOLD = 7;

/**
 * @typedef {Object} ReviewResult
 * @property {{ completeness: number, order: number, ingredients: number, safety: number, flavor_match: number }} scores
 * @property {number} overall
 * @property {string} verdict - "pass" | "warn" | "fail"
 * @property {string[]} suggestions
 * @property {boolean} needs_revision
 */

function loadReviewPrompt() {
  const p = path.join(__dirname, '..', 'templates', 'recipe-review-prompt.md');
  if (!fs.existsSync(p)) throw new Error(`Review prompt not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

/**
 * 对待审菜谱进行 AI 交叉校验
 * @param {Object} recipe - 待审菜谱（含 name, ingredients, steps 等）
 * @param {Array<{ title?: string, ingredients?: unknown[], steps?: unknown[] }>} refRecipes - 参考菜谱列表
 * @param {{ overallThreshold?: number }} [options]
 * @returns {Promise<ReviewResult>}
 */
export async function reviewRecipeWithRefs(recipe, refRecipes, options = {}) {
  const threshold = options.overallThreshold ?? OVERALL_PASS_THRESHOLD;
  const systemPrompt = loadReviewPrompt();
  const userMessage = [
    '请对以下「待审菜谱」对照「参考菜谱」进行交叉校验，只输出一个 JSON 对象（scores、overall、verdict、suggestions）。',
    '',
    '【待审菜谱】',
    JSON.stringify(recipe, null, 2),
    '',
    '【参考菜谱】',
    JSON.stringify(refRecipes || [], null, 2)
  ].join('\n');

  const raw = await callLlmForJson(systemPrompt, userMessage, { maxTokens: 2048, temperature: 0.2 });

  const scores = raw.scores && typeof raw.scores === 'object'
    ? {
        completeness: normalizeScore(raw.scores.completeness),
        order: normalizeScore(raw.scores.order),
        ingredients: normalizeScore(raw.scores.ingredients),
        safety: normalizeScore(raw.scores.safety),
        flavor_match: normalizeScore(raw.scores.flavor_match)
      }
    : { completeness: 5, order: 5, ingredients: 5, safety: 5, flavor_match: 5 };

  const overall = typeof raw.overall === 'number' && !Number.isNaN(raw.overall)
    ? Math.round(raw.overall * 10) / 10
    : (Object.values(scores).reduce((a, b) => a + b, 0) / 5);

  const verdict = ['pass', 'warn', 'fail'].includes(raw.verdict) ? raw.verdict : (overall >= threshold ? 'pass' : overall >= 5 ? 'warn' : 'fail');
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.map((s) => String(s)).filter(Boolean)
    : [];

  return {
    scores,
    overall,
    verdict,
    suggestions,
    needs_revision: overall < threshold
  };
}

function normalizeScore(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n * 10) / 10));
}

export default { reviewRecipeWithRefs };
