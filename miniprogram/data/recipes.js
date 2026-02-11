/**
 * 核心数据库 — 精简离线 fallback 版（微信小程序版 - CommonJS）
 * 仅保留菜单生成算法核心字段，不含 ingredients / steps / baby_variant 等展示字段。
 * 完整数据从云端获取；离线时此文件支持算法运行，但无法显示步骤和购物清单。
 *
 * 由 tools/slim-recipes.js 自动生成，请勿手动编辑。
 * 原始完整版备份: recipes.full.bak.js
 */

var adultRecipes = [
  { id: 'a-soup-1', name: '花旗参石斛炖鸡汤', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-soup-2', name: '五指毛桃排骨汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-soup-3', name: '鲜淮山炖牛肉汤', type: 'adult', meat: 'beef', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-chi-1', name: '清蒸柠檬鸡里脊', type: 'adult', meat: 'chicken', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-chi-2', name: '宫保鸡丁', type: 'adult', meat: 'chicken', taste: 'quick_stir_fry', flavor_profile: 'spicy', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, common_allergens: ['花生'], base_serving: 2 },
  { id: 'a-fish-1', name: '清蒸鳕鱼配葱丝', type: 'adult', meat: 'fish', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['鱼'], base_serving: 2 },
  { id: 'a-shrimp-1', name: '蒜蓉粉丝蒸虾', type: 'adult', meat: 'shrimp', taste: 'steamed_salad', flavor_profile: 'salty_umami', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['虾'], base_serving: 2 },
  { id: 'a-beef-1', name: '杭椒牛柳', type: 'adult', meat: 'beef', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-pork-1', name: '玉米排骨汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-beef-2', name: '番茄牛腩', type: 'adult', meat: 'beef', taste: 'slow_stew', flavor_profile: 'sweet_sour', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '牛腩', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '番茄', baseAmount: 300, unit: 'g', category: '蔬菜' },
    { name: '姜片', baseAmount: 3, unit: '片', category: '调料' },
    { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '老抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '糖', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '八角', baseAmount: 2, unit: '颗', category: '调料' }
  ] },
  { id: 'a-shrimp-2', name: '滑蛋虾仁', type: 'adult', meat: 'shrimp', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: ['虾', '蛋'], base_serving: 2 },
  { id: 'a-fish-2', name: '孔雀开屏鱼', type: 'adult', meat: 'fish', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: true, common_allergens: ['鱼'], base_serving: 2 },
  { id: 'a-beef-3', name: '番茄炖牛腩', type: 'adult', meat: 'beef', taste: 'slow_stew', flavor_profile: 'sweet_sour', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '牛腩', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '番茄', baseAmount: 300, unit: 'g', category: '蔬菜' },
    { name: '姜片', baseAmount: 3, unit: '片', category: '调料' },
    { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '老抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '糖', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '八角', baseAmount: 2, unit: '颗', category: '调料' }
  ] },
  { id: 'a-pork-2', name: '蒜香蒸排骨', type: 'adult', meat: 'pork', taste: 'steamed_salad', flavor_profile: 'salty_umami', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-pork-3', name: '滑溜里脊片', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 12, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-pork-4', name: '白菜豆腐炖五花', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-chi-3', name: '栗子焖鸡', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-chi-4', name: '白切鸡', type: 'adult', meat: 'chicken', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-beef-4', name: '小炒黄牛肉', type: 'adult', meat: 'beef', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 12, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-beef-5', name: '咖喱牛腩', type: 'adult', meat: 'beef', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-shrimp-3', name: '避风塘炒虾', type: 'adult', meat: 'shrimp', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, common_allergens: ['虾'], base_serving: 2 },
  { id: 'a-fish-3', name: '红烧鱼块', type: 'adult', meat: 'fish', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 12, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, common_allergens: ['鱼'], base_serving: 2 },
  { id: 'a-pork-5', name: '回锅肉', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-pork-6', name: '鱼香肉丝', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 12, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-1', name: '手撕包菜', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 8, cook_minutes: 15, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-2', name: '蒜蓉西兰花', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-3', name: '清炒时蔬', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 8, cook_minutes: 15, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-4', name: '拍黄瓜', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'steam', prep_time: 5, cook_minutes: 15, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-pork-7', name: '红烧肉', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-6', name: '地三鲜', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 12, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-soup-4', name: '番茄蛋花汤', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'sweet_sour', cook_type: 'stir_fry', dish_type: 'soup', prep_time: 8, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'a-soup-5', name: '紫菜蛋花汤', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', dish_type: 'soup', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'm001', name: '番茄炒蛋', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'sweet_sour', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'm002', name: '青椒炒肉丝', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v001', name: '清炒上海青', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v002', name: '凉拌黄瓜', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'm003', name: '可乐鸡翅', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'sweet_sour', cook_type: 'stew', prep_time: 10, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'm004', name: '清蒸鲈鱼', type: 'adult', meat: 'fish', taste: 'steamed_salad', flavor_profile: 'salty_umami', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['鱼'], base_serving: 2 },
  { id: 'v003', name: '蒜蓉油麦菜', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v004', name: '清炒山药', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 's002', name: '冬瓜海带排骨汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'm005', name: '麻婆豆腐', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'spicy', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v005', name: '白灼西兰花', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v006', name: '番茄烧茄子', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'sweet_sour', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 's003', name: '丝瓜蛋花汤', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', dish_type: 'soup', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'm008', name: '蚝油牛肉', type: 'adult', meat: 'beef', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 20, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v007', name: '清炒荷兰豆', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v008', name: '蒸水蛋', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'm009', name: '土豆炖牛肉', type: 'adult', meat: 'beef', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'm010', name: '葱爆羊肉', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v009', name: '酸辣土豆丝', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'sour_fresh', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'v010', name: '清炒娃娃菜', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 's005', name: '番茄金针菇蛋花汤', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'sweet_sour', cook_type: 'stir_fry', dish_type: 'soup', prep_time: 8, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'a-beef-6', name: '苹果白切牛腱', type: 'adult', meat: 'beef', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'stew', prep_time: 20, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-beef-7', name: '凉拌柠檬牛腱子', type: 'adult', meat: 'beef', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'cold_dress', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-fish-4', name: '番茄酸汤鱼头', type: 'adult', meat: 'fish', taste: 'slow_stew', flavor_profile: 'sweet_sour', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: false, can_share_base: false, common_allergens: ['鱼'], base_serving: 2 },
  { id: 'a-fish-5', name: '菌菇豆腐炖鲈鱼', type: 'adult', meat: 'fish', taste: 'slow_stew', flavor_profile: 'light', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: ['鱼'], base_serving: 2 },
  { id: 'a-shrimp-4', name: '椰香虾仁豆腐煲', type: 'adult', meat: 'shrimp', taste: 'slow_stew', flavor_profile: 'light', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: false, common_allergens: ['虾'], base_serving: 2 },
  { id: 'a-shrimp-5', name: '番茄金针菇虾仁汤', type: 'adult', meat: 'shrimp', taste: 'slow_stew', flavor_profile: 'sweet_sour', cook_type: 'stew', dish_type: 'soup', prep_time: 10, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: ['虾'], base_serving: 2 },
  { id: 'a-veg-11', name: '白菜豆腐粉丝煲', type: 'adult', meat: 'vegetable', taste: 'slow_stew', flavor_profile: 'light', cook_type: 'stew', prep_time: 10, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-12', name: '山药萝卜菌菇煲', type: 'adult', meat: 'vegetable', taste: 'slow_stew', flavor_profile: 'light', cook_type: 'stew', prep_time: 15, cook_minutes: 60, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-13', name: '火烧树番茄酱拌凉皮', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: ['花生'], base_serving: 2 },
  { id: 'a-veg-14', name: '傣味凉拌米线', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'steam', prep_time: 10, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: ['花生'], base_serving: 2 },
  { id: 'a-chi-5', name: '傣味柠檬手撕鸡', type: 'adult', meat: 'chicken', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-shrimp-6', name: '泰式凉拌虾木瓜沙拉', type: 'adult', meat: 'shrimp', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'steam', prep_time: 15, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: ['虾', '花生'], base_serving: 2 },
  { id: 'a-chi-6', name: '香煎鸡肉', type: 'adult', meat: 'chicken', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-15', name: '油糟辣椒炒饭', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'spicy', cook_type: 'stir_fry', prep_time: 8, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'a-pork-8', name: '泰式打抛炒饭', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'spicy', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'a-soup-6', name: '人参黄芪乌鸡汤', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 120, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '乌鸡', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '人参', baseAmount: 10, unit: 'g', category: '干货' },
    { name: '黄芪', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '枸杞', baseAmount: 5, unit: 'g', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-7', name: '党参枸杞乌鸡汤', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 120, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '乌鸡', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '党参', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '枸杞', baseAmount: 10, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-8', name: '黄芪党参排骨汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 90, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '排骨', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '黄芪', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '党参', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-9', name: '灵芝红枣排骨汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 15, cook_minutes: 90, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '排骨', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '灵芝', baseAmount: 10, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 8, unit: '颗', category: '干货' },
    { name: '枸杞', baseAmount: 5, unit: 'g', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-10', name: '人参桂圆老母鸡汤', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 150, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '老母鸡', baseAmount: 500, unit: 'g', category: '肉类' },
    { name: '人参', baseAmount: 10, unit: 'g', category: '干货' },
    { name: '桂圆', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '枸杞', baseAmount: 5, unit: 'g', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-11', name: '灵芝石斛老母鸡汤', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 150, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '老母鸡', baseAmount: 500, unit: 'g', category: '肉类' },
    { name: '灵芝', baseAmount: 10, unit: 'g', category: '干货' },
    { name: '石斛', baseAmount: 10, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '枸杞', baseAmount: 5, unit: 'g', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-12', name: '黄芪花生猪蹄汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 120, is_baby_friendly: false, can_share_base: false, common_allergens: ['花生'], base_serving: 2, ingredients: [
    { name: '猪蹄', baseAmount: 500, unit: 'g', category: '肉类' },
    { name: '黄芪', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '花生', baseAmount: 50, unit: 'g', category: '干货' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-soup-13', name: '党参山药猪蹄汤', type: 'adult', meat: 'pork', taste: 'slow_stew', flavor_profile: 'salty_umami', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 120, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '猪蹄', baseAmount: 500, unit: 'g', category: '肉类' },
    { name: '党参', baseAmount: 15, unit: 'g', category: '干货' },
    { name: '山药', baseAmount: 200, unit: 'g', category: '蔬菜' },
    { name: '红枣', baseAmount: 5, unit: '颗', category: '干货' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-veg-16', name: '酸辣炒笋', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'spicy', cook_type: 'stir_fry', dish_type: null, prep_time: 10, cook_minutes: 8, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-17', name: '柠檬酱油手撕生菜', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 5, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-shrimp-7', name: '柠檬椒盐虾', type: 'adult', meat: 'shrimp', taste: 'quick_stir_fry', flavor_profile: 'sour_fresh', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 8, is_baby_friendly: false, can_share_base: false, common_allergens: ['虾'], base_serving: 2 },
  { id: 'a-soup-14', name: '酸萝卜老鸭汤', type: 'adult', meat: 'chicken', taste: 'slow_stew', flavor_profile: 'sour_fresh', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 90, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2, ingredients: [
    { name: '鸭肉', baseAmount: 500, unit: 'g', category: '肉类' },
    { name: '酸萝卜', baseAmount: 200, unit: 'g', category: '蔬菜' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-veg-18', name: '蒜蓉炒菜心', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', prep_time: 10, cook_minutes: 5, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-19', name: '醋溜土豆丝', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'sour_fresh', cook_type: 'stir_fry', dish_type: null, prep_time: 15, cook_minutes: 8, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-20', name: '香煎南瓜', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', dish_type: null, prep_time: 5, cook_minutes: 12, is_baby_friendly: true, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-21', name: '蒜蓉烤口蘑', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'salty_umami', cook_type: 'steam', dish_type: null, prep_time: 10, cook_minutes: 15, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-22', name: '家常豆腐', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', dish_type: null, prep_time: 10, cook_minutes: 10, is_baby_friendly: true, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-23', name: '韭菜炒蛋', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', dish_type: null, prep_time: 5, cook_minutes: 5, is_baby_friendly: true, can_share_base: false, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'a-veg-24', name: '苦瓜煎蛋', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', dish_type: null, prep_time: 10, cook_minutes: 8, is_baby_friendly: false, can_share_base: false, common_allergens: ['蛋'], base_serving: 2 },
  { id: 'a-veg-25', name: '凉拌木耳', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'cold_dress', dish_type: null, prep_time: 15, cook_minutes: 0, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-26', name: '凉拌腐竹', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'cold_dress', dish_type: null, prep_time: 20, cook_minutes: 0, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-27', name: '老醋花生', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'sour_fresh', cook_type: 'cold_dress', dish_type: null, prep_time: 5, cook_minutes: 0, is_baby_friendly: false, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-veg-28', name: '彩椒炒木耳', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'stir_fry', dish_type: null, prep_time: 10, cook_minutes: 8, is_baby_friendly: true, can_share_base: false, common_allergens: [], base_serving: 2 },
  { id: 'a-pork-9', name: '藕片炒五花肉', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-soup-15', name: '酸汤金针菇牛肉', type: 'adult', meat: 'beef', taste: 'slow_stew', flavor_profile: 'sour_fresh', cook_type: 'stew', dish_type: 'soup', prep_time: 20, cook_minutes: 40, is_baby_friendly: false, can_share_base: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '牛肉', baseAmount: 300, unit: 'g', category: '肉类' },
    { name: '金针菇', baseAmount: 200, unit: 'g', category: '蔬菜' },
    { name: '番茄', baseAmount: 200, unit: 'g', category: '蔬菜' },
    { name: '酸汤底料', baseAmount: 1, unit: '包', category: '调料' },
    { name: '生姜', baseAmount: 3, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ] },
  { id: 'a-veg-29', name: '凉拌茄子豆芽', type: 'adult', meat: 'vegetable', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 15, cook_minutes: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-chi-7', name: '韭菜炒鸡丝', type: 'adult', meat: 'chicken', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'stir_fry', prep_time: 15, cook_minutes: 8, is_baby_friendly: true, can_share_base: true, common_allergens: [], base_serving: 2 },
  { id: 'a-fish-6', name: '葱油鲜鱼片', type: 'adult', meat: 'fish', taste: 'steamed_salad', flavor_profile: 'light', cook_type: 'steam', prep_time: 15, cook_minutes: 12, is_baby_friendly: true, can_share_base: true, common_allergens: ['鱼'], base_serving: 2 },
  {
    "id": "a-veg-30",
    "name": "香煎杏鲍菇",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "杏鲍菇",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "杏鲍菇洗净，纵向切成0.8cm厚片。蒜瓣切末。"
      },
      {
        "action": "cook",
        "text": "平底锅中倒油大火烧热，放入杏鲍菇片，中火煎至两面金黄酥脆，约每面3分钟。"
      },
      {
        "action": "cook",
        "text": "撒入蒜末，加入生抽、蚝油、盐调味，撒上黑胡椒粉，翻炒30秒即可出锅。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "杏鲍菇泥",
          "action": "杏鲍菇清蒸后打成泥糊"
        },
        {
          "max_month": 12,
          "name": "杏鲍菇碎",
          "action": "杏鲍菇清蒸后切碎，可拌入粥中"
        },
        {
          "max_month": 36,
          "name": "宝宝版香煎杏鲍菇",
          "action": "少油少盐煎制，切成小块"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/pan_fried_king_oyster_mushroom.png"
  },
  {
    "id": "a-veg-34",
    "name": "蒜蓉粉丝娃娃菜",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 8,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 6,
    "ingredients": [
      {
        "name": "娃娃菜",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "粉丝",
        "baseAmount": 50,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "蒜",
        "baseAmount": 5,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "娃娃菜洗净切开，粉丝泡发，蒜瓣切末。"
      },
      {
        "action": "cook",
        "text": "蒸锅水开，将娃娃菜和粉丝码放在盘中，蒸6分钟。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，爆香蒜末，加入生抽、蚝油、盐调味，淋在蒸好的菜上即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "娃娃菜泥",
          "action": "娃娃菜清蒸后打成泥糊"
        },
        {
          "max_month": 12,
          "name": "娃娃菜粉丝碎",
          "action": "娃娃菜和粉丝清蒸后切碎"
        },
        {
          "max_month": 36,
          "name": "宝宝版蒜蓉粉丝娃娃菜",
          "action": "少油少盐，蒜末可不加或少加"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/steamed_baby_cabbage_vermicelli.png"
  },
  {
    "id": "a-veg-32",
    "name": "香菇炒青菜",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 8,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "青菜",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "香菇",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜",
        "baseAmount": 1,
        "unit": "片",
        "category": "调料"
      },
      {
        "name": "蒜",
        "baseAmount": 2,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "青菜洗净切段，香菇洗净切片，姜蒜切末。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，爆香姜蒜末，加入香菇片翻炒1分钟。"
      },
      {
        "action": "cook",
        "text": "加入青菜，淋入料酒，大火快炒至青菜变软，加入生抽、盐调味，翻炒均匀即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "香菇青菜泥",
          "action": "香菇青菜清蒸后分别打成泥混合"
        },
        {
          "max_month": 12,
          "name": "香菇青菜碎",
          "action": "香菇青菜清蒸后切碎，可拌入粥中"
        },
        {
          "max_month": 36,
          "name": "宝宝版香菇炒青菜",
          "action": "少油少盐清炒，切成小块"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/mushroom_stir_fried_greens.png"
  },
  {
    "id": "a-veg-34",
    "name": "蒜蓉粉丝娃娃菜",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 8,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 6,
    "ingredients": [
      {
        "name": "娃娃菜",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "粉丝",
        "baseAmount": 50,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "蒜",
        "baseAmount": 5,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "娃娃菜洗净切开，粉丝泡发，蒜瓣切末。"
      },
      {
        "action": "cook",
        "text": "蒸锅水开，将娃娃菜和粉丝码放在盘中，蒸6分钟。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，爆香蒜末，加入生抽、蚝油、盐调味，淋在蒸好的菜上即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "娃娃菜泥",
          "action": "娃娃菜清蒸后打成泥糊"
        },
        {
          "max_month": 12,
          "name": "娃娃菜粉丝碎",
          "action": "娃娃菜和粉丝清蒸后切碎"
        },
        {
          "max_month": 36,
          "name": "宝宝版蒜蓉粉丝娃娃菜",
          "action": "少油少盐，蒜末可不加或少加"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/steamed_baby_cabbage_vermicelli.png"
  },
  {
    "id": "a-veg-33",
    "name": "金针菇炒韭黄",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 4,
    "ingredients": [
      {
        "name": "金针菇",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "韭黄",
        "baseAmount": 150,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "金针菇洗净切除根部，韭黄切段，蒜瓣切末。"
      },
      {
        "action": "cook",
        "text": "锅中倒油大火烧热，爆香蒜末，加入金针菇翻炒1分钟。"
      },
      {
        "action": "cook",
        "text": "加入韭黄，淋入生抽，撒入盐和胡椒粉，大火快炒2分钟至韭黄变软即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "金针菇泥",
          "action": "金针菇清蒸后打成泥糊"
        },
        {
          "max_month": 12,
          "name": "金针菇段",
          "action": "金针菇清蒸后切碎，可拌入粥中"
        },
        {
          "max_month": 36,
          "name": "宝宝版金针菇炒韭黄",
          "action": "少油少盐清炒，切成小段"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/enoki_mushroom_yellow_chives.png"
  },
  {
    "id": "a-chi-8",
    "name": "柠香蒜片鸡胸",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sour_fresh",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "鸡胸肉",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_breast"
      },
      {
        "name": "蒜片",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "柠檬",
        "baseAmount": 1,
        "unit": "个",
        "category": "其他"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "淀粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡胸肉横向切成 1cm 厚片，加入料酒、生抽、白胡椒粉、少许淀粉抓匀腌制 15 分钟。蒜切薄片，柠檬切片取汁。"
      },
      {
        "action": "cook",
        "text": "热锅凉油，中火放入蒜片炒香。转大火加入鸡胸肉片，快速翻炒至变色。"
      },
      {
        "action": "cook",
        "text": "加入少许盐调味，淋入柠檬汁，大火翻炒 30 秒即可出锅，趁热撒上柠檬片点缀。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "柠檬蒜香鸡泥",
          "action": "鸡胸煮熟打泥，加入少许蒜泥和柠檬汁调味"
        },
        {
          "max_month": 12,
          "name": "柠檬鸡丝",
          "action": "鸡胸切细丝煮熟，加入极少量蒜末和柠檬汁"
        },
        {
          "max_month": 36,
          "name": "宝宝柠香鸡片",
          "action": "同大人版，去掉蒜片，少放柠檬和盐"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/lemon_garlic_chicken_breast.png"
  },
  {
    "id": "a-fish-7",
    "name": "姜葱蒸鳕鱼",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "fish",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [
      "鱼"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "鳕鱼片",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "fish_cod"
      },
      {
        "name": "姜丝",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "葱丝",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鳕鱼片洗净，加入料酒、盐、胡椒粉腌制 10 分钟。姜和葱切细丝。"
      },
      {
        "action": "cook",
        "text": "将鳕鱼片放入盘中，铺上一半姜丝，大火将水烧开。"
      },
      {
        "action": "cook",
        "text": "放入鱼片蒸 8 分钟，取出后撒上剩余姜丝和葱丝，淋上热油和少许生抽即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鳕鱼姜汤泥",
          "action": "鱼肉去刺蒸熟打泥，加入少许姜汁调味"
        },
        {
          "max_month": 12,
          "name": "姜味鳕鱼碎",
          "action": "鱼肉去刺蒸熟压碎，加入极少量姜末"
        },
        {
          "max_month": 36,
          "name": "宝宝姜蒸鳕鱼",
          "action": "同大人版，去掉葱丝，少放姜丝和调味料"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/ginger_scallion_steamed_cod.png"
  },
  {
    "id": "a-veg-35",
    "name": "蒜香菇菜心",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "菜心",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "香菇",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜末",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "菜心洗净切段，香菇切片，蒜切末。"
      },
      {
        "action": "cook",
        "text": "热锅下油，爆香蒜末，加入香菇片快速翻炒。"
      },
      {
        "action": "cook",
        "text": "加入菜心翻炒，淋入生抽、蚝油，撒入盐和胡椒粉调味，大火快炒 2 分钟至断生即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "菜心香菇泥",
          "action": "菜心和香菇分别煮软打泥，少许调味"
        },
        {
          "max_month": 12,
          "name": "香菇菜心碎",
          "action": "菜心和香菇切碎煮软，去掉蒜末"
        },
        {
          "max_month": 36,
          "name": "宝宝菜心炒香菇",
          "action": "同大人版，去掉蒜末，少放调味料"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_mushroom_choy_sum.png"
  },
  {
    "id": "a-chi-9",
    "name": "蒜香柚子蒸鸡",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "chicken",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 25,
    "ingredients": [
      {
        "name": "鸡腿",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_thigh"
      },
      {
        "name": "柚子皮",
        "baseAmount": 30,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "蒜末",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "姜丝",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡腿洗净，划几刀，加入料酒、生抽、白胡椒粉腌制20分钟。柚子皮切细丝，蒜剁末，姜切丝，葱花备用。"
      },
      {
        "action": "cook",
        "text": "将腌制好的鸡腿放入盘中，表面铺上姜丝、蒜末。"
      },
      {
        "action": "cook",
        "text": "大火将水烧开，放入鸡腿，转中火蒸20分钟。最后5分钟撒入柚子皮丝。"
      },
      {
        "action": "cook",
        "text": "取出后撒上葱花，淋上少许热油提香即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "柚香鸡肉泥",
          "action": "取鸡腿肉剔骨打泥，加入少许柚子皮丝熬煮的汤汁调味"
        },
        {
          "max_month": 12,
          "name": "柚香鸡肉碎",
          "action": "将鸡肉剔骨切碎，加入极少量柚子皮丝增香"
        },
        {
          "max_month": 36,
          "name": "宝宝柚香蒸鸡",
          "action": "同大人版，去掉蒜末，减少柚子皮用量，少放盐"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_pomelo_steamed_chicken.png"
  },
  {
    "id": "a-beef-8",
    "name": "金桔酱烧牛肉",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "beef",
    "prep_time": 25,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sweet_sour",
    "cook_type": "stew",
    "cook_minutes": 90,
    "ingredients": [
      {
        "name": "牛腩",
        "baseAmount": 600,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_brisket"
      },
      {
        "name": "金桔",
        "baseAmount": 200,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "姜片",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "八角",
        "baseAmount": 2,
        "unit": "个",
        "category": "调料"
      },
      {
        "name": "桂皮",
        "baseAmount": 1,
        "unit": "块",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "冰糖",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛腩切4cm大块，金桔洗净对半切开。姜切片，八角桂皮备用。"
      },
      {
        "action": "cook",
        "text": "锅中放油，爆香姜片、八角、桂皮，下牛肉大火快速翻炒上色。"
      },
      {
        "action": "cook",
        "text": "加入料酒、生抽、老抽、冰糖，倒入没过牛肉的热水，大火煮沸后转小火炖煮60分钟。"
      },
      {
        "action": "cook",
        "text": "加入金桔，继续炖煮30分钟至牛肉软烂，汤汁收浓即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "金桔牛肉泥",
          "action": "取软烂牛肉打泥，加入少许金桔煮的汤汁调味"
        },
        {
          "max_month": 12,
          "name": "金桔牛肉粒",
          "action": "牛肉切成极小粒，去除金桔皮，用肉汤拌软饭"
        },
        {
          "max_month": 36,
          "name": "宝宝金桔牛肉",
          "action": "同大人版，少放调味料，去除香料，切小块便于食用"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/kumquat_braised_beef.png"
  },
  {
    "id": "a-veg-36",
    "name": "松仁玉兰片",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [
      "坚果"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 10,
    "ingredients": [
      {
        "name": "白玉兰菇",
        "baseAmount": 400,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "松仁",
        "baseAmount": 50,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "青椒",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜末",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "白玉兰菇洗净切片，青椒切丝，蒜剁末。松仁提前用小火炒至金黄色备用。"
      },
      {
        "action": "cook",
        "text": "锅中放油烧热，爆香蒜末，加入白玉兰菇片快速翻炒。"
      },
      {
        "action": "cook",
        "text": "加入料酒、盐调味，大火翻炒2分钟，加入青椒丝继续翻炒1分钟。"
      },
      {
        "action": "cook",
        "text": "最后加入松仁、生抽、白胡椒粉，翻炒均匀即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "玉兰菇泥",
          "action": "将白玉兰菇蒸熟打泥，不加松仁"
        },
        {
          "max_month": 12,
          "name": "玉兰菇碎",
          "action": "白玉兰菇切碎清炒，可加入少许糙米粥"
        },
        {
          "max_month": 36,
          "name": "宝宝松仁玉兰片",
          "action": "同大人版，松仁捣碎，少放调味料"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/pine_nut_king_oyster_mushroom.png"
  },
  {
    "id": "a-soup-16",
    "name": "竹荪山药炖乳鸽",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stew",
    "cook_minutes": 45,
    "ingredients": [
      {
        "name": "乳鸽",
        "baseAmount": 1,
        "unit": "只",
        "category": "肉类",
        "sub_type": "squab"
      },
      {
        "name": "竹荪",
        "baseAmount": 15,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "山药",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "枸杞",
        "baseAmount": 10,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "生姜",
        "baseAmount": 3,
        "unit": "片",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "乳鸽洗净，斩半，姜切片。竹荪提前泡发20分钟，山药去皮切滚刀块。"
      },
      {
        "action": "cook",
        "text": "锅中加水烧开，放入乳鸽焯水去腥，捞出冲洗干净。"
      },
      {
        "action": "cook",
        "text": "砂锅加水，放入乳鸽、姜片和料酒，大火煮沸后转小火炖30分钟。"
      },
      {
        "action": "cook",
        "text": "加入山药块继续炖10分钟，最后加入泡发的竹荪和枸杞，小火煮3分钟，加盐调味即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "乳鸽山药泥",
          "action": "取乳鸽肉和山药煮烂打泥，加少许清汤调稀"
        },
        {
          "max_month": 12,
          "name": "乳鸽山药糊",
          "action": "乳鸽肉剔骨切碎，山药煮软捣碎，加适量汤汁"
        },
        {
          "max_month": 36,
          "name": "宝宝竹荪乳鸽汤",
          "action": "同大人版，少盐，去掉姜片，取软烂的肉和山药"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/bamboo_fungus_yam_squab_soup.png"
  },
  {
    "id": "a-veg-37",
    "name": "黄芪枸杞蒸南瓜",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 20,
    "ingredients": [
      {
        "name": "南瓜",
        "baseAmount": 400,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "黄芪",
        "baseAmount": 10,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "枸杞",
        "baseAmount": 10,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "蜂蜜",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "南瓜去皮切成等厚片状。黄芪提前用温水泡发15分钟，枸杞洗净备用。"
      },
      {
        "action": "cook",
        "text": "蒸锅水烧开，将南瓜片整齐码放在盘中，上面铺上泡发的黄芪。"
      },
      {
        "action": "cook",
        "text": "大火蒸15分钟，最后5分钟时撒上枸杞。取出后加入少许盐调味，可选择淋上蜂蜜提味。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "南瓜泥",
          "action": "南瓜蒸熟后去掉黄芪，捣成泥状"
        },
        {
          "max_month": 12,
          "name": "南瓜枸杞泥",
          "action": "南瓜和枸杞一起蒸熟捣碎，去掉黄芪"
        },
        {
          "max_month": 36,
          "name": "宝宝蒸南瓜",
          "action": "同大人版，不加盐和蜂蜜，去掉黄芪"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/astragalus_goji_steamed_pumpkin.png"
  },
  {
    "id": "a-fish-8",
    "name": "银耳海参蒸鲈鱼",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "fish",
    "prep_time": 25,
    "is_baby_friendly": true,
    "common_allergens": [
      "鱼"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "鲈鱼",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "fish_seabass"
      },
      {
        "name": "银耳",
        "baseAmount": 20,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "海参",
        "baseAmount": 30,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "葱",
        "baseAmount": 2,
        "unit": "根",
        "category": "调料"
      },
      {
        "name": "姜",
        "baseAmount": 3,
        "unit": "片",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "银耳提前泡发1小时，海参提前泡发备用。鲈鱼清洗干净，两面划花刀。葱切段，姜切丝。"
      },
      {
        "action": "prep",
        "text": "鱼身抹上料酒、少许盐腌制10分钟。银耳撕小朵，海参切片。"
      },
      {
        "action": "cook",
        "text": "将鱼放入盘中，铺上银耳、海参，撒上姜丝，大火蒸10分钟。"
      },
      {
        "action": "cook",
        "text": "取出后淋上生抽，撒上葱段即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鲈鱼银耳泥",
          "action": "取鱼肉去刺打泥，银耳切碎混合"
        },
        {
          "max_month": 12,
          "name": "鲈鱼银耳糊",
          "action": "鱼肉去刺剥碎，银耳切碎，不加调味料"
        },
        {
          "max_month": 36,
          "name": "宝宝蒸鲈鱼",
          "action": "同大人版，去掉海参，少放调味料，鱼肉去刺"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/snow_fungus_sea_cucumber_steamed_bass.png"
  },
  {
    "id": "a-chi-10",
    "name": "葱油鸡翅",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 15,
    "ingredients": [
      {
        "name": "鸡翅中",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_wing"
      },
      {
        "name": "葱花",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "姜片",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡翅中洗净，用料酒、生抽、盐、白胡椒粉腌制15分钟。葱切段，姜切片。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，放入姜片爆香，加入鸡翅中中火煎至两面金黄。"
      },
      {
        "action": "cook",
        "text": "加入适量生抽、老抽调色，翻炒均匀后加入100ml热水，盖盖焖煮5分钟。"
      },
      {
        "action": "cook",
        "text": "开盖大火收汁，最后撒入葱花翻炒出锅。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "葱香鸡肉泥",
          "action": "取鸡翅肉去皮打泥，加入少许原汤调味"
        },
        {
          "max_month": 12,
          "name": "葱香鸡肉碎",
          "action": "取鸡翅肉去皮切碎，搭配软饭"
        },
        {
          "max_month": 36,
          "name": "宝宝葱油鸡块",
          "action": "去皮，少盐，切小块，不加酱油"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/scallion_oil_chicken_wings.png"
  },
  {
    "id": "a-veg-38",
    "name": "金沙玉米粒",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "玉米粒",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "咸蛋黄",
        "baseAmount": 2,
        "unit": "个",
        "category": "蛋类"
      },
      {
        "name": "蒜末",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "咸蛋黄蒸熟捣碎，玉米粒解冻沥干，蒜切末。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，放入蒜末爆香，加入咸蛋黄碎粒小火炒出金沙。"
      },
      {
        "action": "cook",
        "text": "加入玉米粒翻炒，加入料酒、盐、白胡椒粉调味，中火翻炒2分钟至玉米粒断生即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "玉米泥",
          "action": "玉米粒煮软打泥，不加咸蛋黄"
        },
        {
          "max_month": 12,
          "name": "玉米蛋黄粒",
          "action": "玉米粒煮软，加入少许蒸熟的普通蛋黄碎"
        },
        {
          "max_month": 36,
          "name": "宝宝金沙玉米",
          "action": "减少咸蛋黄用量，控制咸度"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/golden_sand_corn.png"
  },
  {
    "id": "a-soup-17",
    "name": "白萝卜排骨汤",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stew",
    "cook_minutes": 45,
    "ingredients": [
      {
        "name": "排骨",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_ribs"
      },
      {
        "name": "白萝卜",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜片",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "排骨切段，焯水去血沫。白萝卜去皮切大块，姜切片。"
      },
      {
        "action": "cook",
        "text": "锅中加入2000ml清水，放入排骨、姜片和料酒，大火煮沸后转小火炖20分钟。"
      },
      {
        "action": "cook",
        "text": "加入白萝卜块，继续小火炖20分钟至萝卜软烂。最后加入盐和白胡椒粉调味即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "萝卜排骨泥",
          "action": "取萝卜和排骨肉打泥，加入适量原汤调稀"
        },
        {
          "max_month": 12,
          "name": "萝卜排骨糊",
          "action": "萝卜和排骨肉切碎，加汤煮软烂"
        },
        {
          "max_month": 36,
          "name": "宝宝萝卜排骨汤",
          "action": "同大人版少盐，排骨切小块去骨"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/radish_pork_rib_soup.png"
  },
  {
    "id": "a-fish-9",
    "name": "姜葱蒸龙利鱼",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "fish",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "龙利鱼片",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "fish_sole"
      },
      {
        "name": "姜丝",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "葱丝",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "龙利鱼片洗净，用料酒、盐、胡椒粉腌制10分钟。姜和葱切细丝。"
      },
      {
        "action": "cook",
        "text": "将鱼片码放在盘中，表面铺上一半姜丝，大火蒸6-8分钟。"
      },
      {
        "action": "cook",
        "text": "取出后淋上少许生抽，撒上剩余姜丝和葱丝，淋上热油即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "清蒸鱼泥",
          "action": "鱼肉蒸熟打泥，不加调味料"
        },
        {
          "max_month": 12,
          "name": "姜汁鱼泥",
          "action": "鱼肉蒸熟压碎，加入少许姜汁"
        },
        {
          "max_month": 36,
          "name": "宝宝清蒸鱼",
          "action": "同大人版少盐，去掉葱姜丝"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/steamed_sole_fish.png"
  },
  {
    "id": "a-pork-10",
    "name": "葱油蒜香猪肉片",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "pork",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "里脊肉",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_tenderloin"
      },
      {
        "name": "葱花",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜末",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "淀粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "里脊肉逆纹切成 0.2cm 薄片，加入料酒、生抽、蚝油、白胡椒粉抓匀，最后加入淀粉上浆，腌制 10 分钟。葱切葱花，蒜切末备用。"
      },
      {
        "action": "cook",
        "text": "热锅凉油，爆香一半蒜末，加入腌制好的肉片大火快速翻炒至七分熟。"
      },
      {
        "action": "cook",
        "text": "加入剩余蒜末和葱花，淋入少许生抽提色，适量盐调味，大火快速翻炒30秒即可出锅。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "蒜香肉泥",
          "action": "肉片焖煮至软烂，去蒜末打成泥状"
        },
        {
          "max_month": 12,
          "name": "葱花肉末",
          "action": "肉片切碎蒸熟，加入少许葱花"
        },
        {
          "max_month": 36,
          "name": "宝宝葱油肉片",
          "action": "同大人版少盐，肉片切薄些，确保充分熟透"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/scallion_garlic_pork_slices.png"
  },
  {
    "id": "a-chi-11",
    "name": "姜葱滑鸡丝",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 10,
    "ingredients": [
      {
        "name": "鸡胸肉",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_breast"
      },
      {
        "name": "韭黄",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜丝",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "葱段",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蛋清",
        "baseAmount": 1,
        "unit": "个",
        "category": "蛋类"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "淀粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡胸肉切成细丝，加入蛋清、料酒、生抽、白胡椒粉抓匀，最后加入淀粉上浆，腌制15分钟。韭黄切段，姜切丝，葱切段。"
      },
      {
        "action": "cook",
        "text": "热锅凉油，爆香姜丝，加入腌制好的鸡丝中火快速翻炒至变色。"
      },
      {
        "action": "cook",
        "text": "加入韭黄翻炒，适量盐调味，最后加入葱段大火快速翻炒30秒即可出锅，保持韭黄的脆嫩。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "姜汁鸡泥",
          "action": "鸡丝蒸熟打泥，加入少许姜汁调味"
        },
        {
          "max_month": 12,
          "name": "葱香鸡末",
          "action": "鸡丝切碎蒸熟，加入少许葱花"
        },
        {
          "max_month": 36,
          "name": "宝宝姜葱鸡丝",
          "action": "同大人版少盐，确保鸡丝切细且充分熟透"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/ginger_scallion_chicken_strips.png"
  },
  {
    "id": "a-veg-39",
    "name": "蒜蓉豆芽韭菜",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "绿豆芽",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "韭菜",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜末",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "豆芽洗净掐头，韭菜切段，蒜切末备用。"
      },
      {
        "action": "cook",
        "text": "热锅凉油，爆香蒜末，加入豆芽大火快速翻炒1分钟。"
      },
      {
        "action": "cook",
        "text": "加入韭菜，淋入生抽、蚝油，适量盐和白胡椒粉调味，大火快速翻炒30秒即可出锅，保持豆芽韭菜的脆嫩口感。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "豆芽泥",
          "action": "豆芽焖煮软烂打泥，去蒜末"
        },
        {
          "max_month": 12,
          "name": "豆芽韭菜碎",
          "action": "豆芽韭菜切碎蒸熟，少许调味"
        },
        {
          "max_month": 36,
          "name": "宝宝清炒豆芽",
          "action": "同大人版少盐，去蒜末，确保充分熟透"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_bean_sprouts_chives.png"
  },
  {
    "id": "a-beef-9",
    "name": "青椒牛肉末",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "beef",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "牛肉馅",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "ground_beef"
      },
      {
        "name": "青椒",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜末",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜末",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛肉馅加入料酒、生抽、蚝油、白胡椒粉抓匀腌制10分钟。青椒去籽切小丁，姜蒜切末。"
      },
      {
        "action": "cook",
        "text": "热锅凉油，爆香姜蒜末，加入牛肉馅大火快速翻炒至七分熟，用铲子将肉馅打散。"
      },
      {
        "action": "cook",
        "text": "加入青椒丁翻炒，适量盐调味，大火快速翻炒1分钟即可出锅，保持青椒的脆嫩。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "牛肉泥",
          "action": "牛肉蒸熟打泥，去掉青椒和姜蒜"
        },
        {
          "max_month": 12,
          "name": "牛肉青椒碎",
          "action": "牛肉和青椒分开蒸熟切碎，少许调味"
        },
        {
          "max_month": 36,
          "name": "宝宝青椒牛肉末",
          "action": "同大人版少盐，确保牛肉充分熟透"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/green_pepper_ground_beef.png"
  },
  {
    "id": "a-veg-40",
    "name": "金针菇炒青菜",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "金针菇",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "青菜",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜末",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "金针菇洗净切除根部，青菜洗净切段，蒜切末备用。"
      },
      {
        "action": "cook",
        "text": "热锅凉油，爆香蒜末，加入金针菇大火快速翻炒1分钟。"
      },
      {
        "action": "cook",
        "text": "加入青菜，淋入生抽、蚝油，适量盐和白胡椒粉调味，大火快速翻炒1分钟即可出锅，保持蔬菜的翠绿和爽脆。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "菇菜泥",
          "action": "金针菇青菜蒸熟打泥，去蒜末"
        },
        {
          "max_month": 12,
          "name": "菇菜碎",
          "action": "金针菇青菜切碎蒸熟，少许调味"
        },
        {
          "max_month": 36,
          "name": "宝宝炒菇菜",
          "action": "同大人版少盐，去蒜末，确保充分熟透"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/enoki_mushroom_greens.png"
  },
  {
    "id": "a-chi-12",
    "name": "柠香蒜片鸡",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sour_fresh",
    "cook_type": "stir_fry",
    "cook_minutes": 15,
    "ingredients": [
      {
        "name": "鸡胸肉",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_breast"
      },
      {
        "name": "蒜片",
        "baseAmount": 8,
        "unit": "片",
        "category": "调料"
      },
      {
        "name": "柠檬",
        "baseAmount": 1,
        "unit": "个",
        "category": "其他"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "淀粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡胸肉切片，加入料酒、生抽、蚝油、白胡椒粉腌制15分钟，最后加入淀粉抓匀。蒜切片，柠檬切片取汁。"
      },
      {
        "action": "cook",
        "text": "热锅冷油，爆香蒜片至金黄，盛出备用。同一锅中倒油大火将鸡肉滑炒至七分熟。"
      },
      {
        "action": "cook",
        "text": "加入蒜片，淋入柠檬汁，撒盐调味，大火快炒30秒即可出锅。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "柠香鸡肉泥",
          "action": "鸡肉蒸熟打泥，加入少许柠檬汁调味"
        },
        {
          "max_month": 12,
          "name": "柠香鸡肉碎",
          "action": "鸡肉切碎蒸熟，加入极少量柠檬汁"
        },
        {
          "max_month": 36,
          "name": "宝宝柠香鸡片",
          "action": "同大人版，去蒜，少放柠檬和盐"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/lemon_garlic_chicken.png"
  },
  {
    "id": "a-soup-18",
    "name": "虫草花炖乌鸡汤",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stew",
    "cook_minutes": 90,
    "ingredients": [
      {
        "name": "乌鸡",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "black_chicken"
      },
      {
        "name": "虫草花",
        "baseAmount": 20,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "枸杞",
        "baseAmount": 10,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "红枣",
        "baseAmount": 4,
        "unit": "颗",
        "category": "干货"
      },
      {
        "name": "姜片",
        "baseAmount": 3,
        "unit": "片",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "乌鸡斩块，焯水去血沫。虫草花提前用温水泡发15分钟，枸杞、红枣洗净。"
      },
      {
        "action": "cook",
        "text": "锅中加入2000ml清水，放入乌鸡和姜片，大火煮沸后转小火炖煮60分钟。"
      },
      {
        "action": "cook",
        "text": "加入泡发的虫草花、枸杞、红枣，继续小火炖30分钟，最后加盐调味即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "乌鸡虫草泥",
          "action": "取鸡肉打泥，加少许汤汁调稀"
        },
        {
          "max_month": 12,
          "name": "乌鸡虫草粥",
          "action": "取汤煮粥，加入剪碎的鸡肉"
        },
        {
          "max_month": 36,
          "name": "宝宝乌鸡汤",
          "action": "同大人版，少盐，取软烂鸡肉"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/cordyceps_black_chicken_soup.png"
  },
  {
    "id": "a-fish-10",
    "name": "姜葱蒸海鲈",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "fish",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [
      "鱼"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "海鲈鱼",
        "baseAmount": 600,
        "unit": "g",
        "category": "肉类",
        "sub_type": "fish_seabass"
      },
      {
        "name": "葱",
        "baseAmount": 2,
        "unit": "根",
        "category": "调料"
      },
      {
        "name": "姜",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鲈鱼处理干净，两面斜切花刀。葱切段，姜切丝。鱼身抹上料酒、盐、白胡椒粉腌制10分钟。"
      },
      {
        "action": "cook",
        "text": "蒸锅水开，将鱼放入盘中，表面铺上一半姜丝，大火蒸10分钟。"
      },
      {
        "action": "cook",
        "text": "取出后倒掉积水，撒上葱段和剩余姜丝，淋上热油和生抽即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鲈鱼泥",
          "action": "取无刺部位蒸熟打泥，无需调味"
        },
        {
          "max_month": 12,
          "name": "鲈鱼碎",
          "action": "取无刺部位蒸熟压碎，加少许葱花"
        },
        {
          "max_month": 36,
          "name": "宝宝蒸鲈鱼",
          "action": "同大人版，去掉姜丝，少放调味料"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/ginger_scallion_steamed_seabass.png"
  },
  {
    "id": "a-beef-10",
    "name": "蚝油芥兰牛肉",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "beef",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 10,
    "ingredients": [
      {
        "name": "牛里脊",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_tenderloin"
      },
      {
        "name": "芥兰",
        "baseAmount": 250,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "淀粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛里脊逆纹切片，加入料酒、生抽、蚝油腌制15分钟，最后加淀粉抓匀。芥兰切段，蒜切片。"
      },
      {
        "action": "cook",
        "text": "热锅下油，爆香蒜片，加入芥兰快速翻炒1分钟，加盐调味盛出。"
      },
      {
        "action": "cook",
        "text": "同一锅中加油大火将牛肉快速滑炒至七分熟，加入芥兰，淋入蚝油，撒白胡椒粉翻炒均匀即可。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "牛肉芥兰泥",
          "action": "牛肉芥兰分别蒸熟打泥，无需调味"
        },
        {
          "max_month": 12,
          "name": "牛肉芥兰碎",
          "action": "牛肉芥兰切碎蒸熟，加少许蚝油"
        },
        {
          "max_month": 36,
          "name": "宝宝版蚝油牛肉",
          "action": "同大人版，少放调味料"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/oyster_sauce_beef_kailan.png"
  },
  {
    "id": "a-pork-11",
    "name": "香菇炖排骨",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 45,
    "ingredients": [
      {
        "name": "排骨",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_ribs"
      },
      {
        "name": "香菇",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜片",
        "baseAmount": 3,
        "unit": "片",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "排骨切段，焯水去血沫。香菇洗净对半切，姜切片。"
      },
      {
        "action": "cook",
        "text": "锅中放油，爆香姜片，放入排骨翻炒，加入料酒、生抽、老抽翻炒上色。"
      },
      {
        "action": "cook",
        "text": "加入适量清水，大火煮沸后转小火炖30分钟，加入香菇继续炖15分钟，最后加盐和白胡椒粉调味。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "排骨香菇泥",
          "action": "取肉和香菇分别打泥，加少许汤汁调稀"
        },
        {
          "max_month": 12,
          "name": "排骨香菇粥",
          "action": "取肉和香菇剪碎，加汤煮粥"
        },
        {
          "max_month": 36,
          "name": "宝宝版炖排骨",
          "action": "同大人版，少放调味料，挑选软烂小块"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/braised_pork_ribs_mushroom.png"
  },
  {
    "id": "a-veg-41",
    "name": "香脆空炸花菜",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 8,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "花菜",
        "baseAmount": 400,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "蒜粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "花菜洗净切成小朵，控干水分。均匀涂抹橄榄油，撒上蒜粉、盐和黑胡椒。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热180度。将花菜均匀摆放在炸篮中，注意不要重叠。"
      },
      {
        "action": "cook",
        "text": "180度空炸10分钟，中途翻面一次，直至表面金黄酥脆。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "花菜泥",
          "action": "花菜清蒸后打泥，无需调味"
        },
        {
          "max_month": 12,
          "name": "花菜碎",
          "action": "花菜清蒸后切碎，可加少许橄榄油"
        },
        {
          "max_month": 36,
          "name": "宝宝花菜",
          "action": "蒸至软烂，切小朵，少许橄榄油调味"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_air_fried_cauliflower.png"
  },
  {
    "id": "a-pork-12",
    "name": "五香空炸排骨",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "pork",
    "prep_time": 15,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 18,
    "ingredients": [
      {
        "name": "小排骨",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_ribs"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "五香粉",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白芝麻",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "排骨切小段，用生抽、料酒、五香粉、蒜粉、盐腌制30分钟。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热200度。将排骨放入炸篮，单面烤10分钟。"
      },
      {
        "action": "cook",
        "text": "翻面后继续烤8分钟，最后撒上白芝麻点缀。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "排骨肉泥",
          "action": "排骨清蒸取肉打泥，加少许原汤调味"
        },
        {
          "max_month": 12,
          "name": "排骨肉末",
          "action": "排骨清蒸取肉切碎，可加入粥中"
        },
        {
          "max_month": 36,
          "name": "宝宝清蒸排骨",
          "action": "改为清蒸，去掉调味料，只加少许盐"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/five_spice_air_fried_ribs.png"
  },
  {
    "id": "a-fish-11",
    "name": "香酥空炸带鱼",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "fish",
    "prep_time": 15,
    "is_baby_friendly": false,
    "common_allergens": [
      "鱼"
    ],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "带鱼",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "fish_hairtail"
      },
      {
        "name": "料酒",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "姜片",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "干淀粉",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "带鱼切段，用料酒、姜片、盐腌制15分钟去腥。沥干水分后裹上薄层淀粉。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热180度。将带鱼均匀摆放，刷一层薄油。"
      },
      {
        "action": "cook",
        "text": "空炸12分钟，中间翻面一次，最后撒上白胡椒粉。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "带鱼泥",
          "action": "带鱼清蒸去刺打泥，确保无刺"
        },
        {
          "max_month": 12,
          "name": "带鱼肉末",
          "action": "带鱼清蒸去刺切碎，拌入粥中"
        },
        {
          "max_month": 36,
          "name": "宝宝清蒸带鱼",
          "action": "改为清蒸，去刺，只加少许盐调味"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_air_fried_hairtail.png"
  },
  {
    "id": "a-veg-42",
    "name": "香酥空炸杏鲍菇",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 15,
    "ingredients": [
      {
        "name": "杏鲍菇",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "蒜粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "干淀粉",
        "baseAmount": 20,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "杏鲍菇切片，厚度0.5厘米。用盐、蒜粉腌制10分钟，沥干后裹上薄层淀粉。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热180度。杏鲍菇片刷橄榄油放入炸篮。"
      },
      {
        "action": "cook",
        "text": "空炸15分钟，中间翻面一次，最后撒上黑胡椒。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "杏鲍菇泥",
          "action": "杏鲍菇清蒸后打泥"
        },
        {
          "max_month": 12,
          "name": "杏鲍菇丁",
          "action": "杏鲍菇清蒸后切小丁"
        },
        {
          "max_month": 36,
          "name": "宝宝杏鲍菇片",
          "action": "清蒸后切片，少许橄榄油调味"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_air_fried_king_oyster_mushroom.png"
  },
  {
    "id": "a-chi-14",
    "name": "蒜香蜂蜜鸡翅",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "sweet_sour",
    "cook_type": "stir_fry",
    "cook_minutes": 15,
    "ingredients": [
      {
        "name": "鸡中翅",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_wing"
      },
      {
        "name": "蒜末",
        "baseAmount": 15,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蜂蜜",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡翅洗净沥干，用生抽、料酒、盐、黑胡椒粉腌制15分钟。蒜剁成末备用。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热200度。鸡翅表面擦干，刷一层油，放入炸篮。"
      },
      {
        "action": "cook",
        "text": "200度烤8分钟，翻面后再烤7分钟至金黄。取出后趁热刷上蜂蜜蒜末混合酱，再送入空气炸锅180度烤2分钟上色。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "清蒸鸡肉泥",
          "action": "鸡翅去骨清蒸后打泥，加少许原汤调味"
        },
        {
          "max_month": 12,
          "name": "蒸鸡肉碎",
          "action": "鸡肉去骨清蒸后剁碎，可拌入少许胡萝卜泥"
        },
        {
          "max_month": 36,
          "name": "宝宝清蒸鸡翅",
          "action": "去掉调味料，仅用盐清蒸，去骨后切小块"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_honey_chicken_wings.png"
  },
  {
    "id": "a-veg-43",
    "name": "香脆杏鲍菇",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "杏鲍菇",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蒜粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "干香草",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "杏鲍菇纵向切成0.5cm厚片，用厨房纸吸干表面水分。"
      },
      {
        "action": "cook",
        "text": "将杏鲍菇片均匀涂抹橄榄油，撒上盐、黑胡椒粉、蒜粉和干香草。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热180度，将杏鲍菇片单层摆放，180度烤10分钟，中途翻面一次，直至两面金黄酥脆。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "杏鲍菇泥",
          "action": "杏鲍菇清蒸后打泥，只加少许盐调味"
        },
        {
          "max_month": 12,
          "name": "杏鲍菇条",
          "action": "杏鲍菇切条清蒸，撒少许盐"
        },
        {
          "max_month": 36,
          "name": "宝宝杏鲍菇片",
          "action": "同大人版，减少调味料，只使用少许盐"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_king_oyster_mushroom.png"
  },
  {
    "id": "a-pork-13",
    "name": "香煎五花肉",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "pork",
    "prep_time": 5,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 15,
    "ingredients": [
      {
        "name": "五花肉",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_belly"
      },
      {
        "name": "生抽",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "蒜粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "五花肉切成0.8cm厚片，用生抽、料酒、蒜粉、盐和黑胡椒腌制10分钟。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热200度。将腌制好的五花肉片放入炸篮，注意不要重叠。"
      },
      {
        "action": "cook",
        "text": "200度烤7分钟后翻面，继续烤6-8分钟至表面金黄酥脆，肉质鲜嫩。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "瘦肉泥",
          "action": "使用瘦肉部分清蒸后打泥，加少许原汤调味"
        },
        {
          "max_month": 12,
          "name": "瘦肉碎",
          "action": "瘦肉清蒸后剁碎，可拌入蔬菜泥"
        },
        {
          "max_month": 36,
          "name": "宝宝蒸肉片",
          "action": "选用瘦肉部分清蒸，切小块，只加少许盐"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_pork_belly.png"
  },
  {
    "id": "a-veg-44",
    "name": "椒盐玉米粒",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 10,
    "ingredients": [
      {
        "name": "玉米粒",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "椒盐粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蒜粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "黑胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "玉米粒洗净沥干，用厨房纸吸干表面水分。"
      },
      {
        "action": "cook",
        "text": "玉米粒拌入橄榄油，均匀撒上椒盐粉、蒜粉和黑胡椒粉。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热180度，放入玉米粒，烤8-10分钟，中间翻动1-2次，直至表面金黄。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "玉米泥",
          "action": "玉米粒清蒸后打泥，无需调味"
        },
        {
          "max_month": 12,
          "name": "原味玉米粒",
          "action": "玉米粒清蒸后直接食用"
        },
        {
          "max_month": 36,
          "name": "宝宝版玉米粒",
          "action": "同大人版，但不加椒盐，只使用少许橄榄油"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/salt_and_pepper_corn.png"
  },
  {
    "id": "a-beef-11",
    "name": "黑椒牛肉粒",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "beef",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 12,
    "ingredients": [
      {
        "name": "牛里脊",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_tenderloin"
      },
      {
        "name": "生抽",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "黑胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "橄榄油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛里脊切成2cm见方的小块，用生抽、蚝油、黑胡椒粉腌制15分钟。"
      },
      {
        "action": "cook",
        "text": "空气炸锅预热200度。牛肉块表面刷一层橄榄油。"
      },
      {
        "action": "cook",
        "text": "200度烤6分钟，翻面后再烤4-5分钟至表面焦香（三分熟），取出后撒适量盐调味。"
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "牛肉泥",
          "action": "牛肉清蒸后打泥，加少许原汤调味"
        },
        {
          "max_month": 12,
          "name": "牛肉碎",
          "action": "牛肉清蒸后剁碎，可拌入蔬菜泥"
        },
        {
          "max_month": 36,
          "name": "宝宝牛肉粒",
          "action": "清蒸后切小块，只加少许盐调味"
        }
      ]
    },
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/black_pepper_beef_cubes.png"
  },

  // ====== 空气炸锅替代菜谱 (is_airfryer_alt) ======
  // 疲惫模式下的极简空气炸锅方案，含 ingredients + steps，保证 preview/shopping/steps 全链路可用
  { id: 'af-chi-1', name: '空气炸锅蜜汁鸡翅', type: 'adult', meat: 'chicken', taste: 'quick_stir_fry', flavor_profile: 'sweet_sour', cook_type: 'air_fryer', prep_time: 5, cook_minutes: 18, is_baby_friendly: true, can_share_base: false, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '鸡翅', baseAmount: 400, unit: 'g', category: '肉类' },
    { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '蜂蜜', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '姜片', baseAmount: 2, unit: '片', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ], steps: [
    { text: '鸡翅洗净划刀，加料酒、生抽、蜂蜜、姜片、盐腌制约 10 分钟。' },
    { text: '放入空气炸锅，180 度烤 18 分钟。' },
    { text: '中途翻面一次，取出即可。' }
  ] },
  { id: 'af-chi-2', name: '空气炸锅盐焗鸡腿', type: 'adult', meat: 'chicken', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'air_fryer', prep_time: 3, cook_minutes: 20, is_baby_friendly: true, can_share_base: false, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '鸡腿', baseAmount: 350, unit: 'g', category: '肉类' },
    { name: '盐焗粉', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '姜片', baseAmount: 2, unit: '片', category: '调料' },
    { name: '油', baseAmount: 0, unit: '少许', category: '调料' }
  ], steps: [
    { text: '鸡腿洗净，抹匀盐焗粉、姜片，腌 5 分钟。' },
    { text: '放入空气炸锅，200 度 20 分钟。' },
    { text: '中途翻面，取出即可。' }
  ] },
  { id: 'af-pork-1', name: '空气炸锅脆皮五花肉', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'air_fryer', prep_time: 5, cook_minutes: 20, is_baby_friendly: false, can_share_base: false, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '五花肉', baseAmount: 350, unit: 'g', category: '肉类' },
    { name: '五香粉', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ], steps: [
    { text: '五花肉切厚片，抹五香粉、盐，腌 5 分钟。' },
    { text: '放入空气炸锅，200 度 20 分钟，中途翻面。' },
    { text: '表面金黄脆皮后取出即可。' }
  ] },
  { id: 'af-pork-2', name: '空气炸锅蒜香排骨', type: 'adult', meat: 'pork', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'air_fryer', prep_time: 5, cook_minutes: 18, is_baby_friendly: true, can_share_base: false, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '排骨', baseAmount: 350, unit: 'g', category: '肉类' },
    { name: '蒜末', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
  ], steps: [
    { text: '排骨加蒜末、生抽、料酒、盐腌制 10 分钟。' },
    { text: '放入空气炸锅，190 度 18 分钟。' },
    { text: '中途翻面，取出即可。' }
  ] },
  { id: 'af-beef-1', name: '空气炸锅黑椒牛肉粒', type: 'adult', meat: 'beef', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'air_fryer', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '牛肉', baseAmount: 300, unit: 'g', category: '肉类' },
    { name: '黑胡椒', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '油', baseAmount: 0, unit: '少许', category: '调料' }
  ], steps: [
    { text: '牛肉切粒，加黑胡椒、生抽、油拌匀。' },
    { text: '放入空气炸锅，200 度 15 分钟，中途翻动。' },
    { text: '取出即可。' }
  ] },
  { id: 'af-fish-1', name: '空气炸锅香酥鳕鱼块', type: 'adult', meat: 'fish', taste: 'quick_stir_fry', flavor_profile: 'light', cook_type: 'air_fryer', prep_time: 5, cook_minutes: 15, is_baby_friendly: true, can_share_base: false, is_airfryer_alt: true, common_allergens: ['鱼'], base_serving: 2, ingredients: [
    { name: '鳕鱼', baseAmount: 250, unit: 'g', category: '肉类' },
    { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '柠檬', baseAmount: 0, unit: '少许', category: '蔬菜' }
  ], steps: [
    { text: '鳕鱼切块，裹薄淀粉，撒盐。' },
    { text: '放入空气炸锅，180 度 15 分钟。' },
    { text: '取出挤柠檬汁即可。' }
  ] },
  { id: 'af-shrimp-1', name: '空气炸锅椒盐虾', type: 'adult', meat: 'shrimp', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'air_fryer', prep_time: 3, cook_minutes: 12, is_baby_friendly: true, can_share_base: false, is_airfryer_alt: true, common_allergens: ['虾'], base_serving: 2, ingredients: [
    { name: '虾', baseAmount: 250, unit: 'g', category: '肉类' },
    { name: '椒盐', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '料酒', baseAmount: 0, unit: '少许', category: '调料' }
  ], steps: [
    { text: '虾洗净剪须，加料酒、椒盐拌匀。' },
    { text: '放入空气炸锅，200 度 12 分钟，中途翻动。' },
    { text: '取出即可。' }
  ] },
  { id: 'af-veg-1', name: '空气炸锅蒜香杏鲍菇', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'salty_umami', cook_type: 'air_fryer', prep_time: 3, cook_minutes: 12, is_baby_friendly: true, can_share_base: true, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '杏鲍菇', baseAmount: 300, unit: 'g', category: '蔬菜' },
    { name: '蒜末', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '油', baseAmount: 0, unit: '少许', category: '调料' }
  ], steps: [
    { text: '杏鲍菇切条，加蒜末、生抽、油拌匀。' },
    { text: '放入空气炸锅，180 度 12 分钟，中途翻动。' },
    { text: '取出即可。' }
  ] },
  { id: 'af-veg-2', name: '空气炸锅孜然土豆块', type: 'adult', meat: 'vegetable', taste: 'quick_stir_fry', flavor_profile: 'spicy', cook_type: 'air_fryer', prep_time: 5, cook_minutes: 15, is_baby_friendly: false, can_share_base: true, is_airfryer_alt: true, common_allergens: [], base_serving: 2, ingredients: [
    { name: '土豆', baseAmount: 400, unit: 'g', category: '蔬菜' },
    { name: '孜然粉', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
    { name: '油', baseAmount: 0, unit: '少许', category: '调料' }
  ], steps: [
    { text: '土豆切块，加孜然、盐、油拌匀。' },
    { text: '放入空气炸锅，200 度 15 分钟。' },
    { text: '中途翻动，表面金黄取出即可。' }
  ] }
];

var babyRecipes = [
  { id: 'b-chi-detail', name: '板栗鲜鸡泥', type: 'baby', meat: 'chicken', taste: 'finger_food', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-fish-detail', name: '柠檬清蒸鳕鱼', type: 'baby', meat: 'fish', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['鱼'] },
  { id: 'b-pork-detail', name: '山药瘦肉末', type: 'baby', meat: 'pork', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: [] },
  { id: 'b-pork-2', name: '猪肉土豆小软饼', type: 'baby', meat: 'pork', taste: 'finger_food', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: [] },
  { id: 'b-pork-3', name: '猪肉白菜南瓜烩面', type: 'baby', meat: 'pork', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-pork-4', name: '山药排骨碎碎粥', type: 'baby', meat: 'pork', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['山药（接触时注意）'] },
  { id: 'b-shrimp-detail', name: '西兰花虾仁滑', type: 'baby', meat: 'shrimp', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['虾'] },
  { id: 'b-beef-detail', name: '番茄牛肉软饭', type: 'baby', meat: 'beef', taste: 'finger_food', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-beef-2', name: '土豆牛肉泥', type: 'baby', meat: 'beef', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-shrimp-2', name: '虾仁豆腐饼', type: 'baby', meat: 'shrimp', taste: 'finger_food', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: ['虾'] },
  { id: 'b-shrimp-3', name: '虾仁豆腐蒸蛋', type: 'baby', meat: 'shrimp', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: ['虾', '蛋'] },
  { id: 'b-fish-2', name: '鱼肉碎碎面', type: 'baby', meat: 'fish', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['鱼'] },
  { id: 'b-pork-5', name: '南瓜猪肉烩饭', type: 'baby', meat: 'pork', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-pork-6', name: '里脊时蔬软面', type: 'baby', meat: 'pork', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: [] },
  { id: 'b-chi-3', name: '鸡肉土豆泥', type: 'baby', meat: 'chicken', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-chi-4', name: '鸡肉西兰花饼', type: 'baby', meat: 'chicken', taste: 'finger_food', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: [] },
  { id: 'b-beef-3', name: '牛肉山药粥', type: 'baby', meat: 'beef', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: [] },
  { id: 'b-beef-4', name: '土豆牛肉软饭', type: 'baby', meat: 'beef', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-fish-3', name: '清蒸鱼肉泥', type: 'baby', meat: 'fish', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: ['鱼'] },
  { id: 'b-shrimp-4', name: '虾仁蒸蛋', type: 'baby', meat: 'shrimp', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: false, common_allergens: ['虾', '蛋'] },
  { id: 'b-chi-5', name: '南瓜鸡肉碎碎粥', type: 'baby', meat: 'chicken', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: [] },
  { id: 'b-chi-6', name: '番茄鸡肉蝴蝶面', type: 'baby', meat: 'chicken', taste: 'soft_porridge', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['麸质'] },
  { id: 'b-fish-4', name: '鳕鱼土豆小软饼', type: 'baby', meat: 'fish', taste: 'finger_food', prep_time: 15, is_baby_friendly: true, can_share_base: false, common_allergens: ['鱼', '蛋'] },
  { id: 'b-shrimp-5', name: '番茄虾仁烩饭', type: 'baby', meat: 'shrimp', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['虾'] },
  { id: 'b-shrimp-6', name: '西兰花虾仁豆腐烩面', type: 'baby', meat: 'shrimp', taste: 'braised_mash', prep_time: 10, is_baby_friendly: true, can_share_base: true, common_allergens: ['虾'] }
];

var templateCombos = [
  {
    name: '经典川式开胃套餐',
    description: '重口味下饭菜与清淡汤品的完美平衡',
    meat_count: 2,
    veg_count: 2,
    soup_count: 1,
    flavor_logic: '1重辣 + 1咸鲜 + 2清爽 + 1温润',
    items: [
      { name: '回锅肉', role: 'main_meat', flavor: 'spicy', cook_type: 'quick_stir_fry', meat: 'pork', taste: 'quick_stir_fry' },
      { name: '鱼香肉丝', role: 'sub_meat', flavor: 'sweet_sour', cook_type: 'quick_stir_fry', meat: 'pork', taste: 'quick_stir_fry' },
      { name: '手撕包菜', role: 'veg', flavor: 'salty_umami', cook_type: 'quick_stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
      { name: '蒜蓉西兰花', role: 'veg', flavor: 'light', cook_type: 'quick_stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
      { name: '番茄蛋花汤', role: 'soup', flavor: 'light', cook_type: 'stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
    ],
    baby_link_index: 1
  },
  {
    name: '粤式滋补养生套餐',
    description: '侧重食材原汁原味，适合有老有小的家庭',
    meat_count: 2,
    veg_count: 2,
    soup_count: 1,
    flavor_logic: '2鲜香 + 2清淡 + 1浓郁炖汤',
    items: [
      { name: '清蒸鳕鱼配葱丝', role: 'main_meat', flavor: 'light', cook_type: 'steam', meat: 'fish', taste: 'steamed_salad' },
      { name: '玉米排骨汤', role: 'sub_meat', flavor: 'salty_umami', cook_type: 'stew', meat: 'pork', taste: 'slow_stew' },
      { name: '蒜蓉西兰花', role: 'veg', flavor: 'light', cook_type: 'quick_stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
      { name: '清炒时蔬', role: 'veg', flavor: 'light', cook_type: 'quick_stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
      { name: '五指毛桃排骨汤', role: 'soup', flavor: 'salty_umami', cook_type: 'stew', meat: 'pork', taste: 'slow_stew' },
    ],
    baby_link_index: 1
  },
  {
    name: '家常下饭江浙风味',
    description: '色泽红润，甜咸适中，操作逻辑最顺',
    meat_count: 2,
    veg_count: 2,
    soup_count: 1,
    items: [
      { name: '红烧肉', role: 'main_meat', flavor: 'sweet_sour', cook_type: 'stew', meat: 'pork', taste: 'slow_stew' },
      { name: '滑溜里脊片', role: 'sub_meat', flavor: 'light', cook_type: 'quick_stir_fry', meat: 'pork', taste: 'quick_stir_fry' },
      { name: '地三鲜', role: 'veg', flavor: 'salty_umami', cook_type: 'quick_stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
      { name: '拍黄瓜', role: 'veg', flavor: 'sour_fresh', cook_type: 'steam', meat: 'vegetable', taste: 'steamed_salad' },
      { name: '紫菜蛋花汤', role: 'soup', flavor: 'light', cook_type: 'stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' },
    ],
    baby_link_index: 1
  }
];

module.exports = { adultRecipes: adultRecipes, babyRecipes: babyRecipes, templateCombos: templateCombos };
