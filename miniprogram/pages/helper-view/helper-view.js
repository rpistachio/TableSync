Page({
  data: {
    mergedTitle: '',
    combinedPrepItems: [],
    combinedActions: [],
    heartMessage: '',
    loaded: false
  },

  onLoad: function (options) {
    var mode = options.mode || '';
    if (mode !== 'helper_view') {
      wx.showToast({ title: '无效入口', icon: 'none' });
      return;
    }
    var that = this;
    wx.setKeepScreenOn({ keepScreenOn: true });

    var recipeIds = (options.recipeIds || '').split(',').filter(Boolean);
    var adultCount = Math.min(6, Math.max(1, parseInt(options.adultCount, 10) || 2));
    if (recipeIds.length === 0) {
      that.setData({ loaded: true });
      wx.showToast({ title: '暂无菜单', icon: 'none' });
      return;
    }

    try {
      var menuData = require('../../data/menuData.js');
      var menuGen = require('../../data/menuGenerator.js');
      var menus = [];
      for (var i = 0; i < recipeIds.length; i++) {
        var r = menuData.getAdultRecipeById(recipeIds[i]);
        if (r) menus.push({ adultRecipe: r, babyRecipe: null });
      }
      if (menus.length === 0) {
        that.setData({ loaded: true });
        wx.showToast({ title: '菜谱加载失败', icon: 'none' });
        return;
      }
      var pref = { adultCount: adultCount };
      var shoppingList = menuData.generateShoppingListFromMenus(pref, menus) || [];
      var helperData = menuGen.formatForHelper(menus, pref, shoppingList);
      that.setData({
        mergedTitle: helperData.mergedTitle || '',
        combinedPrepItems: helperData.combinedPrepItems || [],
        combinedActions: helperData.combinedActions || [],
        heartMessage: helperData.heartMessage || '',
        loaded: true
      });
    } catch (e) {
      console.error('helper-view load failed:', e);
      that.setData({ loaded: true });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onUnload: function () {
    wx.setKeepScreenOn({ keepScreenOn: false });
  },

  onConfirmStart: function () {
    wx.showToast({ title: '收到，开工吧', icon: 'success' });
  }
});
