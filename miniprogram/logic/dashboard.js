/**
 * 预览页仪表盘与展示行算法（Logic 层）
 * 供 data/menuGenerator.js 统一导出，页面只做 UI 绑定。
 */

/**
 * 根据当前菜单计算仪表盘：预计耗时、灶台占用、食材种类、营养提示、备菜与烹饪顺序建议、共用食材提示
 * @param {Array} menus - 完整菜单数组
 * @param {Object} pref - 偏好（可选，预留）
 * @returns {Object} dashboard 对象
 */
function computePreviewDashboard(menus, pref) {
  if (!menus || menus.length === 0) {
    return { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' };
  }
  var maxMinutes = 0;
  var maxPrep = 0;
  var hasStirFry = false, hasStew = false, hasSteam = false;
  var catSet = {};
  var catOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 3, '干货': 4, '其他': 5 };
  for (var i = 0; i < menus.length; i++) {
    var r = menus[i].adultRecipe;
    if (!r) continue;
    var prep = typeof r.prep_time === 'number' ? r.prep_time : 0;
    if (prep > maxPrep) maxPrep = prep;
    var cook = r.cook_minutes != null ? r.cook_minutes : (r.taste === 'slow_stew' ? 60 : 15);
    if (prep + cook > maxMinutes) maxMinutes = prep + cook;
    var ct = r.cook_type || '';
    if (ct === 'stir_fry') hasStirFry = true;
    else if (ct === 'stew') hasStew = true;
    else if (ct === 'steam') hasSteam = true;
    var ings = r.ingredients;
    if (Array.isArray(ings)) {
      for (var j = 0; j < ings.length; j++) {
        var c = (ings[j] && ings[j].category) ? String(ings[j].category).trim() : '';
        if (c && c !== '调料') catSet[c] = (catOrder[c] != null ? catOrder[c] : 99);
      }
    }
    var br = menus[i].babyRecipe;
    if (br && Array.isArray(br.ingredients)) {
      for (var k = 0; k < br.ingredients.length; k++) {
        var bc = (br.ingredients[k] && br.ingredients[k].category) ? String(br.ingredients[k].category).trim() : '';
        if (bc && bc !== '调料') catSet[bc] = (catOrder[bc] != null ? catOrder[bc] : 99);
      }
    }
  }
  var estimatedMinutes = maxMinutes + 10;
  var stoveCount = (hasStirFry ? 1 : 0) + (hasStew ? 1 : 0) + (hasSteam ? 1 : 0);
  var cats = Object.keys(catSet).sort(function (a, b) { return (catSet[a] || 99) - (catSet[b] || 99); });
  var categoryLabels = cats.length > 0 ? cats.join('、') : '';
  var nutritionParts = [];
  if (cats.indexOf('肉类') !== -1 || cats.indexOf('蛋类') !== -1) nutritionParts.push('蛋白质');
  if (cats.indexOf('蔬菜') !== -1) nutritionParts.push('维生素与膳食纤维');
  if (cats.indexOf('干货') !== -1) nutritionParts.push('多种营养素');
  if (cats.indexOf('其他') !== -1 && nutritionParts.length === 0) nutritionParts.push('多种营养素');
  var nutritionHint = nutritionParts.length > 0 ? '本餐营养覆盖：' + nutritionParts.join('、') : '';
  var orderParts = [];
  if (hasStew) orderParts.push('炖/煲');
  if (hasSteam) orderParts.push('蒸');
  if (hasStirFry) orderParts.push('快炒');
  var prepOrderHint = orderParts.length >= 2 ? '烹饪顺序建议：' + orderParts.join('→') : '';
  var prepAheadHint = '';
  if (maxPrep >= 10) prepAheadHint = '备菜建议：可提前约 ' + maxPrep + ' 分钟准备葱姜蒜及腌制食材，下锅更从容';
  var sharedIngredientsHint = '';
  var ingCount = {};
  for (var si = 0; si < menus.length; si++) {
    var rec = menus[si].adultRecipe;
    if (!rec || !Array.isArray(rec.ingredients)) continue;
    var seen = {};
    for (var sj = 0; sj < rec.ingredients.length; sj++) {
      var ing = rec.ingredients[sj];
      if (!ing || (ing.category && String(ing.category).trim() === '调料')) continue;
      var n = (ing.name && String(ing.name).trim()) || '';
      if (n && !seen[n]) { seen[n] = true; ingCount[n] = (ingCount[n] || 0) + 1; }
    }
  }
  var shared = [];
  for (var name in ingCount) { if (ingCount[name] >= 2) shared.push(name); }
  if (shared.length > 0) {
    shared = shared.slice(0, 6);
    sharedIngredientsHint = '本餐可共用：' + shared.join('、') + '，备菜更省';
  }
  return {
    estimatedTime: estimatedMinutes > 0 ? estimatedMinutes + ' 分钟' : '',
    stoveCount: stoveCount,
    categoryLabels: categoryLabels,
    nutritionHint: nutritionHint,
    prepOrderHint: prepOrderHint,
    prepAheadHint: prepAheadHint,
    sharedIngredientsHint: sharedIngredientsHint
  };
}

/**
 * 根据菜单口味计算平衡提示文案
 * @param {Array} menus - 完整菜单数组
 * @returns {string}
 */
function computeBalanceTip(menus) {
  if (!menus || menus.length === 0) return '';
  var hasSpicy = false, hasLightOrSweet = false;
  for (var b = 0; b < menus.length; b++) {
    var fl = (menus[b].adultRecipe && menus[b].adultRecipe.flavor_profile) || '';
    if (fl === 'spicy') hasSpicy = true;
    if (fl === 'light' || fl === 'sweet_sour' || fl === 'sour_fresh') hasLightOrSweet = true;
  }
  return (hasSpicy && hasLightOrSweet) ? '口味互补：辣配清淡/酸甜，味觉更舒适' : '';
}

/**
 * 将完整菜单转为预览行（供列表展示）
 * @param {Array} menus - 完整菜单数组
 * @param {Object} pref - 偏好 { hasBaby, babyMonth }
 * @param {Function} getBabyVariantByAge - (adultRecipe, babyMonth) => stage
 * @returns {Array} rows 数组，每项含 adultName, babyName, showSharedHint, checked, recommendReason, sameAsAdultHint
 */
function menusToPreviewRows(menus, pref, getBabyVariantByAge) {
  if (!Array.isArray(menus)) return [];
  var hasBaby = pref && (pref.hasBaby === true || pref.hasBaby === '1');
  var babyMonth = (pref && pref.babyMonth != null) ? pref.babyMonth : 12;
  var getStage = typeof getBabyVariantByAge === 'function' ? getBabyVariantByAge : function () { return null; };
  var rows = [];
  for (var idx = 0; idx < menus.length; idx++) {
    var m = menus[idx];
    var ar = m.adultRecipe;
    var adultName = (ar && ar.name) ? ar.name : '—';
    var stage = hasBaby ? getStage(ar, babyMonth) : null;
    var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
    var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : '';
    var sameAsAdultHint = (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '';
    rows.push({
      adultName: adultName,
      babyName: babyName,
      showSharedHint: hasBaby && babyName && idx === 0,
      checked: m.checked !== false,
      recommendReason: reason,
      sameAsAdultHint: sameAsAdultHint
    });
  }
  return rows;
}

module.exports = {
  computePreviewDashboard: computePreviewDashboard,
  computeBalanceTip: computeBalanceTip,
  menusToPreviewRows: menusToPreviewRows
};
