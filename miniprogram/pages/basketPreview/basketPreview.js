// pages/basketPreview/basketPreview.js
// 灵感篮子管理页 —— 查看、排序、删除、优先级切换、智能历史推荐

var basket = require('../../data/inspirationBasket.js');
var menuHistory = require('../../utils/menuHistory.js');

/** 来源标签映射 */
var SOURCE_LABELS = {
  'native': '菜谱库',
  'imported': '导入菜谱',
  'fridge_match': '冰箱匹配'
};

/** 排序模式 */
var SORT_MODES = [
  { key: 'smart', label: '智能排序' },
  { key: 'time', label: '按时间' },
  { key: 'source', label: '按来源' }
];

Page({
  data: {
    basketList: [],
    empty: true,
    totalCount: 0,
    importedCount: 0,
    fridgeCount: 0,
    nativeCount: 0,
    // 排序
    sortModes: SORT_MODES,
    currentSort: 'smart',
    // 历史推荐
    historyDishes: [],    // [{ name, relativeDay, frequency, inBasket }]
    showHistory: false,
    hasAnyHistory: false
  },

  onLoad: function () {
    this._refreshList();
    this._loadHistoryDishes();
  },

  onShow: function () {
    this._refreshList();
    this._loadHistoryDishes();
  },

  /** 从 Storage 读取篮子数据并刷新列表 */
  _refreshList: function () {
    var raw = '';
    try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
    var list = basket.parseBasket(raw);

    // 根据排序模式排列
    var sortMode = this.data.currentSort || 'smart';
    list = this._sortList(list, sortMode);

    // 构建 UI 列表
    var uiList = list.map(function (item) {
      return {
        id: item.id,
        name: item.name,
        source: item.source,
        sourceLabel: SOURCE_LABELS[item.source] || item.sourceDetail || '未知',
        sourceDetail: item.sourceDetail || '',
        priority: item.priority,
        isHigh: item.priority === 'high',
        addedAt: item.addedAt,
        addedTimeText: item.addedAt ? formatTime(item.addedAt) : ''
      };
    });

    this.setData({
      basketList: uiList,
      empty: uiList.length === 0,
      totalCount: uiList.length,
      importedCount: basket.getBySource(list, 'imported').length,
      fridgeCount: basket.getBySource(list, 'fridge_match').length,
      nativeCount: basket.getBySource(list, 'native').length
    });
  },

  /** 排序逻辑 */
  _sortList: function (list, mode) {
    var sorted = list.slice();
    if (mode === 'time') {
      // 纯按时间倒序
      sorted.sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
    } else if (mode === 'source') {
      // 按来源分组：冰箱匹配 > 导入菜谱 > 菜谱库收藏，组内按时间倒序
      var sourceOrder = { 'fridge_match': 0, 'imported': 1, 'native': 2 };
      sorted.sort(function (a, b) {
        var sa = sourceOrder[a.source] != null ? sourceOrder[a.source] : 9;
        var sb = sourceOrder[b.source] != null ? sourceOrder[b.source] : 9;
        if (sa !== sb) return sa - sb;
        return (b.addedAt || 0) - (a.addedAt || 0);
      });
    } else {
      // smart：高优先 > 冰箱匹配 > 其他，组内按时间倒序
      sorted.sort(function (a, b) {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        var sourceOrder = { 'fridge_match': 0, 'imported': 1, 'native': 2 };
        var sa = sourceOrder[a.source] != null ? sourceOrder[a.source] : 9;
        var sb = sourceOrder[b.source] != null ? sourceOrder[b.source] : 9;
        if (sa !== sb) return sa - sb;
        return (b.addedAt || 0) - (a.addedAt || 0);
      });
    }
    return sorted;
  },

  /** 切换排序模式 */
  onSortTap: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.currentSort) return;
    this.setData({ currentSort: mode });
    this._refreshList();
  },

  /** 切换优先级 */
  onTogglePriority: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;

    var raw = '';
    try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e2) { /* ignore */ }
    var list = basket.parseBasket(raw);

    // 找到目标项，切换优先级
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].priority = list[i].priority === 'high' ? 'normal' : 'high';
        changed = true;
        break;
      }
    }

    if (changed) {
      try {
        wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(list));
      } catch (e3) { /* ignore */ }

      var app = getApp();
      if (app && app.globalData) app.globalData.inspirationBasket = list;
      if (app.onBasketChange) app.onBasketChange(list.length);
    }

    this._refreshList();
  },

  /** 删除某项 */
  onRemoveItem: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;

    var raw = '';
    try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e2) { /* ignore */ }
    var list = basket.parseBasket(raw);
    var newList = basket.removeItemById(list, id);

    try {
      wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(newList));
    } catch (e3) { /* ignore */ }

    // 同步 globalData
    var app = getApp();
    if (app && app.globalData) app.globalData.inspirationBasket = newList;
    if (app.onBasketChange) app.onBasketChange(newList.length);

    this._refreshList();
    this._loadHistoryDishes();
    wx.showToast({ title: '已移除', icon: 'none' });
  },

  /** 清空篮子 */
  onClearAll: function () {
    var that = this;
    wx.showModal({
      title: '清空灵感篮',
      content: '确定要清空今日所有备选菜谱吗？',
      confirmText: '清空',
      confirmColor: '#e85d5d',
      success: function (res) {
        if (!res.confirm) return;
        var emptyList = basket.emptyBasket();
        try {
          wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(emptyList));
        } catch (e) { /* ignore */ }

        var app = getApp();
        if (app && app.globalData) app.globalData.inspirationBasket = emptyList;
        if (app.onBasketChange) app.onBasketChange(0);

        that._refreshList();
        that._loadHistoryDishes();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  /** 加载历史推荐：使用智能排序算法 */
  _loadHistoryDishes: function () {
    var recommendations = menuHistory.getSmartRecommendations(7, 12);
    if (!recommendations || recommendations.length === 0) {
      this.setData({ historyDishes: [], showHistory: false, hasAnyHistory: false });
      return;
    }

    var raw = '';
    try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
    var bList = basket.parseBasket(raw);
    var basketNameSet = {};
    for (var i = 0; i < bList.length; i++) {
      if (bList[i].name) basketNameSet[bList[i].name] = true;
    }

    var dishes = recommendations.map(function (rec) {
      return {
        name: rec.name,
        relativeDay: rec.relativeDay,
        frequency: rec.frequency,
        frequencyText: rec.frequency > 1 ? '做过' + rec.frequency + '次' : '',
        inBasket: !!basketNameSet[rec.name]
      };
    });

    this.setData({
      historyDishes: dishes,
      showHistory: dishes.length > 0,
      hasAnyHistory: true
    });
  },

  /** 切换历史推荐展开/收起 */
  onToggleHistory: function () {
    this.setData({ showHistory: !this.data.showHistory });
  },

  /** 从历史推荐加入篮子 */
  onAddHistoryToBasket: function (e) {
    var name = e.currentTarget.dataset.name;
    if (!name) return;

    var raw = '';
    try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e2) { /* ignore */ }
    var list = basket.parseBasket(raw);

    // 用菜名作为简易 ID
    var item = basket.createItem(
      { id: 'history-' + name, name: name },
      'native',
      { sourceDetail: '历史推荐' }
    );
    var newList = basket.addItem(list, item);

    if (newList.length > list.length) {
      try {
        wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(newList));
        wx.setStorageSync(basket.BASKET_DATE_KEY, basket.getTodayDateKey());
      } catch (e3) { /* ignore */ }

      var app = getApp();
      if (app && app.globalData) app.globalData.inspirationBasket = newList;
      if (app.onBasketChange) app.onBasketChange(newList.length);

      wx.showToast({ title: '已加入灵感篮', icon: 'success' });
    } else {
      wx.showToast({ title: '已在篮子中', icon: 'none' });
    }

    this._refreshList();
    this._loadHistoryDishes();
  },

  /** 直接去生成菜单 */
  onGoSpinner: function () {
    wx.navigateTo({ url: '/pages/spinner/spinner' });
  },

  /** 空状态快捷导航 */
  onGoImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  },

  onGoScan: function () {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  onGoMyRecipes: function () {
    wx.navigateTo({ url: '/pages/myRecipes/myRecipes' });
  },

  /** 返回 */
  onGoBack: function () {
    wx.navigateBack({ delta: 1 });
  }
});

/** 格式化时间戳为 HH:mm */
function formatTime(ts) {
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
