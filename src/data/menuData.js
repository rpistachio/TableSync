/**

* 唯一对外出口：组合封装

* 内部调用 menuGenerator.generateMenu，再用返回的 recipe 派生 steps 和 shoppingList

* 不写 fallback、不写筛选规则，只做缓存 + 格式适配

*/



import * as generator from './menuGenerator.js';



const MEAT_LABEL_MAP = {
  chicken: '鸡肉',
  pork: '猪肉',
  beef: '牛肉',
  fish: '鱼肉',
  shrimp: '虾仁'
};

// 中文或英文 -> 英文键（调用 generator 前统一用英文），对外导出供页面做 query 转换
export const MEAT_KEY_MAP = {
  鸡肉: 'chicken', 猪肉: 'pork', 牛肉: 'beef', 鱼肉: 'fish', 虾仁: 'shrimp',
  chicken: 'chicken', pork: 'pork', beef: 'beef', fish: 'fish', shrimp: 'shrimp'
};

const VALID_TASTES = ['light', 'spicy', 'soup'];
const VALID_MEATS = ['chicken', 'pork', 'beef', 'fish', 'shrimp'];

const categoryOrder = { 蔬菜: 1, 肉类: 2, 蛋类: 2, 干货: 2, 调料: 3, 辅食: 4, 其他: 5 };

function normalizePreference(preference) {
  if (preference == null || typeof preference !== 'object') {
    return { taste: 'light', meat: 'chicken', adultCount: 2, babyMonth: 6, hasBaby: false };
  }
  let taste = preference.taste;
  let meat = preference.meat;
  const adultCount = Math.min(6, Math.max(1, Number(preference.adultCount) || 2));
  const babyMonth = Math.min(36, Math.max(6, Number(preference.babyMonth) || 6));
  const hasBaby = !!preference.hasBaby;
  if (!VALID_TASTES.includes(taste)) taste = 'light';
  meat = MEAT_KEY_MAP[meat] || (VALID_MEATS.includes(meat) ? meat : 'chicken');
  return { taste, meat, adultCount, babyMonth, hasBaby };
}



const cache = {};



/**

* 根据 preference 获取“翻译层”处理后的成人/宝宝菜谱（由 menuGenerator.generateMenu 筛选+替换）

*/

function getAdaptedRecipes(preference) {

const { taste, meat, adultCount, babyMonth, hasBaby } = normalizePreference(preference);

const key = `${taste}_${meat}_${babyMonth}_${adultCount}_${hasBaby}`;

if (!cache[key]) {

cache[key] = generator.generateMenu(taste, meat, babyMonth, hasBaby, adultCount);

}

const { adultRecipe, babyRecipe } = cache[key];

return { taste, meat, adultRecipe: adultRecipe || null, babyRecipe: babyRecipe || null };

}



/**

* 生成今日菜单（规则层只写在一处：menuGenerator.generateMenu）

* 缓存原始 adultRecipe / babyRecipe，返回前经翻译层替换占位符

*/

export function generateMenu(preference) {

const { taste, meat, adultRecipe: adultRecipe_, babyRecipe: babyRecipe_ } = getAdaptedRecipes(preference);



const adultMenu = adultRecipe_
  ? [{ name: adultRecipe_.name, time: adultRecipe_.time ?? 0 }]
  : [{ name: '今日主菜（请选择口味与主食材后重新生成）', time: 0 }];

const babyMenu = babyRecipe_
  ? { name: babyRecipe_.name, from: `共用食材：${MEAT_LABEL_MAP[meat]}` }
  : { name: `${MEAT_LABEL_MAP[meat]}系列辅食`, from: `共用食材：${MEAT_LABEL_MAP[meat]}，正在根据月龄定制` };



const totalTime =
  adultRecipe_ && babyRecipe_
    ? Math.max(adultRecipe_.time ?? 0, babyRecipe_.time ?? 0)
    : (adultRecipe_?.time ?? 0) || (babyRecipe_?.time ?? 0) || 0;
  const totalTimeDisplay = totalTime > 0 ? totalTime : 25;



const explanation = generator.generateExplanation(adultRecipe_, babyRecipe_);



return {
  taste,
  meat,
  adultMenu,
  babyMenu,
  totalTime: totalTimeDisplay,
  explanation
};

}



/**

* 供菜单页使用：返回完整菜单 + adultRecipe/babyRecipe（已按 babyMonth / adultCount 替换占位符）

*/

export function getTodayMenu(preference) {

const menu = generateMenu(preference);

const { adultRecipe, babyRecipe } = getAdaptedRecipes(preference);

return {

...menu,

adultRecipe: adultRecipe || null,

babyRecipe: babyRecipe || null

};

}



/**

* 直接基于已选中的 adultRecipe / babyRecipe 生成步骤（已按 babyMonth / adultCount 替换）

*/

export function generateSteps(preference) {

const { adultRecipe, babyRecipe } = getAdaptedRecipes(preference);

return generator.generateSteps(adultRecipe, babyRecipe);

}



/**

* 直接基于已选中的 adultRecipe / babyRecipe 生成购物清单（已按 babyMonth / adultCount 替换）

* 规则层返回 { name, category }[]，此处补充 id / amount / checked / order 以适配页面

*/

export function generateShoppingList(preference) {

const { adultRecipe, babyRecipe } = getAdaptedRecipes(preference);

const raw = generator.generateShoppingList(adultRecipe, babyRecipe);

let list = raw.map((item, idx) => ({
  id: idx + 1,
  name: item.name ?? '未知',
  amount: '适量',
  checked: false,
  category: item.category ?? '其他',
  order: categoryOrder[item.category] ?? 5,
  isShared: item.isShared ?? false
}));



if (list.length === 0) {
  list = [{ id: 1, name: '请先生成菜单后查看清单', amount: '—', checked: false, category: '其他', order: 99, isShared: false }];
}

return list;

}

/**
 * 根据 7 天偏好生成周购物清单：循环调用 generator.generateMenu 获取每日菜谱，
 * 汇总所有 adultRecipe.ingredients 与 babyRecipe.ingredients，再交给 generator.aggregateWeeklyIngredients 去重处理
 */
function getWeeklyPlaceholder() {
  return [{ id: 1, name: '请先在首页生成菜单', amount: '-', checked: false, category: '其他', order: 99 }];
}

export function generateWeeklyShoppingList(weeklyPreferences) {
  const prefs = Array.isArray(weeklyPreferences) ? weeklyPreferences.slice(0, 7) : [];
  if (prefs.length === 0) {
    return getWeeklyPlaceholder();
  }
  const allIngredients = [];

  for (const preference of prefs) {
    const { taste, meat, adultCount, babyMonth, hasBaby } = normalizePreference(preference);
    const { adultRecipe, babyRecipe } = generator.generateMenu(taste, meat, babyMonth, hasBaby, adultCount);
    if (adultRecipe?.ingredients) allIngredients.push(...adultRecipe.ingredients);
    if (babyRecipe?.ingredients) allIngredients.push(...babyRecipe.ingredients);
  }

  const raw = generator.aggregateWeeklyIngredients(allIngredients);
  let list = raw.map((item, idx) => ({
    id: idx + 1,
    name: item.name ?? '未知',
    amount: item.amount ?? '适量',
    checked: false,
    category: item.category ?? '其他',
    order: categoryOrder[item.category] ?? 5,
    isShared: item.isShared ?? false,
    isWeekly: item.isWeekly ?? true
  }));

  if (list.length === 0) {
    list = [{ id: 1, name: '请设置一周偏好后查看清单', amount: '—', checked: false, category: '其他', order: 99 }];
  }
  return list;
}