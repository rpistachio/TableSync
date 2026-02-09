/**
 * 核心数据库：深度填充版
 * 包含：精细化宝宝处理步骤 + 滋补汤品系列
 */

export const adultRecipes = [
  // --- 滋补汤品系列 (新) ---
  {
    id: 'a-soup-1',
    name: '花旗参石斛炖鸡汤',
    type: 'adult',
    taste: 'soup',
    meat: 'chicken',
    ingredients: [
      { name: '鸡腿', amount: '500g', category: '肉类' },
      { name: '花旗参', amount: '10g', category: '调料' },
      { name: '石斛', amount: '10g', category: '调料' },
      { name: '姜片', amount: '3片', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鸡腿切大块焯水，洗净浮沫。' },
      { action: 'cook', text: '石斛、花旗参稍微冲洗，与鸡肉、姜片一同入炖盅。' },
      { action: 'cook', text: '隔水慢炖 2 小时，出锅前加盐调味。' }
    ]
  },
  {
    id: 'a-soup-2',
    name: '五指毛桃排骨汤',
    type: 'adult',
    taste: 'soup',
    meat: 'pork',
    ingredients: [
      { name: '排骨', amount: '500g', category: '肉类' },
      { name: '五指毛桃', amount: '30g', category: '调料' },
      { name: '红枣', amount: '3颗', category: '其他' },
      { name: '芡实', amount: '15g', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。排骨冷水下锅加姜片料酒焯水。' },
      { action: 'cook', text: '五指毛桃、红枣、芡实洗净。' },
      { action: 'cook', text: '大火烧开转小火煲 1.5 小时，汤色奶白香浓。' }
    ]
  },
  {
    id: 'a-soup-3',
    name: '鲜淮山炖牛肉汤',
    type: 'adult',
    taste: 'soup',
    meat: 'beef',
    ingredients: [
      { name: '牛里脊', amount: '400g', category: '肉类' },
      { name: '鲜淮山', amount: '200g', category: '蔬菜' },
      { name: '姜片', amount: '3片', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。牛里脊切厚片，鲜淮山切块。' },
      { action: 'cook', text: '牛肉与淮山一同入锅，加入足量温水。' },
      { action: 'cook', text: '小火慢炖至牛肉酥烂，加少许盐即可。' }
    ]
  },
  // --- 鸡肉系列 ---
  {
    id: 'a-chi-1',
    name: '清蒸柠檬鸡里脊',
    type: 'adult',
    taste: 'light',
    meat: 'chicken',
    ingredients: [
      { name: '鸡里脊', amount: '300g', category: '肉类' },
      { name: '柠檬', amount: '半个', category: '其他' },
      { name: '姜片', amount: '3片', category: '调料' },
      { name: '生抽', amount: '少许', category: '调料' },
      { name: '盐', amount: '少许', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鸡里脊去筋膜切片，撒少许盐；柠檬切片，姜切成姜片备用。' },
      { action: 'cook', text: '铺上姜片、柠檬片，水开蒸 10 分钟。' },
      { action: 'cook', text: '淋上极简生抽调味汁即可。' }
    ]
  },
  {
    id: 'a-chi-2',
    name: '宫保鸡丁',
    type: 'adult',
    taste: 'spicy',
    meat: 'chicken',
    ingredients: [
      { name: '鸡肉', amount: '400g', category: '肉类' },
      { name: '花生米', amount: '50g', category: '其他' },
      { name: '干辣椒', amount: '5g', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鸡肉切丁腌制，备好干辣椒。' },
      { action: 'cook', text: '大火炒香辣椒和花椒，下鸡丁滑散。' },
      { action: 'cook', text: '加入花生米和调味芡汁翻炒均匀。' }
    ]
  },
  // --- 鱼虾系列 ---
  {
    id: 'a-fish-1',
    name: '清蒸鳕鱼配葱丝',
    type: 'adult',
    taste: 'light',
    meat: 'fish',
    ingredients: [
      { name: '鳕鱼', amount: '2片', category: '肉类' },
      { name: '大葱', amount: '1根', category: '蔬菜' },
      { name: '姜片', amount: '3片', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鳕鱼解冻吸干水分。' },
      { action: 'cook', text: '水开后大火蒸 8 分钟，倒掉多余腥水。' },
      { action: 'cook', text: '放上葱丝，淋入热油和蒸鱼豉油。' }
    ]
  },
  {
    id: 'a-shrimp-1',
    name: '蒜蓉粉丝蒸虾',
    type: 'adult',
    taste: 'light',
    meat: 'shrimp',
    ingredients: [
      { name: '鲜虾', amount: '10只', category: '肉类' },
      { name: '粉丝', amount: '1把', category: '其他' },
      { name: '大蒜', amount: '1头', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。虾去虾线开背，粉丝泡软。' },
      { action: 'cook', text: '铺好粉丝和虾，淋上蒜蓉酱。' },
      { action: 'cook', text: '蒸 5 分钟，最后撒上葱花。' }
    ]
  },
  // --- 牛猪肉系列 ---
  {
    id: 'a-beef-1',
    name: '杭椒牛柳',
    type: 'adult',
    taste: 'spicy',
    meat: 'beef',
    ingredients: [
      { name: '牛肉', amount: '300g', category: '肉类' },
      { name: '杭椒', amount: '100g', category: '蔬菜' },
      { name: '姜片', amount: '3片', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。牛肉切丝腌制，杭椒切段。' },
      { action: 'cook', text: '牛柳快速滑油变色捞出。' },
      { action: 'cook', text: '下杭椒炒至断生，回锅牛柳加黑椒汁快炒。' }
    ]
  },
  {
    id: 'a-pork-1',
    name: '玉米排骨汤',
    type: 'adult',
    taste: 'soup',
    meat: 'pork',
    ingredients: [
      { name: '排骨', amount: '500g', category: '肉类' },
      { name: '甜玉米', amount: '1根', category: '蔬菜' },
      { name: '姜片', amount: '3片', category: '调料' }
    ],
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。排骨焯水，玉米切段。' },
      { action: 'cook', text: '高压锅或炖锅慢煨 1 小时。' },
      { action: 'cook', text: '最后 20 分钟放入玉米，加盐调味。' }
    ]
  }
];

export const babyRecipes = [
  {
    id: 'b-chi-detail',
    name: '板栗鲜鸡泥',
    type: 'baby',
    meat: 'chicken',
    ingredients: [
      { name: '鸡里脊', amount: '50g', category: '肉类' },
      { name: '板栗', amount: '3颗', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '取新鲜鸡里脊，仔细剔除白色筋膜，切成小丁。' },
      { action: 'cook', text: '板栗去壳去皮，与鸡肉一同冷水入锅蒸 20 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ]
  },
  {
    id: 'b-fish-detail',
    name: '柠檬清蒸鳕鱼',
    type: 'baby',
    meat: 'fish',
    ingredients: [
      { name: '鳕鱼', amount: '50g', category: '肉类' },
      { name: '柠檬', amount: '1片', category: '其他' }
    ],
    steps: [
      { action: 'prep', text: '鳕鱼解冻后用手反复揉捏确认无鱼刺，柠檬片覆盖腌制 10 分钟。' },
      { action: 'cook', text: '去柠檬片，水开后入锅蒸 8 分钟，倒掉盘中腥水。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ]
  },
  {
    id: 'b-pork-detail',
    name: '山药瘦肉末',
    type: 'baby',
    meat: 'pork',
    ingredients: [
      { name: '猪里脊', amount: '50g', category: '肉类' },
      { name: '铁棍山药', amount: '30g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '猪里脊切小块，泡入冷水中去血水。铁棍山药去皮切断。' },
      { action: 'cook', text: '肉块和山药一同蒸熟，保留蒸出的少许原汁汤水。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ]
  },
  {
    id: 'b-shrimp-detail',
    name: '西兰花虾仁滑',
    type: 'baby',
    meat: 'shrimp',
    ingredients: [
      { name: '虾仁', amount: '3只', category: '肉类' },
      { name: '西兰花', amount: '20g', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '虾仁去黑线，西兰花只取顶端花蕾部分焯水。' },
      { action: 'cook', text: '虾仁与西兰花一同蒸 5 分钟至变色。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ]
  },
  {
    id: 'b-beef-detail',
    name: '番茄牛肉软饭',
    type: 'baby',
    meat: 'beef',
    ingredients: [
      { name: '牛里脊', amount: '50g', category: '肉类' },
      { name: '番茄', amount: '半个', category: '蔬菜' }
    ],
    steps: [
      { action: 'prep', text: '牛里脊逆纹路切丁，番茄去皮切碎。' },
      { action: 'cook', text: '牛肉先煮 30 分钟至软，加入番茄碎煮至出汁浓稠。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ]
  }
];
