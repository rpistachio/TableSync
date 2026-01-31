var menuData = require('../../data/menuData.js');
var MEAT_LABEL = { chicken: '鸡肉', pork: '猪肉', beef: '牛肉', fish: '鱼肉', shrimp: '虾仁' };

function getPreferenceFromApp() {
  var app = getApp();
  var p = app.globalData.preference || {};
  return {
    taste: p.taste || p.adultTaste || 'light',
    adultTaste: p.adultTaste || p.taste || 'quick_stir_fry',
    meat: p.meat || 'chicken',
    adultCount: Number(p.adultCount) || 2,
    babyMonth: Number(p.babyMonth) || 6,
    hasBaby: p.hasBaby === '1' || p.hasBaby === true
  };
}

function tasteToTagText(taste) {
  if (taste === 'quick_stir_fry') return '🔥 快手小炒';
  if (taste === 'slow_stew') return '🍲 暖心炖煮';
  if (taste === 'steamed_salad') return '🥗 精选蒸/拌';
  if (taste === 'spicy') return '🌶️ 辛辣';
  if (taste === 'soup') return '🥣 有汤';
  return '🥗 清淡';
}

Page({
  data: {
    menu: {},
    tasteTagText: '🥗 清淡',
    adultDishName: '—',
    adultTime: 0,
    adultIngredients: [],
    babyIngredients: []
  },

  onLoad: function () {
    this.refreshMenu();
  },

  refreshMenu: function () {
    var pref = getPreferenceFromApp();
    var tasteTagText = tasteToTagText(pref.adultTaste || pref.taste);
    var adultName = '—';
    var adultTime = 0;
    var adultIngredients = [];
    var babyIngredients = [];
    var menu = {};

    try {
      var menusJson = wx.getStorageSync('today_menus');
      if (menusJson && menusJson.length > 0) {
        var menus = JSON.parse(menusJson);
        if (Array.isArray(menus) && menus.length > 0) {
          var names = [];
          menus.forEach(function (m) {
            if (m.adultRecipe && m.adultRecipe.name) names.push(m.adultRecipe.name);
            if (m.adultRecipe && (m.adultRecipe.time || 0) > adultTime) adultTime = m.adultRecipe.time || 0;
          });
          adultName = names.length > 0 ? names.join('、') : '—';
          var first = menus[0];
          adultIngredients = (first.adultRecipe && first.adultRecipe.ingredients) ? first.adultRecipe.ingredients.slice(0, 4) : [];
          babyIngredients = (first.babyRecipe && first.babyRecipe.ingredients) ? first.babyRecipe.ingredients.slice(0, 4) : [];
          var totalTime = 0;
          menus.forEach(function (m) {
            var t = (m.adultRecipe && m.adultRecipe.time) ? m.adultRecipe.time : 0;
            if (m.babyRecipe && m.babyRecipe.time) t = Math.max(t, m.babyRecipe.time);
            if (t > totalTime) totalTime = t;
          });
          var babyMenu = first.babyRecipe ? { name: first.babyRecipe.name, from: '共用食材：' + (MEAT_LABEL[first.meat] || first.meat) } : null;
          var gen = require('../../data/menuGenerator.js');
          var explanation = names.length > 1 ? '今日多道主菜 · 营养均衡 · 清单已汇总' : (gen.generateExplanation ? gen.generateExplanation(first.adultRecipe, first.babyRecipe) : '营养均衡 · 主材共用 · 高效执行');
          menu = {
            taste: pref.adultTaste || pref.taste,
            meat: pref.meat,
            adultMenu: menus.map(function (m) { return { name: m.adultRecipe ? m.adultRecipe.name : '—', time: m.adultRecipe ? (m.adultRecipe.time || 0) : 0 }; }),
            babyMenu: babyMenu,
            totalTime: totalTime > 0 ? totalTime : 25,
            explanation: explanation
          };
        }
      }
    } catch (e) {}

    if (!menu.adultMenu) {
      menu = menuData.getTodayMenu(pref);
      adultName = (menu.adultMenu && menu.adultMenu[0]) ? menu.adultMenu[0].name : '—';
      adultTime = (menu.adultMenu && menu.adultMenu[0]) ? (menu.adultMenu[0].time || 0) : 0;
      adultIngredients = (menu.adultRecipe && menu.adultRecipe.ingredients) ? menu.adultRecipe.ingredients.slice(0, 4) : [];
      babyIngredients = (menu.babyRecipe && menu.babyRecipe.ingredients) ? menu.babyRecipe.ingredients.slice(0, 4) : [];
    }

    this.setData({
      menu: menu,
      tasteTagText: tasteTagText,
      adultDishName: adultName,
      adultTime: adultTime,
      adultIngredients: adultIngredients,
      babyIngredients: babyIngredients
    });
  },

  handleRefresh: function () {
    this.refreshMenu();
  },

  goNext: function () {
    wx.navigateTo({ url: '/pages/steps/steps' });
  }
});
