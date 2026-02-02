function getCurrentDate() {
  const d = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
}

function getTodayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1);
  const day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

/**
 * 套餐选项：带汤 / 无汤 同档并列，避免「不要汤」时被迫多出一道荤。
 * 各人数档提供「几荤几素1汤」与「几荤几素」（无汤）对应选项。
 */
function getComboOptionsForCount(count) {
  const n = Math.min(6, Math.max(1, Number(count) || 2));
  if (n === 1) {
    return [
      { label: '1荤1素1汤', meatCount: 1, vegCount: 1, soupCount: 1, tag: '简餐' },
      { label: '1荤1素', meatCount: 1, vegCount: 1, soupCount: 0, tag: '无汤' },
      { label: '2荤1素', meatCount: 2, vegCount: 1, soupCount: 0, tag: '' },
      { label: '1素1汤', meatCount: 0, vegCount: 1, soupCount: 1, tag: '素食友好' }
    ];
  }
  if (n === 2) {
    return [
      { label: '1荤1素1汤', meatCount: 1, vegCount: 1, soupCount: 1, tag: '简餐' },
      { label: '1荤1素', meatCount: 1, vegCount: 1, soupCount: 0, tag: '无汤' },
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤1素', meatCount: 2, vegCount: 1, soupCount: 0, tag: '无汤' },
      { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '2荤2素', meatCount: 2, vegCount: 2, soupCount: 0, tag: '无汤' },
      { label: '1荤2素1汤', meatCount: 1, vegCount: 2, soupCount: 1, tag: '清淡' },
      { label: '1荤2素', meatCount: 1, vegCount: 2, soupCount: 0, tag: '无汤' }
    ];
  }
  if (n === 3) {
    return [
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '宝宝适配' },
      { label: '2荤1素', meatCount: 2, vegCount: 1, soupCount: 0, tag: '无汤' },
      { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '2荤2素', meatCount: 2, vegCount: 2, soupCount: 0, tag: '无汤' }
    ];
  }
  if (n === 4) {
    return [
      { label: '2荤1素1汤', meatCount: 2, vegCount: 1, soupCount: 1, tag: '' },
      { label: '2荤1素', meatCount: 2, vegCount: 1, soupCount: 0, tag: '无汤' },
      { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
      { label: '2荤2素', meatCount: 2, vegCount: 2, soupCount: 0, tag: '无汤' },
      { label: '3荤2素1汤', meatCount: 3, vegCount: 2, soupCount: 1, tag: '丰盛' },
      { label: '3荤2素', meatCount: 3, vegCount: 2, soupCount: 0, tag: '无汤' }
    ];
  }
  return [
    { label: '2荤2素1汤', meatCount: 2, vegCount: 2, soupCount: 1, tag: '' },
    { label: '2荤2素', meatCount: 2, vegCount: 2, soupCount: 0, tag: '无汤' },
    { label: '3荤2素1汤', meatCount: 3, vegCount: 2, soupCount: 1, tag: '' },
    { label: '3荤2素', meatCount: 3, vegCount: 2, soupCount: 0, tag: '无汤' },
    { label: '3荤3素1汤', meatCount: 3, vegCount: 3, soupCount: 1, tag: '丰盛' },
    { label: '3荤3素', meatCount: 3, vegCount: 3, soupCount: 0, tag: '无汤' }
  ];
}

function findComboInList(meatCount, vegCount, soupCount, options) {
  const s = soupCount != null ? soupCount : 0;
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (o.meatCount === meatCount && o.vegCount === vegCount && (o.soupCount != null ? o.soupCount : 0) === s) return true;
  }
  return false;
}

/** 让出主线程，确保 UI 能先渲染（回调版本，兼容小程序不支持 async/await） */
function nextTick(callback) {
  setTimeout(callback, 0);
}

Page({
  data: {
    currentDate: getCurrentDate(),
    adultCount: 2,
    adultCountOptions: [1, 2, 3, 4, 5, 6],
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
    previewMenus: [],
    previewMenuRows: [],
    previewCountText: '',
    previewComboName: '',
    previewBalanceTip: '',
    previewDashboard: { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' },
    previewHasSharedBase: false,
    // ============ 个性化偏好配置 ============
    prefExpanded: false,
    avoidOptions: [
      { label: '海鲜', value: 'seafood' },
      { label: '辣', value: 'spicy' },
      { label: '牛羊肉', value: 'beef_lamb' },
      { label: '鸡蛋', value: 'egg' },
      { label: '大豆', value: 'soy' }
    ],
    dietOptions: [
      { label: '清淡', value: 'light' },
      { label: '下饭', value: 'hearty' },
      { label: '快手', value: 'quick' }
    ],
    userPreference: {
      avoidList: [],      // 忌口列表（多选）
      dietStyle: '',      // 饮食偏好（单选）
      is_time_save: false // 省时模式
    }
  },

  onLoad: function () {
    const todayKey = getTodayDateKey();
    const storedKey = wx.getStorageSync('menu_generated_date') || '';
    if (storedKey && storedKey !== todayKey) {
      wx.removeStorageSync('today_menus');
      wx.removeStorageSync('today_menus_preference');
      wx.removeStorageSync('menu_generated_date');
      wx.removeStorageSync('cart_ingredients');
      wx.removeStorageSync('weekly_ingredients');
      wx.removeStorageSync('selected_dish_name');
      wx.removeStorageSync('today_prep_time');
      wx.removeStorageSync('today_allergens');
    }
    // 预加载菜单/菜谱模块，避免首次点击「看看今天吃什么」时同步加载导致卡顿
    setTimeout(() => { try { require('../../data/menuData.js'); } catch (e) { /* ignore */ } }, 50);
    
    const app = getApp();
    const pref = (app && app.globalData && app.globalData.preference) || {};
    const storedMonth = pref.babyMonth != null ? Number(pref.babyMonth) : 12;
    const normalized = storedMonth <= 8 ? 8 : storedMonth <= 12 ? 12 : storedMonth <= 18 ? 18 : storedMonth <= 24 ? 24 : 36;
    const adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || this.data.adultCount));
    const comboOptions = getComboOptionsForCount(adultCount);
    let meatCount = this.data.meatCount;
    let vegCount = this.data.vegCount;
    let soupCount = this.data.soupCount != null ? this.data.soupCount : 0;
    if (!findComboInList(meatCount, vegCount, soupCount, comboOptions)) {
      meatCount = comboOptions[0].meatCount;
      vegCount = comboOptions[0].vegCount;
      soupCount = comboOptions[0].soupCount != null ? comboOptions[0].soupCount : 0;
    }
    const updates = { comboOptions };
    if (normalized !== this.data.babyMonth) updates.babyMonth = normalized;
    if (adultCount !== this.data.adultCount) updates.adultCount = adultCount;
    if (meatCount !== this.data.meatCount) updates.meatCount = meatCount;
    if (vegCount !== this.data.vegCount) updates.vegCount = vegCount;
    if (soupCount !== this.data.soupCount) updates.soupCount = soupCount;
    this.setData(updates);
  },

  onHasBabyChange: function (e) {
    this.setData({ hasBaby: e.detail.value === true || e.detail.value === 'true' });
  },

  onBabyAgeTap: function (e) {
    const value = parseInt(e.currentTarget.dataset.value, 10);
    if (value >= 6 && value <= 36) this.setData({ babyMonth: value });
  },

  onAdultCountTap: function (e) {
    const count = parseInt(e.currentTarget.dataset.count, 10);
    if (count < 1 || count > 6) return;
    const newOptions = getComboOptionsForCount(count);
    let curMeat = this.data.meatCount;
    let curVeg = this.data.vegCount;
    let curSoup = this.data.soupCount != null ? this.data.soupCount : 0;
    if (!findComboInList(curMeat, curVeg, curSoup, newOptions)) {
      curMeat = newOptions[0].meatCount;
      curVeg = newOptions[0].vegCount;
      curSoup = newOptions[0].soupCount != null ? newOptions[0].soupCount : 0;
    }
    this.setData({
      adultCount: count,
      comboOptions: newOptions,
      meatCount: curMeat,
      vegCount: curVeg,
      soupCount: curSoup
    });
  },

  onComboTap: function (e) {
    const meat = parseInt(e.currentTarget.dataset.meat, 10);
    const veg = parseInt(e.currentTarget.dataset.veg, 10);
    let soup = parseInt(e.currentTarget.dataset.soup, 10);
    if (isNaN(soup)) soup = 0;
    this.setData({ meatCount: meat, vegCount: veg, soupCount: soup });
  },

  // ============ 个性化偏好交互 ============
  
  /** 展开/收起偏好面板 */
  togglePrefPanel: function () {
    this.setData({ prefExpanded: !this.data.prefExpanded });
  },

  /** 忌口多选切换 */
  onAvoidTap: function (e) {
    const value = e.currentTarget.dataset.value;
    const avoidList = this.data.userPreference.avoidList.slice();
    const idx = avoidList.indexOf(value);
    if (idx > -1) {
      avoidList.splice(idx, 1);
    } else {
      avoidList.push(value);
    }
    this.setData({ 'userPreference.avoidList': avoidList });
  },

  /** 饮食偏好单选 */
  onDietTap: function (e) {
    const value = e.currentTarget.dataset.value;
    const current = this.data.userPreference.dietStyle;
    // 点击已选中的则取消选中
    this.setData({ 'userPreference.dietStyle': current === value ? '' : value });
  },

  /** 省时模式开关 */
  onTimeSaveChange: function (e) {
    this.setData({ 'userPreference.is_time_save': e.detail.value === true || e.detail.value === 'true' });
  },

  /**
   * 生成菜单 - 使用 nextTick 回调替代嵌套 setTimeout
   * 解决：页面卡死、重复生成、状态未正确重置
   * 注意：微信小程序默认不支持 async/await，改用回调方式
   */
  handleGenerate: function () {
    const that = this;
    
    // 防止重复点击
    if (that._generating) return;
    that._generating = true;
    
    wx.showLoading({ title: '统筹算法运行中', mask: true });
    
    // 让出主线程，确保 Loading 先渲染
    nextTick(function () {
      let menuService, pref, result, menus, rows, dashboard, hasSharedBase, balanceTip, countText;
      
      try {
        menuService = require('../../data/menuData.js');
        pref = that._buildPreference();
        result = menuService.getTodayMenusByCombo(pref);
        menus = result.menus || result;
        const hasBaby = pref.hasBaby === true;
        
        countText = pref.adultCount + '个大人';
        if (hasBaby) countText += '，1个宝宝';
        
        rows = [];
        for (let i = 0; i < menus.length; i++) {
          const m = menus[i];
          m.checked = true;
          if (!hasBaby) m.babyRecipe = null;
          
          const ar = m.adultRecipe;
          const adultName = (ar && ar.name) ? ar.name : '—';
          const stage = hasBaby && menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
          const babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
          const reason = (ar && ar.recommend_reason) ? ar.recommend_reason : '';
          const sameAsAdultHint = (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '';
          
          rows.push({
            adultName: adultName,
            babyName: babyName,
            showSharedHint: hasBaby && babyName && i === 0,
            checked: true,
            recommendReason: reason,
            sameAsAdultHint: sameAsAdultHint
          });
        }
        
        dashboard = that._computePreviewDashboard(menus, pref);
        hasSharedBase = rows.some(function (r) { return r.showSharedHint; });
        
        balanceTip = '';
        let hasSpicy = false;
        let hasLightOrSweet = false;
        for (let b = 0; b < menus.length; b++) {
          const fl = (menus[b].adultRecipe && menus[b].adultRecipe.flavor_profile) || '';
          if (fl === 'spicy') hasSpicy = true;
          if (fl === 'light' || fl === 'sweet_sour' || fl === 'sour_fresh') hasLightOrSweet = true;
        }
        if (hasSpicy && hasLightOrSweet) balanceTip = '口味互补：辣配清淡/酸甜，味觉更舒适';
        
      } catch (e) {
        console.error('生成失败:', e);
        wx.hideLoading();
        that._generating = false;
        wx.showModal({
          title: '提示',
          content: (e && e.message) ? e.message : String(e),
          showCancel: false
        });
        return;
      }
      
      // 再次让出主线程，确保数据处理完成后 UI 响应
      nextTick(function () {
        try {
          // 写入全局数据
          getApp().globalData.menuPreview = {
            menus: menus,
            rows: rows,
            countText: countText,
            comboName: (result && result.comboName) || '',
            balanceTip: balanceTip,
            dashboard: dashboard,
            hasSharedBase: hasSharedBase,
            preference: that._buildPreference()
          };
          
          wx.hideLoading();
          wx.navigateTo({ url: '/pages/preview/preview' });
        } catch (err) {
          console.error('跳转失败:', err);
          wx.hideLoading();
          wx.showToast({ title: '跳转失败', icon: 'none' });
        } finally {
          // 无论成功失败，都重置 _generating 状态，防止卡死
          that._generating = false;
        }
      });
    });
  },

  _buildPreference: function () {
    const d = this.data;
    const hasBaby = d.hasBaby === true || d.hasBaby === 'true';
    const up = d.userPreference || {};
    return {
      adultCount: Math.min(6, Math.max(1, d.adultCount || 2)),
      hasBaby: !!hasBaby,
      babyMonth: Math.min(36, Math.max(6, d.babyMonth)),
      meatCount: d.meatCount,
      vegCount: d.vegCount,
      soupCount: d.soupCount != null ? Math.min(1, Math.max(0, d.soupCount)) : 0,
      // 个性化偏好
      avoidList: Array.isArray(up.avoidList) ? up.avoidList.slice() : [],
      dietStyle: up.dietStyle || '',
      is_time_save: !!up.is_time_save
    };
  },

  /** 根据当前菜单计算仪表盘：预计耗时、灶台占用、食材种类、营养提示、备菜与烹饪顺序建议、共用食材提示 */
  _computePreviewDashboard: function (menus, pref) {
    if (!menus || menus.length === 0) {
      return {
        estimatedTime: '',
        stoveCount: 0,
        categoryLabels: '',
        nutritionHint: '',
        prepOrderHint: '',
        prepAheadHint: '',
        sharedIngredientsHint: ''
      };
    }
    
    let maxMinutes = 0;
    let maxPrep = 0;
    let hasStirFry = false;
    let hasStew = false;
    let hasSteam = false;
    const catSet = {};
    const catOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 3, '干货': 4, '其他': 5 };
    
    for (let i = 0; i < menus.length; i++) {
      const r = menus[i].adultRecipe;
      if (!r) continue;
      
      const prep = typeof r.prep_time === 'number' ? r.prep_time : 0;
      if (prep > maxPrep) maxPrep = prep;
      
      const cook = r.cook_minutes != null ? r.cook_minutes : (r.taste === 'slow_stew' ? 60 : 15);
      if (prep + cook > maxMinutes) maxMinutes = prep + cook;
      
      const ct = r.cook_type || '';
      if (ct === 'stir_fry') hasStirFry = true;
      else if (ct === 'stew') hasStew = true;
      else if (ct === 'steam') hasSteam = true;
      
      const ings = r.ingredients;
      if (Array.isArray(ings)) {
        for (let j = 0; j < ings.length; j++) {
          const c = (ings[j] && ings[j].category) ? String(ings[j].category).trim() : '';
          if (c && c !== '调料') catSet[c] = (catOrder[c] != null ? catOrder[c] : 99);
        }
      }
      
      const br = menus[i].babyRecipe;
      if (br && Array.isArray(br.ingredients)) {
        for (let k = 0; k < br.ingredients.length; k++) {
          const bc = (br.ingredients[k] && br.ingredients[k].category) ? String(br.ingredients[k].category).trim() : '';
          if (bc && bc !== '调料') catSet[bc] = (catOrder[bc] != null ? catOrder[bc] : 99);
        }
      }
    }
    
    const estimatedMinutes = maxMinutes + 10;
    const stoveCount = (hasStirFry ? 1 : 0) + (hasStew ? 1 : 0) + (hasSteam ? 1 : 0);
    const cats = Object.keys(catSet).sort((a, b) => (catSet[a] || 99) - (catSet[b] || 99));
    const categoryLabels = cats.length > 0 ? cats.join('、') : '';
    
    const nutritionParts = [];
    if (cats.indexOf('肉类') !== -1 || cats.indexOf('蛋类') !== -1) nutritionParts.push('蛋白质');
    if (cats.indexOf('蔬菜') !== -1) nutritionParts.push('维生素与膳食纤维');
    if (cats.indexOf('干货') !== -1) nutritionParts.push('多种营养素');
    if (cats.indexOf('其他') !== -1 && nutritionParts.length === 0) nutritionParts.push('多种营养素');
    const nutritionHint = nutritionParts.length > 0 ? '本餐营养覆盖：' + nutritionParts.join('、') : '';
    
    const orderParts = [];
    if (hasStew) orderParts.push('炖/煲');
    if (hasSteam) orderParts.push('蒸');
    if (hasStirFry) orderParts.push('快炒');
    const prepOrderHint = orderParts.length >= 2 ? '烹饪顺序建议：' + orderParts.join('→') : '';
    
    let prepAheadHint = '';
    if (maxPrep >= 10) prepAheadHint = '备菜建议：可提前约 ' + maxPrep + ' 分钟准备葱姜蒜及腌制食材，下锅更从容';
    
    let sharedIngredientsHint = '';
    const ingCount = {};
    for (let si = 0; si < menus.length; si++) {
      const rec = menus[si].adultRecipe;
      if (!rec || !Array.isArray(rec.ingredients)) continue;
      const seen = {};
      for (let sj = 0; sj < rec.ingredients.length; sj++) {
        const ing = rec.ingredients[sj];
        if (!ing || (ing.category && String(ing.category).trim() === '调料')) continue;
        const n = (ing.name && String(ing.name).trim()) || '';
        if (n && !seen[n]) { seen[n] = true; ingCount[n] = (ingCount[n] || 0) + 1; }
      }
    }
    
    let shared = [];
    for (const name in ingCount) {
      if (ingCount[name] >= 2) shared.push(name);
    }
    if (shared.length > 0) {
      shared = shared.slice(0, 6);
      sharedIngredientsHint = '本餐可共用：' + shared.join('、') + '，备菜更省';
    }
    
    return {
      estimatedTime: estimatedMinutes > 0 ? estimatedMinutes + ' 分钟' : '',
      stoveCount,
      categoryLabels,
      nutritionHint,
      prepOrderHint,
      prepAheadHint,
      sharedIngredientsHint
    };
  }
});
