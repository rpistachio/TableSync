/**
 * 核心数据库（微信小程序版 - CommonJS）
 * 食材格式：{ name, baseAmount, unit, category [, sub_type ] }，调料类 baseAmount: 0, unit: '适量'
 * 肉类食材必填 sub_type（具体部位），避免同类不同部位被错误合并。
 * 鱼/虾类菜谱主料使用 category: '肉类'、sub_type 如 fish_cod/fish_seabass/shrimp，采购清单会正确合并。
 * 菜谱层级：can_share_base（是否可与配对宝宝餐共用基底、一锅出）。
 *
 * taste 字段与 UI 分类映射：
 * 大人：quick_stir_fry → 快手小炒，slow_stew → 暖心炖煮，steamed_salad → 精选蒸/拌
 * 宝宝：soft_porridge → 营养粥面，finger_food → 趣味手口料，braised_mash → 开胃烩菜
 *
 * 素菜类：meat: 'vegetable'，多菜并行时固定一道从素菜中抽取，无宝宝配对。
 *
 * flavor_profile：辣(spicy)、咸鲜(salty_umami)、清淡(light)、酸甜(sweet_sour)、酸爽解腻(sour_fresh)
 * cook_type：炖(stew)、蒸(steam)、炒(stir_fry)
 * dish_type：菜品类型，枚举值：soup(汤类)，用于替代名称包含"汤"的判断逻辑
 *
 * ============ 统筹算法支持字段（自动填充） ============
 * base_serving: (Number) 默认份量基数，默认 2 人份
 * cook_method: (String) 烹饪方式，枚举值：stir_fry(快炒)、steam(清蒸)、stew(慢炖)、cold_dress(凉拌)
 * tags: (Array) 标签数组，可选值：quick(快手)、no_oil(少油)、spicy(辣味)、soup(汤类)、
 *               high_protein(高蛋白)、vegetarian(素食)、baby_friendly(宝宝友好)
 * main_ingredients: (Array) 主料名数组，从 ingredients 中自动提取，用于食材去重
 * difficulty: (Number) 难度等级 1-3（1=简单，2=中等，3=复杂）
 */
var FLAVOR_KEYWORDS = [
  { key: '宫保', flavor: 'spicy' }, { key: '辣椒', flavor: 'spicy' }, { key: '干辣椒', flavor: 'spicy' }, { key: '花椒', flavor: 'spicy' },
  { key: '清蒸', flavor: 'light' }, { key: '柠檬', flavor: 'light' }, { key: '葱丝', flavor: 'light' },
  { key: '凉拌', flavor: 'sour_fresh' }, { key: '拍黄瓜', flavor: 'sour_fresh' }, { key: '酸', flavor: 'sour_fresh' },
  { key: '番茄', flavor: 'sweet_sour' }, { key: '西红柿', flavor: 'sweet_sour' },
  { key: '蒜蓉', flavor: 'salty_umami' }, { key: '豉油', flavor: 'salty_umami' }, { key: '炖', flavor: 'salty_umami' }, { key: '煲', flavor: 'salty_umami' }, { key: '排骨', flavor: 'salty_umami' }
];
function defaultFlavorProfile(r) {
  var n = (r.name || '');
  for (var i = 0; i < FLAVOR_KEYWORDS.length; i++) {
    if (n.indexOf(FLAVOR_KEYWORDS[i].key) !== -1) return FLAVOR_KEYWORDS[i].flavor;
  }
  if (r.taste === 'steamed_salad') return 'light';
  if (r.taste === 'slow_stew') return 'salty_umami';
  return 'salty_umami';
}
function defaultCookType(r) {
  if (r.taste === 'slow_stew') return 'stew';
  if (r.taste === 'steamed_salad') return 'steam';
  return 'stir_fry';
}
function defaultRecommendReason(r) {
  if (r.taste === 'slow_stew') return '暖心炖煮，营养入味';
  if (r.taste === 'steamed_salad') return '清淡少油，健康之选';
  return '快手小炒，下饭必备';
}
function defaultCookMinutes(r) {
  if (r.taste === 'slow_stew') return 60;
  if (r.taste === 'steamed_salad') return 15;
  return 15;
}

/**
 * ============ 统筹算法支持字段 - 默认值函数 ============
 */

/** 默认份量基数，始终返回 2 人份 */
function defaultBaseServing() {
  return 2;
}

/**
 * 根据菜谱特征判断烹饪方式
 * @returns {String} stir_fry | steam | stew | cold_dress
 */
function defaultCookMethod(r) {
  var n = (r.name || '');
  // 凉拌类
  if (n.indexOf('凉拌') !== -1 || n.indexOf('拍黄瓜') !== -1) return 'cold_dress';
  // 清蒸/白切类
  if (r.taste === 'steamed_salad' || n.indexOf('清蒸') !== -1 || n.indexOf('蒸') !== -1 || n.indexOf('白切') !== -1 || n.indexOf('白灼') !== -1) return 'steam';
  // 慢炖/煲汤类：优先使用 dish_type 字段判断，兼容名称检测
  if (r.dish_type === 'soup' || r.taste === 'slow_stew' || n.indexOf('炖') !== -1 || n.indexOf('煲') !== -1 || n.indexOf('汤') !== -1 || n.indexOf('焖') !== -1) return 'stew';
  // 默认快炒
  return 'stir_fry';
}

/**
 * 根据菜谱特征生成标签数组
 * @returns {Array} 标签数组，如 ['quick', 'spicy', 'high_protein']
 */
function defaultTags(r) {
  var tags = [];
  var n = (r.name || '');
  var prepTime = r.prep_time || 15;
  var cookMins = r.cook_minutes || defaultCookMinutes(r);

  // 快手菜：准备+烹饪时间 <= 25 分钟
  if (prepTime + cookMins <= 25) tags.push('quick');

  // 少油/无油：清蒸、凉拌、白切、白灼类
  if (r.taste === 'steamed_salad' || n.indexOf('清蒸') !== -1 || n.indexOf('凉拌') !== -1 || n.indexOf('白切') !== -1 || n.indexOf('白灼') !== -1) {
    tags.push('no_oil');
  }

  // 辣味
  if (r.flavor_profile === 'spicy' || n.indexOf('辣') !== -1 || n.indexOf('宫保') !== -1 || n.indexOf('麻婆') !== -1) {
    tags.push('spicy');
  }

  // 汤类：优先使用 dish_type 字段判断，兼容名称检测
  if (r.dish_type === 'soup' || n.indexOf('汤') !== -1 || (r.id && r.id.indexOf('soup') !== -1)) {
    tags.push('soup');
  }

  // 高蛋白：肉类、鱼虾类
  if (r.meat && r.meat !== 'vegetable') {
    tags.push('high_protein');
  }

  // 素食
  if (r.meat === 'vegetable') {
    tags.push('vegetarian');
  }

  // 宝宝友好
  if (r.is_baby_friendly) {
    tags.push('baby_friendly');
  }

  return tags;
}

/**
 * 从食材列表中提取主料名称（非调料类）
 * @returns {Array} 主料名数组，如 ['鸡腿', '板栗']
 */
function defaultMainIngredients(r) {
  if (!r.ingredients || !Array.isArray(r.ingredients)) return [];
  var mainList = [];
  for (var i = 0; i < r.ingredients.length; i++) {
    var ing = r.ingredients[i];
    // 排除调料类
    if (ing.category !== '调料' && ing.baseAmount !== 0) {
      mainList.push(ing.name);
    }
  }
  return mainList;
}

/**
 * 根据菜谱复杂度判断难度等级
 * @returns {Number} 1-3 级（1=简单，2=中等，3=复杂）
 */
function defaultDifficulty(r) {
  var n = (r.name || '');
  var prepTime = r.prep_time || 15;
  var cookMins = r.cook_minutes || defaultCookMinutes(r);
  var stepCount = (r.steps && r.steps.length) || 2;

  // 复杂菜谱：炖煮超过 45 分钟，或多步骤，或特殊技法
  if (cookMins >= 45 || stepCount >= 4 || n.indexOf('孔雀开屏') !== -1 || n.indexOf('红烧肉') !== -1) {
    return 3;
  }
  // 简单菜谱：准备时间 <= 8 分钟，且烹饪时间 <= 15 分钟
  if (prepTime <= 8 && cookMins <= 15) {
    return 1;
  }
  // 中等难度
  return 2;
}
var adultRecipes = [
  { id: 'a-soup-1', name: '花旗参石斛炖鸡汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'chicken',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '鸡腿', baseAmount: 400, unit: 'g', category: '肉类', sub_type: 'chicken_thigh' },
      { name: '石斛', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '花旗参', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡腿切大块，冷水下锅焯水，撇净浮沫后捞出洗净。石斛、花旗参用清水稍冲洗，与鸡肉、姜片一同放入炖盅，加足量清水。' },
      { action: 'cook', text: '炖盅盖盖，隔水大火烧开后转小火慢炖 2 小时，出锅前加盐调味即可。' }
    ] },
  { id: 'a-soup-2', name: '五指毛桃排骨汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '排骨', baseAmount: 350, unit: 'g', category: '肉类', sub_type: 'pork_ribs' },
      { name: '五指毛桃', baseAmount: 30, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '芡实', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨冷水下锅，加姜片、料酒焯水，撇净浮沫后捞出洗净。五指毛桃、红枣、芡实洗净，与排骨、姜片一同入锅，加足量清水。' },
      { action: 'cook', text: '大火烧开后转小火煲 1.5 小时，汤色奶白香浓，出锅前加盐调味即可。' }
    ] },
  { id: 'a-soup-3', name: '鲜淮山炖牛肉汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛里脊', baseAmount: 250, unit: 'g', category: '肉类', sub_type: 'beef_tenderloin' },
      { name: '鲜淮山', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛里脊切厚片，鲜淮山去皮切块（可泡清水防氧化）。牛肉与淮山、姜片一同入锅，加足量温水。' },
      { action: 'cook', text: '大火烧开转小火慢炖至牛肉酥烂、淮山软糯，加少许盐调味即可。' }
    ] },
  { id: 'a-chi-1', name: '清蒸柠檬鸡里脊', type: 'adult', taste: 'steamed_salad', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡里脊', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'chicken_tenderloin' },
      { name: '柠檬', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡里脊去筋膜，逆纹切成薄片，铺在盘内，撒少许盐。柠檬切薄片，姜切薄片备用。' },
      { action: 'cook', text: '鸡片上铺姜片、柠檬片，水开后上锅大火蒸 10 分钟，取出淋少许生抽即可。' }
    ] },
  { id: 'a-chi-2', name: '宫保鸡丁', type: 'adult', taste: 'quick_stir_fry', meat: 'chicken',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['花生'],
    can_share_base: false,
    ingredients: [
      { name: '鸡胸肉', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'chicken_breast' },
      { name: '干辣椒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '花椒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '花生米', baseAmount: 50, unit: 'g', category: '其他' },
      { name: '姜蒜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '酱油等芡汁', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡胸肉切丁，加少许生抽、料酒、干淀粉抓匀腌制 15 分钟。干辣椒剪段去籽，姜蒜切末，调好宫保芡汁（生抽、醋、糖、淀粉、少许水）。' },
      { action: 'cook', text: '热锅凉油，中火炒香干辣椒、花椒，下鸡丁大火滑炒至变色，加姜蒜、花生米，淋芡汁大火翻匀，收汁即可。' }
    ] },
  { id: 'a-fish-1', name: '清蒸鳕鱼配葱丝', type: 'adult', taste: 'steamed_salad', meat: 'fish',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: true,
    ingredients: [
      { name: '鳕鱼', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'fish_cod' },
      { name: '葱', baseAmount: 20, unit: 'g', category: '蔬菜' },
      { name: '姜丝', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '蒸鱼豉油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鳕鱼解冻后用厨房纸吸干水分，鱼身抹少许盐，盘底铺姜丝，放上鳕鱼。葱切细丝泡冷水备用。' },
      { action: 'cook', text: '水开后上锅大火蒸 8 分钟，取出倒掉盘内腥水，铺上葱丝，淋蒸鱼豉油，烧热油浇在葱丝上即可。' }
    ] },
  { id: 'a-shrimp-1', name: '蒜蓉粉丝蒸虾', type: 'adult', taste: 'steamed_salad', meat: 'shrimp',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: true,
    ingredients: [
      { name: '鲜虾', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '粉丝', baseAmount: 80, unit: 'g', category: '干货' },
      { name: '蒜', baseAmount: 25, unit: 'g', category: '蔬菜' },
      { name: '蒜蓉酱或生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲜虾剪须、去虾线、开背。粉丝用温水泡软沥干，铺在盘底。蒜剁成蓉，一半用油炒香成金银蒜，与另一半生蒜、少许生抽调成蒜蓉酱。' },
      { action: 'cook', text: '虾摆放在粉丝上，淋上蒜蓉酱，水开后上锅大火蒸 5 分钟，撒葱花即可。' }
    ] },
  { id: 'a-beef-1', name: '杭椒牛柳', type: 'adult', taste: 'quick_stir_fry', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '牛柳', baseAmount: 280, unit: 'g', category: '肉类', sub_type: 'beef_tenderloin' },
      { name: '杭椒', baseAmount: 80, unit: 'g', category: '蔬菜' },
      { name: '黑椒汁', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒淀粉等', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛柳逆纹切丝。关键：先加少许水抓至粘手，再加生抽、胡椒粉、干淀粉腌制15分钟。最后封一层油。' },
      { action: 'cook', text: '热锅凉油，下牛柳大火滑炒至8成熟迅速盛出。利用余油炒香姜蒜和杭椒，待杭椒皮起皱，倒入牛柳，沿锅边淋入生抽大火翻匀，30秒内出锅。' }
    ] },
  { id: 'a-pork-1', name: '玉米排骨汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '排骨', baseAmount: 350, unit: 'g', category: '肉类', sub_type: 'pork_ribs' },
      { name: '玉米', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨冷水下锅加姜片焯水，撇净浮沫后捞出洗净。玉米切段。排骨与姜片入锅，加足量清水。' },
      { action: 'cook', text: '大火烧开转小火慢煨 40 分钟，放入玉米段再炖 20 分钟，加盐调味即可。' }
    ] },
  { id: 'a-beef-2', name: '番茄牛腩', type: 'adult', taste: 'slow_stew', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛腩', baseAmount: 350, unit: 'g', category: '肉类', sub_type: 'beef_brisket' },
      { name: '番茄', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '洋葱', baseAmount: 80, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛腩切块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出。番茄、洋葱切块备用。' },
      { action: 'cook', text: '牛腩与姜片入锅，加足量热水大火烧开转小火炖约 1 小时至软烂，放入番茄、洋葱再炖 20 分钟，加盐调味即可。' }
    ] },
  { id: 'a-shrimp-2', name: '滑蛋虾仁', type: 'adult', taste: 'quick_stir_fry', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: false,
    common_allergens: ['虾', '蛋'],
    can_share_base: false,
    ingredients: [
      { name: '虾仁', baseAmount: 200, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '鸡蛋', baseAmount: 2, unit: '个', category: '蛋类' },
      { name: '葱', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '虾仁用料酒、少许盐、干淀粉抓匀腌制 10 分钟。鸡蛋打散加少许盐，葱切花。' },
      { action: 'cook', text: '热锅少油，中火滑炒虾仁至变色盛出。余油倒入蛋液，炒至半凝固时倒回虾仁、葱花，大火快炒 20 秒，加盐调味出锅。' }
    ] },
  { id: 'a-fish-2', name: '孔雀开屏鱼', type: 'adult', taste: 'steamed_salad', meat: 'fish',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: ['鱼'],
    can_share_base: true,
    ingredients: [
      { name: '鲈鱼', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'fish_seabass' },
      { name: '葱', baseAmount: 20, unit: 'g', category: '蔬菜' },
      { name: '姜', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '蒸鱼豉油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲈鱼去鳞去内脏洗净，从背部每隔约 1cm 切连刀片至腹部不断，展开成孔雀开屏状。鱼身抹少许盐，盘底铺姜丝，摆上鱼。葱切细丝泡冷水。' },
      { action: 'cook', text: '水开后上锅大火蒸 8 分钟，取出倒掉蒸汁，淋蒸鱼豉油，撒葱丝，烧热油浇在葱丝上即可。' }
    ] },
  { id: 'a-beef-3', name: '番茄炖牛腩', type: 'adult', taste: 'slow_stew', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛腩', baseAmount: 250, unit: 'g', category: '肉类', sub_type: 'beef_brisket' },
      { name: '番茄', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '洋葱', baseAmount: 60, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛腩切块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出。番茄、洋葱切块备用。' },
      { action: 'cook', text: '牛腩与姜片入锅，加足量热水大火烧开转小火炖约 1 小时至软烂，放入番茄、洋葱再炖 20 分钟，加盐调味即可。' }
    ] },
  { id: 'a-pork-2', name: '蒜香蒸排骨', type: 'adult', taste: 'steamed_salad', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '排骨', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'pork_ribs' },
      { name: '蒜', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '豆豉', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨斩小块洗净沥水。蒜、豆豉剁碎，与生抽、淀粉、少许油调成腌料，与排骨抓匀腌 20 分钟。' },
      { action: 'cook', text: '排骨摆盘（可铺平），水开后上锅大火蒸 25 分钟至脱骨，撒葱花即可。' }
    ] },
  { id: 'a-pork-3', name: '滑溜里脊片', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 12,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '猪里脊', baseAmount: 200, unit: 'g', category: '肉类', sub_type: 'pork_tenderloin' },
      { name: '木耳', baseAmount: 30, unit: 'g', category: '干货' },
      { name: '胡萝卜', baseAmount: 40, unit: 'g', category: '蔬菜' },
      { name: '葱姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '猪里脊逆纹切薄片，加少许盐、料酒、干淀粉抓匀上浆，封一层油。木耳泡发撕小朵，胡萝卜切片，葱姜切末。调好芡汁（生抽、淀粉、少许水）。' },
      { action: 'cook', text: '热锅凉油，中火滑熟里脊片至变色盛出。余油爆香葱姜，下木耳、胡萝卜翻炒至变软，倒回里脊片，淋芡汁大火翻匀，加盐调味出锅。' }
    ] },
  { id: 'a-pork-4', name: '白菜豆腐炖五花', type: 'adult', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '五花肉', baseAmount: 150, unit: 'g', category: '肉类', sub_type: 'pork_belly' },
      { name: '白菜', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '嫩豆腐', baseAmount: 150, unit: 'g', category: '其他' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '五花肉切薄片，白菜切段，嫩豆腐切块。' },
      { action: 'cook', text: '锅内少油，中火煸炒五花肉至出油、微卷，加姜片、白菜翻炒，加适量热水烧开，放入豆腐块，中火炖 10 分钟，加盐调味即可。' }
    ] },
  { id: 'a-chi-3', name: '栗子焖鸡', type: 'adult', taste: 'slow_stew', meat: 'chicken',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡腿', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'chicken_thigh' },
      { name: '板栗', baseAmount: 100, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡腿斩块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出。板栗去壳或取现成栗仁备用。' },
      { action: 'cook', text: '锅内少油，鸡块与姜片煸香，加生抽、热水没过鸡块，大火烧开转小火焖 15 分钟，放入板栗再焖 25 分钟至鸡肉软烂、栗子粉糯，加盐调味收汁即可。' }
    ] },
  { id: 'a-chi-4', name: '白切鸡', type: 'adult', taste: 'steamed_salad', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡腿', baseAmount: 350, unit: 'g', category: '肉类', sub_type: 'chicken_thigh' },
      { name: '姜葱', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡腿洗净。姜葱切末，加少许盐、食用油调成蘸料备用。' },
      { action: 'cook', text: '鸡腿冷水下锅，加姜片，大火烧开转小火浸煮 18 分钟，用筷子扎无血水即熟。捞出浸冰水 5 分钟，斩件装盘，配姜葱盐油蘸料。' }
    ] },
  { id: 'a-beef-4', name: '小炒黄牛肉', type: 'adult', taste: 'quick_stir_fry', meat: 'beef',
    prep_time: 12,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '牛柳', baseAmount: 250, unit: 'g', category: '肉类', sub_type: 'beef_tenderloin' },
      { name: '香菜', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '小米椒', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '姜蒜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛柳逆纹切薄片，加料酒、生抽、干淀粉抓匀腌制 15 分钟，封一层油。香菜切段，小米椒切圈，姜蒜切末。' },
      { action: 'cook', text: '热锅凉油，大火滑熟牛肉片至变色盛出。余油爆香姜蒜、小米椒，倒回牛肉与香菜快炒 20 秒，淋少许生抽出锅。' }
    ] },
  { id: 'a-beef-5', name: '咖喱牛腩', type: 'adult', taste: 'slow_stew', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛腩', baseAmount: 250, unit: 'g', category: '肉类', sub_type: 'beef_brisket' },
      { name: '土豆', baseAmount: 150, unit: 'g', category: '蔬菜' },
      { name: '洋葱', baseAmount: 80, unit: 'g', category: '蔬菜' },
      { name: '咖喱块', baseAmount: 30, unit: 'g', category: '调料' },
      { name: '椰浆或牛奶', baseAmount: 50, unit: 'ml', category: '其他' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛腩切块，冷水下锅加姜片焯水，撇净浮沫后捞出。土豆、洋葱切块备用。' },
      { action: 'cook', text: '牛腩与姜片入锅，加足量热水大火烧开转小火炖约 1 小时至软烂，放入土豆、洋葱和咖喱块，煮 15 分钟，加椰浆或牛奶、盐调味即可。' }
    ] },
  { id: 'a-shrimp-3', name: '避风塘炒虾', type: 'adult', taste: 'quick_stir_fry', meat: 'shrimp',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: false,
    ingredients: [
      { name: '鲜虾', baseAmount: 250, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '蒜末', baseAmount: 40, unit: 'g', category: '蔬菜' },
      { name: '面包糠', baseAmount: 50, unit: 'g', category: '其他' },
      { name: '干辣椒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '豆豉', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲜虾剪须、开背、去肠线，沥干后拍少许干淀粉。蒜剁成末，干辣椒剪段。' },
      { action: 'cook', text: '油锅六成热将虾炸至外壳酥脆捞出。锅内留底油，中火炒香蒜末、豆豉、干辣椒、面包糠至金黄，倒回大虾快炒，淋料酒、盐调味出锅。' }
    ] },
  { id: 'a-fish-3', name: '红烧鱼块', type: 'adult', taste: 'quick_stir_fry', meat: 'fish',
    prep_time: 12,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: false,
    ingredients: [
      { name: '鲈鱼', baseAmount: 400, unit: 'g', category: '肉类', sub_type: 'fish_seabass' },
      { name: '姜葱', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '老抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '糖', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲈鱼斩块，用料酒、姜片、少许盐腌 10 分钟。姜切片，葱切段。' },
      { action: 'cook', text: '锅内少油，鱼块煎至两面金黄，加姜葱、生抽、老抽、糖和适量热水，中火焖 10 分钟至入味，大火收汁，撒葱花即可。' }
    ] },
  { id: 'a-pork-5', name: '回锅肉', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '五花肉', baseAmount: 200, unit: 'g', category: '肉类', sub_type: 'pork_belly' },
      { name: '青蒜', baseAmount: 80, unit: 'g', category: '蔬菜' },
      { name: '郫县豆瓣', baseAmount: 15, unit: 'g', category: '调料' },
      { name: '豆豉', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '糖', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '五花肉冷水下锅，加姜片、料酒、花椒煮至8成熟。捞出晾凉（或冷水冲凉）后，切成薄如蝉翼的连体片。' },
      { action: 'cook', text: '锅内少许油，下肉片中火煸炒，直至肉片吐油、边缘卷曲成\'灯盏窝\'。此时下豆瓣酱、豆豉炒出红油，再入青蒜段，大火翻炒至叶片变软、颜色转翠绿即可。' }
    ] },
  { id: 'a-pork-6', name: '鱼香肉丝', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 12,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '猪里脊', baseAmount: 200, unit: 'g', category: '肉类', sub_type: 'pork_tenderloin' },
      { name: '木耳', baseAmount: 40, unit: 'g', category: '干货' },
      { name: '胡萝卜', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '笋丝', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '泡椒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱姜蒜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '醋', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '糖', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '猪里脊切丝，加少许生抽、料酒、干淀粉抓匀上浆，封一层油。木耳泡发切丝，胡萝卜、笋切丝，泡椒、葱姜蒜切末。调好鱼香汁（醋、糖、生抽、淀粉、少许水）。' },
      { action: 'cook', text: '热锅凉油，中火滑熟肉丝至变色盛出。余油爆香泡椒、葱姜蒜，下木耳、胡萝卜、笋丝大火翻炒至丝条变半透明、保持清脆感，倒回肉丝，淋鱼香汁大火翻匀出锅。' }
    ] },
  { id: 'a-veg-1', name: '手撕包菜', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 8,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '包菜', baseAmount: 400, unit: 'g', category: '蔬菜' },
      { name: '干辣椒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '蒜', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '醋', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '包菜手撕成块（梗可拍扁），蒜拍碎，干辣椒剪段。' },
      { action: 'cook', text: '热锅少油，中火爆香蒜、干辣椒，下包菜大火快炒至边缘微焦，淋醋、生抽、盐，大火翻炒至叶片变软、颜色转翠绿即可。' }
    ] },
  { id: 'a-veg-2', name: '蒜蓉西兰花', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '西兰花', baseAmount: 350, unit: 'g', category: '蔬菜' },
      { name: '蒜', baseAmount: 25, unit: 'g', category: '蔬菜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '西兰花掰小朵，沸水加少许盐、油焯 1 分钟捞出沥干。蒜切末。' },
      { action: 'cook', text: '热锅少油，中火炒香蒜末，下西兰花大火翻炒，加盐调味，淋少许清水兜匀即可。' }
    ] },
  { id: 'a-veg-3', name: '清炒时蔬', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 8,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '时令青菜', baseAmount: 400, unit: 'g', category: '蔬菜' },
      { name: '蒜', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '时令青菜洗净沥干，蒜拍碎。' },
      { action: 'cook', text: '热锅少油，中火爆香蒜，下青菜大火快炒至叶片变软、颜色转翠绿，加盐翻炒即可。' }
    ] },
  { id: 'a-veg-4', name: '拍黄瓜', type: 'adult', taste: 'steamed_salad', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '黄瓜', baseAmount: 350, unit: 'g', category: '蔬菜' },
      { name: '蒜', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '醋', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '香油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '黄瓜用刀背拍裂后切段，加少许盐腌 2 分钟，挤去多余水分。蒜拍碎。' },
      { action: 'cook', text: '黄瓜段加蒜、醋、生抽、香油拌匀即可。' }
    ] },
  { id: 'a-veg-5', name: '西红柿炒蛋', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    ingredients: [
      { name: '番茄', baseAmount: 250, unit: 'g', category: '蔬菜' },
      { name: '鸡蛋', baseAmount: 2, unit: '个', category: '蛋类' },
      { name: '葱', baseAmount: 10, unit: 'g', category: '蔬菜' },
      { name: '糖', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '番茄切块，鸡蛋打散加少许盐，葱切末。' },
      { action: 'cook', text: '热锅少油，蛋液炒至凝固成块盛出。余油下番茄块中火炒至出汁，加糖、盐，倒回鸡蛋大火翻炒，撒葱花即可。' }
    ] },
  { id: 'a-pork-7', name: '红烧肉', type: 'adult', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '五花肉', baseAmount: 400, unit: 'g', category: '肉类', sub_type: 'pork_belly' },
      { name: '冰糖', baseAmount: 20, unit: 'g', category: '调料' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱段', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '老抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '五花肉切块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出洗净。' },
      { action: 'cook', text: '锅内少油，下冰糖小火炒至焦糖色，下肉块翻炒上色，加姜葱、料酒、生抽、老抽和热水没过肉，大火烧开转小火焖 50 分钟至软烂，大火收汁，加盐调味即可。' }
    ] },
  { id: 'a-veg-6', name: '地三鲜', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 12,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '土豆', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '茄子', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '青椒', baseAmount: 80, unit: 'g', category: '蔬菜' },
      { name: '蒜', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '土豆、茄子切滚刀块，青椒切块，蒜拍碎。调好淀粉水（生抽、淀粉、少许水）。' },
      { action: 'cook', text: '锅内多油，土豆、茄子分别过油或煎至表面微黄盛出。余油爆香蒜，下青椒略炒，倒回土豆、茄子，淋淀粉水大火翻炒均匀即可。' }
    ] },
  { id: 'a-soup-4', name: '番茄蛋花汤', type: 'adult', dish_type: 'soup', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 8,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    ingredients: [
      { name: '番茄', baseAmount: 150, unit: 'g', category: '蔬菜' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类' },
      { name: '葱', baseAmount: 10, unit: 'g', category: '蔬菜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '香油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '番茄切小块，鸡蛋打散，葱切花。' },
      { action: 'cook', text: '锅中少油炒番茄至出汁，加适量清水烧开，淋入蛋液搅成蛋花，加盐、香油，撒葱花即可。' }
    ] },
  { id: 'a-soup-5', name: '紫菜蛋花汤', type: 'adult', dish_type: 'soup', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    ingredients: [
      { name: '紫菜', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类' },
      { name: '葱', baseAmount: 10, unit: 'g', category: '蔬菜' },
      { name: '虾皮', baseAmount: 5, unit: 'g', category: '其他' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '香油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '紫菜撕小片，鸡蛋打散，葱切花。' },
      { action: 'cook', text: '锅中加水烧开，下紫菜、虾皮煮 1 分钟，淋入蛋液搅成蛋花，加盐、香油，撒葱花即可。' }
    ] },
  /* ========== 智能家庭餐桌管家 - 2荤2素1汤 黄金菜谱（5组） ========== */
  { id: 'm001', name: '番茄炒蛋', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    flavor_profile: 'sweet_sour',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '番茄', baseAmount: 2, unit: '个', category: '蔬菜', sub_type: '中等大小' },
      { name: '鸡蛋', baseAmount: 3, unit: '个', category: '蛋类', sub_type: '土鸡蛋' },
      { name: '白砂糖', baseAmount: 0, unit: '适量', category: '调料', sub_type: '细砂糖' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '番茄顶部划十字，用开水烫去皮切小块；鸡蛋打入碗中，加少许盐搅打均匀' },
      { action: 'cook', text: '锅中倒油烧热，倒入{{ingredients_info}}蛋液炒至定型盛出；锅中留底油，放入番茄块翻炒出汁，加白砂糖调味，倒入炒好的鸡蛋翻炒均匀，加少许盐调味即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 8, name: '番茄蛋黄泥', action: '只取熟蛋黄压泥，去皮番茄煮软打泥混合' },
        { max_month: 12, name: '番茄碎蛋末', action: '全蛋液炒软切碎，番茄去皮切碎，焖煮至软烂' },
        { max_month: 36, name: '宝宝番茄炒蛋', action: '大人版少盐少油，番茄切小块，鸡蛋炒成小块' }
      ]
    }
  },
  { id: 'm002', name: '青椒炒肉丝', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '猪肉', baseAmount: 200, unit: 'g', category: '肉类', sub_type: '里脊' },
      { name: '青椒', baseAmount: 2, unit: '个', category: '蔬菜', sub_type: '薄皮青椒' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料', sub_type: '老姜' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '猪肉切丝，加少许生抽、半勺淀粉抓匀腌制10分钟；青椒去蒂去籽切丝；生姜切丝备用' },
      { action: 'cook', text: '锅中倒油烧热，放入姜丝爆香，倒入腌制好的{{ingredients_info}}肉丝滑炒至变色盛出；锅中留底油，放入青椒丝翻炒至变软，倒入肉丝翻炒均匀，加少许盐和生抽调味即可，加少许盐和生抽调味即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 8, name: '里脊猪肉泥', action: '取里脊肉加姜片蒸熟打泥，不加青椒' },
        { max_month: 12, name: '青椒肉末粥', action: '肉丝切成碎末，青椒去皮切碎，加水焖软' }
      ]
    }
  },
  { id: 'v001', name: '清炒上海青', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '上海青', baseAmount: 300, unit: 'g', category: '蔬菜', sub_type: '新鲜嫩苗' },
      { name: '大蒜', baseAmount: 2, unit: '瓣', category: '蔬菜', sub_type: '紫皮蒜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '上海青去根洗净，沥干水分；大蒜拍碎切末备用' },
      { action: 'cook', text: '锅中倒油烧热，放入蒜末爆香，倒入{{ingredients_info}}上海青大火快速翻炒至菜叶变软，加少许盐调味即可' }
    ] },
  { id: 'v002', name: '凉拌黄瓜', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '黄瓜', baseAmount: 2, unit: '根', category: '蔬菜', sub_type: '水果黄瓜' },
      { name: '大蒜', baseAmount: 3, unit: '瓣', category: '蔬菜', sub_type: '紫皮蒜' },
      { name: '香醋', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '黄瓜洗净，用擀面杖拍碎后切小段，放入碗中加少许盐腌制5分钟，沥干水分' },
      { action: 'cook', text: '大蒜切末，放入黄瓜中，加半勺{{ingredients_info}}香醋搅拌均匀即可' }
    ] },
  { id: 's001', name: '紫菜蛋花汤', type: 'adult', dish_type: 'soup', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '紫菜', baseAmount: 5, unit: 'g', category: '干货', sub_type: '免洗紫菜' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类', sub_type: '土鸡蛋' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料', sub_type: '小香葱' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '紫菜撕成小块；鸡蛋打入碗中搅打均匀；葱花切好备用' },
      { action: 'cook', text: '锅中加500ml清水烧开，放入{{ingredients_info}}紫菜煮1分钟，淋入蛋液搅出蛋花，加少许盐调味，撒上葱花即可' }
    ] },
  /* 组合二 */
  { id: 'm003', name: '可乐鸡翅', type: 'adult', taste: 'slow_stew', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'sweet_sour',
    cook_type: 'stew',
    ingredients: [
      { name: '鸡翅中', baseAmount: 300, unit: 'g', category: '肉类', sub_type: '新鲜鸡翅' },
      { name: '可乐', baseAmount: 300, unit: 'ml', category: '其他' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡翅中洗净，表面划两刀，冷水下锅加姜片、料酒焯水，撇去浮沫后捞出沥干' },
      { action: 'cook', text: '锅中倒油烧热，放入沥干的{{ingredients_info}}鸡翅煎至两面微黄，倒入可乐和生抽，大火烧开后转小火慢炖15分钟，大火收汁至浓稠即可' }
    ] },
  { id: 'm004', name: '清蒸鲈鱼', type: 'adult', taste: 'steamed_salad', meat: 'fish',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'steam',
    ingredients: [
      { name: '鲈鱼', baseAmount: 500, unit: 'g', category: '肉类', sub_type: '鲜活鲈鱼' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱', baseAmount: 2, unit: '根', category: '蔬菜', sub_type: '大葱' },
      { name: '蒸鱼豉油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲈鱼处理干净，鱼身划斜刀，用厨房纸吸干水分；生姜一半切片一半切丝，葱一半切段一半切葱花' },
      { action: 'cook', text: '鱼盘铺姜片和葱段，放上{{ingredients_info}}鲈鱼，水开后上锅大火蒸10分钟，关火焖2分钟；取出鱼盘，倒掉多余汤汁，铺姜丝和葱花，淋上蒸鱼豉油，烧热食用油浇在葱花上激出香味即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 8, name: '清蒸鲈鱼泥', action: '取腹部无刺鱼肉，严格挑刺后压成细腻泥状' },
        { max_month: 12, name: '鲈鱼软颗粒', action: '鱼肉切成 0.5cm 小块，配合软米饭' },
        { max_month: 36, name: '清蒸鲈鱼块', action: '同大人版，不淋热油，不加蒸鱼豉油' }
      ]
    }
  },
  { id: 'v003', name: '蒜蓉油麦菜', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '油麦菜', baseAmount: 300, unit: 'g', category: '蔬菜', sub_type: '新鲜嫩株' },
      { name: '大蒜', baseAmount: 4, unit: '瓣', category: '蔬菜', sub_type: '紫皮蒜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '油麦菜去根洗净，切成段；大蒜拍碎切末备用' },
      { action: 'cook', text: '锅中倒油烧热，放入蒜末爆香，倒入{{ingredients_info}}油麦菜大火快速翻炒至菜叶变软，加少许盐调味即可' }
    ] },
  { id: 'v004', name: '清炒山药', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '山药', baseAmount: 200, unit: 'g', category: '蔬菜', sub_type: '铁棍山药' },
      { name: '胡萝卜', baseAmount: 50, unit: 'g', category: '蔬菜', sub_type: '新鲜胡萝卜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '山药去皮切薄片，放入清水中浸泡防氧化；胡萝卜去皮切薄片；葱花切好备用' },
      { action: 'cook', text: '锅中倒油烧热，放入葱花爆香，倒入{{ingredients_info}}山药片和胡萝卜片翻炒至变软，加少许盐调味，加半勺清水焖煮1分钟即可' }
    ] },
  { id: 's002', name: '冬瓜海带排骨汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'stew',
    ingredients: [
      { name: '排骨', baseAmount: 300, unit: 'g', category: '肉类', sub_type: '肋排' },
      { name: '冬瓜', baseAmount: 200, unit: 'g', category: '蔬菜', sub_type: '新鲜冬瓜' },
      { name: '海带', baseAmount: 100, unit: 'g', category: '干货', sub_type: '干海带结' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨冷水下锅加姜片焯水，撇去浮沫后捞出洗净；海带结用清水泡发洗净；冬瓜去皮去籽切大块' },
      { action: 'cook', text: '锅中加足量清水，放入洗净的{{ingredients_info}}排骨、姜片和海带结，大火烧开后转小火慢炖30分钟，加入冬瓜块继续炖10分钟，加少许盐调味即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 12, name: '冬瓜排骨汤粥', action: '取汤中冬瓜压泥，排骨肉撕碎，用汤煮烂面条或粥' }
      ]
    }
  },
  /* 组合三 */
  { id: 'm005', name: '麻婆豆腐', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'spicy',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '嫩豆腐', baseAmount: 300, unit: 'g', category: '其他', sub_type: '内酯豆腐' },
      { name: '猪肉末', baseAmount: 100, unit: 'g', category: '肉类', sub_type: '五花肉末' },
      { name: '郫县豆瓣酱', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '花椒粉', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '嫩豆腐切小块，放入淡盐水中浸泡5分钟；生姜切末备用；淀粉加2勺清水调成水淀粉' },
      { action: 'cook', text: '锅中倒油烧热，放入姜末爆香，倒入{{ingredients_info}}猪肉末炒至变色，加入郫县豆瓣酱炒出红油，加半碗清水烧开，放入豆腐块轻轻推动，加生抽调味，淋入水淀粉勾芡，撒上花椒粉即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 8, name: '原味肉末豆腐泥', action: '取未加辣前的豆腐和肉末，压成糊状' },
        { max_month: 12, name: '肉末豆腐碎', action: '肉末切极碎，豆腐切小方块，清水炖软' }
      ]
    }
  },
  { id: 'm006', name: '宫保鸡丁', type: 'adult', taste: 'quick_stir_fry', meat: 'chicken',
    prep_time: 20,
    is_baby_friendly: true,
    common_allergens: ['花生'],
    can_share_base: true,
    flavor_profile: 'spicy',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '鸡肉', baseAmount: 250, unit: 'g', category: '肉类', sub_type: '鸡腿肉' },
      { name: '花生米', baseAmount: 50, unit: 'g', category: '其他', sub_type: '熟花生米' },
      { name: '干辣椒', baseAmount: 5, unit: '个', category: '调料', sub_type: '小米辣' },
      { name: '黄瓜', baseAmount: 1, unit: '根', category: '蔬菜', sub_type: '水果黄瓜' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '白砂糖', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡肉切丁，加少许生抽、淀粉抓匀腌制15分钟；黄瓜切丁；干辣椒剪段去籽备用；用生抽、白砂糖、醋、淀粉调一碗宫保汁' },
      { action: 'cook', text: '锅中倒油烧热，放入干辣椒段爆香，倒入腌制好的{{ingredients_info}}鸡丁滑炒至变色，放入黄瓜丁翻炒1分钟，淋入宫保汁翻炒至浓稠，撒上花生米即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 12, name: '黄瓜鸡肉末', action: '取未加辣前的鸡丁和黄瓜丁，去皮切碎，焖煮至软' }
      ]
    }
  },
  { id: 'v005', name: '白灼西兰花', type: 'adult', taste: 'steamed_salad', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'steam',
    ingredients: [
      { name: '西兰花', baseAmount: 300, unit: 'g', category: '蔬菜', sub_type: '新鲜西兰花' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '西兰花切小朵，用清水浸泡10分钟，洗净沥干水分' },
      { action: 'cook', text: '锅中加清水烧开，加少许盐和半勺{{ingredients_info}}食用油，放入西兰花焯烫2分钟，捞出沥干水分装盘即可' }
    ] },
  { id: 'v006', name: '番茄烧茄子', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'sweet_sour',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '长茄子', baseAmount: 2, unit: '根', category: '蔬菜', sub_type: '新鲜长茄' },
      { name: '番茄', baseAmount: 1, unit: '个', category: '蔬菜', sub_type: '中等大小' },
      { name: '大蒜', baseAmount: 2, unit: '瓣', category: '蔬菜', sub_type: '紫皮蒜' },
      { name: '白砂糖', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '茄子切滚刀块，用清水浸泡5分钟；番茄去皮切小块；大蒜拍碎切末备用' },
      { action: 'cook', text: '锅中倒油烧热，放入蒜末爆香，倒入{{ingredients_info}}茄子块翻炒至变软，放入番茄块翻炒出汁，加白砂糖和少许盐调味，加半勺清水焖煮3分钟即可' }
    ] },
  { id: 's003', name: '丝瓜蛋花汤', type: 'adult', dish_type: 'soup', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '丝瓜', baseAmount: 1, unit: '根', category: '蔬菜', sub_type: '新鲜丝瓜' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类', sub_type: '土鸡蛋' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '丝瓜去皮切滚刀块；鸡蛋打入碗中搅打均匀；葱花切好备用' },
      { action: 'cook', text: '锅中加500ml清水烧开，放入{{ingredients_info}}丝瓜块煮3分钟，淋入蛋液搅出蛋花，加少许盐调味，撒上葱花即可' }
    ] },
  /* 组合四 */
  { id: 'm007', name: '白切鸡', type: 'adult', taste: 'steamed_salad', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'steam',
    ingredients: [
      { name: '三黄鸡', baseAmount: 0.5, unit: '只', category: '肉类', sub_type: '新鲜三黄鸡' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱', baseAmount: 2, unit: '根', category: '蔬菜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '沙姜', baseAmount: 20, unit: 'g', category: '蔬菜', sub_type: '新鲜沙姜' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '三黄鸡处理干净，用厨房纸吸干水分；生姜一半切片一半切丝，葱一半切段一半切葱花；沙姜切末备用' },
      { action: 'cook', text: '锅中加足量清水，放入姜片、葱段和少许盐，大火烧开，放入{{ingredients_info}}三黄鸡，转小火煮15分钟，关火焖10分钟，捞出放入冰水中浸泡5分钟，斩块装盘；沙姜末、葱花加生抽调成蘸料即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 12, name: '原味鸡腿泥/末', action: '取鸡腿肉，去皮去骨，按月龄打泥或切碎' }
      ]
    }
  },
  { id: 'm008', name: '蚝油牛肉', type: 'adult', taste: 'quick_stir_fry', meat: 'beef',
    prep_time: 20,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '牛肉', baseAmount: 200, unit: 'g', category: '肉类', sub_type: '牛里脊' },
      { name: '青椒', baseAmount: 1, unit: '个', category: '蔬菜', sub_type: '甜椒' },
      { name: '洋葱', baseAmount: 50, unit: 'g', category: '蔬菜', sub_type: '黄洋葱' },
      { name: '蚝油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '淀粉', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛肉逆纹切薄片，加蚝油、淀粉、少许清水抓匀腌制15分钟；青椒、洋葱切薄片；生姜切丝备用' },
      { action: 'cook', text: '锅中倒油烧热，放入姜丝爆香，倒入腌制好的{{ingredients_info}}牛肉滑炒至变色盛出；锅中留底油，放入青椒片和洋葱片翻炒至变软，倒入牛肉翻炒至肉色完全变白、看不见红血丝即可' }
    ] },
  { id: 'v007', name: '清炒荷兰豆', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '荷兰豆', baseAmount: 250, unit: 'g', category: '蔬菜', sub_type: '新鲜荷兰豆' },
      { name: '大蒜', baseAmount: 2, unit: '瓣', category: '蔬菜', sub_type: '紫皮蒜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '荷兰豆去筋洗净，沥干水分；大蒜拍碎切末备用' },
      { action: 'cook', text: '锅中倒油烧热，放入蒜末爆香，倒入{{ingredients_info}}荷兰豆大火快速翻炒至叶片变软、颜色转翠绿，加少许盐调味即可' }
    ] },
  { id: 'v008', name: '蒸水蛋', type: 'adult', taste: 'steamed_salad', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'steam',
    ingredients: [
      { name: '鸡蛋', baseAmount: 2, unit: '个', category: '蛋类', sub_type: '土鸡蛋' },
      { name: '温水', baseAmount: 400, unit: 'ml', category: '其他', sub_type: '30℃左右' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡蛋打入碗中，加少许盐搅打均匀，慢慢倒入温水，边倒边搅拌，过筛2次去除浮沫' },
      { action: 'cook', text: '碗口蒙上保鲜膜，扎几个小孔，水开后上锅大火蒸7分钟，关火焖1分钟，取出撒上{{ingredients_info}}葱花即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 8, name: '细腻蒸蛋黄', action: '仅用蛋黄兑温水蒸制，过筛保证无气泡' },
        { max_month: 36, name: '全蛋蒸水蛋', action: '全蛋加温水蒸，12个月前不加盐和酱油', same_as_adult_hint: '大人蒸水蛋与宝宝全蛋蒸水蛋可一锅同蒸：蒸好后先分出一小份少盐/无盐给宝宝，再给大人撒葱花和调味。' }
      ]
    }
  },
  { id: 's004', name: '玉米排骨汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'stew',
    ingredients: [
      { name: '排骨', baseAmount: 300, unit: 'g', category: '肉类', sub_type: '肋排' },
      { name: '甜玉米', baseAmount: 1, unit: '根', category: '蔬菜', sub_type: '水果玉米' },
      { name: '胡萝卜', baseAmount: 1, unit: '根', category: '蔬菜', sub_type: '新鲜胡萝卜' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨冷水下锅加姜片焯水，撇去浮沫后捞出洗净；玉米切段；胡萝卜去皮切滚刀块' },
      { action: 'cook', text: '锅中加足量清水，放入洗净的{{ingredients_info}}排骨、姜片，大火烧开后转小火慢炖25分钟，加入玉米段和胡萝卜块继续炖10分钟，加少许盐调味即可' }
    ] },
  /* 组合五 */
  { id: 'm009', name: '土豆炖牛肉', type: 'adult', taste: 'slow_stew', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'stew',
    ingredients: [
      { name: '牛肉', baseAmount: 300, unit: 'g', category: '肉类', sub_type: '牛腩' },
      { name: '土豆', baseAmount: 2, unit: '个', category: '蔬菜', sub_type: '黄心土豆' },
      { name: '胡萝卜', baseAmount: 1, unit: '根', category: '蔬菜', sub_type: '新鲜胡萝卜' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱', baseAmount: 1, unit: '根', category: '蔬菜' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛肉切方块，冷水下锅加姜片、葱段焯水，撇去浮沫后捞出洗净；土豆、胡萝卜去皮切滚刀块，用清水浸泡防氧化' },
      { action: 'cook', text: '锅中倒油烧热，放入姜片爆香，倒入{{ingredients_info}}牛肉块翻炒至表面微黄，加生抽调味，加足量清水没过牛肉，大火烧开后转小火慢炖35分钟，加入土豆块和胡萝卜块继续炖10分钟，至食材软烂即可' }
    ],
    baby_variant: {
      stages: [
        { max_month: 8, name: '牛肉土豆糊', action: '炖烂的牛肉和土豆一起打成极细泥状' },
        { max_month: 12, name: '牛肉土豆软颗粒', action: '牛肉横纹切极碎，土豆压碎，保持一定颗粒感锻炼嚼劲' }
      ]
    }
  },
  { id: 'm010', name: '葱爆羊肉', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'salty_umami',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '羊肉片', baseAmount: 250, unit: 'g', category: '肉类', sub_type: '羔羊腿肉片' },
      { name: '大葱', baseAmount: 1, unit: '根', category: '蔬菜', sub_type: '章丘大葱' },
      { name: '生姜', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '羊肉片用清水浸泡5分钟，沥干水分；大葱斜切马蹄段；生姜切丝备用' },
      { action: 'cook', text: '锅中倒油烧热，放入姜丝爆香，倒入{{ingredients_info}}羊肉片快速滑炒至变色，烹入料酒，加入大葱段大火翻炒至叶片变软、颜色转翠绿，加生抽调味即可' }
    ] },
  { id: 'v009', name: '酸辣土豆丝', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'sour_fresh',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '土豆', baseAmount: 2, unit: '个', category: '蔬菜', sub_type: '白心土豆' },
      { name: '干辣椒', baseAmount: 3, unit: '个', category: '调料', sub_type: '线椒' },
      { name: '醋', baseAmount: 0, unit: '适量', category: '调料', sub_type: '米醋' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '葱', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '土豆去皮切细丝，放入清水中浸泡5分钟，捞出沥干水分；干辣椒剪段；葱切葱花备用' },
      { action: 'cook', text: '锅中倒油烧热，放入干辣椒段爆香，倒入{{ingredients_info}}土豆丝大火快速翻炒，沿锅边淋入醋，加少许盐调味，炒至丝条变半透明、保持清脆感，撒上葱花即可' }
    ] },
  { id: 'v010', name: '清炒娃娃菜', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 5,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '娃娃菜', baseAmount: 2, unit: '颗', category: '蔬菜', sub_type: '新鲜娃娃菜' },
      { name: '大蒜', baseAmount: 2, unit: '瓣', category: '蔬菜', sub_type: '紫皮蒜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '娃娃菜去根洗净，切成段；大蒜拍碎切末备用' },
      { action: 'cook', text: '锅中倒油烧热，放入蒜末爆香，倒入{{ingredients_info}}娃娃菜大火快速翻炒至菜叶变软，加少许盐调味即可' }
    ] },
  { id: 's005', name: '番茄金针菇蛋花汤', type: 'adult', dish_type: 'soup', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 8,
    is_baby_friendly: true,
    common_allergens: ['蛋'],
    can_share_base: true,
    flavor_profile: 'sweet_sour',
    cook_type: 'stir_fry',
    ingredients: [
      { name: '番茄', baseAmount: 1, unit: '个', category: '蔬菜', sub_type: '中等大小' },
      { name: '金针菇', baseAmount: 100, unit: 'g', category: '蔬菜', sub_type: '新鲜金针菇' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类', sub_type: '土鸡蛋' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '番茄去皮切小块；金针菇去根洗净，撕成小朵；鸡蛋打入碗中搅打均匀；葱花切好备用' },
      { action: 'cook', text: '锅中加500ml清水烧开，放入{{ingredients_info}}番茄块和金针菇煮3分钟，淋入蛋液搅出蛋花，加少许盐调味，撒上葱花即可' }
    ] },

  // ============ 新增：牛肉 + 精选蒸拌（2 道） ============
  { id: 'a-beef-6', name: '苹果白切牛腱', type: 'adult', taste: 'steamed_salad', meat: 'beef',
    prep_time: 20,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    flavor_profile: 'light',
    cook_type: 'stew',
    ingredients: [
      { name: '牛腱子', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'beef_shank' },
      { name: '苹果', baseAmount: 1, unit: '个', category: '蔬菜' },
      { name: '姜片', baseAmount: 30, unit: 'g', category: '调料' },
      { name: '葱段', baseAmount: 20, unit: 'g', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '八角', baseAmount: 2, unit: '个', category: '调料' },
      { name: '桂皮', baseAmount: 1, unit: '小块', category: '调料' },
      { name: '蒜蓉酱油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '牛腱子冷水浸泡 30 分钟去血水，苹果去皮切大块备用。准备姜片、葱段、八角、桂皮。' },
      { action: 'cook', text: '牛腱子冷水入锅焯水去浮沫，捞出洗净。另起锅加足量水，放入牛腱子、苹果、姜片、葱段、八角、桂皮、料酒，大火烧开转小火炖 1.5 小时至筷子能轻松插入。关火浸泡 30 分钟后捞出放凉，逆纹切薄片，蘸蒜蓉酱油食用。' }
    ] },
  { id: 'a-beef-7', name: '凉拌柠檬牛腱子', type: 'adult', taste: 'steamed_salad', meat: 'beef',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    flavor_profile: 'sour_fresh',
    cook_type: 'cold_dress',
    ingredients: [
      { name: '熟牛腱子', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'beef_shank' },
      { name: '柠檬', baseAmount: 1, unit: '个', category: '蔬菜' },
      { name: '小米辣', baseAmount: 3, unit: '个', category: '蔬菜' },
      { name: '香菜', baseAmount: 20, unit: 'g', category: '蔬菜' },
      { name: '蒜末', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '香油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '白糖', baseAmount: 0, unit: '少许', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '熟牛腱子逆纹切薄片摆盘。柠檬挤汁备用，小米辣切圈，香菜切段，蒜切末。' },
      { action: 'cook', text: '调汁：柠檬汁 + 生抽 + 蒜末 + 少许白糖 + 香油拌匀。将调好的酱汁淋在牛肉片上，撒上小米辣圈和香菜段，拌匀即可食用。' }
    ] },

  // ============ 新增：鱼 + 暖心炖煮（2 道） ============
  { id: 'a-fish-4', name: '番茄酸汤鱼头', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'fish',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: ['鱼'],
    can_share_base: false,
    flavor_profile: 'sweet_sour',
    cook_type: 'stew',
    ingredients: [
      { name: '鱼头', baseAmount: 1, unit: '个', category: '肉类', sub_type: 'fish_head' },
      { name: '番茄', baseAmount: 2, unit: '个', category: '蔬菜' },
      { name: '酸汤料', baseAmount: 50, unit: 'g', category: '调料' },
      { name: '金针菇', baseAmount: 100, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 20, unit: 'g', category: '调料' },
      { name: '葱段', baseAmount: 15, unit: 'g', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '香菜', baseAmount: 10, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '鱼头对半劈开洗净，抹少许盐和料酒腌制 10 分钟。番茄切块，金针菇去根洗净，香菜切段备用。' },
      { action: 'cook', text: '锅中少许油，放入鱼头煎至两面微黄，加入姜片、葱段爆香。倒入番茄块炒出汁，加入酸汤料和足量开水，大火烧开转中火炖 15 分钟。加入金针菇煮 3 分钟，调味后撒香菜出锅。' }
    ] },
  { id: 'a-fish-5', name: '菌菇豆腐炖鲈鱼', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'fish',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stew',
    ingredients: [
      { name: '鲈鱼', baseAmount: 1, unit: '条', category: '肉类', sub_type: 'fish_seabass' },
      { name: '嫩豆腐', baseAmount: 200, unit: 'g', category: '其他' },
      { name: '金针菇', baseAmount: 100, unit: 'g', category: '蔬菜' },
      { name: '香菇', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '姜丝', baseAmount: 15, unit: 'g', category: '调料' },
      { name: '葱段', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲈鱼去鳞去内脏洗净，鱼身划几刀便于入味，抹少许盐和料酒腌制 10 分钟。嫩豆腐切块，金针菇去根，香菇切片。' },
      { action: 'cook', text: '锅中少许油，放入鲈鱼煎至两面微黄，加入姜丝、葱段爆香，倒入足量开水大火烧开转中火炖 10 分钟至汤色奶白。加入豆腐、金针菇、香菇再炖 5 分钟，加盐调味即可。' }
    ] },

  // ============ 新增：虾 + 暖心炖煮（2 道） ============
  { id: 'a-shrimp-4', name: '椰香虾仁豆腐煲', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'shrimp',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: false,
    flavor_profile: 'light',
    cook_type: 'stew',
    ingredients: [
      { name: '鲜虾', baseAmount: 250, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '嫩豆腐', baseAmount: 200, unit: 'g', category: '其他' },
      { name: '椰浆', baseAmount: 200, unit: 'ml', category: '调料' },
      { name: '胡萝卜', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '玉米粒', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲜虾去头去壳去虾线，嫩豆腐切小块，胡萝卜切小丁。' },
      { action: 'cook', text: '锅中少许油，放入姜片爆香，加入胡萝卜丁和玉米粒翻炒 1 分钟。倒入椰浆和 200ml 清水，大火烧开后放入豆腐块，中火煮 5 分钟。加入虾仁煮至变色，加盐调味即可。' }
    ] },
  { id: 'a-shrimp-5', name: '番茄金针菇虾仁汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: true,
    flavor_profile: 'sweet_sour',
    cook_type: 'stew',
    ingredients: [
      { name: '鲜虾', baseAmount: 200, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '番茄', baseAmount: 2, unit: '个', category: '蔬菜' },
      { name: '金针菇', baseAmount: 100, unit: 'g', category: '蔬菜' },
      { name: '姜片', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '葱花', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲜虾去头去壳去虾线，番茄去皮切块，金针菇去根洗净。' },
      { action: 'cook', text: '锅中少许油，放入姜片爆香，加入番茄块炒出汁，倒入 500ml 清水大火烧开。加入金针菇煮 2 分钟，放入虾仁煮至变色（约 2 分钟），加盐调味，撒葱花即可。' }
    ] },

  // ============ 新增：素菜 + 暖心炖煮（2 道） ============
  { id: 'a-veg-11', name: '白菜豆腐粉丝煲', type: 'adult', taste: 'slow_stew', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stew',
    ingredients: [
      { name: '大白菜', baseAmount: 300, unit: 'g', category: '蔬菜' },
      { name: '冻豆腐', baseAmount: 200, unit: 'g', category: '其他' },
      { name: '粉丝', baseAmount: 80, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '大白菜洗净切大块，冻豆腐解冻挤干水分切块，粉丝用温水泡软。' },
      { action: 'cook', text: '砂锅中少许油，放入姜片爆香，加入白菜帮翻炒至软。倒入足量清水烧开，放入冻豆腐中火炖 10 分钟。加入白菜叶和粉丝煮 5 分钟，淋少许生抽，加盐调味即可。' }
    ] },
  { id: 'a-veg-12', name: '山药萝卜菌菇煲', type: 'adult', taste: 'slow_stew', meat: 'vegetable',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    flavor_profile: 'light',
    cook_type: 'stew',
    ingredients: [
      { name: '铁棍山药', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '白萝卜', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '香菇', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '金针菇', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '枸杞', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '山药去皮切滚刀块（戴手套防痒），白萝卜去皮切块，香菇切片，金针菇去根洗净，枸杞泡水备用。' },
      { action: 'cook', text: '砂锅中加入足量清水，放入姜片、白萝卜大火烧开转中火煮 10 分钟。加入山药、香菇继续煮 10 分钟，最后加入金针菇和枸杞煮 3 分钟，加盐调味即可。' }
    ] },

  // ============ 新增：网红滇味 & 泰式凉拌系列（社媒西南/东南亚风味热榜） ============
  { id: 'a-veg-13', name: '火烧树番茄酱拌凉皮', type: 'adult', taste: 'steamed_salad', meat: 'vegetable',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: ['花生'],
    can_share_base: false,
    flavor_profile: 'sour_fresh',
    cook_method: 'cold_dress',
    ingredients: [
      { name: '凉皮', baseAmount: 300, unit: 'g', category: '其他' },
      { name: '树番茄', baseAmount: 2, unit: '个', category: '蔬菜' },
      { name: '小米辣', baseAmount: 3, unit: '个', category: '蔬菜' },
      { name: '蒜末', baseAmount: 15, unit: 'g', category: '调料' },
      { name: '花生碎', baseAmount: 20, unit: 'g', category: '其他' },
      { name: '香菜', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '醋', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '树番茄放炭火或燃气灶上烤至外皮焦黑起泡，剥皮后捣碎成酱。小米辣切圈，蒜切末，香菜切段。凉皮切宽条备用。' },
      { action: 'cook', text: '将树番茄酱、蒜末、小米辣、醋、生抽、少许盐调成酱汁。凉皮摆盘，淋上酱汁，撒花生碎和香菜段拌匀即可。' }
    ] },
  { id: 'a-veg-14', name: '傣味凉拌米线', type: 'adult', taste: 'steamed_salad', meat: 'vegetable',
    prep_time: 10,
    is_baby_friendly: false,
    common_allergens: ['花生'],
    can_share_base: false,
    flavor_profile: 'sour_fresh',
    cook_method: 'cold_dress',
    ingredients: [
      { name: '米线', baseAmount: 250, unit: 'g', category: '其他' },
      { name: '柠檬', baseAmount: 1, unit: '个', category: '蔬菜' },
      { name: '小米辣', baseAmount: 3, unit: '个', category: '蔬菜' },
      { name: '香菜', baseAmount: 20, unit: 'g', category: '蔬菜' },
      { name: '薄荷叶', baseAmount: 10, unit: 'g', category: '蔬菜' },
      { name: '花生碎', baseAmount: 20, unit: 'g', category: '其他' },
      { name: '鱼露', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '白糖', baseAmount: 0, unit: '少许', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '米线煮熟过凉水沥干。柠檬挤汁，小米辣切圈，香菜切段，薄荷叶洗净备用。' },
      { action: 'cook', text: '调汁：柠檬汁 + 鱼露 + 少许白糖 + 盐拌匀。米线摆盘，淋上调好的酱汁，撒小米辣、花生碎、香菜段和薄荷叶，拌匀即可。' }
    ] },
  { id: 'a-chi-5', name: '傣味柠檬手撕鸡', type: 'adult', taste: 'steamed_salad', meat: 'chicken',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    flavor_profile: 'sour_fresh',
    cook_method: 'cold_dress',
    ingredients: [
      { name: '鸡腿', baseAmount: 350, unit: 'g', category: '肉类', sub_type: 'chicken_thigh' },
      { name: '柠檬', baseAmount: 1, unit: '个', category: '蔬菜' },
      { name: '小米辣', baseAmount: 5, unit: '个', category: '蔬菜' },
      { name: '香菜', baseAmount: 20, unit: 'g', category: '蔬菜' },
      { name: '薄荷叶', baseAmount: 10, unit: 'g', category: '蔬菜' },
      { name: '蒜末', baseAmount: 10, unit: 'g', category: '调料' },
      { name: '鱼露', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '白糖', baseAmount: 0, unit: '少许', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鸡腿冷水下锅加姜片煮 18 分钟至熟透，捞出浸冰水冷却后手撕成丝。柠檬挤汁，小米辣切圈，香菜、薄荷切碎。' },
      { action: 'cook', text: '调汁：柠檬汁 + 鱼露 + 蒜末 + 少许白糖 + 盐拌匀。鸡丝摆盘，淋上酱汁，撒小米辣、香菜和薄荷拌匀即可。' }
    ] },
  { id: 'a-shrimp-6', name: '泰式凉拌虾木瓜沙拉', type: 'adult', taste: 'steamed_salad', meat: 'shrimp',
    prep_time: 15,
    is_baby_friendly: false,
    common_allergens: ['虾', '花生'],
    can_share_base: false,
    flavor_profile: 'sour_fresh',
    cook_method: 'cold_dress',
    ingredients: [
      { name: '鲜虾', baseAmount: 200, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '青木瓜', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '小番茄', baseAmount: 80, unit: 'g', category: '蔬菜' },
      { name: '柠檬', baseAmount: 1, unit: '个', category: '蔬菜' },
      { name: '小米辣', baseAmount: 3, unit: '个', category: '蔬菜' },
      { name: '花生碎', baseAmount: 20, unit: 'g', category: '其他' },
      { name: '鱼露', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '白糖', baseAmount: 0, unit: '少许', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '鲜虾去壳去虾线，沸水焯熟捞出过冰水。青木瓜去皮去籽切丝，小番茄对半切，柠檬挤汁，小米辣切碎。' },
      { action: 'cook', text: '调汁：柠檬汁 + 鱼露 + 白糖 + 小米辣拌匀。木瓜丝、小番茄、虾仁放入大碗，淋上酱汁，撒花生碎拌匀即可。' }
    ] },

  // ============ 新增：快手煎炒 & 网红炒饭系列（社媒懒人快手菜热榜） ============
  { id: 'a-chi-6', name: '香煎鸡肉', type: 'adult', taste: 'quick_stir_fry', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡胸肉', baseAmount: 300, unit: 'g', category: '肉类', sub_type: 'chicken_breast' },
      { name: '黑胡椒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '柠檬', baseAmount: 15, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '鸡胸肉用刀背拍松，抹少许盐和黑胡椒腌制 10 分钟。柠檬切角备用。' },
      { action: 'cook', text: '平底锅中火加少许油，放入鸡胸肉煎至两面金黄、内部熟透（每面约 4-5 分钟），取出切片，挤柠檬汁即可。' }
    ] },
  { id: 'a-veg-15', name: '油糟辣椒炒饭', type: 'adult', taste: 'quick_stir_fry', meat: 'vegetable',
    prep_time: 8,
    is_baby_friendly: false,
    common_allergens: ['蛋'],
    can_share_base: false,
    ingredients: [
      { name: '隔夜米饭', baseAmount: 300, unit: 'g', category: '其他' },
      { name: '油糟辣椒', baseAmount: 30, unit: 'g', category: '调料' },
      { name: '鸡蛋', baseAmount: 2, unit: '个', category: '蛋类' },
      { name: '葱花', baseAmount: 15, unit: 'g', category: '蔬菜' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '隔夜米饭提前打散。鸡蛋打散，葱切花。' },
      { action: 'cook', text: '热锅多油，倒入蛋液炒散，加入米饭大火翻炒至粒粒分明。加入油糟辣椒翻炒均匀，加盐调味，撒葱花出锅。' }
    ] },
  { id: 'a-pork-8', name: '泰式打抛炒饭', type: 'adult', taste: 'quick_stir_fry', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: false,
    common_allergens: ['蛋'],
    can_share_base: false,
    flavor_profile: 'spicy',
    ingredients: [
      { name: '隔夜米饭', baseAmount: 300, unit: 'g', category: '其他' },
      { name: '猪肉末', baseAmount: 150, unit: 'g', category: '肉类', sub_type: 'pork_mince' },
      { name: '九层塔', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '小米辣', baseAmount: 3, unit: '个', category: '蔬菜' },
      { name: '蒜末', baseAmount: 15, unit: 'g', category: '调料' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类' },
      { name: '鱼露', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '生抽', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '白糖', baseAmount: 0, unit: '少许', category: '调料' },
      { name: '食用油', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '隔夜米饭打散。小米辣切碎，蒜切末，九层塔洗净摘叶。鸡蛋煎成太阳蛋备用。' },
      { action: 'cook', text: '热锅下油，爆香蒜末、小米辣，下猪肉末炒散至变色。加入米饭大火翻炒，淋鱼露、生抽、少许白糖调味。出锅前撒九层塔叶翻匀，盛盘摆上太阳蛋即可。' }
    ] },

  // ============ 新增：养生滋补汤 - 乌鸡款 ============
  { id: 'a-soup-6', name: '人参黄芪乌鸡汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'chicken',
    prep_time: 20,
    cook_minutes: 120,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '乌鸡', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'black_chicken' },
      { name: '人参', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '黄芪', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '枸杞', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '乌鸡斩块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出洗净。人参、黄芪、红枣洗净，枸杞泡水备用。' },
      { action: 'cook', text: '乌鸡块与人参、黄芪、红枣、姜片一同入炖盅或砂锅，加足量清水。大火烧开转小火慢炖 2 小时，出锅前 10 分钟加入枸杞，加盐调味即可。' }
    ] },
  { id: 'a-soup-7', name: '党参枸杞乌鸡汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'chicken',
    prep_time: 20,
    cook_minutes: 120,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '乌鸡', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'black_chicken' },
      { name: '党参', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '枸杞', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '乌鸡斩块焯水去浮沫后捞出洗净。党参、红枣洗净，枸杞泡水备用。' },
      { action: 'cook', text: '乌鸡块与党参、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 2 小时。出锅前 10 分钟加入枸杞，加盐调味即可。' }
    ] },

  // ============ 新增：养生滋补汤 - 排骨款 ============
  { id: 'a-soup-8', name: '黄芪党参排骨汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    cook_minutes: 90,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '排骨', baseAmount: 400, unit: 'g', category: '肉类', sub_type: 'pork_ribs' },
      { name: '黄芪', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '党参', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨冷水下锅加姜片、料酒焯水，撇净浮沫后捞出洗净。黄芪、党参、红枣洗净备用。' },
      { action: 'cook', text: '排骨与黄芪、党参、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 1.5 小时至排骨软烂，加盐调味即可。' }
    ] },
  { id: 'a-soup-9', name: '灵芝红枣排骨汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 15,
    cook_minutes: 90,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '排骨', baseAmount: 400, unit: 'g', category: '肉类', sub_type: 'pork_ribs' },
      { name: '灵芝', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 25, unit: 'g', category: '干货' },
      { name: '枸杞', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '排骨冷水下锅加姜片、料酒焯水，撇净浮沫后捞出洗净。灵芝切片，红枣洗净，枸杞泡水备用。' },
      { action: 'cook', text: '排骨与灵芝、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 1.5 小时。出锅前 10 分钟加枸杞，加盐调味即可。' }
    ] },

  // ============ 新增：养生滋补汤 - 老母鸡款 ============
  { id: 'a-soup-10', name: '人参桂圆老母鸡汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'chicken',
    prep_time: 20,
    cook_minutes: 150,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '老母鸡', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'old_hen' },
      { name: '人参', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '桂圆', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '枸杞', baseAmount: 10, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '老母鸡斩块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出洗净。人参、桂圆、红枣洗净，枸杞泡水备用。' },
      { action: 'cook', text: '老母鸡块与人参、桂圆、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 2.5 小时至鸡肉酥烂。出锅前 10 分钟加枸杞，加盐调味即可。' }
    ] },
  { id: 'a-soup-11', name: '灵芝石斛老母鸡汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'chicken',
    prep_time: 20,
    cook_minutes: 150,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '老母鸡', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'old_hen' },
      { name: '灵芝', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '石斛', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '老母鸡斩块焯水去浮沫后捞出洗净。灵芝切片，石斛、红枣洗净备用。' },
      { action: 'cook', text: '老母鸡块与灵芝、石斛、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 2.5 小时至鸡肉酥烂脱骨，加盐调味即可。' }
    ] },

  // ============ 新增：养生滋补汤 - 猪蹄款 ============
  { id: 'a-soup-12', name: '黄芪花生猪蹄汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 20,
    cook_minutes: 120,
    is_baby_friendly: false,
    common_allergens: ['花生'],
    can_share_base: false,
    ingredients: [
      { name: '猪蹄', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'pig_trotter' },
      { name: '黄芪', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '花生', baseAmount: 50, unit: 'g', category: '其他' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '猪蹄剁小块，冷水下锅加姜片、料酒焯水，撇净浮沫后捞出洗净。花生提前浸泡 1 小时，黄芪、红枣洗净备用。' },
      { action: 'cook', text: '猪蹄与黄芪、花生、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 2 小时至猪蹄软烂脱骨、汤色奶白，加盐调味即可。' }
    ] },
  { id: 'a-soup-13', name: '党参山药猪蹄汤', type: 'adult', dish_type: 'soup', taste: 'slow_stew', meat: 'pork',
    prep_time: 20,
    cook_minutes: 120,
    is_baby_friendly: false,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '猪蹄', baseAmount: 500, unit: 'g', category: '肉类', sub_type: 'pig_trotter' },
      { name: '党参', baseAmount: 15, unit: 'g', category: '干货' },
      { name: '铁棍山药', baseAmount: 200, unit: 'g', category: '蔬菜' },
      { name: '红枣', baseAmount: 20, unit: 'g', category: '干货' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '料酒', baseAmount: 0, unit: '适量', category: '调料' },
      { name: '盐', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '猪蹄剁小块焯水去浮沫后捞出洗净。党参、红枣洗净，山药去皮切滚刀块（戴手套防痒），泡水防氧化。' },
      { action: 'cook', text: '猪蹄与党参、红枣、姜片入砂锅，加足量清水大火烧开转小火慢炖 1.5 小时。加入山药块继续炖 30 分钟至猪蹄软烂、山药粉糯，加盐调味即可。' }
    ] },
  {
    "id": "a-veg-16",
    "name": "酸辣炒笋",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "spicy",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "鲜笋",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "干辣椒",
        "baseAmount": 5,
        "unit": "个",
        "category": "调料"
      },
      {
        "name": "小米辣",
        "baseAmount": 3,
        "unit": "个",
        "category": "调料"
      },
      {
        "name": "蒜",
        "baseAmount": 15,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "香醋",
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
        "name": "白糖",
        "baseAmount": 3,
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
        "name": "食用油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鲜笋去壳切滚刀块，入沸水焯 2 分钟去涩味，捞出沥干。干辣椒剪段去籽，小米辣斜切，蒜切末。"
      },
      {
        "action": "cook",
        "text": "热锅宽油，中火煸干辣椒段和小米辣至微焦出香，下蒜末爆香，倒入笋块大火翻炒 2 分钟至边缘微焦。"
      },
      {
        "action": "cook",
        "text": "沿锅边淋入香醋，加生抽、白糖、盐翻炒均匀，大火收汁至笋块裹汁发亮即可出锅。"
      }
    ],
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/stir_fried_spicy_sour_bamboo_shoots.png"
  },
  {
    "id": "a-veg-17",
    "name": "柠檬酱油手撕生菜",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sour_fresh",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "生菜",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
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
        "name": "蒜末",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "香油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "生菜洗净沥干，用手撕成小片；柠檬切半挤汁；蒜切末"
      },
      {
        "action": "cook",
        "text": "碗中混合柠檬汁、生抽、蒜末、香油调成酱汁，淋在生菜上即可"
      }
    ],
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/lemon_soy_lettuce.png"
  },
  {
    "id": "a-shrimp-7",
    "name": "柠檬椒盐虾",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "shrimp",
    "prep_time": 15,
    "is_baby_friendly": false,
    "common_allergens": [
      "虾"
    ],
    "can_share_base": false,
    "flavor_profile": "sour_fresh",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      {
        "name": "基围虾",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "shrimp"
      },
      {
        "name": "柠檬",
        "baseAmount": 1,
        "unit": "个",
        "category": "其他"
      },
      {
        "name": "椒盐粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "植物油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "虾去头去壳留尾，背部划开去虾线；柠檬切片；葱切碎"
      },
      {
        "action": "cook",
        "text": "锅中油热，放入虾快速翻炒，虾变色后撒入椒盐粉，最后淋上柠檬汁，撒葱花即可"
      }
    ],
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/lemon_pepper_salt_shrimp.png"
  },
  {
    "id": "a-soup-14",
    "name": "酸萝卜老鸭汤",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 20,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "sour_fresh",
    "cook_type": "stew",
    "cook_minutes": 90,
    "ingredients": [
      {
        "name": "老鸭",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "duck"
      },
      {
        "name": "酸萝卜",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜片",
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
        "text": "老鸭斩块焯水；酸萝卜切块；姜切片"
      },
      {
        "action": "cook",
        "text": "锅中加水和老鸭，大火煮沸后转小火，加入姜片炖1小时，加入酸萝卜继续炖30分钟，最后调味即可"
      }
    ],
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/sour_radish_duck_soup.png"
  },
  {
    "id": "a-veg-18",
    "name": "蒜蓉炒菜心",
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
        "name": "蒜末",
        "baseAmount": 15,
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
        "name": "生抽",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "食用油",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "菜心洗净，切段。蒜剁成末"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，放入蒜末爆香，加入菜心翻炒，淋入生抽，适量盐调味，大火快炒至菜心变软即可"
      }
    ],
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/stir_fried_choy_sum_with_garlic.png"
  },
  {
    "id": "a-veg-19",
    "name": "醋溜土豆丝",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 15,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "sour_fresh",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      { "name": "土豆", "baseAmount": 300, "unit": "g", "category": "蔬菜" },
      { "name": "青椒", "baseAmount": 30, "unit": "g", "category": "蔬菜" },
      { "name": "醋", "baseAmount": 15, "unit": "ml", "category": "调料" },
      { "name": "盐", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "土豆去皮切细丝，泡水去淀粉后沥干。青椒切丝。" },
      { "action": "cook", "text": "热锅少油，中大火下土豆丝、青椒丝快炒，淋醋与盐翻炒均匀至断生即可。" }
    ]
  },
  {
    "id": "a-veg-20",
    "name": "香煎南瓜",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 12,
    "ingredients": [
      { "name": "南瓜", "baseAmount": 400, "unit": "g", "category": "蔬菜" },
      { "name": "盐", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "南瓜去籽去皮，切约 1cm 厚片。" },
      { "action": "cook", "text": "平底锅少油，中小火将南瓜片煎至两面微黄、用筷子能轻松穿透即可，撒盐调味。" }
    ]
  },
  {
    "id": "a-veg-21",
    "name": "蒜蓉烤口蘑",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "salty_umami",
    "cook_type": "steam",
    "cook_minutes": 15,
    "ingredients": [
      { "name": "口蘑", "baseAmount": 250, "unit": "g", "category": "蔬菜" },
      { "name": "蒜", "baseAmount": 20, "unit": "g", "category": "蔬菜" },
      { "name": "生抽", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "口蘑去蒂洗净，蒜切末。口蘑凹面朝上摆盘。" },
      { "action": "cook", "text": "蒜末与生抽、少许油拌匀，填入口蘑凹面，上锅蒸或烤箱 180℃ 烤约 15 分钟至熟即可。" }
    ]
  },
  {
    "id": "a-veg-22",
    "name": "家常豆腐",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 10,
    "ingredients": [
      { "name": "北豆腐", "baseAmount": 300, "unit": "g", "category": "蔬菜" },
      { "name": "木耳", "baseAmount": 30, "unit": "g", "category": "干货" },
      { "name": "青椒", "baseAmount": 50, "unit": "g", "category": "蔬菜" },
      { "name": "生抽", "baseAmount": 10, "unit": "ml", "category": "调料" },
      { "name": "盐", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "豆腐切厚片，木耳泡发撕小朵，青椒切块。" },
      { "action": "cook", "text": "豆腐煎至两面微黄盛出。锅留底油爆香，下木耳、青椒翻炒，加豆腐、生抽和盐炒匀即可。" }
    ]
  },
  {
    "id": "a-veg-23",
    "name": "韭菜炒蛋",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": ["蛋"],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      { "name": "鸡蛋", "baseAmount": 2, "unit": "个", "category": "蛋类" },
      { "name": "韭菜", "baseAmount": 150, "unit": "g", "category": "蔬菜" },
      { "name": "盐", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "韭菜洗净切段，鸡蛋打散加少许盐。" },
      { "action": "cook", "text": "热锅少油，先炒蛋至凝固盛出。再下韭菜快炒，倒入鸡蛋、盐翻炒均匀即可。" }
    ]
  },
  {
    "id": "a-veg-24",
    "name": "苦瓜煎蛋",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": ["蛋"],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      { "name": "鸡蛋", "baseAmount": 2, "unit": "个", "category": "蛋类" },
      { "name": "苦瓜", "baseAmount": 200, "unit": "g", "category": "蔬菜" },
      { "name": "盐", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "苦瓜去瓤切薄片，用盐略腌后挤水。鸡蛋打散。" },
      { "action": "cook", "text": "苦瓜与蛋液混合。热锅少油，倒入蛋液摊成饼状，两面煎至金黄即可。" }
    ]
  },
  {
    "id": "a-veg-25",
    "name": "凉拌木耳",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 15,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "sour_fresh",
    "cook_type": "cold_dress",
    "cook_minutes": 0,
    "ingredients": [
      { "name": "木耳", "baseAmount": 30, "unit": "g", "category": "干货" },
      { "name": "蒜", "baseAmount": 15, "unit": "g", "category": "蔬菜" },
      { "name": "醋", "baseAmount": 15, "unit": "ml", "category": "调料" },
      { "name": "生抽", "baseAmount": 10, "unit": "ml", "category": "调料" },
      { "name": "香油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "木耳泡发洗净，入沸水焯 2 分钟捞出过凉，撕小朵。蒜切末。" },
      { "action": "cook", "text": "木耳加蒜末、醋、生抽、香油拌匀即可。" }
    ]
  },
  {
    "id": "a-veg-26",
    "name": "凉拌腐竹",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 20,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "sour_fresh",
    "cook_type": "cold_dress",
    "cook_minutes": 0,
    "ingredients": [
      { "name": "腐竹", "baseAmount": 80, "unit": "g", "category": "干货" },
      { "name": "黄瓜", "baseAmount": 80, "unit": "g", "category": "蔬菜" },
      { "name": "蒜", "baseAmount": 10, "unit": "g", "category": "蔬菜" },
      { "name": "醋", "baseAmount": 10, "unit": "ml", "category": "调料" },
      { "name": "生抽", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "香油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "腐竹温水泡软切段，沸水焯 1 分钟捞出沥干。黄瓜拍扁切块，蒜切末。" },
      { "action": "cook", "text": "腐竹、黄瓜、蒜末加醋、生抽、香油拌匀即可。" }
    ]
  },
  {
    "id": "a-veg-27",
    "name": "老醋花生",
    "type": "adult",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "sour_fresh",
    "cook_type": "cold_dress",
    "cook_minutes": 0,
    "ingredients": [
      { "name": "花生米", "baseAmount": 150, "unit": "g", "category": "干货" },
      { "name": "醋", "baseAmount": 20, "unit": "ml", "category": "调料" },
      { "name": "生抽", "baseAmount": 5, "unit": "ml", "category": "调料" },
      { "name": "白糖", "baseAmount": 5, "unit": "g", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "花生米可油炸或烤箱烤香，放凉。" },
      { "action": "cook", "text": "醋、生抽、白糖调成汁，淋在花生上拌匀即可。" }
    ]
  },
  {
    "id": "a-veg-28",
    "name": "彩椒炒木耳",
    "type": "adult",
    "taste": "quick_stir_fry",
    "meat": "vegetable",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": false,
    "dish_type": null,
    "flavor_profile": "light",
    "cook_type": "stir_fry",
    "cook_minutes": 8,
    "ingredients": [
      { "name": "彩椒", "baseAmount": 150, "unit": "g", "category": "蔬菜" },
      { "name": "木耳", "baseAmount": 40, "unit": "g", "category": "干货" },
      { "name": "蒜", "baseAmount": 10, "unit": "g", "category": "蔬菜" },
      { "name": "盐", "baseAmount": 0, "unit": "适量", "category": "调料" },
      { "name": "食用油", "baseAmount": 0, "unit": "适量", "category": "调料" }
    ],
    "steps": [
      { "action": "prep", "text": "彩椒去籽切块，木耳泡发洗净撕小朵，蒜切片。" },
      { "action": "cook", "text": "热锅少油，爆香蒜片，下木耳、彩椒大火快炒，加盐调味即可。" }
    ]
  }
];

var babyRecipes = [
  { id: 'b-chi-detail', name: '板栗鲜鸡泥', type: 'baby', taste: 'finger_food', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡里脊', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'chicken_tenderloin' },
      { name: '板栗', baseAmount: 40, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '取新鲜鸡里脊，仔细剔除白色筋膜，切成小丁。' },
      { action: 'cook', text: '板栗去壳去皮，与鸡肉一同冷水入锅蒸 20 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-fish-detail', name: '柠檬清蒸鳕鱼', type: 'baby', taste: 'soft_porridge', meat: 'fish',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: true,
    ingredients: [
      { name: '鳕鱼', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'fish_cod' },
      { name: '柠檬', baseAmount: 10, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '鳕鱼解冻后用手反复揉捏确认无鱼刺，柠檬片覆盖腌制 10 分钟。' },
      { action: 'cook', text: '去柠檬片，水开后入锅蒸 8 分钟，倒掉盘中腥水。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-detail', name: '山药瘦肉末', type: 'baby', taste: 'braised_mash', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '猪里脊', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'pork_tenderloin' },
      { name: '铁棍山药', baseAmount: 60, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '猪里脊切小块，泡入冷水中去血水。铁棍山药去皮切断。' },
      { action: 'cook', text: '肉块和山药一同蒸熟，保留蒸出的少许原汁汤水。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-2', name: '猪肉土豆小软饼', type: 'baby', taste: 'finger_food', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '猪里脊', baseAmount: 30, unit: 'g', category: '肉类', sub_type: 'pork_tenderloin' },
      { name: '土豆', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '胡萝卜', baseAmount: 20, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：猪里脊剁成泥，土豆、胡萝卜蒸熟压成泥。' },
      { action: 'cook', text: '肉泥与土豆泥、胡萝卜泥混合拌匀，捏成小饼状，少油煎或蒸熟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-3', name: '猪肉白菜南瓜烩面', type: 'baby', taste: 'braised_mash', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '五花肉', baseAmount: 30, unit: 'g', category: '肉类', sub_type: 'pork_belly' },
      { name: '白菜', baseAmount: 40, unit: 'g', category: '蔬菜' },
      { name: '南瓜', baseAmount: 40, unit: 'g', category: '蔬菜' },
      { name: '碎碎面', baseAmount: 25, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：五花肉剁末，白菜、南瓜切碎，碎碎面煮熟。' },
      { action: 'cook', text: '肉末与白菜、南瓜同煮软烂，加入碎碎面烩 3 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-4', name: '山药排骨碎碎粥', type: 'baby', taste: 'soft_porridge', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['山药（接触时注意）'],
    can_share_base: true,
    ingredients: [
      { name: '排骨', baseAmount: 40, unit: 'g', category: '肉类', sub_type: 'pork_ribs' },
      { name: '铁棍山药', baseAmount: 40, unit: 'g', category: '蔬菜' },
      { name: '大米', baseAmount: 30, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：排骨蒸熟取肉剁茸，山药去皮切小丁，大米煮成粥底。' },
      { action: 'cook', text: '排骨茸、山药丁加入粥中煮至软烂。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-shrimp-detail', name: '西兰花虾仁滑', type: 'baby', taste: 'soft_porridge', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: true,
    ingredients: [
      { name: '虾仁', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '西兰花', baseAmount: 50, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '虾仁去黑线，西兰花只取顶端花蕾部分焯水。' },
      { action: 'cook', text: '虾仁与西兰花一同蒸 5 分钟至变色。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-beef-detail', name: '番茄牛肉软饭', type: 'baby', taste: 'finger_food', meat: 'beef',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛里脊', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'beef_tenderloin' },
      { name: '番茄', baseAmount: 60, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '牛里脊逆纹路切丁，番茄去皮切碎。' },
      { action: 'cook', text: '牛肉先煮 30 分钟至软，加入番茄碎煮至出汁浓稠。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-beef-2', name: '土豆牛肉泥', type: 'baby', taste: 'braised_mash', meat: 'beef',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛腩', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'beef_brisket' },
      { name: '土豆', baseAmount: 60, unit: 'g', category: '蔬菜' },
      { name: '胡萝卜', baseAmount: 30, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '牛腩切小丁，土豆、胡萝卜去皮切小块。' },
      { action: 'cook', text: '牛腩与土豆、胡萝卜一同冷水入锅蒸 25 分钟至软烂。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-shrimp-2', name: '虾仁豆腐饼', type: 'baby', taste: 'finger_food', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: false,
    ingredients: [
      { name: '虾仁', baseAmount: 80, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '嫩豆腐', baseAmount: 50, unit: 'g', category: '其他' },
      { name: '胡萝卜', baseAmount: 25, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '虾仁剁成泥，嫩豆腐压碎沥水，胡萝卜蒸熟碾成泥。' },
      { action: 'cook', text: '虾泥、豆腐、胡萝卜泥混合拌匀，捏成小饼状。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-shrimp-3', name: '虾仁豆腐蒸蛋', type: 'baby', taste: 'soft_porridge', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾', '蛋'],
    can_share_base: false,
    ingredients: [
      { name: '虾仁', baseAmount: 30, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '嫩豆腐', baseAmount: 40, unit: 'g', category: '其他' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：虾仁剁泥，嫩豆腐压碎，鸡蛋打散加等量温水。' },
      { action: 'cook', text: '豆腐与蛋液混合过筛入碗，铺虾泥，盖保鲜膜扎孔，水开后中火蒸 10 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-fish-2', name: '鱼肉碎碎面', type: 'baby', taste: 'soft_porridge', meat: 'fish',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: true,
    ingredients: [
      { name: '鲈鱼', baseAmount: 50, unit: 'g', category: '肉类', sub_type: 'fish_seabass' },
      { name: '碎碎面', baseAmount: 30, unit: 'g', category: '其他' },
      { name: '青菜', baseAmount: 20, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鲈鱼蒸熟去刺压成茸，碎碎面煮熟，青菜切碎。' },
      { action: 'cook', text: '鱼茸与面、青菜同煮 3 分钟至软烂。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-5', name: '南瓜猪肉烩饭', type: 'baby', taste: 'braised_mash', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '五花肉', baseAmount: 35, unit: 'g', category: '肉类', sub_type: 'pork_belly' },
      { name: '南瓜', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '软饭', baseAmount: 40, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：五花肉剁末，南瓜去皮切小块，软饭备好。' },
      { action: 'cook', text: '肉末与南瓜同煮软烂，加入软饭烩 3 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-6', name: '里脊时蔬软面', type: 'baby', taste: 'soft_porridge', meat: 'pork',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '猪里脊', baseAmount: 35, unit: 'g', category: '肉类', sub_type: 'pork_tenderloin' },
      { name: '碎碎面', baseAmount: 30, unit: 'g', category: '其他' },
      { name: '胡萝卜', baseAmount: 25, unit: 'g', category: '蔬菜' },
      { name: '青菜', baseAmount: 20, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：猪里脊剁末，碎碎面煮熟，胡萝卜、青菜切碎。' },
      { action: 'cook', text: '里脊末与胡萝卜同煮软烂，加入碎碎面、青菜煮 3 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-chi-3', name: '鸡肉土豆泥', type: 'baby', taste: 'braised_mash', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡腿', baseAmount: 50, unit: 'g', category: '肉类', sub_type: 'chicken_thigh' },
      { name: '土豆', baseAmount: 60, unit: 'g', category: '蔬菜' },
      { name: '胡萝卜', baseAmount: 25, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡腿去骨取肉切小丁，土豆、胡萝卜去皮切块。' },
      { action: 'cook', text: '鸡肉与土豆、胡萝卜一同蒸 25 分钟至软烂。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-chi-4', name: '鸡肉西兰花饼', type: 'baby', taste: 'finger_food', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '鸡胸肉', baseAmount: 40, unit: 'g', category: '肉类', sub_type: 'chicken_breast' },
      { name: '西兰花', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '胡萝卜', baseAmount: 20, unit: 'g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡胸剁泥，西兰花、胡萝卜焯熟切碎。' },
      { action: 'cook', text: '鸡肉泥与西兰花、胡萝卜泥混合拌匀，捏成小饼状，少油煎或蒸熟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-beef-3', name: '牛肉山药粥', type: 'baby', taste: 'soft_porridge', meat: 'beef',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: false,
    ingredients: [
      { name: '牛柳', baseAmount: 40, unit: 'g', category: '肉类', sub_type: 'beef_tenderloin' },
      { name: '铁棍山药', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '大米', baseAmount: 35, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：牛柳剁末，山药去皮切小丁，大米煮成粥底。' },
      { action: 'cook', text: '牛肉末与山药丁加入粥中煮至软烂。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-beef-4', name: '土豆牛肉软饭', type: 'baby', taste: 'braised_mash', meat: 'beef',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '牛腩', baseAmount: 45, unit: 'g', category: '肉类', sub_type: 'beef_brisket' },
      { name: '土豆', baseAmount: 55, unit: 'g', category: '蔬菜' },
      { name: '软饭', baseAmount: 40, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：牛腩切小丁，土豆去皮切块，软饭备好。' },
      { action: 'cook', text: '牛腩与土豆一同蒸或炖至软烂，与软饭拌匀。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-fish-3', name: '清蒸鱼肉泥', type: 'baby', taste: 'braised_mash', meat: 'fish',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['鱼'],
    can_share_base: false,
    ingredients: [
      { name: '鲈鱼', baseAmount: 55, unit: 'g', category: '肉类', sub_type: 'fish_seabass' },
      { name: '姜片', baseAmount: 0, unit: '适量', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鲈鱼去刺，姜片去腥。' },
      { action: 'cook', text: '鲈鱼水开后蒸 8 分钟至熟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-shrimp-4', name: '虾仁蒸蛋', type: 'baby', taste: 'soft_porridge', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾', '蛋'],
    can_share_base: false,
    ingredients: [
      { name: '鲜虾', baseAmount: 35, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：虾仁剁泥，鸡蛋打散加等量温水。' },
      { action: 'cook', text: '蛋液过筛入碗，铺虾泥，盖保鲜膜扎孔，水开后中火蒸 10 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },

  // ============ 新增：鸡肉 + 营养粥面（2 道） ============
  { id: 'b-chi-5', name: '南瓜鸡肉碎碎粥', type: 'baby', taste: 'soft_porridge', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: [],
    can_share_base: true,
    ingredients: [
      { name: '鸡胸肉', baseAmount: 40, unit: 'g', category: '肉类', sub_type: 'chicken_breast' },
      { name: '南瓜', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '胚芽米', baseAmount: 30, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡胸肉剁成细末，南瓜去皮切小丁，胚芽米淘洗干净。' },
      { action: 'cook', text: '胚芽米加 5 倍水煮成粥底（约 30 分钟）。加入南瓜丁煮至软烂，再加入鸡肉末煮熟搅散，全程约 10 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-chi-6', name: '番茄鸡肉蝴蝶面', type: 'baby', taste: 'soft_porridge', meat: 'chicken',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['麸质'],
    can_share_base: true,
    ingredients: [
      { name: '鸡胸肉', baseAmount: 40, unit: 'g', category: '肉类', sub_type: 'chicken_breast' },
      { name: '番茄', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '宝宝蝴蝶面', baseAmount: 30, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡胸肉剁成细末，番茄去皮去籽切碎，蝴蝶面掰成小段。' },
      { action: 'cook', text: '锅中少许油，放入番茄碎翻炒出汁，加入少量清水煮开。放入蝴蝶面煮至软烂，加入鸡肉末煮熟搅散，收汁即可。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },

  // ============ 新增：鱼 + 趣味手口料（1 道） ============
  { id: 'b-fish-4', name: '鳕鱼土豆小软饼', type: 'baby', taste: 'finger_food', meat: 'fish',
    prep_time: 15,
    is_baby_friendly: true,
    common_allergens: ['鱼', '蛋'],
    can_share_base: false,
    ingredients: [
      { name: '鳕鱼', baseAmount: 50, unit: 'g', category: '肉类', sub_type: 'fish_cod' },
      { name: '土豆', baseAmount: 60, unit: 'g', category: '蔬菜' },
      { name: '鸡蛋', baseAmount: 1, unit: '个', category: '蛋类' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鳕鱼解冻后仔细挑去鱼刺，蒸熟后压成泥。土豆蒸熟压成泥，鸡蛋只取蛋黄打散。' },
      { action: 'cook', text: '将鳕鱼泥、土豆泥、蛋黄混合拌匀，捏成小饼状。平底锅刷薄油，小火煎至两面金黄即可。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },

  // ============ 新增：虾 + 开胃烩菜（2 道） ============
  { id: 'b-shrimp-5', name: '番茄虾仁烩饭', type: 'baby', taste: 'braised_mash', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: true,
    ingredients: [
      { name: '鲜虾', baseAmount: 40, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '番茄', baseAmount: 50, unit: 'g', category: '蔬菜' },
      { name: '软米饭', baseAmount: 50, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鲜虾去头去壳去虾线，剁成小粒。番茄去皮去籽切碎。' },
      { action: 'cook', text: '锅中少许油，放入番茄碎翻炒出汁，加入少量清水煮开。放入虾仁粒煮至变色，加入软米饭拌匀，小火烩 3 分钟至入味。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-shrimp-6', name: '西兰花虾仁豆腐烩面', type: 'baby', taste: 'braised_mash', meat: 'shrimp',
    prep_time: 10,
    is_baby_friendly: true,
    common_allergens: ['虾'],
    can_share_base: true,
    ingredients: [
      { name: '鲜虾', baseAmount: 30, unit: 'g', category: '肉类', sub_type: 'shrimp' },
      { name: '西兰花', baseAmount: 30, unit: 'g', category: '蔬菜' },
      { name: '嫩豆腐', baseAmount: 30, unit: 'g', category: '其他' },
      { name: '碎碎面', baseAmount: 25, unit: 'g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鲜虾去壳去虾线剁成小粒，西兰花只取花蕾部分焯水切碎，嫩豆腐切小丁，碎碎面煮软。' },
      { action: 'cook', text: '锅中加少量清水烧开，放入虾仁粒、西兰花碎、豆腐丁煮 3 分钟。加入煮好的碎碎面烩 2 分钟至入味。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] }
];

/** 引入步骤标准化模块 */
var recipeSchema = require('./recipeSchema.js');
var STEP_TYPES = recipeSchema.STEP_TYPES;
var STEP_DEFAULT_DURATION = recipeSchema.STEP_DEFAULT_DURATION;

/**
 * 标准化单个步骤，补全 step_type 和 duration_num
 * - prep -> step_type: 'prep'
 * - cook/process/seasoning -> step_type: 'cook'
 */
function normalizeStep(step) {
  if (!step) return step;
  // 确定 step_type
  if (step.step_type == null) {
    step.step_type = step.action === 'prep' ? STEP_TYPES.PREP : STEP_TYPES.COOK;
  }
  // 确定 duration_num（优先读取 duration_minutes，否则使用默认值）
  if (typeof step.duration_num !== 'number') {
    if (typeof step.duration_minutes === 'number') {
      step.duration_num = step.duration_minutes;
    } else {
      step.duration_num = STEP_DEFAULT_DURATION[step.step_type] || 5;
    }
  }
  return step;
}

/** 标准化菜谱的所有步骤 */
function normalizeRecipeSteps(recipe) {
  if (!recipe || !Array.isArray(recipe.steps)) return;
  recipe.steps.forEach(normalizeStep);
}

adultRecipes.forEach(function (r) {
  if (r.flavor_profile == null) r.flavor_profile = defaultFlavorProfile(r);
  if (r.cook_type == null) r.cook_type = defaultCookType(r);
  if (r.recommend_reason == null) r.recommend_reason = defaultRecommendReason(r);
  if (r.cook_minutes == null) r.cook_minutes = defaultCookMinutes(r);
  // ============ 统筹算法支持字段 ============
  if (r.base_serving == null) r.base_serving = defaultBaseServing();
  if (r.cook_method == null) r.cook_method = defaultCookMethod(r);
  if (r.tags == null) r.tags = defaultTags(r);
  if (r.main_ingredients == null) r.main_ingredients = defaultMainIngredients(r);
  if (r.difficulty == null) r.difficulty = defaultDifficulty(r);
  // 标准化步骤
  normalizeRecipeSteps(r);
});

babyRecipes.forEach(function (r) {
  // 标准化宝宝菜谱步骤
  normalizeRecipeSteps(r);
});

/** 经典「2荤2素1汤」模板库：预设套餐，口味与烹饪方式已配好 */
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
      { name: '番茄蛋花汤', role: 'soup', flavor: 'light', cook_type: 'stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' }
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
      { name: '五指毛桃排骨汤', role: 'soup', flavor: 'salty_umami', cook_type: 'stew', meat: 'pork', taste: 'slow_stew' }
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
      { name: '紫菜蛋花汤', role: 'soup', flavor: 'light', cook_type: 'stir_fry', meat: 'vegetable', taste: 'quick_stir_fry' }
    ],
    baby_link_index: 1
  }
];

module.exports = { adultRecipes: adultRecipes, babyRecipes: babyRecipes, templateCombos: templateCombos };
