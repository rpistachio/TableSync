Page({
  data: {
    ingredientsList: [],
    currentDishName: '未选菜品',
    isEmpty: true
  },

  onLoad: function () {
    this.refreshFromStorage();
  },

  onShow: function () {
    // 每次打开都从缓存刷新清单，确保与首页/其他页写入的数据一致
    this.refreshFromStorage();
  },

  refreshFromStorage: function () {
    var list = wx.getStorageSync('cart_ingredients') || [];
    var dishName = wx.getStorageSync('selected_dish_name') || '未选菜品';
    this.setData({
      ingredientsList: list,
      currentDishName: dishName,
      isEmpty: list.length === 0
    });
  }
});
