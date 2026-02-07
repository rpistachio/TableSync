// cloudfunctions/fridgeScan/lib/matcher.js
// 食材-菜谱匹配算法：含同义词映射、主料/调料加权评分

/**
 * ═══════════════════════════════════════════
 * 中文食材同义词映射表（~55 组）
 * key 为标准名，value 为别名数组
 * ═══════════════════════════════════════════
 */
const SYNONYMS = {
  // ── 蔬菜类 ──────────────────────────────────
  '西红柿': ['番茄', '圣女果', '小番茄', '大番茄'],
  '土豆': ['马铃薯', '洋芋', '土豆块', '土豆丝', '土豆片'],
  '白菜': ['大白菜', '娃娃菜', '小白菜', '白菜帮'],
  '青椒': ['柿子椒', '菜椒', '甜椒', '彩椒', '杭椒', '灯笼椒'],
  '黄瓜': ['青瓜', '小黄瓜'],
  '茄子': ['长茄', '圆茄', '紫茄'],
  '胡萝卜': ['红萝卜', '胡萝卜丝'],
  '白萝卜': ['萝卜', '白玉萝卜'],
  '生菜': ['莴苣叶', '生菜叶'],
  '油麦菜': ['莜麦菜', '油麦'],
  '菜心': ['广东菜心', '小油菜'],
  '上海青': ['小青菜', '青菜', '小白菜'],
  '西兰花': ['花椰菜', '西蓝花', '绿花菜'],
  '花菜': ['菜花', '白花菜', '花椰菜'],
  '南瓜': ['金瓜', '老南瓜', '贝贝南瓜'],
  '冬瓜': ['白瓜', '冬瓜块'],
  '丝瓜': ['水瓜', '天丝瓜'],
  '苦瓜': ['凉瓜', '癞瓜'],
  '山药': ['淮山', '鲜淮山', '铁棍山药', '淮山药'],
  '豆角': ['四季豆', '扁豆', '豇豆', '长豆角', '芸豆'],
  '荷兰豆': ['豌豆荚', '甜豌豆'],
  '玉米': ['甜玉米', '玉米粒', '玉米棒', '玉米段'],
  '莲藕': ['藕', '藕片', '藕段'],
  '竹笋': ['笋', '春笋', '冬笋', '鲜笋', '笋片', '笋丝'],
  '韭菜': ['韭黄', '韭菜段'],
  '芹菜': ['西芹', '芹菜段'],
  '菠菜': ['波菜', '红根菜'],
  '洋葱': ['圆葱', '洋葱丝'],

  // ── 菌菇类 ──────────────────────────────────
  '蘑菇': ['香菇', '平菇', '口蘑', '蟹味菇', '白玉菇'],
  '金针菇': ['金菇'],
  '杏鲍菇': ['杏鲍菇片'],
  '木耳': ['黑木耳', '云耳', '木耳丝'],

  // ── 豆制品 ──────────────────────────────────
  '豆腐': ['老豆腐', '嫩豆腐', '北豆腐', '南豆腐', '豆腐块', '内酯豆腐'],
  '腐竹': ['油皮', '豆皮', '干豆皮'],
  '豆芽': ['绿豆芽', '黄豆芽'],

  // ── 肉类 ────────────────────────────────────
  '猪肉': ['五花肉', '里脊肉', '猪里脊', '肉末', '肉丝', '肉片', '瘦肉', '猪瘦肉', '猪肉片', '猪肉丝'],
  '排骨': ['猪排骨', '肋排', '小排', '排骨段'],
  '鸡肉': ['鸡胸肉', '鸡腿肉', '鸡翅', '鸡腿', '鸡胸', '鸡里脊', '鸡丁', '鸡块', '鸡丝'],
  '鸡翅': ['鸡中翅', '鸡翅中', '鸡翅根'],
  '牛肉': ['牛腩', '牛里脊', '肥牛', '牛肉片', '牛柳', '牛腱', '牛腱子'],
  '羊肉': ['羊肉片', '羊腿肉', '羊排'],
  '鸭肉': ['鸭腿', '鸭胸', '老鸭'],

  // ── 海鲜水产 ────────────────────────────────
  '虾': ['大虾', '明虾', '基围虾', '虾仁', '鲜虾', '白虾'],
  '鱼': ['鲈鱼', '鳕鱼', '草鱼', '鲫鱼', '黄花鱼', '龙利鱼', '带鱼', '鱼片', '鱼块'],

  // ── 蛋类 ────────────────────────────────────
  '鸡蛋': ['蛋', '鸡子', '土鸡蛋', '鲜鸡蛋', '蛋清', '蛋黄'],

  // ── 主食 / 干货 ─────────────────────────────
  '粉丝': ['粉条', '红薯粉', '龙口粉丝'],
  '面条': ['面', '挂面', '鲜面', '宽面'],
  '米饭': ['白饭', '大米', '米'],
  '紫菜': ['海苔', '干紫菜'],
  '海带': ['昆布', '海带结', '海带丝'],

  // ── 常用辅料 ────────────────────────────────
  '葱': ['大葱', '小葱', '香葱', '葱段', '葱花', '葱白', '葱丝'],
  '姜': ['生姜', '老姜', '姜片', '姜丝', '姜末', '姜蒜'],
  '蒜': ['大蒜', '蒜头', '蒜瓣', '蒜末', '蒜蓉'],
  '花生': ['花生米', '花生仁', '油炸花生'],
  '红枣': ['大枣', '枣', '干红枣'],
};

// ── 构建反向索引：别名 → 标准名 ─────────────────────
const _aliasToStandard = {};
for (const [standard, aliases] of Object.entries(SYNONYMS)) {
  _aliasToStandard[standard] = standard;
  for (const alias of aliases) {
    _aliasToStandard[alias] = standard;
  }
}

// 预排序的 key 列表（按长度降序，优先匹配更长的词）
const _sortedKeys = Object.keys(_aliasToStandard).sort((a, b) => b.length - a.length);

/**
 * 将食材名归一化为标准名
 * 策略：精确匹配 → 包含匹配（优先长词）→ 原名返回
 * @param {string} name - 食材原始名称
 * @returns {string} 标准化后的名称
 */
function normalize(name) {
  if (!name) return '';
  const trimmed = name.trim();

  // 1) 精确匹配
  if (_aliasToStandard[trimmed]) return _aliasToStandard[trimmed];

  // 2) 包含匹配：按词长降序尝试，确保"鸡胸肉"优先于"鸡"
  for (const key of _sortedKeys) {
    if (trimmed.includes(key)) {
      return _aliasToStandard[key];
    }
    if (key.includes(trimmed) && trimmed.length >= 2) {
      return _aliasToStandard[key];
    }
  }

  return trimmed;
}

/**
 * ═══════════════════════════════════════════
 * 肉类标准名 → recipe.meat 字段映射
 * ═══════════════════════════════════════════
 */
const MEAT_CATEGORY_MAP = {
  '鸡肉': 'chicken',
  '鸡翅': 'chicken',
  '鸭肉': 'chicken', // 家禽归为 chicken 大类
  '猪肉': 'pork',
  '排骨': 'pork',
  '牛肉': 'beef',
  '羊肉': 'pork',    // 当前菜谱中羊肉归类为 pork
  '虾': 'shrimp',
  '鱼': 'fish',
};

/**
 * Vision 食材分类 → recipe.meat 字段映射（用于 category 维度的额外匹配）
 */
const VISION_CATEGORY_TO_MEAT = {
  '肉类': null,    // 需要看具体食材名
  '海鲜': null,    // 需要看具体食材名
  '蛋类': null,
  '蔬菜': 'vegetable',
  '菌菇': 'vegetable',
  '豆制品': 'vegetable',
};

/**
 * ═══════════════════════════════════════════
 * 从菜谱中提取主料和调料列表
 * 兼容两种数据格式：
 *   A) recipe.main_ingredients / recipe.seasonings 已分离
 *   B) recipe.ingredients 统一数组（category='调料' 为调料，其余为主料）
 * ═══════════════════════════════════════════
 */
function extractMainIngredients(recipe) {
  // 格式 A：已有 main_ingredients
  if (Array.isArray(recipe.main_ingredients) && recipe.main_ingredients.length > 0) {
    return recipe.main_ingredients.map((item) =>
      typeof item === 'string' ? { name: item } : item
    );
  }

  // 格式 B：从统一 ingredients 数组中过滤
  if (Array.isArray(recipe.ingredients)) {
    return recipe.ingredients.filter(
      (ing) => ing.category !== '调料' && ing.baseAmount !== 0
    );
  }

  return [];
}

function extractSeasonings(recipe) {
  // 格式 A：已有 seasonings
  if (Array.isArray(recipe.seasonings) && recipe.seasonings.length > 0) {
    return recipe.seasonings;
  }

  // 格式 B：从统一 ingredients 数组中过滤
  if (Array.isArray(recipe.ingredients)) {
    return recipe.ingredients.filter(
      (ing) => ing.category === '调料' || ing.baseAmount === 0
    );
  }

  return [];
}

/**
 * ═══════════════════════════════════════════
 * 核心打分函数
 *
 * matchScore = (匹配主料数 / 菜谱主料总数) × 0.7
 *            + (匹配调料数 / 菜谱调料总数) × 0.1
 *            + categoryBonus                × 0.2
 *
 * categoryBonus（0 或 1）：用户食材中存在与菜谱 meat 字段
 * 对应的肉类时加分。素菜类菜谱若用户有 ≥1 种蔬菜也加分。
 * ═══════════════════════════════════════════
 *
 * @param {Array}  userIngredients - Vision 识别出的食材 [{ name, quantity, category }]
 * @param {Object} recipe          - 菜谱对象
 * @returns {{
 *   score: number,
 *   matchedIngredients: string[],
 *   missingIngredients: string[],
 *   mainMatchRatio: number,
 *   seasoningMatchRatio: number,
 *   categoryBonus: number
 * }}
 */
function scoreRecipe(userIngredients, recipe) {
  // 用户食材 → 标准名集合
  const userNormalized = userIngredients.map((ing) => normalize(ing.name));
  const userNormalizedSet = new Set(userNormalized);

  // ── 主料匹配 ──────────────────────────────────────────
  const mainIngredients = extractMainIngredients(recipe);
  let mainMatched = 0;
  const matchedNames = [];
  const missingNames = [];

  for (const item of mainIngredients) {
    const recipeName = normalize(item.name || '');
    if (userNormalizedSet.has(recipeName)) {
      mainMatched++;
      matchedNames.push(item.name);
    } else {
      missingNames.push(item.name);
    }
  }
  const mainScore = mainIngredients.length > 0
    ? mainMatched / mainIngredients.length
    : 0;

  // ── 调料匹配 ──────────────────────────────────────────
  const seasonings = extractSeasonings(recipe);
  let seasoningMatched = 0;
  for (const item of seasonings) {
    const seasonName = normalize(item.name || '');
    if (userNormalizedSet.has(seasonName)) {
      seasoningMatched++;
    }
  }
  const seasoningScore = seasonings.length > 0
    ? seasoningMatched / seasonings.length
    : 0;

  // ── 分类加分 ──────────────────────────────────────────
  let categoryBonus = 0;
  if (recipe.meat && recipe.meat !== 'vegetable') {
    // 荤菜：检查用户食材中是否有对应肉类
    for (const ing of userIngredients) {
      const std = normalize(ing.name);
      if (MEAT_CATEGORY_MAP[std] === recipe.meat) {
        categoryBonus = 1;
        break;
      }
    }
  } else if (recipe.meat === 'vegetable') {
    // 素菜：检查用户是否有任意蔬菜/菌菇/豆制品
    for (const ing of userIngredients) {
      const cat = (ing.category || '').trim();
      if (cat === '蔬菜' || cat === '菌菇' || cat === '豆制品') {
        categoryBonus = 1;
        break;
      }
    }
  }

  // ── 综合评分 ──────────────────────────────────────────
  const score = mainScore * 0.7 + seasoningScore * 0.1 + categoryBonus * 0.2;

  return {
    score: Math.round(score * 1000) / 1000,
    matchedIngredients: matchedNames,
    missingIngredients: missingNames,
    mainMatchRatio: Math.round(mainScore * 100) / 100,
    seasoningMatchRatio: Math.round(seasoningScore * 100) / 100,
    categoryBonus,
  };
}

/**
 * ═══════════════════════════════════════════
 * 对全部菜谱进行匹配打分并排序
 * ═══════════════════════════════════════════
 *
 * @param {Array} userIngredients - 用户冰箱食材 [{ name, quantity, category }]
 * @param {Array} recipes         - 数据库菜谱列表
 * @param {Object} [options]
 * @param {number} [options.minScore=0] - 最低分阈值，低于此分数的菜谱不返回
 * @param {number} [options.limit=0]    - 最多返回条数，0 表示不限制
 * @returns {Array} 按匹配分降序排列的菜谱（附带匹配详情）
 */
function matchRecipes(userIngredients, recipes, options) {
  const opts = options || {};
  const minScore = opts.minScore || 0;
  const limit = opts.limit || 0;

  if (!userIngredients || userIngredients.length === 0) {
    return [];
  }

  const results = [];

  for (const recipe of recipes) {
    const {
      score,
      matchedIngredients,
      missingIngredients,
      mainMatchRatio,
      seasoningMatchRatio,
      categoryBonus,
    } = scoreRecipe(userIngredients, recipe);

    if (score >= minScore) {
      results.push({
        ...recipe,
        score,
        matchedIngredients,
        missingIngredients,
        mainMatchRatio,
        seasoningMatchRatio,
        categoryBonus,
      });
    }
  }

  // 按分数降序排列；分数相同时优先主料匹配比例高的
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.mainMatchRatio - a.mainMatchRatio;
  });

  if (limit > 0) {
    return results.slice(0, limit);
  }

  return results;
}

/**
 * 批量归一化食材名（工具方法，供外部模块使用）
 * @param {Array} ingredientNames - 食材名数组
 * @returns {Array} 归一化后的名称数组（去重）
 */
function normalizeAll(ingredientNames) {
  const seen = new Set();
  const result = [];
  for (const name of ingredientNames) {
    const std = normalize(name);
    if (!seen.has(std)) {
      seen.add(std);
      result.push(std);
    }
  }
  return result;
}

module.exports = {
  matchRecipes,
  scoreRecipe,
  normalize,
  normalizeAll,
  extractMainIngredients,
  extractSeasonings,
  SYNONYMS,
  MEAT_CATEGORY_MAP,
};
