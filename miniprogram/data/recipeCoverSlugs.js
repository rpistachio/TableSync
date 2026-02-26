/**
 * 菜谱封面图「语义化」命名契约（Naming Convention）
 * -----------------------------------------------
 * 约定：云存储中图片按「菜名 → 英文标识符（下划线）」命名，便于代码自动拼地址。
 * 格式：{BASE_URL}/{file_name}（file_name 需包含扩展名，如 .jpg/.png/.jpeg）
 * 示例：宫保鸡丁 → kung_pao_chicken_with_peanut.png
 *
 * 新增菜谱时：在此表增加一行「菜名 -> slug」，上传对应图片到云存储即可，无需改业务逻辑。
 */

/** 成人菜封面图所在云目录（英文 slug 图片在此目录下，如 xxx.png） */
var CLOUD_STORAGE_BASE = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes';

/** 兜底图完整 URL（未在 RECIPE_NAME_TO_SLUG 中的菜或异常时使用，避免渲染层 500） */
var DEFAULT_COVER_URL = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/basic_cut_0_3_ar4.5.jpeg';

/** 菜名(中文) -> 文件名（需包含扩展名），如 kung_pao_chicken_with_peanut.png */
var RECIPE_NAME_TO_SLUG = {
  /* 成人菜 - 汤 */
  '花旗参石斛炖鸡汤': 'double_boiled_chicken_soup_with_ginseng_and_dendrobium.png',
  '五指毛桃排骨汤': 'pork_rib_soup_with_hairy_fig_root.png',
  '鲜淮山炖牛肉汤': 'beef_soup_with_fresh_yam.png',
  '玉米排骨汤': 'pork_rib_soup_with_corn.png',
  '番茄蛋花汤': 'tomato_and_egg_drop_soup.png',
  '冬瓜海带排骨汤': 'winter_melon_and_kelp_soup_with_pork_ribs.png',
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
  '番茄酸汤鱼头': 'tomato_sour_soup_fish_head.png',
  '菌菇豆腐炖鲈鱼': 'braised_sea_bass_with_mushroom_and_tofu.png',
  /* 成人菜 - 虾 */
  '蒜蓉粉丝蒸虾': 'steamed_prawns_with_garlic_and_vermicelli.png',
  '滑蛋虾仁': 'scrambled_eggs_with_shrimp.png',
  '避风塘炒虾': 'bi_feng_tang_crispy_garlic_prawns.png',
  '椰香虾仁豆腐煲': 'coconut_shrimp_tofu_hotpot.png',
  '番茄金针菇虾仁汤': 'tomato_enoki_shrimp_soup.png',
  /* 成人菜 - 牛 */
  '杭椒牛柳': 'stir_fried_beef_with_long_green_peppers.png',
  '番茄牛腩': 'stewed_beef_brisket_with_tomatoes.png',
  '小炒黄牛肉': 'stir_fried_spicy_beef.png',
  '咖喱牛腩': 'beef_brisket_curry.png',
  '蚝油牛肉': 'beef_with_oyster_sauce.png',
  '土豆炖牛肉': 'beef_stew_with_potatoes.png',
  '苹果白切牛腱': 'apple_poached_beef_shank.png',
  '凉拌柠檬牛腱子': 'lemon_chilled_beef_shank.png',
  /* 成人菜 - 猪 */
  '蒜香蒸排骨': 'steamed_pork_ribs_with_garlic.png',
  '蒜香排骨': 'steamed_pork_ribs_with_garlic.png',
  '豆豉蒸排骨': 'steamed_pork_ribs_with_garlic.png',
  '椒盐排骨': 'five_spice_air_fried_ribs.png',
  '话梅排骨': 'steamed_pork_ribs_with_garlic.png',
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
  /* 西红柿炒蛋与番茄炒蛋同一道菜，共用封面 */
  '西红柿炒蛋': 'stir_fried_tomato_and_eggs.png',
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
  '香煎杏鲍菇': 'pan_fried_king_oyster_mushroom.png',
  '蒜蓉粉丝娃娃菜': 'steamed_baby_cabbage_vermicelli.png',
  '香菇炒青菜': 'mushroom_stir_fried_greens.png',
  '蒜蓉粉丝娃娃菜': 'steamed_baby_cabbage_vermicelli.png',
  '金针菇炒韭黄': 'enoki_mushroom_yellow_chives.png',
  '柠香蒜片鸡胸': 'lemon_garlic_chicken_breast.png',
  '姜葱蒸鳕鱼': 'ginger_scallion_steamed_cod.png',
  '蒜香菇菜心': 'garlic_mushroom_choy_sum.png',
  '蒜香柚子蒸鸡': 'garlic_pomelo_steamed_chicken.png',
  '金桔酱烧牛肉': 'kumquat_braised_beef.png',
  '松仁玉兰片': 'pine_nut_king_oyster_mushroom.png',
  '竹荪山药炖乳鸽': 'bamboo_fungus_yam_squab_soup.png',
  '黄芪枸杞蒸南瓜': 'astragalus_goji_steamed_pumpkin.png',
  '银耳海参蒸鲈鱼': 'snow_fungus_sea_cucumber_steamed_bass.png',
  '葱油鸡翅': 'scallion_oil_chicken_wings.png',
  '金沙玉米粒': 'golden_sand_corn.png',
  '白萝卜排骨汤': 'radish_pork_rib_soup.png',
  '姜葱蒸龙利鱼': 'steamed_sole_fish.png',
  '葱油蒜香猪肉片': 'scallion_garlic_pork_slices.png',
  '姜葱滑鸡丝': 'ginger_scallion_chicken_strips.png',
  '蒜蓉豆芽韭菜': 'garlic_bean_sprouts_chives.png',
  '青椒牛肉末': 'green_pepper_ground_beef.png',
  '金针菇炒青菜': 'enoki_mushroom_greens.png',
  '柠香蒜片鸡': 'lemon_garlic_chicken.png',
  '虫草花炖乌鸡汤': 'cordyceps_black_chicken_soup.png',
  '姜葱蒸海鲈': 'ginger_scallion_steamed_seabass.png',
  '蚝油芥兰牛肉': 'oyster_sauce_beef_kailan.png',
  '香菇炖排骨': 'braised_pork_ribs_mushroom.png',
  '香脆空炸花菜': 'crispy_air_fried_cauliflower.png',
  '五香空炸排骨': 'five_spice_air_fried_ribs.png',
  '香酥空炸带鱼': 'crispy_air_fried_hairtail.png',
  '香酥空炸杏鲍菇': 'crispy_air_fried_king_oyster_mushroom.png',
  '蒜香蜂蜜鸡翅': 'garlic_honey_chicken_wings.png',
  '香脆杏鲍菇': 'crispy_king_oyster_mushroom.png',
  '香煎五花肉': 'crispy_pork_belly.png',
  '椒盐玉米粒': 'salt_and_pepper_corn.png',
  '黑椒牛肉粒': 'black_pepper_beef_cubes.png',
  '空气炸锅蜜汁鸡翅': 'air_fryer_honey_chicken_wings.jpg',
  '空气炸锅盐焗鸡腿': 'air_fryer_salt_baked_chicken_drumsticks.jpg',
  '空气炸锅脆皮五花肉': 'air_fryer_crispy_pork_belly.jpg',
  '空气炸锅蒜香排骨': 'air_fryer_garlic_ribs.jpg',
  '空气炸锅黑椒牛肉粒': 'air_fryer_black_pepper_beef_cubes.jpg',
  '空气炸锅香酥鳕鱼块': 'air_fryer_crispy_cod_bites.jpg',
  '空气炸锅椒盐虾': 'air_fryer_salt_pepper_shrimp.jpg',
  '空气炸锅蒜香杏鲍菇': 'air_fryer_garlic_king_oyster_mushroom.jpg',
  '空气炸锅孜然土豆块': 'air_fryer_cumin_potato_cubes.jpg',
  '西芹炒虾仁': 'celery_stir_fried_shrimp.png',
  '糖醋里脊': 'sweet_sour_pork_tenderloin.png',
  '黑椒牛排': 'black_pepper_beef_stir_fry.png',
  '凉拌秋葵': 'cold_okra_salad.png',
  '芦笋虾仁炒蛋': 'asparagus_shrimp_egg_stir_fry.png',
  '蒜蓉西兰花炒鸡胸': 'garlic_broccoli_chicken_stir_fry.png',
  '魔芋凉拌荞麦面': 'konjac_buckwheat_cold_noodle.png',
  '柠檬香茅蒸鱼片': 'lemongrass_steamed_fish.png',
  '黄瓜木耳炒鸡丁': 'cucumber_wood_ear_chicken_stir_fry.png',
  '糖醋藕片': 'sweet_sour_lotus_root_slices.png',
  '蒜蓉木耳': 'garlic_wood_ear_salad.png',
  '香拌苦菊': 'dressed_chicory_with_peanuts.png',
  '凉拌海带丝': 'cold_kelp_noodles_salad.png',
  '糖醋排骨': 'sweet_and_sour_pork_ribs.png',
  '蒜香排骨': 'garlic_steamed_pork_ribs.png',
  '豆豉蒸排骨': 'black_bean_steamed_pork_ribs.png',
  '椒盐排骨': 'szechuan_pepper_pork_ribs.png',
  '话梅排骨': 'preserved_plum_pork_ribs.png',
  '香椿煎蛋': 'toon_煎蛋.png',
  '蚕豆炒火腿': 'fava_bean_火腿_stir_fry.png',
  '凉拌折耳根': 'cold_折耳根.png',
  /* Batch 1: 羊肉 + 鸭肉 */
  '孜然炒羊肉': 'cumin_stir_fried_lamb.png',
  '萝卜炖羊肉汤': 'lamb_radish_clear_stew.png',
  '当归羊肉煲': 'angelica_lamb_stew.png',
  '啤酒鸭': 'beer_duck.png',
  '姜母鸭': 'ginger_duck_fujian_style.png',
  /* Batch 2: 贝类 */
  '辣炒蛤蜊': 'garlic_chili_clams.png',
  '白灼鱿鱼须': 'poached_squid_tentacles.png',
  '蚝油鲍鱼片': 'oyster_sauce_abalone_slices.png',
  '葱姜炒花甲': 'scallion_ginger_clams.png',
  '蒜蓉粉丝蒸扇贝': 'garlic_steamed_scallops.png',
  /* Batch 3: 酸爽解腻 */
  '金汤酸菜鱼': 'sour_mustard_fish_golden_soup.png',
  '酸辣鸡丝凉拌': 'sour_spicy_chicken_cold_salad.png',
  '泰式酸辣虾': 'thai_sour_spicy_shrimp.png',
  '糟辣脆藕片': 'guizhou_style_zhao_la_crispy_lotus_root.png',
  '酸汤肥牛': 'sour_soup_beef.png',
  /* Batch 4: 辣味层次 */
  '水煮肉片': 'sichuan_boiled_pork_slices.png',
  '剁椒鱼头': 'chopped_chili_fish_head.png',
  '麻辣卤鸭脖': 'mala_braised_duck_neck.png',
  '干锅香辣蟹': 'dry_pot_spicy_crab.png',
  '酸辣蕨根粉': 'sour_spicy_fern_root_noodles.png',
  /* Batch 5: 深夜 + 快手 */
  '麻辣冷吃鸡丁': 'mala_cold_chicken_bites.png',
  '盐水毛豆': 'salt_boiled_edamame.png',
  '香卤牛腱': 'braised_beef_tendon_slices.png',
  '荷兰豆炒腊肉': 'stir_fried_snow_peas_with_ham.png',
  '咸蛋黄焗南瓜': 'salt_egg_yolk_baked_pumpkin.png',
  /* Batch 6: 宝宝共享 */
  '清蒸狮子头': 'steamed_lion_head_meatballs.png',
  '番茄滑肉片': 'tomato_pork_slices.png',
  '山药排骨煲': 'yam_pork_ribs_stew.png',
  '生炒鸡块': 'stir_fried_chicken_chunks.png',
  '豆腐蒸鲈鱼': 'steamed_sea_bass_with_tofu.png',
  '蒜香椒盐排骨': 'garlic_salt_ribs.png',
  '蒜香椒盐排骨': 'garlic_salt_ribs.png',
  '蒜香椒盐排骨': 'garlic_salt_ribs.png',
  '葱爆牛肉': 'scallion_stir_fried_beef.png',
  '洋葱肥牛卷': 'onion_beef_rolls.png',
  '葱香牛肉炒饭': 'scallion_beef_fried_rice.png',
  '蒜香芝士焗虾': 'garlic_cheese_baked_shrimp.png',
  '蒜香芝士焗虾': 'garlic_cheese_baked_shrimp.png',
  '迷迭香烤羊排': 'rosemary_lamb_rack.png',
  '迷迭香烤羊排': 'rosemary_lamb_rack.png',
  '培根土豆焗烤': 'bacon_mashed_potato_gratin.png',
  '培根土豆焗烤': 'bacon_mashed_potato_gratin.png',
  '柠檬香草烤鸡腿': 'lemon_herb_roasted_chicken_leg.png',
  '柠檬香草烤鸡腿': 'lemon_herb_roasted_chicken_leg.png',
  '番茄肉酱焗意面': 'tomato_bolognese_baked_pasta.png',
  '番茄肉酱焗意面': 'tomato_bolognese_baked_pasta.png',
  '电饭煲羊肉抓饭': 'electric_rice_cooker_lamb_pilaf.png',
  '电饭煲羊肉抓饭': 'electric_rice_cooker_lamb_pilaf.png',
  '电饭煲香菇滑鸡': 'electric_rice_cooker_mushroom_chicken.png',
  '电饭煲香菇滑鸡': 'electric_rice_cooker_mushroom_chicken.png',
  '电饭煲番茄牛腩': 'electric_rice_cooker_tomato_beef_stew.png',
  '电饭煲番茄牛腩': 'electric_rice_cooker_tomato_beef_stew.png',
  '电饭煲盐焗鸡': 'electric_rice_cooker_salt_baked_chicken.png',
  '电饭煲盐焗鸡': 'electric_rice_cooker_salt_baked_chicken.png',
  '电饭煲玉米排骨汤': 'electric_rice_cooker_corn_pork_rib_soup.png',
  '电饭煲玉米排骨汤': 'electric_rice_cooker_corn_pork_rib_soup.png',
  '微波蒜蓉西兰花': 'microwave_garlic_broccoli.png',
  '微波蒜蓉西兰花': 'microwave_garlic_broccoli.png',
  '微波蜜汁鸡翅': 'microwave_honey_chicken_wings.png',
  '微波蜜汁鸡翅': 'microwave_honey_chicken_wings.png',
  '微波蒜蓉蒸虾': 'microwave_garlic_steamed_shrimp.png',
  '微波蒜蓉蒸虾': 'microwave_garlic_steamed_shrimp.png',
  '微波鸡蛋羹': 'microwave_steamed_egg.png',
  '微波鸡蛋羹': 'microwave_steamed_egg.png',
  '柠檬香煎羊排': 'lemon_pan_seared_lamb_chops.png',
  '柠檬香煎羊排': 'lemon_pan_seared_lamb_chops.png',
  '香辣羊腱子冷盘': 'spicy_cold_lamb_shank.png',
  '话梅酸甜羊肉': 'prune_sweet_sour_lamb.png',
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
  '虾仁蒸蛋': 'shrimp_steamed_egg.png',
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
 * @returns {string} fileName，如 'stir_fried_beef_with_long_green_peppers.png'，找不到时为 DEFAULT_COVER_SLUG
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
