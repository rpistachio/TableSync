/**
 * pro-paywall 组件：Fake Door 付费意愿测试
 * 不调用真实支付，点击「立即开通 Pro」仅弹早鸟提示 + 埋点 + 登记
 */
var tracker = require('../../utils/tracker.js');

var FEATURE_TITLES = {
  nutrition: '本周高级营养分析',
  import: '一键导入菜谱',
  fridge_scan: 'AI 扫描冰箱'
};

Component({
  properties: {
    visible: { type: Boolean, value: false },
    feature: { type: String, value: '' }
  },

  data: {
    featureTitle: ''
  },

  observers: {
    feature: function (v) {
      this.setData({ featureTitle: FEATURE_TITLES[v] || 'Pro 高级功能' });
    },
    visible: function (v) {
      if (v) this._showTime = Date.now();
    }
  },

  methods: {
    onMaskTap: function () {
      this._closeWithDwell();
    },

    onCloseTap: function () {
      this._closeWithDwell();
    },

    _closeWithDwell: function () {
      var dwell = this._showTime ? (Date.now() - this._showTime) : 0;
      try {
        tracker.trackEvent('pro_paywall_close', { feature: this.data.feature, dwell_ms: dwell });
      } catch (e) {}
      this.triggerEvent('close');
    },

    /** 点击「立即开通 Pro」：导航到 Pro 落地页，走统一的定价选择 + 创世邀请信流程 */
    onPayTap: function () {
      var feature = this.data.feature;
      try {
        tracker.trackEvent('pro_pay_click', { feature: feature, timestamp: Date.now() });
      } catch (e) {}
      this.triggerEvent('close');
      wx.navigateTo({ url: '/pages/pro/pro?source=home_' + (feature || 'unknown') });
    }
  },

  lifetimes: {
    attached: function () {
      this._showTime = null;
    }
  },

  pageLifetimes: {
    show: function () {}
  }
});
