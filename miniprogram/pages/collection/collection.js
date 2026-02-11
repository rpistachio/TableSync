var stickerCollection = require('../../data/stickerCollection.js');

Page({
  data: {
    earnedList: [],
    totalEarned: 0,
    totalDefs: 0
  },

  onLoad: function () {
    this._refreshList();
  },

  onShow: function () {
    this._refreshList();
    // 记录查看时间 → 回到首页时书脊微光消解
    wx.setStorageSync('last_view_collection_time', Date.now());
  },

  _refreshList: function () {
    var that = this;
    var list = stickerCollection.loadCollection();
    var defs = stickerCollection.getAllDefs();

    // 构建 stickerId → 获得次数 & 最新时间
    var earnedMap = {};
    list.forEach(function (item) {
      if (!earnedMap[item.stickerId]) {
        earnedMap[item.stickerId] = { count: 0, earnedAt: item.earnedAt };
      }
      earnedMap[item.stickerId].count++;
      if (item.earnedAt > earnedMap[item.stickerId].earnedAt) {
        earnedMap[item.stickerId].earnedAt = item.earnedAt;
      }
    });

    var totalEarned = 0;
    var earnedList = defs.map(function (d, index) {
      var info = earnedMap[d.id];
      var earned = !!info;
      if (earned) totalEarned++;
      // 手账布局：基于 index 的伪随机，保证每次刷新布局一致
      var seed = index * 137 + 73;
      var rotation = ((seed % 40) - 20) / 10;
      var offsetX = ((seed * 7 + 11) % 9) - 4;
      var tapePos = index % 2 === 0 ? 'left' : 'right';
      var cloudFileID = stickerCollection.getStickerCloudFileId(d.id);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji || '✨',
        desc: d.desc,
        category: d.category || '',
        repeatable: !!d.repeatable,
        maxCount: d.maxCount || 1,
        earned: earned,
        count: info ? info.count : 0,
        earnedAt: info ? info.earnedAt : null,
        rotation: rotation,
        offsetX: offsetX,
        tapePos: tapePos,
        cloudFileID: cloudFileID,
        stickerImageUrl: (that._stickerUrlMap && that._stickerUrlMap[cloudFileID]) || ''
      };
    });

    this.setData({
      earnedList: earnedList,
      totalEarned: totalEarned,
      totalDefs: defs.length
    });
  },

  onReady: function () {
    var that = this;
    if (!(wx.cloud && wx.cloud.getTempFileURL)) return;
    var defs = stickerCollection.getAllDefs();
    var fileIds = defs.map(function (d) { return stickerCollection.getStickerCloudFileId(d.id); });
    wx.cloud.getTempFileURL({ fileList: fileIds }).then(function (res) {
      var urlMap = {};
      var fileList = (res && res.fileList) || [];
      for (var i = 0; i < fileList.length; i++) {
        if (fileList[i] && fileList[i].tempFileURL) {
          urlMap[fileList[i].fileID] = fileList[i].tempFileURL;
        }
      }
      that._stickerUrlMap = urlMap;
      that._refreshList();
    }).catch(function () {});
  }
});
