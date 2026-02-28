var fridgeStore = require('../../data/fridgeStore.js');

Page({
  data: {
    items: [],
    inputText: '',
    storageType: 'fridge',
    isEmpty: true,
    expiringCount: 0,
    expiringNames: ''
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

      var maxDays = item.storage === 'freezer' ? 90 : 30;
      var expiryRange = [];
      for (var d = 1; d <= maxDays; d++) expiryRange.push(d + '天');
      var expiryValue = Math.min(Math.max(daysLeft > 0 ? daysLeft - 1 : 0, 0), maxDays - 1);

      return {
        id: item.id,
        name: item.name,
        icon: item.icon || '🍽',
        storage: item.storage,
        storageLabel: item.storage === 'freezer' ? '冷冻' : '冷藏',
        statusText: statusText,
        urgency: urgency,
        daysLeft: daysLeft,
        expiryRange: expiryRange,
        expiryValue: expiryValue
      };
    });

    var expiring = list.filter(function (it) { return it.daysLeft <= 2 && it.urgency !== 'normal'; });
    var expiringNames = expiring.slice(0, 3).map(function (it) { return it.name; }).join('、');

    this.setData({
      items: list,
      isEmpty: list.length === 0,
      expiringCount: expiring.length,
      expiringNames: expiringNames
    });
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
    var all = fridgeStore.getAll();
    if (all.length === added.length) {
      wx.showToast({ title: names + ' 已入库，点下方按钮生成菜谱', icon: 'none', duration: 2500 });
    } else {
      wx.showToast({ title: names + ' 已入库', icon: 'none' });
    }
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

  onExpiryPickerChange: function (e) {
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name || '食材';
    var idx = parseInt(e.detail.value, 10);
    if (isNaN(idx) || !id) return;
    var items = this.data.items || [];
    var item = items.find(function (it) { return it.id === id; });
    if (!item || !item.expiryRange || !item.expiryRange[idx]) return;
    var label = item.expiryRange[idx];
    var newDays = parseInt(label.replace(/[^\d]/g, ''), 10) || 1;
    fridgeStore.updateExpiry(id, newDays);
    this._refresh();
    wx.showToast({ title: name + ' 改为' + newDays + '天', icon: 'none' });
  },

  onGoGenerate: function () {
    getApp().globalData._fromFridgeGenerate = true;
    wx.navigateBack({ delta: 1 });
  },

  onToggleItemStorage: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    fridgeStore.toggleStorage(id);
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    this._refresh();
  }
});
