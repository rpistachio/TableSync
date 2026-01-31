var menuData = require('../../data/menuData.js');

function getPreferenceFromApp() {
  var app = getApp();
  var p = app.globalData.preference || {};
  return {
    taste: p.taste || 'light',
    meat: p.meat || 'chicken',
    adultCount: Number(p.adultCount) || 2,
    babyMonth: Number(p.babyMonth) || 6,
    hasBaby: p.hasBaby === '1' || p.hasBaby === true
  };
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
    var menu = menuData.getTodayMenu(pref);
    var tasteTagText = '🥗 清淡';
    if (menu.taste === 'spicy') tasteTagText = '🌶️ 辛辣';
    else if (menu.taste === 'soup') tasteTagText = '🥣 有汤';

    var adultName = (menu.adultMenu && menu.adultMenu[0]) ? menu.adultMenu[0].name : '—';
    var adultTime = (menu.adultMenu && menu.adultMenu[0]) ? (menu.adultMenu[0].time || 0) : 0;
    var adultIngredients = (menu.adultRecipe && menu.adultRecipe.ingredients) ? menu.adultRecipe.ingredients.slice(0, 4) : [];
    var babyIngredients = (menu.babyRecipe && menu.babyRecipe.ingredients) ? menu.babyRecipe.ingredients.slice(0, 4) : [];

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
