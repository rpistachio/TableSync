/**
 * 核心数据库 — 精简离线 fallback 版（微信小程序版 - CommonJS）
 * 仅保留菜单生成算法核心字段，不含 ingredients / steps / baby_variant 等展示字段。
 * 完整数据从云端获取；离线时此文件支持算法运行，但无法显示步骤和购物清单。
 *
 * 由 tools/slim-recipes.js 自动生成，请勿手动编辑。
 * 原始完整版备份: recipes.full.bak.js
 */

var adultRecipes = [
  {"id":"a-soup-1","name":"花旗参石斛炖鸡汤","type":"adult","meat":"chicken","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-soup-3","name":"鲜淮山炖牛肉汤","type":"adult","meat":"beef","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-chi-2","name":"宫保鸡丁","type":"adult","meat":"chicken","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","prep_time":15,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["花生"],"base_serving":2},
  {"id":"a-fish-1","name":"清蒸鳕鱼配葱丝","type":"adult","meat":"fish","taste":"steamed_salad","flavor_profile":"light","cook_type":"steam","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["鱼"],"base_serving":2},
  {"id":"a-shrimp-1","name":"蒜蓉粉丝蒸虾","type":"adult","meat":"shrimp","taste":"steamed_salad","flavor_profile":"salty_umami","cook_type":"steam","prep_time":15,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["虾"],"base_serving":2},
  {"id":"a-beef-1","name":"杭椒牛柳","type":"adult","meat":"beef","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","prep_time":15,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-pork-1","name":"玉米排骨汤","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"light","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-beef-2","name":"番茄牛腩","type":"adult","meat":"beef","taste":"slow_stew","flavor_profile":"sweet_sour","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"牛腩","baseAmount":400,"unit":"g","category":"肉类"},{"name":"番茄","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"姜片","baseAmount":3,"unit":"片","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"老抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"糖","baseAmount":0,"unit":"适量","category":"调料"},{"name":"八角","baseAmount":2,"unit":"颗","category":"调料"}]},
  {"id":"a-shrimp-2","name":"滑蛋虾仁","type":"adult","meat":"shrimp","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["虾","蛋"],"base_serving":2},
  {"id":"a-fish-2","name":"孔雀开屏鱼","type":"adult","meat":"fish","taste":"steamed_salad","flavor_profile":"light","cook_type":"steam","prep_time":15,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":true,"common_allergens":["鱼"],"base_serving":2},
  {"id":"a-pork-4","name":"白菜豆腐炖五花","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-chi-3","name":"栗子焖鸡","type":"adult","meat":"chicken","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-chi-4","name":"白切鸡","type":"adult","meat":"chicken","taste":"steamed_salad","flavor_profile":"light","cook_type":"steam","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-beef-4","name":"小炒黄牛肉","type":"adult","meat":"beef","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":12,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-beef-5","name":"咖喱牛腩","type":"adult","meat":"beef","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-shrimp-3","name":"避风塘炒虾","type":"adult","meat":"shrimp","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":15,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["虾"],"base_serving":2},
  {"id":"a-fish-3","name":"红烧鱼块","type":"adult","meat":"fish","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":12,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["鱼"],"base_serving":2},
  {"id":"a-pork-5","name":"回锅肉","type":"adult","meat":"pork","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","prep_time":15,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-pork-6","name":"鱼香肉丝","type":"adult","meat":"pork","taste":"quick_stir_fry","flavor_profile":"sweet_sour","cook_type":"stir_fry","prep_time":12,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-1","name":"手撕包菜","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":8,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-2","name":"蒜蓉西兰花","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-3","name":"清炒时蔬","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":8,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-4","name":"拍黄瓜","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"steam","prep_time":5,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-pork-7","name":"红烧肉","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-6","name":"地三鲜","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":12,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-soup-4","name":"番茄蛋花汤","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"sweet_sour","cook_type":"stir_fry","dish_type":"soup","prep_time":8,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["蛋"],"base_serving":2},
  {"id":"m001","name":"番茄炒蛋","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"sweet_sour","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["蛋"],"base_serving":2},
  {"id":"m002","name":"青椒炒肉丝","type":"adult","meat":"pork","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":15,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"v001","name":"清炒上海青","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":5,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"m003","name":"可乐鸡翅","type":"adult","meat":"chicken","taste":"slow_stew","flavor_profile":"sweet_sour","cook_type":"stew","prep_time":10,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"m004","name":"清蒸鲈鱼","type":"adult","meat":"fish","taste":"steamed_salad","flavor_profile":"light","cook_type":"steam","prep_time":15,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["鱼"],"base_serving":2},
  {"id":"v003","name":"蒜蓉油麦菜","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":5,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"v004","name":"清炒山药","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"s002","name":"冬瓜海带排骨汤","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"m005","name":"麻婆豆腐","type":"adult","meat":"pork","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"m008","name":"蚝油牛肉","type":"adult","meat":"beef","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":20,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"v007","name":"清炒荷兰豆","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":5,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"m009","name":"土豆炖牛肉","type":"adult","meat":"beef","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"m010","name":"葱爆羊肉","type":"adult","meat":"lamb","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"v009","name":"酸辣土豆丝","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"sour_fresh","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"v010","name":"清炒娃娃菜","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":5,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-beef-7","name":"凉拌柠檬牛腱子","type":"adult","meat":"beef","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"cold_dress","prep_time":15,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-fish-4","name":"番茄酸汤鱼头","type":"adult","meat":"fish","taste":"slow_stew","flavor_profile":"sweet_sour","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":60,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["鱼"],"base_serving":2},
  {"id":"a-shrimp-4","name":"椰香虾仁豆腐煲","type":"adult","meat":"shrimp","taste":"slow_stew","flavor_profile":"light","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["虾"],"base_serving":2},
  {"id":"a-shrimp-5","name":"番茄金针菇虾仁汤","type":"adult","meat":"shrimp","taste":"slow_stew","flavor_profile":"sweet_sour","cook_type":"stew","dish_type":"soup","prep_time":10,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["虾"],"base_serving":2},
  {"id":"a-veg-11","name":"白菜豆腐粉丝煲","type":"adult","meat":"vegetable","taste":"slow_stew","flavor_profile":"light","cook_type":"stew","prep_time":10,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-12","name":"山药萝卜菌菇煲","type":"adult","meat":"vegetable","taste":"slow_stew","flavor_profile":"light","cook_type":"stew","prep_time":15,"cook_minutes":60,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-13","name":"火烧树番茄酱拌凉皮","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"steam","prep_time":15,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["花生"],"base_serving":2},
  {"id":"a-veg-14","name":"傣味凉拌米线","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"steam","prep_time":10,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["花生"],"base_serving":2},
  {"id":"a-chi-5","name":"傣味柠檬手撕鸡","type":"adult","meat":"chicken","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"steam","prep_time":15,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-shrimp-6","name":"泰式凉拌虾木瓜沙拉","type":"adult","meat":"shrimp","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"steam","prep_time":15,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["虾","花生"],"base_serving":2},
  {"id":"a-veg-15","name":"油糟辣椒炒饭","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","prep_time":8,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["蛋"],"base_serving":2},
  {"id":"a-pork-8","name":"泰式打抛炒饭","type":"adult","meat":"pork","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","prep_time":10,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["蛋"],"base_serving":2},
  {"id":"a-soup-7","name":"党参枸杞乌鸡汤","type":"adult","meat":"chicken","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":20,"cook_minutes":120,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"乌鸡","baseAmount":400,"unit":"g","category":"肉类"},{"name":"党参","baseAmount":15,"unit":"g","category":"干货"},{"name":"枸杞","baseAmount":10,"unit":"g","category":"干货"},{"name":"红枣","baseAmount":5,"unit":"颗","category":"干货"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-soup-9","name":"灵芝红枣排骨汤","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":15,"cook_minutes":90,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"排骨","baseAmount":400,"unit":"g","category":"肉类"},{"name":"灵芝","baseAmount":10,"unit":"g","category":"干货"},{"name":"红枣","baseAmount":8,"unit":"颗","category":"干货"},{"name":"枸杞","baseAmount":5,"unit":"g","category":"干货"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-soup-10","name":"人参桂圆老母鸡汤","type":"adult","meat":"chicken","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":20,"cook_minutes":150,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"老母鸡","baseAmount":500,"unit":"g","category":"肉类"},{"name":"人参","baseAmount":10,"unit":"g","category":"干货"},{"name":"桂圆","baseAmount":15,"unit":"g","category":"干货"},{"name":"红枣","baseAmount":5,"unit":"颗","category":"干货"},{"name":"枸杞","baseAmount":5,"unit":"g","category":"干货"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-soup-12","name":"黄芪花生猪蹄汤","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":20,"cook_minutes":120,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["花生"],"base_serving":2,"ingredients":[{"name":"猪蹄","baseAmount":500,"unit":"g","category":"肉类"},{"name":"黄芪","baseAmount":15,"unit":"g","category":"干货"},{"name":"花生","baseAmount":50,"unit":"g","category":"干货"},{"name":"红枣","baseAmount":5,"unit":"颗","category":"干货"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-soup-13","name":"党参山药猪蹄汤","type":"adult","meat":"pork","taste":"slow_stew","flavor_profile":"salty_umami","cook_type":"stew","dish_type":"soup","prep_time":20,"cook_minutes":120,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"猪蹄","baseAmount":500,"unit":"g","category":"肉类"},{"name":"党参","baseAmount":15,"unit":"g","category":"干货"},{"name":"山药","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"红枣","baseAmount":5,"unit":"颗","category":"干货"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-veg-16","name":"酸辣炒笋","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"stir_fry","dish_type":null,"prep_time":10,"cook_minutes":8,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-17","name":"柠檬酱油手撕生菜","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"stir_fry","prep_time":10,"cook_minutes":5,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-shrimp-7","name":"柠檬椒盐虾","type":"adult","meat":"shrimp","taste":"quick_stir_fry","flavor_profile":"sour_fresh","cook_type":"stir_fry","prep_time":15,"cook_minutes":8,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["虾"],"base_serving":2},
  {"id":"a-soup-14","name":"酸萝卜老鸭汤","type":"adult","meat":"duck","taste":"slow_stew","flavor_profile":"sour_fresh","cook_type":"stew","dish_type":"soup","prep_time":20,"cook_minutes":90,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"鸭肉","baseAmount":500,"unit":"g","category":"肉类"},{"name":"酸萝卜","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-veg-18","name":"蒜蓉炒菜心","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","prep_time":10,"cook_minutes":5,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-19","name":"醋溜土豆丝","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"sour_fresh","cook_type":"stir_fry","dish_type":null,"prep_time":15,"cook_minutes":8,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-20","name":"香煎南瓜","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","dish_type":null,"prep_time":5,"cook_minutes":12,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-21","name":"蒜蓉烤口蘑","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"salty_umami","cook_type":"steam","dish_type":null,"prep_time":10,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-22","name":"家常豆腐","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","dish_type":null,"prep_time":10,"cook_minutes":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-23","name":"韭菜炒蛋","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","dish_type":null,"prep_time":5,"cook_minutes":5,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["蛋"],"base_serving":2},
  {"id":"a-veg-24","name":"苦瓜煎蛋","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","dish_type":null,"prep_time":10,"cook_minutes":8,"is_baby_friendly":false,"can_share_base":false,"common_allergens":["蛋"],"base_serving":2},
  {"id":"a-veg-25","name":"凉拌木耳","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"cold_dress","dish_type":null,"prep_time":15,"cook_minutes":0,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-26","name":"凉拌腐竹","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"cold_dress","dish_type":null,"prep_time":20,"cook_minutes":0,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-27","name":"老醋花生","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"sour_fresh","cook_type":"cold_dress","dish_type":null,"prep_time":5,"cook_minutes":0,"is_baby_friendly":false,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-28","name":"彩椒炒木耳","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"stir_fry","dish_type":null,"prep_time":10,"cook_minutes":8,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[],"base_serving":2},
  {"id":"a-soup-15","name":"酸汤金针菇牛肉","type":"adult","meat":"beef","taste":"slow_stew","flavor_profile":"sour_fresh","cook_type":"stew","dish_type":"soup","prep_time":20,"cook_minutes":40,"is_baby_friendly":false,"can_share_base":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"牛肉","baseAmount":300,"unit":"g","category":"肉类"},{"name":"金针菇","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"番茄","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"酸汤底料","baseAmount":1,"unit":"包","category":"调料"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}]},
  {"id":"a-veg-29","name":"凉拌茄子豆芽","type":"adult","meat":"vegetable","taste":"steamed_salad","flavor_profile":"light","cook_type":"steam","prep_time":15,"cook_minutes":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-chi-7","name":"韭菜炒鸡丝","type":"adult","meat":"chicken","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"stir_fry","prep_time":15,"cook_minutes":8,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[],"base_serving":2},
  {"id":"a-veg-30","name":"香煎杏鲍菇","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":5,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":8,"ingredients":[{"name":"杏鲍菇","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"蒜","baseAmount":3,"unit":"瓣","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蚝油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"杏鲍菇洗净，纵向切成0.8cm厚片。蒜瓣切末。"},{"action":"cook","text":"平底锅中倒油大火烧热，放入杏鲍菇片，中火煎至两面金黄酥脆，约每面3分钟。"},{"action":"cook","text":"撒入蒜末，加入生抽、蚝油、盐调味，撒上黑胡椒粉，翻炒30秒即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"杏鲍菇泥","action":"杏鲍菇清蒸后打成泥糊"},{"max_month":12,"name":"杏鲍菇碎","action":"杏鲍菇清蒸后切碎，可拌入粥中"},{"max_month":36,"name":"宝宝版香煎杏鲍菇","action":"少油少盐煎制，切成小块"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/pan_fried_king_oyster_mushroom.png"},
  {"id":"a-veg-34","name":"蒜蓉粉丝娃娃菜","type":"adult","taste":"steamed_salad","meat":"vegetable","prep_time":8,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"steam","cook_minutes":6,"ingredients":[{"name":"娃娃菜","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"粉丝","baseAmount":50,"unit":"g","category":"其他"},{"name":"蒜","baseAmount":5,"unit":"瓣","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蚝油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"娃娃菜洗净切开，粉丝泡发，蒜瓣切末。"},{"action":"cook","text":"蒸锅水开，将娃娃菜和粉丝码放在盘中，蒸6分钟。"},{"action":"cook","text":"锅中倒油烧热，爆香蒜末，加入生抽、蚝油、盐调味，淋在蒸好的菜上即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"娃娃菜泥","action":"娃娃菜清蒸后打成泥糊"},{"max_month":12,"name":"娃娃菜粉丝碎","action":"娃娃菜和粉丝清蒸后切碎"},{"max_month":36,"name":"宝宝版蒜蓉粉丝娃娃菜","action":"少油少盐，蒜末可不加或少加"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/steamed_baby_cabbage_vermicelli.png"},
  {"id":"a-veg-32","name":"香菇炒青菜","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":8,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":5,"ingredients":[{"name":"青菜","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"香菇","baseAmount":100,"unit":"g","category":"蔬菜"},{"name":"姜","baseAmount":1,"unit":"片","category":"调料"},{"name":"蒜","baseAmount":2,"unit":"瓣","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"青菜洗净切段，香菇洗净切片，姜蒜切末。"},{"action":"cook","text":"锅中倒油烧热，爆香姜蒜末，加入香菇片翻炒1分钟。"},{"action":"cook","text":"加入青菜，淋入料酒，大火快炒至青菜变软，加入生抽、盐调味，翻炒均匀即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"香菇青菜泥","action":"香菇青菜清蒸后分别打成泥混合"},{"max_month":12,"name":"香菇青菜碎","action":"香菇青菜清蒸后切碎，可拌入粥中"},{"max_month":36,"name":"宝宝版香菇炒青菜","action":"少油少盐清炒，切成小块"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/mushroom_stir_fried_greens.png"},
  {"id":"a-veg-34","name":"蒜蓉粉丝娃娃菜","type":"adult","taste":"steamed_salad","meat":"vegetable","prep_time":8,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"steam","cook_minutes":6,"ingredients":[{"name":"娃娃菜","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"粉丝","baseAmount":50,"unit":"g","category":"其他"},{"name":"蒜","baseAmount":5,"unit":"瓣","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蚝油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"娃娃菜洗净切开，粉丝泡发，蒜瓣切末。"},{"action":"cook","text":"蒸锅水开，将娃娃菜和粉丝码放在盘中，蒸6分钟。"},{"action":"cook","text":"锅中倒油烧热，爆香蒜末，加入生抽、蚝油、盐调味，淋在蒸好的菜上即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"娃娃菜泥","action":"娃娃菜清蒸后打成泥糊"},{"max_month":12,"name":"娃娃菜粉丝碎","action":"娃娃菜和粉丝清蒸后切碎"},{"max_month":36,"name":"宝宝版蒜蓉粉丝娃娃菜","action":"少油少盐，蒜末可不加或少加"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/steamed_baby_cabbage_vermicelli.png"},
  {"id":"a-veg-33","name":"金针菇炒韭黄","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":5,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":4,"ingredients":[{"name":"金针菇","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"韭黄","baseAmount":150,"unit":"g","category":"蔬菜"},{"name":"蒜","baseAmount":3,"unit":"瓣","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"金针菇洗净切除根部，韭黄切段，蒜瓣切末。"},{"action":"cook","text":"锅中倒油大火烧热，爆香蒜末，加入金针菇翻炒1分钟。"},{"action":"cook","text":"加入韭黄，淋入生抽，撒入盐和胡椒粉，大火快炒2分钟至韭黄变软即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"金针菇泥","action":"金针菇清蒸后打成泥糊"},{"max_month":12,"name":"金针菇段","action":"金针菇清蒸后切碎，可拌入粥中"},{"max_month":36,"name":"宝宝版金针菇炒韭黄","action":"少油少盐清炒，切成小段"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/enoki_mushroom_yellow_chives.png"},
  {"id":"a-veg-35","name":"蒜香菇菜心","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":10,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":5,"ingredients":[{"name":"菜心","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"香菇","baseAmount":100,"unit":"g","category":"蔬菜"},{"name":"蒜末","baseAmount":15,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蚝油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"菜心洗净切段，香菇切片，蒜切末。"},{"action":"cook","text":"热锅下油，爆香蒜末，加入香菇片快速翻炒。"},{"action":"cook","text":"加入菜心翻炒，淋入生抽、蚝油，撒入盐和胡椒粉调味，大火快炒 2 分钟至断生即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"菜心香菇泥","action":"菜心和香菇分别煮软打泥，少许调味"},{"max_month":12,"name":"香菇菜心碎","action":"菜心和香菇切碎煮软，去掉蒜末"},{"max_month":36,"name":"宝宝菜心炒香菇","action":"同大人版，去掉蒜末，少放调味料"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_mushroom_choy_sum.png"},
  {"id":"a-chi-9","name":"蒜香柚子蒸鸡","type":"adult","taste":"steamed_salad","meat":"chicken","prep_time":20,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"steam","cook_minutes":25,"ingredients":[{"name":"鸡腿","baseAmount":500,"unit":"g","category":"肉类","sub_type":"chicken_thigh"},{"name":"柚子皮","baseAmount":30,"unit":"g","category":"其他"},{"name":"蒜末","baseAmount":20,"unit":"g","category":"调料"},{"name":"姜丝","baseAmount":15,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"葱花","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"鸡腿洗净，划几刀，加入料酒、生抽、白胡椒粉腌制20分钟。柚子皮切细丝，蒜剁末，姜切丝，葱花备用。"},{"action":"cook","text":"将腌制好的鸡腿放入盘中，表面铺上姜丝、蒜末。"},{"action":"cook","text":"大火将水烧开，放入鸡腿，转中火蒸20分钟。最后5分钟撒入柚子皮丝。"},{"action":"cook","text":"取出后撒上葱花，淋上少许热油提香即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"柚香鸡肉泥","action":"取鸡腿肉剔骨打泥，加入少许柚子皮丝熬煮的汤汁调味"},{"max_month":12,"name":"柚香鸡肉碎","action":"将鸡肉剔骨切碎，加入极少量柚子皮丝增香"},{"max_month":36,"name":"宝宝柚香蒸鸡","action":"同大人版，去掉蒜末，减少柚子皮用量，少放盐"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_pomelo_steamed_chicken.png"},
  {"id":"a-soup-16","name":"竹荪山药炖乳鸽","type":"adult","dish_type":"soup","taste":"slow_stew","meat":"chicken","prep_time":20,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stew","cook_minutes":45,"ingredients":[{"name":"乳鸽","baseAmount":1,"unit":"只","category":"肉类","sub_type":"squab"},{"name":"竹荪","baseAmount":15,"unit":"g","category":"干货"},{"name":"山药","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"枸杞","baseAmount":10,"unit":"g","category":"干货"},{"name":"生姜","baseAmount":3,"unit":"片","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"乳鸽洗净，斩半，姜切片。竹荪提前泡发20分钟，山药去皮切滚刀块。"},{"action":"cook","text":"锅中加水烧开，放入乳鸽焯水去腥，捞出冲洗干净。"},{"action":"cook","text":"砂锅加水，放入乳鸽、姜片和料酒，大火煮沸后转小火炖30分钟。"},{"action":"cook","text":"加入山药块继续炖10分钟，最后加入泡发的竹荪和枸杞，小火煮3分钟，加盐调味即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"乳鸽山药泥","action":"取乳鸽肉和山药煮烂打泥，加少许清汤调稀"},{"max_month":12,"name":"乳鸽山药糊","action":"乳鸽肉剔骨切碎，山药煮软捣碎，加适量汤汁"},{"max_month":36,"name":"宝宝竹荪乳鸽汤","action":"同大人版，少盐，去掉姜片，取软烂的肉和山药"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/bamboo_fungus_yam_squab_soup.png"},
  {"id":"a-chi-10","name":"葱油鸡翅","type":"adult","taste":"quick_stir_fry","meat":"chicken","prep_time":10,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":15,"ingredients":[{"name":"鸡翅中","baseAmount":500,"unit":"g","category":"肉类","sub_type":"chicken_wing"},{"name":"葱花","baseAmount":30,"unit":"g","category":"调料"},{"name":"姜片","baseAmount":15,"unit":"g","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"老抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"鸡翅中洗净，用料酒、生抽、盐、白胡椒粉腌制15分钟。葱切段，姜切片。"},{"action":"cook","text":"锅中倒油烧热，放入姜片爆香，加入鸡翅中中火煎至两面金黄。"},{"action":"cook","text":"加入适量生抽、老抽调色，翻炒均匀后加入100ml热水，盖盖焖煮5分钟。"},{"action":"cook","text":"开盖大火收汁，最后撒入葱花翻炒出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"葱香鸡肉泥","action":"取鸡翅肉去皮打泥，加入少许原汤调味"},{"max_month":12,"name":"葱香鸡肉碎","action":"取鸡翅肉去皮切碎，搭配软饭"},{"max_month":36,"name":"宝宝葱油鸡块","action":"去皮，少盐，切小块，不加酱油"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/scallion_oil_chicken_wings.png"},
  {"id":"a-veg-38","name":"金沙玉米粒","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":10,"is_baby_friendly":true,"common_allergens":["蛋"],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":8,"ingredients":[{"name":"玉米粒","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"咸蛋黄","baseAmount":2,"unit":"个","category":"蛋类"},{"name":"蒜末","baseAmount":10,"unit":"g","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"咸蛋黄蒸熟捣碎，玉米粒解冻沥干，蒜切末。"},{"action":"cook","text":"锅中倒油烧热，放入蒜末爆香，加入咸蛋黄碎粒小火炒出金沙。"},{"action":"cook","text":"加入玉米粒翻炒，加入料酒、盐、白胡椒粉调味，中火翻炒2分钟至玉米粒断生即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"玉米泥","action":"玉米粒煮软打泥，不加咸蛋黄"},{"max_month":12,"name":"玉米蛋黄粒","action":"玉米粒煮软，加入少许蒸熟的普通蛋黄碎"},{"max_month":36,"name":"宝宝金沙玉米","action":"减少咸蛋黄用量，控制咸度"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/golden_sand_corn.png"},
  {"id":"a-soup-17","name":"白萝卜排骨汤","type":"adult","dish_type":"soup","taste":"slow_stew","meat":"pork","prep_time":15,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stew","cook_minutes":45,"ingredients":[{"name":"排骨","baseAmount":400,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"白萝卜","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"姜片","baseAmount":15,"unit":"g","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"排骨切段，焯水去血沫。白萝卜去皮切大块，姜切片。"},{"action":"cook","text":"锅中加入2000ml清水，放入排骨、姜片和料酒，大火煮沸后转小火炖20分钟。"},{"action":"cook","text":"加入白萝卜块，继续小火炖20分钟至萝卜软烂。最后加入盐和白胡椒粉调味即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"萝卜排骨泥","action":"取萝卜和排骨肉打泥，加入适量原汤调稀"},{"max_month":12,"name":"萝卜排骨糊","action":"萝卜和排骨肉切碎，加汤煮软烂"},{"max_month":36,"name":"宝宝萝卜排骨汤","action":"同大人版少盐，排骨切小块去骨"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/radish_pork_rib_soup.png"},
  {"id":"a-chi-11","name":"姜葱滑鸡丝","type":"adult","taste":"quick_stir_fry","meat":"chicken","prep_time":20,"is_baby_friendly":true,"common_allergens":["蛋"],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":10,"ingredients":[{"name":"鸡胸肉","baseAmount":300,"unit":"g","category":"肉类","sub_type":"chicken_breast"},{"name":"韭黄","baseAmount":100,"unit":"g","category":"蔬菜"},{"name":"姜丝","baseAmount":15,"unit":"g","category":"调料"},{"name":"葱段","baseAmount":20,"unit":"g","category":"调料"},{"name":"蛋清","baseAmount":1,"unit":"个","category":"蛋类"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"淀粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"鸡胸肉切成细丝，加入蛋清、料酒、生抽、白胡椒粉抓匀，最后加入淀粉上浆，腌制15分钟。韭黄切段，姜切丝，葱切段。"},{"action":"cook","text":"热锅凉油，爆香姜丝，加入腌制好的鸡丝中火快速翻炒至变色。"},{"action":"cook","text":"加入韭黄翻炒，适量盐调味，最后加入葱段大火快速翻炒30秒即可出锅，保持韭黄的脆嫩。"}],"baby_variant":{"stages":[{"max_month":8,"name":"姜汁鸡泥","action":"鸡丝蒸熟打泥，加入少许姜汁调味"},{"max_month":12,"name":"葱香鸡末","action":"鸡丝切碎蒸熟，加入少许葱花"},{"max_month":36,"name":"宝宝姜葱鸡丝","action":"同大人版少盐，确保鸡丝切细且充分熟透"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/ginger_scallion_chicken_strips.png"},
  {"id":"a-veg-40","name":"金针菇炒青菜","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":10,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":5,"ingredients":[{"name":"金针菇","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"青菜","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"蒜末","baseAmount":15,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蚝油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"金针菇洗净切除根部，青菜洗净切段，蒜切末备用。"},{"action":"cook","text":"热锅凉油，爆香蒜末，加入金针菇大火快速翻炒1分钟。"},{"action":"cook","text":"加入青菜，淋入生抽、蚝油，适量盐和白胡椒粉调味，大火快速翻炒1分钟即可出锅，保持蔬菜的翠绿和爽脆。"}],"baby_variant":{"stages":[{"max_month":8,"name":"菇菜泥","action":"金针菇青菜蒸熟打泥，去蒜末"},{"max_month":12,"name":"菇菜碎","action":"金针菇青菜切碎蒸熟，少许调味"},{"max_month":36,"name":"宝宝炒菇菜","action":"同大人版少盐，去蒜末，确保充分熟透"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/enoki_mushroom_greens.png"},
  {"id":"a-soup-18","name":"虫草花炖乌鸡汤","type":"adult","dish_type":"soup","taste":"slow_stew","meat":"chicken","prep_time":15,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stew","cook_minutes":90,"ingredients":[{"name":"乌鸡","baseAmount":500,"unit":"g","category":"肉类","sub_type":"black_chicken"},{"name":"虫草花","baseAmount":20,"unit":"g","category":"干货"},{"name":"枸杞","baseAmount":10,"unit":"g","category":"干货"},{"name":"红枣","baseAmount":4,"unit":"颗","category":"干货"},{"name":"姜片","baseAmount":3,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"乌鸡斩块，焯水去血沫。虫草花提前用温水泡发15分钟，枸杞、红枣洗净。"},{"action":"cook","text":"锅中加入2000ml清水，放入乌鸡和姜片，大火煮沸后转小火炖煮60分钟。"},{"action":"cook","text":"加入泡发的虫草花、枸杞、红枣，继续小火炖30分钟，最后加盐调味即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"乌鸡虫草泥","action":"取鸡肉打泥，加少许汤汁调稀"},{"max_month":12,"name":"乌鸡虫草粥","action":"取汤煮粥，加入剪碎的鸡肉"},{"max_month":36,"name":"宝宝乌鸡汤","action":"同大人版，少盐，取软烂鸡肉"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/cordyceps_black_chicken_soup.png"},
  {"id":"a-pork-11","name":"香菇炖排骨","type":"adult","taste":"slow_stew","meat":"pork","prep_time":15,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"stew","cook_minutes":45,"ingredients":[{"name":"排骨","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"香菇","baseAmount":200,"unit":"g","category":"蔬菜"},{"name":"姜片","baseAmount":3,"unit":"片","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"老抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"排骨切段，焯水去血沫。香菇洗净对半切，姜切片。"},{"action":"cook","text":"锅中放油，爆香姜片，放入排骨翻炒，加入料酒、生抽、老抽翻炒上色。"},{"action":"cook","text":"加入适量清水，大火煮沸后转小火炖30分钟，加入香菇继续炖15分钟，最后加盐和白胡椒粉调味。"}],"baby_variant":{"stages":[{"max_month":8,"name":"排骨香菇泥","action":"取肉和香菇分别打泥，加少许汤汁调稀"},{"max_month":12,"name":"排骨香菇粥","action":"取肉和香菇剪碎，加汤煮粥"},{"max_month":36,"name":"宝宝版炖排骨","action":"同大人版，少放调味料，挑选软烂小块"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/braised_pork_ribs_mushroom.png"},
  {"id":"a-veg-41","name":"香脆空炸花菜","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":8,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":12,"ingredients":[{"name":"花菜","baseAmount":400,"unit":"g","category":"蔬菜"},{"name":"橄榄油","baseAmount":15,"unit":"ml","category":"调料"},{"name":"蒜粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"花菜洗净切成小朵，控干水分。均匀涂抹橄榄油，撒上蒜粉、盐和黑胡椒。"},{"action":"cook","text":"空气炸锅预热180度。将花菜均匀摆放在炸篮中，注意不要重叠。"},{"action":"cook","text":"180度空炸10分钟，中途翻面一次，直至表面金黄酥脆。"}],"baby_variant":{"stages":[{"max_month":8,"name":"花菜泥","action":"花菜清蒸后打泥，无需调味"},{"max_month":12,"name":"花菜碎","action":"花菜清蒸后切碎，可加少许橄榄油"},{"max_month":36,"name":"宝宝花菜","action":"蒸至软烂，切小朵，少许橄榄油调味"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_air_fried_cauliflower.png"},
  {"id":"a-fish-11","name":"香酥空炸带鱼","type":"adult","taste":"quick_stir_fry","meat":"fish","prep_time":15,"is_baby_friendly":false,"common_allergens":["鱼"],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":12,"ingredients":[{"name":"带鱼","baseAmount":400,"unit":"g","category":"肉类","sub_type":"fish_hairtail"},{"name":"料酒","baseAmount":15,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":10,"unit":"ml","category":"调料"},{"name":"姜片","baseAmount":10,"unit":"g","category":"调料"},{"name":"干淀粉","baseAmount":20,"unit":"g","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"带鱼切段，用料酒、姜片、盐腌制15分钟去腥。沥干水分后裹上薄层淀粉。"},{"action":"cook","text":"空气炸锅预热180度。将带鱼均匀摆放，刷一层薄油。"},{"action":"cook","text":"空炸12分钟，中间翻面一次，最后撒上白胡椒粉。"}],"baby_variant":{"stages":[{"max_month":8,"name":"带鱼泥","action":"带鱼清蒸去刺打泥，确保无刺"},{"max_month":12,"name":"带鱼肉末","action":"带鱼清蒸去刺切碎，拌入粥中"},{"max_month":36,"name":"宝宝清蒸带鱼","action":"改为清蒸，去刺，只加少许盐调味"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_air_fried_hairtail.png"},
  {"id":"a-veg-42","name":"香酥空炸杏鲍菇","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":10,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":15,"ingredients":[{"name":"杏鲍菇","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"橄榄油","baseAmount":15,"unit":"ml","category":"调料"},{"name":"蒜粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"干淀粉","baseAmount":20,"unit":"g","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"杏鲍菇切片，厚度0.5厘米。用盐、蒜粉腌制10分钟，沥干后裹上薄层淀粉。"},{"action":"cook","text":"空气炸锅预热180度。杏鲍菇片刷橄榄油放入炸篮。"},{"action":"cook","text":"空炸15分钟，中间翻面一次，最后撒上黑胡椒。"}],"baby_variant":{"stages":[{"max_month":8,"name":"杏鲍菇泥","action":"杏鲍菇清蒸后打泥"},{"max_month":12,"name":"杏鲍菇丁","action":"杏鲍菇清蒸后切小丁"},{"max_month":36,"name":"宝宝杏鲍菇片","action":"清蒸后切片，少许橄榄油调味"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_air_fried_king_oyster_mushroom.png"},
  {"id":"a-chi-14","name":"蒜香蜂蜜鸡翅","type":"adult","taste":"quick_stir_fry","meat":"chicken","prep_time":10,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"sweet_sour","cook_type":"stir_fry","cook_minutes":15,"ingredients":[{"name":"鸡中翅","baseAmount":500,"unit":"g","category":"肉类","sub_type":"chicken_wing"},{"name":"蒜末","baseAmount":15,"unit":"g","category":"调料"},{"name":"蜂蜜","baseAmount":30,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":15,"unit":"ml","category":"调料"},{"name":"料酒","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"鸡翅洗净沥干，用生抽、料酒、盐、黑胡椒粉腌制15分钟。蒜剁成末备用。"},{"action":"cook","text":"空气炸锅预热200度。鸡翅表面擦干，刷一层油，放入炸篮。"},{"action":"cook","text":"200度烤8分钟，翻面后再烤7分钟至金黄。取出后趁热刷上蜂蜜蒜末混合酱，再送入空气炸锅180度烤2分钟上色。"}],"baby_variant":{"stages":[{"max_month":8,"name":"清蒸鸡肉泥","action":"鸡翅去骨清蒸后打泥，加少许原汤调味"},{"max_month":12,"name":"蒸鸡肉碎","action":"鸡肉去骨清蒸后剁碎，可拌入少许胡萝卜泥"},{"max_month":36,"name":"宝宝清蒸鸡翅","action":"去掉调味料，仅用盐清蒸，去骨后切小块"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_honey_chicken_wings.png"},
  {"id":"a-veg-43","name":"香脆杏鲍菇","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":5,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":12,"ingredients":[{"name":"杏鲍菇","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"橄榄油","baseAmount":15,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蒜粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"干香草","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"杏鲍菇纵向切成0.5cm厚片，用厨房纸吸干表面水分。"},{"action":"cook","text":"将杏鲍菇片均匀涂抹橄榄油，撒上盐、黑胡椒粉、蒜粉和干香草。"},{"action":"cook","text":"空气炸锅预热180度，将杏鲍菇片单层摆放，180度烤10分钟，中途翻面一次，直至两面金黄酥脆。"}],"baby_variant":{"stages":[{"max_month":8,"name":"杏鲍菇泥","action":"杏鲍菇清蒸后打泥，只加少许盐调味"},{"max_month":12,"name":"杏鲍菇条","action":"杏鲍菇切条清蒸，撒少许盐"},{"max_month":36,"name":"宝宝杏鲍菇片","action":"同大人版，减少调味料，只使用少许盐"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_king_oyster_mushroom.png"},
  {"id":"a-pork-13","name":"香煎五花肉","type":"adult","taste":"quick_stir_fry","meat":"pork","prep_time":5,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":15,"ingredients":[{"name":"五花肉","baseAmount":300,"unit":"g","category":"肉类","sub_type":"pork_belly"},{"name":"生抽","baseAmount":15,"unit":"ml","category":"调料"},{"name":"料酒","baseAmount":10,"unit":"ml","category":"调料"},{"name":"蒜粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"五花肉切成0.8cm厚片，用生抽、料酒、蒜粉、盐和黑胡椒腌制10分钟。"},{"action":"cook","text":"空气炸锅预热200度。将腌制好的五花肉片放入炸篮，注意不要重叠。"},{"action":"cook","text":"200度烤7分钟后翻面，继续烤6-8分钟至表面金黄酥脆，肉质鲜嫩。"}],"baby_variant":{"stages":[{"max_month":8,"name":"瘦肉泥","action":"使用瘦肉部分清蒸后打泥，加少许原汤调味"},{"max_month":12,"name":"瘦肉碎","action":"瘦肉清蒸后剁碎，可拌入蔬菜泥"},{"max_month":36,"name":"宝宝蒸肉片","action":"选用瘦肉部分清蒸，切小块，只加少许盐"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/crispy_pork_belly.png"},
  {"id":"a-veg-44","name":"椒盐玉米粒","type":"adult","taste":"quick_stir_fry","meat":"vegetable","prep_time":5,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":10,"ingredients":[{"name":"玉米粒","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"橄榄油","baseAmount":15,"unit":"ml","category":"调料"},{"name":"椒盐粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蒜粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"黑胡椒粉","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"玉米粒洗净沥干，用厨房纸吸干表面水分。"},{"action":"cook","text":"玉米粒拌入橄榄油，均匀撒上椒盐粉、蒜粉和黑胡椒粉。"},{"action":"cook","text":"空气炸锅预热180度，放入玉米粒，烤8-10分钟，中间翻动1-2次，直至表面金黄。"}],"baby_variant":{"stages":[{"max_month":8,"name":"玉米泥","action":"玉米粒清蒸后打泥，无需调味"},{"max_month":12,"name":"原味玉米粒","action":"玉米粒清蒸后直接食用"},{"max_month":36,"name":"宝宝版玉米粒","action":"同大人版，但不加椒盐，只使用少许橄榄油"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/salt_and_pepper_corn.png"},
  {"id":"a-beef-11","name":"黑椒牛肉粒","type":"adult","taste":"quick_stir_fry","meat":"beef","prep_time":10,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":12,"ingredients":[{"name":"牛里脊","baseAmount":300,"unit":"g","category":"肉类","sub_type":"beef_tenderloin"},{"name":"生抽","baseAmount":15,"unit":"ml","category":"调料"},{"name":"蚝油","baseAmount":10,"unit":"ml","category":"调料"},{"name":"黑胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"橄榄油","baseAmount":15,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"牛里脊切成2cm见方的小块，用生抽、蚝油、黑胡椒粉腌制15分钟。"},{"action":"cook","text":"空气炸锅预热200度。牛肉块表面刷一层橄榄油。"},{"action":"cook","text":"200度烤6分钟，翻面后再烤4-5分钟至表面焦香（三分熟），取出后撒适量盐调味。"}],"baby_variant":{"stages":[{"max_month":8,"name":"牛肉泥","action":"牛肉清蒸后打泥，加少许原汤调味"},{"max_month":12,"name":"牛肉碎","action":"牛肉清蒸后剁碎，可拌入蔬菜泥"},{"max_month":36,"name":"宝宝牛肉粒","action":"清蒸后切小块，只加少许盐调味"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/black_pepper_beef_cubes.png"},
  {"id":"af-chi-1","name":"空气炸锅蜜汁鸡翅","type":"adult","meat":"chicken","taste":"quick_stir_fry","flavor_profile":"sweet_sour","cook_type":"air_fryer","prep_time":5,"cook_minutes":18,"is_baby_friendly":true,"can_share_base":false,"is_airfryer_alt":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"鸡翅","baseAmount":400,"unit":"g","category":"肉类"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蜂蜜","baseAmount":0,"unit":"适量","category":"调料"},{"name":"姜片","baseAmount":2,"unit":"片","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"text":"鸡翅洗净划刀，加料酒、生抽、蜂蜜、姜片、盐腌制约 10 分钟。"},{"text":"放入空气炸锅，180 度烤 18 分钟。"},{"text":"中途翻面一次，取出即可。"}]},
  {"id":"af-pork-2","name":"空气炸锅蒜香排骨","type":"adult","meat":"pork","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"air_fryer","prep_time":5,"cook_minutes":18,"is_baby_friendly":true,"can_share_base":false,"is_airfryer_alt":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"排骨","baseAmount":350,"unit":"g","category":"肉类"},{"name":"蒜末","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"text":"排骨加蒜末、生抽、料酒、盐腌制 10 分钟。"},{"text":"放入空气炸锅，190 度 18 分钟。"},{"text":"中途翻面，取出即可。"}]},
  {"id":"af-beef-1","name":"空气炸锅黑椒牛肉粒","type":"adult","meat":"beef","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"air_fryer","prep_time":5,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"is_airfryer_alt":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"牛肉","baseAmount":300,"unit":"g","category":"肉类"},{"name":"黑胡椒","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"油","baseAmount":0,"unit":"少许","category":"调料"}],"steps":[{"text":"牛肉切粒，加黑胡椒、生抽、油拌匀。"},{"text":"放入空气炸锅，200 度 15 分钟，中途翻动。"},{"text":"取出即可。"}]},
  {"id":"af-fish-1","name":"空气炸锅香酥鳕鱼块","type":"adult","meat":"fish","taste":"quick_stir_fry","flavor_profile":"light","cook_type":"air_fryer","prep_time":5,"cook_minutes":15,"is_baby_friendly":true,"can_share_base":false,"is_airfryer_alt":true,"common_allergens":["鱼"],"base_serving":2,"ingredients":[{"name":"鳕鱼","baseAmount":250,"unit":"g","category":"肉类"},{"name":"淀粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"柠檬","baseAmount":0,"unit":"少许","category":"蔬菜"}],"steps":[{"text":"鳕鱼切块，裹薄淀粉，撒盐。"},{"text":"放入空气炸锅，180 度 15 分钟。"},{"text":"取出挤柠檬汁即可。"}]},
  {"id":"af-shrimp-1","name":"空气炸锅椒盐虾","type":"adult","meat":"shrimp","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"air_fryer","prep_time":3,"cook_minutes":12,"is_baby_friendly":true,"can_share_base":false,"is_airfryer_alt":true,"common_allergens":["虾"],"base_serving":2,"ingredients":[{"name":"虾","baseAmount":250,"unit":"g","category":"肉类"},{"name":"椒盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"料酒","baseAmount":0,"unit":"少许","category":"调料"}],"steps":[{"text":"虾洗净剪须，加料酒、椒盐拌匀。"},{"text":"放入空气炸锅，200 度 12 分钟，中途翻动。"},{"text":"取出即可。"}]},
  {"id":"af-veg-1","name":"空气炸锅蒜香杏鲍菇","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"salty_umami","cook_type":"air_fryer","prep_time":3,"cook_minutes":12,"is_baby_friendly":true,"can_share_base":true,"is_airfryer_alt":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"杏鲍菇","baseAmount":300,"unit":"g","category":"蔬菜"},{"name":"蒜末","baseAmount":0,"unit":"适量","category":"调料"},{"name":"生抽","baseAmount":0,"unit":"适量","category":"调料"},{"name":"油","baseAmount":0,"unit":"少许","category":"调料"}],"steps":[{"text":"杏鲍菇切条，加蒜末、生抽、油拌匀。"},{"text":"放入空气炸锅，180 度 12 分钟，中途翻动。"},{"text":"取出即可。"}]},
  {"id":"af-veg-2","name":"空气炸锅孜然土豆块","type":"adult","meat":"vegetable","taste":"quick_stir_fry","flavor_profile":"spicy","cook_type":"air_fryer","prep_time":5,"cook_minutes":15,"is_baby_friendly":false,"can_share_base":true,"is_airfryer_alt":true,"common_allergens":[],"base_serving":2,"ingredients":[{"name":"土豆","baseAmount":400,"unit":"g","category":"蔬菜"},{"name":"孜然粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"油","baseAmount":0,"unit":"少许","category":"调料"}],"steps":[{"text":"土豆切块，加孜然、盐、油拌匀。"},{"text":"放入空气炸锅，200 度 15 分钟。"},{"text":"中途翻动，表面金黄取出即可。"}]},
  {"id":"a-shrimp-8","name":"西芹炒虾仁","type":"adult","taste":"quick_stir_fry","meat":"shrimp","prep_time":10,"is_baby_friendly":true,"common_allergens":["虾"],"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":6,"ingredients":[{"name":"虾仁","baseAmount":200,"unit":"g","category":"肉类","sub_type":"shrimp"},{"name":"西芹","baseAmount":150,"unit":"g","category":"蔬菜","sub_type":"celery"},{"name":"胡萝卜","baseAmount":50,"unit":"g","category":"蔬菜","sub_type":"carrot"},{"name":"蒜末","baseAmount":10,"unit":"g","category":"调料"},{"name":"料酒","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":2,"unit":"g","category":"调料"},{"name":"白胡椒粉","baseAmount":0.5,"unit":"g","category":"调料"},{"name":"水淀粉","baseAmount":15,"unit":"ml","category":"调料"},{"name":"食用油","baseAmount":15,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"虾仁洗净沥干，用少许料酒和白胡椒粉抓匀腌制5分钟去腥。西芹撕去老筋，斜切成菱形段。胡萝卜去皮切成薄菱形片备用。"},{"action":"cook","text":"热锅倒入食用油，下蒜末爆香，放入虾仁大火滑炒至变色卷曲，约1分钟，盛出备用。"},{"action":"cook","text":"锅中留底油，下西芹段和胡萝卜片大火翻炒1分钟至断生，倒回虾仁，加盐调味，淋入水淀粉勾薄芡翻匀即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"虾仁西芹泥","action":"虾仁煮熟去壳去虾线，西芹焯水煮软，两者一同打成细腻泥糊"},{"max_month":12,"name":"虾仁西芹碎末","action":"虾仁切碎，西芹切极细末，焯水煮软后混合少许煮虾汤"},{"max_month":36,"name":"宝宝版西芹炒虾仁","action":"大人版少盐，虾仁切小块，西芹切小段，大火快炒至软烂"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/celery_stir_fried_shrimp.png"},
  {"id":"a-veg-45","name":"凉拌秋葵","type":"adult","taste":"steamed_salad","meat":"vegetable","prep_time":5,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"steam","cook_minutes":5,"ingredients":[{"name":"秋葵","baseAmount":250,"unit":"g","category":"蔬菜","sub_type":"okra"},{"name":"大蒜","baseAmount":15,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"香醋","baseAmount":10,"unit":"ml","category":"调料"},{"name":"香油","baseAmount":5,"unit":"ml","category":"调料"},{"name":"小米辣","baseAmount":10,"unit":"g","category":"调料"},{"name":"白芝麻","baseAmount":5,"unit":"g","category":"调料"},{"name":"盐","baseAmount":2,"unit":"g","category":"调料"}],"steps":[{"action":"prep","text":"秋葵洗净去蒂，放入沸水中焯烫2分钟至颜色翠绿，捞出立即过凉水保持脆嫩口感，沥干后对半切开摆入盘中。"},{"action":"cook","text":"调制凉拌汁：大蒜切末，小米辣切圈，放入小碗中，加入生抽、香醋、香油、少许盐和白芝麻混合均匀。"},{"action":"cook","text":"将调好的凉拌汁均匀淋在秋葵上即可食用，也可放入冰箱冷藏10分钟更入味。"}],"baby_variant":{"stages":[{"max_month":8,"name":"秋葵泥","action":"秋葵蒸熟去籽打成细腻泥糊，不加小米辣和醋，仅用少许生抽和香油调味"},{"max_month":12,"name":"秋葵碎末","action":"秋葵切极小丁蒸软烂，用上述调料（去辣）拌匀，或切小段与粥同煮"},{"max_month":36,"name":"宝宝版凉拌秋葵","action":"大人版去小米辣、少盐，秋葵整根或切段焯水后蘸少量生抽香油食用"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/cold_okra_salad.png"},
  {"id":"a-shrimp-9","name":"芦笋虾仁炒蛋","type":"adult","taste":"quick_stir_fry","meat":"shrimp","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":8,"ingredients":[{"name":"鲜虾仁","baseAmount":150,"unit":"g","category":"海鲜","sub_type":"shrimp"},{"name":"芦笋","baseAmount":150,"unit":"g","category":"蔬菜","sub_type":"asparagus"},{"name":"鸡蛋","baseAmount":3,"unit":"个","category":"蛋类","sub_type":"egg"},{"name":"蒜末","baseAmount":8,"unit":"g","category":"调料","sub_type":"garlic"},{"name":"橄榄油","baseAmount":15,"unit":"ml","category":"调料","sub_type":"oil"},{"name":"盐","baseAmount":2,"unit":"g","category":"调料","sub_type":"salt"},{"name":"现磨黑胡椒","baseAmount":0.5,"unit":"g","category":"调料","sub_type":"pepper"}],"steps":[{"action":"prep","text":"虾仁去虾线洗净，用厨房纸吸干水分备用。芦笋洗净后削去老根，切成5cm长的斜段。鸡蛋打入碗中，加少许盐打散成蛋液。"},{"action":"cook","text":"热锅倒入10ml橄榄油，中火将蛋液倒入锅中，待底部凝固后用铲子轻轻划散，炒至七成熟盛出备用。"},{"action":"cook","text":"锅中再加5ml橄榄油，放入蒜末爆香，加入芦笋大火翻炒2分钟至颜色翠绿微软。"},{"action":"cook","text":"倒入虾仁大火快炒1分钟至变红弯曲，加入炒蛋、盐和黑胡椒快速翻匀，30秒内出锅即可。"}],"baby_variant":{"stages":[{"max_month":8,"name":"芦笋虾仁蛋花糊","action":"芦笋去皮煮软，虾仁煮熟切碎，与蛋黄泥混合加少许温水调成顺滑糊状"},{"max_month":12,"name":"芦笋虾仁蛋碎末","action":"芦笋煮软切碎末，虾仁切碎，鸡蛋打散一同炒至全熟软烂，少盐调味"},{"max_month":36,"name":"宝宝芦笋虾仁炒蛋","action":"同大人版少油少盐，芦笋切小丁，虾仁切小块，确保熟透软烂"}]},"common_allergens":[],"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/asparagus_shrimp_egg_stir_fry.png"},
  {"id":"a-veg-46","name":"魔芋凉拌荞麦面","type":"adult","taste":"steamed_salad","meat":"vegetable","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"flavor_profile":"sour_fresh","cook_type":"steam","cook_minutes":5,"ingredients":[{"name":"魔芋结","baseAmount":200,"unit":"g","category":"蔬菜","sub_type":"konjac_noodle"},{"name":"荞麦面","baseAmount":80,"unit":"g","category":"主食","sub_type":"buckwheat_noodle"},{"name":"黄瓜","baseAmount":100,"unit":"g","category":"蔬菜","sub_type":"cucumber"},{"name":"胡萝卜","baseAmount":50,"unit":"g","category":"蔬菜","sub_type":"carrot"},{"name":"香菜","baseAmount":10,"unit":"g","category":"蔬菜","sub_type":"cilantro"},{"name":"蒜末","baseAmount":10,"unit":"g","category":"调料","sub_type":"garlic"},{"name":"小米辣","baseAmount":5,"unit":"g","category":"调料","sub_type":"chili"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料","sub_type":"soy_sauce"},{"name":"香醋","baseAmount":15,"unit":"ml","category":"调料","sub_type":"vinegar"},{"name":"香油","baseAmount":5,"unit":"ml","category":"调料","sub_type":"sesame_oil"},{"name":"白芝麻","baseAmount":5,"unit":"g","category":"调料","sub_type":"sesame"}],"steps":[{"action":"prep","text":"魔芋结用清水冲洗两遍后沥干。荞麦面按包装说明煮熟，捞出过凉水沥干备用。黄瓜洗净切细丝，胡萝卜去皮切细丝，小米辣切圈，香菜洗净切段。"},{"action":"cook","text":"调制凉拌汁：蒜末、小米辣圈放入碗中，加入生抽、香醋、香油混合均匀。喜欢更酸的可以增加香醋比例。"},{"action":"cook","text":"将魔芋结和荞麦面放入大碗中，加入黄瓜丝和胡萝卜丝，淋入调好的凉拌汁，撒上白芝麻和香菜段。"},{"action":"cook","text":"用筷子从底部向上翻拌均匀，使每根面条都裹满酱汁，静置2分钟入味后即可享用。"}],"baby_variant":{"stages":[{"max_month":8,"name":"魔芋荞麦面糊","action":"魔芋煮软切碎，荞麦面煮极烂剪成小段，黄瓜胡萝卜切极细碎末，混合不加醋和辣"},{"max_month":12,"name":"魔芋荞麦面碎末","action":"魔芋切小丁，荞麦面剪小段，黄瓜胡萝卜切细丝，用生抽和香油调味不加醋和辣"},{"max_month":36,"name":"宝宝魔芋凉拌面","action":"同大人版，但去掉小米辣，醋和辣椒酱减量或不加，确保面条软烂易嚼"}]},"common_allergens":[],"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/konjac_buckwheat_cold_noodle.png"},
  {"id":"a-chi-16","name":"黄瓜木耳炒鸡丁","type":"adult","taste":"quick_stir_fry","meat":"chicken","prep_time":15,"is_baby_friendly":true,"can_share_base":true,"flavor_profile":"light","cook_type":"stir_fry","cook_minutes":10,"ingredients":[{"name":"鸡胸肉","baseAmount":200,"unit":"g","category":"肉类","sub_type":"chicken_breast"},{"name":"黄瓜","baseAmount":150,"unit":"g","category":"蔬菜","sub_type":"cucumber"},{"name":"干木耳","baseAmount":30,"unit":"g","category":"干货","sub_type":"dried_wood_ear"},{"name":"胡萝卜","baseAmount":50,"unit":"g","category":"蔬菜","sub_type":"carrot"},{"name":"蒜末","baseAmount":10,"unit":"g","category":"调料","sub_type":"garlic"},{"name":"姜末","baseAmount":5,"unit":"g","category":"调料","sub_type":"ginger"},{"name":"生抽","baseAmount":15,"unit":"ml","category":"调料","sub_type":"soy_sauce"},{"name":"料酒","baseAmount":10,"unit":"ml","category":"调料","sub_type":"cooking_wine"},{"name":"蚝油","baseAmount":10,"unit":"ml","category":"调料","sub_type":"oyster_sauce"},{"name":"玉米淀粉","baseAmount":8,"unit":"g","category":"调料","sub_type":"starch"},{"name":"盐","baseAmount":2,"unit":"g","category":"调料","sub_type":"salt"},{"name":"香油","baseAmount":5,"unit":"ml","category":"调料","sub_type":"sesame_oil"}],"steps":[{"action":"prep","text":"干木耳提前2小时用温水泡发，洗净后撕成小片。鸡胸肉切成1.5cm见方的丁，加入料酒、少许盐和淀粉抓匀腌制10分钟。黄瓜洗净切1cm的小丁，胡萝卜去皮切小丁备用。"},{"action":"cook","text":"调制碗汁：生抽、蚝油、少许盐和香油混合，再加少许水淀粉调匀备用。"},{"action":"cook","text":"热锅倒入少许油，中火将鸡丁滑炒至变色约八成熟，盛出备用。锅中再加少许油，放入姜末蒜末爆香。"},{"action":"cook","text":"倒入胡萝卜丁和木耳大火翻炒2分钟，加入黄瓜丁和鸡丁，淋入调好的碗汁快速翻匀，大火收汁30秒出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"黄瓜木耳鸡胸泥","action":"鸡胸肉蒸熟打泥，黄瓜煮软去籽，木耳煮软切碎，三者混合成细腻糊状"},{"max_month":12,"name":"黄瓜木耳鸡碎末","action":"鸡胸肉切碎，黄瓜去籽切极细碎末，木耳切碎，与软粥或碎面条同煮"},{"max_month":36,"name":"宝宝黄瓜木耳鸡丁","action":"同大人版少盐少油，鸡胸和蔬菜均切小丁，确保软烂易嚼"}]},"common_allergens":[],"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/cucumber_wood_ear_chicken_stir_fry.png"},
  {"id":"a-veg-50","name":"凉拌海带丝","type":"adult","taste":"steamed_salad","meat":"vegetable","prep_time":12,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"salad","cook_minutes":5,"ingredients":[{"name":"干海带丝","baseAmount":60,"unit":"g","category":"干货","sub_type":"kelp"},{"name":"胡萝卜","baseAmount":80,"unit":"g","category":"蔬菜","sub_type":"carrot"},{"name":"大蒜","baseAmount":4,"unit":"瓣","category":"调料"},{"name":"香菜","baseAmount":15,"unit":"g","category":"蔬菜"},{"name":"小米辣","baseAmount":2,"unit":"个","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"香醋","baseAmount":12,"unit":"ml","category":"调料"},{"name":"香油","baseAmount":8,"unit":"ml","category":"调料"},{"name":"白糖","baseAmount":5,"unit":"g","category":"调料"},{"name":"熟芝麻","baseAmount":8,"unit":"g","category":"调料"}],"steps":[{"action":"prep","text":"干海带丝提前用清水泡发30分钟至完全舒展，搓洗去表面盐分和杂质，胡萝卜切细丝，香菜切段，蒜切末，小米辣切圈。"},{"action":"cook","text":"烧一锅开水，先放入海带丝焯烫2分钟去腥，再放入胡萝卜丝焯烫30秒至微软，捞出立即过凉水充分沥干。"},{"action":"cook","text":"调制拌汁：蒜末加生抽、香醋、白糖、香油混合搅匀，喜欢酸辣可加入小米辣圈。"},{"action":"cook","text":"将海带丝和胡萝卜丝放入大碗，淋入拌汁撒上香菜段和芝麻翻拌均匀，冷藏10分钟后食用风味更佳。"}],"baby_variant":{"stages":[{"max_month":8,"name":"海带泥糊","action":"海带煮极软后打成细腻泥状，胡萝卜也煮软打泥混合，不加调料"},{"max_month":12,"name":"海带碎末","action":"海带和胡萝卜切极细碎末，加少许香油调味"},{"max_month":36,"name":"宝宝凉拌海带丝","action":"同大人版少盐醋，海带和胡萝卜切细丝，煮软后拌匀"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/cold_kelp_noodles_salad.png"},
  {"id":"a-soup-19","name":"糖醋排骨","type":"adult","dish_type":"soup","taste":"sweet_sour","meat":"pork","prep_time":20,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"sweet_sour","cook_type":"stew","cook_minutes":35,"ingredients":[{"name":"肋排","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"料酒","baseAmount":15,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"香醋","baseAmount":30,"unit":"ml","category":"调料"},{"name":"白糖","baseAmount":40,"unit":"g","category":"调料"},{"name":"番茄酱","baseAmount":25,"unit":"g","category":"调料"},{"name":"盐","baseAmount":3,"unit":"g","category":"调料"},{"name":"葱","baseAmount":20,"unit":"g","category":"调料"},{"name":"姜","baseAmount":15,"unit":"g","category":"调料"},{"name":"白芝麻","baseAmount":5,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":15,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"肋排剁成约 5cm 小段，用清水浸泡 30 分钟去血水后沥干。冷水下锅焯水，加入料酒和葱姜，大火煮开后撇去浮沫，捞出用温水冲洗干净，沥干备用。"},{"action":"cook","text":"调制糖醋汁：取一小碗，加入生抽、香醋、白糖、番茄酱和少许盐，再加入 80ml 清水搅匀备用。"},{"action":"cook","text":"锅烧热加入食用油，放入排骨中火煎至两面金黄（约 4 分钟），倒入调好的糖醋汁，大火煮开后转小火焖煮 20 分钟。"},{"action":"cook","text":"待排骨熟透、汤汁浓稠时，转大火快速翻匀，使排骨均匀裹上糖醋汁，撒上白芝麻即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"糖醋排骨泥","action":"排骨煮软烂后剔骨，肉质打泥，加入少量醋调味（宝宝专用），不加糖或极少"},{"max_month":12,"name":"糖醋排骨碎","action":"排骨煮至软烂，肉质拆碎，番茄煮软打泥混合，酸甜味减半"},{"max_month":36,"name":"宝宝糖醋排骨","action":"同大人版，糖醋量减半，焖煮更软烂，确保无骨"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/sweet_and_sour_pork_ribs.png"},
  {"id":"a-pork-16","name":"豆豉蒸排骨","type":"adult","taste":"steamed_salad","meat":"pork","prep_time":20,"is_baby_friendly":true,"common_allergens":["豆类"],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"steam","cook_minutes":20,"ingredients":[{"name":"肋排","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"阳江豆豉","baseAmount":30,"unit":"g","category":"干货"},{"name":"生抽","baseAmount":15,"unit":"ml","category":"调料"},{"name":"蚝油","baseAmount":10,"unit":"ml","category":"调料"},{"name":"料酒","baseAmount":10,"unit":"ml","category":"调料"},{"name":"白糖","baseAmount":5,"unit":"g","category":"调料"},{"name":"生粉","baseAmount":15,"unit":"g","category":"调料"},{"name":"葱","baseAmount":20,"unit":"g","category":"调料"},{"name":"姜","baseAmount":15,"unit":"g","category":"调料"},{"name":"蒜","baseAmount":15,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":15,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"肋排剁成约 3cm 小段，用清水浸泡 15 分钟去血水后沥干，用厨房纸吸干表面水分。"},{"action":"prep","text":"豆豉用刀剁碎，葱切葱花，姜切姜末，蒜剁蒜末。锅烧热油，将姜末、蒜末、豆豉碎爆香约 1 分钟盛出。"},{"action":"prep","text":"排骨放入大碗，加入爆香的豆鼓姜蒜蓉，再加入生抽、蚝油、料酒、白糖和生粉抓匀，最后加入少许食用油封面腌制 15 分钟。"},{"action":"cook","text":"将腌好的排骨平铺在盘中，水开后放入蒸锅，大火蒸 18 分钟至排骨脱骨，撒上葱花即可上桌。"}],"baby_variant":{"stages":[{"max_month":8,"name":"豆豉排骨泥","action":"排骨蒸至完全软烂，剔骨打泥，不加豆豉，用少量生抽调味"},{"max_month":12,"name":"豆豉排骨碎","action":"排骨蒸软后拆碎，拌入少量蒸出的汤汁，去掉豆豉颗粒"},{"max_month":36,"name":"宝宝豆豉蒸排骨","action":"同大人版，豆豉量减半，生抽蚝油减量，蒸至软烂脱骨"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/black_bean_steamed_pork_ribs.png"},
  {"id":"a-pork-17","name":"椒盐排骨","type":"adult","taste":"quick_stir_fry","meat":"pork","prep_time":25,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":20,"ingredients":[{"name":"肋排","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"鸡蛋","baseAmount":1,"unit":"个","category":"蛋类"},{"name":"生粉","baseAmount":50,"unit":"g","category":"调料"},{"name":"料酒","baseAmount":15,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":5,"unit":"g","category":"调料"},{"name":"白胡椒粉","baseAmount":3,"unit":"g","category":"调料"},{"name":"椒盐粉","baseAmount":8,"unit":"g","category":"调料"},{"name":"蒜","baseAmount":20,"unit":"g","category":"调料"},{"name":"葱","baseAmount":15,"unit":"g","category":"调料"},{"name":"红椒","baseAmount":15,"unit":"g","category":"蔬菜"},{"name":"食用油","baseAmount":500,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"肋排剁成约 4cm 小段，用清水浸泡 20 分钟去血水后沥干，用厨房纸吸干水分，加入料酒、生抽、盐、白胡椒粉腌制 15 分钟。"},{"action":"prep","text":"腌制好的排骨加入鸡蛋液和生粉抓匀，使每块排骨均匀裹上面糊。蒜剁蒜末，葱切葱花，红椒切小丁备用。"},{"action":"cook","text":"锅中倒入足量食用油烧至六成热（约 160℃），下入排骨中火炸至定型浮起（约 3 分钟），捞出沥油。"},{"action":"cook","text":"转大火将油温升至七成热（约 200℃），放入排骨复炸 1 分钟至表面金黄酥脆，捞出沥油。"},{"action":"cook","text":"锅留底油，下蒜末爆香，倒入排骨撒入椒盐粉快速翻匀，最后撒上葱花和红椒丁即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"排骨肉泥","action":"排骨煮软烂后剔骨，肉质打泥，不加任何调料"},{"max_month":12,"name":"排骨肉碎","action":"排骨煮至极软，肉质拆碎，拌入软烂面条或粥中"},{"max_month":36,"name":"宝宝版清蒸排骨","action":"此道菜不适合宝宝食用，建议用清蒸排骨替代，取未调味部分"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/szechuan_pepper_pork_ribs.png"},
  {"id":"a-pork-18","name":"话梅排骨","type":"adult","taste":"sweet_sour","meat":"pork","prep_time":20,"is_baby_friendly":true,"common_allergens":["话梅"],"can_share_base":true,"flavor_profile":"sweet_sour","cook_type":"stew","cook_minutes":45,"ingredients":[{"name":"肋排","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"九制话梅","baseAmount":10,"unit":"颗","category":"干货"},{"name":"料酒","baseAmount":20,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":15,"unit":"ml","category":"调料"},{"name":"香醋","baseAmount":20,"unit":"ml","category":"调料"},{"name":"冰糖","baseAmount":30,"unit":"g","category":"调料"},{"name":"盐","baseAmount":2,"unit":"g","category":"调料"},{"name":"葱","baseAmount":20,"unit":"g","category":"调料"},{"name":"姜","baseAmount":15,"unit":"g","category":"调料"},{"name":"八角","baseAmount":2,"unit":"颗","category":"调料"},{"name":"桂皮","baseAmount":5,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":10,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"肋排剁成约 5cm 小段，用清水浸泡 30 分钟去血水后沥干。冷水下锅焯水，加入料酒和葱姜，大火煮开后撇去浮沫，捞出用温水冲洗干净沥干。"},{"action":"prep","text":"话梅用温水浸泡 10 分钟至软化备用。冰糖敲碎，葱打结，姜切片。"},{"action":"cook","text":"锅烧热加入少许油，放入冰糖小火慢炒至糖色变成琥珀色并起小泡，倒入排骨快速翻炒，使排骨均匀裹上糖色（约 2 分钟）。"},{"action":"cook","text":"加入葱结、姜片、八角、桂皮和话梅（连同浸泡的水），倒入生抽、香醋和少许盐，大火煮开后转小火焖煮 35 分钟。"},{"action":"cook","text":"待排骨软烂、汤汁浓稠时，转大火快速收汁，翻匀使排骨裹满酸甜的话梅汁即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"话梅排骨泥","action":"排骨煮软烂后剔骨打泥，话梅去除，只取肉泥，不加糖醋"},{"max_month":12,"name":"话梅排骨碎","action":"排骨煮至极软拆碎，拌入少量番茄泥增味，话梅去核后极少量取酸味"},{"max_month":36,"name":"宝宝话梅排骨","action":"同大人版，话梅量减半，冰糖量减半，醋减量，焖煮至软烂脱骨"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/preserved_plum_pork_ribs.png"},
  {"id":"a-veg-51","name":"香椿煎蛋","type":"adult","taste":"steamed_salad","meat":"vegetable","prep_time":10,"is_baby_friendly":true,"common_allergens":["蛋"],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":5,"ingredients":[{"name":"香椿","baseAmount":150,"unit":"g","category":"蔬菜","sub_type":"vegetable"},{"name":"鸡蛋","baseAmount":3,"unit":"个","category":"蛋类"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"香椿洗净，沸水焯烫1分钟至颜色变深绿，捞出沥干水分，切成0.5cm小段。鸡蛋打散成蛋液，加入少许盐调匀。"},{"action":"cook","text":"平底锅烧热后倒入适量油，转中火。将香椿段倒入蛋液中轻轻拌匀，待锅热后将混合蛋液倒入，摊成圆形蛋饼。底面煎至金黄（约1分钟）后翻面，继续煎约1分钟至两面金黄熟透，出锅装盘。"}],"baby_variant":{"stages":[{"max_month":8,"name":"香椿蛋黄泥","action":"只取熟蛋黄压泥，香椿焯水后取嫩叶切碎，两者混合加少量温水调成泥状"},{"max_month":12,"name":"香椿碎蛋羹","action":"香椿焯水切碎，鸡蛋打散加温水1:1.5蒸成蛋羹，出锅后撒上香椿碎"},{"max_month":36,"name":"宝宝香椿煎蛋","action":"同大人版，香椿切细碎，鸡蛋少放，煎时少油不加盐或极少量盐"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/toon_煎蛋.png"},
  {"id":"a-pork-19","name":"蚕豆炒火腿","type":"adult","taste":"quick_stir_fry","meat":"pork","prep_time":10,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":8,"ingredients":[{"name":"新鲜蚕豆","baseAmount":300,"unit":"g","category":"蔬菜","sub_type":"vegetable"},{"name":"云南火腿","baseAmount":80,"unit":"g","category":"肉类","sub_type":"pork_ham"},{"name":"蒜","baseAmount":2,"unit":"瓣","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"蚕豆剥去外壳及内皮，只取嫩豆瓣，洗净沥干水分。云南火腿切成0.5cm见方的小丁，蒜瓣拍碎切末。"},{"action":"cook","text":"炒锅烧热后倒入适量油，下火腿丁小火煸炒至出油且边缘微焦（约2分钟），放入蒜末爆香。转大火，下蚕豆快速翻炒约3分钟，沿锅边淋入少许清水，盖锅盖焖2分钟至蚕豆完全熟透但仍保持翠绿。加适量盐调味，翻匀出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"蚕豆瓣泥","action":"蚕豆煮熟后去皮取豆瓣，用料理机打成细腻泥状，火腿取少量切碎蒸软后混入"},{"max_month":12,"name":"蚕豆碎末","action":"蚕豆煮熟去皮切碎，火腿切细碎，锅中少油翻炒至软烂，可拌入粥或软面条"},{"max_month":36,"name":"宝宝蚕豆火腿","action":"同大人版，火腿切小丁，蚕豆煮软，盐减量"}]},"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/fava_bean_火腿_stir_fry.png"},
  {"id":"a-soup-20","name":"清炖羊肉萝卜汤","type":"adult","dish_type":"soup","taste":"slow_stew","meat":"lamb","prep_time":10,"is_baby_friendly":true,"common_allergens":[],"can_share_base":true,"flavor_profile":"light","cook_type":"stew","cook_minutes":90,"ingredients":[{"name":"羊腿肉","baseAmount":400,"unit":"g","category":"肉类","sub_type":"lamb_leg"},{"name":"白萝卜","baseAmount":300,"unit":"g","category":"蔬菜","sub_type":"radish"},{"name":"姜","baseAmount":15,"unit":"g","category":"调料"},{"name":"料酒","baseAmount":20,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"香菜","baseAmount":10,"unit":"g","category":"蔬菜"}],"steps":[{"action":"prep","text":"羊腿肉切3cm见方的块，冷水下锅，加料酒、姜片焯水去腥，水开后撇去浮沫，捞出洗净备用。白萝卜去皮切2cm见方的块，香菜切碎备用。"},{"action":"cook","text":"砂锅内放入羊肉块、姜片，加入足量清水（没过羊肉约3cm），大火烧开后转小火慢炖1小时。"},{"action":"cook","text":"加入白萝卜块，继续小火炖煮30分钟至萝卜透明软烂，加入适量盐、白胡椒粉调味，撒上香菜即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"羊肉萝卜泥汤","action":"取炖好的羊肉去筋剁泥，白萝卜压泥，过滤部分清汤，两者混合成稠泥状"},{"max_month":12,"name":"羊肉萝卜碎末汤","action":"羊肉切小碎丁，白萝卜切小碎丁，小火煮成软烂的稠汤"},{"max_month":36,"name":"宝宝羊肉萝卜汤","action":"同大人版少盐，羊肉切小块，白萝卜切小块，煮至软烂"}]},"tags":["soup","comfort","high_protein","hearty"],"ingredient_group":"lamb_leg","base_serving":2},
  {"id":"a-lamb-2","name":"孜然羊肉串（平底锅版）","type":"adult","taste":"quick_stir_fry","meat":"lamb","prep_time":10,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"spicy","spicy_sub":"xiangla","cook_type":"stir_fry","cook_minutes":10,"ingredients":[{"name":"羊腿肉","baseAmount":350,"unit":"g","category":"肉类","sub_type":"lamb_leg"},{"name":"孜然粒","baseAmount":8,"unit":"g","category":"调料"},{"name":"孜然粉","baseAmount":5,"unit":"g","category":"调料"},{"name":"辣椒粉","baseAmount":5,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"料酒","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白芝麻","baseAmount":5,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"葱","baseAmount":15,"unit":"g","category":"蔬菜"}],"steps":[{"action":"prep","text":"羊腿肉去筋膜，切成约1.5cm见方的小丁，加入料酒、生抽、盐抓匀腌制10分钟。孜然粒用小火干炒出香味后捣碎，葱切碎备用。"},{"action":"cook","text":"平底锅烧热，加入适量油，油温六成热时放入羊肉丁，中火快速翻炒至表面变色。"},{"action":"cook","text":"加入孜然粒碎、孜然粉、辣椒粉，大火快速翻炒均匀，让调料充分裹在羊肉表面，撒入白芝麻和葱花翻匀出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"羊肉孜然泥","action":"取炖软的羊肉去筋打泥，加少量孜然粉（去辣椒）调味，与米糊混合"},{"max_month":12,"name":"宝宝孜然羊肉丁","action":"羊肉切极小丁，少孜然粉不加辣椒粉，小火炒软，与粥或面条同食"},{"max_month":36,"name":"宝宝版孜然羊肉","action":"同大人版制作，去辣椒粉，少盐少油，孜然粉减量"}]},"tags":["quick","spicy","high_protein","late_night","party"],"base_serving":2},
  {"id":"a-duck-1","name":"啤酒鸭","type":"adult","taste":"slow_stew","meat":"duck","prep_time":15,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stew","cook_minutes":60,"ingredients":[{"name":"鸭腿","baseAmount":500,"unit":"g","category":"肉类","sub_type":"duck_leg"},{"name":"啤酒","baseAmount":330,"unit":"ml","category":"其他"},{"name":"姜","baseAmount":15,"unit":"g","category":"调料"},{"name":"蒜","baseAmount":10,"unit":"g","category":"调料"},{"name":"八角","baseAmount":2,"unit":"个","category":"调料"},{"name":"桂皮","baseAmount":5,"unit":"g","category":"调料"},{"name":"干辣椒","baseAmount":5,"unit":"g","category":"调料"},{"name":"生抽","baseAmount":30,"unit":"ml","category":"调料"},{"name":"老抽","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"冰糖","baseAmount":15,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"鸭腿斩成3cm见方的块，冷水下锅加姜片、料酒焯水，水开后撇去浮沫，捞出洗净备用。姜切片，蒜整颗拍破，干辣椒剪成段。"},{"action":"cook","text":"锅烧热加底油，放入冰糖小火炒至融化呈琥珀色，下鸭块快速翻炒至表面裹上糖色，加入姜片、蒜、八角、桂皮、干辣椒段炒出香味。"},{"action":"cook","text":"沿锅边淋入生抽、老抽翻炒上色，倒入啤酒没过鸭块，大火烧开后转小火加盖焖煮45分钟，期间翻动一次。"},{"action":"cook","text":"待汤汁浓稠至剩1/3时，大火收汁，加适量盐调味，翻匀出锅装盘。"}],"baby_variant":{"stages":[{"max_month":8,"name":"鸭肉土豆泥","action":"取炖软的鸭肉去皮去骨剁泥，搭配蒸熟的土豆泥混合"},{"max_month":12,"name":"鸭肉碎末粥","action":"鸭肉切碎煮粥，去啤酒只用少量酱油调味，煮至软烂"},{"max_month":36,"name":"宝宝版啤酒鸭","action":"鸭肉切小块，用少量酱油、糖、葱姜水代替啤酒炖煮至软烂"}]},"tags":["hearty","high_protein","comfort","party"],"base_serving":2},
  {"id":"a-duck-2","name":"姜母鸭（闽南风味）","type":"adult","taste":"slow_stew","meat":"duck","prep_time":15,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stew","cook_minutes":75,"ingredients":[{"name":"鸭肉","baseAmount":600,"unit":"g","category":"肉类","sub_type":"duck"},{"name":"老姜","baseAmount":200,"unit":"g","category":"调料"},{"name":"麻油","baseAmount":50,"unit":"ml","category":"调料"},{"name":"八角","baseAmount":2,"unit":"个","category":"调料"},{"name":"桂皮","baseAmount":5,"unit":"g","category":"调料"},{"name":"香叶","baseAmount":2,"unit":"片","category":"调料"},{"name":"当归","baseAmount":5,"unit":"g","category":"干货"},{"name":"枸杞","baseAmount":10,"unit":"g","category":"干货"},{"name":"生抽","baseAmount":30,"unit":"ml","category":"调料"},{"name":"老抽","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"冰糖","baseAmount":20,"unit":"g","category":"调料"},{"name":"料酒","baseAmount":20,"unit":"ml","category":"调料"}],"steps":[{"action":"prep","text":"鸭肉斩成3cm见方的块，冷水下锅加料酒、姜片焯水去腥，捞出洗净备用。老姜洗净，带皮切成0.3cm厚的片。当归、枸杞用温水泡软备用。"},{"action":"cook","text":"砂锅烧热，放入麻油，小火将姜片煎至两面金黄起皱，充分释放姜香。"},{"action":"cook","text":"放入鸭块翻炒至表面微黄，加入八角、桂皮、香叶、当归继续翻炒2分钟，沿锅边淋入生抽、老抽，加冰糖翻炒上色。"},{"action":"cook","text":"加入足量开水（没过鸭块约2cm），大火烧开后转小火加盖焖煮60分钟，期间翻动一次。"},{"action":"cook","text":"加入泡软的枸杞再煮5分钟，加适量盐调味，大火收汁至汤汁浓稠即可出锅。"}],"baby_variant":{"stages":[{"max_month":8,"name":"鸭肉姜泥","action":"取炖软的鸭肉去皮去骨剁泥，老姜煮软取汁，与鸭泥混合"},{"max_month":12,"name":"宝宝姜汁鸭肉","action":"鸭肉切碎，老姜煮水（去辣），用姜水煮粥或煮烂"},{"max_month":36,"name":"宝宝版姜母鸭","action":"鸭肉切小块，少姜片不加药材，用少量酱油、冰糖炖煮至软烂"}]},"tags":["hearty","high_protein","comfort"],"base_serving":2},
  {"id":"a-pork-20","name":"蒜香椒盐排骨","type":"adult","taste":"quick_stir_fry","meat":"pork","prep_time":15,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":25,"ingredients":[{"name":"猪肋排","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"大蒜","baseAmount":30,"unit":"g","category":"蔬菜","sub_type":"garlic"},{"name":"葱","baseAmount":10,"unit":"g","category":"蔬菜","sub_type":"scallion"},{"name":"姜","baseAmount":10,"unit":"g","category":"蔬菜","sub_type":"ginger"},{"name":"料酒","baseAmount":15,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"蚝油","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白糖","baseAmount":5,"unit":"g","category":"调料"},{"name":"胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"椒盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"干淀粉","baseAmount":30,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"肋排剁成约3-4cm长的小段，洗净后用清水浸泡30分钟去血水，捞出沥干。大蒜切末，葱切葱花，姜切末备用。","duration_num":10},{"action":"prep","text":"排骨放入盆中，加料酒、生抽、蚝油、盐、白糖、胡椒粉抓匀腌制20分钟。腌制完成后撒入干淀粉，使每块排骨均匀裹上薄薄的淀粉浆。","duration_num":20},{"action":"cook","text":"锅中倒入足量食用油，烧至六成热（约160℃，插入筷子周围冒小泡），下排骨中火炸约5分钟至表面金黄定型，捞出控油。","duration_num":5},{"action":"cook","text":"将油温升至八成热（约180℃），下排骨复炸1-2分钟至外皮酥脆，捞出沥油。","duration_num":2},{"action":"cook","text":"锅中留底油，下蒜末、姜末小火炒香，倒入炸好的排骨快速翻匀，撒入适量椒盐和葱花，翻炒均匀后立即出锅。","duration_num":2}],"baby_variant":{"stages":[{"max_month":8,"name":"排骨蒜香泥","action":"取炸好的排骨，去除表面酥脆部分，取内部软烂肉质剁成泥，加少量煮软的蒜泥混合"},{"max_month":12,"name":"蒜香排骨碎末","action":"排骨清蒸至软烂，去骨切碎，蒜末加水蒸软后拌入，少盐调味"},{"max_month":36,"name":"宝宝版蒜香排骨","action":"排骨改为少油煎或蒸制，不加椒盐，蒜香味减淡，剪成小块食用"}]},"tags":["high_protein","party","salty_umami","stir_fry"],"base_serving":2,"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_salt_ribs.png"},
  {"id":"a-pork-20","name":"蒜香椒盐排骨","type":"adult","taste":"quick_stir_fry","meat":"pork","prep_time":15,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":25,"ingredients":[{"name":"猪肋排","baseAmount":500,"unit":"g","category":"肉类","sub_type":"pork_ribs"},{"name":"大蒜","baseAmount":30,"unit":"g","category":"蔬菜","sub_type":"garlic"},{"name":"葱","baseAmount":10,"unit":"g","category":"蔬菜","sub_type":"scallion"},{"name":"姜","baseAmount":10,"unit":"g","category":"蔬菜","sub_type":"ginger"},{"name":"料酒","baseAmount":15,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"蚝油","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白糖","baseAmount":5,"unit":"g","category":"调料"},{"name":"胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"椒盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"干淀粉","baseAmount":30,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"action":"prep","text":"肋排剁成约3-4cm长的小段，洗净后用清水浸泡30分钟去血水，捞出沥干。大蒜切末，葱切葱花，姜切末备用。","duration_num":10},{"action":"prep","text":"排骨放入盆中，加料酒、生抽、蚝油、盐、白糖、胡椒粉抓匀腌制20分钟。腌制完成后撒入干淀粉，使每块排骨均匀裹上薄薄的淀粉浆。","duration_num":20},{"action":"cook","text":"锅中倒入足量食用油，烧至六成热（约160℃，插入筷子周围冒小泡），下排骨中火炸约5分钟至表面金黄定型，捞出控油。","duration_num":5},{"action":"cook","text":"将油温升至八成热（约180℃），下排骨复炸1-2分钟至外皮酥脆，捞出沥油。","duration_num":2},{"action":"cook","text":"锅中留底油，下蒜末、姜末小火炒香，倒入炸好的排骨快速翻匀，撒入适量椒盐和葱花，翻炒均匀后立即出锅。","duration_num":2}],"baby_variant":{"stages":[{"max_month":8,"name":"排骨蒜香泥","action":"取炸好的排骨，去除表面酥脆部分，取内部软烂肉质剁成泥，加少量煮软的蒜泥混合"},{"max_month":12,"name":"蒜香排骨碎末","action":"排骨清蒸至软烂，去骨切碎，蒜末加水蒸软后拌入，少盐调味"},{"max_month":36,"name":"宝宝版蒜香排骨","action":"排骨改为少油煎或蒸制，不加椒盐，蒜香味减淡，剪成小块食用"}]},"tags":["high_protein","party","salty_umami","stir_fry"],"base_serving":2,"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_salt_ribs.png"},
  {"id":"a-pork-20","name":"蒜香椒盐排骨","type":"adult","taste":"quick_stir_fry","meat":"pork","prep_time":27,"is_baby_friendly":false,"common_allergens":[],"can_share_base":false,"flavor_profile":"salty_umami","cook_type":"stir_fry","cook_minutes":25,"ingredients":[{"name":"猪肋排","baseAmount":500,"unit":"g","category":"肉类"},{"name":"大蒜","baseAmount":30,"unit":"g","category":"蔬菜"},{"name":"葱","baseAmount":10,"unit":"g","category":"蔬菜"},{"name":"姜","baseAmount":10,"unit":"g","category":"蔬菜"},{"name":"料酒","baseAmount":15,"unit":"ml","category":"调料"},{"name":"生抽","baseAmount":20,"unit":"ml","category":"调料"},{"name":"蚝油","baseAmount":10,"unit":"ml","category":"调料"},{"name":"盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"白糖","baseAmount":5,"unit":"g","category":"调料"},{"name":"胡椒粉","baseAmount":0,"unit":"适量","category":"调料"},{"name":"椒盐","baseAmount":0,"unit":"适量","category":"调料"},{"name":"干淀粉","baseAmount":30,"unit":"g","category":"调料"},{"name":"食用油","baseAmount":0,"unit":"适量","category":"调料"},{"name":"蒜末","baseAmount":0,"unit":"适量","category":"调料"}],"steps":[{"text":"猪肋排剁成约3-4cm长的小段，洗净后用清水浸泡30分钟去血水，捞出沥干。大蒜切末，葱切葱花，姜切末备用。","action":"prep","duration_minutes":7},{"text":"排骨放入盆中，加料酒、生抽、蚝油、盐、白糖、胡椒粉抓匀腌制20分钟。腌制完成后撒入干淀粉，使每块排骨均匀裹上薄薄的淀粉浆。","action":"prep","duration_minutes":20},{"text":"锅中倒入足量食用油，烧至六成热（约160℃，插入筷子周围冒小泡），下排骨中火炸约5分钟至表面金黄定型，捞出控油。","action":"cook","duration_minutes":9},{"text":"将油温升至八成热（约180℃），下排骨复炸3分钟至外皮酥脆，捞出沥油。","action":"cook","duration_minutes":6},{"text":"锅中留底油，用小火将切碎的蒜末在油中炸至金黄，捞出后下姜末小火炒香","action":"cook","duration_minutes":5},{"text":"倒入炸蒜蓉、姜末，和炸好的排骨快速翻匀，撒入适量椒盐和葱花，翻炒均匀后立即出锅。（可以添加五香粉和少量辣椒粉，增加口味层次）","action":"cook","duration_minutes":5}],"baby_variant":{"stages":[{"max_month":8,"name":"排骨蒜香泥","action":"取炸好的排骨，去除表面酥脆部分，取内部软烂肉质剁成泥，加少量煮软的蒜泥混合"},{"max_month":12,"name":"蒜香排骨碎末","action":"排骨清蒸至软烂，去骨切碎，蒜末加水蒸软后拌入，少盐调味"},{"max_month":36,"name":"宝宝版蒜香排骨","action":"排骨改为少油煎或蒸制，不加椒盐，蒜香味减淡，剪成小块食用"}]},"tags":["high_protein","party","salty_umami","stir_fry"],"base_serving":2,"coverFileID":"cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_salt_ribs.png"},
  {
    "id": "a-beef-12",
    "name": "葱爆牛肉",
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
        "name": "牛里脊",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类"
      },
      {
        "name": "大葱",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "姜",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜",
        "baseAmount": 8,
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
        "name": "蚝油",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 5,
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
        "name": "干淀粉",
        "baseAmount": 8,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "食用油",
        "baseAmount": 25,
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
        "name": "胡椒粉",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "text": "牛里脊逆纹切成约0.3cm厚的片，放入碗中。加少许料酒、胡椒粉抓匀，再加少量清水朝着一个方向搅打至牛肉吸收水分变得粘手。加入生抽5ml、蚝油5g、干淀粉抓匀，最后淋入一层食用油封住水分，腌制15分钟。大葱斜刀切成约0.5cm宽的葱段，葱白与葱绿分开使用，姜切丝，蒜切片备用。",
        "action": "prep",
        "duration_minutes": 15
      },
      {
        "text": "热锅凉油，油量稍多（约25ml），锅烧至冒烟时下腌制好的牛肉片，大火快速滑炒约1分钟至牛肉变色八成熟，立即盛出控油备用。",
        "action": "cook",
        "duration_minutes": 3
      },
      {
        "text": "利用锅中底油（若过少可再加少许），下姜丝、蒜片、葱白爆香约10秒，大火翻炒约30秒至葱段略微变软但仍保持脆感。",
        "action": "cook",
        "duration_minutes": 2
      },
      {
        "text": "将滑炒好的牛肉倒回锅中，沿锅边淋入剩余生抽10ml、老抽5ml，加入白糖3g、蚝油5g，盐少量，大火快速翻匀使调料包裹所有食材，从入锅到出锅总时长不超过30秒，最后滴几滴香油和葱绿增加风味层次，立即出锅装盘。",
        "action": "cook",
        "duration_minutes": 2
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "牛肉葱泥糊",
          "action": "取少量大葱煮软切碎，牛肉煮熟后手打成细腻肉泥，两者混合加少量汤汁调成稠糊状"
        },
        {
          "max_month": 12,
          "name": "牛肉葱碎末粥",
          "action": "牛肉切极细小丁，大葱切碎，与粥或碎面条同煮至软烂，加少量盐调味"
        },
        {
          "max_month": 36,
          "name": "宝宝葱爆牛肉",
          "action": "同大人版，牛肉切薄片更易咀嚼，大葱切小段，少盐少酱油，缩短爆炒时间保持嫩滑"
        }
      ]
    },
    "tags": [
      "quick",
      "high_protein",
      "stir_fry",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/scallion_stir_fried_beef.png"
  },
  {
    "id": "a-beef-13",
    "name": "洋葱肥牛卷",
    "type": "adult",
    "dish_type": "",
    "taste": "quick_stir_fry",
    "meat": "beef",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sour_fresh",
    "cook_type": "stir_fry",
    "cook_minutes": 3,
    "ingredients": [
      {
        "name": "肥牛卷",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_short_rib"
      },
      {
        "name": "紫洋葱",
        "baseAmount": 150,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "onion"
      },
      {
        "name": "绿甜椒",
        "baseAmount": 80,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "bell_pepper"
      },
      {
        "name": "红甜椒",
        "baseAmount": 80,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "bell_pepper"
      },
      {
        "name": "姜",
        "baseAmount": 8,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜",
        "baseAmount": 8,
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
        "name": "蚝油",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "香醋",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "白糖",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "黑胡椒",
        "baseAmount": 2,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "食用油",
        "baseAmount": 25,
        "unit": "ml",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "肥牛卷提前解冻，若太长可切两段。紫洋葱切丝，绿红甜椒切丝，姜蒜切末。",
        "duration_minutes": 5
      },
      {
        "action": "prep",
        "text": "肥牛卷加入少量生抽、黑胡椒抓匀腌制2分钟备用。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "调制酱汁：碗中加生抽、蚝油、香醋、白糖、黑胡椒搅匀备用。",
        "duration_minutes": 1
      },
      {
        "action": "cook",
        "text": "热锅凉油，油热后下姜蒜末爆香，放入洋葱丝大火翻炒约40秒至微软略透明。",
        "duration_minutes": 1
      },
      {
        "action": "cook",
        "text": "下绿甜椒丝和红甜椒丝翻炒10秒，倒入肥牛卷大火快速翻散，待肉变色后淋入酱汁迅速翻匀，整个过程约1分钟出锅。",
        "duration_minutes": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "肥牛蔬菜泥",
          "action": "肥牛煮熟切碎，洋葱甜椒煮软打泥，混合后加入少量原汤调成稠糊"
        },
        {
          "max_month": 12,
          "name": "肥牛蔬菜碎末",
          "action": "肥牛切小丁，洋葱甜椒切极细小丁，加少量水焖煮软烂，拌入粥或面条"
        },
        {
          "max_month": 36,
          "name": "宝宝版洋葱肥牛",
          "action": "同大人版少盐，肥牛切小块，洋葱甜椒切细丝，炒至全熟不出汤"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "high_protein",
      "sour_fresh",
      "stir_fry",
      "baby_friendly"
    ],
    "ingredient_group": "beef_short_rib",
    "spicy_sub": "",
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/onion_beef_rolls.png"
  },
  {
    "id": "a-beef-15",
    "name": "葱香牛肉炒饭",
    "type": "adult",
    "dish_type": "",
    "taste": "quick_stir_fry",
    "meat": "beef",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stir_fry",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "冷米饭",
        "baseAmount": 400,
        "unit": "g",
        "category": "主食"
      },
      {
        "name": "牛里脊",
        "baseAmount": 150,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_tenderloin"
      },
      {
        "name": "鸡蛋",
        "baseAmount": 2,
        "unit": "个",
        "category": "蛋类",
        "sub_type": "egg"
      },
      {
        "name": "大葱",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "green_onion"
      },
      {
        "name": "葱花",
        "baseAmount": 30,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "green_onion"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 50,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "carrot"
      },
      {
        "name": "姜",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜末",
        "baseAmount": 3,
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
        "name": "老抽",
        "baseAmount": 5,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 8,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 8,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "胡椒粉",
        "baseAmount": 1,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "食用油",
        "baseAmount": 30,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 2,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛里脊切小丁，约0.5cm，加料酒、胡椒粉、少许生抽抓匀腌制10分钟。胡萝卜切小丁，大葱切葱花，姜切末。鸡蛋打散加少许盐。米饭用手抓散备用。",
        "duration_minutes": 10
      },
      {
        "action": "cook",
        "text": "热锅凉油，油热后下牛肉丁大火翻炒至变色盛出。同一锅中再加油，倒入鸡蛋液快速炒散成蛋碎盛出。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "锅中再加油，小火爆香姜末蒜末，下胡萝卜丁翻炒30秒，加入冷米饭大火翻炒至米粒分散均匀。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "放入牛肉丁、鸡蛋碎，加入生抽、老抽、蚝油快速翻匀，最后撒入葱花翻匀出锅。",
        "duration_minutes": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "牛肉蛋粥糊",
          "action": "牛肉煮熟打泥，鸡蛋煮熟取蛋黄压碎，与米粥混合成稠糊状"
        },
        {
          "max_month": 12,
          "name": "牛肉蛋碎粥",
          "action": "牛肉切极小碎丁，鸡蛋打散炒熟切碎，与粥同煮，加少量葱花"
        },
        {
          "max_month": 36,
          "name": "宝宝版牛肉炒饭",
          "action": "同大人版少盐少油，牛肉切小丁，鸡蛋炒碎，饭炒至软烂，葱切细"
        }
      ]
    },
    "tags": [
      "quick",
      "high_protein",
      "salty_umami",
      "stir_fry",
      "baby_friendly"
    ],
    "ingredient_group": "beef_tenderloin",
    "spicy_sub": "",
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/scallion_beef_fried_rice.png"
  },
  {
    "id": "a-shell-1",
    "name": "蒜香芝士焗虾",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "shellfish",
    "prep_time": 35,
    "is_baby_friendly": true,
    "common_allergens": [
      "虾",
      "乳制品"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "bake",
    "cook_minutes": 23,
    "ingredients": [
      {
        "name": "大明虾",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "shrimp"
      },
      {
        "name": "马苏里拉芝士",
        "baseAmount": 80,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "大蒜",
        "baseAmount": 30,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "黄油",
        "baseAmount": 30,
        "unit": "g",
        "category": "其他"
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
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "欧芹碎",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "大明虾去壳去虾线，保留虾尾，沿背部剖开（底部保留一点连接，不完全切断），展开成蝴蝶状。用少许料酒、盐、黑胡椒腌制30分钟使其入味。",
        "duration_minutes": 30
      },
      {
        "action": "prep",
        "text": "烤箱预热至200°C。大蒜切末，与软化的黄油混合成蒜香黄油。",
        "duration_minutes": 5
      },
      {
        "action": "cook",
        "text": "在烤盘上铺锡纸或刷一层薄油，将虾均匀摆放在烤盘上，虾肉表面均匀抹上蒜香黄油，撒上马苏里拉芝士碎。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "送入烤箱中层，200°C烤12-15分钟，至芝士金黄起泡、虾肉变红熟透。取出撒欧芹碎点缀。",
        "duration_minutes": 15
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "虾泥焗蔬菜",
          "action": "虾煮熟去壳打泥，与软烂蔬菜泥混合，不加芝士和调味料"
        },
        {
          "max_month": 12,
          "name": "清蒸虾肉碎",
          "action": "虾蒸熟切碎，加少量煮蔬菜碎，淋少许虾汤"
        },
        {
          "max_month": 36,
          "name": "宝宝版焗虾",
          "action": "同大人版但少盐，虾开背不切段，芝士减半烤至微黄"
        }
      ]
    },
    "tags": [
      "party",
      "comfort",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_cheese_baked_shrimp.png"
  },
  {
    "id": "a-shell-1",
    "name": "蒜香芝士焗虾",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "shellfish",
    "prep_time": 35,
    "is_baby_friendly": true,
    "common_allergens": [
      "虾",
      "乳制品"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "bake",
    "cook_minutes": 23,
    "ingredients": [
      {
        "name": "大明虾",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "shrimp"
      },
      {
        "name": "马苏里拉芝士",
        "baseAmount": 80,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "大蒜",
        "baseAmount": 30,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "黄油",
        "baseAmount": 30,
        "unit": "g",
        "category": "其他"
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
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "欧芹碎",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "大明虾去壳去虾线，保留虾尾，沿背部剖开（底部保留一点连接，不完全切断），展开成蝴蝶状。用少许料酒、盐、黑胡椒腌制30分钟使其入味。",
        "duration_minutes": 30
      },
      {
        "action": "prep",
        "text": "烤箱预热至200°C。大蒜切末，与软化的黄油混合成蒜香黄油。",
        "duration_minutes": 5
      },
      {
        "action": "cook",
        "text": "在烤盘上铺锡纸或刷一层薄油，将虾均匀摆放在烤盘上，虾肉表面均匀抹上蒜香黄油，撒上马苏里拉芝士碎。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "送入烤箱中层，200°C烤12-15分钟，至芝士金黄起泡、虾肉变红熟透。取出撒欧芹碎点缀。",
        "duration_minutes": 15
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "虾泥焗蔬菜",
          "action": "虾煮熟去壳打泥，与软烂蔬菜泥混合，不加芝士和调味料"
        },
        {
          "max_month": 12,
          "name": "清蒸虾肉碎",
          "action": "虾蒸熟切碎，加少量煮蔬菜碎，淋少许虾汤"
        },
        {
          "max_month": 36,
          "name": "宝宝版焗虾",
          "action": "同大人版但少盐，虾开背不切段，芝士减半烤至微黄"
        }
      ]
    },
    "tags": [
      "party",
      "comfort",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/garlic_cheese_baked_shrimp.png"
  },
  {
    "id": "a-lamb-3",
    "name": "迷迭香烤羊排",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "lamb",
    "prep_time": 160,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "bake",
    "cook_minutes": 40,
    "ingredients": [
      {
        "name": "羊排",
        "baseAmount": 600,
        "unit": "g",
        "category": "肉类",
        "sub_type": "lamb_rack"
      },
      {
        "name": "迷迭香",
        "baseAmount": 10,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "大蒜",
        "baseAmount": 30,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 30,
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
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "柠檬",
        "baseAmount": 1,
        "unit": "个",
        "category": "蔬菜"
      },
      {
        "name": "土豆",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 150,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "烹饪前30分钟将羊排从冰箱取出，回温至室温。土豆、胡萝卜洗净切块备用。",
        "duration_minutes": 30
      },
      {
        "action": "prep",
        "text": "羊排洗净擦干水分，两面均匀撒盐和黑胡椒。迷迭香切碎，大蒜切片。柠檬切片备用。",
        "duration_minutes": 10
      },
      {
        "action": "prep",
        "text": "将羊排放在烤盘上，淋上橄榄油，撒上迷迭香碎和蒜片，按摩使调料均匀附着。羊排腌制2小时以上以提升风味。",
        "duration_minutes": 120
      },
      {
        "action": "cook",
        "text": "热锅倒少许橄榄油，将羊排两面各煎2分钟至金黄微焦，锁住肉汁。同时将土豆、胡萝卜块铺在烤盘周围，淋少许橄榄油拌匀。",
        "duration_minutes": 5
      },
      {
        "action": "cook",
        "text": "烤箱预热至230°C。将羊排和蔬菜放入烤盘，送入烤箱，先230°C烤15分钟锁住水分。",
        "duration_minutes": 15
      },
      {
        "action": "cook",
        "text": "将温度调至180°C，继续烤15-20分钟，至表面微焦、内部呈粉红色（约五成熟），土豆和胡萝卜也一并烤软。取出静置5分钟后搭配柠檬片食用。",
        "duration_minutes": 20
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "羊肉蔬菜泥",
          "action": "羊排煮烂去骨取肉，搭配胡萝卜、土豆打泥，不加调味料"
        },
        {
          "max_month": 12,
          "name": "羊肉土豆碎",
          "action": "羊排煮软烂，手撕成小块，配软烂土豆块，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版烤羊排",
          "action": "同大人版但缩短烤制时间确保全熟，少盐，去除表面焦脆部分取内部软肉"
        }
      ]
    },
    "tags": [
      "party",
      "comfort",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/rosemary_lamb_rack.png"
  },
  {
    "id": "a-lamb-3",
    "name": "迷迭香烤羊排",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "lamb",
    "prep_time": 160,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "bake",
    "cook_minutes": 40,
    "ingredients": [
      {
        "name": "羊排",
        "baseAmount": 600,
        "unit": "g",
        "category": "肉类",
        "sub_type": "lamb_rack"
      },
      {
        "name": "迷迭香",
        "baseAmount": 10,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "大蒜",
        "baseAmount": 30,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 30,
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
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "柠檬",
        "baseAmount": 1,
        "unit": "个",
        "category": "蔬菜"
      },
      {
        "name": "土豆",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 150,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "烹饪前30分钟将羊排从冰箱取出，回温至室温。土豆、胡萝卜洗净切块备用。",
        "duration_minutes": 30
      },
      {
        "action": "prep",
        "text": "羊排洗净擦干水分，两面均匀撒盐和黑胡椒。迷迭香切碎，大蒜切片。柠檬切片备用。",
        "duration_minutes": 10
      },
      {
        "action": "prep",
        "text": "将羊排放在烤盘上，淋上橄榄油，撒上迷迭香碎和蒜片，按摩使调料均匀附着。羊排腌制2小时以上以提升风味。",
        "duration_minutes": 120
      },
      {
        "action": "cook",
        "text": "热锅倒少许橄榄油，将羊排两面各煎2分钟至金黄微焦，锁住肉汁。同时将土豆、胡萝卜块铺在烤盘周围，淋少许橄榄油拌匀。",
        "duration_minutes": 5
      },
      {
        "action": "cook",
        "text": "烤箱预热至230°C。将羊排和蔬菜放入烤盘，送入烤箱，先230°C烤15分钟锁住水分。",
        "duration_minutes": 15
      },
      {
        "action": "cook",
        "text": "将温度调至180°C，继续烤15-20分钟，至表面微焦、内部呈粉红色（约五成熟），土豆和胡萝卜也一并烤软。取出静置5分钟后搭配柠檬片食用。",
        "duration_minutes": 20
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "羊肉蔬菜泥",
          "action": "羊排煮烂去骨取肉，搭配胡萝卜、土豆打泥，不加调味料"
        },
        {
          "max_month": 12,
          "name": "羊肉土豆碎",
          "action": "羊排煮软烂，手撕成小块，配软烂土豆块，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版烤羊排",
          "action": "同大人版但缩短烤制时间确保全熟，少盐，去除表面焦脆部分取内部软肉"
        }
      ]
    },
    "tags": [
      "party",
      "comfort",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/rosemary_lamb_rack.png"
  },
  {
    "id": "a-pork-21",
    "name": "培根土豆焗烤",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [
      "乳制品"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "bake",
    "cook_minutes": 45,
    "ingredients": [
      {
        "name": "土豆",
        "baseAmount": 500,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "培根",
        "baseAmount": 150,
        "unit": "g",
        "category": "肉类",
        "sub_type": "bacon"
      },
      {
        "name": "马苏里拉芝士",
        "baseAmount": 100,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "牛奶",
        "baseAmount": 100,
        "unit": "ml",
        "category": "其他"
      },
      {
        "name": "黄油",
        "baseAmount": 20,
        "unit": "g",
        "category": "其他"
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
      },
      {
        "name": "香葱",
        "baseAmount": 10,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "土豆洗净去皮，切成约0.5cm厚的均匀片状。培根切成小丁，香葱切碎备用。"
      },
      {
        "action": "cook",
        "text": "土豆片放入沸水锅中焯水3-5分钟至略微透明，捞出沥干水分。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "锅中放入黄油加热至融化，将培根丁放入锅中煎至金黄出油，捞出备用。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "烤盘底层铺一半土豆片，撒上煎好的培根丁，再铺剩余土豆片。倒入牛奶，撒盐和黑胡椒，最后铺上马苏里拉芝士碎。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "烤箱预热至190°C，将烤盘送入烤箱中上层，烤30-35分钟，至表面芝士金黄起泡、土豆软糯。取出撒香葱碎点缀。",
        "duration_num": 35
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "土豆泥拌培根",
          "action": "土豆蒸熟打泥，培根煮软切碎混入，不加芝士和调味料"
        },
        {
          "max_month": 12,
          "name": "土豆培根碎",
          "action": "土豆切小块煮软，培根切碎翻炒后混合，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版土豆焗烤",
          "action": "同大人版少盐少油，牛奶减半，芝士可用低盐替代"
        }
      ]
    },
    "tags": [
      "comfort",
      "high_protein",
      "party"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/bacon_mashed_potato_gratin.png"
  },
  {
    "id": "a-pork-21",
    "name": "培根土豆焗烤",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [
      "乳制品"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "bake",
    "cook_minutes": 45,
    "ingredients": [
      {
        "name": "土豆",
        "baseAmount": 500,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "培根",
        "baseAmount": 150,
        "unit": "g",
        "category": "肉类",
        "sub_type": "bacon"
      },
      {
        "name": "马苏里拉芝士",
        "baseAmount": 100,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "牛奶",
        "baseAmount": 100,
        "unit": "ml",
        "category": "其他"
      },
      {
        "name": "黄油",
        "baseAmount": 20,
        "unit": "g",
        "category": "其他"
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
      },
      {
        "name": "香葱",
        "baseAmount": 10,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "土豆洗净去皮，切成约0.5cm厚的均匀片状。培根切成小丁，香葱切碎备用。"
      },
      {
        "action": "cook",
        "text": "土豆片放入沸水锅中焯水3-5分钟至略微透明，捞出沥干水分。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "锅中放入黄油加热至融化，将培根丁放入锅中煎至金黄出油，捞出备用。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "烤盘底层铺一半土豆片，撒上煎好的培根丁，再铺剩余土豆片。倒入牛奶，撒盐和黑胡椒，最后铺上马苏里拉芝士碎。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "烤箱预热至190°C，将烤盘送入烤箱中上层，烤30-35分钟，至表面芝士金黄起泡、土豆软糯。取出撒香葱碎点缀。",
        "duration_num": 35
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "土豆泥拌培根",
          "action": "土豆蒸熟打泥，培根煮软切碎混入，不加芝士和调味料"
        },
        {
          "max_month": 12,
          "name": "土豆培根碎",
          "action": "土豆切小块煮软，培根切碎翻炒后混合，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版土豆焗烤",
          "action": "同大人版少盐少油，牛奶减半，芝士可用低盐替代"
        }
      ]
    },
    "tags": [
      "comfort",
      "high_protein",
      "party"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/bacon_mashed_potato_gratin.png"
  },
  {
    "id": "a-chi-17",
    "name": "柠檬香草烤鸡腿",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "bake",
    "cook_minutes": 63,
    "ingredients": [
      {
        "name": "鸡腿",
        "baseAmount": 600,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_leg"
      },
      {
        "name": "柠檬",
        "baseAmount": 2,
        "unit": "个",
        "category": "蔬菜"
      },
      {
        "name": "迷迭香",
        "baseAmount": 8,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "百里香",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "大蒜",
        "baseAmount": 25,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜末",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "橄榄油",
        "baseAmount": 40,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "黑胡椒",
        "baseAmount": 2,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡腿洗净擦干，在表面划两刀方便入味。柠檬一个切片，一个取汁。大蒜切末，迷迭香和百里香混合备用。",
        "duration_minutes": 10
      },
      {
        "action": "cook",
        "text": "将鸡腿放入大碗中，加入柠檬汁、蒜末、香草、橄榄油、盐和黑胡椒，充分按摩腌制20分钟。",
        "duration_minutes": 20
      },
      {
        "action": "cook",
        "text": "烤箱预热至200°C。烤盘铺锡纸，将鸡腿均匀摆放，柠檬片铺在鸡腿表面和周围。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "送入烤箱200°C烤25分钟，然后转180°C继续烤15-20分钟，至鸡皮金黄酥脆、肉质软烂。用筷子能轻易扎透即为熟透。",
        "duration_minutes": 40
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡肉蔬菜泥",
          "action": "鸡腿煮熟去骨，鸡肉搭配胡萝卜、南瓜打泥，不加调味料"
        },
        {
          "max_month": 12,
          "name": "鸡肉蔬菜碎",
          "action": "鸡腿煮软烂，手撕成小块，搭配软烂蔬菜碎，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版烤鸡腿",
          "action": "同大人版但缩短烤制时间，去除表面焦脆部分，少盐"
        }
      ]
    },
    "tags": [
      "comfort",
      "high_protein",
      "light",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/lemon_herb_roasted_chicken_leg.png"
  },
  {
    "id": "a-chi-17",
    "name": "柠檬香草烤鸡腿",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "bake",
    "cook_minutes": 63,
    "ingredients": [
      {
        "name": "鸡腿",
        "baseAmount": 600,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_leg"
      },
      {
        "name": "柠檬",
        "baseAmount": 2,
        "unit": "个",
        "category": "蔬菜"
      },
      {
        "name": "迷迭香",
        "baseAmount": 8,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "百里香",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "大蒜",
        "baseAmount": 25,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "蒜末",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "橄榄油",
        "baseAmount": 40,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "黑胡椒",
        "baseAmount": 2,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "鸡腿洗净擦干，在表面划两刀方便入味。柠檬一个切片，一个取汁。大蒜切末，迷迭香和百里香混合备用。",
        "duration_minutes": 10
      },
      {
        "action": "cook",
        "text": "将鸡腿放入大碗中，加入柠檬汁、蒜末、香草、橄榄油、盐和黑胡椒，充分按摩腌制20分钟。",
        "duration_minutes": 20
      },
      {
        "action": "cook",
        "text": "烤箱预热至200°C。烤盘铺锡纸，将鸡腿均匀摆放，柠檬片铺在鸡腿表面和周围。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "送入烤箱200°C烤25分钟，然后转180°C继续烤15-20分钟，至鸡皮金黄酥脆、肉质软烂。用筷子能轻易扎透即为熟透。",
        "duration_minutes": 40
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡肉蔬菜泥",
          "action": "鸡腿煮熟去骨，鸡肉搭配胡萝卜、南瓜打泥，不加调味料"
        },
        {
          "max_month": 12,
          "name": "鸡肉蔬菜碎",
          "action": "鸡腿煮软烂，手撕成小块，搭配软烂蔬菜碎，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版烤鸡腿",
          "action": "同大人版但缩短烤制时间，去除表面焦脆部分，少盐"
        }
      ]
    },
    "tags": [
      "comfort",
      "high_protein",
      "light",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/lemon_herb_roasted_chicken_leg.png"
  },
  {
    "id": "a-pork-22",
    "name": "番茄肉酱焗意面",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [
      "乳制品",
      "麸质"
    ],
    "can_share_base": true,
    "flavor_profile": "sweet_sour",
    "cook_type": "bake",
    "cook_minutes": 30,
    "ingredients": [
      {
        "name": "意面",
        "baseAmount": 300,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "猪肉末",
        "baseAmount": 200,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_minced"
      },
      {
        "name": "番茄",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "番茄酱",
        "baseAmount": 80,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "马苏里拉芝士",
        "baseAmount": 120,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "洋葱",
        "baseAmount": 80,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "大蒜",
        "baseAmount": 15,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 20,
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
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "罗勒碎",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "番茄去皮切小块，洋葱切丁，大蒜切末。意面放入沸水加少许盐煮至8成熟（约7分钟），捞出沥干备用。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，下洋葱丁和蒜末炒香至透明，加入猪肉末翻炒至变色散开。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "加入番茄块和番茄酱翻炒出汁，加少许盐和黑胡椒调味，小火煮10分钟至酱汁浓稠。",
        "duration_num": 12
      },
      {
        "action": "cook",
        "text": "将意面放入烤盘，淋上番茄肉酱拌匀，表面撒满马苏里拉芝士碎。烤箱预热至200°C，烤15分钟至芝士金黄融化。取出撒罗勒碎。",
        "duration_num": 18
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "番茄肉泥拌面",
          "action": "意面煮软打泥，番茄猪肉煮烂打泥混合，不加芝士和调味料"
        },
        {
          "max_month": 12,
          "name": "番茄肉碎拌面",
          "action": "意面切小段，番茄肉酱煮软烂切碎拌匀，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版焗意面",
          "action": "同大人版少盐，芝士减半，番茄去皮切小块"
        }
      ]
    },
    "tags": [
      "comfort",
      "party",
      "high_protein",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/tomato_bolognese_baked_pasta.png"
  },
  {
    "id": "a-pork-22",
    "name": "番茄肉酱焗意面",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 20,
    "is_baby_friendly": true,
    "common_allergens": [
      "乳制品",
      "麸质"
    ],
    "can_share_base": true,
    "flavor_profile": "sweet_sour",
    "cook_type": "bake",
    "cook_minutes": 30,
    "ingredients": [
      {
        "name": "意面",
        "baseAmount": 300,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "猪肉末",
        "baseAmount": 200,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_minced"
      },
      {
        "name": "番茄",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "番茄酱",
        "baseAmount": 80,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "马苏里拉芝士",
        "baseAmount": 120,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "洋葱",
        "baseAmount": 80,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "大蒜",
        "baseAmount": 15,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "橄榄油",
        "baseAmount": 20,
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
        "name": "黑胡椒",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "罗勒碎",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "番茄去皮切小块，洋葱切丁，大蒜切末。意面放入沸水加少许盐煮至8成熟（约7分钟），捞出沥干备用。"
      },
      {
        "action": "cook",
        "text": "锅中倒油烧热，下洋葱丁和蒜末炒香至透明，加入猪肉末翻炒至变色散开。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "加入番茄块和番茄酱翻炒出汁，加少许盐和黑胡椒调味，小火煮10分钟至酱汁浓稠。",
        "duration_num": 12
      },
      {
        "action": "cook",
        "text": "将意面放入烤盘，淋上番茄肉酱拌匀，表面撒满马苏里拉芝士碎。烤箱预热至200°C，烤15分钟至芝士金黄融化。取出撒罗勒碎。",
        "duration_num": 18
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "番茄肉泥拌面",
          "action": "意面煮软打泥，番茄猪肉煮烂打泥混合，不加芝士和调味料"
        },
        {
          "max_month": 12,
          "name": "番茄肉碎拌面",
          "action": "意面切小段，番茄肉酱煮软烂切碎拌匀，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝版焗意面",
          "action": "同大人版少盐，芝士减半，番茄去皮切小块"
        }
      ]
    },
    "tags": [
      "comfort",
      "party",
      "high_protein",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/tomato_bolognese_baked_pasta.png"
  },
  {
    "id": "a-lamb-4",
    "name": "电饭煲羊肉抓饭",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "lamb",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 60,
    "ingredients": [
      {
        "name": "羊腿肉",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "lamb_leg"
      },
      {
        "name": "大米",
        "baseAmount": 400,
        "unit": "g",
        "category": "其他",
        "sub_type": "rice"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 150,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "洋葱",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "葡萄干",
        "baseAmount": 30,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "食用油",
        "baseAmount": 30,
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
        "name": "孜然粉",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "白砂糖",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "羊腿肉切 2cm 方块，用清水浸泡 1 小时以上泡出血水后沥干（可省略）；胡萝卜切粗条，洋葱切丝，大米洗净后用清水浸泡 20 分钟，捞出沥干。",
        "duration_num": 10
      },
      {
        "action": "cook",
        "text": "电饭煲内倒入油，选择「煮饭」功能预热，放入羊肉块和一半洋葱丝翻炒至羊肉变色，再加入胡萝卜条、孜然粉、白砂糖和盐翻炒均匀。",
        "duration_num": 8
      },
      {
        "action": "cook",
        "text": "倒入沥干的大米铺平，加入清水（水量没过大米约 1cm），将剩余的一半洋葱丝撒在米饭上，启动「煮饭」功能。",
        "duration_num": 40
      },
      {
        "action": "cook",
        "text": "自动跳转保温后撒入葡萄干，焖 10 分钟，用勺子从底部翻拌均匀即可。",
        "duration_num": 10
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "羊肉胡萝卜泥",
          "action": "取羊肉蒸熟打成泥，胡萝卜煮软打泥，大米熬成稀粥后混合"
        },
        {
          "max_month": 12,
          "name": "羊肉胡萝卜粥",
          "action": "羊肉切碎、胡萝卜切碎与米同煮成稠粥，去孜然，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝抓饭",
          "action": "同大人版但羊肉切小块、胡萝卜切细丝，去葡萄干，少盐"
        }
      ]
    },
    "tags": [
      "comfort",
      "party",
      "hearty",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_lamb_pilaf.png"
  },
  {
    "id": "a-lamb-4",
    "name": "电饭煲羊肉抓饭",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "lamb",
    "prep_time": 10,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 60,
    "ingredients": [
      {
        "name": "羊腿肉",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "lamb_leg"
      },
      {
        "name": "大米",
        "baseAmount": 400,
        "unit": "g",
        "category": "其他",
        "sub_type": "rice"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 150,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "洋葱",
        "baseAmount": 100,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "葡萄干",
        "baseAmount": 30,
        "unit": "g",
        "category": "其他"
      },
      {
        "name": "食用油",
        "baseAmount": 30,
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
        "name": "孜然粉",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "白砂糖",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "羊腿肉切 2cm 方块，用清水浸泡 1 小时以上泡出血水后沥干（可省略）；胡萝卜切粗条，洋葱切丝，大米洗净后用清水浸泡 20 分钟，捞出沥干。",
        "duration_num": 10
      },
      {
        "action": "cook",
        "text": "电饭煲内倒入油，选择「煮饭」功能预热，放入羊肉块和一半洋葱丝翻炒至羊肉变色，再加入胡萝卜条、孜然粉、白砂糖和盐翻炒均匀。",
        "duration_num": 8
      },
      {
        "action": "cook",
        "text": "倒入沥干的大米铺平，加入清水（水量没过大米约 1cm），将剩余的一半洋葱丝撒在米饭上，启动「煮饭」功能。",
        "duration_num": 40
      },
      {
        "action": "cook",
        "text": "自动跳转保温后撒入葡萄干，焖 10 分钟，用勺子从底部翻拌均匀即可。",
        "duration_num": 10
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "羊肉胡萝卜泥",
          "action": "取羊肉蒸熟打成泥，胡萝卜煮软打泥，大米熬成稀粥后混合"
        },
        {
          "max_month": 12,
          "name": "羊肉胡萝卜粥",
          "action": "羊肉切碎、胡萝卜切碎与米同煮成稠粥，去孜然，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝抓饭",
          "action": "同大人版但羊肉切小块、胡萝卜切细丝，去葡萄干，少盐"
        }
      ]
    },
    "tags": [
      "comfort",
      "party",
      "hearty",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_lamb_pilaf.png"
  },
  {
    "id": "a-chi-19",
    "name": "电饭煲香菇滑鸡",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [
      "鸡"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 40,
    "ingredients": [
      {
        "name": "鸡腿肉",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_thigh"
      },
      {
        "name": "干香菇",
        "baseAmount": 20,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "红枣",
        "baseAmount": 5,
        "unit": "颗",
        "category": "其他"
      },
      {
        "name": "姜片",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 5,
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
        "name": "糖",
        "baseAmount": 3,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 1,
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
        "name": "干淀粉",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "干香菇提前用温水泡发 30 分钟，泡好后切块。鸡腿肉去骨切块，加入料酒、蚝油、干淀粉抓匀腌制 10 分钟。",
        "duration_minutes": 15
      },
      {
        "action": "cook",
        "text": "电饭煲内放入姜片、香菇、红枣铺底，加入生抽、老抽、糖、白胡椒粉和清水 100ml 混合成酱汁。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "将鸡肉块均匀铺在香菇上，启动「煮饭」功能，待跳转保温后焖 10 分钟。",
        "duration_minutes": 35
      },
      {
        "action": "cook",
        "text": "开盖后加适量盐调味，撒入葱花增香，用勺子翻拌均匀，让汤汁均匀裹住鸡肉即可。",
        "duration_minutes": 3
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "香菇鸡肉泥",
          "action": "取鸡胸肉蒸熟，香菇煮软，两者混合打成细腻泥状，不加盐"
        },
        {
          "max_month": 12,
          "name": "香菇鸡肉碎末",
          "action": "鸡肉切碎，香菇切碎，加少量鸡汤同煮，拌入粥或碎面"
        },
        {
          "max_month": 36,
          "name": "宝宝香菇滑鸡",
          "action": "同大人版少盐，鸡肉切小块，香菇切碎，炖至软烂"
        }
      ]
    },
    "tags": [
      "comfort",
      "baby_friendly",
      "high_protein",
      "hearty"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_mushroom_chicken.png"
  },
  {
    "id": "a-chi-19",
    "name": "电饭煲香菇滑鸡",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 15,
    "is_baby_friendly": true,
    "common_allergens": [
      "鸡"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 40,
    "ingredients": [
      {
        "name": "鸡腿肉",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_thigh"
      },
      {
        "name": "干香菇",
        "baseAmount": 20,
        "unit": "g",
        "category": "干货"
      },
      {
        "name": "红枣",
        "baseAmount": 5,
        "unit": "颗",
        "category": "其他"
      },
      {
        "name": "姜片",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 5,
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
        "name": "糖",
        "baseAmount": 3,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "白胡椒粉",
        "baseAmount": 1,
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
        "name": "干淀粉",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "干香菇提前用温水泡发 30 分钟，泡好后切块。鸡腿肉去骨切块，加入料酒、蚝油、干淀粉抓匀腌制 10 分钟。",
        "duration_minutes": 15
      },
      {
        "action": "cook",
        "text": "电饭煲内放入姜片、香菇、红枣铺底，加入生抽、老抽、糖、白胡椒粉和清水 100ml 混合成酱汁。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "将鸡肉块均匀铺在香菇上，启动「煮饭」功能，待跳转保温后焖 10 分钟。",
        "duration_minutes": 35
      },
      {
        "action": "cook",
        "text": "开盖后加适量盐调味，撒入葱花增香，用勺子翻拌均匀，让汤汁均匀裹住鸡肉即可。",
        "duration_minutes": 3
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "香菇鸡肉泥",
          "action": "取鸡胸肉蒸熟，香菇煮软，两者混合打成细腻泥状，不加盐"
        },
        {
          "max_month": 12,
          "name": "香菇鸡肉碎末",
          "action": "鸡肉切碎，香菇切碎，加少量鸡汤同煮，拌入粥或碎面"
        },
        {
          "max_month": 36,
          "name": "宝宝香菇滑鸡",
          "action": "同大人版少盐，鸡肉切小块，香菇切碎，炖至软烂"
        }
      ]
    },
    "tags": [
      "comfort",
      "baby_friendly",
      "high_protein",
      "hearty"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_mushroom_chicken.png"
  },
  {
    "id": "a-soup-21",
    "name": "电饭煲番茄牛腩",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "beef",
    "prep_time": 12,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sweet_sour",
    "cook_type": "stew",
    "cook_minutes": 95,
    "ingredients": [
      {
        "name": "牛腩",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_brisket"
      },
      {
        "name": "番茄",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "tomato"
      },
      {
        "name": "洋葱",
        "baseAmount": 100,
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
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
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
        "name": "冰糖",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "八角",
        "baseAmount": 2,
        "unit": "颗",
        "category": "调料"
      },
      {
        "name": "桂皮",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "番茄酱",
        "baseAmount": 30,
        "unit": "ml",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛腩切 3cm 方块，番茄切块，洋葱切丝备用。",
        "duration_num": 5
      },
      {
        "action": "prep",
        "text": "牛腩块冷水下锅，加料酒、姜片焯水去血沫，捞出洗净备用。",
        "duration_num": 7
      },
      {
        "action": "cook",
        "text": "电饭煲内放入牛腩、洋葱、姜片、八角、桂皮，加入生抽、料酒、冰糖和适量清水（水量约没过食材 2cm）。",
        "duration_num": 2
      },
      {
        "action": "cook",
        "text": "盖上锅盖，启动「煮饭」或「炖汤」功能，煮至自动跳转保温后加入番茄块和番茄酱，搅拌均匀，再启动一次「煮饭」功能，总时长约 90 分钟至牛腩软烂。",
        "duration_num": 90
      },
      {
        "action": "cook",
        "text": "出锅前加适量盐调味，大火收汁至汤汁浓稠即可。",
        "duration_num": 3
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "番茄牛肉泥",
          "action": "取牛腩蒸熟打成泥，番茄去皮煮软打泥，混合后加少量汤汁调成稀糊"
        },
        {
          "max_month": 12,
          "name": "番茄牛肉碎末粥",
          "action": "牛肉切碎与米同煮成粥，番茄切碎加入，熬至软烂"
        },
        {
          "max_month": 36,
          "name": "宝宝番茄牛腩",
          "action": "同大人版少盐，牛肉切小块，番茄去皮切碎，炖至软烂"
        }
      ]
    },
    "tags": [
      "comfort",
      "hearty",
      "soup",
      "baby_friendly",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_tomato_beef_stew.png"
  },
  {
    "id": "a-soup-21",
    "name": "电饭煲番茄牛腩",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "beef",
    "prep_time": 12,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "sweet_sour",
    "cook_type": "stew",
    "cook_minutes": 95,
    "ingredients": [
      {
        "name": "牛腩",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "beef_brisket"
      },
      {
        "name": "番茄",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "tomato"
      },
      {
        "name": "洋葱",
        "baseAmount": 100,
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
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
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
        "name": "冰糖",
        "baseAmount": 10,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "八角",
        "baseAmount": 2,
        "unit": "颗",
        "category": "调料"
      },
      {
        "name": "桂皮",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "番茄酱",
        "baseAmount": 30,
        "unit": "ml",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "牛腩切 3cm 方块，番茄切块，洋葱切丝备用。",
        "duration_num": 5
      },
      {
        "action": "prep",
        "text": "牛腩块冷水下锅，加料酒、姜片焯水去血沫，捞出洗净备用。",
        "duration_num": 7
      },
      {
        "action": "cook",
        "text": "电饭煲内放入牛腩、洋葱、姜片、八角、桂皮，加入生抽、料酒、冰糖和适量清水（水量约没过食材 2cm）。",
        "duration_num": 2
      },
      {
        "action": "cook",
        "text": "盖上锅盖，启动「煮饭」或「炖汤」功能，煮至自动跳转保温后加入番茄块和番茄酱，搅拌均匀，再启动一次「煮饭」功能，总时长约 90 分钟至牛腩软烂。",
        "duration_num": 90
      },
      {
        "action": "cook",
        "text": "出锅前加适量盐调味，大火收汁至汤汁浓稠即可。",
        "duration_num": 3
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "番茄牛肉泥",
          "action": "取牛腩蒸熟打成泥，番茄去皮煮软打泥，混合后加少量汤汁调成稀糊"
        },
        {
          "max_month": 12,
          "name": "番茄牛肉碎末粥",
          "action": "牛肉切碎与米同煮成粥，番茄切碎加入，熬至软烂"
        },
        {
          "max_month": 36,
          "name": "宝宝番茄牛腩",
          "action": "同大人版少盐，牛肉切小块，番茄去皮切碎，炖至软烂"
        }
      ]
    },
    "tags": [
      "comfort",
      "hearty",
      "soup",
      "baby_friendly",
      "high_protein"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_tomato_beef_stew.png"
  },
  {
    "id": "a-chi-18",
    "name": "电饭煲盐焗鸡",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 52,
    "ingredients": [
      {
        "name": "三黄鸡",
        "baseAmount": 1,
        "unit": "只",
        "category": "肉类",
        "sub_type": "whole_chicken"
      },
      {
        "name": "粗盐",
        "baseAmount": 600,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "姜片",
        "baseAmount": 30,
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
        "name": "八角",
        "baseAmount": 2,
        "unit": "颗",
        "category": "调料"
      },
      {
        "name": "花椒",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "三黄鸡充分漂尽血水，擦干表面水分。腹腔内放入姜片、葱段、八角、花椒，并适当按摩帮助入味。在鸡身表面均匀抹上一层薄盐，腌制 10 分钟。",
        "duration_minutes": 10
      },
      {
        "action": "cook",
        "text": "电饭煲底部铺一层粗盐，放入腌制好的鸡，再将剩余粗盐覆盖在鸡身上，盖上锅盖。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "启动电饭煲「煮饭」功能，待自动跳转保温后焖 20 分钟。开盖加入小半碗水，继续焗至水干出油，开盖检查鸡身盐色。",
        "duration_minutes": 50
      },
      {
        "action": "cook",
        "text": "将鸡撕碎，与电饭煲内油汁拌匀，即可享用。",
        "duration_minutes": 3
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡肉泥糊",
          "action": "取鸡胸肉去皮去骨，蒸熟后打成细腻泥状，不加盐"
        },
        {
          "max_month": 12,
          "name": "鸡肉碎末",
          "action": "取鸡肉撕成碎末，加少量鸡汤拌匀，婴儿可少量尝味"
        },
        {
          "max_month": 36,
          "name": "宝宝盐焗鸡",
          "action": "取鸡肉小块，蒸软后手撕成粗条，蘸取少量鸡汤食用"
        }
      ]
    },
    "tags": [
      "comfort",
      "party",
      "hearty",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_salt_baked_chicken.png"
  },
  {
    "id": "a-chi-18",
    "name": "电饭煲盐焗鸡",
    "type": "adult",
    "taste": "slow_stew",
    "meat": "chicken",
    "prep_time": 10,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 52,
    "ingredients": [
      {
        "name": "三黄鸡",
        "baseAmount": 1,
        "unit": "只",
        "category": "肉类",
        "sub_type": "whole_chicken"
      },
      {
        "name": "粗盐",
        "baseAmount": 600,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "姜片",
        "baseAmount": 30,
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
        "name": "八角",
        "baseAmount": 2,
        "unit": "颗",
        "category": "调料"
      },
      {
        "name": "花椒",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "三黄鸡充分漂尽血水，擦干表面水分。腹腔内放入姜片、葱段、八角、花椒，并适当按摩帮助入味。在鸡身表面均匀抹上一层薄盐，腌制 10 分钟。",
        "duration_minutes": 10
      },
      {
        "action": "cook",
        "text": "电饭煲底部铺一层粗盐，放入腌制好的鸡，再将剩余粗盐覆盖在鸡身上，盖上锅盖。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "启动电饭煲「煮饭」功能，待自动跳转保温后焖 20 分钟。开盖加入小半碗水，继续焗至水干出油，开盖检查鸡身盐色。",
        "duration_minutes": 50
      },
      {
        "action": "cook",
        "text": "将鸡撕碎，与电饭煲内油汁拌匀，即可享用。",
        "duration_minutes": 3
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡肉泥糊",
          "action": "取鸡胸肉去皮去骨，蒸熟后打成细腻泥状，不加盐"
        },
        {
          "max_month": 12,
          "name": "鸡肉碎末",
          "action": "取鸡肉撕成碎末，加少量鸡汤拌匀，婴儿可少量尝味"
        },
        {
          "max_month": 36,
          "name": "宝宝盐焗鸡",
          "action": "取鸡肉小块，蒸软后手撕成粗条，蘸取少量鸡汤食用"
        }
      ]
    },
    "tags": [
      "comfort",
      "party",
      "hearty",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_salt_baked_chicken.png"
  },
  {
    "id": "a-soup-22",
    "name": "电饭煲玉米排骨汤",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 8,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 90,
    "ingredients": [
      {
        "name": "排骨",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_ribs"
      },
      {
        "name": "玉米",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 150,
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
        "baseAmount": 20,
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
        "name": "葱花",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "排骨剁成 4cm 小段，冷水下锅加料酒、姜片焯水去血沫，捞出洗净备用。玉米切段，胡萝卜切滚刀块。",
        "duration_minutes": 8
      },
      {
        "action": "cook",
        "text": "电饭煲内放入排骨、玉米、胡萝卜、姜片，加入适量清水（没过食材约 2cm）。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "盖上锅盖，启动「炖汤」或「煮饭」功能两次，总时长约 80-90 分钟至排骨软烂、汤色奶白。",
        "duration_minutes": 90
      },
      {
        "action": "cook",
        "text": "出锅前加适量盐调味，撒上葱花即可。",
        "duration_minutes": 2
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "排骨玉米泥",
          "action": "取排骨上瘦肉蒸熟去骨打成泥，玉米煮软打成泥，混合后加少量汤汁"
        },
        {
          "max_month": 12,
          "name": "排骨玉米粥",
          "action": "排骨肉切碎，玉米切碎与米同煮成粥，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝玉米排骨汤",
          "action": "同大人版少盐，排骨切小块，玉米切段，炖至软烂"
        }
      ]
    },
    "tags": [
      "comfort",
      "soup",
      "baby_friendly",
      "high_protein",
      "hearty"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_corn_pork_rib_soup.png"
  },
  {
    "id": "a-soup-22",
    "name": "电饭煲玉米排骨汤",
    "type": "adult",
    "dish_type": "soup",
    "taste": "slow_stew",
    "meat": "pork",
    "prep_time": 8,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "stew",
    "cook_minutes": 90,
    "ingredients": [
      {
        "name": "排骨",
        "baseAmount": 500,
        "unit": "g",
        "category": "肉类",
        "sub_type": "pork_ribs"
      },
      {
        "name": "玉米",
        "baseAmount": 300,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "胡萝卜",
        "baseAmount": 150,
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
        "baseAmount": 20,
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
        "name": "葱花",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "排骨剁成 4cm 小段，冷水下锅加料酒、姜片焯水去血沫，捞出洗净备用。玉米切段，胡萝卜切滚刀块。",
        "duration_minutes": 8
      },
      {
        "action": "cook",
        "text": "电饭煲内放入排骨、玉米、胡萝卜、姜片，加入适量清水（没过食材约 2cm）。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "盖上锅盖，启动「炖汤」或「煮饭」功能两次，总时长约 80-90 分钟至排骨软烂、汤色奶白。",
        "duration_minutes": 90
      },
      {
        "action": "cook",
        "text": "出锅前加适量盐调味，撒上葱花即可。",
        "duration_minutes": 2
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "排骨玉米泥",
          "action": "取排骨上瘦肉蒸熟去骨打成泥，玉米煮软打成泥，混合后加少量汤汁"
        },
        {
          "max_month": 12,
          "name": "排骨玉米粥",
          "action": "排骨肉切碎，玉米切碎与米同煮成粥，少盐"
        },
        {
          "max_month": 36,
          "name": "宝宝玉米排骨汤",
          "action": "同大人版少盐，排骨切小块，玉米切段，炖至软烂"
        }
      ]
    },
    "tags": [
      "comfort",
      "soup",
      "baby_friendly",
      "high_protein",
      "hearty"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/electric_rice_cooker_corn_pork_rib_soup.png"
  },
  {
    "id": "a-veg-53",
    "name": "微波蒜蓉西兰花",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "steam",
    "cook_minutes": 6,
    "ingredients": [
      {
        "name": "西兰花",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "broccoli"
      },
      {
        "name": "大蒜",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "蔬菜",
        "sub_type": "garlic"
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
        "name": "食用油",
        "baseAmount": 10,
        "unit": "ml",
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
        "text": "西兰花切成小朵，用淡盐水浸泡5分钟后洗净，沥干水分。大蒜剁成蒜蓉。",
        "duration_minutes": 5
      },
      {
        "action": "cook",
        "text": "西兰花放入可微波的深碗中，加盖保鲜膜扎小孔，高火微波3分钟至半熟。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "取出滗掉水分，淋上生抽和蚝油，撒上蒜蓉，再高火微波2分钟。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "取出淋上热食用油激发蒜香，拌匀即可。",
        "duration_minutes": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "西兰花泥",
          "action": "取微波软烂的西兰花去掉粗茎，用料理机打泥"
        },
        {
          "max_month": 12,
          "name": "西兰花碎末",
          "action": "西兰花切碎，加少量生抽（可选）拌匀，软烂即可"
        },
        {
          "max_month": 36,
          "name": "宝宝版西兰花",
          "action": "同大人版不加调味料，西兰花切小朵微波至软烂"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "quick",
      "light",
      "vegetarian",
      "steamed",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_garlic_broccoli.png"
  },
  {
    "id": "a-veg-53",
    "name": "微波蒜蓉西兰花",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "steam",
    "cook_minutes": 6,
    "ingredients": [
      {
        "name": "西兰花",
        "baseAmount": 200,
        "unit": "g",
        "category": "蔬菜",
        "sub_type": "broccoli"
      },
      {
        "name": "大蒜",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "蔬菜",
        "sub_type": "garlic"
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
        "name": "食用油",
        "baseAmount": 10,
        "unit": "ml",
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
        "text": "西兰花切成小朵，用淡盐水浸泡5分钟后洗净，沥干水分。大蒜剁成蒜蓉。",
        "duration_minutes": 5
      },
      {
        "action": "cook",
        "text": "西兰花放入可微波的深碗中，加盖保鲜膜扎小孔，高火微波3分钟至半熟。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "取出滗掉水分，淋上生抽和蚝油，撒上蒜蓉，再高火微波2分钟。",
        "duration_minutes": 2
      },
      {
        "action": "cook",
        "text": "取出淋上热食用油激发蒜香，拌匀即可。",
        "duration_minutes": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "西兰花泥",
          "action": "取微波软烂的西兰花去掉粗茎，用料理机打泥"
        },
        {
          "max_month": 12,
          "name": "西兰花碎末",
          "action": "西兰花切碎，加少量生抽（可选）拌匀，软烂即可"
        },
        {
          "max_month": 36,
          "name": "宝宝版西兰花",
          "action": "同大人版不加调味料，西兰花切小朵微波至软烂"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "quick",
      "light",
      "vegetarian",
      "steamed",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_garlic_broccoli.png"
  },
  {
    "id": "a-chi-18",
    "name": "微波蜜汁鸡翅",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 30,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "sweet_sour",
    "cook_type": "bake",
    "cook_minutes": 9,
    "ingredients": [
      {
        "name": "鸡中翅",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_wing"
      },
      {
        "name": "蜂蜜",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 5,
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
        "name": "姜片",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜瓣",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 10,
        "unit": "ml",
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
        "text": "鸡中翅洗净，在表面划两刀方便入味，加入料酒、姜片、蒜瓣、盐和少量胡椒粉，腌制30分钟以上。",
        "duration_num": 30
      },
      {
        "action": "cook",
        "text": "将腌制好的鸡中翅放入微波炉专用容器，先在鸡翅表面均匀裹一层蜂蜜，再刷上生抽、老抽和蚝油混合的酱汁。",
        "duration_num": 1
      },
      {
        "action": "cook",
        "text": "高火微波5分钟，取出翻面，再刷一次酱汁，继续高火3分钟。",
        "duration_num": 8
      },
      {
        "action": "cook",
        "text": "鸡翅表面微焦即可取出，稍微静置2分钟让肉汁吸收。",
        "duration_num": 2
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡翅肉泥",
          "action": "取无骨鸡翅肉，去皮后打泥，混入少量粥或面条"
        },
        {
          "max_month": 12,
          "name": "鸡翅肉碎",
          "action": "鸡翅去骨切碎，加少量煮鸡翅的汤汁，拌入软烂辅食"
        },
        {
          "max_month": 36,
          "name": "宝宝版鸡翅",
          "action": "鸡翅用清水加姜片煮熟，不加任何调料，拆肉去骨切小块食用"
        }
      ]
    },
    "tags": [
      "quick",
      "high_protein",
      "party"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_honey_chicken_wings.png"
  },
  {
    "id": "a-chi-18",
    "name": "微波蜜汁鸡翅",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "quick_stir_fry",
    "meat": "chicken",
    "prep_time": 30,
    "is_baby_friendly": false,
    "common_allergens": [],
    "can_share_base": false,
    "flavor_profile": "sweet_sour",
    "cook_type": "bake",
    "cook_minutes": 9,
    "ingredients": [
      {
        "name": "鸡中翅",
        "baseAmount": 400,
        "unit": "g",
        "category": "肉类",
        "sub_type": "chicken_wing"
      },
      {
        "name": "蜂蜜",
        "baseAmount": 30,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "生抽",
        "baseAmount": 20,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "老抽",
        "baseAmount": 5,
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
        "name": "姜片",
        "baseAmount": 5,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "蒜瓣",
        "baseAmount": 3,
        "unit": "瓣",
        "category": "调料"
      },
      {
        "name": "盐",
        "baseAmount": 0,
        "unit": "适量",
        "category": "调料"
      },
      {
        "name": "蚝油",
        "baseAmount": 10,
        "unit": "ml",
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
        "text": "鸡中翅洗净，在表面划两刀方便入味，加入料酒、姜片、蒜瓣、盐和少量胡椒粉，腌制30分钟以上。",
        "duration_num": 30
      },
      {
        "action": "cook",
        "text": "将腌制好的鸡中翅放入微波炉专用容器，先在鸡翅表面均匀裹一层蜂蜜，再刷上生抽、老抽和蚝油混合的酱汁。",
        "duration_num": 1
      },
      {
        "action": "cook",
        "text": "高火微波5分钟，取出翻面，再刷一次酱汁，继续高火3分钟。",
        "duration_num": 8
      },
      {
        "action": "cook",
        "text": "鸡翅表面微焦即可取出，稍微静置2分钟让肉汁吸收。",
        "duration_num": 2
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡翅肉泥",
          "action": "取无骨鸡翅肉，去皮后打泥，混入少量粥或面条"
        },
        {
          "max_month": 12,
          "name": "鸡翅肉碎",
          "action": "鸡翅去骨切碎，加少量煮鸡翅的汤汁，拌入软烂辅食"
        },
        {
          "max_month": 36,
          "name": "宝宝版鸡翅",
          "action": "鸡翅用清水加姜片煮熟，不加任何调料，拆肉去骨切小块食用"
        }
      ]
    },
    "tags": [
      "quick",
      "high_protein",
      "party"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_honey_chicken_wings.png"
  },
  {
    "id": "a-shrimp-10",
    "name": "微波蒜蓉蒸虾",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "steamed_salad",
    "meat": "shrimp",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [
      "虾",
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "steam",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "活虾",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "shrimp"
      },
      {
        "name": "大蒜",
        "baseAmount": 4,
        "unit": "瓣",
        "category": "蔬菜",
        "sub_type": "garlic"
      },
      {
        "name": "蒸鱼豉油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "食用油",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "盐",
        "baseAmount": 1,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 5,
        "unit": "ml",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "活虾去头去壳，开背去虾线，用少许盐和料酒腌制3分钟。大蒜剁成蒜蓉。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "将腌制好的虾整齐摆入可微波的深盘中，铺上蒜蓉。",
        "duration_num": 1
      },
      {
        "action": "cook",
        "text": "淋上蒸鱼豉油，盖上保鲜膜并扎几个小孔，高火微波3分钟（可根据微波炉功率适当调整时间）。",
        "duration_num": 3
      },
      {
        "action": "cook",
        "text": "取出撒上葱花，将食用油烧至冒烟后淋上，激发蒜香味，即可享用。",
        "duration_num": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "虾仁泥糊",
          "action": "取微波好的虾仁去掉虾线，用料理机打泥，加少量汤汁调成稠糊状"
        },
        {
          "max_month": 12,
          "name": "虾仁碎末",
          "action": "虾仁切碎，加少量蒸出的汤汁拌匀，混入软烂粥或面条"
        },
        {
          "max_month": 36,
          "name": "宝宝版蒸虾",
          "action": "同大人版但不加盐和料酒，虾切小块，微波时间减少30秒"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "quick",
      "high_protein",
      "steamed",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_garlic_steamed_shrimp.png"
  },
  {
    "id": "a-shrimp-10",
    "name": "微波蒜蓉蒸虾",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "steamed_salad",
    "meat": "shrimp",
    "prep_time": 5,
    "is_baby_friendly": true,
    "common_allergens": [
      "虾",
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "salty_umami",
    "cook_type": "steam",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "活虾",
        "baseAmount": 300,
        "unit": "g",
        "category": "肉类",
        "sub_type": "shrimp"
      },
      {
        "name": "大蒜",
        "baseAmount": 4,
        "unit": "瓣",
        "category": "蔬菜",
        "sub_type": "garlic"
      },
      {
        "name": "蒸鱼豉油",
        "baseAmount": 15,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "食用油",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
      },
      {
        "name": "盐",
        "baseAmount": 1,
        "unit": "g",
        "category": "调料"
      },
      {
        "name": "料酒",
        "baseAmount": 5,
        "unit": "ml",
        "category": "调料"
      }
    ],
    "steps": [
      {
        "action": "prep",
        "text": "活虾去头去壳，开背去虾线，用少许盐和料酒腌制3分钟。大蒜剁成蒜蓉。",
        "duration_num": 5
      },
      {
        "action": "cook",
        "text": "将腌制好的虾整齐摆入可微波的深盘中，铺上蒜蓉。",
        "duration_num": 1
      },
      {
        "action": "cook",
        "text": "淋上蒸鱼豉油，盖上保鲜膜并扎几个小孔，高火微波3分钟（可根据微波炉功率适当调整时间）。",
        "duration_num": 3
      },
      {
        "action": "cook",
        "text": "取出撒上葱花，将食用油烧至冒烟后淋上，激发蒜香味，即可享用。",
        "duration_num": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "虾仁泥糊",
          "action": "取微波好的虾仁去掉虾线，用料理机打泥，加少量汤汁调成稠糊状"
        },
        {
          "max_month": 12,
          "name": "虾仁碎末",
          "action": "虾仁切碎，加少量蒸出的汤汁拌匀，混入软烂粥或面条"
        },
        {
          "max_month": 36,
          "name": "宝宝版蒸虾",
          "action": "同大人版但不加盐和料酒，虾切小块，微波时间减少30秒"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "quick",
      "high_protein",
      "steamed",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_garlic_steamed_shrimp.png"
  },
  {
    "id": "a-veg-52",
    "name": "微波鸡蛋羹",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 3,
    "is_baby_friendly": true,
    "common_allergens": [
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "鸡蛋",
        "baseAmount": 2,
        "unit": "个",
        "category": "蛋类"
      },
      {
        "name": "温水",
        "baseAmount": 200,
        "unit": "ml",
        "category": "其他"
      },
      {
        "name": "生抽",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "香油",
        "baseAmount": 5,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
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
        "text": "鸡蛋打散，加入温水（水温约40度）和适量盐，蛋液与水比例约1:1，搅拌均匀后撇去表面气泡。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "将蛋液倒入可微波的深碗中，盖上保鲜膜并扎2-3个小孔确保透气，先高火微波2分钟，取出检查凝固程度，若未完全凝固再高火微波1分钟。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "取出淋上生抽和香油，撒上葱花，即可食用。",
        "duration_minutes": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡蛋黄泥",
          "action": "只取熟蛋黄压成泥，加入少量温开水调成稠糊状"
        },
        {
          "max_month": 12,
          "name": "鸡蛋羹碎",
          "action": "全蛋液制作但不加调味料，出锅后切碎成小块"
        },
        {
          "max_month": 36,
          "name": "宝宝鸡蛋羹",
          "action": "同大人版少盐，香油减量，蒸至完全凝固无蜂窝"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "quick",
      "light",
      "steamed",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_steamed_egg.png"
  },
  {
    "id": "a-veg-52",
    "name": "微波鸡蛋羹",
    "type": "adult",
    "dish_type": "steamed",
    "taste": "steamed_salad",
    "meat": "vegetable",
    "prep_time": 3,
    "is_baby_friendly": true,
    "common_allergens": [
      "蛋"
    ],
    "can_share_base": true,
    "flavor_profile": "light",
    "cook_type": "steam",
    "cook_minutes": 5,
    "ingredients": [
      {
        "name": "鸡蛋",
        "baseAmount": 2,
        "unit": "个",
        "category": "蛋类"
      },
      {
        "name": "温水",
        "baseAmount": 200,
        "unit": "ml",
        "category": "其他"
      },
      {
        "name": "生抽",
        "baseAmount": 10,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "香油",
        "baseAmount": 5,
        "unit": "ml",
        "category": "调料"
      },
      {
        "name": "葱花",
        "baseAmount": 5,
        "unit": "g",
        "category": "蔬菜"
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
        "text": "鸡蛋打散，加入温水（水温约40度）和适量盐，蛋液与水比例约1:1，搅拌均匀后撇去表面气泡。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "将蛋液倒入可微波的深碗中，盖上保鲜膜并扎2-3个小孔确保透气，先高火微波2分钟，取出检查凝固程度，若未完全凝固再高火微波1分钟。",
        "duration_minutes": 3
      },
      {
        "action": "cook",
        "text": "取出淋上生抽和香油，撒上葱花，即可食用。",
        "duration_minutes": 1
      }
    ],
    "baby_variant": {
      "stages": [
        {
          "max_month": 8,
          "name": "鸡蛋黄泥",
          "action": "只取熟蛋黄压成泥，加入少量温开水调成稠糊状"
        },
        {
          "max_month": 12,
          "name": "鸡蛋羹碎",
          "action": "全蛋液制作但不加调味料，出锅后切碎成小块"
        },
        {
          "max_month": 36,
          "name": "宝宝鸡蛋羹",
          "action": "同大人版少盐，香油减量，蒸至完全凝固无蜂窝"
        }
      ]
    },
    "tags": [
      "ultra_quick",
      "quick",
      "light",
      "steamed",
      "baby_friendly"
    ],
    "base_serving": 2,
    "coverFileID": "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/adults_recipes/microwave_steamed_egg.png"
  }
];

var babyRecipes = [
  {"id":"b-chi-detail","name":"板栗鲜鸡泥","type":"baby","meat":"chicken","taste":"finger_food","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-fish-detail","name":"柠檬清蒸鳕鱼","type":"baby","meat":"fish","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["鱼"]},
  {"id":"b-pork-detail","name":"山药瘦肉末","type":"baby","meat":"pork","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[]},
  {"id":"b-pork-2","name":"猪肉土豆小软饼","type":"baby","meat":"pork","taste":"finger_food","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[]},
  {"id":"b-pork-3","name":"猪肉白菜南瓜烩面","type":"baby","meat":"pork","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-pork-4","name":"山药排骨碎碎粥","type":"baby","meat":"pork","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["山药（接触时注意）"]},
  {"id":"b-shrimp-detail","name":"西兰花虾仁滑","type":"baby","meat":"shrimp","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["虾"]},
  {"id":"b-beef-detail","name":"番茄牛肉软饭","type":"baby","meat":"beef","taste":"finger_food","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-beef-2","name":"土豆牛肉泥","type":"baby","meat":"beef","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-shrimp-2","name":"虾仁豆腐饼","type":"baby","meat":"shrimp","taste":"finger_food","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["虾"]},
  {"id":"b-fish-2","name":"鱼肉碎碎面","type":"baby","meat":"fish","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["鱼"]},
  {"id":"b-pork-5","name":"南瓜猪肉烩饭","type":"baby","meat":"pork","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-pork-6","name":"里脊时蔬软面","type":"baby","meat":"pork","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[]},
  {"id":"b-chi-3","name":"鸡肉土豆泥","type":"baby","meat":"chicken","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-chi-4","name":"鸡肉西兰花饼","type":"baby","meat":"chicken","taste":"finger_food","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[]},
  {"id":"b-beef-3","name":"牛肉山药粥","type":"baby","meat":"beef","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":[]},
  {"id":"b-beef-4","name":"土豆牛肉软饭","type":"baby","meat":"beef","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-fish-3","name":"清蒸鱼肉泥","type":"baby","meat":"fish","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["鱼"]},
  {"id":"b-shrimp-4","name":"虾仁蒸蛋","type":"baby","meat":"shrimp","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["虾","蛋"]},
  {"id":"b-chi-5","name":"南瓜鸡肉碎碎粥","type":"baby","meat":"chicken","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":[]},
  {"id":"b-chi-6","name":"番茄鸡肉蝴蝶面","type":"baby","meat":"chicken","taste":"soft_porridge","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["麸质"]},
  {"id":"b-fish-4","name":"鳕鱼土豆小软饼","type":"baby","meat":"fish","taste":"finger_food","prep_time":15,"is_baby_friendly":true,"can_share_base":false,"common_allergens":["鱼","蛋"]},
  {"id":"b-shrimp-5","name":"番茄虾仁烩饭","type":"baby","meat":"shrimp","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["虾"]},
  {"id":"b-shrimp-6","name":"西兰花虾仁豆腐烩面","type":"baby","meat":"shrimp","taste":"braised_mash","prep_time":10,"is_baby_friendly":true,"can_share_base":true,"common_allergens":["虾"]}
];

module.exports = { adultRecipes, babyRecipes };
