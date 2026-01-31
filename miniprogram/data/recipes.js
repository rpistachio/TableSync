/**
 * 核心数据库（微信小程序版 - CommonJS）
 * 食材格式：{ name, baseAmount, unit, category [, sub_type ] }，调料类 baseAmount: 0, unit: '适量'
 * 肉类食材必填 sub_type（具体部位），避免同类不同部位被错误合并。
 * 菜谱层级：can_share_base（是否可与配对宝宝餐共用基底、一锅出）。
 *
 * taste 字段与 UI 分类映射：
 * 大人：quick_stir_fry → 快手小炒，slow_stew → 暖心炖煮，steamed_salad → 精选蒸/拌
 * 宝宝：soft_porridge → 营养粥面，finger_food → 趣味手口料，braised_mash → 开胃烩菜
 */
var adultRecipes = [
  { id: 'a-soup-1', name: '花旗参石斛炖鸡汤', type: 'adult', taste: 'slow_stew', meat: 'chicken',
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡腿切大块焯水，洗净浮沫。' },
      { action: 'cook', text: '石斛、花旗参稍微冲洗，与鸡肉、姜片一同入炖盅。' },
      { action: 'cook', text: '隔水慢炖 2 小时，出锅前加盐调味。' }
    ] },
  { id: 'a-soup-2', name: '五指毛桃排骨汤', type: 'adult', taste: 'slow_stew', meat: 'pork',
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：排骨冷水下锅加姜片料酒焯水。' },
      { action: 'cook', text: '五指毛桃、红枣、芡实洗净。' },
      { action: 'cook', text: '大火烧开转小火煲 1.5 小时，汤色奶白香浓。' }
    ] },
  { id: 'a-soup-3', name: '鲜淮山炖牛肉汤', type: 'adult', taste: 'slow_stew', meat: 'beef',
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：牛里脊切厚片，鲜淮山切块。' },
      { action: 'cook', text: '牛肉与淮山一同入锅，加入足量温水。' },
      { action: 'cook', text: '小火慢炖至牛肉酥烂，加少许盐即可。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡里脊去筋膜切片。' },
      { action: 'cook', text: '铺上姜片、柠檬片，水开蒸 10 分钟。' },
      { action: 'cook', text: '淋上极简生抽调味汁即可。' }
    ] },
  { id: 'a-chi-2', name: '宫保鸡丁', type: 'adult', taste: 'quick_stir_fry', meat: 'chicken',
    prep_time: 15,
    is_baby_friendly: false,
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鸡肉切丁腌制，备好干辣椒。' },
      { action: 'cook', text: '大火炒香辣椒和花椒，下鸡丁滑散。' },
      { action: 'cook', text: '加入花生米和调味芡汁翻炒均匀。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鳕鱼解冻吸干水分。' },
      { action: 'cook', text: '水开后大火蒸 8 分钟，倒掉多余腥水。' },
      { action: 'cook', text: '放上葱丝，淋入热油和蒸鱼豉油。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：虾去虾线开背，粉丝泡软。' },
      { action: 'cook', text: '铺好粉丝和虾，淋上蒜蓉酱。' },
      { action: 'cook', text: '蒸 5 分钟，最后撒上葱花。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：牛肉切丝腌制，杭椒切段。' },
      { action: 'cook', text: '牛柳快速滑油变色捞出。' },
      { action: 'cook', text: '下杭椒炒至断生，回锅牛柳加黑椒汁快炒。' }
    ] },
  { id: 'a-pork-1', name: '玉米排骨汤', type: 'adult', taste: 'slow_stew', meat: 'pork',
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：排骨焯水，玉米切段。' },
      { action: 'cook', text: '高压锅或炖锅慢煨 1 小时。' },
      { action: 'cook', text: '最后 20 分钟放入玉米，加盐调味。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：牛腩切块冷水下锅焯水，番茄、洋葱切块。' },
      { action: 'cook', text: '牛腩与姜片、料酒入锅，加足量热水炖约 1 小时至软烂。' },
      { action: 'cook', text: '放入番茄、洋葱再炖 20 分钟，加盐调味即可。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：虾仁用料酒、淀粉抓匀腌制，鸡蛋打散，葱切花。' },
      { action: 'cook', text: '热锅少油滑炒虾仁至变色盛出。' },
      { action: 'cook', text: '余油炒蛋至半凝固，倒回虾仁、葱花快炒，加盐调味出锅。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：鲈鱼去鳞去内脏，从背部切连刀片成孔雀开屏状，葱姜切丝。' },
      { action: 'cook', text: '鱼身抹少许盐，摆盘铺姜丝，水开后大火蒸 8 分钟。' },
      { action: 'cook', text: '倒掉蒸汁，淋蒸鱼豉油，撒葱丝，浇热油即可。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：牛腩切块冷水下锅焯水；若同时做宝宝餐，从大人用的牛腩中分出 40g 剁成碎末供宝宝使用。番茄、洋葱切块。' },
      { action: 'cook', text: '牛腩与姜片、料酒入锅，加足量热水炖约 1 小时至软烂。' },
      { action: 'cook', text: '放入番茄、洋葱再炖 20 分钟，加盐调味即可。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：排骨斩小块洗净沥水；若同时做宝宝餐，从中分出约 40g 小排供宝宝粥用。蒜、豆豉剁碎。' },
      { action: 'cook', text: '排骨加蒜蓉、豆豉、生抽、淀粉抓匀，腌 20 分钟。' },
      { action: 'cook', text: '摆盘水开后大火蒸 25 分钟至脱骨即可。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：猪里脊切薄片上浆；若同时做宝宝餐，取里脊最嫩部分 30g 预留给宝宝做肉泥。木耳泡发，胡萝卜切片。' },
      { action: 'cook', text: '热锅少油滑熟里脊片盛出。' },
      { action: 'cook', text: '余油炒香葱姜，下木耳、胡萝卜翻炒，倒回里脊片，淋芡汁加盐调味出锅。' }
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
      { action: 'prep', text: '将 {{ingredients_info}} 处理好：五花肉切薄片，白菜切段，豆腐切块。' },
      { action: 'cook', text: '五花肉煸出油，加姜片、白菜翻炒，加适量水烧开。' },
      { action: 'cook', text: '放入豆腐炖 10 分钟，加盐调味即可。' }
    ] }
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
    ] }
];

module.exports = { adultRecipes: adultRecipes, babyRecipes: babyRecipes };
