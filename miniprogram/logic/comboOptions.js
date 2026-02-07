/**
 * 几荤几素套餐选项算法（Logic 层）
 * 汤品已分离为独立参数，此处仅提供纯荤素搭配选项。
 * 营养推荐基于《中国居民膳食指南（2022）》与 DRIs 2023。
 */

/**
 * 纯荤素套餐选项（不含汤），标签基于营养逻辑。
 * @param {number} count - 人数
 * @returns {Array} combo 选项数组 { label, meatCount, vegCount, tag?, recommended? }
 */
function getComboOptionsForCount(count) {
  var n = Math.min(6, Math.max(1, Number(count) || 2));
  if (n === 1) {
    return [
      { label: '1荤1素', meatCount: 1, vegCount: 1, tag: '均衡', recommended: true },
      { label: '2荤1素', meatCount: 2, vegCount: 1, tag: '高蛋白' },
      { label: '1素', meatCount: 0, vegCount: 1, tag: '减脂' }
    ];
  }
  if (n === 2) {
    return [
      { label: '1荤1素', meatCount: 1, vegCount: 1, tag: '均衡', recommended: true },
      { label: '2荤1素', meatCount: 2, vegCount: 1, tag: '高蛋白' },
      { label: '1荤2素', meatCount: 1, vegCount: 2, tag: '多素' }
    ];
  }
  if (n === 3) {
    return [
      { label: '2荤1素', meatCount: 2, vegCount: 1, tag: '均衡', recommended: true },
      { label: '2荤2素', meatCount: 2, vegCount: 2, tag: '丰盛' },
      { label: '1荤2素', meatCount: 1, vegCount: 2, tag: '多素' }
    ];
  }
  if (n === 4) {
    return [
      { label: '2荤1素', meatCount: 2, vegCount: 1, tag: '' },
      { label: '2荤2素', meatCount: 2, vegCount: 2, tag: '均衡', recommended: true },
      { label: '3荤2素', meatCount: 3, vegCount: 2, tag: '高蛋白' }
    ];
  }
  // 5-6 人
  return [
    { label: '2荤2素', meatCount: 2, vegCount: 2, tag: '' },
    { label: '3荤2素', meatCount: 3, vegCount: 2, tag: '均衡', recommended: true },
    { label: '3荤3素', meatCount: 3, vegCount: 3, tag: '丰盛' }
  ];
}

/**
 * 基于膳食指南的营养推荐文案（每人每餐约 35% 日需）。
 * @param {number} adultCount - 大人人数
 * @returns {string}
 */
function getNutritionTip(adultCount) {
  var n = Math.min(6, Math.max(1, Number(adultCount) || 2));
  var tips = {
    1: '1 位成年人每餐约需蛋白质 40-70g、蔬菜 100-150g，推荐 1荤1素',
    2: '2 位成年人每餐约需蛋白质 80-140g、蔬菜 200-300g，推荐 1-2荤1素',
    3: '3 位成年人每餐约需蛋白质 120-210g、蔬菜 300-450g，推荐 2荤1素～2荤2素',
    4: '4 位成年人每餐约需蛋白质 160-280g、蔬菜 400-600g，推荐 2荤2素～3荤2素',
    5: '5 位成年人每餐约需蛋白质 200-350g、蔬菜 500-750g，推荐 3荤2素～3荤3素',
    6: '6 位成年人每餐约需蛋白质 240-420g、蔬菜 600-900g，推荐 3荤2素～3荤3素'
  };
  return tips[n] || tips[2];
}

/**
 * 返回当前人数下推荐的默认 combo 索引（0-based）。
 * @param {number} adultCount - 大人人数
 * @returns {number}
 */
function getRecommendedComboIndex(adultCount) {
  var options = getComboOptionsForCount(adultCount);
  for (var i = 0; i < options.length; i++) {
    if (options[i].recommended) return i;
  }
  return 0;
}

/**
 * 判断当前 meatCount/vegCount 是否在选项列表中（汤品已分离，不参与匹配）。
 * @param {number} meatCount
 * @param {number} vegCount
 * @param {Array} options - getComboOptionsForCount 返回的数组
 * @returns {boolean}
 */
function findComboInList(meatCount, vegCount, options) {
  if (!Array.isArray(options)) return false;
  for (var i = 0; i < options.length; i++) {
    var o = options[i];
    if (o.meatCount === meatCount && o.vegCount === vegCount) return true;
  }
  return false;
}

module.exports = {
  getComboOptionsForCount: getComboOptionsForCount,
  getNutritionTip: getNutritionTip,
  getRecommendedComboIndex: getRecommendedComboIndex,
  findComboInList: findComboInList
};
