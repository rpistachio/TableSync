var basket = require('../../data/inspirationBasket.js');
var menuHistory = require('../../utils/menuHistory.js');

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

/** Phase 1: 简单问候，Phase 2 可替换为天气/时段模板 */
function getDefaultVibeGreeting() {
  var d = new Date();
  var weekDay = d.getDay();
  var hour = d.getHours();
  var isWeekend = weekDay === 0 || weekDay === 6;
  if (hour >= 6 && hour < 10) return '早安，今天也要好好吃饭';
  if (hour >= 10 && hour < 14) return '午安，想好晚上吃什么了吗';
  if (hour >= 14 && hour < 18) return '下午好，晚饭可以开始想想啦';
  if (isWeekend) return '周末愉快，做顿好吃的犒劳自己';
  return '下班后，来顿称心的晚餐吧';
}

// 冷启动角标：首帧即从 Storage 读 basketCount，避免 0→N 闪烁（spec 10.7 / Donut）
function getInitialBasketCount() {
  try {
    var todayKey = basket.getTodayDateKey();
    var storedKey = wx.getStorageSync(basket.BASKET_DATE_KEY) || '';
    if (storedKey === todayKey) {
      var raw = wx.getStorageSync(basket.STORAGE_KEY) || '';
      var list = basket.parseBasket(raw);
      return basket.getCount(list);
    }
  } catch (e) { /* ignore */ }
  return 0;
}

Page({
  data: (function () {
    return {
      currentDate: getCurrentDate(),
      vibeWeather: '',
      vibeGreeting: getDefaultVibeGreeting(),
      basketCount: getInitialBasketCount(),
      showHistoryHint: false,
      historyDishNames: []
    };
  })(),

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
    this.setData({ currentDate: getCurrentDate(), vibeGreeting: getDefaultVibeGreeting() });
  },

  onShow: function () {
    var that = this;
    // 注册篮子变更通知，供其他页改篮后首页角标平滑更新（spec 10.7）
    getApp().onBasketChange = function (count) {
      if (count != null) that.setData({ basketCount: count });
    };
    // 每次从其他页返回都从 Storage 读最新篮子数量，保证角标实时
    this._refreshBasket();
    this._refreshHistoryHint();
  },

  onHide: function () {
    getApp().onBasketChange = null;
  },

  /**
   * 读取本地 Storage 中的灵感篮子数据，处理跨天清空，
   * 更新页面角标数字 & globalData 缓存。
   */
  _refreshBasket: function () {
    var todayKey = basket.getTodayDateKey();
    var storedDateKey = '';
    try { storedDateKey = wx.getStorageSync(basket.BASKET_DATE_KEY) || ''; } catch (e) { /* ignore */ }

    var list;
    if (storedDateKey && storedDateKey !== todayKey) {
      // 跨天：清空篮子
      list = basket.emptyBasket();
      try {
        wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(list));
        wx.setStorageSync(basket.BASKET_DATE_KEY, todayKey);
      } catch (e) { /* ignore */ }
    } else {
      var raw = '';
      try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
      list = basket.parseBasket(raw);
      // 若篮子非空但日期 key 尚未写入（首次添加场景），补写日期
      if (list.length > 0 && !storedDateKey) {
        try { wx.setStorageSync(basket.BASKET_DATE_KEY, todayKey); } catch (e) { /* ignore */ }
      }
    }

    var count = basket.getCount(list);
    this.setData({ basketCount: count });
    this._refreshHistoryHint(count);

    // 同步到 globalData，供其他页面读取
    var app = getApp();
    if (app && app.globalData) {
      app.globalData.inspirationBasket = list;
    }
  },

  /** 跳转到「今天吃什么」Spinner 页 */
  onGoSpinner: function () {
    wx.navigateTo({ url: '/pages/spinner/spinner' });
  },

  onGoScan: function () {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  onGoImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  },

  onGoMix: function () {
    wx.navigateTo({ url: '/pages/mix/mix' });
  },

  onGoMyRecipes: function () {
    wx.navigateTo({ url: '/pages/myRecipes/myRecipes' });
  },

  /** 跳转到灵感篮子管理页 */
  onGoBasketPreview: function () {
    wx.navigateTo({ url: '/pages/basketPreview/basketPreview' });
  },

  /**
   * Phase C：历史推荐入口。当篮子为空且有过去 7 天烹饪记录时，展示「再来一次？」卡片。
   * @param {number} [basketCount] - 当前篮子数量（若在 _refreshBasket 中调用则传入，避免 setData 未完成）
   */
  _refreshHistoryHint: function (basketCount) {
    var count = basketCount != null ? basketCount : this.data.basketCount;
    if (count > 0) {
      this.setData({ showHistoryHint: false, historyDishNames: [] });
      return;
    }
    var recs = menuHistory.getSmartRecommendations(7, 3);
    var names = recs && recs.length > 0 ? recs.map(function (r) { return r.name; }) : [];
    this.setData({
      showHistoryHint: names.length > 0,
      historyDishNames: names
    });
  }
});
