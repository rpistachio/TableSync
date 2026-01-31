function getCurrentDate() {
  var d = new Date();
  var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
}

Page({
  data: {
    currentDate: getCurrentDate(),
    adultTasteOptions: [
      { label: '快手小炒', value: 'quick_stir_fry', icon: '🔥' },
      { label: '暖心炖煮', value: 'slow_stew', icon: '🍲' },
      { label: '精选蒸/拌', value: 'steamed_salad', icon: '🥗' }
    ],
    babyTasteOptions: [
      { label: '营养粥面', value: 'soft_porridge', icon: '🍚' },
      { label: '趣味手口料', value: 'finger_food', icon: '🥕' },
      { label: '开胃烩菜', value: 'braised_mash', icon: '🍲' }
    ],
    meats: [
      { label: '鸡肉', value: 'chicken', icon: '🍗' },
      { label: '鱼肉', value: 'fish', icon: '🐟' },
      { label: '虾仁', value: 'shrimp', icon: '🦐' },
      { label: '牛肉', value: 'beef', icon: '🥘' },
      { label: '猪肉', value: 'pork', icon: '🥩' }
    ],
    adultTaste: 'quick_stir_fry',
    babyTaste: 'soft_porridge',
    selectedMeat: 'chicken',
    activeMember: 'adult',
    babyMonth: 6,
    adultCount: 2,
    adultCountOptions: [1, 2, 3, 4, 5, 6]
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
    var value = e.currentTarget.dataset.value;
    if (this.data.activeMember === 'adult') {
      this.setData({ adultTaste: value });
    } else {
      this.setData({ babyTaste: value });
    }
  },

  onMeatTap: function (e) {
    this.setData({ selectedMeat: e.currentTarget.dataset.value });
  },

  onAdultCountTap: function (e) {
    var count = parseInt(e.currentTarget.dataset.count, 10);
    if (count >= 1 && count <= 6) this.setData({ adultCount: count });
  },

  handleGenerate: function () {
    var that = this;
    console.log('开始生成规划...');
    try {
      // 路径：home.js 在 pages/home/，menuData 在 data/，故为 ../../data/menuData.js
      var menuService = require('../../data/menuData.js');

      var adultCount = Math.min(6, Math.max(1, that.data.adultCount || 2));
      var hasBaby = that.data.activeMember === 'baby';
      var pref = {
        adultTaste: that.data.adultTaste,
        babyTaste: that.data.babyTaste,
        meat: that.data.selectedMeat,
        adultCount: adultCount,
        hasBaby: hasBaby,
        babyMonth: Math.min(36, Math.max(6, that.data.babyMonth))
      };

      var shoppingList = menuService.generateShoppingList(pref);
      var todayMenu = menuService.getTodayMenu(pref);
      console.log('生成的清单:', shoppingList);

      wx.setStorageSync('cart_ingredients', shoppingList || []);
      var dishName = (todayMenu && todayMenu.adultMenu && todayMenu.adultMenu[0]) ? todayMenu.adultMenu[0].name : '定制食谱';
      wx.setStorageSync('selected_dish_name', dishName);
      var recipe = todayMenu.adultRecipe || todayMenu.babyRecipe;
      var prepTime = (recipe && typeof recipe.prep_time === 'number') ? recipe.prep_time : 0;
      var allergens = (recipe && Array.isArray(recipe.common_allergens)) ? recipe.common_allergens : [];
      wx.setStorageSync('today_prep_time', prepTime);
      wx.setStorageSync('today_allergens', JSON.stringify(allergens));

      var weeklyPrefs = [];
      for (var i = 0; i < 7; i++) {
        weeklyPrefs.push({ adultTaste: pref.adultTaste, babyTaste: pref.babyTaste, meat: pref.meat, adultCount: pref.adultCount, hasBaby: pref.hasBaby, babyMonth: pref.babyMonth });
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
