/**
 * 用户行为埋点通用上报（对齐 spec 第 9 章）
 * - 支持 7 个核心烹饪流程事件 + 投篮 / 统筹预览
 * - 优先 wx.reportEvent，失败可入队本地补报
 */

var STORAGE_QUEUE_KEY = 'tablesync_tracking_queue';
var QUEUE_MAX = 50;

/** spec 9.1 定义的 7 个核心埋点事件 + 投篮 / 统筹预览 */
var CORE_EVENT_IDS = [
  'cook_session_start',
  'step_action_click',
  'parallel_group_sync',
  'cooking_pause_resume',
  'cooking_abort',
  'cook_session_finish',
  'linear_fallback_trigger',
  'basket_add',           // 投篮：加入灵感篮
  'schedule_preview_view' // 统筹预览：在 mix 页查看统筹预览
];

/**
 * 统一上报入口
 * @param {string} eventId - 事件 ID，建议使用 CORE_EVENT_IDS 或与微信后台自定义分析一致
 * @param {Object} [properties] - 事件属性（尽量简单类型；数组/对象会被序列化为字符串）
 */
function trackEvent(eventId, properties) {
  if (!eventId || typeof eventId !== 'string') return;

  try {
    if (wx.getStorageSync('tracking_opt_out') === true) return;
  } catch (e) { /* ignore */ }

  var payload = properties && typeof properties === 'object' ? properties : {};
  payload._ts = Date.now();

  try {
    // 微信自定义分析：value 多为简单类型，复杂结构做序列化
    var reportData = {};
    for (var k in payload) {
      if (!payload.hasOwnProperty(k)) continue;
      var v = payload[k];
      if (Array.isArray(v) || (v && typeof v === 'object')) {
        try { reportData[k] = JSON.stringify(v); } catch (e2) { reportData[k] = String(v); }
      } else {
        reportData[k] = v;
      }
    }

    if (typeof wx !== 'undefined' && wx.reportEvent) {
      wx.reportEvent(eventId, reportData);
    }
    if (typeof console !== 'undefined' && console.log) {
      console.log('[Track]', eventId, reportData);
    }
  } catch (e) {
    console.warn('[Track] 上报失败:', eventId, e);
    _enqueue(eventId, payload);
  }
}

function _enqueue(eventId, properties) {
  try {
    var raw = wx.getStorageSync(STORAGE_QUEUE_KEY) || '[]';
    var list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
    list.push({ eventId: eventId, properties: properties || {}, timestamp: Date.now() });
    if (list.length > QUEUE_MAX) list = list.slice(-QUEUE_MAX);
    wx.setStorageSync(STORAGE_QUEUE_KEY, JSON.stringify(list));
  } catch (e2) {
    console.warn('[Track] 入队失败:', e2);
  }
}

/**
 * 将本地队列中的埋点批量上报（如 app.onLaunch / steps.onLoad 时调用）
 */
function flushTrackingQueue() {
  try {
    var raw = wx.getStorageSync(STORAGE_QUEUE_KEY) || '[]';
    var list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      try {
        if (wx.reportEvent) wx.reportEvent(item.eventId, item.properties || {});
      } catch (e) { /* skip */ }
    }
    wx.removeStorageSync(STORAGE_QUEUE_KEY);
  } catch (e) {
    console.warn('[Track] 补报队列失败:', e);
  }
}

module.exports = {
  trackEvent: trackEvent,
  flushTrackingQueue: flushTrackingQueue,
  CORE_EVENT_IDS: CORE_EVENT_IDS
};
