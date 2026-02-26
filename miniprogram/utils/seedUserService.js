/**
 * 种子用户统计服务
 * ─────────────────────────────────────────────────
 * 1. 渠道追踪：解析 scene / channel 参数，记录用户来源渠道
 *    （小红书、朋友圈纸条、微信好友、自然搜索等）
 * 2. 先锋主厨：前 100 名注册用户获得专属编号 & 问候语标记
 *
 * 云数据库集合：seed_users
 *   { _openid, channel, seq, createdAt, lastVisitAt, visitCount }
 *
 * 本地缓存 key：
 *   seed_user_info  → { seq, channel, createdAt }
 *   seed_channel    → 最近一次识别到的渠道来源
 */

var cloudInit = require('./cloudInitRecipes.js');
var tracker = require('./tracker.js');

// ====== 渠道识别映射 ======
var CHANNEL_MAP = {
  xhs:       '小红书',
  xiaohongshu: '小红书',
  pyq:       '朋友圈',
  moments:   '朋友圈',
  wechat:    '微信好友',
  friend:    '微信好友',
  douyin:    '抖音',
  weibo:     '微博',
  bilibili:  'B站',
  zhihu:     '知乎',
  blog:      '博客',
  qrcode:    '二维码扫码'
};

/**
 * 从页面 options / 启动参数中提取 channel
 * 支持: ?channel=xhs  或  scene 参数（小程序码场景值）
 * @param {Object} options - onLoad / onLaunch 的 options
 * @returns {string} 渠道标识（如 'xhs'），未识别返回 'organic'
 */
function parseChannel(options) {
  if (!options) return 'organic';

  // 1. 直接带 channel 参数
  if (options.channel) {
    return String(options.channel).toLowerCase().trim();
  }

  // 2. 从 scene 参数解析（小程序码带参数场景）
  if (options.scene) {
    try {
      var decoded = decodeURIComponent(options.scene);
      var pairs = decoded.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var kv = pairs[i].split('=');
        if (kv[0] === 'channel' && kv[1]) {
          return String(kv[1]).toLowerCase().trim();
        }
      }
    } catch (e) { /* ignore */ }
  }

  // 3. 从 referrerInfo 判断（从其他小程序跳转）
  if (options.referrerInfo && options.referrerInfo.appId) {
    return 'miniapp_' + options.referrerInfo.appId;
  }

  return 'organic';
}

/**
 * 获取渠道中文名
 * @param {string} channelKey
 * @returns {string}
 */
function getChannelLabel(channelKey) {
  return CHANNEL_MAP[channelKey] || channelKey || '自然流量';
}

/**
 * 将识别到的渠道存入本地 + 上报埋点
 * @param {string} channel
 */
function saveChannel(channel) {
  if (!channel || channel === 'organic') return;
  try {
    wx.setStorageSync('seed_channel', channel);
    tracker.trackEvent('seed_channel_detected', {
      channel: channel,
      channelLabel: getChannelLabel(channel)
    });
  } catch (e) { /* ignore */ }
}

/**
 * 核心：注册 / 识别种子用户，写入云数据库并返回编号
 * ─────────────────────────────────────────────
 * 首次调用时在 seed_users 集合中创建记录并分配 seq（自增编号）
 * 之后每次调用刷新 lastVisitAt + visitCount
 *
 * @param {string} [channel] - 渠道来源
 * @returns {Promise<{ seq: number, channel: string, isNew: boolean, total: number }>}
 */
function registerSeedUser(channel) {
  // 先检查本地缓存，避免重复云请求
  var cached = null;
  try { cached = wx.getStorageSync('seed_user_info'); } catch (e) {}

  if (cached && cached.seq) {
    // 已注册过：仅更新访问信息
    _updateVisit(channel);
    return Promise.resolve({
      seq: cached.seq,
      channel: cached.channel || channel || 'organic',
      isNew: false,
      total: cached.seq // 近似值
    });
  }

  // 云数据库操作（集合不存在或无权限时静默降级，避免 500 影响启动）
  return new Promise(function (resolve) {
    var cloud = cloudInit.getCloudDb();
    var db = cloud.db;
    if (!db) {
      resolve({ seq: 0, channel: channel || 'organic', isNew: false, total: 0 });
      return;
    }

    var col = db.collection('seed_users');
    var now = new Date();
    var ch = channel || 'organic';

    function fallback() {
      resolve({ seq: 0, channel: ch, isNew: false, total: 0 });
    }

    // 安全查询：只读当前用户自己的记录（需在云控制台创建 seed_users 并设置「仅创建者可读写」）
    col.limit(1).get().then(function (res) {
      if (res.data && res.data.length > 0) {
        var existing = res.data[0];
        var info = {
          seq: existing.seq || 0,
          channel: existing.channel || ch,
          createdAt: existing.createdAt
        };
        try { wx.setStorageSync('seed_user_info', info); } catch (e) {}
        _updateVisit(ch);
        resolve({
          seq: info.seq,
          channel: info.channel,
          isNew: false,
          total: info.seq
        });
        return;
      }
      return col.count().then(function (countRes) {
        var seq = (countRes.total || 0) + 1;
        return col.add({
          data: {
            channel: ch,
            channelLabel: getChannelLabel(ch),
            seq: seq,
            createdAt: now,
            lastVisitAt: now,
            visitCount: 1
          }
        }).then(function () {
          var info = { seq: seq, channel: ch, createdAt: now };
          try { wx.setStorageSync('seed_user_info', info); } catch (e) {}
          tracker.trackEvent('seed_user_registered', {
            seq: seq,
            channel: ch,
            channel_label: getChannelLabel(ch)
          });
          resolve({ seq: seq, channel: ch, isNew: true, total: seq });
        });
      }).catch(function () {
        fallback();
      });
    }).catch(function (err) {
      // 集合未创建(ResourceNotFound/not exist)时静默降级，其它错误简短提示
      var msg = (err && err.errMsg) ? String(err.errMsg) : '';
      var isCollectionNotExist = /not exist|ResourceNotFound|COLLECTION_NOT_EXIST/i.test(msg);
      if (!isCollectionNotExist) {
        console.warn('[SeedUser] 云数据库不可用，已降级');
      }
      fallback();
    });
  });
}

/**
 * 更新访问记录（静默，不阻塞）
 */
function _updateVisit(channel) {
  try {
    var cloud = cloudInit.getCloudDb();
    var db = cloud.db;
    if (!db) return;
    var _ = db.command;
    db.collection('seed_users').limit(1).get().then(function (res) {
      if (res.data && res.data.length > 0) {
        var docId = res.data[0]._id;
        var updateData = {
          lastVisitAt: new Date(),
          visitCount: _.inc(1)
        };
        if (channel && channel !== 'organic' && !res.data[0].channel) {
          updateData.channel = channel;
          updateData.channelLabel = getChannelLabel(channel);
        }
        db.collection('seed_users').doc(docId).update({ data: updateData }).catch(function () {});
      }
    }).catch(function () {});
  } catch (e) { /* 静默 */ }
}

/**
 * 获取本地缓存的种子用户信息
 * @returns {{ seq: number, channel: string, createdAt: any } | null}
 */
function getLocalSeedInfo() {
  try {
    return wx.getStorageSync('seed_user_info') || null;
  } catch (e) {
    return null;
  }
}

/**
 * 生成先锋主厨问候语
 * 前 100 名用户显示专属编号，之后的用户返回 null（使用默认问候语）
 * @param {number} seq - 用户编号
 * @returns {string|null}
 */
function getPioneerGreeting(seq) {
  if (!seq || seq <= 0 || seq > 100) return null;

  var seqStr = String(seq);
  while (seqStr.length < 3) seqStr = '0' + seqStr;

  return '您好，TableSync 的第 ' + seqStr + ' 位先锋主厨';
}

/**
 * 为分享路径追加 channel 参数
 * @param {string} path - 原始路径，如 '/pages/steps/steps?role=helper&...'
 * @param {string} channel - 渠道标识，如 'xhs'、'pyq'
 * @returns {string} 带 channel 参数的完整路径
 */
function appendChannelToPath(path, channel) {
  if (!path || !channel) return path || '';
  var separator = path.indexOf('?') === -1 ? '?' : '&';
  return path + separator + 'channel=' + encodeURIComponent(channel);
}

/**
 * 生成带渠道标记的分享路径模板
 * 用于在外部平台（小红书、朋友圈）展示时附带追踪参数
 * @param {string} channel - 渠道标识
 * @returns {string} 首页路径 + channel
 */
function getSharePath(channel) {
  return '/pages/home/home?channel=' + encodeURIComponent(channel || 'organic');
}

module.exports = {
  parseChannel: parseChannel,
  getChannelLabel: getChannelLabel,
  saveChannel: saveChannel,
  registerSeedUser: registerSeedUser,
  getLocalSeedInfo: getLocalSeedInfo,
  getPioneerGreeting: getPioneerGreeting,
  appendChannelToPath: appendChannelToPath,
  getSharePath: getSharePath,
  CHANNEL_MAP: CHANNEL_MAP
};
