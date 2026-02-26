/**
 * 配料-步骤一致性校验（Node 版，供 tools 脚本使用）
 * 与 miniprogram/data/menuGenerator.js 中 validateIngredientStepConsistency 逻辑一致，
 * 并增加合并调料名、步骤数、调料数等警告。
 */

/**
 * @param {Object} recipe - 含 ingredients、steps 的菜谱对象
 * @returns {{ ok: boolean, missingInSteps: string[], mentionedNotInList: string[], warnings: string[], errors: string[] }}
 */
export function validateIngredientStepConsistency(recipe) {
  const missingInSteps = [];
  const mentionedNotInList = [];
  const warnings = [];
  const errors = [];

  if (!recipe) {
    return { ok: true, missingInSteps: [], mentionedNotInList: [], warnings: [], errors: [] };
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

  // --- 烹饪逻辑校验 ---
  const prepSteps = steps.filter((s) => (s && s.action === 'prep') || (s && s.step_type === 'prep'));
  const cookSteps = steps.filter((s) => (s && s.action === 'cook') || (s && (s.step_type === 'cook' || (!s.step_type && s.action !== 'prep'))));
  const prepText = prepSteps.map((s) => (s && s.text) || '').join(' ');
  const cookTexts = cookSteps.map((s) => (s && s.text) || '');

  // 6) 步骤顺序：含肉类时 prep 应有焯水或腌制
  const BLANCH_KEYWORDS = ['焯水', '飞水', '汆水', '焯烫', '过水'];
  const MARINATE_KEYWORDS = ['腌', '抓匀', '上浆', '码味'];
  const meatCategories = ['肉类', '海鲜'];
  const hasMeat = ingredients.some((it) => it && meatCategories.includes(it.category));
  const hasBlanch = BLANCH_KEYWORDS.some((k) => prepText.includes(k));
  const hasMarinate = MARINATE_KEYWORDS.some((k) => prepText.includes(k));
  if (hasMeat && !hasBlanch && !hasMarinate && cookSteps.some((s) => (s.text || '').match(/炒|煎|烧|焖|炖|煮/))) {
    warnings.push('含肉类且为炒/烧等做法时，prep 中应包含焯水或腌制步骤');
  }

  // 7) 必焯水食材：豆角类为安全红线（errors），其余为 warnings
  const BEAN_DANGER = ['豆角', '四季豆', '扁豆'];
  const MUST_BLANCH_OTHER = ['西兰花', '菠菜', '秋葵', '笋', '春笋', '冬笋'];
  const hasDangerousBean = ingredientNames.some((n) =>
    BEAN_DANGER.some((b) => n.includes(b) || b.includes(n)));
  const hasMustBlanchOther = ingredientNames.some((n) =>
    MUST_BLANCH_OTHER.some((b) => n.includes(b) || b.includes(n)));
  if (hasDangerousBean) {
    const hasBlanch = BLANCH_KEYWORDS.some((k) => fullText.includes(k));
    if (!hasBlanch) {
      const longHeatRe = /(?:焖|炖|煮|炒)[^，。]*?(\d+)\s*分钟/g;
      let hasLongHeat = false;
      let m;
      while ((m = longHeatRe.exec(fullText)) !== null) {
        if (parseInt(m[1], 10) >= 8) { hasLongHeat = true; break; }
      }
      if (!hasLongHeat) {
        errors.push('[安全] 豆角/四季豆必须焯水或加热 >= 8 分钟，未熟食用有中毒风险');
      }
    }
  }
  if (hasMustBlanchOther && !BLANCH_KEYWORDS.some((k) => fullText.includes(k))) {
    warnings.push('配料含需焯水食材（如笋、西兰花等），步骤中应体现焯水');
  }

  // 8) 火候矛盾：小火+爆炒、大火+炖煮 等
  const heatContradictions = [
    { heat: '小火', wrong: ['爆炒', '滑炒', '大火快炒'], msg: '爆炒/滑炒应为大火，不宜写小火' },
    { heat: '大火', wrong: ['炖', '煲', '慢炖', '焖煮'], msg: '炖/煲/焖应为先大火烧开再转小火，不宜全程大火' }
  ];
  for (const text of cookTexts) {
    for (const { heat, wrong, msg } of heatContradictions) {
      if (text.includes(heat) && wrong.some((w) => text.includes(w))) {
        const w = `火候逻辑：${msg}`;
        if (!warnings.includes(w)) warnings.push(w);
        break;
      }
    }
  }

  // 9) 调料时序：料酒不宜仅在出锅时加；香油/葱花不宜与大火爆炒同句
  if (fullText.includes('料酒') && fullText.includes('出锅') && !fullText.match(/料酒[^，。]*?(先|首先|先加|淋入|下锅|加热)/)) {
    const hasEarlyBajiu = cookTexts.some((t) => t.includes('料酒') && (t.includes('淋入') || t.includes('下锅') || t.includes('加热')));
    if (!hasEarlyBajiu && cookTexts.some((t) => t.includes('出锅') && t.includes('料酒'))) {
      warnings.push('料酒建议加热后尽早淋入去腥，不宜仅在出锅时加');
    }
  }
  cookTexts.forEach((text) => {
    if ((text.includes('香油') || text.includes('葱花')) && (text.includes('大火') || text.includes('爆炒') || text.includes('滑炒'))) {
      warnings.push('香油/葱花建议最后出锅时加，不宜与大火爆炒同步');
    }
  });

  // 10) 时间一致性：cook 步骤 duration_num 之和 vs cook_minutes
  const getStepDuration = (s) => {
    if (s && typeof s.duration_num === 'number' && s.duration_num > 0) return s.duration_num;
    return 0;
  };
  const prepSum = prepSteps.reduce((sum, s) => sum + getStepDuration(s), 0);
  const cookSum = cookSteps.reduce((sum, s) => sum + getStepDuration(s), 0);
  const prepTime = typeof recipe.prep_time === 'number' ? recipe.prep_time : 0;
  const cookMinutes = typeof recipe.cook_minutes === 'number' ? recipe.cook_minutes : 0;
  if (cookMinutes > 0 && cookSum > 0) {
    const ratio = cookSum / cookMinutes;
    if (ratio < 0.7 || ratio > 1.3) {
      warnings.push(`烹饪时间不一致：cook 步骤时长之和 ${cookSum} 分钟与 cook_minutes ${cookMinutes} 偏差超过 30%`);
    }
  }
  if (prepTime > 0 && prepSum > 0) {
    const ratio = prepSum / prepTime;
    if (ratio < 0.7 || ratio > 1.3) {
      warnings.push(`备菜时间不一致：prep 步骤时长之和 ${prepSum} 分钟与 prep_time ${prepTime} 偏差超过 30%`);
    }
  }

  // 11) 液体存在性：焖/炖/煮/收汁前必须有加水/加汤/加汁动作
  const NEED_LIQUID_ACTIONS = ['焖', '炖', '煮', '收汁', '焖煮'];
  const ADD_LIQUID_KEYWORDS = ['加水', '倒水', '加入清水', '倒入清水', '注入', '加汤', '倒入汤', '加入高汤', '加入酱汁', '倒入酱汁', '热水', '开水', '没过'];
  let textSoFar = '';
  for (let i = 0; i < cookSteps.length; i++) {
    const t = (cookSteps[i] && cookSteps[i].text) || '';
    if (NEED_LIQUID_ACTIONS.some((a) => t.includes(a))) {
      const priorAndCurrent = textSoFar + t;
      if (!ADD_LIQUID_KEYWORDS.some((k) => priorAndCurrent.includes(k))) {
        warnings.push('焖/炖/煮/收汁前步骤中须先出现加水/加汤/倒入酱汁等注入液体的动作');
        break;
      }
    }
    textSoFar += t;
  }

  // 12) 爆炒单步骤不应超过 3 分钟
  cookSteps.forEach((s) => {
    const text = (s && s.text) || '';
    const dur = getStepDuration(s);
    if ((text.includes('爆炒') || text.includes('滑炒') || text.includes('大火快炒')) && dur > 3) {
      warnings.push(`爆炒/滑炒步骤 duration_num=${dur} 分钟，建议不超过 3 分钟`);
    }
  });

  // 13) 叶菜类：盐应在关火前（最后一条 cook 步骤）加入
  const LEAFY_VEGS = ['菠菜', '空心菜', '青菜', '上海青', '油麦菜', '生菜', '娃娃菜', '包菜', '时蔬', '时令青菜', '荷兰豆'];
  const hasLeafy = ingredientNames.some((n) => LEAFY_VEGS.some((l) => n.includes(l)));
  if (hasLeafy && recipe.cook_type === 'stir_fry' && cookSteps.length > 0) {
    const lastCookText = (cookSteps[cookSteps.length - 1] && cookSteps[cookSteps.length - 1].text) || '';
    const saltInLast = lastCookText.includes('盐');
    const saltInEarlier = cookSteps.slice(0, -1).some((s) => ((s && s.text) || '').includes('盐'));
    if (saltInEarlier && !saltInLast) {
      warnings.push('叶菜类建议关火前最后加盐，过早放盐会出水变蔫');
    }
  }

  const ok = missingInSteps.length === 0 && mentionedNotInList.length === 0;
  return {
    ok,
    missingInSteps,
    mentionedNotInList,
    warnings,
    errors
  };
}
