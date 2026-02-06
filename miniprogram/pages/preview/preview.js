var coverService = require('../../data/recipeCoverSlugs.js');
var recipeResources = require('../../data/recipeResources.js');

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
    previewDashboard: { estimatedTime: '', stoveCount: 0, categoryLabels: '', nutritionHint: '', prepOrderHint: '', prepAheadHint: '', sharedIngredientsHint: '' },
    previewHasSharedBase: false,
    previewHasBaby: false,
    headerBgUrl: '',
    isImageReady: false,
    largeTextMode: false,
    isEntering: false
  },

  onLargeTextModeTap: function () {
    this.setData({ largeTextMode: !this.data.largeTextMode });
  },

  onLoad: function () {
    var that = this;
    try {
      // 图片（cloud://）解析放到 onReady：避免渲染层过早创建 <image> 导致 500 / 被当作本地资源
      that.setData({ isImageReady: false, headerBgUrl: '' });
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
      var pref = getApp().globalData.preference || {};

      // 2. 映射 UI 渲染所需的 rows 结构
      var rows = menus.map(function (m) {
        var recipeName = m.adultRecipe ? m.adultRecipe.name : '';
        return {
          adultName: recipeName || '未知菜谱',
          babyName: m.babyRecipe ? m.babyRecipe.name : '',
          recommendReason: m.adultRecipe ? (m.adultRecipe.recommend_reason || '营养均衡，口味适宜') : '',
          checked: true,
          // coverUrl：云端 fileID（cloud://...）；coverTempUrl：可渲染的临时 https URL
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
      that.setData({
        previewMenuRows: rows,
        previewDashboard: dashboard,
        previewComboName: (pref.meatCount || 2) + '荤' + (pref.vegCount || 1) + '素' + (pref.soupCount ? '1汤' : '')
      }, function () {
        // rows 真正进入视图层后，再按 onReady 规则触发图片解析
        if (that._pageReady) that._resolvePreviewImages();
        else that._pendingResolve = true;
      });

      

      // 5. 延迟触发微缩转盘入场动画
      setTimeout(function () {
        that.setData({ isEntering: true });
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
    // 视图层使用 env 简写形式，getTempFileURL 请求用完整 fileID（带 appid 后缀）的形式更稳
    var headerFileId = 'cloud://' + ENV_ID + '/prep_cover_pic/table.jpg';
    var headerReqId = toFullFileId(headerFileId);

    var fileIds = [headerReqId];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].hasCover && typeof rows[i].coverUrl === 'string' && rows[i].coverUrl.indexOf('cloud://') === 0) {
        fileIds.push(toFullFileId(rows[i].coverUrl));
      }
    }

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

      var headerTmp = tempMap[headerFileId] || tempMap[headerReqId] || '';
      that.setData({
        headerBgUrl: headerTmp,
        previewMenuRows: newRows,
        isImageReady: true
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
      var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
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
        getApp().globalData.menuPreview.dashboard = dashboard;
        getApp().globalData.menuPreview.hasSharedBase = hasSharedBase;
        getApp().globalData.menuPreview.comboName = result.comboName || '';
        getApp().globalData.menuPreview.balanceTip = balanceTip;
      }
      that.setData(
        { previewMenuRows: newRows, previewComboName: result.comboName || '', previewBalanceTip: balanceTip, previewDashboard: dashboard, previewHasSharedBase: hasSharedBase, isImageReady: false },
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
    var pref = payload && payload.preference ? payload.preference : that._defaultPreference();
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
            coverUrl: coverService.getRecipeCoverImageUrl(adultNameNew),
            coverTempUrl: '',
            hasCover: !!coverService.RECIPE_NAME_TO_SLUG[adultNameNew]
          });
        }
      }
      if (getApp().globalData.menuPreview) {
        getApp().globalData.menuPreview.menus = newMenus;
        getApp().globalData.menuPreview.rows = newRows;
        getApp().globalData.menuPreview.dashboard = that._computePreviewDashboard(newMenus, pref);
        getApp().globalData.menuPreview.hasSharedBase = newRows.some(function (r) { return r.showSharedHint; });
        getApp().globalData.menuPreview.balanceTip = balanceTip;
      }
      that.setData({
        previewMenuRows: newRows,
        previewBalanceTip: balanceTip,
        previewDashboard: that._computePreviewDashboard(newMenus, pref),
        previewHasSharedBase: newRows.some(function (r) { return r.showSharedHint; }),
        isImageReady: false
      }, function () { if (that._pageReady) that._resolvePreviewImages(); });

      
      wx.showToast({ title: '已为您选出更均衡的搭配', icon: 'none' });
    } catch (e) {
      console.error('换掉未勾选失败:', e);
      wx.showToast({ title: '替换失败', icon: 'none' });
    }
  },

  confirmAndGo: function () {
    var payload = getApp().globalData.menuPreview;
    var menus = payload && payload.menus ? payload.menus : [];
    var pref = payload && payload.preference ? payload.preference : this._defaultPreference();
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

  _defaultPreference: function () {
    return { adultCount: 2, hasBaby: false, babyMonth: 12, meatCount: 1, vegCount: 1, soupCount: 1 };
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
    if (cats.indexOf('肉类') !== -1 || cats.indexOf('蛋类') !== -1) nutritionParts.push('蛋白质');
    if (cats.indexOf('蔬菜') !== -1) nutritionParts.push('维生素与膳食纤维');
    if (cats.indexOf('干货') !== -1) nutritionParts.push('多种营养素');
    if (cats.indexOf('其他') !== -1 && nutritionParts.length === 0) nutritionParts.push('多种营养素');
    var nutritionHint = nutritionParts.length > 0 ? '本餐营养覆盖：' + nutritionParts.join('、') : '';
    var orderParts = [];
    if (hasStew) orderParts.push('炖/煲');
    if (hasSteam) orderParts.push('蒸');
    if (hasStirFry) orderParts.push('快炒');
    var prepOrderHint = orderParts.length >= 2 ? '烹饪顺序建议：' + orderParts.join('→') : '';
    var prepAheadHint = '';
    if (maxPrep >= 10) prepAheadHint = '备菜建议：可提前约 ' + maxPrep + ' 分钟准备葱姜蒜及腌制食材，下锅更从容';
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
      sharedIngredientsHint = '本餐可共用：' + shared.join('、') + '，备菜更省';
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
