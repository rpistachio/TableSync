/**
 * TableSync 主厨管家 Pro 落地页
 * Fake Door：点击「立即开通」仅埋点 + 创世会员邀请信 + 情绪补偿（解锁换菜限制）
 */
var tracker = require('../../utils/tracker.js');

Page({
  data: {
    statusBarHeight: 0,
    source: '',
    selectedPlan: 'monthly',
    pricingPlans: [
      {
        id: 'trial',
        name: '破冰尝鲜卡',
        price: '¥0.99',
        unit: '首周体验',
        desc: '零杯水车薪，解锁 100% 完整 Pro 特权。',
        popular: false
      },
      {
        id: 'monthly',
        name: '连续包月卡',
        price: '¥15',
        unit: '/ 月',
        desc: '不到一杯美式的价格，买断整整 30 天的厨房从容。',
        popular: true
      },
      {
        id: 'yearly',
        name: '年度管家卡',
        price: '¥128',
        unit: '/ 年',
        desc: '做你一整年的厨房大脑。',
        subNote: '折合 ¥10.6/月',
        popular: false
      }
    ]
  },

  onLoad: function (options) {
    var source = (options && options.source) || 'unknown';
    this.setData({ source: source });
    try {
      var sys = wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 0 });
    } catch (e) {
      this.setData({ statusBarHeight: 0 });
    }
    try {
      tracker.trackEvent('pro_landing_view', { source: source });
    } catch (e) {}
  },

  onBack: function () {
    wx.navigateBack();
  },

  onSelectPlan: function (e) {
    var id = e.currentTarget.dataset.plan;
    if (id) this.setData({ selectedPlan: id });
  },

  onSubscribe: function () {
    var plan = this.data.selectedPlan;
    var source = this.data.source;
    try {
      tracker.trackEvent('pro_landing_subscribe', {
        plan: plan,
        source: source,
        timestamp: Date.now()
      });
    } catch (e) {}

    try {
      wx.setStorageSync('pro_early_bird_registered', true);
      wx.setStorageSync('pro_founding_member', true);
    } catch (e2) {}

    // 情绪补偿：解锁换菜次数限制，让创世会员白嫖已有的本地高级功能
    try {
      var todayKey = 'omakase_reject_' + this._getTodayDateKey();
      wx.setStorageSync(todayKey, 0);
    } catch (e3) {}

    wx.showModal({
      title: '主厨的内部邀请信',
      content: 'TableSync Pro 目前正在进行最后的内测打磨。感谢您的认可，我们已将您加入「创世 Pro 会员」优先候补名单。功能正式上线时，您将首批受邀，并享受永久的早鸟折扣。\n\n作为感谢，今日的「换菜」特权已为您全部解锁。',
      showCancel: false,
      confirmText: '期待上线',
      confirmColor: '#B8976A'
    });
  },

  _getTodayDateKey: function () {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }
});
