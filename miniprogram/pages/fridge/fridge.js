var fridgeStore = require('../../data/fridgeStore.js');

Page({
  data: {
    items: [],
    inputText: '',
    storageType: 'fridge',
    isEmpty: true
  },

  onShow: function () {
    this._refresh();
  },

  _refresh: function () {
    var all = fridgeStore.getAll();
    var now = Date.now();
    var list = all.map(function (item) {
      var daysLeft = fridgeStore.getDaysLeft(item);
      var urgency = 'normal';
      if (daysLeft <= 0) urgency = 'expired';
      else if (daysLeft <= 1) urgency = 'critical';
      else if (daysLeft <= 3) urgency = 'warning';

      var statusText = '';
      if (daysLeft < 0) statusText = '已过期' + Math.abs(daysLeft) + '天';
      else if (daysLeft === 0) statusText = '今天到期!';
      else statusText = '还剩' + daysLeft + '天';

      return {
        id: item.id,
        name: item.name,
        icon: item.icon || '🍽',
        storage: item.storage,
        storageLabel: item.storage === 'freezer' ? '冷冻' : '冷藏',
        statusText: statusText,
        urgency: urgency,
        daysLeft: daysLeft
      };
    });

    this.setData({ items: list, isEmpty: list.length === 0 });
  },

  onInputChange: function (e) {
    this.setData({ inputText: e.detail.value || '' });
  },

  onStorageToggle: function () {
    this.setData({
      storageType: this.data.storageType === 'fridge' ? 'freezer' : 'fridge'
    });
  },

  onAddItems: function () {
    var text = (this.data.inputText || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入食材', icon: 'none' });
      return;
    }
    var added = fridgeStore.addItems(text, this.data.storageType);
    if (added.length === 0) {
      wx.showToast({ title: '未识别到食材', icon: 'none' });
      return;
    }
    this.setData({ inputText: '' });
    this._refresh();
    var names = added.map(function (a) { return a.name; }).join('、');
    wx.showToast({ title: names + ' 已入库', icon: 'none' });
  },

  onInputConfirm: function () {
    this.onAddItems();
  },

  onRemoveItem: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    fridgeStore.removeItem(id);
    this._refresh();
  },

  onToggleItemStorage: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    fridgeStore.toggleStorage(id);
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    this._refresh();
  }
});
