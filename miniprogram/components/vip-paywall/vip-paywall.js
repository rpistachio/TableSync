/**
 * vip-paywall 组件
 * VIP 付费引导抽屉：设备隔离（Android 可 Mock 支付，iOS 置灰禁点，合规）
 */
Component({
  properties: {
    visible: { type: Boolean, value: false }
  },

  data: {
    isIOS: false,
    paying: false
  },

  attached: function () {
    try {
      var app = getApp();
      var info = app && app.globalData && app.globalData.platformInfo;
      var platform = (info && info.platform) ? String(info.platform).toLowerCase() : '';
      this.setData({ isIOS: platform === 'ios' });
    } catch (e) {
      this.setData({ isIOS: false });
    }
  },

  methods: {
    onMaskTap: function () {
      this.triggerEvent('close');
    },

    onCloseTap: function () {
      this.triggerEvent('close');
    },

    /** 仅安卓端：创建订单 → 统一下单 → 调起微信支付 → 成功后解锁 */
    onPayTap: function () {
      var self = this;
      if (this.data.isIOS || this.data.paying) return;
      self.setData({ paying: true });

      function done() { self.setData({ paying: false }); }

      wx.cloud.callFunction({ name: 'create_order', data: { productId: 'vip_monthly' } })
        .then(function (res) {
          var result = (res && res.result) || {};
          if (result.code !== 0 || !result.data || !result.data.outTradeNo) {
            wx.showToast({ title: result.message || '创建订单失败', icon: 'none' });
            done();
            return;
          }
          var outTradeNo = result.data.outTradeNo;
          var amount = result.data.amount;
          var description = result.data.description;
          return wx.cloud.callFunction({
            name: 'create_wechat_order',
            data: { outTradeNo: outTradeNo, amount: amount, description: description }
          }).then(function (orderRes) {
            var orderResult = (orderRes && orderRes.result) || {};
            if (orderResult.code !== 0 || !orderResult.data) {
              wx.showToast({ title: orderResult.message || '统一下单失败', icon: 'none' });
              done();
              return;
            }
            var pay = orderResult.data;
            return wx.requestPayment({
              timeStamp: pay.timeStamp,
              nonceStr: pay.nonceStr,
              package: pay.package,
              signType: pay.signType || 'RSA',
              paySign: pay.paySign
            });
          });
        })
        .then(function () {
          getApp().setVip(true);
          self.triggerEvent('unlock');
          self.triggerEvent('close');
          wx.showToast({ title: '支付成功', icon: 'success' });
        })
        .catch(function (err) {
          if (err && err.errMsg && err.errMsg.indexOf('requestPayment:fail cancel') !== -1) {
            return;
          }
          wx.showToast({ title: (err && err.errMsg) || '支付失败', icon: 'none' });
        })
        .then(function () { done(); });
    }
  }
});
