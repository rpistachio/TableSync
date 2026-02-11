// pages/scan/scan.js
// 冰箱扫描页 —— 多图上传、并行识别食材、前端合并去重、展示推荐菜谱

var recipeCoverSlugs = require('../../data/recipeCoverSlugs.js');
var basket = require('../../data/inspirationBasket.js');

/** 食材分类对应的 emoji */
var CATEGORY_ICONS = {
  '蔬菜': '🥬', '肉类': '🥩', '蛋类': '🥚', '水产': '🐟',
  '豆制品': '🫘', '菌菇': '🍄', '水果': '🍎', '主食': '🍚',
  '干货': '🌰', '乳制品': '🥛'
};

/** 菜谱角色标签 */
var ROLE_LABELS = {
  'main_meat': '主荤', 'sub_meat': '副荤', 'veg': '素菜', 'soup': '汤品'
};

/** 角色对应的 class 后缀 */
var ROLE_CLASSES = {
  'main_meat': 'meat', 'sub_meat': 'meat', 'veg': 'veg', 'soup': 'soup'
};

/** 最大图片数量 */
var MAX_IMAGES = 5;

/**
 * 多份 visionResult.ingredients 合并去重
 * 同名食材只保留一条，quantity 取描述最多（最长）的那条
 */
function mergeIngredients(lists) {
  var map = {};
  lists.forEach(function (list) {
    list.forEach(function (item) {
      var key = item.name;
      if (!map[key]) {
        map[key] = item;
      } else {
        // quantity 取描述最多（最长）的那条
        if (item.quantity && item.quantity.length > (map[key].quantity || '').length) {
          map[key].quantity = item.quantity;
        }
      }
    });
  });
  return Object.values(map);
}

Page({
  data: {
    // 状态控制
    stage: 'idle',          // idle | uploading | scanning | ingredients_review | done | shopping | error
    statusText: '',         // 当前阶段的提示文字

    // 图片（多图）
    imageList: [],          // [{ path, fileID }]  最多 MAX_IMAGES 张

    // 识别结果
    ingredients: [],        // [{ name, quantity, category, icon }]
    confidence: 0,          // 置信度 0-1
    notes: '',              // 备注信息

    // 推荐结果
    recommendations: [],    // [{ id, name, role, roleLabel, roleClass, reason, missing_ingredients, cook_minutes, coverUrl }]
    mealSummary: '',        // 组餐摘要
    shoppingList: [],       // 额外需购买的食材

    // 更多匹配
    allMatched: [],         // 全量匹配菜谱（前20）
    showMoreMatched: false, // 是否展示更多匹配
    visibleMatchedCount: 8, // 分批加载：每次显示的条数

    // Part 2b: 菜谱选择
    selectedCount: 0,       // 当前已选中的菜谱数量

    // 食材编辑（Part 2a）
    showAddInput: false,    // 是否显示手动添加输入框
    newIngredientName: '',  // 手动添加的食材名称

    // Part 2c: 智能购物清单
    smartShoppingList: [],  // [{ name, fromRecipes: ['菜名1','菜名2'] }] 需额外购买
    excludedIngredients: [],// [{ name, fromRecipes: [...] }] 冰箱已有、默认排除的食材
    selectedRecipes: [],    // 用户最终选中的菜谱列表

    // 性能
    totalMs: 0              // 总耗时
  },

  onLoad: function () {
    // 页面加载时无额外初始化
  },

  // ── 拍照 / 选图（支持多选）─────────────────────────────────

  onChooseImage: function () {
    var that = this;
    if (that.data.stage === 'uploading' || that.data.stage === 'scanning') return;

    var remaining = MAX_IMAGES - that.data.imageList.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多选择 ' + MAX_IMAGES + ' 张照片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      sizeType: ['compressed'],
      success: function (res) {
        var files = res.tempFiles || [];
        var newImages = [];
        var oversized = false;

        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if (!f || !f.tempFilePath) continue;
          if (f.size && f.size > 3 * 1024 * 1024) {
            oversized = true;
            continue;
          }
          newImages.push({ path: f.tempFilePath, fileID: '' });
        }

        if (oversized) {
          wx.showToast({ title: '部分图片过大已跳过', icon: 'none' });
        }

        if (newImages.length === 0) return;

        var imageList = that.data.imageList.concat(newImages).slice(0, MAX_IMAGES);

        that.setData({
          imageList: imageList,
          // 添加新图后重置结果，保持 idle 状态
          stage: 'idle',
          statusText: '',
          ingredients: [],
          recommendations: [],
          mealSummary: '',
          shoppingList: [],
          allMatched: [],
          showMoreMatched: false,
          visibleMatchedCount: 8,
          showAddInput: false,
          newIngredientName: '',
          notes: '',
          confidence: 0,
          selectedCount: 0,
          smartShoppingList: [],
          excludedIngredients: [],
          selectedRecipes: [],
          totalMs: 0
        });
      }
    });
  },

  // ── 删除某张图片 ──────────────────────────────────────────

  onRemoveImage: function (e) {
    var idx = e.currentTarget.dataset.index;
    var imageList = this.data.imageList.slice();
    imageList.splice(idx, 1);
    this.setData({
      imageList: imageList,
      // 删除图片后重置结果
      stage: 'idle',
      statusText: '',
      ingredients: [],
      recommendations: [],
      mealSummary: '',
      shoppingList: [],
      allMatched: [],
      showMoreMatched: false,
      visibleMatchedCount: 8,
      showAddInput: false,
      newIngredientName: '',
      notes: '',
      confidence: 0,
      selectedCount: 0,
      smartShoppingList: [],
      excludedIngredients: [],
      selectedRecipes: [],
      totalMs: 0
    });
  },

  // ── 开始扫描 ──────────────────────────────────────────────

  onStartScan: function () {
    var that = this;
    if (that.data.imageList.length === 0) {
      wx.showToast({ title: '请先拍照或选择图片', icon: 'none' });
      return;
    }
    if (that.data.stage === 'uploading' || that.data.stage === 'scanning') return;

    that._doUploadAndScan();
  },

  _doUploadAndScan: function () {
    var that = this;
    var startTime = Date.now();
    var imageList = that.data.imageList;
    var imageCount = imageList.length;

    // Step 1: 并行上传所有图片到云存储
    that.setData({
      stage: 'uploading',
      statusText: '正在上传' + (imageCount > 1 ? ' ' + imageCount + ' 张图片' : '图片') + '...'
    });

    var uploadPromises = imageList.map(function (img, idx) {
      return new Promise(function (resolve, reject) {
        var cloudPath = 'fridge_scans/' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 6) + '.jpg';
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: img.path,
          success: function (uploadRes) {
            if (!uploadRes.fileID) {
              reject(new Error('上传失败'));
              return;
            }
            resolve({ index: idx, fileID: uploadRes.fileID });
          },
          fail: function (err) {
            reject(err);
          }
        });
      });
    });

    Promise.all(uploadPromises).then(function (uploadResults) {
      // 更新 imageList 中的 fileID
      var updatedList = that.data.imageList.slice();
      uploadResults.forEach(function (r) {
        updatedList[r.index] = {
          path: updatedList[r.index].path,
          fileID: r.fileID
        };
      });

      that.setData({
        imageList: updatedList,
        stage: 'scanning',
        statusText: '正在识别食材' + (imageCount > 1 ? '（' + imageCount + ' 张图片）' : '') + '...'
      });

      // Step 2: 并行调用云函数识别每张图片
      var scanPromises = uploadResults.map(function (r) {
        return new Promise(function (resolve, reject) {
          wx.cloud.callFunction({
            name: 'fridgeScan',
            data: { fileID: r.fileID },
            success: function (callRes) {
              resolve(callRes.result || {});
            },
            fail: function (err) {
              reject(err);
            }
          });
        });
      });

      return Promise.all(scanPromises);
    }).then(function (scanResults) {
      var totalMs = Date.now() - startTime;

      // 过滤出成功的结果
      var validResults = scanResults.filter(function (r) { return r.code === 200; });
      if (validResults.length === 0) {
        var errMsg = (scanResults[0] && scanResults[0].message) || '识别失败，请重试';
        that.setData({
          stage: 'error',
          statusText: errMsg,
          totalMs: totalMs
        });
        return;
      }

      // ── 合并食材（去重）────────────────────────────
      var allIngredientLists = validResults.map(function (r) {
        return (r.data || {}).ingredients || [];
      });
      var mergedRaw = mergeIngredients(allIngredientLists);
      var ingredients = mergedRaw.map(function (item) {
        return {
          name: item.name || '',
          quantity: item.quantity || '',
          category: item.category || '',
          icon: CATEGORY_ICONS[item.category] || '🥄'
        };
      });

      // ── 置信度取所有识别结果的最低值 ──────────────────
      var confidences = validResults.map(function (r) {
        return (r.data || {}).confidence || 0;
      }).filter(function (c) { return c > 0; });
      var confidence = confidences.length > 0 ? Math.min.apply(null, confidences) : 0;

      // ── notes 合并拼接（去重）─────────────────────
      var notesList = validResults.map(function (r) {
        return ((r.data || {}).notes || '').trim();
      }).filter(function (n) { return n; });
      var uniqueNotes = [];
      notesList.forEach(function (n) {
        if (uniqueNotes.indexOf(n) === -1) uniqueNotes.push(n);
      });
      var notes = uniqueNotes.join('；');

      // ── 推荐菜谱合并去重（按 id）──────────────────
      var recMap = {};
      validResults.forEach(function (r) {
        var recs = ((r.data || {}).recommendations || []);
        recs.forEach(function (rec) {
          var key = rec.id || rec.name;
          if (!recMap[key]) recMap[key] = rec;
        });
      });
      var recommendations = Object.values(recMap).map(function (rec) {
        return {
          id: rec.id || '',
          name: rec.name || '',
          role: rec.role || 'veg',
          roleLabel: ROLE_LABELS[rec.role] || '菜品',
          roleClass: ROLE_CLASSES[rec.role] || 'veg',
          reason: rec.reason || '',
          missing_ingredients: rec.missing_ingredients || [],
          cook_minutes: rec.cook_minutes || 0,
          coverUrl: recipeCoverSlugs.getRecipeCoverImageUrl(rec.name)
        };
      });

      // ── 组餐摘要取最后一个非空 ─────────────────────
      var mealSummary = '';
      for (var i = validResults.length - 1; i >= 0; i--) {
        var ms = ((validResults[i].data || {}).meal_summary || '').trim();
        if (ms) { mealSummary = ms; break; }
      }

      // ── 购物清单合并去重 ──────────────────────────
      var shopSet = {};
      validResults.forEach(function (r) {
        ((r.data || {}).shopping_list || []).forEach(function (s) {
          shopSet[s] = true;
        });
      });
      var shoppingList = Object.keys(shopSet);

      // ── 全量匹配菜谱合并去重（相同菜谱取最高分）────
      var matchMap = {};
      validResults.forEach(function (r) {
        ((r.data || {}).allMatched || []).forEach(function (m) {
          var key = m.id || m.name;
          if (!matchMap[key] || (m.score || 0) > (matchMap[key].score || 0)) {
            matchMap[key] = m;
          }
        });
      });
      var allMatched = Object.values(matchMap).map(function (m) {
        return {
          id: m.id || '',
          name: m.name || '',
          score: m.score || 0,
          scorePercent: Math.round((m.score || 0) * 100),
          matchedIngredients: m.matchedIngredients || [],
          missingIngredients: m.missingIngredients || [],
          meat: m.meat || '',
          cook_type: m.cook_type || '',
          coverUrl: recipeCoverSlugs.getRecipeCoverImageUrl(m.name)
        };
      });
      // 按 score 降序排列
      allMatched.sort(function (a, b) { return b.score - a.score; });

      // 进入食材确认/编辑阶段（Part 2a），用户确认后再展示推荐
      that.setData({
        stage: 'ingredients_review',
        statusText: '',
        ingredients: ingredients,
        confidence: confidence,
        notes: notes,
        recommendations: recommendations,
        mealSummary: mealSummary,
        shoppingList: shoppingList,
        allMatched: allMatched,
        showAddInput: false,
        newIngredientName: '',
        totalMs: totalMs
      });

      // 无食材时提示
      if (ingredients.length === 0) {
        that.setData({ statusText: '未识别到食材，可手动添加或拍摄更清晰的照片' });
      }

      // 灵感篮子：将推荐菜谱自动放入篮子
      if (recommendations.length > 0) {
        that._autoAddToBasket(recommendations, ingredients);
      }
    }).catch(function (err) {
      console.error('[scan] 扫描流程出错:', err);
      that.setData({
        stage: 'error',
        statusText: '网络异常，请检查网络后重试',
        totalMs: Date.now() - startTime
      });
    });
  },

  // ── 重新扫描 ──────────────────────────────────────────────

  onRetry: function () {
    this.setData({
      stage: 'idle',
      statusText: '',
      imageList: [],
      ingredients: [],
      recommendations: [],
      mealSummary: '',
      shoppingList: [],
      allMatched: [],
      showMoreMatched: false,
      visibleMatchedCount: 8,
      showAddInput: false,
      newIngredientName: '',
      notes: '',
      confidence: 0,
      selectedCount: 0,
      smartShoppingList: [],
      excludedIngredients: [],
      selectedRecipes: [],
      totalMs: 0
    });
  },

  // ── 食材确认/编辑（Part 2a）─────────────────────────────

  /** 删除某个食材（误识别） */
  onRemoveIngredient: function (e) {
    var idx = e.currentTarget.dataset.index;
    var ingredients = this.data.ingredients.slice();
    ingredients.splice(idx, 1);
    this.setData({ ingredients: ingredients });
  },

  /** 切换手动添加食材输入框 */
  onToggleAddInput: function () {
    this.setData({
      showAddInput: !this.data.showAddInput,
      newIngredientName: ''
    });
  },

  /** 输入食材名称 */
  onNewIngredientInput: function (e) {
    this.setData({ newIngredientName: e.detail.value });
  },

  /** 确认添加手动输入的食材 */
  onAddIngredient: function () {
    var name = (this.data.newIngredientName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' });
      return;
    }
    // 去重检查
    var exists = this.data.ingredients.some(function (item) {
      return item.name === name;
    });
    if (exists) {
      wx.showToast({ title: '该食材已存在', icon: 'none' });
      return;
    }
    var ingredients = this.data.ingredients.concat([{
      name: name,
      quantity: '',
      category: '',
      icon: '🥄',
      isManual: true
    }]);
    this.setData({
      ingredients: ingredients,
      newIngredientName: '',
      showAddInput: false
    });
  },

  /** 确认食材，进入推荐阶段（Part 2b: 菜谱选择） */
  onConfirmIngredients: function () {
    if (this.data.ingredients.length === 0) {
      wx.showToast({ title: '请至少保留一种食材', icon: 'none' });
      return;
    }

    // 推荐菜谱默认全选
    var recommendations = this.data.recommendations.map(function (rec) {
      return Object.assign({}, rec, { selected: true });
    });

    // 更多匹配：排除已在推荐列表中的菜谱，默认不选
    var recIds = {};
    recommendations.forEach(function (r) { recIds[r.id || r.name] = true; });
    var allMatched = this.data.allMatched
      .filter(function (m) { return !recIds[m.id || m.name]; })
      .map(function (m) { return Object.assign({}, m, { selected: false }); });

    this.setData({
      stage: 'done',
      recommendations: recommendations,
      allMatched: allMatched,
      selectedCount: recommendations.length
    });
  },

  // ── Part 2b: 菜谱勾选 ──────────────────────────────────────

  /** 切换推荐菜谱的选中状态 */
  onToggleRecipe: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'recommendations[' + idx + '].selected';
    var newVal = !this.data.recommendations[idx].selected;
    var data = {};
    data[key] = newVal;
    this.setData(data);
    this._updateSelectedCount();
  },

  /** 切换「更多匹配」菜谱的选中状态 */
  onToggleMatchedRecipe: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'allMatched[' + idx + '].selected';
    var newVal = !this.data.allMatched[idx].selected;
    var data = {};
    data[key] = newVal;
    this.setData(data);
    this._updateSelectedCount();
  },

  /** 重新计算已选菜谱数量 */
  _updateSelectedCount: function () {
    var count = 0;
    this.data.recommendations.forEach(function (r) { if (r.selected) count++; });
    this.data.allMatched.forEach(function (m) { if (m.selected) count++; });
    this.setData({ selectedCount: count });
  },

  /** 确认选中的菜谱（Part 2b 完成 -> 进入 Part 2c 智能购物清单） */
  onConfirmRecipes: function () {
    var that = this;
    var selectedRecipes = [];
    that.data.recommendations.forEach(function (r) {
      if (r.selected) selectedRecipes.push(r);
    });
    that.data.allMatched.forEach(function (m) {
      if (m.selected) selectedRecipes.push(m);
    });
    if (selectedRecipes.length === 0) {
      wx.showToast({ title: '请至少选择一道菜', icon: 'none' });
      return;
    }

    // 构建已有食材名称集合
    var ingredientNames = {};
    that.data.ingredients.forEach(function (ing) {
      ingredientNames[ing.name] = true;
    });

    // 合并所有选中菜谱的 missing_ingredients / missingIngredients
    // 记录每种食材来源于哪些菜谱
    var missingMap = {};   // 需额外购买
    var excludedMap = {};  // 冰箱已有，默认排除
    selectedRecipes.forEach(function (rec) {
      var missList = rec.missing_ingredients || rec.missingIngredients || [];
      missList.forEach(function (item) {
        if (ingredientNames[item]) {
          // 冰箱已有 -> 默认排除
          if (!excludedMap[item]) excludedMap[item] = { name: item, fromRecipes: [] };
          if (excludedMap[item].fromRecipes.indexOf(rec.name) === -1) {
            excludedMap[item].fromRecipes.push(rec.name);
          }
        } else {
          // 冰箱没有 -> 需购买
          if (!missingMap[item]) missingMap[item] = { name: item, fromRecipes: [] };
          if (missingMap[item].fromRecipes.indexOf(rec.name) === -1) {
            missingMap[item].fromRecipes.push(rec.name);
          }
        }
      });
    });
    var smartShoppingList = Object.values(missingMap);
    var excludedIngredients = Object.values(excludedMap);

    that.setData({
      stage: 'shopping',
      selectedRecipes: selectedRecipes,
      smartShoppingList: smartShoppingList,
      excludedIngredients: excludedIngredients,
      shoppingList: smartShoppingList.map(function (s) { return s.name; })
    });
  },

  // ── Part 2c: 智能购物清单交互 ─────────────────────────────

  /** 将已排除的食材（冰箱已有）手动加回购物清单 */
  onAddBackExcluded: function (e) {
    var idx = e.currentTarget.dataset.index;
    var excluded = this.data.excludedIngredients.slice();
    var item = excluded[idx];
    if (!item) return;
    excluded.splice(idx, 1);
    var smartShoppingList = this.data.smartShoppingList.concat([item]);
    this.setData({
      excludedIngredients: excluded,
      smartShoppingList: smartShoppingList,
      shoppingList: smartShoppingList.map(function (s) { return s.name; })
    });
  },

  /** 从购物清单中移除某项（移回已排除列表） */
  onRemoveShoppingItem: function (e) {
    var idx = e.currentTarget.dataset.index;
    var smartShoppingList = this.data.smartShoppingList.slice();
    var item = smartShoppingList[idx];
    if (!item) return;
    smartShoppingList.splice(idx, 1);
    var excludedIngredients = this.data.excludedIngredients.concat([item]);
    this.setData({
      smartShoppingList: smartShoppingList,
      excludedIngredients: excludedIngredients,
      shoppingList: smartShoppingList.map(function (s) { return s.name; })
    });
  },

  /** 返回菜谱选择阶段（Part 2b） */
  onBackToRecipes: function () {
    this.setData({ stage: 'done' });
  },

  /** 开始做饭 -> 跳转 steps 页 */
  onStartCooking: function () {
    var selectedRecipes = this.data.selectedRecipes || [];
    if (selectedRecipes.length === 0) {
      wx.showToast({ title: '请先选择菜谱', icon: 'none' });
      return;
    }
    var recipeIds = selectedRecipes.map(function (r) { return r.id || r.name; }).join(',');
    wx.navigateTo({
      url: '/pages/steps/steps?source=scan&recipeIds=' + encodeURIComponent(recipeIds)
    });
  },

  // ── 展开 / 收起更多匹配 ──────────────────────────────────

  onToggleMoreMatched: function () {
    this.setData({
      showMoreMatched: !this.data.showMoreMatched,
      visibleMatchedCount: 8  // 每次展开重置为首批数量
    });
  },

  /** 加载更多匹配菜谱（分批渲染） */
  onLoadMoreMatched: function () {
    var next = this.data.visibleMatchedCount + 8;
    this.setData({
      visibleMatchedCount: Math.min(next, this.data.allMatched.length)
    });
  },

  // ── 灵感篮子：推荐菜谱自动入篮 ─────────────────────────────

  /**
   * 将冰箱扫描推荐的菜谱自动放入灵感篮子
   * @param {Array} recommendations - 推荐菜谱列表
   * @param {Array} ingredients - 识别到的食材列表
   */
  _autoAddToBasket: function (recommendations, ingredients) {
    var raw = '';
    try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
    var list = basket.parseBasket(raw);

    var ingredientNames = (ingredients || []).map(function (i) { return i.name; });
    var addedCount = 0;

    for (var i = 0; i < recommendations.length; i++) {
      var rec = recommendations[i];
      if (!rec || !rec.id) continue;
      var item = basket.createItem(rec, 'fridge_match', {
        sourceDetail: '冰箱匹配',
        priority: 'normal',
        meta: {
          fridgeIngredients: ingredientNames
        }
      });
      var before = list.length;
      list = basket.addItem(list, item);
      if (list.length > before) addedCount++;
    }

    if (addedCount > 0) {
      try {
        wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(list));
        wx.setStorageSync(basket.BASKET_DATE_KEY, basket.getTodayDateKey());
      } catch (e) { /* ignore */ }

      var app = getApp();
      if (app && app.globalData) app.globalData.inspirationBasket = list;
      if (app.onBasketChange) app.onBasketChange(list.length);

      wx.showToast({ title: '已将 ' + addedCount + ' 道菜放入灵感篮', icon: 'none', duration: 2000 });
      try {
        var tracker = require('../../utils/tracker.js');
        var recipeIds = recommendations.slice(0, 5).map(function (r) { return r.id; }).filter(Boolean);
        tracker.trackEvent('basket_add', { source: 'fridge_match', count: addedCount, recipe_ids: recipeIds });
      } catch (e2) { /* ignore */ }
    }
  },

  // ── 返回首页 ──────────────────────────────────────────────

  onGoHome: function () {
    wx.navigateBack({ delta: 1 });
  }
});
