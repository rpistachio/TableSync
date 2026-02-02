/**
 * 微信小程序云开发 - 菜谱数据库初始化
 *
 * 使用前请确认：
 * 1. project.config.json 中已配置 "cloudfunctionRoot": "cloudfunctions/"
 * 2. 在微信开发者工具中开通云开发并创建环境，在 app.js 中 wx.cloud.init({ traceUser: true }) 已填写 env
 * 3. 本脚本可在「首次部署」时执行一次，或在控制台调用：getApp().initRecipesCollection()
 */

var recipeSchema = require('../data/recipeSchema.js');

/** 云环境 ID（已配置：cloud1-7g5mdmib90e9f670），留空则使用项目默认环境 */
var DEFAULT_ENV = 'cloud1-7g5mdmib90e9f670';

function getCloudDb(options) {
  var env = (options && options.env) || DEFAULT_ENV;
  if (typeof wx === 'undefined' || !wx.cloud) return { db: null, env: env };
  if (env && env !== 'your-env-id') {
    wx.cloud.init({ env: env, traceUser: true });
    return { db: wx.cloud.database({ env: env }), env: env };
  }
  wx.cloud.init({ traceUser: true });
  return { db: wx.cloud.database(), env: env };
}

/**
 * 初始化菜谱集合：若集合为空则写入示例数据（爱料理结构：主料/调料分块、步骤带 step_image_url）
 * @param {Object} options
 * @param {string} [options.env] - 云环境 ID，不传则使用项目默认环境
 * @param {boolean} [options.force] - 是否强制追加（默认 false 仅当集合为空时写入）
 * @returns {Promise<{ success: boolean, added: number, message: string }>}
 */
function initRecipesCollection(options) {
  options = options || {};
  var force = options.force === true;

  return new Promise(function (resolve, reject) {
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.database) {
      resolve({ success: false, added: 0, message: '当前环境不支持云开发，请在微信开发者工具中开通云开发' });
      return;
    }

    var cloud = getCloudDb(options);
    var db = cloud.db;
    if (!db) {
      resolve({ success: false, added: 0, message: '云数据库不可用' });
      return;
    }

    var sampleList = recipeSchema.getSampleRecipesForCloud ? recipeSchema.getSampleRecipesForCloud() : [];
    if (sampleList.length === 0) {
      resolve({ success: true, added: 0, message: '暂无示例数据可导入' });
      return;
    }

    function doAdd() {
      var added = 0;
      var idx = 0;

      function addNext() {
        if (idx >= sampleList.length) {
          resolve({ success: true, added: added, message: '已写入 ' + added + ' 条示例菜谱' });
          return;
        }
        var item = sampleList[idx];
        db.collection('recipes').add({
          data: item
        }).then(function () {
          added++;
          idx++;
          addNext();
        }).catch(function (err) {
          reject(err);
        });
      }

      addNext();
    }

    if (force) {
      doAdd();
      return;
    }

    db.collection('recipes').count().then(function (res) {
      if (res.total > 0) {
        resolve({ success: true, added: 0, message: '集合已有数据，跳过初始化。若需强制写入请传 force: true' });
        return;
      }
      doAdd();
    }).catch(function (err) {
      if (err.errCode === -1 || (err.errMsg && err.errMsg.indexOf('collection') !== -1)) {
        doAdd();
      } else {
        reject(err);
      }
    });
  });
}

/**
 * 一键初始化云开发（含数据库初始化）
 * 可在 app.js onLaunch 后于控制台执行：getApp().initCloudAndRecipes()
 * 或在某个「管理员/调试页」的 onLoad 里调用一次
 */
function initCloudAndRecipes(envId) {
  if (typeof wx === 'undefined' || !wx.cloud) {
    console.warn('[cloudInit] 当前环境不支持云开发');
    return Promise.resolve({ success: false, message: '不支持云开发' });
  }
  var env = envId || DEFAULT_ENV;
  if (env && env !== 'your-env-id') wx.cloud.init({ env: env, traceUser: true });
  else wx.cloud.init({ traceUser: true });
  return initRecipesCollection({ env: env || undefined }).then(function (res) {
    console.log('[cloudInit]', res.message);
    return res;
  });
}

module.exports = {
  initRecipesCollection: initRecipesCollection,
  initCloudAndRecipes: initCloudAndRecipes,
  getCloudDb: getCloudDb,
  DEFAULT_ENV: DEFAULT_ENV
};
