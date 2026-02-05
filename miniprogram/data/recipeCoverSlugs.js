/**
 * 菜谱封面图「语义化」命名契约（Naming Convention）
 * -----------------------------------------------
 * 约定：云存储中图片按「菜名 → 英文标识符（下划线）」命名，便于代码自动拼地址。
 * 格式：{BASE_URL}/{name_slug}.png 或 .jpg
 * 示例：宫保鸡丁 → kung_pao_chicken_with_peanut.png
 *
 * 新增菜谱时：在此表增加一行「菜名 -> slug」，上传对应图片到云存储即可，无需改业务逻辑。
 */

/** 成人菜封面图所在云目录（英文 slug 图片在此目录下，如 xxx.png） */
// 注意：这里必须使用「环境 ID」形式的 fileID（cloud://<env-id>/...）
// 不要带控制台复制出来的冗余后缀（如 ".636c-...-140..."），否则在渲染层直接使用 cloud:// 可能触发 500。
var CLOUD_STORAGE_BASE = 'cloud://cloud1-7g5mdmib90e9f670/adults_recipes';

/** 兜底图完整 URL（未在 RECIPE_NAME_TO_SLUG 中的菜或异常时使用，避免渲染层 500） */
var DEFAULT_COVER_URL = 'cloud://cloud1-7g5mdmib90e9f670/basic_cut_0_3_ar4.5.jpeg';

/** 菜名(中文) -> 文件名（含扩展名），如 kung_pao_chicken_with_peanut.png */
var RECIPE_NAME_TO_SLUG = {
  /* 成人菜 - 汤 */
  '花旗参石斛炖鸡汤': 'double_boiled_chicken_soup_with_ginseng_and_dendrobium.png',
  '五指毛桃排骨汤': 'pork_rib_soup_with_hairy_fig_root.png',
  '鲜淮山炖牛肉汤': 'beef_soup_with_fresh_yam.png',
  '玉米排骨汤': 'pork_rib_soup_with_corn.png',
  '番茄蛋花汤': 'tomato_and_egg_drop_soup.png',
  '紫菜蛋花汤': 'seaweed_and_egg_drop_soup.jpg',
  '冬瓜海带排骨汤': 'winter_melon_and_kelp_soup_with_pork_ribs.png',
  '丝瓜蛋花汤': 'luffa_and_egg_drop_soup.png',
  '番茄金针菇蛋花汤': 'tomato_and_enoki_mushroom_egg_soup.png',
  /* 成人菜 - 鸡 */
  '清蒸柠檬鸡里脊': 'steamed_lemon_chicken_fillet.png',
  '宫保鸡丁': 'kung_pao_chicken_with_peanut.png',
  '栗子焖鸡': 'braised_chicken_with_chestnuts.png',
  '白切鸡': 'poached_chicken_bai_zhan_ji.png',
  '可乐鸡翅': 'coca_cola_chicken_wings.png',
  /* 成人菜 - 鱼 */
  '清蒸鳕鱼配葱丝': 'steamed_cod_with_scallions_and_ginger.png',
  '孔雀开屏鱼': 'steamed_whole_fish_peacock_style.png',
  '红烧鱼块': 'braised_fish_chunks_in_brown_sauce.png',
  '清蒸鲈鱼': 'steamed_sea_bass.png',
  /* 成人菜 - 虾 */
  '蒜蓉粉丝蒸虾': 'steamed_prawns_with_garlic_and_vermicelli.png',
  '滑蛋虾仁': 'scrambled_eggs_with_shrimp.png',
  '避风塘炒虾': 'bi_feng_tang_crispy_garlic_prawns.png',
  /* 成人菜 - 牛 */
  '杭椒牛柳': 'stir_fried_beef_with_long_green_peppers.png',
  '番茄牛腩': 'stewed_beef_brisket_with_tomatoes.png',
  '番茄炖牛腩': 'tomato_and_beef_brisket_stew.png',
  '小炒黄牛肉': 'stir_fried_spicy_beef.png',
  '咖喱牛腩': 'beef_brisket_curry.png',
  '蚝油牛肉': 'beef_with_oyster_sauce.png',
  '土豆炖牛肉': 'beef_stew_with_potatoes.png',
  /* 成人菜 - 猪 */
  '蒜香蒸排骨': 'steamed_pork_ribs_with_garlic.png',
  '滑溜里脊片': 'sauteed_sliced_pork_loin.png',
  '白菜豆腐炖五花': 'braised_pork_belly_with_cabbage_and_tofu.png',
  '回锅肉': 'twice_cooked_pork_belly.png',
  '鱼香肉丝': 'yuxiang_shredded_pork.png',
  '红烧肉': 'braised_pork_belly_hong_shao_rou.png',
  '麻婆豆腐': 'mapo_tofu.png',
  '葱爆羊肉': 'stir_fried_mutton_with_scallions.png',
  /* 成人菜 - 素/蛋 */
  '手撕包菜': 'hand_torn_sauteed_cabbage.png',
  '蒜蓉西兰花': 'sauteed_broccoli_with_garlic.png',
  '清炒时蔬': 'stir_fried_seasonal_greens.png',
  '拍黄瓜': 'smashed_cucumber_salad.png',
  '西红柿炒蛋': 'tomato_and_scrambled_eggs.png',
  '地三鲜': 'sauteed_potato_eggplant_and_pepper.png',
  '番茄炒蛋': 'stir_fried_tomato_and_eggs.png',
  '青椒炒肉丝': 'shredded_pork_with_green_peppers.png',
  '清炒上海青': 'sauteed_bok_choy.png',
  '凉拌黄瓜': 'garlic_cucumber_salad.png',
  '蒜蓉油麦菜': 'sauteed_lettuce_with_garlic.png',
  '清炒山药': 'stir_fried_chinese_yam.png',
  '白灼西兰花': 'blanched_broccoli_with_soy_sauce.png',
  '番茄烧茄子': 'braised_eggplant_with_tomato.png',
  '清炒荷兰豆': 'sauteed_snow_peas.png',
  '蒸水蛋': 'steamed_egg_custard.png',
  '酸辣土豆丝': 'sour_and_spicy_potato_strips.png',
  '清炒娃娃菜': 'sauteed_baby_cabbage.png',
  /* 宝宝菜 */
  '板栗鲜鸡泥': 'chestnut_chicken_puree.png',
  '柠檬清蒸鳕鱼': 'lemon_steamed_cod.png',
  '山药瘦肉末': 'yam_minced_pork.png',
  '猪肉土豆小软饼': 'pork_potato_patties.png',
  '猪肉白菜南瓜烩面': 'pork_pumpkin_noodles.png',
  '山药排骨碎碎粥': 'yam_rib_porridge.png',
  '西兰花虾仁滑': 'broccoli_shrimp_paste.png',
  '番茄牛肉软饭': 'tomato_beef_soft_rice.png',
  '土豆牛肉泥': 'potato_beef_puree.png',
  '虾仁豆腐饼': 'shrimp_tofu_cakes.png',
  '虾仁豆腐蒸蛋': 'shrimp_tofu_custard.png',
  '鱼肉碎碎面': 'fish_minced_noodles.png',
  '南瓜猪肉烩饭': 'pumpkin_pork_risotto.png',
  '里脊时蔬软面': 'pork_veggie_noodles.png',
  '鸡肉土豆泥': 'chicken_potato_puree.png',
  '鸡肉西兰花饼': 'chicken_broccoli_patties.png',
  '牛肉山药粥': 'beef_yam_porridge.png',
  '土豆牛肉软饭': 'potato_beef_soft_rice.png',
  '清蒸鱼肉泥': 'steamed_fish_puree.png',
  '虾仁蒸蛋': 'shrimp_steamed_egg.png'
};

/** 兜底图文件名（无扩展名），仅用于 getCoverSlug 返回值 */
var DEFAULT_COVER_SLUG = 'basic_cut_0_3_ar4.5';

/**
 * 根据菜名取封面文件名（无扩展名）
 * @param {string} dishName - recipes.js 里的 name
 * @returns {string} slug，如 'stir_fried_beef_with_long_green_peppers'，找不到时为 DEFAULT_COVER_SLUG
 */
function getCoverSlug(dishName) {
  if (typeof dishName !== 'string' || !dishName.trim()) return DEFAULT_COVER_SLUG;
  var name = dishName.trim();
  var filename = RECIPE_NAME_TO_SLUG[name] || DEFAULT_COVER_SLUG;
  // 保持兼容：对外仍返回「无扩展名」的 slug（历史上 getCoverSlug 就是无扩展名）
  return (typeof filename === 'string')
    ? filename.replace(/\.(png|jpe?g|webp)$/i, '')
    : DEFAULT_COVER_SLUG;
}

function hasFileExtension(s) {
  return typeof s === 'string' && /\.(png|jpe?g|webp)$/i.test(s);
}

function ensureCoverFilename(slugOrFilename) {
  if (!slugOrFilename || typeof slugOrFilename !== 'string') return '';
  var v = slugOrFilename.trim();
  if (!v) return '';
  return hasFileExtension(v) ? v : (v + '.png');
}

/**
 * 根据菜名拼出完整封面图 URL（云存储）
 * - 在 RECIPE_NAME_TO_SLUG 中则返回：CLOUD_STORAGE_BASE/<filename>
 *   - 若映射值已带扩展名（.jpg/.png），则直接使用
 *   - 若映射值不带扩展名（兼容旧写法），默认补 .png
 * - 未找到（如未上传图片的菜）则返回兜底图 DEFAULT_COVER_URL
 * - 保证返回值包含 //，避免小程序渲染层 500 路径错误
 * @param {string} dishName - recipes.js 里的 name
 * @returns {string} 完整 cloud://... 或可用的 URL
 */
function getRecipeCoverImageUrl(dishName) {
  // 1. 基础校验：确保输入是字符串
  var name = (typeof dishName === 'string') ? dishName.trim() : '';
  
  // 2. 匹配文件名：如果找不到，直接给默认图，防止拼接出无效路径
  var mapped = name ? RECIPE_NAME_TO_SLUG[name] : null;
  
  // 3. 构建 URL
  var url = DEFAULT_COVER_URL;
  if (mapped) {
    // mapped 可能是：
    // - 'xxx.png' / 'xxx.jpg'（推荐：RECIPE_NAME_TO_SLUG 直接存完整文件名）
    // - 'xxx'（兼容旧写法：这里会自动补成 'xxx.png'）
    var filename = ensureCoverFilename(mapped);
    if (filename) url = CLOUD_STORAGE_BASE + '/' + filename;
  }

  // 4. 终极防御：如果 URL 格式不对（比如 CLOUD_STORAGE_BASE 没定义好），回退到默认图
  // 同时确保 url 存在且不是 "undefined" 字符串
  if (!url || typeof url !== 'string' || url.indexOf('//') === -1 || url.indexOf('undefined') !== -1) {
    return DEFAULT_COVER_URL;
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
