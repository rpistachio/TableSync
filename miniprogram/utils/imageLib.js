// miniprogram/utils/imageLib.js
// 图片“过滤器”：找不到图时返回默认图，避免页面白屏或报错

const { IMAGE_CONFIG } = require('../data/recipeResources.js');

/**
 * 根据菜名和类型返回菜谱封面图 URL，无匹配时返回默认图
 * @param {string} name - 菜名（中文）
 * @param {string} type - 'adult' | 'baby'
 * @returns {string} 云存储图片 URL
 */
function getRecipeImage(name, type) {
  type = type || 'adult';
  if (!name) return IMAGE_CONFIG.defaultCover;

  const folder = type === 'baby' ? IMAGE_CONFIG.folders.babies : IMAGE_CONFIG.folders.adults;
  const slug = type === 'baby' ? name : IMAGE_CONFIG.adultSlugs[name]; // 宝宝餐目前简单匹配

  if (slug) {
    return `${folder}${slug}.jpg`;
  }
  return IMAGE_CONFIG.defaultCover;
}

/**
 * 获取页面固定头图 URL
 * @param {string} page - 页面标识，如 'shopping' | 'prep'
 * @returns {string} 云存储图片 URL
 */
function getPageCover(page) {
  return IMAGE_CONFIG.pageCovers[page] || IMAGE_CONFIG.defaultCover;
}

module.exports = {
  getRecipeImage: getRecipeImage,
  getPageCover: getPageCover
};
