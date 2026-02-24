// cloudfunctions/recipeCoverGen/lib/cover-prompt.js
// 与 tools/mj-style-template.md 一致的「暖调有食欲」风格，为外来菜谱生成封面用 prompt

/**
 * 容器描述：汤用碗，其他用盘（暖色容器与台面）
 */
function inferContainer(recipe) {
  const name = (recipe && recipe.name) || '';
  const isSoup = (recipe && recipe.dish_type === 'soup') || /汤|羹|粥/.test(name);
  if (isSoup) {
    return 'in a warm ceramic bowl on a wooden or stone surface';
  }
  return 'on a warm-toned plate on a wooden or stone surface';
}

/**
 * 英文描述（无 LLM 时用菜名占位）
 */
function defaultEnglishName(chineseName, recipe) {
  if (recipe && recipe.english_name) return recipe.english_name;
  return `Chinese home-style dish: ${chineseName}`;
}

/** 模版 A：俯拍，暖调有食欲，与 mj-style-template.md 一致 */
const TEMPLATE_TOP_DOWN =
  '{{english_name}}, {{chinese_name}}, {{container}}, top-down view, professional food photography, warm ambient lighting, appetizing, rich colors, inviting, cozy';

/**
 * 为单道菜生成一条封面用 MJ 风格 prompt（暗调高级感）
 * @param {Object} recipe - 至少含 name
 * @returns {string}
 */
function buildCoverPrompt(recipe) {
  if (!recipe || !recipe.name) return '';
  const chineseName = String(recipe.name).trim();
  const englishName = defaultEnglishName(chineseName, recipe);
  const container = inferContainer(recipe);
  return TEMPLATE_TOP_DOWN
    .replace(/\{\{english_name\}\}/g, englishName)
    .replace(/\{\{chinese_name\}\}/g, chineseName)
    .replace(/\{\{container\}\}/g, container);
}

module.exports = { buildCoverPrompt, inferContainer, defaultEnglishName };
