import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from '../config.js';

let cachedApp = null;
let cachedDb = null;

function getDb() {
  if (cachedDb) return cachedDb;
  if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
    throw new Error('TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY 未配置，请在 tools/.env 中设置');
  }
  cachedApp = cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey
  });
  cachedDb = cachedApp.database();
  return cachedDb;
}

/**
 * 将本地 recipes.js 风格的 ingredients 拆分为
 * 云端期望的 main_ingredients / seasonings 结构。
 */
function splitIngredientsForCloud(ingredients = []) {
  const main = [];
  const seasonings = [];

  ingredients.forEach((item) => {
    if (!item || !item.name) return;
    const category = item.category || '';
    const isSeasoning =
      category === '调料' ||
      category === '佐料' ||
      // 没写 category 但 unit 是「适量」这类，按调料处理
      (!category && (item.unit === '适量' || item.unit === '少许'));

    if (isSeasoning) {
      seasonings.push({
        name: item.name,
        amount: typeof item.baseAmount === 'number' ? item.baseAmount : 0,
        unit: item.unit || '适量'
      });
    } else {
      main.push({
        name: item.name,
        amount: typeof item.baseAmount === 'number' ? item.baseAmount : 0,
        unit: item.unit || 'g',
        category: item.category || '其他',
        sub_type: item.sub_type
      });
    }
  });

  return { main_ingredients: main, seasonings };
}

/**
 * 校验并规范化 baby_variant 供云端写入：stages 非空，每项 max_month 为 number。
 * @param {Object} babyVariant - recipe.baby_variant
 * @returns {Object|null} 规范化后的 baby_variant 或 null
 */
function normalizeBabyVariantForCloud(babyVariant) {
  if (!babyVariant || !babyVariant.stages || !Array.isArray(babyVariant.stages) || babyVariant.stages.length === 0) {
    return null;
  }
  const stages = babyVariant.stages
    .filter((s) => s && typeof s.name === 'string' && typeof s.action === 'string')
    .map((s) => ({
      max_month: typeof s.max_month === 'number' ? s.max_month : Number(s.max_month) || 12,
      name: s.name.trim(),
      action: s.action.trim()
    }));
  if (stages.length === 0) return null;
  return { stages };
}

/**
 * 将本地 steps 简单数组升级为云端标准 steps：
 * - 补 step_index
 * - 推导 step_type（prep/cook）
 * - 补 duration_num（prep 默认 5，cook 默认 10）
 * 其余高级字段（actionType / parallel / waitTime / step_image_url）先给出合理默认值。
 */
function normalizeStepsForCloud(steps = []) {
  return steps.map((step, idx) => {
    const action = step && step.action ? step.action : 'cook';
    const stepType = action === 'prep' ? 'prep' : 'cook';
    const duration =
      typeof step.duration_num === 'number'
        ? step.duration_num
        : typeof step.duration_minutes === 'number'
          ? step.duration_minutes
          : stepType === 'prep'
            ? 5
            : 10;

    return {
      step_index: idx + 1,
      step_type: stepType,
      actionType: stepType === 'prep' ? 'idle_prep' : 'active',
      parallel: stepType === 'prep',
      waitTime: 0,
      duration_num: duration,
      action,
      text: step && step.text ? step.text : '',
      step_image_url: step && step.step_image_url ? step.step_image_url : ''
    };
  });
}

/**
 * 将本地 adult recipe 映射为云端 recipes 集合文档结构。
 * 保留原始字段（含 cuisine、tags 等），同时补充：
 * - main_ingredients / seasonings
 * - 标准化 steps
 * - cook_time（来自 cook_minutes，如有）
 * - baby_variant（显式校验并规范化后写入，便于大手牵小手功能）
 */
export function buildCloudRecipeDoc(recipe) {
  const { ingredients, steps, cook_minutes, baby_variant, ...rest } = recipe || {};

  const ing = splitIngredientsForCloud(Array.isArray(ingredients) ? ingredients : []);
  const normSteps = normalizeStepsForCloud(Array.isArray(steps) ? steps : []);

  const doc = {
    ...rest,
    ...ing,
    steps: normSteps
  };

  if (cook_minutes && typeof cook_minutes === 'number') {
    doc.cook_time = cook_minutes;
  }

  const normalizedBabyVariant = normalizeBabyVariantForCloud(baby_variant);
  if (normalizedBabyVariant) {
    doc.baby_variant = normalizedBabyVariant;
  }

  return doc;
}

/**
 * 分页拉取云端 recipes 集合中所有菜谱的 id 与 name，用于生成前去重。
 * @returns {Promise<{ ids: Set<string>, names: Set<string> }>}
 */
export async function fetchExistingNames() {
  const db = getDb();
  const coll = db.collection('recipes');
  const ids = new Set();
  const names = new Set();
  const PAGE = 100;
  let offset = 0;
  while (true) {
    const res = await coll.field({ id: true, name: true }).skip(offset).limit(PAGE).get();
    if (!res.data || res.data.length === 0) break;
    res.data.forEach((r) => {
      if (r.id) ids.add(r.id);
      if (r.name && typeof r.name === 'string') names.add(String(r.name).trim());
    });
    if (res.data.length < PAGE) break;
    offset += PAGE;
  }
  return { ids, names };
}

/**
 * 分页拉取云端 recipes 的分析字段（用于 batch-planner / recipe-similarity 等工具）。
 * 返回包含核心维度的精简文档数组。
 */
export async function fetchRecipesForAnalysis() {
  const db = getDb();
  const coll = db.collection('recipes');
  const results = [];
  const PAGE = 100;
  let offset = 0;
  const fields = {
    id: true, name: true, type: true,
    meat: true, taste: true, flavor_profile: true,
    cook_type: true, dish_type: true, is_baby_friendly: true,
    can_share_base: true, prep_time: true, cook_minutes: true,
    cook_time: true, common_allergens: true, base_serving: true,
  };
  while (true) {
    const res = await coll.field(fields).skip(offset).limit(PAGE).get();
    if (!res.data || res.data.length === 0) break;
    results.push(...res.data);
    if (res.data.length < PAGE) break;
    offset += PAGE;
  }
  return results;
}

/**
 * 将成人菜谱写入云端 recipes 集合。
 * 若云端已存在同名且 type='adult' 的文档，则执行更新，避免重复插入（如融合车间 Approve 与步骤校验同步重复执行）。
 * 否则执行新增。
 */
export async function insertAdultRecipeToCloud(recipe) {
  const db = getDb();
  const coll = db.collection('recipes');
  const now = new Date();

  const cloudDoc = buildCloudRecipeDoc({
    ...recipe,
    type: 'adult'
  });

  const doc = {
    ...cloudDoc,
    updateTime: now
  };

  const name = recipe.name && String(recipe.name).trim();
  if (name) {
    const { data: existing } = await coll.where({ name, type: 'adult' }).limit(1).get();
    if (existing && existing.length > 0) {
      const { _id } = existing[0];
      await coll.doc(_id).update(doc);
      return { updated: true, _id };
    }
  }

  const res = await coll.add(doc);
  return res;
}

