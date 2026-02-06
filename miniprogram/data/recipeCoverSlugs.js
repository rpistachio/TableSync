/**
 * 菜谱封面图「语义化」命名契约（Naming Convention）
 * -----------------------------------------------
 * 约定：云存储中图片按「菜名 → 英文标识符（下划线）」命名，便于代码自动拼地址。
 * 格式：{BASE_URL}/{file_name}（file_name 需包含扩展名，如 .jpg/.png/.jpeg）
 * 示例：宫保鸡丁 → kung_pao_chicken_with_peanut.jpg
 *
 * 新增菜谱时：在此表增加一行「菜名 -> slug」，上传对应图片到云存储即可，无需改业务逻辑。
 */

/** 成人菜封面图所在云目录（英文 slug 图片在此目录下，如 xxx.png） */
var CLOUD_STORAGE_BASE = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes';

/** 兜底图完整 URL（未在 RECIPE_NAME_TO_SLUG 中的菜或异常时使用，避免渲染层 500） */
var DEFAULT_COVER_URL = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/basic_cut_0_3_ar4.5.jpeg';

/** 菜名(中文) -> 文件名（需包含扩展名），如 kung_pao_chicken_with_peanut.jpg */
var RECIPE_NAME_TO_SLUG = {
  /* 成人菜 - 汤 */
  '花旗参石斛炖鸡汤': 'double_boiled_chicken_soup_with_ginseng_and_dendrobium.jpg',
  '五指毛桃排骨汤': 'pork_rib_soup_with_hairy_fig_root.jpg',
  '鲜淮山炖牛肉汤': 'beef_soup_with_fresh_yam.jpg',
  '玉米排骨汤': 'pork_rib_soup_with_corn.jpg',
  '番茄蛋花汤': 'tomato_and_egg_drop_soup.jpg',
  '紫菜蛋花汤': 'seaweed_and_egg_drop_soup.jpg',
  '冬瓜海带排骨汤': 'winter_melon_and_kelp_soup_with_pork_ribs.jpg',
  '丝瓜蛋花汤': 'luffa_and_egg_drop_soup.jpg',
  '番茄金针菇蛋花汤': 'tomato_and_enoki_mushroom_egg_soup.jpg',
  /* 成人菜 - 鸡 */
  '清蒸柠檬鸡里脊': 'steamed_lemon_chicken_fillet.jpg',
  '宫保鸡丁': 'kung_pao_chicken_with_peanut.jpg',
  '栗子焖鸡': 'braised_chicken_with_chestnuts.jpg',
  '白切鸡': 'poached_chicken_bai_zhan_ji.png',
  '可乐鸡翅': 'coca_cola_chicken_wings.jpg',
  /* 成人菜 - 鱼 */
  '清蒸鳕鱼配葱丝': 'steamed_cod_with_scallions_and_ginger.jpg',
  '孔雀开屏鱼': 'steamed_whole_fish_peacock_style.jpg',
  '红烧鱼块': 'braised_fish_chunks_in_brown_sauce.jpg',
  '清蒸鲈鱼': 'steamed_sea_bass.jpg',
  '番茄酸汤鱼头': 'tomato_sour_soup_fish_head.png',
  '菌菇豆腐炖鲈鱼': 'braised_sea_bass_with_mushroom_and_tofu.png',
  /* 成人菜 - 虾 */
  '蒜蓉粉丝蒸虾': 'steamed_prawns_with_garlic_and_vermicelli.jpg',
  '滑蛋虾仁': 'scrambled_eggs_with_shrimp.jpg',
  '避风塘炒虾': 'bi_feng_tang_crispy_garlic_prawns.jpg',
  '椰香虾仁豆腐煲': 'coconut_shrimp_tofu_hotpot.png',
  '番茄金针菇虾仁汤': 'tomato_enoki_shrimp_soup.png',
  /* 成人菜 - 牛 */
  '杭椒牛柳': 'stir_fried_beef_with_long_green_peppers.jpg',
  '番茄牛腩': 'stewed_beef_brisket_with_tomatoes.jpg',
  '番茄炖牛腩': 'tomato_and_beef_brisket_stew.jpg',
  '小炒黄牛肉': 'stir_fried_spicy_beef.jpg',
  '咖喱牛腩': 'beef_brisket_curry.jpg',
  '蚝油牛肉': 'beef_with_oyster_sauce.jpg',
  '土豆炖牛肉': 'beef_stew_with_potatoes.jpg',
  '苹果白切牛腱': 'apple_poached_beef_shank.png',
  '凉拌柠檬牛腱子': 'lemon_chilled_beef_shank.png',
  /* 成人菜 - 猪 */
  '蒜香蒸排骨': 'steamed_pork_ribs_with_garlic.jpg',
  '滑溜里脊片': 'sauteed_sliced_pork_loin.jpg',
  '白菜豆腐炖五花': 'braised_pork_belly_with_cabbage_and_tofu.jpg',
  '回锅肉': 'twice_cooked_pork_belly.jpg',
  '鱼香肉丝': 'yuxiang_shredded_pork.jpg',
  '红烧肉': 'braised_pork_belly_hong_shao_rou.jpg',
  '麻婆豆腐': 'mapo_tofu.jpg',
  '葱爆羊肉': 'stir_fried_mutton_with_scallions.jpg',
  /* 成人菜 - 素/蛋 */
  '手撕包菜': 'hand_torn_sauteed_cabbage.jpg',
  '蒜蓉西兰花': 'sauteed_broccoli_with_garlic.jpg',
  '清炒时蔬': 'stir_fried_seasonal_greens.jpg',
  '拍黄瓜': 'smashed_cucumber_salad.jpg',
  '西红柿炒蛋': 'tomato_and_scrambled_eggs.jpg',
  '地三鲜': 'sauteed_potato_eggplant_and_pepper.jpg',
  '番茄炒蛋': 'stir_fried_tomato_and_eggs.jpg',
  '青椒炒肉丝': 'shredded_pork_with_green_peppers.jpg',
  '清炒上海青': 'sauteed_bok_choy.jpg',
  '凉拌黄瓜': 'garlic_cucumber_salad.jpg',
  '蒜蓉油麦菜': 'sauteed_lettuce_with_garlic.jpg',
  '清炒山药': 'stir_fried_chinese_yam.jpg',
  '白灼西兰花': 'blanched_broccoli_with_soy_sauce.jpg',
  '番茄烧茄子': 'braised_eggplant_with_tomato.jpg',
  '清炒荷兰豆': 'sauteed_snow_peas.jpg',
  '蒸水蛋': 'steamed_egg_custard.jpg',
  '酸辣土豆丝': 'sour_and_spicy_potato_strips.jpg',
  '清炒娃娃菜': 'sauteed_baby_cabbage.jpg',
  '白菜豆腐粉丝煲': 'cabbage_tofu_vermicelli_hotpot.png',
  '山药萝卜菌菇煲': 'yam_radish_mushroom_stew.png',
  /* 成人菜 - 网红滇味&泰式凉拌 */
  '火烧树番茄酱拌凉皮': 'fire_tree_tomato_sauce_cold_noodles.png',
  '傣味凉拌米线': 'dai_style_cold_rice_noodles.png',
  '傣味柠檬手撕鸡': 'dai_style_lemon_shredded_chicken.png',
  '泰式凉拌虾木瓜沙拉': 'thai_style_papaya_salad_with_shrimp.png',
  /* 成人菜 - 快手煎炒&网红炒饭 */
  '香煎鸡肉': 'pan_fried_chicken_breast.png',
  '油糟辣椒炒饭': 'spicy_fermented_chili_fried_rice.png',
  '泰式打抛炒饭': 'thai_basil_minced_meat_fried_rice.png',
  /* 成人菜 - 养生滋补汤（乌鸡款） */
  '人参黄芪乌鸡汤': 'ginseng_astragalus_black_chicken_soup.png',
  '党参枸杞乌鸡汤': 'codonopsis_goji_berry_black_chicken_soup.png',
  /* 成人菜 - 养生滋补汤（排骨款） */
  '黄芪党参排骨汤': 'astragalus_codonopsis_pork_rib_soup.png',
  '灵芝红枣排骨汤': 'ganoderma_jujube_pork_rib_soup.png',
  /* 成人菜 - 养生滋补汤（老母鸡款） */
  '人参桂圆老母鸡汤': 'ginseng_longan_old_hen_soup.png',
  '灵芝石斛老母鸡汤': 'ganoderma_dendrobium_old_hen_soup.png',
  /* 成人菜 - 养生滋补汤（猪蹄款） */
  '黄芪花生猪蹄汤': 'astragalus_peanut_pig_trotter_soup.png',
  '党参山药猪蹄汤': 'codonopsis_yam_pig_trotter_soup.png',
  '酸辣炒笋': 'stir_fried_spicy_sour_bamboo_shoots.png',
  '柠檬酱油手撕生菜': 'lemon_soy_lettuce.png',
  '柠檬椒盐虾': 'lemon_pepper_salt_shrimp.png',
  '酸萝卜老鸭汤': 'sour_radish_duck_soup.png',
  '蒜蓉炒菜心': 'stir_fried_choy_sum_with_garlic.png',
  /* 成人菜 - 新增素菜（a-veg-19～a-veg-28） */
  '醋溜土豆丝': 'vinegar_glazed_potato_strips.png',
  '香煎南瓜': 'pan_fried_pumpkin.png',
  '蒜蓉烤口蘑': 'garlic_roasted_button_mushrooms.png',
  '家常豆腐': 'home_style_stir_fried_tofu.png',
  '韭菜炒蛋': 'chive_scrambled_eggs.png',
  '苦瓜煎蛋': 'bitter_melon_omelette.png',
  '凉拌木耳': 'cold_wood_ear_salad.png',
  '凉拌腐竹': 'cold_dried_tofu_skin_salad.png',
  '老醋花生': 'aged_vinegar_peanuts.png',
  '彩椒炒木耳': 'stir_fried_bell_pepper_wood_ear.png',
  '藕片炒五花肉': 'lotus_root_pork_belly_stir_fry.png',
  '酸汤金针菇牛肉': 'sour_beef_enoki_mushroom_soup.png',
  '凉拌茄子豆芽': 'cold_eggplant_bean_sprouts.png',
  '韭菜炒鸡丝': 'chicken_chives_stir_fry.png',
  '葱油鲜鱼片': 'scallion_oil_steamed_fish.png',
  /* 宝宝菜 */
  '板栗鲜鸡泥': 'chestnut_chicken_puree.jpg',
  '柠檬清蒸鳕鱼': 'lemon_steamed_cod.jpg',
  '山药瘦肉末': 'yam_minced_pork.jpg',
  '猪肉土豆小软饼': 'pork_potato_patties.jpg',
  '猪肉白菜南瓜烩面': 'pork_pumpkin_noodles.jpg',
  '山药排骨碎碎粥': 'yam_rib_porridge.jpg',
  '西兰花虾仁滑': 'broccoli_shrimp_paste.jpg',
  '番茄牛肉软饭': 'tomato_beef_soft_rice.jpg',
  '土豆牛肉泥': 'potato_beef_puree.jpg',
  '虾仁豆腐饼': 'shrimp_tofu_cakes.jpg',
  '虾仁豆腐蒸蛋': 'shrimp_tofu_custard.jpg',
  '鱼肉碎碎面': 'fish_minced_noodles.jpg',
  '南瓜猪肉烩饭': 'pumpkin_pork_risotto.jpg',
  '里脊时蔬软面': 'pork_veggie_noodles.jpg',
  '鸡肉土豆泥': 'chicken_potato_puree.jpg',
  '鸡肉西兰花饼': 'chicken_broccoli_patties.jpg',
  '牛肉山药粥': 'beef_yam_porridge.jpg',
  '土豆牛肉软饭': 'potato_beef_soft_rice.jpg',
  '清蒸鱼肉泥': 'steamed_fish_puree.jpg',
  '虾仁蒸蛋': 'shrimp_steamed_egg.jpg',
  '南瓜鸡肉碎碎粥': 'pumpkin_chicken_congee.png',
  '番茄鸡肉蝴蝶面': 'tomato_chicken_butterfly_pasta.png',
  '鳕鱼土豆小软饼': 'cod_potato_soft_patties.png',
  '番茄虾仁烩饭': 'tomato_shrimp_risotto.png',
  '西兰花虾仁豆腐烩面': 'broccoli_shrimp_tofu_noodles.png'
};

/** 兜底图文件名（包含扩展名），仅用于 getCoverSlug 返回值 */
var DEFAULT_COVER_SLUG = 'basic_cut_0_3_ar4.5.jpeg';

/**
 * 根据菜名取封面文件名（包含扩展名）
 * @param {string} dishName - recipes.js 里的 name
 * @returns {string} fileName，如 'stir_fried_beef_with_long_green_peppers.jpg'，找不到时为 DEFAULT_COVER_SLUG
 */
function getCoverSlug(dishName) {
  if (typeof dishName !== 'string' || !dishName.trim()) return DEFAULT_COVER_SLUG;
  var name = dishName.trim();
  return RECIPE_NAME_TO_SLUG[name] || DEFAULT_COVER_SLUG;
}

function normalizeToFileName(slugOrFileName) {
  if (typeof slugOrFileName !== 'string') return null;
  var s = slugOrFileName.trim();
  if (!s) return null;
  // 已包含扩展名：直接返回（避免 double-append）
  if (/\.[A-Za-z0-9]{2,5}$/.test(s)) return s;
  // 兼容旧数据：没有扩展名时默认补 .jpg（与云端约定一致）
  return s + '.jpg';
}

/**
 * 根据菜名拼出完整封面图 URL（云存储）
 * - 在 RECIPE_NAME_TO_SLUG 中则返回：CLOUD_STORAGE_BASE/fileName（fileName 已含扩展名）
 * - 未找到（如未上传图片的菜）则返回兜底图 DEFAULT_COVER_URL
 * - 保证返回值包含 //，避免小程序渲染层 500 路径错误
 * @param {string} dishName - recipes.js 里的 name
 * @returns {string} 完整 cloud://... 或可用的 URL
 */
function getRecipeCoverImageUrl(dishName) {
  // 1. 基础校验：确保输入是字符串
  var name = (typeof dishName === 'string') ? dishName.trim() : '';
  
  // 2. 匹配 Slug：如果找不到，直接给默认图，防止拼接出无效路径
  var slug = name ? RECIPE_NAME_TO_SLUG[name] : null;
  var fileName = slug ? normalizeToFileName(slug) : null;
  
  // 3. 构建 URL
  var url = DEFAULT_COVER_URL;
  if (fileName) {
    url = CLOUD_STORAGE_BASE + '/' + fileName;
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
