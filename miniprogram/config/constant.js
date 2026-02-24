/**
 * 全局常量配置
 * 
 * 集中管理项目中的硬编码值，便于维护和复用
 * 后续新增常量逐步补充到对应分组
 * 
 * 使用方式：
 * const C = require('../../config/constant.js');
 * if (step.step_type === C.STEP_TYPE.PREP) { ... }
 */

// ==================== 步骤类型 ====================

/**
 * 步骤类型枚举
 * 用于算法计算并行任务、前端区分步骤颜色/图标
 */
var STEP_TYPE = {
  PREP: 'prep',   // 备菜（切配、腌制、调酱等）
  COOK: 'cook'    // 烹饪（下锅、加热、翻炒、炖煮等）
};

/**
 * 步骤默认耗时（分钟）
 */
var STEP_DEFAULT_DURATION = {
  prep: 5,
  cook: 10
};

// ==================== 口味类型 ====================

/**
 * 大人口味类型
 */
var TASTE_TYPE = {
  QUICK_STIR_FRY: 'quick_stir_fry',   // 快手小炒
  SLOW_STEW: 'slow_stew',              // 暖心炖煮
  STEAMED_SALAD: 'steamed_salad'       // 精选蒸/拌
};

/**
 * 宝宝口味类型
 */
var BABY_TASTE_TYPE = {
  SOFT_PORRIDGE: 'soft_porridge',   // 营养粥面
  FINGER_FOOD: 'finger_food',       // 趣味手口料
  BRAISED_MASH: 'braised_mash'      // 开胃烩菜
};

/**
 * 口味有效值列表（用于校验）
 */
var VALID_ADULT_TASTES = [TASTE_TYPE.QUICK_STIR_FRY, TASTE_TYPE.SLOW_STEW, TASTE_TYPE.STEAMED_SALAD];
var VALID_BABY_TASTES = [BABY_TASTE_TYPE.SOFT_PORRIDGE, BABY_TASTE_TYPE.FINGER_FOOD, BABY_TASTE_TYPE.BRAISED_MASH];

// ==================== 肉类类型 ====================

/**
 * 肉类类型
 */
var MEAT_TYPE = {
  CHICKEN: 'chicken',
  PORK: 'pork',
  BEEF: 'beef',
  FISH: 'fish',
  SHRIMP: 'shrimp',
  LAMB: 'lamb',
  DUCK: 'duck',
  SHELLFISH: 'shellfish',
  VEGETABLE: 'vegetable'
};

/**
 * 肉类有效值列表（不含素菜）
 */
var VALID_MEATS = [MEAT_TYPE.CHICKEN, MEAT_TYPE.PORK, MEAT_TYPE.BEEF, MEAT_TYPE.FISH, MEAT_TYPE.SHRIMP, MEAT_TYPE.LAMB, MEAT_TYPE.DUCK, MEAT_TYPE.SHELLFISH];

/**
 * 肉类中文标签映射
 */
var MEAT_LABEL_MAP = {
  chicken: '鸡肉',
  pork: '猪肉',
  beef: '牛肉',
  fish: '鱼肉',
  shrimp: '虾仁',
  lamb: '羊肉',
  duck: '鸭肉',
  shellfish: '贝类',
  vegetable: '素菜'
};

/**
 * 肉类双向映射（中文 ↔ 英文）
 */
var MEAT_KEY_MAP = {
  '鸡肉': 'chicken',
  '猪肉': 'pork',
  '牛肉': 'beef',
  '鱼肉': 'fish',
  '虾仁': 'shrimp',
  '羊肉': 'lamb',
  '鸭肉': 'duck',
  '贝类': 'shellfish',
  '素菜': 'vegetable',
  chicken: 'chicken',
  pork: 'pork',
  beef: 'beef',
  fish: 'fish',
  shrimp: 'shrimp',
  lamb: 'lamb',
  duck: 'duck',
  shellfish: 'shellfish',
  vegetable: 'vegetable'
};

// ==================== 食材分类 ====================

/**
 * 食材分类排序权重
 * 数值越小越靠前
 */
var CATEGORY_ORDER = {
  '蔬菜': 1,
  '肉类': 2,
  '蛋类': 2,
  '干货': 2,
  '调料': 3,
  '辅食': 4,
  '其他': 5
};

/**
 * 默认分类排序权重
 */
var DEFAULT_CATEGORY_ORDER = 5;

// ==================== 口味风味 ====================

/**
 * 口味风味类型
 */
var FLAVOR_PROFILE = {
  LIGHT: 'light',           // 清淡
  SALTY_UMAMI: 'salty_umami', // 咸鲜
  SPICY: 'spicy',           // 辛辣
  SWEET_SOUR: 'sweet_sour', // 酸甜
  SOUR_FRESH: 'sour_fresh'  // 酸爽解腻
};

/**
 * 烹饪方式类型
 */
var COOK_TYPE = {
  STIR_FRY: 'stir_fry',  // 炒
  STEW: 'stew',          // 炖
  STEAM: 'steam',        // 蒸
  BAKE: 'bake'           // 焗/烤
};

/**
 * 辣味细分（仅当 flavor_profile 为 spicy 时使用）
 */
var SPICY_SUB = {
  MALA: 'mala',       // 麻辣 — 花椒主导
  XIANLA: 'xianla',   // 鲜辣 — 辣椒+酸鲜
  XIANGLA: 'xiangla'  // 香辣 — 酱香复合，默认
};

// ==================== 业务索引 ====================

/**
 * 宝宝餐分拨步骤索引（第一道菜）
 * 用于标记哪道菜需要分拨宝宝餐
 */
var BABY_PORTION_FIRST_IDX = 0;

/**
 * 默认成人人数
 */
var DEFAULT_ADULT_COUNT = 2;

/**
 * 成人人数范围
 */
var ADULT_COUNT_RANGE = {
  MIN: 1,
  MAX: 6
};

/**
 * 宝宝月龄范围
 */
var BABY_MONTH_RANGE = {
  MIN: 6,
  MAX: 36
};

// ==================== Storage Key ====================

/**
 * Storage 键名前缀/键名
 */
var STORAGE_KEY = {
  STEPS_COMPLETED_PREFIX: 'tablesync_steps_completed_',
  TODAY_MENUS: 'today_menus',
  TODAY_MENUS_PREFERENCE: 'today_menus_preference',
  MENU_GENERATED_DATE: 'menu_generated_date',
  CART_INGREDIENTS: 'cart_ingredients',
  WEEKLY_INGREDIENTS: 'weekly_ingredients',
  SELECTED_DISH_NAME: 'selected_dish_name',
  TODAY_PREP_TIME: 'today_prep_time',
  TODAY_ALLERGENS: 'today_allergens',
  SHOPPING_CHECKED_TODAY: 'tablesync_shopping_checked_today'
};

// ==================== 导出 ====================

module.exports = {
  // 步骤相关
  STEP_TYPE: STEP_TYPE,
  STEP_DEFAULT_DURATION: STEP_DEFAULT_DURATION,
  
  // 口味相关
  TASTE_TYPE: TASTE_TYPE,
  BABY_TASTE_TYPE: BABY_TASTE_TYPE,
  VALID_ADULT_TASTES: VALID_ADULT_TASTES,
  VALID_BABY_TASTES: VALID_BABY_TASTES,
  
  // 肉类相关
  MEAT_TYPE: MEAT_TYPE,
  VALID_MEATS: VALID_MEATS,
  MEAT_LABEL_MAP: MEAT_LABEL_MAP,
  MEAT_KEY_MAP: MEAT_KEY_MAP,
  
  // 食材分类
  CATEGORY_ORDER: CATEGORY_ORDER,
  DEFAULT_CATEGORY_ORDER: DEFAULT_CATEGORY_ORDER,
  
  // 口味风味
  FLAVOR_PROFILE: FLAVOR_PROFILE,
  COOK_TYPE: COOK_TYPE,
  SPICY_SUB: SPICY_SUB,
  
  // 业务索引
  BABY_PORTION_FIRST_IDX: BABY_PORTION_FIRST_IDX,
  DEFAULT_ADULT_COUNT: DEFAULT_ADULT_COUNT,
  ADULT_COUNT_RANGE: ADULT_COUNT_RANGE,
  BABY_MONTH_RANGE: BABY_MONTH_RANGE,
  
  // Storage
  STORAGE_KEY: STORAGE_KEY
};
