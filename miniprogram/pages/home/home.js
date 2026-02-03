var menuGen = require('../../data/menuGenerator.js');
var menuData = require('../../data/menuData.js');

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
    activeMember: 'adult',
    adultCount: 2,
    adultCountOptions: [1, 2, 3, 4, 5, 6],
    adultTasteOptions: [
      { value: 'light', label: '清淡', icon: '🥗' },
      { value: 'normal', label: '适中', icon: '🍲' },
      { value: 'rich', label: '下饭', icon: '🌶' }
    ],
    adultTaste: 'light',
    meats: [
      { value: 'chicken', label: '鸡肉', icon: '🍗' },
      { value: 'pork', label: '猪肉', icon: '🥩' },
      { value: 'beef', label: '牛肉', icon: '🥩' },
      { value: 'fish', label: '鱼', icon: '🐟' },
      { value: 'shrimp', label: '虾', icon: '🦐' },
      { value: 'vegetable', label: '素菜', icon: '🥬' }
    ],
    selectedMeat: 'chicken',
    /** 几荤几素选项数组（与 comboOptions 同步，供 WXML 绑定） */
    dishCounts: [
      { label: '1荤1素1汤', meatCount: 1, vegCount: 1, soupCount: 1, tag: '简餐' },
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '1荤2素1汤', meatCount: 1, vegCount: 2, soupCount: 1, tag: '清淡' }
    ],
    /** 当前选中的几荤几素索引（0-based） */
    selectedCount: 0,
    comboOptions: [
      { label: '1荤1素1汤', meatCount: 1, vegCount: 1, soupCount: 1, tag: '简餐' },
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '1荤2素1汤', meatCount: 1, vegCount: 2, soupCount: 1, tag: '清淡' }
    ],
    meatCount: 1,
    vegCount: 1,
    soupCount: 1,
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
    previewDashboard: { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '' },
    previewHasSharedBase: false,
    // 个性化偏好面板
    prefExpanded: false,
    avoidOptions: [
      { value: 'spicy', label: '不吃辣' },
      { value: 'seafood', label: '海鲜过敏' },
      { value: 'peanut', label: '花生过敏' },
      { value: 'lactose', label: '乳糖不耐' },
      { value: 'gluten', label: '麸质过敏' }
    ],
    dietOptions: [
      { value: 'home', label: '家常' },
      { value: 'light', label: '清淡' },
      { value: 'rich', label: '下饭' },
      { value: 'quick', label: '快手' }
    ],
    userPreference: {
      avoidList: [],    // 存储选中的忌口标签
      dietStyle: 'home', // 默认口味偏好
      isTimeSave: false // 省时开关
    }
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
    var adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || this.data.adultCount));
    var comboOptions = menuGen.getComboOptionsForCount(adultCount);
    var meatCount = this.data.meatCount;
    var vegCount = this.data.vegCount;
    var soupCount = this.data.soupCount != null ? this.data.soupCount : 0;
    if (!menuGen.findComboInList(meatCount, vegCount, soupCount, comboOptions)) {
      meatCount = comboOptions[0].meatCount;
      vegCount = comboOptions[0].vegCount;
      soupCount = comboOptions[0].soupCount != null ? comboOptions[0].soupCount : 0;
    }
    var selectedIdx = 0;
    for (var i = 0; i < comboOptions.length; i++) {
      var o = comboOptions[i];
      if (o.meatCount === meatCount && o.vegCount === vegCount && (o.soupCount != null ? o.soupCount : 0) === soupCount) {
        selectedIdx = i;
        break;
      }
    }
    var updates = { comboOptions: comboOptions, dishCounts: comboOptions, selectedCount: selectedIdx };
    if (normalized !== this.data.babyMonth) updates.babyMonth = normalized;
    if (adultCount !== this.data.adultCount) updates.adultCount = adultCount;
    if (meatCount !== this.data.meatCount) updates.meatCount = meatCount;
    if (vegCount !== this.data.vegCount) updates.vegCount = vegCount;
    if (soupCount !== this.data.soupCount) updates.soupCount = soupCount;
    this.setData(updates);
  },

  toggleMember: function (e) {
    var type = e.currentTarget.dataset.type;
    if (type === 'adult' || type === 'baby') this.setData({ activeMember: type });
  },

  onHasBabyChange: function (e) {
    this.setData({ hasBaby: e.detail.value === true || e.detail.value === 'true' });
  },

  onBabyMonthChange: function (e) {
    var v = e.detail.value;
    if (v != null) this.setData({ babyMonth: Math.min(36, Math.max(6, Number(v) || 12)) });
  },

  onTasteTap: function (e) {
    var v = e.currentTarget.dataset.value;
    if (v) this.setData({ adultTaste: v });
  },

  onMeatTap: function (e) {
    var v = e.currentTarget.dataset.value;
    if (v) this.setData({ selectedMeat: v });
  },

  onBabyAgeTap: function (e) {
    var value = parseInt(e.currentTarget.dataset.value, 10);
    if (value >= 6 && value <= 36) this.setData({ babyMonth: value });
  },

  onAdultCountTap: function (e) {
    var count = parseInt(e.currentTarget.dataset.count, 10);
    if (count < 1 || count > 6) return;
    var newOptions = menuGen.getComboOptionsForCount(count);
    var curMeat = this.data.meatCount;
    var curVeg = this.data.vegCount;
    var curSoup = this.data.soupCount != null ? this.data.soupCount : 0;
    if (!menuGen.findComboInList(curMeat, curVeg, curSoup, newOptions)) {
      curMeat = newOptions[0].meatCount;
      curVeg = newOptions[0].vegCount;
      curSoup = newOptions[0].soupCount != null ? newOptions[0].soupCount : 0;
    }
    var selectedIdx = 0;
    for (var i = 0; i < newOptions.length; i++) {
      var o = newOptions[i];
      if (o.meatCount === curMeat && o.vegCount === curVeg && (o.soupCount != null ? o.soupCount : 0) === curSoup) {
        selectedIdx = i;
        break;
      }
    }
    this.setData({
      adultCount: count,
      comboOptions: newOptions,
      dishCounts: newOptions,
      selectedCount: selectedIdx,
      meatCount: curMeat,
      vegCount: curVeg,
      soupCount: curSoup
    });
  },

  /** 几荤几素点击：更新当前选择并 setData */
  onSelectDishCount: function (e) {
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var list = this.data.dishCounts || this.data.comboOptions || [];
    var item = list[index];
    if (!item) return;
    var meat = item.meatCount != null ? item.meatCount : 1;
    var veg = item.vegCount != null ? item.vegCount : 1;
    var soup = item.soupCount != null ? item.soupCount : 1;
    this.setData({
      selectedCount: index,
      meatCount: meat,
      vegCount: veg,
      soupCount: soup
    });
  },

  onComboTap: function (e) {
    var meat = parseInt(e.currentTarget.dataset.meat, 10);
    var veg = parseInt(e.currentTarget.dataset.veg, 10);
    var soup = parseInt(e.currentTarget.dataset.soup, 10);
    if (isNaN(soup)) soup = 0;
    var list = this.data.dishCounts || this.data.comboOptions || [];
    var selectedIdx = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].meatCount === meat && list[i].vegCount === veg && (list[i].soupCount || 0) === soup) {
        selectedIdx = i;
        break;
      }
    }
    this.setData({ selectedCount: selectedIdx, meatCount: meat, vegCount: veg, soupCount: soup });
  },

  // 切换个性化偏好面板展开/折叠
  togglePrefPanel: function () {
    console.log('[togglePrefPanel] triggered, current prefExpanded:', this.data.prefExpanded);
    this.setData({ prefExpanded: !this.data.prefExpanded });
  },

  // 处理忌口标签多选
  onAvoidTap: function (e) {
    console.log('[onAvoidTap] triggered, dataset:', e.currentTarget.dataset);
    var val = e.currentTarget.dataset.value;
    if (!val) {
      console.warn('[onAvoidTap] value is empty');
      return;
    }
    var userPref = this.data.userPreference || {};
    var avoidList = (userPref.avoidList || []).slice(); // 复制数组
    var idx = avoidList.indexOf(val);
    if (idx > -1) {
      avoidList.splice(idx, 1);
    } else {
      avoidList.push(val);
    }
    console.log('[onAvoidTap] new avoidList:', avoidList);
    this.setData({ 'userPreference.avoidList': avoidList });
  },

  // 处理饮食偏好单选
  onDietTap: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ 'userPreference.dietStyle': val });
  },

  // 处理省时开关切换
  onTimeSaveChange: function (e) {
    this.setData({ 'userPreference.isTimeSave': e.detail.value });
  },

  handleGenerate: function () {
    var that = this;
    if (that._generating) return;
    that._generating = true;
    wx.showLoading({ title: '统筹算法运行中', mask: true });
    // 延迟一帧再执行重计算，确保 loading 先渲染，减轻卡顿
    var runGenerate = function () {
      try {
        var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');
        var pref = that._buildPreference();
        var result = menuData.getTodayMenusByCombo(pref);
        var menus = result.menus || result;
        if (!menus || menus.length === 0) {
          throw new Error('未匹配到符合条件的菜谱，请调整忌口或偏好后再试');
        }
        var hasBaby = pref.hasBaby === true;
        menus.forEach(function (m) {
          m.checked = true;
          if (!hasBaby) m.babyRecipe = null;
          if (m.adultRecipe && m.adultRecipe.name) {
            m.adultRecipe.coverImage = recipeCoverSlugs.getRecipeCoverImageUrl(m.adultRecipe.name);
          }
        });
        var shoppingList = menuData.generateShoppingListFromMenus(pref, menus);
        wx.setStorageSync('cart_ingredients', shoppingList || []);
        wx.setStorageSync('today_menus', JSON.stringify(menus));
        wx.setStorageSync('menu_generated_date', getTodayDateKey());
        var maxPrepTime = 0;
        menus.forEach(function (m) {
          var p = (m.adultRecipe && m.adultRecipe.prep_time) || 0;
          if (p > maxPrepTime) maxPrepTime = p;
        });
        wx.setStorageSync('today_prep_time', maxPrepTime);
        getApp().globalData.preference = pref;
        getApp().globalData.todayMenus = menus;
        var payload = menuData.buildPreviewPayload(menus, pref, { comboName: result.comboName || '', countText: menus.length + '道菜' });
        getApp().globalData.menuPreview = {
          menus: menus,
          rows: payload.rows,
          dashboard: payload.dashboard,
          countText: payload.countText,
          comboName: payload.comboName,
          balanceTip: payload.balanceTip,
          hasSharedBase: payload.hasSharedBase,
          preference: pref,
          fallbackMessage: result.fallbackMessage || ''
        };
        that._generating = false;
        wx.hideLoading();
        if (result.fallbackMessage) {
          wx.showToast({ title: result.fallbackMessage, icon: 'none', duration: 2500 });
        }
        wx.navigateTo({ url: '/pages/preview/preview' });
      } catch (err) {
        console.error('生成失败详情:', err);
        that._generating = false;
        wx.hideLoading();
        wx.showModal({ title: '生成失败', content: err.message || '算法运行出错', showCancel: false });
      }
    };
    setTimeout(function () {
      if (typeof wx.nextTick === 'function') {
        wx.nextTick(runGenerate);
      } else {
        setTimeout(runGenerate, 0);
      }
    }, 300);
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
      var selectedMenus = [];
      var checkedMeats = [];
      for (var j = 0; j < menus.length; j++) {
        if (rows[j].checked) {
          selectedMenus.push(menus[j]);
          var m = (menus[j].adultRecipe && menus[j].adultRecipe.meat) || menus[j].meat;
          if (m && checkedMeats.indexOf(m) === -1) checkedMeats.push(m);
        }
      }
      var counts = menuData.getFlavorAndCookCounts(selectedMenus);
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
          var picked = menuData.pickReplacementFromCache(menus[i].meat, constraints);
          var res;
          if (picked) {
            res = menuGen.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
          } else {
            var filters = { preferredFlavor: forceLight ? 'light' : null, preferQuick: curStew >= 1 };
            res = menuGen.generateMenuWithFilters(menus[i].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
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
            babyName: (function () { var st = menuData.getBabyVariantByAge && menuData.getBabyVariantByAge(ar, pref.babyMonth); return (st && st.name) || (newSlot.babyRecipe && newSlot.babyRecipe.name) || ''; })(),
            showSharedHint: hasBaby && newSlot.babyRecipe && i === firstMeatIndex,
            checked: true,
            recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : ''
          });
        }
      }
      that._fullPreviewMenus = newMenus;
      var dashboard = menuGen.computePreviewDashboard(newMenus, pref);
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
      var pref = that._buildPreference();
      var shoppingList = menuData.generateShoppingListFromMenus(pref, menus);

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
        weeklyPrefs.push({ adultCount: pref.adultCount, hasBaby: pref.hasBaby, babyMonth: pref.babyMonth, meatCount: pref.meatCount, vegCount: pref.vegCount, soupCount: pref.soupCount != null ? pref.soupCount : 0 });
      }
      var weeklyList = menuData.generateWeeklyShoppingList(weeklyPrefs);
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

  /** 构建偏好对象，遵循数据协议：{ avoidList, dietStyle, isTimeSave } 等，供逻辑层 filterByPreference / computeDashboard 使用 */
  /** 构建偏好对象，遵循数据协议：{ avoidList, dietStyle, isTimeSave } 等，供逻辑层 filterByPreference / computeDashboard 使用 */
  _buildPreference: function () {
    var d = this.data;
    var hasBaby = d.hasBaby === true || d.hasBaby === 'true';
    var userPref = d.userPreference || {};
    return {
      adultCount: Math.min(6, Math.max(1, d.adultCount || 2)),
      hasBaby: !!hasBaby,
      babyMonth: Math.min(36, Math.max(6, d.babyMonth)),
      meatCount: d.meatCount,
      vegCount: d.vegCount,
      soupCount: d.soupCount != null ? Math.min(1, Math.max(0, d.soupCount)) : 0,
      avoidList: userPref.avoidList || [],
      dietStyle: userPref.dietStyle || 'home',
      isTimeSave: userPref.isTimeSave === true || userPref.is_time_save === true
    };
  },

  /** 根据当前菜单计算仪表盘：预计耗时、灶台占用、食材种类、营养提示、备菜与烹饪顺序建议 */
  _computePreviewDashboard: function (menus, pref) {
    if (!menus || menus.length === 0) return { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '' };
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
    return {
      estimatedTime: estimatedMinutes > 0 ? estimatedMinutes + ' 分钟' : '',
      stoveCount: stoveCount,
      categoryLabels: categoryLabels,
      nutritionHint: nutritionHint,
      prepOrderHint: prepOrderHint,
      prepAheadHint: prepAheadHint
    };
  }
});
