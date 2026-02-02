/**
 * 菜谱封面图「语义化」命名契约（Naming Convention）
 * -----------------------------------------------
 * 约定：云存储中图片按「菜名 → 拼音/英文短横线」命名，便于代码自动拼地址。
 * 格式：{BASE_URL}/{name_slug}.jpg
 * 示例：杭椒牛柳 → hang-jiao-niu-liu.jpg → 代码中 imgUrl = BASE_URL + '/' + getCoverSlug(name) + '.jpg'
 *
 * 新增菜谱时：在此表增加一行「菜名 -> slug」，上传对应图片到云存储即可，无需改业务逻辑。
 */

/** 成人菜封面图所在云目录（英文 slug 图片在此目录下，如 xxx.jpg） */
var CLOUD_STORAGE_BASE = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes';

/** 兜底图完整 URL（未在 RECIPE_NAME_TO_SLUG 中的菜或异常时使用，避免渲染层 500） */
var DEFAULT_COVER_URL = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/basic_cut_0_3_ar4.5.jpeg';

/** 菜名(中文) -> 文件名（无扩展名），小写短横线，与 Midjourney 英文命名一致，云存储图片后缀 .jpg */
var RECIPE_NAME_TO_SLUG = {
  /* 成人菜 - 汤 */
  '花旗参石斛炖鸡汤': 'double-boiled-chicken-soup-with-ginseng-and-dendrobium',
  '五指毛桃排骨汤': 'pork-rib-soup-with-hairy-fig-root',
  '鲜淮山炖牛肉汤': 'beef-soup-with-fresh-yam',
  '玉米排骨汤': 'pork-rib-soup-with-corn',
  '番茄蛋花汤': 'tomato-and-egg-drop-soup',
  '紫菜蛋花汤': 'seaweed-and-egg-drop-soup',
  '冬瓜海带排骨汤': 'winter-melon-and-kelp-soup-with-pork-ribs',
  '丝瓜蛋花汤': 'luffa-and-egg-drop-soup',
  '番茄金针菇蛋花汤': 'tomato-and-enoki-mushroom-egg-soup',
  /* 成人菜 - 鸡 */
  '清蒸柠檬鸡里脊': 'steamed-lemon-chicken-fillet',
  '宫保鸡丁': 'kung-pao-chicken-with-peanuts',
  '栗子焖鸡': 'braised-chicken-with-chestnuts',
  '白切鸡': 'poached-chicken-bai-zhan-ji',
  '可乐鸡翅': 'coca-cola-chicken-wings',
  /* 成人菜 - 鱼 */
  '清蒸鳕鱼配葱丝': 'steamed-cod-with-scallions-and-ginger',
  '孔雀开屏鱼': 'steamed-whole-fish-peacock-style',
  '红烧鱼块': 'braised-fish-chunks-in-brown-sauce',
  '清蒸鲈鱼': 'steamed-sea-bass',
  /* 成人菜 - 虾 */
  '蒜蓉粉丝蒸虾': 'steamed-prawns-with-garlic-and-vermicelli',
  '滑蛋虾仁': 'scrambled-eggs-with-shrimp',
  '避风塘炒虾': 'bi-feng-tang-crispy-garlic-prawns',
  /* 成人菜 - 牛 */
  '杭椒牛柳': 'stir-fried-beef-with-long-green-peppers',
  '番茄牛腩': 'stewed-beef-brisket-with-tomatoes',
  '番茄炖牛腩': 'tomato-and-beef-brisket-stew',
  '小炒黄牛肉': 'stir-fried-spicy-beef',
  '咖喱牛腩': 'beef-brisket-curry',
  '蚝油牛肉': 'beef-with-oyster-sauce',
  '土豆炖牛肉': 'beef-stew-with-potatoes',
  /* 成人菜 - 猪 */
  '蒜香蒸排骨': 'steamed-pork-ribs-with-garlic',
  '滑溜里脊片': 'sauteed-sliced-pork-loin',
  '白菜豆腐炖五花': 'braised-pork-belly-with-cabbage-and-tofu',
  '回锅肉': 'twice-cooked-pork-belly',
  '鱼香肉丝': 'yuxiang-shredded-pork',
  '红烧肉': 'braised-pork-belly-hong-shao-rou',
  '麻婆豆腐': 'mapo-tofu',
  '葱爆羊肉': 'stir-fried-mutton-with-scallions',
  /* 成人菜 - 素/蛋 */
  '手撕包菜': 'hand-torn-sauteed-cabbage',
  '蒜蓉西兰花': 'sauteed-broccoli-with-garlic',
  '清炒时蔬': 'stir-fried-seasonal-greens',
  '拍黄瓜': 'smashed-cucumber-salad',
  '西红柿炒蛋': 'tomato-and-scrambled-eggs',
  '地三鲜': 'sauteed-potato-eggplant-and-pepper',
  '番茄炒蛋': 'stir-fried-tomato-and-eggs',
  '青椒炒肉丝': 'shredded-pork-with-green-peppers',
  '清炒上海青': 'sauteed-bok-choy',
  '凉拌黄瓜': 'garlic-cucumber-salad',
  '蒜蓉油麦菜': 'sauteed-lettuce-with-garlic',
  '清炒山药': 'stir-fried-chinese-yam',
  '白灼西兰花': 'blanched-broccoli-with-soy-sauce',
  '番茄烧茄子': 'braised-eggplant-with-tomato',
  '清炒荷兰豆': 'sauteed-snow-peas',
  '蒸水蛋': 'steamed-egg-custard',
  '酸辣土豆丝': 'sour-and-spicy-potato-strips',
  '清炒娃娃菜': 'sauteed-baby-cabbage',
  /* 宝宝菜（暂无英文封面图，保留拼音 slug 或后续补充） */
  '板栗鲜鸡泥': 'ban-li-xian-ji-ni',
  '柠檬清蒸鳕鱼': 'ning-meng-qing-zheng-xue-yu',
  '山药瘦肉末': 'shan-yao-shou-rou-mo',
  '猪肉土豆小软饼': 'zhu-rou-tu-dou-xiao-ruan-bing',
  '猪肉白菜南瓜烩面': 'zhu-rou-bai-cai-nan-gua-hui-mian',
  '山药排骨碎碎粥': 'shan-yao-pai-gu-sui-sui-zhou',
  '西兰花虾仁滑': 'xi-lan-hua-xia-ren-hua',
  '番茄牛肉软饭': 'fan-qie-niu-rou-ruan-fan',
  '土豆牛肉泥': 'tu-dou-niu-rou-ni',
  '虾仁豆腐饼': 'xia-ren-dou-fu-bing',
  '虾仁豆腐蒸蛋': 'xia-ren-dou-fu-zheng-dan',
  '鱼肉碎碎面': 'yu-rou-sui-sui-mian',
  '南瓜猪肉烩饭': 'nan-gua-zhu-rou-hui-fan',
  '里脊时蔬软面': 'li-ji-shi-shu-ruan-mian',
  '鸡肉土豆泥': 'ji-rou-tu-dou-ni',
  '鸡肉西兰花饼': 'ji-rou-xi-lan-hua-bing',
  '牛肉山药粥': 'niu-rou-shan-yao-zhou',
  '土豆牛肉软饭': 'tu-dou-niu-rou-ruan-fan',
  '清蒸鱼肉泥': 'qing-zheng-yu-rou-ni',
  '虾仁蒸蛋': 'xia-ren-zheng-dan'
};

/** 兜底图文件名（无扩展名），仅用于 getCoverSlug 返回值 */
var DEFAULT_COVER_SLUG = 'basic_cut_0_3_ar4.5';

/**
 * 根据菜名取封面文件名（无扩展名）
 * @param {string} dishName - recipes.js 里的 name
 * @returns {string} slug，如 'stir-fried-beef-with-long-green-peppers'，找不到时为 DEFAULT_COVER_SLUG
 */
function getCoverSlug(dishName) {
  if (typeof dishName !== 'string' || !dishName.trim()) return DEFAULT_COVER_SLUG;
  var name = dishName.trim();
  return RECIPE_NAME_TO_SLUG[name] || DEFAULT_COVER_SLUG;
}

/**
 * 根据菜名拼出完整封面图 URL（云存储）
 * - 在 RECIPE_NAME_TO_SLUG 中则返回：CLOUD_STORAGE_BASE/slug.jpg
 * - 未找到（如未上传图片的菜）则返回兜底图 DEFAULT_COVER_URL
 * - 保证返回值包含 //，避免小程序渲染层 500 路径错误
 * @param {string} dishName - recipes.js 里的 name
 * @returns {string} 完整 cloud://... 或可用的 URL
 */
function getRecipeCoverImageUrl(dishName) {
  var name = typeof dishName === 'string' ? dishName.trim() : '';
  var slug = name ? RECIPE_NAME_TO_SLUG[name] : null;
  var url;
  if (slug) {
    url = CLOUD_STORAGE_BASE + '/' + slug + '.jpg';
  } else {
    url = DEFAULT_COVER_URL;
  }
  if (url.indexOf('//') === -1) {
    url = DEFAULT_COVER_URL;
  }
  return url;
}

module.exports = {
  CLOUD_STORAGE_BASE: CLOUD_STORAGE_BASE,
  DEFAULT_COVER_URL: DEFAULT_COVER_URL,
  RECIPE_NAME_TO_SLUG: RECIPE_NAME_TO_SLUG,
  DEFAULT_COVER_SLUG: DEFAULT_COVER_SLUG,
  getCoverSlug: getCoverSlug,
  getRecipeCoverImageUrl: getRecipeCoverImageUrl
};
