var stickerCollection = require('../../data/stickerCollection.js');

Page({
  data: {
    earnedList: [],
    allDefs: []
  },

  onLoad: function () {
    var list = stickerCollection.loadCollection();
    var defs = stickerCollection.getAllDefs();
    var earnedIds = {};
    list.forEach(function (item) {
      earnedIds[item.stickerId] = item;
    });
    var earnedList = defs.map(function (d) {
      return {
        id: d.id,
        name: d.name,
        desc: d.desc,
        earned: !!earnedIds[d.id],
        earnedAt: earnedIds[d.id] ? earnedIds[d.id].earnedAt : null
      };
    });
    this.setData({ earnedList: earnedList, allDefs: defs });
  }
});
