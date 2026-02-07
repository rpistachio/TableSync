// pages/import/import.js
// 外部菜谱导入页 —— 截图上传 + AI 结构化提取 + 预览确认

/** 烹饪方式中文映射 */
var COOK_TYPE_LABELS = {
  'stir_fry': '炒/煎',
  'stew': '炖煮',
  'steam': '蒸/白灼',
  'cold_dress': '凉拌'
};

/** 主料类型中文映射 */
var MEAT_LABELS = {
  'chicken': '鸡肉',
  'pork': '猪肉',
  'beef': '牛肉',
  'fish': '鱼类',
  'shrimp': '虾类',
  'vegetable': '素菜'
};

/** 风味中文映射 */
var FLAVOR_LABELS = {
  'spicy': '香辣',
  'salty_umami': '咸鲜',
  'light': '清淡',
  'sweet_sour': '酸甜',
  'sour_fresh': '酸爽'
};

/** 食材分类 emoji */
var CATEGORY_ICONS = {
  '蔬菜': '🥬', '肉类': '🥩', '蛋类': '🥚', '海鲜': '🐟', '水产': '🐟',
  '豆制品': '🫘', '菌菇': '🍄', '水果': '🍎', '主食': '🍚',
  '干货': '🌰', '乳制品': '🥛', '调料': '🧂', '其他': '🥄'
};

/** 最大截图数量 */
var MAX_IMAGES = 5;

/** 链接检测正则 */
var LINK_PATTERNS = [
  /https?:\/\/(?:www\.)?xhslink\.com\/[^\s]+/i,
  /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/[^\s]+/i,
  /https?:\/\/v\.douyin\.com\/[^\s]+/i,
  /https?:\/\/(?:www\.)?douyin\.com\/video\/[^\s]+/i
];

/** 检测文本中的小红书/抖音链接 */
function detectLink(text) {
  if (!text || typeof text !== 'string') return null;
  for (var i = 0; i < LINK_PATTERNS.length; i++) {
    var match = text.match(LINK_PATTERNS[i]);
    if (match) return match[0];
  }
  return null;
}

/** 判断链接属于哪个平台 */
function detectPlatform(url) {
  if (!url) return '';
  if (/xhslink\.com|xiaohongshu\.com/i.test(url)) return '小红书';
  if (/douyin\.com/i.test(url)) return '抖音';
  return '未知';
}

// ── 本地缓存管理 ────────────────────────────────────────────────

var CACHE_KEY = 'imported_recipes_cache';
var MAX_CACHE_SIZE = 20;

/**
 * 保存菜谱到本地缓存
 * - 按 id 去重（如有同名也去重）
 * - 最新的排最前
 * - 最多保留 MAX_CACHE_SIZE 条
 * @param {Object} recipe
 * @returns {boolean} 是否保存成功
 */
function saveToLocalCache(recipe) {
  if (!recipe || !recipe.name) return false;
  try {
    var list = getLocalCacheList();
    // 按 id 和名称双重去重
    list = list.filter(function (r) {
      return r.id !== recipe.id && r.name !== recipe.name;
    });
    list.unshift(recipe);
    if (list.length > MAX_CACHE_SIZE) list = list.slice(0, MAX_CACHE_SIZE);
    wx.setStorageSync(CACHE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('[import] saveToLocalCache 失败:', e);
    return false;
  }
}

/**
 * 获取本地缓存的导入菜谱列表
 * @returns {Array}
 */
function getLocalCacheList() {
  try {
    var raw = wx.getStorageSync(CACHE_KEY);
    if (!raw) return [];
    var list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * 从本地缓存中删除某个菜谱
 * @param {string} recipeId
 */
function removeFromLocalCache(recipeId) {
  try {
    var list = getLocalCacheList();
    list = list.filter(function (r) { return r.id !== recipeId; });
    wx.setStorageSync(CACHE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[import] removeFromLocalCache 失败:', e);
  }
}

Page({
  data: {
    // 状态机
    stage: 'idle',          // idle | uploading | extracting | preview | error
    statusText: '',

    // 输入模式
    inputMode: 'image',     // 'image' | 'link'

    // 截图
    imageList: [],          // [{ path, fileID }]

    // 链接
    linkUrl: '',            // 粘贴的链接
    linkPlatform: '',       // 检测到的平台名称

    // 提取结果（标准化后的菜谱）
    recipe: null,           // 标准化后的完整菜谱对象
    confidence: 0,          // AI 置信度

    // 预览用字段（从 recipe 派生）
    recipeName: '',
    cookTypeLabel: '',
    meatLabel: '',
    flavorLabel: '',
    prepTimeText: '',
    cookTimeText: '',
    sourceAuthor: '',
    ingredientList: [],     // [{ name, amount, icon, category }]
    stepList: [],           // [{ action, actionLabel, text, duration }]

    // 编辑模式
    isEditing: false,       // 是否处于编辑模式
    editingIngredients: [], // 编辑中的食材列表
    editingSteps: [],       // 编辑中的步骤列表

    // 性能
    totalMs: 0
  },

  onLoad: function () {
    // 页面加载时检查剪贴板
    this._checkClipboard();
  },

  onShow: function () {
    // 每次页面可见时检查剪贴板（用户可能从其他 App 复制了链接）
    if (this.data.stage === 'idle' && !this._clipboardCheckedThisSession) {
      this._checkClipboard();
    }
  },

  // ── 选择截图 ────────────────────────────────────────────────

  onChooseImage: function () {
    var that = this;
    if (that.data.stage === 'uploading' || that.data.stage === 'extracting') return;

    var remaining = MAX_IMAGES - that.data.imageList.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多选择 ' + MAX_IMAGES + ' 张截图', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
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
          stage: 'idle',
          statusText: '',
          recipe: null,
          confidence: 0,
          totalMs: 0
        });
      }
    });
  },

  // ── 删除截图 ────────────────────────────────────────────────

  onRemoveImage: function (e) {
    var idx = e.currentTarget.dataset.index;
    var imageList = this.data.imageList.slice();
    imageList.splice(idx, 1);
    this.setData({
      imageList: imageList,
      stage: 'idle',
      statusText: '',
      recipe: null,
      confidence: 0,
      totalMs: 0
    });
  },

  // ── 输入模式切换 ──────────────────────────────────────────────

  onSwitchToImage: function () {
    if (this.data.stage !== 'idle') return;
    this.setData({ inputMode: 'image' });
  },

  onSwitchToLink: function () {
    if (this.data.stage !== 'idle') return;
    this.setData({ inputMode: 'link' });
  },

  // ── 链接输入 ──────────────────────────────────────────────────

  onLinkInput: function (e) {
    var url = (e.detail.value || '').trim();
    var link = detectLink(url);
    this.setData({
      linkUrl: url,
      linkPlatform: link ? detectPlatform(link) : ''
    });
  },

  onPasteLink: function () {
    var that = this;
    wx.getClipboardData({
      success: function (res) {
        var text = (res.data || '').trim();
        var link = detectLink(text);
        if (link) {
          that.setData({
            linkUrl: link,
            linkPlatform: detectPlatform(link)
          });
        } else if (text) {
          that.setData({ linkUrl: text, linkPlatform: '' });
          wx.showToast({ title: '未检测到有效链接', icon: 'none' });
        }
      }
    });
  },

  onClearLink: function () {
    this.setData({ linkUrl: '', linkPlatform: '' });
  },

  onStartLinkExtract: function () {
    var that = this;
    var url = that.data.linkUrl.trim();
    var link = detectLink(url);
    if (!link) {
      wx.showToast({ title: '请粘贴小红书或抖音链接', icon: 'none' });
      return;
    }
    if (that.data.stage === 'uploading' || that.data.stage === 'extracting') return;

    that._doLinkExtract(link);
  },

  _doLinkExtract: function (url) {
    var that = this;
    var startTime = Date.now();

    that.setData({
      stage: 'extracting',
      statusText: '正在抓取链接内容...'
    });

    wx.cloud.callFunction({
      name: 'recipeImport',
      data: { mode: 'link', url: url },
      success: function (callRes) {
        var result = callRes.result || {};
        var totalMs = Date.now() - startTime;

        if (result.code !== 200) {
          that.setData({
            stage: 'error',
            statusText: result.message || '链接解析失败，请尝试截图方式',
            totalMs: totalMs
          });
          return;
        }

        var recipe = result.data && result.data.recipe;
        var confidence = result.data && result.data.confidence || 0;

        if (!recipe || !recipe.name) {
          that.setData({
            stage: 'error',
            statusText: '未能从链接中识别出菜谱，请尝试截图方式',
            totalMs: totalMs
          });
          return;
        }

        that._setPreviewData(recipe, confidence, totalMs);
      },
      fail: function (err) {
        console.error('[import] 链接导入出错:', err);
        that.setData({
          stage: 'error',
          statusText: '网络异常，请检查网络后重试',
          totalMs: Date.now() - startTime
        });
      }
    });
  },

  // ── 剪贴板自动检测 ─────────────────────────────────────────────

  _checkClipboard: function () {
    var that = this;
    that._clipboardCheckedThisSession = true;

    wx.getClipboardData({
      success: function (res) {
        var text = (res.data || '').trim();
        var link = detectLink(text);
        if (!link) return;

        var platform = detectPlatform(link);
        wx.showModal({
          title: '检测到' + platform + '链接',
          content: '剪贴板中包含' + platform + '链接，是否导入该菜谱？',
          confirmText: '立即导入',
          cancelText: '稍后再说',
          success: function (modalRes) {
            if (modalRes.confirm) {
              that.setData({
                inputMode: 'link',
                linkUrl: link,
                linkPlatform: platform
              });
              // 自动开始解析
              that._doLinkExtract(link);
            }
          }
        });
      }
    });
  },

  // ── 开始识别 ────────────────────────────────────────────────

  onStartExtract: function () {
    var that = this;
    if (that.data.imageList.length === 0) {
      wx.showToast({ title: '请先选择菜谱截图', icon: 'none' });
      return;
    }
    if (that.data.stage === 'uploading' || that.data.stage === 'extracting') return;

    that._doUploadAndExtract();
  },

  _doUploadAndExtract: function () {
    var that = this;
    var startTime = Date.now();
    var imageList = that.data.imageList;
    var imageCount = imageList.length;

    // Step 1: 上传截图到云存储
    that.setData({
      stage: 'uploading',
      statusText: '正在上传' + (imageCount > 1 ? ' ' + imageCount + ' 张截图' : '截图') + '...'
    });

    var uploadPromises = imageList.map(function (img, idx) {
      return new Promise(function (resolve, reject) {
        var cloudPath = 'recipe_imports/' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 6) + '.jpg';
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

      var fileIDs = uploadResults.map(function (r) { return r.fileID; });

      that.setData({
        imageList: updatedList,
        stage: 'extracting',
        statusText: 'AI 正在识别菜谱...'
      });

      // Step 2: 调用云函数提取菜谱
      return new Promise(function (resolve, reject) {
        wx.cloud.callFunction({
          name: 'recipeImport',
          data: { mode: 'image', fileIDs: fileIDs },
          success: function (callRes) {
            resolve(callRes.result || {});
          },
          fail: function (err) {
            reject(err);
          }
        });
      });
    }).then(function (result) {
      var totalMs = Date.now() - startTime;

      if (result.code !== 200) {
        that.setData({
          stage: 'error',
          statusText: result.message || '菜谱识别失败，请重试',
          totalMs: totalMs
        });
        return;
      }

      var recipe = result.data && result.data.recipe;
      var confidence = result.data && result.data.confidence || 0;

      if (!recipe || !recipe.name) {
        that.setData({
          stage: 'error',
          statusText: '未能从截图中识别出菜谱，请确保截图包含完整的菜谱内容',
          totalMs: totalMs
        });
        return;
      }

      that._setPreviewData(recipe, confidence, totalMs);
    }).catch(function (err) {
      console.error('[import] 导入流程出错:', err);
      that.setData({
        stage: 'error',
        statusText: '网络异常，请检查网络后重试',
        totalMs: Date.now() - startTime
      });
    });
  },

  // ── 设置预览数据（截图/链接共用）─────────────────────────────────

  _setPreviewData: function (recipe, confidence, totalMs) {
    var ingredientList = (recipe.ingredients || []).map(function (ing) {
      return {
        name: ing.name,
        amount: ing.baseAmount > 0 ? (ing.baseAmount + (ing.unit || '')) : (ing.unit || '适量'),
        icon: CATEGORY_ICONS[ing.category] || '🥄',
        category: ing.category
      };
    });

    var stepList = (recipe.steps || []).map(function (step, idx) {
      return {
        index: idx + 1,
        action: step.action,
        actionLabel: step.action === 'prep' ? '备菜' : '烹饪',
        text: step.text,
        duration: step.duration_num ? (step.duration_num + '分钟') : ''
      };
    });

    this.setData({
      stage: 'preview',
      statusText: '',
      recipe: recipe,
      confidence: confidence,
      recipeName: recipe.name,
      cookTypeLabel: COOK_TYPE_LABELS[recipe.cook_type] || recipe.cook_type || '未知',
      meatLabel: MEAT_LABELS[recipe.meat] || recipe.meat || '未知',
      flavorLabel: FLAVOR_LABELS[recipe.flavor_profile] || recipe.flavor_profile || '咸鲜',
      prepTimeText: recipe.prep_time ? (recipe.prep_time + '分钟') : '',
      cookTimeText: recipe.cook_minutes ? (recipe.cook_minutes + '分钟') : '',
      sourceAuthor: recipe.sourceAuthor || '',
      ingredientList: ingredientList,
      stepList: stepList,
      isEditing: false,
      editingIngredients: [],
      editingSteps: [],
      totalMs: totalMs
    });
  },

  // ── 重新开始 ────────────────────────────────────────────────

  onRetry: function () {
    this.setData({
      stage: 'idle',
      statusText: '',
      imageList: [],
      linkUrl: '',
      linkPlatform: '',
      recipe: null,
      confidence: 0,
      recipeName: '',
      cookTypeLabel: '',
      meatLabel: '',
      flavorLabel: '',
      prepTimeText: '',
      cookTimeText: '',
      sourceAuthor: '',
      ingredientList: [],
      stepList: [],
      isEditing: false,
      editingIngredients: [],
      editingSteps: [],
      totalMs: 0
    });
  },

  // ── 直接开始做 ──────────────────────────────────────────────

  onStartCooking: function () {
    var recipe = this.data.recipe;
    if (!recipe) {
      wx.showToast({ title: '请先导入菜谱', icon: 'none' });
      return;
    }

    // 将菜谱存储到全局数据，然后跳转到步骤页
    try {
      getApp().globalData.importedRecipe = recipe;
      wx.setStorageSync('imported_recipe', JSON.stringify(recipe));

      // 同时保存到本地缓存（方便历史查看）
      saveToLocalCache(recipe);

      // 跳转 steps 页面（source=import 模式）
      wx.navigateTo({
        url: '/pages/steps/steps?source=import&recipeName=' + encodeURIComponent(recipe.name)
      });
    } catch (err) {
      wx.showToast({ title: '跳转失败: ' + err.message, icon: 'none' });
    }
  },

  // ── 保存到我的菜谱 ──────────────────────────────────────────

  onSaveRecipe: function () {
    var that = this;
    var recipe = that.data.recipe;
    if (!recipe) return;

    wx.showLoading({ title: '保存中...' });

    // 确保有必要的元数据字段
    if (!recipe.source) recipe.source = 'external';
    if (!recipe.importedAt) recipe.importedAt = Date.now();
    if (!recipe.isVerified) recipe.isVerified = false;

    // Step 1: 保存到本地缓存
    var savedToLocal = false;
    try {
      savedToLocal = saveToLocalCache(recipe);
    } catch (e) {
      console.warn('[import] 本地缓存保存失败:', e);
    }

    // Step 2: 保存到云数据库
    try {
      var db = wx.cloud.database();
      // 先按 ID 检查是否已存在（避免重复保存）
      var recipeId = recipe.id || ('ext-' + recipe.importedAt);
      recipe.id = recipeId;

      db.collection('imported_recipes').where({
        id: recipeId
      }).get({
        success: function (queryRes) {
          if (queryRes.data && queryRes.data.length > 0) {
            // 已存在，更新
            var docId = queryRes.data[0]._id;
            var updateData = {};
            for (var k in recipe) {
              if (k !== '_id' && k !== '_openid' && Object.prototype.hasOwnProperty.call(recipe, k)) {
                updateData[k] = recipe[k];
              }
            }
            updateData.updatedAt = Date.now();
            db.collection('imported_recipes').doc(docId).update({
              data: updateData,
              success: function () {
                wx.hideLoading();
                wx.showToast({ title: '已更新到我的菜谱', icon: 'success' });
                if (!recipe.coverUrl) {
                  wx.cloud.callFunction({ name: 'recipeCoverGen', data: { docId: docId } }).catch(function () {});
                }
              },
              fail: function (err) {
                console.warn('[import] 云数据库更新失败:', err);
                wx.hideLoading();
                wx.showToast({ title: savedToLocal ? '已保存到本地' : '保存失败', icon: savedToLocal ? 'success' : 'none' });
              }
            });
          } else {
            // 不存在，新增
            var addData = {};
            for (var j in recipe) {
              if (j !== '_id' && j !== '_openid' && Object.prototype.hasOwnProperty.call(recipe, j)) {
                addData[j] = recipe[j];
              }
            }
            addData.createdAt = Date.now();
            db.collection('imported_recipes').add({
              data: addData,
              success: function (addRes) {
                wx.hideLoading();
                wx.showToast({ title: '已保存到我的菜谱', icon: 'success' });
                if (!recipe.coverUrl && addRes._id) {
                  wx.cloud.callFunction({ name: 'recipeCoverGen', data: { docId: addRes._id } }).catch(function () {});
                }
              },
              fail: function (err) {
                console.warn('[import] 云数据库保存失败:', err);
                wx.hideLoading();
                wx.showToast({ title: savedToLocal ? '已保存到本地' : '保存失败', icon: savedToLocal ? 'success' : 'none' });
              }
            });
          }
        },
        fail: function (err) {
          console.warn('[import] 云数据库查询失败:', err);
          // 尝试直接 add
          db.collection('imported_recipes').add({
            data: recipe,
            success: function (addRes) {
              wx.hideLoading();
              wx.showToast({ title: '已保存到我的菜谱', icon: 'success' });
              if (!recipe.coverUrl && addRes._id) {
                wx.cloud.callFunction({ name: 'recipeCoverGen', data: { docId: addRes._id } }).catch(function () {});
              }
            },
            fail: function () {
              wx.hideLoading();
              wx.showToast({ title: savedToLocal ? '已保存到本地' : '保存失败', icon: savedToLocal ? 'success' : 'none' });
            }
          });
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: savedToLocal ? '已保存到本地' : '保存失败', icon: savedToLocal ? 'success' : 'none' });
    }
  },

  // ── 编辑模式 ────────────────────────────────────────────────

  onToggleEdit: function () {
    var that = this;
    if (that.data.isEditing) {
      // 退出编辑模式：将编辑结果同步回 recipe
      that._applyEdits();
    } else {
      // 进入编辑模式：初始化编辑数据
      that._enterEditMode();
    }
  },

  _enterEditMode: function () {
    var recipe = this.data.recipe;
    if (!recipe) return;

    var editingIngredients = (recipe.ingredients || []).map(function (ing, idx) {
      return {
        index: idx,
        name: ing.name || '',
        baseAmount: ing.baseAmount || 0,
        unit: ing.unit || '适量',
        category: ing.category || '其他',
        icon: CATEGORY_ICONS[ing.category] || '🥄'
      };
    });

    var editingSteps = (recipe.steps || []).map(function (step, idx) {
      return {
        index: idx,
        action: step.action || 'cook',
        actionLabel: step.action === 'prep' ? '备菜' : '烹饪',
        text: step.text || '',
        duration_num: step.duration_num || 0
      };
    });

    this.setData({
      isEditing: true,
      editingIngredients: editingIngredients,
      editingSteps: editingSteps
    });
  },

  _applyEdits: function () {
    var that = this;
    var recipe = that.data.recipe;
    if (!recipe) return;

    // 同步食材编辑
    var newIngredients = that.data.editingIngredients.map(function (ing) {
      return {
        name: ing.name,
        baseAmount: parseFloat(ing.baseAmount) || 0,
        unit: ing.unit || '适量',
        category: ing.category || '其他'
      };
    }).filter(function (ing) { return ing.name; }); // 过滤空名食材

    // 同步步骤编辑
    var newSteps = that.data.editingSteps.map(function (step) {
      return {
        action: step.action,
        text: step.text,
        duration_num: parseInt(step.duration_num, 10) || 0
      };
    }).filter(function (step) { return step.text; }); // 过滤空步骤

    // 重新计算时间
    var prepTime = 0;
    var cookMinutes = 0;
    newSteps.forEach(function (s) {
      if (s.action === 'prep') prepTime += s.duration_num;
      else cookMinutes += s.duration_num;
    });

    recipe.ingredients = newIngredients;
    recipe.steps = newSteps;
    recipe.prep_time = prepTime || recipe.prep_time;
    recipe.cook_minutes = cookMinutes || recipe.cook_minutes;
    recipe.isVerified = true; // 用户编辑过，标记为已确认

    // 重新设置预览数据
    that._setPreviewData(recipe, that.data.confidence, that.data.totalMs);
  },

  // ── 食材编辑 ──────────────────────────────────────────────

  onIngredientNameInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'editingIngredients[' + idx + '].name';
    this.setData({ [key]: e.detail.value });
  },

  onIngredientAmountInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'editingIngredients[' + idx + '].baseAmount';
    this.setData({ [key]: e.detail.value });
  },

  onIngredientUnitInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'editingIngredients[' + idx + '].unit';
    this.setData({ [key]: e.detail.value });
  },

  onRemoveIngredient: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.editingIngredients.slice();
    list.splice(idx, 1);
    // 重新编号
    list.forEach(function (item, i) { item.index = i; });
    this.setData({ editingIngredients: list });
  },

  onAddIngredient: function () {
    var list = this.data.editingIngredients.slice();
    list.push({
      index: list.length,
      name: '',
      baseAmount: 0,
      unit: '适量',
      category: '其他',
      icon: '🥄'
    });
    this.setData({ editingIngredients: list });
  },

  // ── 步骤编辑 ──────────────────────────────────────────────

  onStepTextInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'editingSteps[' + idx + '].text';
    this.setData({ [key]: e.detail.value });
  },

  onStepDurationInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'editingSteps[' + idx + '].duration_num';
    this.setData({ [key]: e.detail.value });
  },

  onToggleStepAction: function (e) {
    var idx = e.currentTarget.dataset.index;
    var step = this.data.editingSteps[idx];
    var newAction = step.action === 'prep' ? 'cook' : 'prep';
    this.setData({
      ['editingSteps[' + idx + '].action']: newAction,
      ['editingSteps[' + idx + '].actionLabel']: newAction === 'prep' ? '备菜' : '烹饪'
    });
  },

  onRemoveStep: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.editingSteps.slice();
    list.splice(idx, 1);
    list.forEach(function (item, i) { item.index = i; });
    this.setData({ editingSteps: list });
  },

  onAddStep: function () {
    var list = this.data.editingSteps.slice();
    list.push({
      index: list.length,
      action: 'cook',
      actionLabel: '烹饪',
      text: '',
      duration_num: 0
    });
    this.setData({ editingSteps: list });
  },

  onMoveStepUp: function (e) {
    var idx = e.currentTarget.dataset.index;
    if (idx <= 0) return;
    var list = this.data.editingSteps.slice();
    var temp = list[idx];
    list[idx] = list[idx - 1];
    list[idx - 1] = temp;
    list.forEach(function (item, i) { item.index = i; });
    this.setData({ editingSteps: list });
  },

  onMoveStepDown: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.editingSteps.slice();
    if (idx >= list.length - 1) return;
    var temp = list[idx];
    list[idx] = list[idx + 1];
    list[idx + 1] = temp;
    list.forEach(function (item, i) { item.index = i; });
    this.setData({ editingSteps: list });
  },

  // ── 返回首页 ────────────────────────────────────────────────

  onGoHome: function () {
    wx.navigateBack({ delta: 1 });
  }
});
