var menuData = require('../../data/menuData.js');
var recipeResources = require('../../data/recipeResources.js');
var imageLib = require('../../utils/imageLib.js');

var IMAGE_CONFIG = recipeResources.IMAGE_CONFIG;
var STORAGE_PREFIX = 'tablesync_steps_completed_';
var KEY_ACTIONS = ['下锅', '打泥', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];
var KEY_ACTIONS_RE = new RegExp('(' + KEY_ACTIONS.join('|') + ')', 'g');

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
  var parts = text.split(KEY_ACTIONS_RE);
  if (parts.length <= 1) return [{ text: text, strong: false }];
  var segments = [];
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    segments.push({ text: parts[i], strong: i % 2 === 1 });
  }
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

/** 短句序号：①～⑩，超过用 "11." "12." */
var ORDINAL_CIRCLED = '\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467\u2468\u2469'; /* ①②③④⑤⑥⑦⑧⑨⑩ */
function getOrdinalPrefix(n) {
  if (n >= 1 && n <= 10) return ORDINAL_CIRCLED[n - 1];
  return n + '.';
}

/** 短句上限，避免单行拆出过多导致卡顿 */
var MAX_PHRASES_PER_LINE = 6;

/**
 * 用正则把长句拆成短句（按。！？；换行断句；过长再按，、断句），便于逐条加序号。控制条数防卡顿。
 */
function splitIntoShortPhrases(text) {
  if (!text || typeof text !== 'string') return [];
  var trimmed = text.trim();
  if (!trimmed) return [];
  var parts = trimmed.split(/[。！？；\n]+/);
  var result = [];
  var maxClauseLen = 18;
  for (var i = 0; i < parts.length && result.length < MAX_PHRASES_PER_LINE; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    if (p.length > maxClauseLen && /[，、]/.test(p) && result.length < MAX_PHRASES_PER_LINE - 1) {
      var clauses = p.split(/[，、]+/);
      for (var j = 0; j < clauses.length && result.length < MAX_PHRASES_PER_LINE; j++) {
        var c = clauses[j].trim();
        if (c) result.push(c);
      }
    } else {
      result.push(p);
    }
  }
  return result;
}

/** 刀工：用 match 一次取第一个，避免全局正则状态 */
function extractKnifeWork(details) {
  if (!Array.isArray(details) || details.length === 0) return '';
  var full = details.join('');
  var m = full.match(/切(成)?(大?)(块|片|丁|丝|段|末)/);
  return m ? '切' + m[3] : '';
}

/** 调料：只匹配常见 12 项、最多返回 8 条，减轻 setData 与渲染 */
var SEASONING_NAMES = ['生抽', '老抽', '料酒', '蚝油', '盐', '酱油', '醋', '糖', '淀粉', '姜片', '蒜', '葱'];
var AMOUNT_RE = /(少许|适量|一点|半勺|一勺|1勺|2勺|少量)\s*$/;
function extractSeasonings(details) {
  if (!Array.isArray(details) || details.length === 0) return [];
  var full = details.join('');
  var list = [];
  for (var i = 0; i < SEASONING_NAMES.length && list.length < 8; i++) {
    var name = SEASONING_NAMES[i];
    var idx = full.indexOf(name);
    if (idx === -1) continue;
    var before = full.slice(Math.max(0, idx - 12), idx);
    var amount = AMOUNT_RE.test(before) ? before.match(AMOUNT_RE)[1] : '适量';
    list.push({ name: name, amount: menuData.formatSeasoningAmountForDisplay ? menuData.formatSeasoningAmountForDisplay(amount) : amount });
  }
  return list;
}

/**
 * 判断步骤类型：备菜 or 烹饪
 * 优先使用 step_type 字段，否则从 title 推断
 */
function getStepType(step) {
  if (step.step_type) return step.step_type;
  var title = (step.title || '').toString();
  // 通过 title 关键词判断
  if (/备菜|准备|切配|腌制/.test(title)) return 'prep';
  return 'cook';
}

function processStepsForView(steps) {
  // 入参容错：避免传入 null/undefined 时报错
  if (!Array.isArray(steps) || steps.length === 0) {
    return [];
  }

  // 预计算阶段信息：首个烹饪步骤索引、是否存在备菜/烹饪阶段
  var firstCookIndex = -1;
  var hasPrepPhase = false;
  var hasCookPhase = false;
  for (var i = 0; i < steps.length; i++) {
    var t = getStepType(steps[i]);
    if (t === 'prep') hasPrepPhase = true;
    if (t === 'cook') {
      hasCookPhase = true;
      if (firstCookIndex === -1) firstCookIndex = i;
    }
  }

  var lastId = steps[steps.length - 1].id;
  return steps.map(function (s, index) {
    var detailsWithSegments = [];
    (s.details || []).forEach(function (line) {
      var displayLine = menuData.replaceVagueSeasoningInText ? menuData.replaceVagueSeasoningInText(line) : line;
      var phrases = splitIntoShortPhrases(displayLine);
      var isBaby = isBabyPortionLine(line);
      if (phrases.length === 0) {
        detailsWithSegments.push({
          segments: highlightSegments(displayLine),
          isBabyPortion: isBaby
        });
        return;
      }
      phrases.forEach(function (phrase, idx) {
        var prefix = getOrdinalPrefix(idx + 1) + ' ';
        var fullText = prefix + phrase;
        detailsWithSegments.push({
          segments: highlightSegments(fullText),
          isBabyPortion: isBaby && idx === 0
        });
      });
    });
    var rawDetails = s.details || [];
    var stepType = getStepType(s);
    var isPrepStep = stepType === 'prep';
    var seasoningsList = extractSeasonings(rawDetails);

    // 阶段起点标记：首个备菜步骤 + 首个烹饪步骤
    var isPhaseStart = false;
    var phaseType = stepType;
    if (hasPrepPhase && stepType === 'prep' && index === 0) {
      isPhaseStart = true;
      phaseType = 'prep';
    } else if (hasCookPhase && stepType === 'cook' && index === firstCookIndex) {
      isPhaseStart = true;
      phaseType = 'cook';
    }

    return {
      id: s.id,
      title: s.title,
      stepType: stepType,          // 添加步骤类型
      recipeName: s.recipeName,    // 关联的菜品名（如果有）
      details: detailsWithSegments,
      duration: s.duration,
      completed: s.completed,
      roleTag: stepTag(s),
      isLast: lastId !== null && s.id === lastId,
      knifeWorkLabel: extractKnifeWork(rawDetails),
      seasoningsList: seasoningsList,
      showSeasoningsList: seasoningsList.length > 0 && !isPrepStep,
      // 阶段分隔相关
      isPhaseStart: isPhaseStart,
      phaseType: phaseType
    };
  });
}

Page({
  data: {
    steps: [],
    viewSteps: [],
    progressPercentage: 0,
    currentStepLabel: '第 0/0 步',
    completedCount: 0,
    totalSteps: 0,
    completionRate: 0,
    currentIndex: 0,
    showPrepPhase: false,
    showCookPhase: false,
    // 动态头图相关
    currentStepImage: '',
    currentStepTitle: '开始烹饪',
    currentStepSubtitle: '跟随步骤，轻松完成美味'
  },

  onLoad: function () {
    var that = this;
    var preference = getStepsPreference();
    var steps;
    
    // 容错：menuData.generateSteps 可能返回 null/undefined
    try {
      steps = menuData.generateSteps(preference);
    } catch (e) {
      console.error('生成步骤失败:', e);
      steps = null;
    }
    
    // 确保 steps 是数组
    if (!Array.isArray(steps)) {
      steps = [];
      console.warn('步骤数据为空或格式错误，已降级为空数组');
    }
    
    // 恢复已完成状态
    try {
      var raw = wx.getStorageSync(stepsStorageKey());
      if (raw && steps.length > 0) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(function (item) {
            var step = steps.find(function (s) { return s.id === item.id; });
            if (step && item.completed) step.completed = true;
          });
        }
      }
    } catch (e) {
      console.warn('恢复步骤状态失败:', e);
    }
    
    // 获取菜单数据，用于获取菜品图片
    that._loadMenuData();
    
    this._stepsRaw = steps;
    this._currentStepIndex = 0;
    this._updateView(steps);
    this._updateHeaderImage(steps, 0);
  },
  
  /**
   * 加载菜单数据，用于获取菜品图片
   */
  _loadMenuData: function () {
    var that = this;
    that._menuRecipes = [];
    
    try {
      // 优先从全局数据获取
      var app = getApp();
      var todayMenus = app && app.globalData ? app.globalData.todayMenus : null;
      
      // 如果全局没有，从 Storage 读取并还原
      if (!todayMenus || todayMenus.length === 0) {
        var raw = wx.getStorageSync('today_menus');
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 检查是否为精简格式
            if (menuData.isSlimMenuFormat && menuData.isSlimMenuFormat(parsed)) {
              var prefRaw = wx.getStorageSync('today_menus_preference');
              var pref = prefRaw ? JSON.parse(prefRaw) : {};
              todayMenus = menuData.deserializeMenusFromStorage(parsed, pref);
            } else {
              todayMenus = parsed;
            }
          }
        }
      }
      
      // 提取菜品名称列表
      if (Array.isArray(todayMenus)) {
        that._menuRecipes = todayMenus.map(function (m) {
          return {
            name: (m.adultRecipe && m.adultRecipe.name) || '',
            type: 'adult'
          };
        }).filter(function (r) { return r.name; });
      }
    } catch (e) {
      console.warn('加载菜单数据失败:', e);
    }
  },
  
  /**
   * 更新头图：备菜步显示全局备菜图，烹饪步显示当前菜品的 MJ 成品图
   */
  _updateHeaderImage: function (steps, stepIndex) {
    if (!Array.isArray(steps) || steps.length === 0) {
      this.setData({
        currentStepImage: IMAGE_CONFIG.defaultCover,
        currentStepTitle: '暂无步骤',
        currentStepSubtitle: '请先生成菜单'
      });
      return;
    }
    
    // 找到当前未完成的步骤，或者使用指定索引
    var currentStep = null;
    var effectiveIndex = stepIndex;
    
    if (typeof stepIndex === 'number' && stepIndex >= 0 && stepIndex < steps.length) {
      currentStep = steps[stepIndex];
    } else {
      // 找第一个未完成的步骤
      for (var i = 0; i < steps.length; i++) {
        if (!steps[i].completed) {
          currentStep = steps[i];
          effectiveIndex = i;
          break;
        }
      }
      // 如果全部完成，显示最后一步
      if (!currentStep) {
        currentStep = steps[steps.length - 1];
        effectiveIndex = steps.length - 1;
      }
    }
    
    this._currentStepIndex = effectiveIndex;
    
    var stepType = getStepType(currentStep);
    var image = '';
    var title = currentStep.title || '当前步骤';
    var subtitle = '';
    
    if (stepType === 'prep') {
      // 备菜步骤：显示全局备菜图
      image = IMAGE_CONFIG.pageCovers.prep || IMAGE_CONFIG.defaultCover;
      subtitle = '准备食材，为美味打好基础';
    } else {
      // 烹饪步骤：尝试获取当前菜品的 MJ 成品图
      var recipeName = currentStep.recipeName || '';
      
      // 如果步骤没有关联菜品名，尝试从菜单中获取
      if (!recipeName && this._menuRecipes && this._menuRecipes.length > 0) {
        // 尝试从步骤标题中提取菜品索引
        var titleMatch = (currentStep.title || '').match(/第\s*(\d+)\s*道/);
        var recipeIndex = 0;
        if (titleMatch) {
          recipeIndex = Math.min(parseInt(titleMatch[1], 10) - 1, this._menuRecipes.length - 1);
          recipeIndex = Math.max(0, recipeIndex);
        }
        recipeName = this._menuRecipes[recipeIndex] ? this._menuRecipes[recipeIndex].name : '';
      }
      
      if (recipeName) {
        image = imageLib.getRecipeImage(recipeName, 'adult');
        subtitle = recipeName;
      } else {
        image = IMAGE_CONFIG.defaultCover;
        subtitle = '美味即将完成';
      }
    }
    
    this.setData({
      currentStepImage: image,
      currentStepTitle: title,
      currentStepSubtitle: subtitle
    });
  },

  _updateView: function (steps) {
    // 入参容错：避免传入 null/undefined 时报错导致页面崩溃
    if (!Array.isArray(steps)) {
      steps = [];
    }
    var completedCount = steps.filter(function (s) { return s.completed; }).length;
    var total = steps.length;
    var progress = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    var currentLabel = total === 0 ? '暂无步骤' : '第 ' + Math.min(completedCount + 1, total) + '/' + total + ' 步';

    // 生成用于视图渲染的步骤数据（包含阶段信息）
    var viewSteps = processStepsForView(steps);
    var hasPrepPhase = false;
    var hasCookPhase = false;
    for (var i = 0; i < viewSteps.length; i++) {
      if (viewSteps[i].stepType === 'prep') hasPrepPhase = true;
      if (viewSteps[i].stepType === 'cook') hasCookPhase = true;
    }

    // 计算当前高亮步骤下标：优先第一个未完成，否则最后一个
    var currentIndex = 0;
    if (total > 0) {
      currentIndex = -1;
      for (var j = 0; j < steps.length; j++) {
        if (!steps[j].completed) {
          currentIndex = j;
          break;
        }
      }
      if (currentIndex === -1) {
        currentIndex = total - 1;
      }
    }
    this._currentStepIndex = currentIndex;

    this.setData({
      steps: viewSteps,
      viewSteps: viewSteps,
      progressPercentage: progress,
      currentStepLabel: currentLabel,
      completedCount: completedCount,
      totalSteps: total,
      completionRate: progress,
      currentIndex: currentIndex,
      showPrepPhase: hasPrepPhase,
      showCookPhase: hasCookPhase
    });
  },

  /**
   * 点击时间轴任意步骤：将其设为当前高亮，并刷新头图
   */
  onStepTap: function (e) {
    var index = e.currentTarget.dataset.index;
    if (typeof index !== 'number') {
      index = Number(index);
    }
    if (isNaN(index)) return;
    if (!Array.isArray(this._stepsRaw) || this._stepsRaw.length === 0) return;

    index = Math.max(0, Math.min(index, this._stepsRaw.length - 1));

    this.setData({
      currentIndex: index
    });
    this._currentStepIndex = index;
    this._updateHeaderImage(this._stepsRaw, index);
  },

  markCompleted: function (e) {
    var id = e.currentTarget.dataset.id;
    var steps = this._stepsRaw;
    
    // 容错：确保 steps 是有效数组
    if (!Array.isArray(steps) || steps.length === 0) {
      console.warn('markCompleted: 步骤数据无效');
      return;
    }
    
    var step = steps.find(function (s) { return s.id === id; });
    if (!step) return;
    step.completed = true;
    try {
      var payload = steps.map(function (s) { return { id: s.id, completed: s.completed }; });
      wx.setStorageSync(stepsStorageKey(), JSON.stringify(payload));
    } catch (err) {
      console.warn('保存步骤状态失败:', err);
    }
    this._updateView(steps);

    // 根据最新进度，自动滚动到当前高亮（下一未完成）步骤，并刷新头图
    var nextIndex = this._currentStepIndex;
    if (typeof nextIndex !== 'number') {
      nextIndex = Number(nextIndex);
    }
    if (!isNaN(nextIndex) && nextIndex >= 0 && nextIndex < steps.length) {
      var nextStep = steps[nextIndex];
      // 仅当存在未完成步骤时才滚动（全部完成时不滚动）
      if (nextStep && !nextStep.completed) {
        var selector = '#step-' + nextStep.id;
        try {
          wx.pageScrollTo({
            selector: selector,
            duration: 300,
            offsetTop: -200 // 留出头图区域
          });
        } catch (scrollErr) {
          console.warn('自动滚动到下一步骤失败:', scrollErr);
        }
      }
      // 无论是否存在未完成步骤，都根据当前索引更新头图
      this._updateHeaderImage(steps, nextIndex);
    } else {
      // 索引异常时降级为使用最后一步更新头图
      this._updateHeaderImage(steps, steps.length - 1);
    }

    var lastId = steps[steps.length - 1].id;
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
