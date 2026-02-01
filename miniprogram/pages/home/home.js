function getCurrentDate() {
  var d = new Date();
  var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
}

function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

Page({
  data: {
    currentDate: getCurrentDate(),
    adultCount: 2,
    adultCountOptions: [1, 2, 3, 4, 5, 6],
    comboOptions: [
      { label: '1荤1素', meatCount: 1, vegCount: 1 },
      { label: '2荤1素', meatCount: 2, vegCount: 1 },
      { label: '2荤2素', meatCount: 2, vegCount: 2 }
    ],
    meatCount: 1,
    vegCount: 1,
    hasBaby: false,
    babyMonth: 12,
    babyAgeOptions: [
      { label: '6-8月', sub: '泥糊', value: 8 },
      { label: '9-12月', sub: '末/碎', value: 12 },
      { label: '13-18月', sub: '小丁', value: 18 },
      { label: '19-24月', sub: '小块', value: 24 },
      { label: '25-36月', sub: '正常块', value: 36 }
    ],
    showPreview: false,
    previewMenus: [],
    previewMenuRows: [],
    previewCountText: '',
    previewComboName: '',
    previewBalanceTip: '',
    previewDashboard: { estimatedTime: '', stoveCount: 0, categoryLabels: '' },
    previewHasSharedBase: false
  },

  onLoad: function () {
    var todayKey = getTodayDateKey();
    var storedKey = wx.getStorageSync('menu_generated_date') || '';
    if (storedKey && storedKey !== todayKey) {
      wx.removeStorageSync('today_menus');
      wx.removeStorageSync('menu_generated_date');
      wx.removeStorageSync('cart_ingredients');
      wx.removeStorageSync('selected_dish_name');
      wx.removeStorageSync('today_prep_time');
      wx.removeStorageSync('today_allergens');
    }
    var app = getApp();
    var pref = (app && app.globalData && app.globalData.preference) || {};
    var storedMonth = pref.babyMonth != null ? Number(pref.babyMonth) : 12;
    var normalized = storedMonth <= 8 ? 8 : storedMonth <= 12 ? 12 : storedMonth <= 18 ? 18 : storedMonth <= 24 ? 24 : 36;
    if (normalized !== this.data.babyMonth) this.setData({ babyMonth: normalized });
  },

  onHasBabyChange: function (e) {
    this.setData({ hasBaby: e.detail.value === true || e.detail.value === 'true' });
  },

  onBabyAgeTap: function (e) {
    var value = parseInt(e.currentTarget.dataset.value, 10);
    if (value >= 6 && value <= 36) this.setData({ babyMonth: value });
  },

  onAdultCountTap: function (e) {
    var count = parseInt(e.currentTarget.dataset.count, 10);
    if (count >= 1 && count <= 6) this.setData({ adultCount: count });
  },

  onComboTap: function (e) {
    var meat = parseInt(e.currentTarget.dataset.meat, 10);
    var veg = parseInt(e.currentTarget.dataset.veg, 10);
    this.setData({ meatCount: meat, vegCount: veg });
  },

  handleGenerate: function () {
    var that = this;
    if (that._generating) return;
    that._generating = true;
    wx.showLoading({ title: '统筹算法运行中', mask: true });
    // 延后执行，让 Loading 先渲染，避免点击后界面卡死
    setTimeout(function () {
      try {
        var menuService = require('../../data/menuData.js');
        var pref = that._buildPreference();
        var result = menuService.getTodayMenusByCombo(pref);
        var menus = result.menus || result;
        var hasBaby = pref.hasBaby === true;
        var countText = pref.adultCount + '个大人';
        if (hasBaby) countText += '，1个宝宝';
        var rows = [];
        for (var i = 0; i < menus.length; i++) {
          var m = menus[i];
          m.checked = true;
          if (!hasBaby) m.babyRecipe = null;
          var ar = m.adultRecipe;
          var adultName = (ar && ar.name) ? ar.name : '—';
          var stage = hasBaby && menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
          var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
          var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : '';
          rows.push({ adultName: adultName, babyName: babyName, showSharedHint: hasBaby && babyName && i === 0, checked: true, recommendReason: reason });
        }
        that._fullPreviewMenus = menus;
        var dashboard = that._computePreviewDashboard(menus, pref);
        var hasSharedBase = rows.some(function (r) { return r.showSharedHint; });
        that.setData({
          showPreview: true,
          previewMenuRows: rows,
          previewCountText: countText,
          previewComboName: result.comboName || '',
          previewBalanceTip: '',
          previewDashboard: dashboard,
          previewHasSharedBase: hasSharedBase
        });
      } catch (e) {
        console.error('生成失败:', e);
        wx.showModal({ title: '提示', content: (e && e.message ? e.message : String(e)), showCancel: false });
      } finally {
        that._generating = false;
        wx.hideLoading();
      }
    }, 80);
  },

  handleShuffle: function () {
    var that = this;
    var rows = that.data.previewMenuRows || [];
    var hasUnchecked = rows.some(function (r) { return !r.checked; });
    if (hasUnchecked) {
      that.handleReplaceUnchecked();
      return;
    }
    try {
      var menuService = require('../../data/menuData.js');
      var pref = that._buildPreference();
      var result = menuService.getTodayMenusByCombo(pref);
      var rawMenus = result.menus || result;
      var hasBaby = pref.hasBaby === true;
      if (!hasBaby) rawMenus.forEach(function (m) { m.babyRecipe = null; });
      var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
      var newRows = [];
      for (var idx = 0; idx < newMenus.length; idx++) {
        var m = newMenus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : '';
        newRows.push({ adultName: adultName, babyName: babyName, showSharedHint: hasBaby && babyName && idx === 0, checked: true, recommendReason: reason });
      }
      that._fullPreviewMenus = newMenus;
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
      that.setData({ previewMenuRows: newRows, previewComboName: result.comboName || '', previewBalanceTip: '', previewDashboard: dashboard, previewHasSharedBase: hasSharedBase });
    } catch (e) {
      console.error('换一换失败:', e);
      wx.showToast({ title: '换一换失败', icon: 'none' });
    }
  },

  onCheckRow: function (e) {
    e.stopPropagation && e.stopPropagation();
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var menus = this._fullPreviewMenus || [];
    var rows = (this.data.previewMenuRows || []).slice();
    if (!menus[index] || !rows[index]) return;
    var newChecked = !menus[index].checked;
    menus[index].checked = newChecked;
    rows[index] = Object.assign({}, rows[index], { checked: newChecked });
    this.setData({ previewMenuRows: rows });
  },

  handleReplaceUnchecked: function () {
    var that = this;
    var menus = that._fullPreviewMenus || [];
    var rows = that.data.previewMenuRows || [];
    if (menus.length === 0 || rows.length === 0) return;
    var uncheckedIndices = [];
    for (var u = 0; u < rows.length; u++) {
      if (!rows[u].checked) uncheckedIndices.push(u);
    }
    if (uncheckedIndices.length === 0) {
      wx.showToast({ title: '请先取消勾选要换掉的菜品', icon: 'none' });
      return;
    }
    var pref = that._buildPreference();
    var hasBaby = pref.hasBaby;
    var babyMonth = pref.babyMonth;
    var adultCount = pref.adultCount;
    var firstMeatIndex = -1;
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].meat !== 'vegetable') { firstMeatIndex = i; break; }
    }
    try {
      var generator = require('../../data/menuGenerator.js');
      var menuService = require('../../data/menuData.js');
      var selectedMenus = [];
      var checkedMeats = [];
      for (var j = 0; j < menus.length; j++) {
        if (rows[j].checked) {
          selectedMenus.push(menus[j]);
          var m = (menus[j].adultRecipe && menus[j].adultRecipe.meat) || menus[j].meat;
          if (m && checkedMeats.indexOf(m) === -1) checkedMeats.push(m);
        }
      }
      var counts = menuService.getFlavorAndCookCounts(selectedMenus);
      var forceLight = (counts.spicy + counts.savory) > 2;
      var curStirFry = counts.stirFry;
      var curStew = counts.stew;
      var balanceTip = '';
      if (forceLight) balanceTip = '当前偏重下饭，已为您补充清爽汤品';
      else if (curStew >= 1) balanceTip = '已有炖菜，已为您补充快手小炒';
      var newMenus = [];
      var newRows = [];
      for (var i = 0; i < menus.length; i++) {
        if (rows[i].checked) {
          newMenus.push(menus[i]);
          newRows.push(rows[i]);
        } else {
          var hasBabyThis = hasBaby && menus[i].meat !== 'vegetable' && i === firstMeatIndex;
          var constraints = { forceLight: forceLight, currentStirFry: curStirFry, currentStew: curStew, excludeMeats: checkedMeats };
          var picked = menuService.pickReplacementFromCache(menus[i].meat, constraints);
          var res;
          if (picked) {
            res = generator.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
          } else {
            var filters = { preferredFlavor: forceLight ? 'light' : null, preferQuick: curStew >= 1 };
            res = generator.generateMenuWithFilters(menus[i].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
          }
          var newSlot = {
            meat: (res.adultRecipe && res.adultRecipe.meat) || menus[i].meat,
            taste: (res.adultRecipe && res.adultRecipe.taste) || menus[i].taste,
            adultRecipe: res.adultRecipe || null,
            babyRecipe: res.babyRecipe || null,
            checked: true
          };
          newMenus.push(newSlot);
          if (newSlot.adultRecipe) {
            var ct = newSlot.adultRecipe.cook_type || '';
            if (ct === 'stir_fry') curStirFry++;
            else if (ct === 'stew') curStew++;
          }
          var ar = newSlot.adultRecipe;
          newRows.push({
            adultName: (ar && ar.name) ? ar.name : '—',
            babyName: (function () { var st = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth); return (st && st.name) || (newSlot.babyRecipe && newSlot.babyRecipe.name) || ''; })(),
            showSharedHint: hasBaby && newSlot.babyRecipe && i === firstMeatIndex,
            checked: true,
            recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : ''
          });
        }
      }
      that._fullPreviewMenus = newMenus;
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
      that.setData({ previewMenuRows: newRows, previewBalanceTip: balanceTip, previewDashboard: dashboard, previewHasSharedBase: hasSharedBase });
      wx.showToast({ title: '已为您选出更均衡的搭配', icon: 'none' });
    } catch (e) {
      console.error('换掉未勾选失败:', e);
      wx.showToast({ title: '替换失败', icon: 'none' });
    }
  },

  confirmAndGo: function () {
    var that = this;
    var menus = that._fullPreviewMenus || that.data.previewMenus;
    if (!menus || menus.length === 0) {
      wx.showToast({ title: '请先生成菜单', icon: 'none' });
      return;
    }
    try {
      var menuService = require('../../data/menuData.js');
      var pref = that._buildPreference();
      var shoppingList = menuService.generateShoppingListFromMenus(pref, menus);

      wx.setStorageSync('cart_ingredients', shoppingList || []);
      wx.setStorageSync('today_menus', JSON.stringify(menus));
      wx.setStorageSync('menu_generated_date', getTodayDateKey());

      var dishNames = [];
      menus.forEach(function (m) {
        if (m.adultRecipe && m.adultRecipe.name) dishNames.push(m.adultRecipe.name);
      });
      wx.setStorageSync('selected_dish_name', dishNames.length > 0 ? dishNames.join('、') : '定制食谱');

      var prepTime = 0;
      var allergens = [];
      menus.forEach(function (m) {
        [m.adultRecipe, m.babyRecipe].forEach(function (r) {
          if (!r) return;
          if (typeof r.prep_time === 'number' && r.prep_time > prepTime) prepTime = r.prep_time;
          if (Array.isArray(r.common_allergens)) r.common_allergens.forEach(function (a) { if (a && allergens.indexOf(a) === -1) allergens.push(a); });
        });
      });
      wx.setStorageSync('today_prep_time', prepTime);
      wx.setStorageSync('today_allergens', JSON.stringify(allergens));

      var weeklyPrefs = [];
      for (var i = 0; i < 7; i++) {
        weeklyPrefs.push({ adultCount: pref.adultCount, hasBaby: pref.hasBaby, babyMonth: pref.babyMonth, meatCount: pref.meatCount, vegCount: pref.vegCount });
      }
      var weeklyList = menuService.generateWeeklyShoppingList(weeklyPrefs);
      wx.setStorageSync('weekly_ingredients', weeklyList || []);

      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.mergedShoppingList = shoppingList;
      try {
        var getStepsKey = require('../steps/steps.js').stepsStorageKey;
        if (typeof getStepsKey === 'function') wx.removeStorageSync(getStepsKey());
      } catch (e) {}
      that.setData({ showPreview: false });
      wx.navigateTo({ url: '/pages/shopping/shopping' });
    } catch (e) {
      console.error('开始做饭失败:', e);
      wx.showModal({ title: '提示', content: (e && e.message ? e.message : String(e)), showCancel: false });
    }
  },

  closePreview: function () {
    this.setData({ showPreview: false });
  },

  _buildPreference: function () {
    var d = this.data;
    var hasBaby = d.hasBaby === true || d.hasBaby === 'true';
    return {
      adultCount: Math.min(6, Math.max(1, d.adultCount || 2)),
      hasBaby: !!hasBaby,
      babyMonth: Math.min(36, Math.max(6, d.babyMonth)),
      meatCount: d.meatCount,
      vegCount: d.vegCount
    };
  },

  /** 根据当前菜单计算仪表盘：预计耗时、灶台占用、食材种类 */
  _computePreviewDashboard: function (menus, pref) {
    if (!menus || menus.length === 0) return { estimatedTime: '', stoveCount: 0, categoryLabels: '' };
    var maxMinutes = 0;
    var hasStirFry = false, hasStew = false, hasSteam = false;
    var catSet = {};
    var catOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 3, '干货': 4, '其他': 5 };
    for (var i = 0; i < menus.length; i++) {
      var r = menus[i].adultRecipe;
      if (!r) continue;
      var prep = typeof r.prep_time === 'number' ? r.prep_time : 0;
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
    return {
      estimatedTime: estimatedMinutes > 0 ? estimatedMinutes + ' 分钟' : '',
      stoveCount: stoveCount,
      categoryLabels: cats.length > 0 ? cats.join('、') : ''
    };
  }
});
