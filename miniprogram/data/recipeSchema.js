/**
 * 爱料理风格 - 菜谱 JSON 模型（云数据库用）
 *
 * 设计要点：
 * 1. 主料 main_ingredients 与调料 seasonings 分开，便于 UI 分块显示（主料区 / 调料区）
 * 2. 每个步骤必须关联 step_image_url，用于步骤页沉浸式头部或步骤图
 *
 * 集合名建议：recipes（大人菜谱）、baby_recipes（宝宝辅食，结构可复用）
 */

/* eslint-disable quotes */

/**
 * ========== 核心字段规范（算法与前端基础字段）==========
 *
 * 1. step_type（步骤类型枚举）
 *    - 'prep': 备菜步骤（切配、腌制、调酱等下锅前的准备工作）
 *    - 'cook': 烹饪步骤（下锅、加热、翻炒、炖煮、装盘等需要火源的操作）
 *    - 用途：算法计算并行任务、前端区分步骤颜色/图标
 *
 * 2. duration_num（数字耗时，单位：分钟）
 *    - 必填，number 类型
 *    - 用途：算法计算总耗时、步骤排序、甘特图展示
 *    - 默认值规则：prep 默认 5，cook 默认 10
 *
 * 3. Menu 精简存储格式（仅存菜谱 ID，缩减 Storage 体积）
 *    MenuSlim = {
 *      adultRecipeId: string | null,   // 大人菜谱 ID
 *      babyRecipeId: string | null,    // 宝宝菜谱 ID（可选）
 *      meat: string,                    // 肉类 key
 *      taste: string                    // 口味 key
 *    }
 *    读取时根据 ID 从菜谱库还原完整数据
 */

/** 步骤类型枚举常量 */
var STEP_TYPES = {
  PREP: 'prep',   // 备菜
  COOK: 'cook'    // 烹饪
};

/**
 * 步骤行动类型枚举常量（多线程统筹用）
 *
 * - LONG_TERM: 长耗时（炖、焖、烤、煮汤等，需要长时间加热或静置）
 * - ACTIVE: 主动操作（爆炒、调汁、下锅等需要持续关注的操作）
 * - IDLE_PREP: 空档期备菜（在其他菜长时间等待过程中穿插的切配/腌制等）
 */
var ACTION_TYPES = {
  LONG_TERM: 'long_term',
  ACTIVE: 'active',
  IDLE_PREP: 'idle_prep'
};

/** 步骤默认耗时（分钟） */
var STEP_DEFAULT_DURATION = {
  prep: 5,
  cook: 10
};

/** 单条菜谱的完整结构（TypeScript 风格注释，仅供参考）
{
  _id: string,              // 云数据库自动生成，导入时可省略
  id: string,                // 业务唯一标识，如 'a-chi-1'
  name: string,              // 菜名
  type: 'adult' | 'baby',
  taste: string,            // quick_stir_fry | slow_stew | steamed_salad 等
  meat: string,             // chicken | pork | beef | fish | shrimp | vegetable
  prep_time: number,        // 备菜时间（分钟）
  cook_time: number,        // 烹饪时间（分钟），可选
  cover_image_url: string,  // 封面图，可选
  is_baby_friendly: boolean,
  can_share_base: boolean,
  common_allergens: string[],

  // ---------- 分块食材（爱料理结构）----------
  main_ingredients: [       // 主料
    { name: string, amount: number, unit: string, category?: string, sub_type?: string }
  ],
  seasonings: [            // 调料
    { name: string, amount: number | 0, unit: string }  // 调料通常 amount 0，unit 为「适量」等
  ],

  // ---------- 步骤（标准化字段）----------
  steps: [
    {
      step_index: number,
      step_type: 'prep' | 'cook',                 // 必填，步骤类型枚举
      actionType: 'long_term' | 'active' | 'idle_prep',  // 新增：行动类型（统筹调度用）
      parallel: boolean,                           // 新增：是否可与其他菜并行
      waitTime: number,                            // 新增：被动等待时间（分钟，用于长耗时步骤）
      duration_num: number,                        // 必填，数字耗时（分钟）
      action: 'prep' | 'cook' | 'process' | 'seasoning',  // 兼容旧字段，可用于更细粒度分类
      text: string,
      step_image_url: string            // 必填，该步骤配图
    }
  ]
}
*/

/** 示例：一条完整菜谱（可直接用于云数据库导入或 init 脚本） */
var SAMPLE_RECIPE = {
  id: 'a-chi-1',
  name: '清蒸柠檬鸡里脊',
  type: 'adult',
  taste: 'steamed_salad',
  meat: 'chicken',
  prep_time: 10,
  cook_time: 10,
  cover_image_url: 'cloud://xxx.png',
  is_baby_friendly: true,
  can_share_base: true,
  common_allergens: [],

  main_ingredients: [
    { name: '鸡里脊', amount: 300, unit: 'g', category: '肉类', sub_type: 'chicken_tenderloin' },
    { name: '柠檬', amount: 30, unit: 'g', category: '蔬菜' }
  ],
  seasonings: [
    { name: '姜片', amount: 0, unit: '适量' },
    { name: '生抽', amount: 0, unit: '适量' },
    { name: '盐', amount: 0, unit: '适量' }
  ],

  steps: [
    {
      step_index: 1,
      step_type: 'prep',           // 核心字段：步骤类型
      actionType: 'idle_prep',     // 新增：默认视为可穿插的备菜
      parallel: true,
      waitTime: 0,
      duration_num: 5,             // 核心字段：数字耗时
      action: 'prep',
      text: '鸡里脊去筋膜，逆纹切成薄片，铺在盘内，撒少许盐。柠檬切薄片，姜切薄片备用。',
      step_image_url: 'cloud://steps/step1.png'
    },
    {
      step_index: 2,
      step_type: 'cook',           // 核心字段：步骤类型
      actionType: 'active',        // 新增：短时间主动烹饪
      parallel: false,
      waitTime: 0,
      duration_num: 10,            // 核心字段：数字耗时
      action: 'cook',
      text: '鸡片上铺姜片、柠檬片，水开后上锅大火蒸 10 分钟，取出淋少许生抽即可。',
      step_image_url: 'cloud://steps/step2.png'
    }
  ]
};

/** 示例：宝宝辅食一条（结构一致，type 为 baby） */
var SAMPLE_BABY_RECIPE = {
  id: 'b-porridge-1',
  name: '南瓜鸡肉粥',
  type: 'baby',
  taste: 'soft_porridge',
  meat: 'chicken',
  prep_time: 10,
  cook_time: 20,
  cover_image_url: 'cloud://baby/cover1.png',
  is_baby_friendly: true,
  can_share_base: false,
  common_allergens: [],

  main_ingredients: [
    { name: '鸡胸肉', amount: 80, unit: 'g', category: '肉类', sub_type: 'chicken_breast' },
    { name: '南瓜', amount: 100, unit: 'g', category: '蔬菜' },
    { name: '大米', amount: 30, unit: 'g', category: '其他' }
  ],
  seasonings: [
    { name: '核桃油', amount: 0, unit: '少许' }
  ],

  steps: [
    {
      step_index: 1,
      step_type: 'prep',           // 核心字段：步骤类型
      actionType: 'idle_prep',     // 新增：可穿插的备菜
      parallel: true,
      waitTime: 0,
      duration_num: 5,             // 核心字段：数字耗时
      action: 'prep',
      text: '鸡胸肉焯水后切末，南瓜去皮切小块，大米洗净。',
      step_image_url: 'cloud://baby/steps/s1.png'
    },
    {
      step_index: 2,
      step_type: 'cook',           // 核心字段：步骤类型
      actionType: 'long_term',     // 新增：相对长耗时的慢煮粥
      parallel: true,
      waitTime: 15,
      duration_num: 20,            // 核心字段：数字耗时
      action: 'cook',
      text: '大米与南瓜同煮成粥，加入鸡肉末煮至软烂，滴入核桃油即可。',
      step_image_url: 'cloud://baby/steps/s2.png'
    }
  ]
};

/** 供云初始化脚本使用的默认数据（可替换为你的真实 cloud 文件 ID） */
function getSampleRecipesForCloud() {
  return [SAMPLE_RECIPE, SAMPLE_BABY_RECIPE];
}

/**
 * 将旧格式 action 映射为标准 step_type
 * prep -> prep（备菜）
 * cook/process/seasoning -> cook（烹饪）
 */
function normalizeStepType(action) {
  if (action === 'prep') return STEP_TYPES.PREP;
  return STEP_TYPES.COOK;
}

/**
 * 标准化单个步骤，补全 step_type 和 duration_num
 * @param {Object} step - 原始步骤对象
 * @returns {Object} 标准化后的步骤
 */
function normalizeStep(step) {
  if (!step) return step;
  var stepType = step.step_type || normalizeStepType(step.action || 'cook');
  var durationNum = step.duration_num;
  if (typeof durationNum !== 'number') {
    // 尝试从旧字段 duration_minutes 读取
    durationNum = typeof step.duration_minutes === 'number' ? step.duration_minutes : STEP_DEFAULT_DURATION[stepType];
  }
  return Object.assign({}, step, {
    step_type: stepType,
    duration_num: durationNum
  });
}

/**
 * 标准化菜谱的所有步骤
 * @param {Object} recipe - 菜谱对象
 * @returns {Object} 标准化后的菜谱（浅拷贝，steps 为新数组）
 */
function normalizeRecipeSteps(recipe) {
  if (!recipe || !Array.isArray(recipe.steps)) return recipe;
  var normalizedSteps = recipe.steps.map(normalizeStep);
  return Object.assign({}, recipe, { steps: normalizedSteps });
}

module.exports = {
  // 常量
  STEP_TYPES: STEP_TYPES,
  ACTION_TYPES: ACTION_TYPES,
  STEP_DEFAULT_DURATION: STEP_DEFAULT_DURATION,
  // 示例数据
  SAMPLE_RECIPE: SAMPLE_RECIPE,
  SAMPLE_BABY_RECIPE: SAMPLE_BABY_RECIPE,
  getSampleRecipesForCloud: getSampleRecipesForCloud,
  // 工具函数
  normalizeStepType: normalizeStepType,
  normalizeStep: normalizeStep,
  normalizeRecipeSteps: normalizeRecipeSteps
};
