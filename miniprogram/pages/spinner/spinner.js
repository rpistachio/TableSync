var menuData = require('../../data/menuData.js');

function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

Page({
  data: {
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

    if (!menus || menus.length === 0) {
      wx.showModal({
        title: '提示',
        content: '数据加载失败，请返回重试',
        showCancel: false,
        success: function () {
          wx.navigateBack();
        }
      });
      return;
    }

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
    mainDish = mainDish || '红烧肉';
    subDish = subDish || '手撕包菜';
    soupDish = soupDish || '番茄蛋汤';

    var outerDishes = that._generateWheel(mainDish, 'meat', pref);
    var middleDishes = that._generateWheel(subDish, 'vegetable', pref);
    var innerDishes = that._generateWheel(soupDish, 'soup', pref);

    var outerTarget = Math.floor(Math.random() * 8);
    var middleTarget = Math.floor(Math.random() * 8);
    var innerTarget = Math.floor(Math.random() * 8);

    outerDishes[outerTarget] = mainDish;
    middleDishes[middleTarget] = subDish;
    innerDishes[innerTarget] = soupDish;

    that.setData({
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
