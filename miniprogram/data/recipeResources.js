// miniprogram/data/recipeResources.js
// 统一管理云端图片路径

const CLOUD_ROOT = "cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193";

const IMAGE_CONFIG = {
  // 基础文件夹路径
  folders: {
    adults: `${CLOUD_ROOT}/adults_recipes/`,
    babies: `${CLOUD_ROOT}/babies_recipes/`,
    prep: `${CLOUD_ROOT}/prep_cover_pic/`,
    shopping: `${CLOUD_ROOT}/shopping_cover_pic/`
  },

  // 默认兜底图
  defaultCover: `${CLOUD_ROOT}/basic_cut_0_3_ar4.5.jpeg`,

  // 页面固定头图
  pageCovers: {
    shopping: `${CLOUD_ROOT}/shopping_cover_pic/basic-prep-01.png`,
    prep: `${CLOUD_ROOT}/prep_cover_pic/basic-veg-cut-01.jpeg`
  },

  // 大人菜名 -> 英文文件名 (Slug) 映射表
  adultSlugs: {
    '花旗参石斛炖鸡汤': 'double-boiled-chicken-soup-with-ginseng-and-dendrobium',
    '五指毛桃排骨汤': 'pork-rib-soup-with-hairy-fig-root',
    '鲜淮山炖牛肉汤': 'beef-soup-with-fresh-yam',
    '清蒸柠檬鸡里脊': 'steamed-lemon-chicken-fillet',
    '宫保鸡丁': 'kung-pao-chicken-with-peanuts',
    '清蒸鳕鱼配葱丝': 'steamed-cod-with-scallions-and-ginger',
    '蒜蓉粉丝蒸虾': 'steamed-prawns-with-garlic-and-vermicelli',
    '杭椒牛柳': 'stir-fried-beef-with-long-green-peppers',
    '玉米排骨汤': 'pork-rib-soup-with-corn',
    '番茄牛腩': 'stewed-beef-brisket-with-tomatoes'
  }
};

module.exports = {
  CLOUD_ROOT,
  IMAGE_CONFIG
};
