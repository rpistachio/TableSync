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

// ── cook_type → 成品视觉质感（中餐技法驱动）──────────────────
const COOK_VISUAL = {
  steam:     'natural color preserved, light soy drizzle, steamed moist and tender',
  stew:      'glossy rich brown sauce, syrupy caramelized sheen, braised, slow-braised depth',
  stir_fry:  'vibrant colors, crisp texture, light oil film, wok-fried glossy coating',
  air_fryer: 'golden crispy crust, shattered texture, oil droplets, juicy inside',
  cold_dress:'chilled, dressed in light vinaigrette, fresh and vibrant',
  salad:     'fresh salad, colorful, lightly dressed',
  soup:      'clear broth or milky white collagen soup, fresh herbs garnish',
};

// ── 菜名含中文技法词时覆盖/增强视觉描述（中餐专项）────────────
const NAME_COOK_VISUAL = {
  '红烧': 'glossy rich brown sauce, syrupy texture, caramelized sheen, braised not stew',
  '糖醋': 'glossy sweet-and-sour glaze, vibrant amber coating',
  '清炒': 'vibrant colors, crisp texture, light oil film',
  '白灼': 'jade-green blanched vegetables, crystal-clear sauce',
  '清蒸': 'natural color preserved, light soy drizzle, moist and tender',
  '煲':   'clear golden broth, slow-simmered depth, ceramic claypot',
  '炖':   'clear golden broth, slow-simmered depth, tender',
  '炸':   'golden crispy crust, shattered texture, oil droplets',
  '焖':   'glossy rich brown sauce, braised, caramelized sheen',
};

// ── flavor_profile → 颜色/质感提示 ─────────────────────────
const FLAVOR_VISUAL = {
  light:       'light-colored, clean, delicate',
  salty_umami:  'savory, rich brown tones, umami glaze',
  spicy:       'vibrant red chili flakes, spicy, bold colors',
  sweet_sour:  'glossy sweet-and-sour glaze, amber-red hue',
  sour_fresh:  'tangy, bright, with fresh herbs',
};

// ── meat → 主蛋白质英文名 ──────────────────────────────────
const MEAT_EN = {
  chicken:   'chicken',
  pork:      'pork',
  beef:      'beef',
  fish:      'fish',
  shrimp:    'shrimp',
  lamb:      'lamb',
  duck:      'duck',
  vegetable: 'vegetables',
};

// ── 中文食材名 → 英文（仅需翻译视觉可见的非调料食材） ──────
const INGREDIENT_EN = {
  // 肉类
  肋排: 'pork spare ribs', 排骨: 'pork ribs', 小排骨: 'baby back ribs',
  五花肉: 'pork belly', 猪蹄: 'pork trotters', 猪里脊: 'pork tenderloin',
  里脊肉: 'pork loin', 鸡胸肉: 'chicken breast', 鸡腿: 'chicken drumstick',
  鸡翅: 'chicken wings', 鸡翅中: 'chicken mid-wings', 鸡中翅: 'chicken wings',
  乌鸡: 'black-bone chicken', 老母鸡: 'whole chicken', 乳鸽: 'squab',
  鸭肉: 'duck meat', 鸭腿: 'duck leg',
  牛腩: 'beef brisket', 牛肉: 'beef', 牛里脊: 'beef tenderloin', 牛肉馅: 'ground beef',
  羊腿肉: 'lamb leg',
  // 海鲜
  鳕鱼: 'cod fillet', 鳕鱼片: 'cod fillet', 鲈鱼: 'sea bass', 海鲈鱼: 'sea bass',
  带鱼: 'hairtail fish', 龙利鱼片: 'sole fillet',
  虾: 'whole prawns', 虾仁: 'peeled shrimp', 鲜虾仁: 'fresh shrimp',
  海参: 'sea cucumber',
  // 蔬菜
  番茄: 'tomatoes', 胡萝卜: 'carrots', 土豆: 'potatoes', 南瓜: 'pumpkin',
  青椒: 'green peppers', 红椒: 'red peppers', 洋葱: 'onion',
  西兰花: 'broccoli', 花菜: 'cauliflower', 芥兰: 'Chinese broccoli',
  芦笋: 'asparagus', 秋葵: 'okra', 西芹: 'celery',
  娃娃菜: 'baby bok choy', 青菜: 'leafy greens', 菜心: 'choy sum',
  黄瓜: 'cucumber', 白萝卜: 'white radish', 莲藕: 'lotus root',
  韭黄: 'yellow chives', 韭菜: 'Chinese chives', 苦菊: 'endive',
  绿豆芽: 'bean sprouts', 杏鲍菇: 'king oyster mushroom',
  金针菇: 'enoki mushrooms', 香菇: 'shiitake mushrooms', 白玉兰菇: 'white shimeji mushrooms',
  干木耳: 'black wood ear mushroom with dark ruffled petal-like pieces', 干黑木耳: 'black wood ear mushroom with dark ruffled petal-like pieces', 魔芋结: 'konjac knots',
  香椿: 'Chinese toon sprouts', 折耳根: 'houttuynia',
  新鲜蚕豆: 'fresh fava beans', 玉米粒: 'corn kernels',
  // 干货 / 药材（视觉上可见的）
  红枣: 'red dates', 枸杞: 'goji berries', 桂圆: 'dried longan',
  竹荪: 'bamboo fungus', 银耳: 'snow fungus', 虫草花: 'cordyceps flowers',
  粉丝: 'glass noodles', 荞麦面: 'buckwheat noodles', 干海带丝: 'dried kelp strips',
  阳江豆豉: 'fermented black beans', 咸蛋黄: 'salted egg yolk',
  松仁: 'pine nuts', 花生: 'peanuts', 花生米: 'peanuts',
  九制话梅: 'preserved plum', 酸萝卜: 'pickled radish',
  云南火腿: 'Yunnan ham', 山药: 'Chinese yam',
  人参: 'ginseng', 党参: 'codonopsis root', 黄芪: 'astragalus',
  灵芝: 'reishi mushroom', 石斛: 'dendrobium',
  柠檬: 'lemon slices', 金桔: 'kumquats', 柚子皮: 'pomelo peel',
  // 调料中视觉明显的（用作 garnish）
  小米辣: 'fresh bird-eye chilies', 小米椒: 'red chilies',
  干辣椒: 'dried red chilies', 香菜: 'fresh cilantro',
  葱丝: 'shredded scallions', 葱花: 'chopped scallions',
  蒜片: 'sliced garlic', 姜丝: 'ginger shreds',
  白芝麻: 'white sesame seeds', 熟芝麻: 'toasted sesame seeds',
};

// 蛋类只有在菜名包含"蛋"时才作为可见食材（否则多为裹粉/蛋液，不可见）
const EGG_INGREDIENTS = new Set(['鸡蛋', '蛋清', '咸蛋黄']);
// 内部炖煮香料，不适合作为 garnish 描述
const HIDDEN_SPICES = new Set(['八角', '桂皮', '香叶', '当归']);

// 蛋花汤/羹类通用视觉词（菜名含 蛋花汤 或 羹 时强制注入，避免被画成面条）
const EGG_DROP_GENG_VISUAL = 'wispy silk-like egg drops floating in translucent broth, absolutely no noodles, delicate egg ribbons';

// 部分中餐固定描述。蛋花汤用中文主导，避免英文 soup/egg 触发模型的面条训练数据。
const DISH_SPECIFIC_EN = {
  '蒸水蛋': 'Chinese steamed egg custard 蒸水蛋, smooth yellow surface in bowl, not mashed potato',
  '番茄蛋花汤': '番茄蛋花汤，一碗清汤里飘着絮状的蛋花和番茄块，不是面条。' + EGG_DROP_GENG_VISUAL,
  '紫菜蛋花汤': '紫菜蛋花汤，一碗清汤里飘着絮状的蛋花和紫菜，不是面条。' + EGG_DROP_GENG_VISUAL,
  '丝瓜蛋花汤': '丝瓜蛋花汤，一碗清汤里飘着絮状的蛋花和丝瓜，不是面条。' + EGG_DROP_GENG_VISUAL,
  '番茄金针菇蛋花汤': '番茄金针菇蛋花汤，一碗清汤里飘着絮状的蛋花、番茄和金针菇，不是面条。' + EGG_DROP_GENG_VISUAL,
};

// 菜名关键词 → 英文描述（当 ingredients 缺失时从菜名中提取视觉线索）
const NAME_KEYWORD_EN = {
  紫菜: 'seaweed', 蛋花: 'silky egg ribbons in clear broth', 番茄: 'tomato', 玉米: 'corn',
  排骨: 'pork ribs', 牛腩: 'beef brisket', 鸡翅: 'chicken wings',
  鳕鱼: 'cod', 鲈鱼: 'sea bass', 龙利鱼: 'sole fillet', 带鱼: 'hairtail',
  虾: 'shrimp', 虾仁: 'shrimp', 鸡丁: 'diced chicken', 鸡腿: 'chicken drumstick',
  牛柳: 'beef strips', 五花肉: 'pork belly', 猪蹄: 'pork trotters',
  杏鲍菇: 'king oyster mushroom', 金针菇: 'enoki mushrooms',
  娃娃菜: 'baby bok choy', 西兰花: 'broccoli', 芦笋: 'asparagus',
  秋葵: 'okra', 南瓜: 'pumpkin', 土豆: 'potato', 莲藕: 'lotus root',
  松仁: 'pine nuts', 粉丝: 'glass noodles', 豆腐: 'tofu',
  豆豉: 'fermented black beans', 咖喱: 'curry', 椒盐: 'salt and pepper',
  话梅: 'preserved plum', 柠檬: 'lemon', 蒜蓉: 'minced garlic',
  葱: 'scallion', 姜: 'ginger',
  花旗参: 'American ginseng', 石斛: 'dendrobium', 黄芪: 'astragalus',
  竹荪: 'bamboo fungus', 银耳: 'snow fungus', 山药: 'Chinese yam',
  乌鸡: 'black-bone chicken', 乳鸽: 'squab',
  木耳: 'black wood ear mushroom with dark ruffled petal-like pieces',
  水蛋: 'Chinese steamed egg pudding filling the whole bowl, uniform pale-yellow silky smooth surface, like Korean gyeran-jjim, not a fried egg not a boiled egg',
  蒸蛋: 'Chinese steamed egg pudding filling the whole bowl, uniform pale-yellow silky smooth surface, like Korean gyeran-jjim, not a fried egg not a boiled egg',
  蛋: 'egg',
};

const SEASONING_CATEGORY = '调料';

/**
 * 从中文菜名中提取关键食材英文描述（按关键词长度降序匹配，避免子串冲突）。
 */
function extractKeywordsFromName(name) {
  const keys = Object.keys(NAME_KEYWORD_EN).sort((a, b) => b.length - a.length);
  const found = [];
  let remaining = name;
  for (const kw of keys) {
    if (remaining.includes(kw)) {
      found.push(NAME_KEYWORD_EN[kw]);
      remaining = remaining.replace(kw, '');
    }
  }
  return [...new Set(found)].slice(0, 3);
}

/**
 * 从 recipe 数据中提取视觉可见的关键食材英文名列表（最多 4 个）。
 * 过滤掉调料；蛋类仅在菜名含"蛋"时保留。
 */
function extractVisibleIngredients(recipe) {
  const list = recipe.ingredients;
  if (!Array.isArray(list) || !list.length) return [];
  const nameHasEgg = (recipe.name || '').includes('蛋');
  const visible = list
    .filter((i) => {
      if (i.category === SEASONING_CATEGORY) return false;
      if (EGG_INGREDIENTS.has(i.name) && !nameHasEgg) return false;
      return true;
    })
    .map((i) => INGREDIENT_EN[i.name])
    .filter(Boolean);
  return [...new Set(visible)].slice(0, 4);
}

/**
 * 从 recipe 的 ingredients 中找出视觉显著的调料/装饰（香菜、辣椒等）。
 * 排除八角、桂皮等内部炖煮香料。
 */
function extractVisibleGarnish(recipe) {
  const list = recipe.ingredients;
  if (!Array.isArray(list) || !list.length) return [];
  return list
    .filter((i) => i.category === SEASONING_CATEGORY && INGREDIENT_EN[i.name] && !HIDDEN_SPICES.has(i.name))
    .map((i) => INGREDIENT_EN[i.name])
    .filter(Boolean)
    .slice(0, 2);
}

/**
 * 构建精确的英文菜品描述，替代原来笼统的 english_name。
 * 优先使用 recipe.english_name（如果 LLM 提供了），否则自动推断。
 * 蛋花汤、蒸水蛋等用 DISH_SPECIFIC_EN 固定描述，避免被画成面条/土豆泥。
 */
function buildDishDescription(recipe) {
  if (recipe.english_name) return recipe.english_name;
  const specific = DISH_SPECIFIC_EN[recipe.name];
  if (specific) return specific;

  const parts = [];

  const name = recipe.name || '';
  const isSoup = recipe.dish_type === 'soup' || name.includes('汤');
  const effectiveCookType = isSoup ? 'soup' : recipe.cook_type;
  const cookDescFromType = COOK_VISUAL[effectiveCookType];
  const nameCookKey = Object.keys(NAME_COOK_VISUAL).sort((a, b) => b.length - a.length).find((kw) => name.includes(kw));
  const cookDesc = nameCookKey ? NAME_COOK_VISUAL[nameCookKey] : cookDescFromType;
  const mainIngredients = extractVisibleIngredients(recipe);
  const garnishes = extractVisibleGarnish(recipe);

  if (mainIngredients.length) {
    const [first, ...rest] = mainIngredients;
    parts.push(rest.length ? `${first} with ${rest.join(' and ')}` : first);
  } else {
    const nameKeywords = extractKeywordsFromName(recipe.name || '');
    if (nameKeywords.length) {
      parts.push(nameKeywords.join(' and '));
    } else {
      const protein = MEAT_EN[recipe.meat];
      if (protein) parts.push(protein);
    }
  }

  if (cookDesc) parts.push(cookDesc);

  const flavorDesc = FLAVOR_VISUAL[recipe.flavor_profile];
  if (flavorDesc) parts.push(flavorDesc);

  if (garnishes.length) {
    parts.push('garnished with ' + garnishes.join(' and '));
  }

  if ((name.includes('蛋花汤') || name.includes('羹')) && !DISH_SPECIFIC_EN[name]) {
    parts.push(EGG_DROP_GENG_VISUAL);
  }

  if (!parts.length) return `Chinese home-style dish ${recipe.name || ''}`;
  return parts.join(', ');
}

function inferContainer(recipe) {
  const name = recipe.name || '';
  const isSoup = recipe.dish_type === 'soup' || name.includes('汤');
  const isBowlDish = /蒸.*蛋|蛋.*羹|粥/.test(name);
  const isHongShao = /红烧|焖/.test(name);
  const isQingChao = /清炒|白灼|蒜蓉/.test(name);
  const isZheng = /清蒸|蒸/.test(name) && !/蒸.*蛋|蛋.*羹/.test(name);
  const isBao = /煲|砂锅/.test(name);
  if (isSoup || isBowlDish) {
    return 'in a traditional Chinese ceramic soup bowl on a dark textured surface';
  }
  if (isBao) {
    return 'in a sizzling Chinese clay pot on a dark textured surface';
  }
  if (isZheng) {
    return 'in a bamboo steamer basket on a dark textured surface';
  }
  if (isHongShao) {
    return 'on a dark glazed Chinese stoneware plate on a dark textured surface';
  }
  if (isQingChao) {
    return 'on a minimalist white porcelain plate on a dark textured surface';
  }
  return 'on a dark glazed Chinese stoneware plate on a dark textured surface';
}

/**
 * 按品类推断氛围描述：只有真正的热汤/蒸菜/煲仔才加蒸气，其他用适合的氛围词。
 */
function inferAtmosphere(recipe) {
  const name = recipe.name || '';
  const isSoup = recipe.dish_type === 'soup' || name.includes('汤');
  const isZheng = /清蒸|蒸/.test(name);
  const isBao = /煲|砂锅/.test(name);
  const isStew = recipe.cook_type === 'stew' || /炖|焖/.test(name);
  const isCold = recipe.cook_type === 'cold_dress' || recipe.cook_type === 'salad' || /凉拌|拍/.test(name);
  const isFried = recipe.cook_type === 'air_fryer' || /炸/.test(name);

  if (isSoup || isZheng || isBao) {
    return 'traditional Chinese ceramic dishware, wisps of steam rising gently, just-served warmth';
  }
  if (isStew) {
    return 'traditional Chinese ceramic dishware, chopsticks resting on bamboo rest, warm homestyle atmosphere';
  }
  if (isCold) {
    return 'traditional Chinese ceramic dishware, crisp fresh appearance, cool and refreshing';
  }
  if (isFried) {
    return 'traditional Chinese ceramic dishware, golden crunch visible, satisfying crispness';
  }
  return 'traditional Chinese ceramic dishware, chopsticks resting on bamboo rest, natural homestyle warmth';
}

/**
 * 基于模版为单个 item 生成 3 条 MJ prompts。
 * 如果 item 中已经有 mj_prompts，则只做补齐和规范化。
 */
export function buildPromptsForItem(item) {
  const recipe = item.recipe || {};
  const chineseName = recipe.name || '未知菜品';
  const englishName = buildDishDescription(recipe);
  const container = inferContainer(recipe);
  const atmosphere = inferAtmosphere(recipe);

  const templates = loadTemplates();

  const buildFromTemplate = (tpl) =>
    tpl
      .replace(/{{english_name}}/g, englishName)
      .replace(/{{chinese_name}}/g, chineseName)
      .replace(/{{container}}/g, container)
      .replace(/{{atmosphere}}/g, atmosphere);

  const basePrompts = templates.map(buildFromTemplate);

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
