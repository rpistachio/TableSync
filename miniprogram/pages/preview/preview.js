var coverService = require('../../data/recipeCoverSlugs.js');
var recipeResources = require('../../data/recipeResources.js');
var menuHistory = require('../../utils/menuHistory.js');
var menuData = require('../../data/menuData.js');
var menuGen = require('../../data/menuGenerator.js');
var seedUserService = require('../../utils/seedUserService.js');

var ENV_ID = 'cloud1-7g5mdmib90e9f670';
var CLOUD_ROOT = recipeResources && recipeResources.CLOUD_ROOT ? recipeResources.CLOUD_ROOT : ('cloud://' + ENV_ID);

function toFullFileId(fileId) {
  if (typeof fileId !== 'string') return '';
  var envPrefix = 'cloud://' + ENV_ID + '/';
  // 传入的是 env 简写形式：cloud://env-id/xxx → cloud://env-id.<appid>/xxx
  if (fileId.indexOf(envPrefix) === 0 && CLOUD_ROOT && CLOUD_ROOT.indexOf('cloud://' + ENV_ID + '.') === 0) {
    return CLOUD_ROOT + '/' + fileId.slice(envPrefix.length);
  }
  return fileId;
}

function toEnvOnlyFileId(fileId) {
  if (typeof fileId !== 'string') return '';
  var fullPrefix = CLOUD_ROOT ? (CLOUD_ROOT + '/') : '';
  if (fullPrefix && fileId.indexOf(fullPrefix) === 0) {
    return 'cloud://' + ENV_ID + '/' + fileId.slice(fullPrefix.length);
  }
  return fileId;
}

function getTodayDateKey() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  var day = String(d.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
}

Page({
  data: {
    previewMenuRows: [],
    previewCountText: '',
    previewComboName: '',
    previewBalanceTip: '',
    previewFallbackMessage: '',
    previewTips: [],
    previewDashboard: { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' },
    previewHasSharedBase: false,
    previewHasBaby: false,
    previewRhythmRings: [],
    previewNarrativeText: '',
    previewMenuSubtitle: '',
    professionalTalkBgUrl: '',
    isImageReady: false,
    isEntering: false,
    chefReportText: '',
    isHelperMode: false,
    isTiredMode: false,
    previewPageTitle: '今日菜单',
    previewPrimaryCta: '开始做饭',
    helperData: { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' },
    adultCount: 2,
    showPersonPicker: false,
    shuffleBtnText: '换一换',
    avoidCapsules: [
      { key: 'spicy', label: '忌辣', active: false },
      { key: 'seafood', label: '忌海鲜', active: false },
      { key: 'peanut', label: '忌花生', active: false },
      { key: 'egg', label: '忌蛋', active: false },
      { key: 'soy', label: '忌豆制品', active: false },
      { key: 'beef_lamb', label: '忌牛羊', active: false },
      { key: 'lactose', label: '忌乳制品', active: false },
      { key: 'cilantro', label: '忌香菜', active: false }
    ]
  },

  onShareAppMessage: function () {
    var payload = getApp().globalData.menuPreview || {};
    var menus = payload.menus || getApp().globalData.todayMenus || [];
    var pref = Object.assign(
      {},
      payload.preference || getApp().globalData.preference || {},
      { adultCount: this.data.adultCount, avoidList: this._getActiveAvoidList() }
    );
    var adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || 2));
    var avoidList = Array.isArray(pref.avoidList) ? pref.avoidList : [];
    var avoidParam = avoidList.length > 0 ? '&avoid=' + encodeURIComponent(avoidList.join(',')) : '';
    var ids = menus.map(function (m) {
      return m.adultRecipe ? (m.adultRecipe.id || m.adultRecipe._id || '') : '';
    }).filter(Boolean).join(',');
    var helperData = this.data.helperData || payload.helperData || {};
    var title = (helperData.mergedTitle && helperData.mergedTitle.trim())
      ? helperData.mergedTitle.trim()
      : '辛苦啦，今晚想吃：' + menus.map(function (m) { return (m.adultRecipe && m.adultRecipe.name) || ''; }).filter(Boolean).join('、');
    if (!title || title === '辛苦啦，今晚想吃：') title = '帮我做今晚的饭，步骤都准备好了';
    var sharePath = '/pages/steps/steps?role=helper&recipeIds=' + encodeURIComponent(ids) + '&adultCount=' + adultCount + avoidParam;
    sharePath = seedUserService.appendChannelToPath(sharePath, 'wechat');
    return {
      title: title,
      path: sharePath,
      imageUrl: CLOUD_ROOT + '/background_pic/help_background.png'
    };
  },

  onLoad: function () {
    this._pageAlive = true;
    var that = this;
    try {
      var fallbackMessage = (getApp().globalData && getApp().globalData.previewFallbackMessage) ? getApp().globalData.previewFallbackMessage : '';
      // 图片（cloud://）解析放到 onReady：避免渲染层过早创建 <image> 导致 500 / 被当作本地资源
      that.setData({ isImageReady: false });
      that._pageReady = false;
      that._pendingResolve = false;

      // 1. 优先从 Storage 读取核心数据
      var menusJson = wx.getStorageSync('today_menus');
      if (!menusJson) {
        wx.showModal({
          title: '提示',
          content: '数据已失效，请重新生成',
          showCancel: false,
          success: function () { wx.navigateBack(); }
        });
        return;
      }

      var menus = JSON.parse(menusJson);
      // 若为精简格式（如从「开始做饭」存下来的），还原为完整菜单
      if (menuData.isSlimMenuFormat && menuData.isSlimMenuFormat(menus)) {
        var prefRaw = '';
        try { prefRaw = wx.getStorageSync('today_menus_preference') || ''; } catch (e) {}
        var storedPref = prefRaw ? JSON.parse(prefRaw) : (getApp().globalData.preference || {});
        menus = menuData.deserializeMenusFromStorage(menus, storedPref);
        if (storedPref && Object.keys(storedPref).length) getApp().globalData.preference = storedPref;
      }
      // 防御：若历史数据中有同名重复菜，只保留每道菜第一次出现
      var seenNames = {};
      menus = menus.filter(function (m) {
        var name = (m.adultRecipe && m.adultRecipe.name) || '';
        if (!name) return true;
        if (seenNames[name]) return false;
        seenNames[name] = true;
        return true;
      });
      if (menus.length > 0) {
        try { wx.setStorageSync('today_menus', JSON.stringify(menus)); } catch (e) {}
      }

      var pref = getApp().globalData.preference || {};
      var hasBaby = !!(pref && pref.hasBaby);
      var who = 'self'; // cookWho 始终为 self，不再从 Storage 读取
      var isTimeSave = pref.isTimeSave === true || pref.is_time_save === true || (wx.getStorageSync('zen_cook_status') === 'tired');
      var isHelperMode = false; // 本机始终为标准视图；分享链接通过 role=helper 进入纸条模式
      var isTiredMode = isTimeSave;

      // 主厨报告：读取 AI reasoning
      var chefReportText = getApp().globalData.chefReportText || '';
      var dishHighlights = getApp().globalData.dishHighlights || {};

      // 2. 映射 UI 渲染所需的 rows 结构
      var rows = menus.map(function (m, idx) {
        var recipeName = m.adultRecipe ? m.adultRecipe.name : '';
        var babyName = m.babyRecipe ? m.babyRecipe.name : '';
        var recipeId = m.adultRecipe ? (m.adultRecipe.id || m.adultRecipe._id || '') : '';
        var highlight = dishHighlights[recipeId] || '';
        var cookType = (m.adultRecipe && m.adultRecipe.cook_type) || '';
        return {
          adultName: recipeName || '未知菜谱',
          babyName: babyName,
          showSharedHint: hasBaby && !!babyName && idx === 0,
          recommendReason: highlight || (m.adultRecipe ? (m.adultRecipe.recommend_reason || '营养均衡，口味适宜') : ''),
          checked: true,
          cookType: cookType,
          coverUrl: coverService.getRecipeCoverImageUrl(recipeName),
          coverTempUrl: '',
          hasCover: !!coverService.RECIPE_NAME_TO_SLUG[recipeName]
        };
      });

      // 3. 计算看板数据（Dashboard）
      var dashboard = {};
      if (typeof that._computePreviewDashboard === 'function') {
        dashboard = that._computePreviewDashboard(menus, pref);
      }

      // 4. 一次性 setData
      var hasSharedBase = rows.some(function (r) { return r.showSharedHint; });
      var tips = that._buildPreviewTips(dashboard, hasSharedBase, '', fallbackMessage);
      var previewPageTitle = isHelperMode ? '给 Ta 的菜单' : '今日菜单';
      var previewPrimaryCta = isHelperMode ? '把纸条贴给 Ta' : '开始做饭';
      var helperData = { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' };
      if (isHelperMode && menus.length > 0) {
        try {
          var shoppingList = menuData.generateShoppingListFromMenus(pref, menus) || [];
          var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var result = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (result.steps && result.steps.length > 0 && menuGen.formatForHelperFromResult) {
            helperData = menuGen.formatForHelperFromResult(result, pref);
          } else if (menuGen.formatForHelper) {
            helperData = menuGen.formatForHelper(menus, pref, shoppingList);
          }
        } catch (e) {
          console.warn('helperData (formatForHelperFromResult/formatForHelper) failed:', e);
        }
      }
      var adultCount = Math.min(6, Math.max(1, Number(pref.adultCount) || 2));
      var avoidList = Array.isArray(pref.avoidList) ? pref.avoidList : [];
      var avoidCapsules = that.data.avoidCapsules.slice().map(function (cap) {
        return { key: cap.key, label: cap.label, active: avoidList.indexOf(cap.key) !== -1 };
      });
      that.setData({
        previewMenuRows: rows,
        previewDashboard: dashboard,
        previewHasBaby: hasBaby,
        previewHasSharedBase: hasSharedBase,
        previewComboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : ''),
        previewRhythmRings: isHelperMode ? [] : that._buildPreviewRhythmRings(menus),
        chefReportText: chefReportText,
        previewNarrativeText: that._buildNarrativeText(dashboard, chefReportText),
        previewMenuSubtitle: isHelperMode ? '' : that._buildMenuSubtitle(rows),
        previewFallbackMessage: fallbackMessage,
        previewTips: tips,
        isHelperMode: isHelperMode,
        isTiredMode: isTiredMode,
        previewPageTitle: previewPageTitle,
        previewPrimaryCta: previewPrimaryCta,
        helperData: helperData,
        adultCount: adultCount,
        avoidCapsules: avoidCapsules.length ? avoidCapsules : that.data.avoidCapsules
      }, function () {
        // rows 真正进入视图层后，再按 onReady 规则触发图片解析
        if (that._pageReady) that._resolvePreviewImages();
        else that._pendingResolve = true;
      });

      

      // 5. 延迟触发微缩转盘入场动画
      setTimeout(function () {
        if (that._pageAlive) that.setData({ isEntering: true });
      }, 300);

      // 6. 将解析后的对象同步回 globalData 以便「换一换」逻辑使用
      that._fullPreviewMenus = menus;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.menuPreview = {
        menus: menus,
        rows: rows,
        preference: pref,
        dashboard: dashboard,
        comboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : ''),
        balanceTip: '',
        hasSharedBase: rows.some(function (r) { return r.showSharedHint; })
      };

      // 7. helper 模式：同步云端菜谱后刷新纸条步骤，确保与 spec 8 一致（步骤从当前缓存按 id 解析）
      if (isHelperMode && menus.length > 0) {
        var app = getApp();
        if (app.syncCloudRecipes && typeof app.syncCloudRecipes === 'function') {
          app.syncCloudRecipes().then(function () {
            if (!that._pageAlive) return;
            try {
              var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
              var result = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
              if (result.steps && result.steps.length > 0 && menuGen.formatForHelperFromResult) {
                var nextHelperData = menuGen.formatForHelperFromResult(result, pref);
                that.setData({ helperData: nextHelperData });
              }
            } catch (err) {
              console.warn('[preview] 云端同步后刷新 helperData 失败:', err);
            }
          }).catch(function () {});
        }
      }
    } catch (e) {
      console.error('Preview onLoad Error:', e);
      wx.showModal({
        title: '提示',
        content: '数据已失效，请返回首页重新生成',
        showCancel: false,
        success: function () { wx.navigateBack(); }
      });
    }
  },
  
  onShow: function () {
    this._pageAlive = true;
  },
  
  onHide: function () {
    this._pageAlive = false;
  },
  
  onUnload: function () {
    this._pageAlive = false;
  },

  onReady: function () {
    // 统一在 onReady 解析 cloud:// 到临时 HTTPS URL，
    // 并用 isImageReady 门控，让 <image> 只在 URL 就绪后才出现在 WXML 中。
    this._pageReady = true;
    if (this._pendingResolve) {
      this._pendingResolve = false;
      this._resolvePreviewImages();
      return;
    }
    // 兜底：如果 rows 已经在 onLoad 中写入，则正常执行；否则稍后由 onLoad 的 setData callback 触发
    if ((this.data.previewMenuRows || []).length > 0) {
      this._resolvePreviewImages();
    }
  },

  _swapImageExt: function (fileId) {
    if (typeof fileId !== 'string') return '';
    if (/\.png$/i.test(fileId)) return fileId.replace(/\.png$/i, '.jpg');
    if (/\.jpe?g$/i.test(fileId)) return fileId.replace(/\.jpe?g$/i, '.png');
    return '';
  },

  _resolvePreviewImages: function () {
    var that = this;
    if (!(wx.cloud && wx.cloud.getTempFileURL)) {
      // 没有云能力时不渲染任何云图，避免 src 走本地路径触发异常
      that.setData({ isImageReady: false });
      return;
    }

    var rows = that.data.previewMenuRows || [];
    var fileIds = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].hasCover && typeof rows[i].coverUrl === 'string' && rows[i].coverUrl.indexOf('cloud://') === 0) {
        fileIds.push(toFullFileId(rows[i].coverUrl));
      }
    }

    // 营养师插图
    var talkBgCloudId = CLOUD_ROOT + '/background_pic/professional_talk_background.png';
    fileIds.push(talkBgCloudId);

    // 去重，避免重复请求
    var uniq = [];
    var seen = Object.create(null);
    for (var u = 0; u < fileIds.length; u++) {
      var id = fileIds[u];
      if (!id || seen[id]) continue;
      seen[id] = true;
      uniq.push(id);
    }

    that.setData({ isImageReady: false });

    function applyTempUrls(tempMap) {
      var newRows = rows.map(function (r) {
        if (!r || !r.hasCover) return r;
        var cloudId = (typeof r.coverUrl === 'string' && r.coverUrl.indexOf('cloud://') === 0) ? r.coverUrl : '';
        if (!cloudId) return r;
        var tmp = tempMap[cloudId];
        if (!tmp) return Object.assign({}, r, { coverTempUrl: '' });
        return Object.assign({}, r, { coverTempUrl: tmp });
      });

      // 营养师插图 URL
      var talkUrl = tempMap[talkBgCloudId] || '';

      that.setData({
        previewMenuRows: newRows,
        isImageReady: true,
        professionalTalkBgUrl: talkUrl
      });

      // 同步回 globalData：确保后续页面/逻辑读到的是可渲染的 URL
      try {
        var payload = getApp().globalData.menuPreview;
        if (payload && Array.isArray(payload.rows)) {
          payload.rows = newRows;
        }
      } catch (e) {}
    }

    wx.cloud.getTempFileURL({
      fileList: uniq,
      success: function (res) {
        var list = (res && res.fileList) ? res.fileList : [];
        var tempMap = Object.create(null);
        var failed = [];

        for (var i = 0; i < list.length; i++) {
          var it = list[i] || {};
          if (it.fileID && it.tempFileURL) {
            tempMap[it.fileID] = it.tempFileURL;
            // 同时写一份 env 简写 key，方便用原 coverUrl(简写) 来取
            tempMap[toEnvOnlyFileId(it.fileID)] = it.tempFileURL;
          } else if (it.fileID) {
            failed.push(it.fileID);
          }
        }

        // 兜底：若扩展名不匹配（png/jpg），尝试自动切换扩展名再取一次
        var retry = [];
        for (var j = 0; j < failed.length; j++) {
          var alt = that._swapImageExt(failed[j]);
          if (alt) retry.push(alt);
        }

        if (retry.length === 0) {
          applyTempUrls(tempMap);
          return;
        }

        wx.cloud.getTempFileURL({
          fileList: retry,
          success: function (res2) {
            var list2 = (res2 && res2.fileList) ? res2.fileList : [];
            for (var k = 0; k < list2.length; k++) {
              var it2 = list2[k] || {};
              if (it2.fileID && it2.tempFileURL) {
                // 把 alt fileID 也映射回原 fileID（通过 swap 反推）
                var back = that._swapImageExt(it2.fileID);
                if (back) {
                  tempMap[back] = it2.tempFileURL;
                  tempMap[toEnvOnlyFileId(back)] = it2.tempFileURL;
                }
                tempMap[it2.fileID] = it2.tempFileURL;
                tempMap[toEnvOnlyFileId(it2.fileID)] = it2.tempFileURL;
              }
            }
            applyTempUrls(tempMap);
          },
          fail: function () {
            applyTempUrls(tempMap);
          }
        });
      },
      fail: function () {
        that.setData({ isImageReady: false });
      }
    });
  },

  onCheckRow: function (e) {
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = (this.data.previewMenuRows || []).slice();
    if (!menus[index] || !rows[index]) return;
    var newChecked = !menus[index].checked;
    menus[index].checked = newChecked;
    rows[index] = Object.assign({}, rows[index], { checked: newChecked });
    if (payload) payload.menus = menus;
    if (payload) payload.rows = rows;
    this.setData({ previewMenuRows: rows });
  },

  onReplaceSingle: function (e) {
    var index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index < 0) return;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = (this.data.previewMenuRows || []).slice();
    if (!menus[index] || !rows[index]) return;
    // 先将目标菜品标为未勾选
    menus[index].checked = false;
    rows[index] = Object.assign({}, rows[index], { checked: false });
    if (payload) { payload.menus = menus; payload.rows = rows; }
    this.setData({ previewMenuRows: rows }, function () {
      // 然后调用已有的替换未勾选逻辑
      this.handleReplaceUnchecked();
    }.bind(this));
  },

  handleShuffle: function () {
    var that = this;
    var rows = that.data.previewMenuRows || [];
    var hasUnchecked = rows.some(function (r) { return !r.checked; });
    if (hasUnchecked) {
      that.handleReplaceUnchecked();
      return;
    }
    try {
      var menuService = require('../../data/menuData.js');
      var payload = getApp().globalData.menuPreview;
      var pref = Object.assign(
        {},
        payload && payload.preference ? payload.preference : that._defaultPreference(),
        { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() }
      );
      // 换一桌时排除当前桌已有菜品，避免重复
      var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
      if (currentNames.length > 0) pref.excludeRecipeNames = currentNames;
      var result = menuService.getTodayMenusByCombo(pref);
      var rawMenus = result.menus || result;
      var hasBaby = pref.hasBaby === true;
      if (!hasBaby) rawMenus.forEach(function (m) { m.babyRecipe = null; });
      var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
      var newRows = [];
      for (var idx = 0; idx < newMenus.length; idx++) {
        var m = newMenus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : '';
        var sameAsAdultHint = (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '';
        newRows.push({
          adultName: adultName,
          babyName: babyName,
          showSharedHint: hasBaby && babyName && idx === 0,
          checked: true,
          recommendReason: reason,
          sameAsAdultHint: sameAsAdultHint,
          cookType: (ar && ar.cook_type) || '',
          coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: '',
          hasCover: !!coverService.RECIPE_NAME_TO_SLUG[adultName]
        });
      }
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
      var balanceTip = '';
      var hasSpicy = false, hasLightOrSweet = false;
      for (var b = 0; b < newMenus.length; b++) {
        var fl = (newMenus[b].adultRecipe && newMenus[b].adultRecipe.flavor_profile) || '';
        if (fl === 'spicy') hasSpicy = true;
        if (fl === 'light' || fl === 'sweet_sour' || fl === 'sour_fresh') hasLightOrSweet = true;
      }
      if (hasSpicy && hasLightOrSweet) balanceTip = '口味互补：辣配清淡/酸甜，味觉更舒适';
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = dashboard;
        getApp().globalData.menuPreview.hasSharedBase = hasSharedBase;
        getApp().globalData.menuPreview.comboName = result.comboName || '';
        getApp().globalData.menuPreview.balanceTip = balanceTip;
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      var tips = that._buildPreviewTips(dashboard, hasSharedBase, balanceTip, that.data.previewFallbackMessage);
      var nextHelperData = that.data.helperData || { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' };
      if (that.data.isHelperMode && newMenus.length > 0) {
        try {
          var menuGen = require('../../data/menuGenerator.js');
          var shopList = menuService.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('helperData on shuffle failed:', e); }
      }
      that.setData(
        {
          previewMenuRows: newRows,
          previewComboName: result.comboName || '',
          previewBalanceTip: balanceTip,
          previewDashboard: dashboard,
          previewHasSharedBase: hasSharedBase,
          previewHasBaby: hasBaby,
          previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
          previewNarrativeText: that._buildNarrativeText(dashboard, ''),
          previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
          helperData: nextHelperData,
          isImageReady: false,
          chefReportText: '',
          previewTips: tips
        },
        function () { if (that._pageReady) that._resolvePreviewImages(); }
      );

    } catch (e) {
      console.error('换一换失败:', e);
      wx.showToast({ title: '换一换失败', icon: 'none' });
    }
  },

  handleReplaceUnchecked: function () {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var rows = that.data.previewMenuRows || [];
    if (menus.length === 0 || rows.length === 0) return;
    var uncheckedIndices = [];
    for (var u = 0; u < rows.length; u++) {
      if (!rows[u].checked) uncheckedIndices.push(u);
    }
    if (uncheckedIndices.length === 0) {
      wx.showToast({ title: '请先取消勾选要换掉的菜品', icon: 'none' });
      return;
    }
    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : that._defaultPreference(),
      { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() }
    );
    var hasBaby = pref.hasBaby;
    var babyMonth = pref.babyMonth;
    var adultCount = pref.adultCount;
    var firstMeatIndex = -1;
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].meat !== 'vegetable') { firstMeatIndex = i; break; }
    }
    try {
      var generator = require('../../data/menuGenerator.js');
      var menuService = require('../../data/menuData.js');
      var selectedMenus = [];
      var checkedMeats = [];
      for (var j = 0; j < menus.length; j++) {
        if (rows[j].checked) {
          selectedMenus.push(menus[j]);
          var m = (menus[j].adultRecipe && menus[j].adultRecipe.meat) || menus[j].meat;
          if (m && checkedMeats.indexOf(m) === -1) checkedMeats.push(m);
        }
      }
      var counts = menuService.getFlavorAndCookCounts(selectedMenus);
      var forceLight = (counts.spicy + counts.savory) > 2;
      var curStirFry = counts.stirFry;
      var curStew = counts.stew;
      var balanceTip = '';
      if (forceLight) balanceTip = '当前偏重下饭，已为您补充清爽汤品';
      else if (curStew >= 1) balanceTip = '已有炖菜，已为您补充快手小炒';
      var newMenus = [];
      var newRows = [];
      for (var i = 0; i < menus.length; i++) {
        if (rows[i].checked) {
          newMenus.push(menus[i]);
          newRows.push(rows[i]);
        } else {
          var hasBabyThis = hasBaby && menus[i].meat !== 'vegetable' && i === firstMeatIndex;
          var constraints = { forceLight: forceLight, currentStirFry: curStirFry, currentStew: curStew, excludeMeats: checkedMeats };
          var picked = menuService.pickReplacementFromCache(menus[i].meat, constraints);
          var res;
          if (picked) {
            res = generator.generateMenuFromRecipe(picked, babyMonth, hasBabyThis, adultCount, 'soft_porridge');
          } else {
            var filters = { preferredFlavor: forceLight ? 'light' : null, preferQuick: curStew >= 1 };
            res = generator.generateMenuWithFilters(menus[i].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
          }
          var newSlot = {
            meat: (res.adultRecipe && res.adultRecipe.meat) || menus[i].meat,
            taste: (res.adultRecipe && res.adultRecipe.taste) || menus[i].taste,
            adultRecipe: res.adultRecipe || null,
            babyRecipe: res.babyRecipe || null,
            checked: true
          };
          newMenus.push(newSlot);
          if (newSlot.adultRecipe) {
            var ct = newSlot.adultRecipe.cook_type || '';
            if (ct === 'stir_fry') curStirFry++;
            else if (ct === 'stew') curStew++;
          }
          var ar = newSlot.adultRecipe;
          var st = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
          var adultNameNew = (ar && ar.name) ? ar.name : '—';
          newRows.push({
            adultName: adultNameNew,
            babyName: (st && st.name) || (newSlot.babyRecipe && newSlot.babyRecipe.name) || '',
            showSharedHint: hasBaby && newSlot.babyRecipe && i === firstMeatIndex,
            checked: true,
            recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : '',
            sameAsAdultHint: (st && st.same_as_adult_hint) ? '与大人同款，分装即可' : '',
            cookType: (ar && ar.cook_type) || '',
            coverUrl: coverService.getRecipeCoverImageUrl(adultNameNew),
            coverTempUrl: '',
            hasCover: !!coverService.RECIPE_NAME_TO_SLUG[adultNameNew]
          });
        }
      }
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = that._computePreviewDashboard(newMenus, pref);
        getApp().globalData.menuPreview.hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
        getApp().globalData.menuPreview.balanceTip = balanceTip;
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var tips = that._buildPreviewTips(dashboard, newRows.some(function (r) { return r.showSharedHint; }), balanceTip, that.data.previewFallbackMessage);
      var nextHelperData = that.data.helperData || { mergedTitle: '', combinedPrepItems: [], combinedActions: [], heartMessage: '' };
      if (that.data.isHelperMode && newMenus.length > 0) {
        try {
          var menuData = require('../../data/menuData.js');
          var menuGen = require('../../data/menuGenerator.js');
          var shopList = menuData.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('helperData on replace failed:', e); }
      }
      that.setData({
        previewMenuRows: newRows,
        previewBalanceTip: balanceTip,
        previewDashboard: dashboard,
        previewHasSharedBase: newRows.some(function (r) { return r.showSharedHint; }),
        previewHasBaby: !!(pref && pref.hasBaby),
        previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
        previewNarrativeText: that._buildNarrativeText(dashboard, ''),
        previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
        helperData: nextHelperData,
        isImageReady: false,
        previewTips: tips,
        chefReportText: ''
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });

      // 局部换菜后，主厨报告已不准确，清除
      wx.showToast({ title: '已为您选出更均衡的搭配', icon: 'none' });
    } catch (e) {
      console.error('换掉未勾选失败:', e);
      wx.showToast({ title: '替换失败', icon: 'none' });
    }
  },

  confirmAndGo: function () {
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = Object.assign(
      {},
      payload && payload.preference ? payload.preference : this._defaultPreference(),
      { adultCount: this.data.adultCount, avoidList: this._getActiveAvoidList() }
    );
    if (!menus || menus.length === 0) {
      wx.showToast({ title: '请先生成菜单', icon: 'none' });
      return;
    }
    try {
      var menuService = require('../../data/menuData.js');
      var shoppingList = menuService.generateShoppingListFromMenus(pref, menus);

      wx.setStorageSync('cart_ingredients', shoppingList || []);
      // 使用精简格式存储菜单（仅含菜谱 ID），缩减 storage 体积
      var slimMenus = menuService.serializeMenusForStorage(menus);
      wx.setStorageSync('today_menus', JSON.stringify(slimMenus));
      // 同时存储 preference，用于还原时传递参数
      wx.setStorageSync('today_menus_preference', JSON.stringify(pref));
      wx.setStorageSync('menu_generated_date', getTodayDateKey());

      var dishNames = [];
      menus.forEach(function (m) {
        if (m.adultRecipe && m.adultRecipe.name) dishNames.push(m.adultRecipe.name);
      });
      wx.setStorageSync('selected_dish_name', dishNames.length > 0 ? dishNames.join('、') : '定制食谱');

      var prepTime = 0;
      var allergens = [];
      menus.forEach(function (m) {
        [m.adultRecipe, m.babyRecipe].forEach(function (r) {
          if (!r) return;
          if (typeof r.prep_time === 'number' && r.prep_time > prepTime) prepTime = r.prep_time;
          if (Array.isArray(r.common_allergens)) r.common_allergens.forEach(function (a) { if (a && allergens.indexOf(a) === -1) allergens.push(a); });
        });
      });
      wx.setStorageSync('today_prep_time', prepTime);
      wx.setStorageSync('today_allergens', JSON.stringify(allergens));

      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.mergedShoppingList = shoppingList;

      // 保存到历史记录（供"再来一次"推荐使用）
      try {
        menuHistory.saveToHistory(menus, pref);
      } catch (e) {
        console.warn('保存历史记录失败:', e);
      }

      try {
        var getStepsKey = require('../steps/steps.js').stepsStorageKey;
        if (typeof getStepsKey === 'function') wx.removeStorageSync(getStepsKey());
      } catch (e) {}
      wx.navigateTo({ url: '/pages/shopping/shopping' });
    } catch (e) {
      console.error('开始做饭失败:', e);
      wx.showModal({ title: '提示', content: (e && e.message ? e.message : String(e)), showCancel: false });
    }
  },

  handleSwapOptions: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['换一换', '换掉未勾选'],
      success: function (res) {
        if (res.tapIndex === 0) that.handleShuffle();
        if (res.tapIndex === 1) that.handleReplaceUnchecked();
      }
    });
  },

  _defaultPreference: function () {
    return { adultCount: 2, hasBaby: false, babyMonth: 12, meatCount: 1, vegCount: 1, soupCount: 0, avoidList: [] };
  },

  /** 人数 -> 荤/素道数：2人=1荤1素，3人=2荤1素，4人=2荤2素；疲惫模式各最多1 */
  _computeDishCounts: function (adultCount, isTimeSave) {
    var m = Math.ceil(adultCount / 2);
    var v = Math.floor(adultCount / 2);
    if (isTimeSave) {
      m = Math.min(m, 1);
      v = Math.min(v, 1);
    }
    return { meatCount: m, vegCount: v };
  },

  /** 统一重算：按当前 preference 缩放食材、刷新购物清单、重建 rows/helperData */
  _recalcWithPreference: function () {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    if (!menus || menus.length === 0) return;
    pref = Object.assign({}, pref, { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() });
    var hasBaby = !!pref.hasBaby;
    try {
      for (var i = 0; i < menus.length; i++) {
        var ar = menus[i].adultRecipe;
        if (!ar || !(ar.id || ar._id)) continue;
        var raw = menuData.getAdultRecipeById && menuData.getAdultRecipeById(ar.id || ar._id);
        if (raw) {
          var copy = JSON.parse(JSON.stringify(raw));
          if (menuGen.dynamicScaling) menuGen.dynamicScaling(copy, pref.adultCount);
          menus[i].adultRecipe = copy;
        } else if (menuGen.dynamicScaling) {
          menuGen.dynamicScaling(ar, pref.adultCount);
        }
      }
      var newRows = [];
      for (var idx = 0; idx < menus.length; idx++) {
        var m = menus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuData.getBabyVariantByAge && menuData.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        newRows.push({
          adultName: adultName,
          babyName: babyName,
          showSharedHint: hasBaby && babyName && idx === 0,
          checked: true,
          recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : '',
          sameAsAdultHint: (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '',
          cookType: (ar && ar.cook_type) || '',
          coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: (that.data.previewMenuRows[idx] && that.data.previewMenuRows[idx].coverTempUrl) || '',
          hasCover: !!coverService.RECIPE_NAME_TO_SLUG[adultName]
        });
      }
      var dashboard = that._computePreviewDashboard(menus, pref);
      var shoppingList = menuData.generateShoppingListFromMenus(pref, menus) || [];
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = menus;
      getApp().globalData.menuPreview.menus = menus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.menuPreview.dashboard = dashboard;
      getApp().globalData.mergedShoppingList = shoppingList;
      var nextHelperData = that.data.helperData;
      if (that.data.isHelperMode && menus.length > 0) {
        try {
          var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuData.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(menus, pref, shoppingList);
          }
        } catch (e) { console.warn('_recalcWithPreference helperData failed:', e); }
      }
      that.setData({
        previewMenuRows: newRows,
        previewDashboard: dashboard,
        helperData: nextHelperData
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
    } catch (e) {
      console.error('_recalcWithPreference failed:', e);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  _getActiveAvoidList: function () {
    var caps = this.data.avoidCapsules || [];
    return caps.filter(function (c) { return c.active; }).map(function (c) { return c.key; });
  },

  onChangeAdultCount: function (e) {
    var val = parseInt(e.currentTarget.dataset.value, 10);
    if (isNaN(val) || val < 1 || val > 4) return;
    var oldCount = this.data.adultCount;
    this.setData({ adultCount: val, showPersonPicker: false });

    // 判断菜品道数是否因人数变化而需要调整
    var isTired = this.data.isTiredMode;
    var oldDish = this._computeDishCounts(oldCount, isTired);
    var newDish = this._computeDishCounts(val, isTired);
    var needRegenerate = (oldDish.meatCount !== newDish.meatCount || oldDish.vegCount !== newDish.vegCount);

    if (needRegenerate) {
      // 菜品道数变化 → 重新生成整桌菜单
      this._regenerateMenuForNewCounts(newDish.meatCount, newDish.vegCount);
    } else {
      // 道数不变 → 仅缩放食材份量
      this._recalcWithPreference();
    }
  },

  /** 根据新荤/素道数重新生成菜单 */
  _regenerateMenuForNewCounts: function (meatCount, vegCount) {
    var that = this;
    try {
      var menuService = require('../../data/menuData.js');
      var payload = getApp().globalData.menuPreview;
      var pref = Object.assign(
        {},
        payload && payload.preference ? payload.preference : that._defaultPreference(),
        { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList(), meatCount: meatCount, vegCount: vegCount }
      );
      // 排除当前菜品，尽量保证新鲜感
      var currentNames = (that.data.previewMenuRows || []).map(function (r) { return r.adultName || ''; }).filter(Boolean);
      if (currentNames.length > 0) pref.excludeRecipeNames = currentNames;
      var result = menuService.getTodayMenusByCombo(pref);
      var rawMenus = result.menus || result;
      var hasBaby = pref.hasBaby === true;
      if (!hasBaby) rawMenus.forEach(function (m) { m.babyRecipe = null; });
      var newMenus = rawMenus.map(function (m) { return Object.assign({}, m, { checked: true }); });
      var newRows = [];
      for (var idx = 0; idx < newMenus.length; idx++) {
        var m = newMenus[idx];
        var ar = m.adultRecipe;
        var adultName = (ar && ar.name) ? ar.name : '—';
        var stage = hasBaby && menuData.getBabyVariantByAge && menuData.getBabyVariantByAge(ar, pref.babyMonth);
        var babyName = hasBaby ? ((stage && stage.name) || (m.babyRecipe && m.babyRecipe.name) || '') : '';
        var reason = (ar && ar.recommend_reason) ? ar.recommend_reason : '';
        newRows.push({
          adultName: adultName,
          babyName: babyName,
          showSharedHint: hasBaby && babyName && idx === 0,
          checked: true,
          recommendReason: reason,
          sameAsAdultHint: (stage && stage.same_as_adult_hint) ? '与大人同款，分装即可' : '',
          cookType: (ar && ar.cook_type) || '',
          coverUrl: coverService.getRecipeCoverImageUrl(adultName),
          coverTempUrl: '',
          hasCover: !!coverService.RECIPE_NAME_TO_SLUG[adultName]
        });
      }
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
      var tips = that._buildPreviewTips(dashboard, hasSharedBase, '', that.data.previewFallbackMessage);
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.preference = pref;
        getApp().globalData.menuPreview.dashboard = dashboard;
        getApp().globalData.menuPreview.hasSharedBase = hasSharedBase;
        getApp().globalData.menuPreview.comboName = result.comboName || '';
      }
      getApp().globalData.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      that._fullPreviewMenus = newMenus;
      that.setData({
        previewMenuRows: newRows,
        previewComboName: result.comboName || (meatCount + '荤' + vegCount + '素' + (pref.soupCount ? '1汤' : '')),
        previewDashboard: dashboard,
        previewHasSharedBase: hasSharedBase,
        previewHasBaby: hasBaby,
        previewRhythmRings: that.data.isHelperMode ? [] : that._buildPreviewRhythmRings(newMenus),
        previewNarrativeText: that._buildNarrativeText(dashboard, ''),
        previewMenuSubtitle: that.data.isHelperMode ? '' : that._buildMenuSubtitle(newRows),
        previewTips: tips,
        isImageReady: false,
        chefReportText: ''
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
      wx.showToast({ title: val + '人份，已调整菜品', icon: 'none' });
    } catch (e) {
      console.error('_regenerateMenuForNewCounts failed:', e);
      // 降级：至少做份量缩放
      that._recalcWithPreference();
    }
  },

  onTogglePersonPicker: function () {
    this.setData({ showPersonPicker: !this.data.showPersonPicker });
  },

  onAddDish: function () {
    var that = this;
    wx.showActionSheet({
      itemList: ['再来个汤', '加个素菜', '加个荤菜'],
      success: function (res) {
        var type = ['soup', 'vegetable', 'meat'][res.tapIndex];
        if (type) that.recommendExtra(type);
      }
    });
  },

  recommendExtra: function (type) {
    var that = this;
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    pref = Object.assign({}, pref, { adultCount: that.data.adultCount, avoidList: that._getActiveAvoidList() });
    var hasBaby = !!pref.hasBaby;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || 2;
    var excludeNames = menus.map(function (m) { return (m.adultRecipe && m.adultRecipe.name) || ''; }).filter(Boolean);
    if (excludeNames.length > 0) pref.excludeRecipeNames = excludeNames;
    try {
      var menuService = require('../../data/menuData.js');
      var generator = require('../../data/menuGenerator.js');
      var userPreference = { avoidList: pref.avoidList || [], isTimeSave: pref.isTimeSave, kitchenConfig: pref.kitchenConfig };
      var res;
      if (type === 'soup') {
        var source = menuService.getRecipeSource && menuService.getRecipeSource();
        var adultRecipes = (source && source.adultRecipes) || [];
        var soups = (generator.getSoupRecipes && generator.getSoupRecipes(adultRecipes)) || [];
        var excludeSet = {};
        excludeNames.forEach(function (n) { excludeSet[n] = true; });
        var pick = soups.filter(function (r) { return r.name && !excludeSet[r.name]; });
        if (pick.length === 0) {
          wx.showToast({ title: '暂无可追加的汤', icon: 'none' });
          return;
        }
        var soupRecipe = pick[Math.floor(Math.random() * pick.length)];
        res = generator.generateMenuFromRecipe(soupRecipe, babyMonth, false, adultCount, 'soft_porridge');
      } else {
        var meat = type === 'vegetable' ? 'vegetable' : 'pork';
        var filters = { userPreference: userPreference, existingMenus: menus, stewCountRef: { stewCount: 0 } };
        res = generator.generateMenuWithFilters(meat, babyMonth, false, adultCount, 'soft_porridge', filters);
      }
      var newSlot = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || (type === 'vegetable' ? 'vegetable' : 'pork'),
        taste: (res.adultRecipe && res.adultRecipe.taste) || 'quick_stir_fry',
        adultRecipe: res.adultRecipe || null,
        babyRecipe: null,
        checked: true
      };
      if (!newSlot.adultRecipe) {
        wx.showToast({ title: '暂无可追加的菜', icon: 'none' });
        return;
      }
      var ar = newSlot.adultRecipe;
      var newMenus = menus.concat([newSlot]);
      var newRow = {
        adultName: (ar && ar.name) ? ar.name : '—',
        babyName: '',
        showSharedHint: false,
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : '',
        sameAsAdultHint: '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(ar.name),
        coverTempUrl: '',
        hasCover: !!coverService.RECIPE_NAME_TO_SLUG[ar.name]
      };
      var newRows = (that.data.previewMenuRows || []).concat([newRow]);
      var dashboard = that._computePreviewDashboard(newMenus, pref);
      var nextHelperData = that.data.helperData;
      if (that.data.isHelperMode) {
        try {
          var shopList = menuService.generateShoppingListFromMenus(pref, newMenus) || [];
          var ids = newMenus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
          var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
          if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
            nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
          } else {
            nextHelperData = menuGen.formatForHelper(newMenus, pref, shopList);
          }
        } catch (e) { console.warn('recommendExtra helperData failed:', e); }
      }
      getApp().globalData.menuPreview.menus = newMenus;
      getApp().globalData.menuPreview.rows = newRows;
      getApp().globalData.menuPreview.preference = pref;
      getApp().globalData.todayMenus = newMenus;
      that.setData({
        previewMenuRows: newRows,
        previewDashboard: dashboard,
        helperData: nextHelperData,
        isImageReady: false
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });
      wx.showToast({ title: '已加一道菜', icon: 'none' });
    } catch (e) {
      console.error('recommendExtra failed:', e);
      wx.showToast({ title: '加菜失败', icon: 'none' });
    }
  },

  onToggleAvoid: function (e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    var caps = (this.data.avoidCapsules || []).slice();
    for (var i = 0; i < caps.length; i++) {
      if (caps[i].key === key) {
        caps[i].active = !caps[i].active;
        break;
      }
    }
    this.setData({ avoidCapsules: caps });
    this._checkAndReplaceAvoidConflicts();
    this._recalcWithPreference();
  },

  _checkAndReplaceAvoidConflicts: function () {
    var that = this;
    var avoidList = that._getActiveAvoidList();
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
    pref = Object.assign({}, pref, { avoidList: avoidList });
    var menuService = require('../../data/menuData.js');
    var generator = require('../../data/menuGenerator.js');
    var hasBaby = !!pref.hasBaby;
    var babyMonth = pref.babyMonth || 12;
    var adultCount = pref.adultCount || that.data.adultCount;
    var firstMeatIndex = -1;
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].meat !== 'vegetable') { firstMeatIndex = i; break; }
    }
    var changed = false;
    for (var idx = 0; idx < menus.length; idx++) {
      var r = menus[idx].adultRecipe;
      if (!r) continue;
      var mainIng = r.main_ingredients || [];
      if (!Array.isArray(mainIng)) mainIng = [];
      var hit = false;
      if ((r.flavor_profile || '') === 'spicy' && avoidList.indexOf('spicy') !== -1) hit = true;
      if (!hit && avoidList.indexOf('cilantro') !== -1) {
        for (var ci = 0; ci < mainIng.length; ci++) {
          var mn = String(mainIng[ci] || '');
          if (mn.indexOf('香菜') !== -1 || mn.indexOf('芫荽') !== -1) { hit = true; break; }
        }
      }
      if (!hit && menuGen.recipeContainsAvoid) hit = menuGen.recipeContainsAvoid(r, avoidList);
      if (!hit) continue;
      var hasBabyThis = hasBaby && menus[idx].meat !== 'vegetable' && idx === firstMeatIndex;
      var filters = { userPreference: pref, existingMenus: menus, stewCountRef: { stewCount: 0 } };
      var res = generator.generateMenuWithFilters(menus[idx].meat, babyMonth, hasBabyThis, adultCount, 'soft_porridge', filters);
      var newSlot = {
        meat: (res.adultRecipe && res.adultRecipe.meat) || menus[idx].meat,
        taste: (res.adultRecipe && res.adultRecipe.taste) || menus[idx].taste,
        adultRecipe: res.adultRecipe || null,
        babyRecipe: res.babyRecipe || null,
        checked: true
      };
      menus[idx] = newSlot;
      changed = true;
    }
    if (!changed) return;
    var newRows = [];
    for (var j = 0; j < menus.length; j++) {
      var m = menus[j];
      var ar = m.adultRecipe;
      var adultName = (ar && ar.name) ? ar.name : '—';
      var st = menuService.getBabyVariantByAge && menuService.getBabyVariantByAge(ar, pref.babyMonth);
      newRows.push({
        adultName: adultName,
        babyName: (st && st.name) || (m.babyRecipe && m.babyRecipe.name) || '',
        showSharedHint: hasBaby && j === firstMeatIndex && (m.babyRecipe || st),
        checked: true,
        recommendReason: (ar && ar.recommend_reason) ? ar.recommend_reason : '',
        sameAsAdultHint: (st && st.same_as_adult_hint) ? '与大人同款，分装即可' : '',
        cookType: (ar && ar.cook_type) || '',
        coverUrl: coverService.getRecipeCoverImageUrl(adultName),
        coverTempUrl: (that.data.previewMenuRows[j] && that.data.previewMenuRows[j].coverTempUrl) || '',
        hasCover: !!coverService.RECIPE_NAME_TO_SLUG[adultName]
      });
    }
    getApp().globalData.menuPreview.menus = menus;
    getApp().globalData.menuPreview.rows = newRows;
    getApp().globalData.menuPreview.preference = pref;
    getApp().globalData.todayMenus = menus;
    var dashboard = that._computePreviewDashboard(menus, pref);
    var nextHelperData = that.data.helperData;
    if (that.data.isHelperMode && menus.length > 0) {
      try {
        var shopList = menuService.generateShoppingListFromMenus(pref, menus) || [];
        var ids = menus.map(function (m) { return (m.adultRecipe && (m.adultRecipe.id || m.adultRecipe._id)) || ''; }).filter(Boolean);
        var stepResult = ids.length > 0 ? menuService.generateStepsFromRecipeIds(ids, pref) : { steps: [], menus: [] };
        if (stepResult.steps && stepResult.steps.length > 0 && menuGen.formatForHelperFromResult) {
          nextHelperData = menuGen.formatForHelperFromResult(stepResult, pref);
        } else {
          nextHelperData = menuGen.formatForHelper(menus, pref, shopList);
        }
      } catch (e) { console.warn('_checkAndReplaceAvoidConflicts helperData failed:', e); }
    }
    that.setData({
      previewMenuRows: newRows,
      previewDashboard: dashboard,
      helperData: nextHelperData,
      isImageReady: false
    }, function () { if (that._pageReady) that._resolvePreviewImages(); });
  },

  _buildPreviewRhythmRings: function (menus) {
    if (!Array.isArray(menus) || menus.length === 0) return [];
    var rings = [];
    var colors = ['#E84A27', '#D4421F', '#6cb58b'];
    var radius = 44;
    var circumference = 2 * Math.PI * radius;
    for (var i = 0; i < menus.length && rings.length < 3; i++) {
      var name = (menus[i].adultRecipe && menus[i].adultRecipe.name) || '未命名菜品';
      var percent = 0;
      var dash = (circumference * percent / 100).toFixed(2);
      var dashArray = dash + ' ' + (circumference - dash).toFixed(2);
      rings.push({
        name: name,
        percent: percent,
        dashArray: dashArray,
        color: colors[rings.length % colors.length]
      });
    }
    return rings;
  },

  _buildMenuSubtitle: function (rows) {
    var names = (rows || []).map(function (r) { return r && r.adultName ? r.adultName : ''; }).filter(Boolean);
    if (names.length === 0) return '';
    var subtitle = names.slice(0, 2).join('、');
    if (names.length > 2) subtitle += '等';
    return subtitle;
  },

  _buildNarrativeText: function (dashboard, chefReportText) {
    if (chefReportText) return chefReportText;
    var parts = [];
    if (dashboard && dashboard.nutritionHint) parts.push(dashboard.nutritionHint);
    if (dashboard && dashboard.prepAheadHint) parts.push(dashboard.prepAheadHint);
    if (dashboard && dashboard.prepOrderHint) parts.push(dashboard.prepOrderHint);
    if (parts.length > 0) return parts.join('；');
    return '今天搭了荤素均衡的一桌菜，备好葱姜蒜就能开做，轻松搞定。';
  },

  _buildPreviewTips: function (dashboard, hasSharedBase, balanceTip, fallbackMessage) {
    var tips = [];
    if (fallbackMessage) tips.push(fallbackMessage);
    if (balanceTip) tips.push(balanceTip);
    if (hasSharedBase) tips.push('大人孩子可共用基底，一锅出省时省力');
    if (dashboard && dashboard.sharedIngredientsHint) tips.push(dashboard.sharedIngredientsHint);
    if (dashboard && dashboard.nutritionHint) tips.push(dashboard.nutritionHint);
    if (dashboard && dashboard.prepAheadHint) tips.push(dashboard.prepAheadHint);
    if (dashboard && dashboard.prepOrderHint) tips.push(dashboard.prepOrderHint);
    return tips.slice(0, 2);
  },

  _computePreviewDashboard: function (menus, pref) {
    if (!menus || menus.length === 0) return { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' };
    var maxMinutes = 0;
    var maxPrep = 0;
    var hasStirFry = false, hasStew = false, hasSteam = false;
    var catSet = {};
    var catOrder = { '蔬菜': 1, '肉类': 2, '蛋类': 3, '干货': 4, '其他': 5 };
    for (var i = 0; i < menus.length; i++) {
      var r = menus[i].adultRecipe;
      if (!r) continue;
      var prep = typeof r.prep_time === 'number' ? r.prep_time : 0;
      if (prep > maxPrep) maxPrep = prep;
      var cook = r.cook_minutes != null ? r.cook_minutes : (r.taste === 'slow_stew' ? 60 : 15);
      if (prep + cook > maxMinutes) maxMinutes = prep + cook;
      var ct = r.cook_type || '';
      if (ct === 'stir_fry') hasStirFry = true;
      else if (ct === 'stew') hasStew = true;
      else if (ct === 'steam') hasSteam = true;
      var ings = r.ingredients;
      if (Array.isArray(ings)) {
        for (var j = 0; j < ings.length; j++) {
          var c = (ings[j] && ings[j].category) ? String(ings[j].category).trim() : '';
          if (c && c !== '调料') catSet[c] = (catOrder[c] != null ? catOrder[c] : 99);
        }
      }
      var br = menus[i].babyRecipe;
      if (br && Array.isArray(br.ingredients)) {
        for (var k = 0; k < br.ingredients.length; k++) {
          var bc = (br.ingredients[k] && br.ingredients[k].category) ? String(br.ingredients[k].category).trim() : '';
          if (bc && bc !== '调料') catSet[bc] = (catOrder[bc] != null ? catOrder[bc] : 99);
        }
      }
    }
    var estimatedMinutes = maxMinutes + 10;
    var stoveCount = (hasStirFry ? 1 : 0) + (hasStew ? 1 : 0) + (hasSteam ? 1 : 0);
    var cats = Object.keys(catSet).sort(function (a, b) { return (catSet[a] || 99) - (catSet[b] || 99); });
    var categoryLabels = cats.length > 0 ? cats.join('、') : '';
    var nutritionParts = [];
    if (cats.indexOf('肉类') !== -1) nutritionParts.push('肉');
    if (cats.indexOf('蔬菜') !== -1) nutritionParts.push('菜');
    if (cats.indexOf('蛋类') !== -1) nutritionParts.push('蛋');
    if (cats.indexOf('干货') !== -1) nutritionParts.push('干货');
    var nutritionHint = nutritionParts.length > 0 ? '有' + nutritionParts.join('有') + '，营养搭着来，吃着放心' : '';
    var orderParts = [];
    if (hasStew) orderParts.push('炖/煲');
    if (hasSteam) orderParts.push('蒸');
    if (hasStirFry) orderParts.push('快炒');
    var prepOrderHint = orderParts.length >= 2 ? '先把' + orderParts[0] + '的放上，再来' + orderParts.slice(1).join('、') + '，时间刚刚好' : '';
    var prepAheadHint = '';
    if (maxPrep >= 10) prepAheadHint = '提前 ' + maxPrep + ' 分钟把葱姜蒜备好、肉腌上，到时候下锅就行';
    var sharedIngredientsHint = '';
    var ingCount = {};
    for (var si = 0; si < menus.length; si++) {
      var rec = menus[si].adultRecipe;
      if (!rec || !Array.isArray(rec.ingredients)) continue;
      var seen = {};
      for (var sj = 0; sj < rec.ingredients.length; sj++) {
        var ing = rec.ingredients[sj];
        if (!ing || (ing.category && String(ing.category).trim() === '调料')) continue;
        var n = (ing.name && String(ing.name).trim()) || '';
        if (n && !seen[n]) { seen[n] = true; ingCount[n] = (ingCount[n] || 0) + 1; }
      }
    }
    var shared = [];
    for (var name in ingCount) { if (ingCount[name] >= 2) shared.push(name); }
    if (shared.length > 0) {
      shared = shared.slice(0, 6);
      sharedIngredientsHint = shared.join('、') + '几道菜都用得上，一起备好就行';
    }
    return {
      estimatedTime: estimatedMinutes > 0 ? estimatedMinutes + ' 分钟' : '',
      stoveCount: stoveCount,
      categoryLabels: categoryLabels,
      nutritionHint: nutritionHint,
      prepOrderHint: prepOrderHint,
      prepAheadHint: prepAheadHint,
      sharedIngredientsHint: sharedIngredientsHint
    };
  }
});
