/**
 * 配料-步骤一致性校验（Node 版，供 tools 脚本使用）
 * 与 miniprogram/data/menuGenerator.js 中 validateIngredientStepConsistency 逻辑一致，
 * 并增加合并调料名、步骤数、调料数等警告。
 */

/**
 * @param {Object} recipe - 含 ingredients、steps 的菜谱对象
 * @returns {{ ok: boolean, missingInSteps: string[], mentionedNotInList: string[], warnings: string[] }}
 */
export function validateIngredientStepConsistency(recipe) {
  const missingInSteps = [];
  const mentionedNotInList = [];
  const warnings = [];

  if (!recipe) {
    return { ok: true, missingInSteps: [], mentionedNotInList: [], warnings: [] };
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const stepTexts = steps.map((s) => (typeof s === 'object' && s && s.text != null ? s.text : s) || '');
  const fullText = stepTexts.join(' ');
  const ingredientNames = ingredients.map((it) => (typeof it === 'object' && it && it.name ? it.name : '')).filter(Boolean);

  // 1) 配料表中每一项都应在步骤文案中出现
  ingredients.forEach((it) => {
    const name = typeof it === 'string' ? it : (it && it.name);
    if (!name) return;
    if (fullText.indexOf(name) === -1) missingInSteps.push(name);
  });

  // 2) 步骤中常见调料/食材关键词应在配料表中有对应项
  const commonTerms = ['生抽', '老抽', '料酒', '蚝油', '盐', '糖', '白糖', '淀粉', '干淀粉', '姜', '蒜', '葱', '胡椒粉', '酱油', '醋', '食用油', '油', '蛋清', '姜片', '蒜末', '葱花'];
  commonTerms.forEach((term) => {
    if (fullText.indexOf(term) === -1) return;
    const found = ingredientNames.some((n) => n === term || n.indexOf(term) !== -1 || term.indexOf(n) !== -1);
    if (!found) mentionedNotInList.push(term);
  });

  // 3) 合并调料名称检测
  const mergedSeasoningPatterns = ['葱姜', '姜蒜', '姜葱', '蒜姜', '葱蒜'];
  ingredientNames.forEach((name) => {
    if (mergedSeasoningPatterns.some((p) => name === p || name.indexOf(p) !== -1)) {
      warnings.push(`配料使用合并名称「${name}」，应拆为独立条目（如葱、姜）`);
    }
  });

  // 4) 步骤数量不少于 2（至少 1 prep + 1 cook）
  const prepCount = steps.filter((s) => (s && s.action === 'prep') || (s && s.step_type === 'prep')).length;
  const cookCount = steps.filter((s) => (s && s.action === 'cook') || (s && (s.step_type === 'cook' || !s.step_type && s.action !== 'prep'))).length;
  if (steps.length < 2) {
    warnings.push('步骤数量少于 2，建议至少 1 条 prep + 1 条 cook');
  }
  if (prepCount < 1 && steps.length > 0) {
    warnings.push('缺少 prep（备菜）步骤');
  }
  if (cookCount < 1 && steps.length > 0) {
    warnings.push('缺少 cook（烹饪）步骤');
  }

  // 5) 调料品种数（排除盐和油）不少于 3 种
  const seasoningNames = ingredients
    .filter((it) => (it && it.category === '调料') || (it && (it.unit === '适量' || it.unit === '少许')))
    .map((it) => (it && it.name) || '')
    .filter(Boolean);
  const excludeFromCount = ['盐', '食用油', '油'];
  const seasoningCount = seasoningNames.filter((n) => !excludeFromCount.some((e) => n === e || n.indexOf(e) !== -1)).length;
  if (seasoningCount < 3 && recipe.cook_type === 'stir_fry') {
    warnings.push('炒菜类调料种类较少，建议至少 3 种（如生抽、料酒、蚝油等）');
  }

  const ok = missingInSteps.length === 0 && mentionedNotInList.length === 0;
  return {
    ok,
    missingInSteps,
    mentionedNotInList,
    warnings
  };
}
