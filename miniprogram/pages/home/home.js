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

Page({
  data: {
    currentDate: getCurrentDate(),
    vibeWeather: '',
    vibeGreeting: getDefaultVibeGreeting()
  },

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
  }
});
