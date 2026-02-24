// cloudfunctions/recipeImport/lib/normalizer.js
// 菜谱标准化器 —— 将 AI 提取的外部菜谱数据标准化为内部数据结构

/**
 * 食材分类枚举
 */
const VALID_CATEGORIES = ['肉类', '蔬菜', '干货', '调料', '蛋类', '豆制品', '菌菇', '海鲜', '主食', '乳制品', '水果', '其他'];

/**
 * 烹饪方式映射
 */
const COOK_TYPE_MAP = {
  '炒': 'stir_fry',
  '煎': 'stir_fry',
  '爆': 'stir_fry',
  '炸': 'stir_fry',
  '溜': 'stir_fry',
  '炖': 'stew',
  '焖': 'stew',
  '煲': 'stew',
  '煮': 'stew',
  '烧': 'stew',
  '卤': 'stew',
  '蒸': 'steam',
  '白灼': 'steam',
  '白切': 'steam',
  '焗': 'bake',
  '烤': 'bake',
  '凉拌': 'cold_dress',
  '拌': 'cold_dress',
};

/**
 * 主料类型关键词映射
 */
const MEAT_KEYWORDS = {
  chicken: ['鸡', '鸡肉', '鸡腿', '鸡胸', '鸡翅', '鸡爪', '鸡块', '鸡丁', '鸡丝', '鸡柳'],
  pork: ['猪', '猪肉', '排骨', '五花', '里脊', '猪蹄', '肉丝', '肉片', '肉末', '腊肉', '培根', '腊肠', '香肠'],
  beef: ['牛', '牛肉', '牛腩', '牛腱', '牛柳', '牛排'],
  fish: ['鱼', '鳕鱼', '鲈鱼', '带鱼', '鲤鱼', '鲫鱼', '三文鱼', '鱼头', '鱼片', '鱼块'],
  shrimp: ['虾', '虾仁', '大虾', '基围虾', '龙虾', '小龙虾'],
  lamb: ['羊', '羊肉', '羊排', '羊腿'],
  duck: ['鸭', '鸭肉', '鸭腿', '鸭脖', '老鸭'],
  shellfish: ['蛤蜊', '扇贝', '鲍鱼', '小卷', '鱿鱼', '墨鱼', '蛏子', '牡蛎', '生蚝'],
  vegetable: ['素', '蔬菜', '豆腐', '鸡蛋', '蛋'],
};

/**
 * 口味风味关键词映射
 */
const FLAVOR_KEYWORDS = {
  spicy: ['辣', '麻辣', '香辣', '酸辣', '干辣', '泡椒', '剁椒', '辣椒', '辣子', '麻婆', '水煮', '火锅'],
  sweet_sour: ['糖醋', '酸甜', '番茄', '西红柿', '菠萝', '甜酸'],
  sour_fresh: ['酸', '柠檬', '醋', '凉拌', '开胃', '爽口'],
  light: ['清蒸', '白灼', '清炒', '蒸', '白切', '原味', '清淡'],
  salty_umami: [],  // 默认值
};

/**
 * 口味分类关键词映射（taste字段）
 */
const TASTE_KEYWORDS = {
  quick_stir_fry: ['炒', '煎', '爆', '溜', '炸', '快手'],
  slow_stew: ['炖', '焖', '煲', '煮', '烧', '卤', '慢炖'],
  steamed_salad: ['蒸', '拌', '凉拌', '白灼', '白切'],
};

/**
 * 标准化外部菜谱为内部数据结构
 * @param {Object} rawRecipe - AI 提取的原始菜谱对象
 * @param {Object} meta - 元数据 { sourcePlatform, sourceUrl, sourceAuthor }
 * @returns {Object} 标准化后的菜谱对象
 */
function normalizeRecipe(rawRecipe, meta) {
  if (!rawRecipe || typeof rawRecipe !== 'object') {
    throw new Error('[Normalizer] 输入菜谱不是有效对象');
  }

  const name = (rawRecipe.name || '未命名菜谱').trim();
  const now = Date.now();

  // 标准化食材
  const ingredients = normalizeIngredients(rawRecipe.ingredients || []);

  // 标准化步骤
  const steps = normalizeSteps(rawRecipe.steps || []);

  // 推断 cook_type
  const cookType = rawRecipe.cook_type
    ? normalizeCookType(rawRecipe.cook_type)
    : inferCookType(name, steps);

  // 推断 meat（主料类型）
  const meat = rawRecipe.meat
    ? rawRecipe.meat
    : inferMeat(name, ingredients);

  // 推断 flavor_profile
  const flavorProfile = rawRecipe.flavor_profile
    ? rawRecipe.flavor_profile
    : inferFlavorProfile(name, ingredients, steps);

  // 推断 taste（口味分类）
  const taste = rawRecipe.taste
    ? rawRecipe.taste
    : inferTaste(cookType, name, steps);

  // 计算时间
  const prepTime = rawRecipe.prep_time || estimatePrepTime(steps);
  const cookMinutes = rawRecipe.cook_minutes || estimateCookMinutes(cookType, steps);

  // 推断 dish_type
  const dishType = inferDishType(name, cookType);

  // 推断是否宝宝友好
  const isBabyFriendly = rawRecipe.is_baby_friendly != null
    ? !!rawRecipe.is_baby_friendly
    : inferBabyFriendly(flavorProfile, cookType);

  return {
    // 核心字段
    id: 'ext-' + now,
    name: name,
    type: 'adult',
    meat: meat,
    taste: taste,
    flavor_profile: flavorProfile,
    cook_type: cookType,
    dish_type: dishType || undefined,
    prep_time: prepTime,
    cook_minutes: cookMinutes,
    is_baby_friendly: isBabyFriendly,
    can_share_base: isBabyFriendly && (cookType === 'steam' || cookType === 'stew'),
    common_allergens: inferAllergens(ingredients),
    base_serving: rawRecipe.base_serving || 2,
    ingredients: ingredients,
    steps: steps,

    // 外部菜谱标记字段
    source: 'external',
    sourcePlatform: (meta && meta.sourcePlatform) || 'screenshot',
    sourceUrl: (meta && meta.sourceUrl) || '',
    sourceAuthor: (meta && meta.sourceAuthor) || '',
    importedAt: now,
    coverUrl: '',
    rawText: rawRecipe.rawText || '',
    isVerified: false,
  };
}

/**
 * 标准化食材数组
 */
function normalizeIngredients(rawIngredients) {
  if (!Array.isArray(rawIngredients)) return [];

  return rawIngredients
    .filter(function (item) {
      return item && typeof item === 'object' && item.name;
    })
    .map(function (item) {
      const name = String(item.name).trim();
      const category = inferIngredientCategory(name, item.category);

      return {
        name: name,
        baseAmount: parseAmount(item.baseAmount || item.amount || item.quantity),
        unit: normalizeUnit(item.unit || item.quantity || '适量'),
        category: category,
        sub_type: item.sub_type || undefined,
      };
    });
}

/**
 * 标准化步骤数组
 */
function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];

  return rawSteps
    .filter(function (step) {
      return step && (step.text || step.description || step.content);
    })
    .map(function (step, idx) {
      const text = String(step.text || step.description || step.content || '').trim();
      let action = step.action || '';

      // 如果没有 action，尝试推断
      if (!action || (action !== 'prep' && action !== 'cook')) {
        action = inferStepAction(text, idx);
      }

      return {
        action: action,
        text: text,
        duration_num: step.duration_num || step.duration || estimateStepDuration(text, action),
      };
    });
}

/**
 * 推断步骤是 prep 还是 cook
 */
function inferStepAction(text, idx) {
  const prepKeywords = ['洗', '切', '泡', '腌', '备', '剥', '去皮', '去籽', '处理', '准备', '浸泡', '沥干', '打散', '搅拌均匀', '抓匀', '码味'];
  var isPrep = false;
  for (var i = 0; i < prepKeywords.length; i++) {
    if (text.indexOf(prepKeywords[i]) !== -1) {
      isPrep = true;
      break;
    }
  }
  // 第一步大概率是备菜
  if (idx === 0) return 'prep';
  return isPrep ? 'prep' : 'cook';
}

/**
 * 推断食材分类
 */
function inferIngredientCategory(name, givenCategory) {
  if (givenCategory && VALID_CATEGORIES.indexOf(givenCategory) !== -1) {
    return givenCategory;
  }

  // 调料关键词
  var seasonings = ['盐', '酱油', '生抽', '老抽', '蚝油', '料酒', '醋', '糖', '白糖', '冰糖', '味精', '鸡精', '胡椒', '花椒', '八角', '桂皮', '香叶', '干辣椒', '辣椒粉', '豆瓣酱', '淀粉', '干淀粉', '水淀粉', '食用油', '油', '芝麻油', '香油', '葱', '姜', '蒜', '葱花', '姜片', '蒜末', '葱段', '姜丝', '蒜蓉', '小葱', '大葱', '洋葱', '五香粉', '十三香', '孜然', '咖喱粉', '番茄酱', '黄酱', '甜面酱', '豆豉', '腐乳'];
  for (var i = 0; i < seasonings.length; i++) {
    if (name === seasonings[i] || name.indexOf(seasonings[i]) !== -1) return '调料';
  }

  // 肉类关键词
  var meats = ['鸡', '猪', '牛', '羊', '鸭', '鹅', '排骨', '五花', '里脊', '腊肉', '培根', '腊肠', '香肠', '肉'];
  for (var j = 0; j < meats.length; j++) {
    if (name.indexOf(meats[j]) !== -1) return '肉类';
  }

  // 海鲜 / 水产
  var seafoods = ['鱼', '虾', '蟹', '蛤', '贝', '蚝', '鱿鱼', '墨鱼', '海参', '鲍鱼', '龙虾', '扇贝'];
  for (var k = 0; k < seafoods.length; k++) {
    if (name.indexOf(seafoods[k]) !== -1) return '海鲜';
  }

  // 蛋类
  if (name.indexOf('蛋') !== -1) return '蛋类';

  // 豆制品
  var beans = ['豆腐', '豆皮', '腐竹', '豆干', '豆芽'];
  for (var l = 0; l < beans.length; l++) {
    if (name.indexOf(beans[l]) !== -1) return '豆制品';
  }

  // 菌菇
  var mushrooms = ['菇', '菌', '木耳', '银耳', '香菇', '平菇', '金针菇', '杏鲍菇'];
  for (var m = 0; m < mushrooms.length; m++) {
    if (name.indexOf(mushrooms[m]) !== -1) return '菌菇';
  }

  // 主食
  var staples = ['米', '面', '粉', '馒头', '饺子', '面条', '米饭', '米线', '粉丝', '年糕', '饼'];
  for (var n = 0; n < staples.length; n++) {
    if (name.indexOf(staples[n]) !== -1) return '主食';
  }

  // 默认蔬菜
  return '蔬菜';
}

/**
 * 标准化 cook_type 字符串
 */
function normalizeCookType(ct) {
  if (!ct) return 'stir_fry';
  ct = String(ct).toLowerCase().trim();
  if (['stir_fry', 'stew', 'steam', 'cold_dress'].indexOf(ct) !== -1) return ct;
  // 尝试中文映射
  for (var key in COOK_TYPE_MAP) {
    if (ct.indexOf(key) !== -1) return COOK_TYPE_MAP[key];
  }
  return 'stir_fry';
}

/**
 * 从菜名和步骤推断 cook_type
 */
function inferCookType(name, steps) {
  var allText = name;
  for (var i = 0; i < steps.length; i++) {
    allText += ' ' + (steps[i].text || '');
  }

  // 优先级：凉拌 > 蒸 > 炖 > 炒
  if (allText.indexOf('凉拌') !== -1 || allText.indexOf('拌匀即可') !== -1) return 'cold_dress';
  if (allText.indexOf('蒸') !== -1 && allText.indexOf('清蒸') !== -1) return 'steam';
  if (allText.indexOf('炖') !== -1 || allText.indexOf('煲') !== -1 || allText.indexOf('焖') !== -1) return 'stew';
  if (allText.indexOf('蒸') !== -1) return 'steam';
  return 'stir_fry';
}

/**
 * 从菜名和食材推断主料类型
 */
function inferMeat(name, ingredients) {
  // 先按菜名匹配
  for (var meatType in MEAT_KEYWORDS) {
    var keywords = MEAT_KEYWORDS[meatType];
    for (var i = 0; i < keywords.length; i++) {
      if (name.indexOf(keywords[i]) !== -1) return meatType;
    }
  }

  // 再按食材匹配
  for (var j = 0; j < ingredients.length; j++) {
    var ingName = ingredients[j].name;
    var cat = ingredients[j].category;
    if (cat === '调料' || cat === '干货') continue;
    for (var mt in MEAT_KEYWORDS) {
      if (mt === 'vegetable') continue;
      var kws = MEAT_KEYWORDS[mt];
      for (var k = 0; k < kws.length; k++) {
        if (ingName.indexOf(kws[k]) !== -1) return mt;
      }
    }
  }

  return 'vegetable';
}

/**
 * 推断风味 flavor_profile
 */
function inferFlavorProfile(name, ingredients, steps) {
  var allText = name;
  for (var i = 0; i < ingredients.length; i++) allText += ' ' + ingredients[i].name;
  for (var j = 0; j < steps.length; j++) allText += ' ' + (steps[j].text || '');

  for (var flavor in FLAVOR_KEYWORDS) {
    var keywords = FLAVOR_KEYWORDS[flavor];
    for (var k = 0; k < keywords.length; k++) {
      if (allText.indexOf(keywords[k]) !== -1) return flavor;
    }
  }
  return 'salty_umami';
}

/**
 * 推断 taste 分类
 */
function inferTaste(cookType, name, steps) {
  if (cookType === 'stew') return 'slow_stew';
  if (cookType === 'steam' || cookType === 'cold_dress') return 'steamed_salad';
  return 'quick_stir_fry';
}

/**
 * 推断是否为汤类
 */
function inferDishType(name, cookType) {
  if (name.indexOf('汤') !== -1 || name.indexOf('煲') !== -1) return 'soup';
  return null;
}

/**
 * 推断是否宝宝友好
 */
function inferBabyFriendly(flavorProfile, cookType) {
  if (flavorProfile === 'spicy') return false;
  if (cookType === 'steam' || cookType === 'stew') return true;
  return flavorProfile === 'light';
}

/**
 * 推断过敏原
 */
function inferAllergens(ingredients) {
  var allergenMap = {
    '虾': '虾', '虾仁': '虾', '大虾': '虾',
    '鱼': '鱼', '鳕鱼': '鱼', '鲈鱼': '鱼', '带鱼': '鱼',
    '蛋': '蛋', '鸡蛋': '蛋', '蛋液': '蛋', '蛋清': '蛋', '蛋黄': '蛋',
    '花生': '花生', '花生米': '花生', '花生碎': '花生',
    '牛奶': '乳制品', '奶油': '乳制品', '黄油': '乳制品',
  };
  var allergens = [];
  for (var i = 0; i < ingredients.length; i++) {
    var ingName = ingredients[i].name;
    for (var key in allergenMap) {
      if (ingName.indexOf(key) !== -1) {
        var a = allergenMap[key];
        if (allergens.indexOf(a) === -1) allergens.push(a);
      }
    }
  }
  return allergens;
}

/**
 * 估算备菜时间
 */
function estimatePrepTime(steps) {
  var total = 0;
  for (var i = 0; i < steps.length; i++) {
    if (steps[i].action === 'prep') {
      total += (steps[i].duration_num || 5);
    }
  }
  return Math.max(total, 10);
}

/**
 * 估算烹饪时间
 */
function estimateCookMinutes(cookType, steps) {
  // 从步骤累加
  var total = 0;
  for (var i = 0; i < steps.length; i++) {
    if (steps[i].action === 'cook') {
      total += (steps[i].duration_num || 0);
    }
  }
  if (total > 0) return total;

  // 按烹饪方式估算
  switch (cookType) {
    case 'stew': return 60;
    case 'steam': return 15;
    case 'cold_dress': return 5;
    default: return 15;
  }
}

/**
 * 估算单步时间
 */
function estimateStepDuration(text, action) {
  // 尝试从文本中提取数字
  var match = text.match(/(\d+)\s*分钟/);
  if (match) return parseInt(match[1], 10);

  match = text.match(/(\d+)\s*min/i);
  if (match) return parseInt(match[1], 10);

  return action === 'prep' ? 5 : 8;
}

/**
 * 解析用量数值
 */
function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  var str = String(val);
  var num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * 标准化单位
 */
function normalizeUnit(unit) {
  if (!unit) return '适量';
  var str = String(unit).trim();
  // 如果是纯数字（从 quantity 字段来的），需提取单位
  var match = str.match(/[\d.]+\s*(g|kg|ml|L|个|根|块|片|颗|只|条|勺|汤匙|茶匙|大勺|小勺|适量|少许|把|棵|段|瓣)/);
  if (match) return match[1];
  // 已经是单位
  var validUnits = ['g', 'kg', 'ml', 'L', '个', '根', '块', '片', '颗', '只', '条', '勺', '汤匙', '茶匙', '大勺', '小勺', '适量', '少许', '把', '棵', '段', '瓣'];
  for (var i = 0; i < validUnits.length; i++) {
    if (str === validUnits[i]) return validUnits[i];
  }
  return '适量';
}

module.exports = { normalizeRecipe };
