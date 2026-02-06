/**
 * 几荤几素套餐选项算法（Logic 层）
 * 供 data/menuGenerator.js 统一导出，页面只做 UI 绑定。
 */

/**
 * 餐厅套餐思路：场景化 + 结构完整 + 汤品刚需。
 * 各人数档均以「带汤」组合为主，兼顾 1素1汤（素食/减脂）、1荤2素（清淡）、3荤3素1汤（丰盛）。
 * @param {number} count - 人数
 * @returns {Array} combo 选项数组
 */
function getComboOptionsForCount(count) {
  var n = Math.min(6, Math.max(1, Number(count) || 2));
  if (n === 1) {
    return [
      { label: '1荤1素1汤', meatCount: 1, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤1素', meatCount: 2, vegCount: 1, soupCount: 0, tag: '' },
      { label: '1素1汤', meatCount: 0, vegCount: 1, soupCount: 1, tag: '减脂' }
    ];
  }
  if (n === 2) {
    return [
      { label: '1荤1素1汤', meatCount: 1, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '丰盛' },
      { label: '2荤1素', meatCount: 2, vegCount: 1, soupCount: 0, tag: '' },
      { label: '1荤2素', meatCount: 1, vegCount: 2, soupCount: 1, tag: '清淡' }
    ];
  }
  if (n === 3) {
    return [
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤2素', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '1荤2素1汤', meatCount: 1, vegCount: 2, soupCount: 1, tag: '清淡' }
    ];
  }
  if (n === 4) {
    return [
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '3荤2素1汤', meatCount: 3, vegCount: 2, soupCount: 1, tag: '丰盛' }
    ];
  }
  return [
    { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
    { label: '3荤2素1汤', meatCount: 3, vegCount: 2, soupCount: 1, tag: '' },
    { label: '3荤3素1汤', meatCount: 3, vegCount: 3, soupCount: 1, tag: '丰盛' }
  ];
}

/**
 * 判断当前 meatCount/vegCount/soupCount 是否在选项列表中
 * @param {number} meatCount
 * @param {number} vegCount
 * @param {number} soupCount
 * @param {Array} options - getComboOptionsForCount 返回的数组
 * @returns {boolean}
 */
function findComboInList(meatCount, vegCount, soupCount, options) {
  var s = soupCount != null ? soupCount : 0;
  for (var i = 0; i < options.length; i++) {
    var o = options[i];
    if (o.meatCount === meatCount && o.vegCount === vegCount && (o.soupCount != null ? o.soupCount : 0) === s) return true;
  }
  return false;
}

module.exports = {
  getComboOptionsForCount: getComboOptionsForCount,
  findComboInList: findComboInList
};
