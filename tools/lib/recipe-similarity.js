/**
 * recipe-similarity core — 菜谱语义相似度引擎
 *
 * 多信号加权：菜名字符重叠 + 食材交集 + 维度匹配
 * 可被 generate.js / batch-planner 导入做前置检查。
 */

const DEVICE_PREFIXES = ['电饭煲', '空气炸锅', '微波炉', '微波'];

const METHOD_KEYWORDS = [
  '清炒', '红烧', '凉拌', '糖醋', '蒜蓉', '葱爆', '香煎', '清蒸',
  '清炖', '干锅', '水煮', '油炸', '炝炒', '爆炒', '蒜香', '椒盐',
  '香烤', '烤', '煎', '炖', '蒸', '煲', '焗', '卤', '炒',
];

const PROTEIN_KEYWORDS = [
  '鸡翅', '鸡腿', '鸡丁', '鸡丝', '滑鸡', '鸡蛋', '鸡',
  '排骨', '五花肉', '五花', '肉丝', '肉酱',
  '牛腩', '牛柳', '牛肉粒', '牛肉',
  '虾仁', '虾',
  '鳕鱼', '鲈鱼', '带鱼', '鱼块', '鱼头', '鱼',
  '羊排', '羊肉',
  '鸭', '乳鸽',
  '肥牛', '猪蹄',
];

const VEGGIE_KEYWORDS = [
  '杏鲍菇', '金针菇', '香菇', '口蘑', '菌菇',
  '娃娃菜', '油麦菜', '上海青', '荷兰豆', '西兰花', '花菜',
  '土豆', '豆腐', '青菜', '茄子', '黄瓜', '木耳', '菜心',
  '山药', '白菜', '秋葵', '腐竹', '包菜', '南瓜', '玉米',
  '笋', '萝卜', '韭菜', '藕', '冬瓜', '海带', '花生',
  '豆芽', '苦瓜', '芦笋', '番茄', '凉皮', '米线', '意面',
];

const ALL_INGREDIENTS = [...PROTEIN_KEYWORDS, ...VEGGIE_KEYWORDS];

export function stripDevicePrefix(name) {
  for (const d of DEVICE_PREFIXES) {
    if (name.startsWith(d)) return name.slice(d.length);
  }
  return name;
}

export function extractMethod(coreName) {
  for (const m of METHOD_KEYWORDS) {
    if (coreName.startsWith(m)) return m;
  }
  return '';
}

export function extractIngredients(coreName) {
  const found = [];
  let remaining = coreName;
  for (const ing of ALL_INGREDIENTS) {
    if (remaining.includes(ing)) {
      found.push(ing);
      remaining = remaining.replace(ing, '');
    }
  }
  return found;
}

export function parseRecipeName(name) {
  const core = stripDevicePrefix(name);
  const method = extractMethod(core);
  const ingredients = extractIngredients(core);
  return { original: name, core, method, ingredients };
}

function charBigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s[i] + s[i + 1]);
  }
  return set;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const x of setA) {
    if (setB.has(x)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

export function nameSimilarity(a, b) {
  const coreA = stripDevicePrefix(a);
  const coreB = stripDevicePrefix(b);
  if (coreA === coreB) return 1.0;
  return jaccardSimilarity(charBigrams(coreA), charBigrams(coreB));
}

export function ingredientSimilarity(parsedA, parsedB) {
  const ingA = parsedA.ingredients;
  const ingB = parsedB.ingredients;
  if (ingA.length === 0 && ingB.length === 0) return 0;
  if (ingA.length === 0 || ingB.length === 0) return 0;
  return jaccardSimilarity(new Set(ingA), new Set(ingB));
}

export function dimensionSimilarity(a, b) {
  const dims = ['meat', 'taste', 'flavor_profile', 'cook_type'];
  let matches = 0;
  let total = 0;
  for (const d of dims) {
    if (a[d] && b[d]) {
      total++;
      if (a[d] === b[d]) matches++;
    }
  }
  return total > 0 ? matches / total : 0;
}

const W_NAME = 0.35;
const W_INGREDIENT = 0.35;
const W_DIMENSION = 0.30;

export function computeSimilarity(recipeA, recipeB) {
  const parsedA = parseRecipeName(recipeA.name);
  const parsedB = parseRecipeName(recipeB.name);
  const nSim = nameSimilarity(recipeA.name, recipeB.name);
  const iSim = ingredientSimilarity(parsedA, parsedB);
  const dSim = dimensionSimilarity(recipeA, recipeB);

  let score = W_NAME * nSim + W_INGREDIENT * iSim + W_DIMENSION * dSim;
  let reason = '';

  const coreA = stripDevicePrefix(recipeA.name);
  const coreB = stripDevicePrefix(recipeB.name);
  if (coreA === coreB && recipeA.name !== recipeB.name) {
    score = Math.max(score, 0.90);
    reason = 'device-variant';
  }

  return { score, nSim, iSim, dSim, reason };
}

/**
 * 检查新菜谱列表与已有菜谱的相似度冲突。
 * 返回每道新菜谱的最高相似匹配（若超过阈值）。
 *
 * @param {Array} newRecipes  - 新生成的菜谱 [{name, meat, taste, ...}]
 * @param {Array} existingRecipes - 已有菜谱 [{name, meat, taste, ...}]
 * @param {number} threshold - 相似度阈值 (默认 0.55)
 * @returns {Array} 冲突列表 [{newName, existingName, score, reason}]
 */
export function checkConflicts(newRecipes, existingRecipes, threshold = 0.55) {
  const conflicts = [];
  for (const nr of newRecipes) {
    let best = { score: 0, name: '', reason: '' };
    for (const er of existingRecipes) {
      const sim = computeSimilarity(nr, er);
      if (sim.score > best.score) {
        best = { score: sim.score, name: er.name, reason: sim.reason };
      }
    }
    if (best.score >= threshold) {
      conflicts.push({
        newName: nr.name,
        existingName: best.name,
        score: best.score,
        reason: best.reason,
      });
    }
  }
  return conflicts;
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return;
    if (this.rank[rx] < this.rank[ry]) this.parent[rx] = ry;
    else if (this.rank[rx] > this.rank[ry]) this.parent[ry] = rx;
    else { this.parent[ry] = rx; this.rank[rx]++; }
  }
}

/**
 * 对菜谱集合做全量聚类，返回相似聚类组。
 */
export function clusterSimilarRecipes(recipes, threshold = 0.55) {
  const n = recipes.length;
  const pairs = [];
  const uf = new UnionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = computeSimilarity(recipes[i], recipes[j]);
      if (sim.score >= threshold) {
        pairs.push({ i, j, ...sim });
        uf.union(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  const clusters = [];
  for (const [, indices] of groups) {
    if (indices.length < 2) continue;
    const members = indices.map(idx => ({
      name: recipes[idx].name,
      id: recipes[idx].id,
      meat: recipes[idx].meat,
      taste: recipes[idx].taste,
      flavor_profile: recipes[idx].flavor_profile,
      cook_type: recipes[idx].cook_type,
    }));
    const relevantPairs = pairs
      .filter(p => indices.includes(p.i) && indices.includes(p.j))
      .map(p => ({
        a: recipes[p.i].name,
        b: recipes[p.j].name,
        score: p.score,
        reason: p.reason,
      }));
    clusters.push({ size: members.length, members, pairs: relevantPairs });
  }

  clusters.sort((a, b) => b.size - a.size);
  return { clusters, totalPairs: pairs.length };
}
