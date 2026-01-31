/**
 * 核心数据库（微信小程序版 - CommonJS）
 */
var adultRecipes = [
  { id: 'a-soup-1', name: '花旗参石斛炖鸡汤', type: 'adult', taste: 'soup', meat: 'chicken',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鸡腿切大块焯水，洗净浮沫。' },
      { action: 'cook', text: '石斛、花旗参稍微冲洗，与鸡肉、姜片一同入炖盅。' },
      { action: 'cook', text: '隔水慢炖 2 小时，出锅前加盐调味。' }
    ] },
  { id: 'a-soup-2', name: '五指毛桃排骨汤', type: 'adult', taste: 'soup', meat: 'pork',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。排骨冷水下锅加姜片料酒焯水。' },
      { action: 'cook', text: '五指毛桃、红枣、芡实洗净。' },
      { action: 'cook', text: '大火烧开转小火煲 1.5 小时，汤色奶白香浓。' }
    ] },
  { id: 'a-soup-3', name: '鲜淮山炖牛肉汤', type: 'adult', taste: 'soup', meat: 'beef',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。牛里脊切厚片，鲜淮山切块。' },
      { action: 'cook', text: '牛肉与淮山一同入锅，加入足量温水。' },
      { action: 'cook', text: '小火慢炖至牛肉酥烂，加少许盐即可。' }
    ] },
  { id: 'a-chi-1', name: '清蒸柠檬鸡里脊', type: 'adult', taste: 'light', meat: 'chicken',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鸡里脊去筋膜切片。' },
      { action: 'cook', text: '铺上姜片、柠檬片，水开蒸 10 分钟。' },
      { action: 'cook', text: '淋上极简生抽调味汁即可。' }
    ] },
  { id: 'a-chi-2', name: '宫保鸡丁', type: 'adult', taste: 'spicy', meat: 'chicken',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鸡肉切丁腌制，备好干辣椒。' },
      { action: 'cook', text: '大火炒香辣椒和花椒，下鸡丁滑散。' },
      { action: 'cook', text: '加入花生米和调味芡汁翻炒均匀。' }
    ] },
  { id: 'a-fish-1', name: '清蒸鳕鱼配葱丝', type: 'adult', taste: 'light', meat: 'fish',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。鳕鱼解冻吸干水分。' },
      { action: 'cook', text: '水开后大火蒸 8 分钟，倒掉多余腥水。' },
      { action: 'cook', text: '放上葱丝，淋入热油和蒸鱼豉油。' }
    ] },
  { id: 'a-shrimp-1', name: '蒜蓉粉丝蒸虾', type: 'adult', taste: 'light', meat: 'shrimp',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。虾去虾线开背，粉丝泡软。' },
      { action: 'cook', text: '铺好粉丝和虾，淋上蒜蓉酱。' },
      { action: 'cook', text: '蒸 5 分钟，最后撒上葱花。' }
    ] },
  { id: 'a-beef-1', name: '杭椒牛柳', type: 'adult', taste: 'spicy', meat: 'beef',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。牛肉切丝腌制，杭椒切段。' },
      { action: 'cook', text: '牛柳快速滑油变色捞出。' },
      { action: 'cook', text: '下杭椒炒至断生，回锅牛柳加黑椒汁快炒。' }
    ] },
  { id: 'a-pork-1', name: '玉米排骨汤', type: 'adult', taste: 'soup', meat: 'pork',
    steps: [
      { action: 'prep', text: '主食材需按比例增加至 {{scale_hint}} 倍。排骨焯水，玉米切段。' },
      { action: 'cook', text: '高压锅或炖锅慢煨 1 小时。' },
      { action: 'cook', text: '最后 20 分钟放入玉米，加盐调味。' }
    ] }
];

var babyRecipes = [
  { id: 'b-chi-detail', name: '板栗鲜鸡泥', type: 'baby', meat: 'chicken',
    steps: [
      { action: 'prep', text: '取新鲜鸡里脊，仔细剔除白色筋膜，切成小丁。' },
      { action: 'cook', text: '板栗去壳去皮，与鸡肉一同冷水入锅蒸 20 分钟。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-fish-detail', name: '柠檬清蒸鳕鱼', type: 'baby', meat: 'fish',
    steps: [
      { action: 'prep', text: '鳕鱼解冻后用手反复揉捏确认无鱼刺，柠檬片覆盖腌制 10 分钟。' },
      { action: 'cook', text: '去柠檬片，水开后入锅蒸 8 分钟，倒掉盘中腥水。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-pork-detail', name: '山药瘦肉末', type: 'baby', meat: 'pork',
    steps: [
      { action: 'prep', text: '猪里脊切小块，泡入冷水中去血水。铁棍山药去皮切断。' },
      { action: 'cook', text: '肉块和山药一同蒸熟，保留蒸出的少许原汁汤水。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-shrimp-detail', name: '西兰花虾仁滑', type: 'baby', meat: 'shrimp',
    steps: [
      { action: 'prep', text: '虾仁去黑线，西兰花只取顶端花蕾部分焯水。' },
      { action: 'cook', text: '虾仁与西兰花一同蒸 5 分钟至变色。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] },
  { id: 'b-beef-detail', name: '番茄牛肉软饭', type: 'baby', meat: 'beef',
    steps: [
      { action: 'prep', text: '牛里脊逆纹路切丁，番茄去皮切碎。' },
      { action: 'cook', text: '牛肉先煮 30 分钟至软，加入番茄碎煮至出汁浓稠。' },
      { action: 'process', text: '{{process_action}}' },
      { action: 'seasoning', text: '{{seasoning_hint}}' }
    ] }
];

module.exports = { adultRecipes: adultRecipes, babyRecipes: babyRecipes };
