var menuGen = require('../../data/menuGenerator.js');
var menuData = require('../../data/menuData.js');
var locationWeather = require('../home/locationWeather');

function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

Page({
  data: {
    contextSummary: '今日 · 本地',
    weatherForApi: null,
    moodOptions: [
      { value: 'happy', label: '开心', emoji: '😊' },
      { value: 'tired', label: '疲惫', emoji: '😴' },
      { value: 'craving', label: '馋了', emoji: '🤤' },
      { value: 'any', label: '随便', emoji: '🙂' }
    ],
    selectedMood: 'any',
    moodCustom: '',
    prefPanelExpanded: false,
    hasMenusForWheel: false,
    adultCount: 2,
    adultCountOptions: [1, 2, 3, 4, 5, 6],
    comboOptions: [
      { label: '1荤1素', meatCount: 1, vegCount: 1, tag: '均衡', recommended: true },
      { label: '2荤1素', meatCount: 2, vegCount: 1, tag: '高蛋白' },
      { label: '1荤2素', meatCount: 1, vegCount: 2, tag: '多素' }
    ],
    meatCount: 1,
    vegCount: 1,
    wantSoup: false,
    soupType: 'veg',
    nutritionTip: '',
    hasBaby: false,
    babyMonth: 12,
    babyAgeOptions: [
      { label: '6-8月', sub: '泥糊', value: 8 },
      { label: '9-12月', sub: '末/碎', value: 12 },
      { label: '13-18月', sub: '小丁', value: 18 },
      { label: '19-24月', sub: '小块', value: 24 },
      { label: '25-36月', sub: '正常块', value: 36 }
    ],
    expandedPanel: '',
    soupCapsuleText: '增加滋补汤品',
    babyCapsuleText: '增加宝宝餐',
    prefCapsuleText: '忌口/过敏',
    prefHasValue: false,
    dietCapsuleText: '饮食偏好',
    dietHasValue: false,
    avoidOptions: [
      { value: 'spicy', label: '不吃辣' },
      { value: 'seafood', label: '海鲜过敏' },
      { value: 'peanut', label: '花生过敏' },
      { value: 'lactose', label: '乳糖不耐' },
      { value: 'gluten', label: '麸质过敏' },
      { value: 'cilantro', label: '不吃香菜' }
    ],
    dietOptions: [
      { value: 'home', label: '家常' },
      { value: 'light', label: '清淡' },
      { value: 'rich', label: '下饭' },
      { value: 'quick', label: '快手' }
    ],
    userPreference: {
      avoidList: [],
      dietStyle: 'home',
      isTimeSave: false
    },
    outerDishes: [],
    middleDishes: [],
    innerDishes: [],
    outerRotation: 0,
    middleRotation: 0,
    innerRotation: 0,
    outerTarget: 0,
    middleTarget: 0,
    innerTarget: 0,
    spinning: false,
    stopped: false
  },

  onLoad: function () {
    var that = this;
    var menus = getApp().globalData.todayMenus || [];
    var pref = getApp().globalData.preference || {};

    if (menus && menus.length > 0) {
      that._buildWheelFromMenus(menus, pref);
      that.setData({ hasMenusForWheel: true });
      that._updateContextSummary(pref.adultCount != null ? pref.adultCount : 2);
      locationWeather.getWeather().then(function (w) {
        that.setData({ weatherForApi: w });
        that._updateContextSummary(pref.adultCount != null ? pref.adultCount : 2, w);
      });
      return;
    }

    var storedMonth = pref.babyMonth != null ? Number(pref.babyMonth) : 12;
    var normalized = storedMonth <= 8 ? 8 : storedMonth <= 12 ? 12 : storedMonth <= 18 ? 18 : storedMonth <= 24 ? 24 : 36;
    var adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || that.data.adultCount));
    var comboOptions = menuGen.getComboOptionsForCount(adultCount);
    var meatCount = that.data.meatCount;
    var vegCount = that.data.vegCount;
    if (!menuGen.findComboInList(meatCount, vegCount, comboOptions)) {
      var recIdx = menuGen.getRecommendedComboIndex(adultCount);
      meatCount = comboOptions[recIdx].meatCount;
      vegCount = comboOptions[recIdx].vegCount;
    }
    var selectedIdx = 0;
    for (var i = 0; i < comboOptions.length; i++) {
      if (comboOptions[i].meatCount === meatCount && comboOptions[i].vegCount === vegCount) {
        selectedIdx = i;
        break;
      }
    }
    var nutritionTip = menuGen.getNutritionTip(adultCount);
    var updates = {
      comboOptions: comboOptions,
      nutritionTip: nutritionTip,
      adultCount: adultCount,
      meatCount: meatCount,
      vegCount: vegCount,
      babyMonth: normalized
    };
    if (pref.wantSoup === true) updates.wantSoup = true;
    if (pref.soupType === 'meat' || pref.soupType === 'veg') updates.soupType = pref.soupType;
    if (pref.hasBaby === true) updates.hasBaby = true;
    if (Array.isArray(pref.avoidList)) updates['userPreference.avoidList'] = pref.avoidList;
    if (pref.dietStyle) updates['userPreference.dietStyle'] = pref.dietStyle;
    that.setData(updates);
    that._updateCapsuleTexts();
    that._updateContextSummary(updates.adultCount != null ? updates.adultCount : that.data.adultCount);
    locationWeather.getWeather().then(function (w) {
      that.setData({ weatherForApi: w });
      that._updateContextSummary(that.data.adultCount, w);
    });
  },

  _updateContextSummary: function (adultCount, weather) {
    var n = adultCount != null ? adultCount : this.data.adultCount;
    var weatherPart = '';
    if (weather && (weather.fullText || weather.text || weather.temp)) {
      weatherPart = (weather.fullText && weather.fullText.trim()) ? weather.fullText.trim() : ((weather.text || '') + (weather.temp ? ' ' + weather.temp + '°C' : '')).trim();
    }
    var summary = (weatherPart ? weatherPart + ' · ' : '今日 · ') + n + '人';
    this.setData({ contextSummary: summary });
  },

  onMoodTap: function (e) {
    var value = e.currentTarget.dataset.value;
    if (value) this.setData({ selectedMood: value });
  },

  onMoodCustomInput: function (e) {
    this.setData({ moodCustom: (e.detail && e.detail.value) || '' });
  },

  onTogglePrefPanel: function () {
    this.setData({ prefPanelExpanded: !this.data.prefPanelExpanded });
  },

  onAdultCountTap: function (e) {
    var count = parseInt(e.currentTarget.dataset.count, 10);
    if (count < 1 || count > 6) return;
    var newOptions = menuGen.getComboOptionsForCount(count);
    var curMeat = this.data.meatCount;
    var curVeg = this.data.vegCount;
    if (!menuGen.findComboInList(curMeat, curVeg, newOptions)) {
      var recIdx = menuGen.getRecommendedComboIndex(count);
      curMeat = newOptions[recIdx].meatCount;
      curVeg = newOptions[recIdx].vegCount;
    }
    var selectedIdx = 0;
    for (var i = 0; i < newOptions.length; i++) {
      if (newOptions[i].meatCount === curMeat && newOptions[i].vegCount === curVeg) {
        selectedIdx = i;
        break;
      }
    }
    var nutritionTip = menuGen.getNutritionTip(count);
    this.setData({
      adultCount: count,
      comboOptions: newOptions,
      meatCount: curMeat,
      vegCount: curVeg,
      nutritionTip: nutritionTip
    });
    this._updateContextSummary(count);
  },

  onComboTap: function (e) {
    var meat = parseInt(e.currentTarget.dataset.meat, 10);
    var veg = parseInt(e.currentTarget.dataset.veg, 10);
    this.setData({ meatCount: meat, vegCount: veg });
  },

  onCapsuleTap: function (e) {
    var panel = e.currentTarget.dataset.panel;
    var next = this.data.expandedPanel === panel ? '' : (panel || '');
    this.setData({ expandedPanel: next });
  },

  onSoupOptionTap: function (e) {
    var opt = e.currentTarget.dataset.option;
    if (opt === 'none') this.setData({ wantSoup: false });
    else if (opt === 'meat') this.setData({ wantSoup: true, soupType: 'meat' });
    else if (opt === 'veg') this.setData({ wantSoup: true, soupType: 'veg' });
    this._updateCapsuleTexts();
  },

  onBabyAgeTap: function (e) {
    var value = parseInt(e.currentTarget.dataset.value, 10);
    if (value >= 6 && value <= 36) {
      this.setData({ hasBaby: true, babyMonth: value });
      this._updateCapsuleTexts();
    }
  },

  onBabyNoneTap: function () {
    this.setData({ hasBaby: false });
    this._updateCapsuleTexts();
  },

  onAvoidTap: function (e) {
    var val = e.currentTarget.dataset.value;
    if (!val) return;
    var userPref = this.data.userPreference || {};
    var avoidList = (userPref.avoidList || []).slice();
    var idx = avoidList.indexOf(val);
    if (idx > -1) avoidList.splice(idx, 1);
    else avoidList.push(val);
    this.setData({ 'userPreference.avoidList': avoidList });
    this._updateCapsuleTexts();
  },

  onDietTap: function (e) {
    var val = e.currentTarget.dataset.value;
    this.setData({ 'userPreference.dietStyle': val });
    this._updateCapsuleTexts();
  },

  _updateCapsuleTexts: function () {
    var d = this.data;
    var soup = d.wantSoup ? (d.soupType === 'meat' ? '荤汤' : '素汤') : '增加滋补汤品';
    var baby = d.hasBaby ? '宝宝' + d.babyMonth + '月' : '增加宝宝餐';
    var up = d.userPreference || {};
    var avoid = (up.avoidList || []);
    var diet = up.dietStyle || 'home';
    var dietLabels = { home: '家常', light: '清淡', rich: '下饭', quick: '快手' };
    var avoidOpts = d.avoidOptions || [];
    var valueToLabel = {};
    for (var i = 0; i < avoidOpts.length; i++) {
      if (avoidOpts[i].value && avoidOpts[i].label) valueToLabel[avoidOpts[i].value] = avoidOpts[i].label;
    }
    var prefText = '忌口/过敏';
    if (avoid.length) {
      var avoidLabels = avoid.slice(0, 2).map(function (v) { return valueToLabel[v] || v; });
      prefText = avoidLabels.join('、');
    }
    var prefHas = avoid.length > 0;
    var dietText = (diet && diet !== 'home') ? (dietLabels[diet] || diet) : '饮食偏好';
    var dietHas = (diet && diet !== 'home');
    this.setData({
      soupCapsuleText: soup,
      babyCapsuleText: baby,
      prefCapsuleText: prefText,
      prefHasValue: prefHas,
      dietCapsuleText: dietText,
      dietHasValue: dietHas
    });
  },

  _buildPreference: function () {
    var d = this.data;
    var hasBaby = d.hasBaby === true || d.hasBaby === 'true';
    var userPref = d.userPreference || {};
    var wantSoup = d.wantSoup === true;
    var app = getApp && getApp();
    var kitchenConfig = d.kitchenConfig ||
      (app && app.globalData && app.globalData.kitchenConfig) ||
      { burners: 2, hasSteamer: false, hasAirFryer: false, hasOven: false };
    return {
      adultCount: Math.min(6, Math.max(1, d.adultCount || 2)),
      hasBaby: !!hasBaby,
      babyMonth: Math.min(36, Math.max(6, d.babyMonth)),
      meatCount: d.meatCount,
      vegCount: d.vegCount,
      soupCount: wantSoup ? 1 : 0,
      soupType: wantSoup ? (d.soupType === 'meat' ? 'meat' : 'veg') : null,
      avoidList: userPref.avoidList || [],
      dietStyle: userPref.dietStyle || 'home',
      isTimeSave: userPref.isTimeSave === true || userPref.is_time_save === true,
      kitchenConfig: kitchenConfig
    };
  },

  onStartGenerate: function () {
    var that = this;
    if (that._generating) return;
    that._generating = true;
    wx.showLoading({ title: '生成中...' });

    var pref = that._buildPreference();
    var moodLabel = that.data.moodCustom && that.data.moodCustom.trim()
      ? that.data.moodCustom.trim()
      : (that.data.moodOptions || []).find(function (o) { return o.value === that.data.selectedMood; });
    var moodText = (moodLabel && moodLabel.label) ? moodLabel.label : '随便';

    var source = menuData.getRecipeSource && menuData.getRecipeSource();
    var adultRecipes = (source && source.adultRecipes) || [];
    var candidates = adultRecipes.slice(0, 100).map(function (r) {
      return {
        id: r.id || r._id,
        _id: r._id || r.id,
        name: r.name,
        meat: r.meat,
        cook_type: r.cook_type,
        flavor_profile: r.flavor_profile,
        dish_type: r.dish_type
      };
    });

    var recentDishNames = '';
    try {
      var stored = wx.getStorageSync('today_menus');
      var dateKey = wx.getStorageSync('menu_generated_date');
      if (dateKey && dateKey !== getTodayDateKey() && stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          recentDishNames = parsed.map(function (m) {
            return (m.adultRecipe && m.adultRecipe.name) || '';
          }).filter(Boolean).join('、');
        }
      }
    } catch (e) {}

    wx.cloud.callFunction({
      name: 'smartMenuGen',
      data: {
        preference: pref,
        mood: moodText,
        weather: that.data.weatherForApi || {},
        recentDishNames: recentDishNames,
        candidates: candidates
      }
    }).then(function (res) {
      var out = res.result;
      if (out && out.code === 0 && out.data && Array.isArray(out.data.recipeIds) && out.data.recipeIds.length > 0) {
        that._applyAiMenus(out.data.recipeIds, pref);
        return;
      }
      that._applyLocalMenus(pref);
    }).catch(function () {
      that._applyLocalMenus(pref);
    });
  },

  _applyAiMenus: function (recipeIds, pref) {
    var that = this;
    var recipeCoverSlugs = require('../../data/recipeCoverSlugs');
    var hasBaby = pref.hasBaby === true;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || 2;
    var firstMeatIndex = -1;
    var menus = [];
    for (var i = 0; i < recipeIds.length; i++) {
      var recipe = menuData.getAdultRecipeById && menuData.getAdultRecipeById(recipeIds[i]);
      if (!recipe) continue;
      if (firstMeatIndex < 0 && recipe.meat !== 'vegetable') firstMeatIndex = menus.length;
      var hasBabyThis = hasBaby && recipe.meat !== 'vegetable' && menus.length === firstMeatIndex;
      var slot = menuGen.generateMenuFromRecipe(recipe, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
      menus.push({
        meat: (slot.adultRecipe && slot.adultRecipe.meat) || recipe.meat,
        taste: (slot.adultRecipe && slot.adultRecipe.taste) || '',
        adultRecipe: slot.adultRecipe || null,
        babyRecipe: hasBaby ? (slot.babyRecipe || null) : null,
        checked: true
      });
    }
    if (menus.length === 0) {
      that._applyLocalMenus(pref);
      return;
    }
    menus.forEach(function (m) {
      if (m.adultRecipe && m.adultRecipe.name) {
        m.adultRecipe.coverImage = recipeCoverSlugs.getRecipeCoverImageUrl(m.adultRecipe.name);
      }
    });
    getApp().globalData.preference = pref;
    getApp().globalData.todayMenus = menus;
    that._buildWheelFromMenus(menus, pref);
    that.setData({ hasMenusForWheel: true });
    wx.hideLoading();
    that._generating = false;
  },

  _applyLocalMenus: function (pref) {
    var that = this;
    try {
      // 排除上次已生成的菜品名，减少连续两次都出现同一道（如凉拌茄子豆芽）的概率
      try {
        var stored = wx.getStorageSync('today_menus');
        if (stored) {
          var parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            pref.excludeRecipeNames = parsed.map(function (m) {
              return (m.adultRecipe && m.adultRecipe.name) || '';
            }).filter(Boolean);
          }
        }
      } catch (e) {}
      var recipeCoverSlugs = require('../../data/recipeCoverSlugs');
      var result = menuData.getTodayMenusByCombo(pref);
      var menus = result.menus || result;
      if (!menus || menus.length === 0) {
        throw new Error('未匹配到符合条件的菜谱');
      }
      var hasBaby = pref.hasBaby === true;
      menus.forEach(function (m) {
        m.checked = true;
        if (!hasBaby) m.babyRecipe = null;
        if (m.adultRecipe && m.adultRecipe.name) {
          m.adultRecipe.coverImage = recipeCoverSlugs.getRecipeCoverImageUrl(m.adultRecipe.name);
        }
      });
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      that._buildWheelFromMenus(menus, pref);
      that.setData({ hasMenusForWheel: true });
      if (result.fallbackMessage) {
        wx.showToast({ title: result.fallbackMessage, icon: 'none', duration: 2500 });
      }
    } catch (err) {
      wx.showModal({ title: '生成失败', content: err.message, showCancel: false });
    }
    wx.hideLoading();
    that._generating = false;
  },

  _buildWheelFromMenus: function (menus, pref) {
    var mainDish = '';
    var subDish = '';
    var soupDish = '';
    for (var i = 0; i < menus.length; i++) {
      var name = (menus[i].adultRecipe && menus[i].adultRecipe.name) || '';
      if (!name) continue;
      var r = menus[i].adultRecipe;
      var isSoup = (r && r.dish_type === 'soup') || (r && r.name && r.name.indexOf('汤') !== -1);
      if (isSoup && !soupDish) soupDish = name;
      else if (menus[i].meat === 'vegetable' && !subDish) subDish = name;
      else if (menus[i].meat !== 'vegetable' && !mainDish) mainDish = name;
    }
    mainDish = mainDish || '今日主菜';
    subDish = subDish || '今日素菜';
    soupDish = soupDish || '今日汤品';

    var outerDishes = this._generateWheel(mainDish, 'meat', pref);
    var middleDishes = this._generateWheel(subDish, 'vegetable', pref);
    var innerDishes = this._generateWheel(soupDish, 'soup', pref);

    var outerTarget = Math.floor(Math.random() * 8);
    var middleTarget = Math.floor(Math.random() * 8);
    var innerTarget = Math.floor(Math.random() * 8);

    outerDishes[outerTarget] = mainDish;
    middleDishes[middleTarget] = subDish;
    innerDishes[innerTarget] = soupDish;

    this.setData({
      outerDishes: outerDishes,
      middleDishes: middleDishes,
      innerDishes: innerDishes,
      outerTarget: outerTarget,
      middleTarget: middleTarget,
      innerTarget: innerTarget
    });
  },

  _generateWheel: function (realDish, category, pref) {
    var source = menuData.getRecipeSource && menuData.getRecipeSource();
    var allRecipes = (source && source.adultRecipes) || [];
    if (allRecipes.length === 0) {
      try {
        var recipes = require('../../data/recipes.js');
        allRecipes = recipes.adultRecipes || [];
      } catch (e) {}
    }

    var avoidList = (pref && pref.avoidList) || [];
    var candidates = allRecipes.filter(function (r) {
      if (!r || !r.name) return false;
      if (r.name === realDish) return false;
      if (category === 'meat' && r.meat === 'vegetable') return false;
      if (category === 'vegetable' && r.meat !== 'vegetable') return false;
      if (category === 'soup') {
        var isSoup = (r.dish_type === 'soup') || (r.name && r.name.indexOf('汤') !== -1);
        if (!isSoup) return false;
      }
      if (avoidList.indexOf('spicy') > -1 && r.flavor_profile === 'spicy') return false;
      if (avoidList.indexOf('seafood') > -1 && ['fish', 'shrimp'].indexOf(r.meat) > -1) return false;
      return true;
    });

    candidates = this._shuffle(candidates);
    var dishes = candidates.slice(0, 8).map(function (r) {
      return (r && r.name) ? r.name : '神秘菜品';
    });
    while (dishes.length < 8) {
      dishes.push('神秘菜品');
    }
    return dishes;
  },

  _shuffle: function (arr) {
    var result = arr.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  },

  startSpin: function () {
    var that = this;
    if (that.data.spinning || that.data.stopped) return;

    that.setData({ spinning: true });

    var outerFinalAngle = 3600 - (that.data.outerTarget * 45) + 720;
    var middleFinalAngle = 3960 - (that.data.middleTarget * 45) + 720;
    var innerFinalAngle = 4320 - (that.data.innerTarget * 45) + 720;

    setTimeout(function () {
      that.setData({ outerRotation: outerFinalAngle });
    }, 100);

    setTimeout(function () {
      that.setData({ middleRotation: middleFinalAngle });
    }, 500);

    setTimeout(function () {
      that.setData({ innerRotation: innerFinalAngle });
    }, 1000);

    setTimeout(function () {
      that.setData({ stopped: true });
      that._prepareAndNavigate();
    }, 5000);
  },

  _prepareAndNavigate: function () {
    var menus = getApp().globalData.todayMenus || [];
    var pref = getApp().globalData.preference || {};

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

    var payload = menuData.buildPreviewPayload(menus, pref, {
      comboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : ''),
      countText: menus.length + '道菜'
    });

    getApp().globalData.menuPreview = {
      menus: menus,
      rows: payload.rows,
      dashboard: payload.dashboard,
      countText: payload.countText,
      comboName: payload.comboName,
      balanceTip: payload.balanceTip,
      hasSharedBase: payload.hasSharedBase,
      preference: pref
    };

    setTimeout(function () {
      wx.redirectTo({ url: '/pages/preview/preview' });
    }, 1000);
  }
});
