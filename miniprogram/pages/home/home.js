function getCurrentDate() {
  var d = new Date();
  var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
}

Page({
  data: {
    currentDate: getCurrentDate(),
    tastes: [
      { label: '清淡', value: 'light', icon: '🥗' },
      { label: '辛辣', value: 'spicy', icon: '🌶️' },
      { label: '有汤', value: 'soup', icon: '🥣' }
    ],
    meats: [
      { label: '鸡肉', value: 'chicken', icon: '🍗' },
      { label: '鱼肉', value: 'fish', icon: '🐟' },
      { label: '虾仁', value: 'shrimp', icon: '🦐' },
      { label: '牛肉', value: 'beef', icon: '🥘' },
      { label: '猪肉', value: 'pork', icon: '🥩' }
    ],
    selectedTaste: 'light',
    selectedMeat: 'chicken',
    activeMember: 'adult',
    babyMonth: 6
  },

  onLoad: function () {},

  toggleMember: function (e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ activeMember: type });
  },

  onBabyMonthChange: function (e) {
    var v = e.detail.value;
    this.setData({ babyMonth: parseInt(v, 10) });
  },

  onTasteTap: function (e) {
    this.setData({ selectedTaste: e.currentTarget.dataset.value });
  },

  onMeatTap: function (e) {
    this.setData({ selectedMeat: e.currentTarget.dataset.value });
  },

  handleGenerate: function () {
    var that = this;
    console.log('开始生成规划...');
    try {
      // 路径：home.js 在 pages/home/，menuData 在 data/，故为 ../../data/menuData.js
      var menuService = require('../../data/menuData.js');

      var pref = {
        taste: that.data.selectedTaste,
        meat: that.data.selectedMeat,
        adultCount: 2,
        hasBaby: that.data.activeMember === 'baby',
        babyMonth: Math.min(36, Math.max(6, that.data.babyMonth))
      };

      var shoppingList = menuService.generateShoppingList(pref);
      var todayMenu = menuService.getTodayMenu(pref);
      console.log('生成的清单:', shoppingList);

      wx.setStorageSync('cart_ingredients', shoppingList || []);
      var dishName = (todayMenu && todayMenu.adultMenu && todayMenu.adultMenu[0]) ? todayMenu.adultMenu[0].name : '定制食谱';
      wx.setStorageSync('selected_dish_name', dishName);

      var weeklyPrefs = [];
      for (var i = 0; i < 7; i++) {
        weeklyPrefs.push({ taste: pref.taste, meat: pref.meat, adultCount: pref.adultCount, hasBaby: pref.hasBaby, babyMonth: pref.babyMonth });
      }
      var weeklyList = menuService.generateWeeklyShoppingList(weeklyPrefs);
      wx.setStorageSync('weekly_ingredients', weeklyList || []);

      getApp().globalData.preference = pref;
      wx.navigateTo({ url: '/pages/menu/menu' });
    } catch (e) {
      console.error('生成失败详情:', e);
      wx.showModal({
        title: '配置错误',
        content: '错误信息：' + (e && e.message ? e.message : String(e)) + '。请检查 menuData.js 路径是否正确。',
        showCancel: false
      });
    }
  }
});
