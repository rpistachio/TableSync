/**
 * sticker-drop 组件
 * 贴纸飘落动画：从屏幕右上角像落叶一样飘下
 * 支持队列：多个贴纸依次飘落展示
 * 支持真实云图片：自动通过 stickerId 获取云存储 URL
 */
var stickerCollection = require('../../data/stickerCollection.js');

Component({
  properties: {
    /** 贴纸队列数组：[{ stickerId, name, emoji }] */
    queue: { type: Array, value: [] },
    /** 是否展示 */
    visible: { type: Boolean, value: false }
  },

  data: {
    currentSticker: null,   // 当前展示的贴纸 { stickerId, name, emoji, imageUrl }
    animPhase: '',          // '' | 'falling' | 'landed' | 'leaving'
    queueIndex: 0
  },

  observers: {
    'visible, queue': function (visible, queue) {
      if (visible && Array.isArray(queue) && queue.length > 0 && !this.data.currentSticker) {
        this.setData({ queueIndex: 0 });
        this._resolveAndStart(queue);
      }
    }
  },

  methods: {
    /**
     * 批量预解析全部队列中贴纸的云图片 URL，然后开始播放
     */
    _resolveAndStart: function (queue) {
      var that = this;
      // 如果已缓存过则直接开始
      if (that._urlCache && Object.keys(that._urlCache).length > 0) {
        that._showNext(0);
        return;
      }
      // 收集所有 fileId
      var fileIds = [];
      for (var i = 0; i < queue.length; i++) {
        if (queue[i] && queue[i].stickerId) {
          fileIds.push(stickerCollection.getStickerCloudFileId(queue[i].stickerId));
        }
      }
      if (fileIds.length === 0 || !(wx.cloud && wx.cloud.getTempFileURL)) {
        that._showNext(0);
        return;
      }
      wx.cloud.getTempFileURL({ fileList: fileIds }).then(function (res) {
        var cache = {};
        var fileList = (res && res.fileList) || [];
        for (var j = 0; j < fileList.length; j++) {
          if (fileList[j] && fileList[j].tempFileURL) {
            cache[fileList[j].fileID] = fileList[j].tempFileURL;
          }
        }
        that._urlCache = cache;
        that._showNext(0);
      }).catch(function () {
        that._showNext(0);
      });
    },

    _getImageUrl: function (stickerId) {
      if (!stickerId) return '';
      var cloudId = stickerCollection.getStickerCloudFileId(stickerId);
      return (this._urlCache && this._urlCache[cloudId]) || '';
    },

    _showNext: function (index) {
      var that = this;
      var queue = this.properties.queue || [];
      if (index >= queue.length) {
        // 队列播放完毕
        that.setData({ currentSticker: null, animPhase: '', queueIndex: 0 });
        that._urlCache = null;
        that.triggerEvent('close');
        return;
      }
      var sticker = queue[index];
      var enriched = {
        stickerId: sticker.stickerId,
        name: sticker.name,
        emoji: sticker.emoji || '✨',
        imageUrl: that._getImageUrl(sticker.stickerId)
      };
      that.setData({
        currentSticker: enriched,
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
    this._urlCache = null;
  }
});
