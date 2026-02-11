/**
 * sticker-drop 组件
 * 贴纸飘落动画：从屏幕右上角像落叶一样飘下，落到卡片角落
 * 支持队列：多个贴纸依次飘落展示
 */
Component({
  properties: {
    /** 贴纸队列数组：[{ stickerId, name, emoji }] */
    queue: { type: Array, value: [] },
    /** 是否展示 */
    visible: { type: Boolean, value: false }
  },

  data: {
    currentSticker: null,   // 当前展示的贴纸
    animPhase: '',          // '' | 'falling' | 'landed' | 'leaving'
    queueIndex: 0
  },

  observers: {
    'visible, queue': function (visible, queue) {
      if (visible && Array.isArray(queue) && queue.length > 0 && !this.data.currentSticker) {
        this.setData({ queueIndex: 0 });
        this._showNext(0);
      }
    }
  },

  methods: {
    _showNext: function (index) {
      var that = this;
      var queue = this.properties.queue || [];
      if (index >= queue.length) {
        // 队列播放完毕
        that.setData({ currentSticker: null, animPhase: '', queueIndex: 0 });
        that.triggerEvent('close');
        return;
      }
      var sticker = queue[index];
      that.setData({
        currentSticker: sticker,
        animPhase: 'falling',
        queueIndex: index
      });

      // 飘落动画 1.2s → 停留 "landed" 态
      setTimeout(function () {
        that.setData({ animPhase: 'landed' });

        // 停留 2.5s 后自动退场（用户也可点击提前收下）
        that._autoTimer = setTimeout(function () {
          that._dismiss();
        }, 2500);
      }, 1200);
    },

    _dismiss: function () {
      var that = this;
      if (that._autoTimer) { clearTimeout(that._autoTimer); that._autoTimer = null; }
      that.setData({ animPhase: 'leaving' });
      setTimeout(function () {
        var next = that.data.queueIndex + 1;
        that.setData({ currentSticker: null, animPhase: '' });
        // 短暂间隔后播放下一个
        setTimeout(function () {
          that._showNext(next);
        }, 400);
      }, 500);
    },

    onTapCollect: function () {
      this._dismiss();
    },

    // 点击遮罩区域也关闭
    onTapMask: function () {
      this._dismiss();
    }
  },

  detached: function () {
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
  }
});
