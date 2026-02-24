/**
 * 首页 Vibe Card 问候文案引擎
 * 三层优先级：状态感知层 > 天气模板层 > 通用 fallback
 */

var RAIN_KEYWORDS = ['雨'];
var SNOW_KEYWORDS = ['雪'];
var COLD_KEYWORDS = ['冷', '寒', '冻'];
var HOT_KEYWORDS = ['晴', '热', '高温'];

function matchWeatherType(text) {
  if (!text) return 'default';
  var t = String(text);
  for (var i = 0; i < RAIN_KEYWORDS.length; i++) {
    if (t.indexOf(RAIN_KEYWORDS[i]) !== -1) return 'rain';
  }
  for (var i = 0; i < SNOW_KEYWORDS.length; i++) {
    if (t.indexOf(SNOW_KEYWORDS[i]) !== -1) return 'snow';
  }
  for (var i = 0; i < COLD_KEYWORDS.length; i++) {
    if (t.indexOf(COLD_KEYWORDS[i]) !== -1) return 'cold';
  }
  for (var i = 0; i < HOT_KEYWORDS.length; i++) {
    if (t.indexOf(HOT_KEYWORDS[i]) !== -1) return 'hot';
  }
  return 'default';
}

var TEMPLATES = [
  { weather: 'rain', weekend: true, time: 'any', text: '雨天的周末，适合窝在家里炖一锅暖汤' },
  { weather: 'rain', weekend: false, time: 'any', text: '下雨天，来点热乎的炖菜吧' },
  { weather: 'rain', weekend: true, time: 'evening', text: '周六的雨天，炖一锅好汤犒劳自己' },
  { weather: 'snow', weekend: true, time: 'any', text: '下雪天，煮一锅暖身的汤最合适' },
  { weather: 'snow', weekend: false, time: 'any', text: '天冷路滑，晚饭做点简单的暖胃菜' },
  { weather: 'cold', weekend: true, time: 'any', text: '天冷了，周末做顿丰盛的暖暖胃' },
  { weather: 'cold', weekend: false, time: 'evening', text: '下班后，来顿热乎的晚餐吧' },
  { weather: 'cold', weekend: false, time: 'any', text: '降温了，今晚吃点暖身的' },
  { weather: 'hot', weekend: true, time: 'any', text: '天气不错，周末试试凉拌或快手菜' },
  { weather: 'hot', weekend: false, time: 'evening', text: '天热别折腾，来个快手菜吧' },
  { weather: 'hot', weekend: false, time: 'any', text: '大热天，清淡凉拌最开胃' },
  { weather: 'default', weekend: true, time: 'morning', text: '周末早安，想好今天吃什么了吗' },
  { weather: 'default', weekend: true, time: 'noon', text: '周末愉快，中午简单点，晚上做顿好的' },
  { weather: 'default', weekend: true, time: 'evening', text: '周六晚上，做顿好吃的犒劳自己' },
  { weather: 'default', weekend: true, time: 'any', text: '周末愉快，做顿好吃的吧' },
  { weather: 'default', weekend: false, time: 'morning', text: '早安，今天也要好好吃饭' },
  { weather: 'default', weekend: false, time: 'noon', text: '午安，想好晚上吃什么了吗' },
  { weather: 'default', weekend: false, time: 'evening', text: '下班后，来顿称心的晚餐吧' },
  { weather: 'default', weekend: false, time: 'any', text: '晚饭时间，吃点称心的' },
  { weather: 'default', weekend: false, time: 'late', text: '加班夜，来个快手菜犒劳自己' }
];

function getTimeSlot(hour) {
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 18) return 'evening';
  if (hour >= 18 && hour < 22) return 'evening';
  if (hour >= 22 || hour < 6) return 'late';
  return 'any';
}

/**
 * 状态感知文案层（优先级最高，命中即返回）
 * @param {Object} ctx - { totalCooks, lastDishName, fridgeExpiringNames, hour }
 * @returns {string|null}
 */
function _contextGreeting(ctx) {
  if (!ctx) return null;
  var hour = typeof ctx.hour === 'number' ? ctx.hour : new Date().getHours();

  // 深夜：温暖关怀
  if (hour >= 22 || hour < 5) {
    return '辛苦了，忙到现在。要不要来点暖胃又不重负担的？';
  }

  // 冰箱有临期食材：激活"清冰箱"心智
  if (Array.isArray(ctx.fridgeExpiringNames) && ctx.fridgeExpiringNames.length > 0) {
    var name = ctx.fridgeExpiringNames[0];
    return '冰箱里的' + name + '该用掉了，今天围绕它做一桌？';
  }

  // 首次使用
  if (ctx.totalCooks === 0 && ctx.visitCount <= 1) {
    return '你好呀，告诉我今晚几个人吃、想吃什么口味';
  }

  // 连续做饭 3+ 天
  if (typeof ctx.totalCooks === 'number' && ctx.totalCooks >= 3) {
    var streak = ctx.totalCooks;
    if (streak >= 7) return '连续第 ' + streak + ' 天下厨，你已经是真正的家庭主厨了';
    if (streak >= 3) return '连续第 ' + streak + ' 天下厨，辛苦了。今天来个省心的？';
  }

  // 上次做了某道菜
  if (ctx.lastDishName) {
    return '上次的' + ctx.lastDishName + '还满意吗？今天换换口味';
  }

  return null;
}

/**
 * 选一条问候语
 * @param {Object} weather - { text?: string, temp?: string }
 * @param {Object} [seedUser] - 种子用户信息 { seq, channel, isNew }
 * @param {Object} [context] - 用户状态上下文 { totalCooks, lastDishName, fridgeExpiringNames, hour, visitCount }
 * @returns {string}
 */
function pickGreeting(weather, seedUser, context) {
  // P0: 先锋主厨彩蛋
  if (seedUser && seedUser.seq > 0 && seedUser.seq <= 100) {
    var seqStr = String(seedUser.seq);
    while (seqStr.length < 3) seqStr = '0' + seqStr;
    return '您好，TableSync 的第 ' + seqStr + ' 位先锋主厨';
  }

  // P1: 状态感知层
  var contextText = _contextGreeting(context);
  if (contextText) return contextText;

  // P2: 天气模板层
  var d = new Date();
  var weekDay = d.getDay();
  var hour = d.getHours();
  var isWeekend = weekDay === 0 || weekDay === 6;
  var timeSlot = getTimeSlot(hour);
  var weatherType = matchWeatherType(weather && weather.text);

  var candidates = TEMPLATES.filter(function (t) {
    if (t.weather !== weatherType && t.weather !== 'default') return false;
    if (t.weekend !== isWeekend) return false;
    if (t.time !== 'any' && t.time !== timeSlot) return false;
    return true;
  });

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)].text;
  }

  return isWeekend ? '周末愉快，做顿好吃的吧' : '下班后，来顿称心的晚餐吧';
}

module.exports = {
  pickGreeting: pickGreeting
};
