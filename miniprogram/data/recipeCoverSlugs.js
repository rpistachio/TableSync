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
var CLOUD_STORAGE_BASE = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes';

/** 兜底图完整 URL（未在 RECIPE_NAME_TO_SLUG 中的菜或异常时使用，避免渲染层 500） */
var DEFAULT_COVER_URL = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/basic_cut_0_3_ar4.5.jpeg';

/** 菜名(中文) -> 文件名（无扩展名），小写下划线，与云端格式一致，如 kung_pao_chicken_with_peanut */
var RECIPE_NAME_TO_SLUG = {
  /* 成人菜 - 汤 */
  '花旗参石斛炖鸡汤': 'double_boiled_chicken_soup_with_ginseng_and_dendrobium',
  '五指毛桃排骨汤': 'pork_rib_soup_with_hairy_fig_root',
  '鲜淮山炖牛肉汤': 'beef_soup_with_fresh_yam',
  '玉米排骨汤': 'pork_rib_soup_with_corn',
  '番茄蛋花汤': 'tomato_and_egg_drop_soup',
  '紫菜蛋花汤': 'seaweed_and_egg_drop_soup',
  '冬瓜海带排骨汤': 'winter_melon_and_kelp_soup_with_pork_ribs',
  '丝瓜蛋花汤': 'luffa_and_egg_drop_soup',
  '番茄金针菇蛋花汤': 'tomato_and_enoki_mushroom_egg_soup',
  /* 成人菜 - 鸡 */
  '清蒸柠檬鸡里脊': 'steamed_lemon_chicken_fillet',
  '宫保鸡丁': 'kung_pao_chicken_with_peanut',
  '栗子焖鸡': 'braised_chicken_with_chestnuts',
  '白切鸡': 'poached_chicken_bai_zhan_ji',
  '可乐鸡翅': 'coca_cola_chicken_wings',
  /* 成人菜 - 鱼 */
  '清蒸鳕鱼配葱丝': 'steamed_cod_with_scallions_and_ginger',
  '孔雀开屏鱼': 'steamed_whole_fish_peacock_style',
  '红烧鱼块': 'braised_fish_chunks_in_brown_sauce',
  '清蒸鲈鱼': 'steamed_sea_bass',
  /* 成人菜 - 虾 */
  '蒜蓉粉丝蒸虾': 'steamed_prawns_with_garlic_and_vermicelli',
  '滑蛋虾仁': 'scrambled_eggs_with_shrimp',
  '避风塘炒虾': 'bi_feng_tang_crispy_garlic_prawns',
  /* 成人菜 - 牛 */
  '杭椒牛柳': 'stir_fried_beef_with_long_green_peppers',
  '番茄牛腩': 'stewed_beef_brisket_with_tomatoes',
  '番茄炖牛腩': 'tomato_and_beef_brisket_stew',
  '小炒黄牛肉': 'stir_fried_spicy_beef',
  '咖喱牛腩': 'beef_brisket_curry',
  '蚝油牛肉': 'beef_with_oyster_sauce',
  '土豆炖牛肉': 'beef_stew_with_potatoes',
  /* 成人菜 - 猪 */
  '蒜香蒸排骨': 'steamed_pork_ribs_with_garlic',
  '滑溜里脊片': 'sauteed_sliced_pork_loin',
  '白菜豆腐炖五花': 'braised_pork_belly_with_cabbage_and_tofu',
  '回锅肉': 'twice_cooked_pork_belly',
  '鱼香肉丝': 'yuxiang_shredded_pork',
  '红烧肉': 'braised_pork_belly_hong_shao_rou',
  '麻婆豆腐': 'mapo_tofu',
  '葱爆羊肉': 'stir_fried_mutton_with_scallions',
  /* 成人菜 - 素/蛋 */
  '手撕包菜': 'hand_torn_sauteed_cabbage',
  '蒜蓉西兰花': 'sauteed_broccoli_with_garlic',
  '清炒时蔬': 'stir_fried_seasonal_greens',
  '拍黄瓜': 'smashed_cucumber_salad',
  '西红柿炒蛋': 'tomato_and_scrambled_eggs',
  '地三鲜': 'sauteed_potato_eggplant_and_pepper',
  '番茄炒蛋': 'stir_fried_tomato_and_eggs',
  '青椒炒肉丝': 'shredded_pork_with_green_peppers',
  '清炒上海青': 'sauteed_bok_choy',
  '凉拌黄瓜': 'garlic_cucumber_salad',
  '蒜蓉油麦菜': 'sauteed_lettuce_with_garlic',
  '清炒山药': 'stir_fried_chinese_yam',
  '白灼西兰花': 'blanched_broccoli_with_soy_sauce',
  '番茄烧茄子': 'braised_eggplant_with_tomato',
  '清炒荷兰豆': 'sauteed_snow_peas',
  '蒸水蛋': 'steamed_egg_custard',
  '酸辣土豆丝': 'sour_and_spicy_potato_strips',
  '清炒娃娃菜': 'sauteed_baby_cabbage',
  /* 宝宝菜（暂无英文封面图，保留拼音 slug 或后续补充） */
  '板栗鲜鸡泥': 'ban_li_xian_ji_ni',
  '柠檬清蒸鳕鱼': 'ning_meng_qing_zheng_xue_yu',
  '山药瘦肉末': 'shan_yao_shou_rou_mo',
  '猪肉土豆小软饼': 'zhu_rou_tu_dou_xiao_ruan_bing',
  '猪肉白菜南瓜烩面': 'zhu_rou_bai_cai_nan_gua_hui_mian',
  '山药排骨碎碎粥': 'shan_yao_pai_gu_sui_sui_zhou',
  '西兰花虾仁滑': 'xi_lan_hua_xia_ren_hua',
  '番茄牛肉软饭': 'fan_qie_niu_rou_ruan_fan',
  '土豆牛肉泥': 'tu_dou_niu_rou_ni',
  '虾仁豆腐饼': 'xia_ren_dou_fu_bing',
  '虾仁豆腐蒸蛋': 'xia_ren_dou_fu_zheng_dan',
  '鱼肉碎碎面': 'yu_rou_sui_sui_mian',
  '南瓜猪肉烩饭': 'nan_gua_zhu_rou_hui_fan',
  '里脊时蔬软面': 'li_ji_shi_shu_ruan_mian',
  '鸡肉土豆泥': 'ji_rou_tu_dou_ni',
  '鸡肉西兰花饼': 'ji_rou_xi_lan_hua_bing',
  '牛肉山药粥': 'niu_rou_shan_yao_zhou',
  '土豆牛肉软饭': 'tu_dou_niu_rou_ruan_fan',
  '清蒸鱼肉泥': 'qing_zheng_yu_rou_ni',
  '虾仁蒸蛋': 'xia_ren_zheng_dan'
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
  return RECIPE_NAME_TO_SLUG[name] || DEFAULT_COVER_SLUG;
}

/**
 * 根据菜名拼出完整封面图 URL（云存储）
 * - 在 RECIPE_NAME_TO_SLUG 中则返回：CLOUD_STORAGE_BASE/slug.png
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
    url = CLOUD_STORAGE_BASE + '/' + slug + '.png';
  } else {
    url = DEFAULT_COVER_URL;
  }
  if (url.indexOf('//') === -1) {
    url = DEFAULT_COVER_URL;
  }

  // #region agent log
  try {
    var payloadCover = {
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: slug ? 'H1' : 'H4',
      location: 'miniprogram/data/recipeCoverSlugs.js:getRecipeCoverImageUrl',
      message: 'cover image url resolved',
      data: { dishName: name, slug: slug, url: url },
      timestamp: Date.now()
    };
    if (typeof fetch === 'function') {
      fetch('http://127.0.0.1:7243/ingest/2601ac33-4192-4086-adc2-d77ecd51bad3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCover)
      }).catch(function () { });
    } else if (typeof wx !== 'undefined' && wx.request) {
      wx.request({
        url: 'http://127.0.0.1:7243/ingest/2601ac33-4192-4086-adc2-d77ecd51bad3',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: payloadCover
      });
    }
  } catch (logErr4) { }
  // #endregion

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
