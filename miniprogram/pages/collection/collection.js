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
  },

  _refreshList: function () {
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
    var earnedList = defs.map(function (d) {
      var info = earnedMap[d.id];
      var earned = !!info;
      if (earned) totalEarned++;
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
        earnedAt: info ? info.earnedAt : null
      };
    });

    this.setData({
      earnedList: earnedList,
      totalEarned: totalEarned,
      totalDefs: defs.length
    });
  }
});
