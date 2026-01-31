var menuData = require('../../data/menuData.js');

var STORAGE_PREFIX = 'tablesync_steps_completed_';
var KEY_ACTIONS = ['下锅', '打泥', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];

function getStepsPreference() {
  var app = getApp();
  var p = app.globalData.preference || {};
  return {
    adultTaste: p.adultTaste != null ? p.adultTaste : p.taste,
    babyTaste: p.babyTaste,
    meat: p.meat || 'chicken',
    adultCount: Number(p.adultCount) || 2,
    babyMonth: Number(p.babyMonth) || 6,
    hasBaby: p.hasBaby === '1' || p.hasBaby === true
  };
}

function stepsStorageKey() {
  var q = getStepsPreference();
  return STORAGE_PREFIX + (q.adultTaste || q.taste) + '_' + (q.babyTaste || '') + '_' + q.meat + '_' + q.babyMonth + '_' + q.adultCount + '_' + q.hasBaby;
}

function highlightSegments(text) {
  if (!text || typeof text !== 'string') return [{ text: String(text), strong: false }];
  var segments = [];
  var re = new RegExp(KEY_ACTIONS.join('|'), 'g');
  var lastIndex = 0;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) segments.push({ text: text.slice(lastIndex, m.index), strong: false });
    segments.push({ text: m[0], strong: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), strong: false });
  return segments.length > 0 ? segments : [{ text: text, strong: false }];
}

function stepTag(step) {
  if (step.role === 'baby') return '宝宝餐';
  if (step.role === 'adult') return '成人餐';
  if (step.role === 'both') return '成人+宝宝';
  var t = (step.title || '').toString();
  if (/宝宝|辅食/.test(t)) return '宝宝餐';
  if (/成人|主菜/.test(t)) return '成人餐';
  if (/联合|并行|分锅|收尾/.test(t)) return '成人+宝宝';
  return '';
}

function isBabyPortionLine(line) {
  if (!line || typeof line !== 'string') return false;
  return /宝宝/.test(line) && /分拨|分出/.test(line);
}

function processStepsForView(steps) {
  var lastId = steps.length > 0 ? steps[steps.length - 1].id : null;
  return steps.map(function (s) {
    var detailsWithSegments = (s.details || []).map(function (line) {
      return {
        segments: highlightSegments(line),
        isBabyPortion: isBabyPortionLine(line)
      };
    });
    return {
      id: s.id,
      title: s.title,
      details: detailsWithSegments,
      duration: s.duration,
      completed: s.completed,
      roleTag: stepTag(s),
      isLast: lastId !== null && s.id === lastId
    };
  });
}

Page({
  data: {
    steps: [],
    progressPercentage: 0,
    currentStepLabel: '第 0/0 步'
  },

  onLoad: function () {
    var preference = getStepsPreference();
    var steps = menuData.generateSteps(preference);
    try {
      var raw = wx.getStorageSync(stepsStorageKey());
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(function (item) {
            var step = steps.find(function (s) { return s.id === item.id; });
            if (step && item.completed) step.completed = true;
          });
        }
      }
    } catch (e) {}
    this._stepsRaw = steps;
    this._updateView(steps);
  },

  _updateView: function (steps) {
    var completedCount = steps.filter(function (s) { return s.completed; }).length;
    var total = steps.length;
    var progress = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    var currentLabel = '第 ' + Math.min(completedCount + 1, total) + '/' + total + ' 步';
    this.setData({
      steps: processStepsForView(steps),
      progressPercentage: progress,
      currentStepLabel: currentLabel
    });
  },

  markCompleted: function (e) {
    var id = e.currentTarget.dataset.id;
    var steps = this._stepsRaw;
    var step = steps.find(function (s) { return s.id === id; });
    if (!step) return;
    step.completed = true;
    try {
      var payload = steps.map(function (s) { return { id: s.id, completed: s.completed }; });
      wx.setStorageSync(stepsStorageKey(), JSON.stringify(payload));
    } catch (err) {}
    this._updateView(steps);
    var lastId = steps.length > 0 ? steps[steps.length - 1].id : null;
    if (step.id === lastId) {
      wx.showModal({
        title: '料理完成！',
        content: '全家人的美味已准备就绪，开启幸福用餐时光吧。',
        confirmText: '回首页',
        cancelText: '再看看',
        success: function (res) {
          if (res.confirm) {
            try {
              wx.removeStorageSync(stepsStorageKey());
            } catch (e) {}
            wx.reLaunch({ url: '/pages/home/home' });
          }
        }
      });
    }
  },

  onShareAppMessage: function () {
    return { title: '今日家庭午餐 - 做菜步骤', path: '/pages/steps/steps' };
  }
});

module.exports = { stepsStorageKey: stepsStorageKey };
