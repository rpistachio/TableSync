var menuData = require('../../data/menuData.js');
var recipeResources = require('../../data/recipeResources.js');
var imageLib = require('../../utils/imageLib.js');

var IMAGE_CONFIG = recipeResources.IMAGE_CONFIG;
var STORAGE_PREFIX = 'tablesync_steps_completed_';
// 「切配」须在「切」前，避免全局备菜结尾「并切配。」被拆成「切」「配」单独成行
var KEY_ACTIONS = ['下锅', '打泥', '切配', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];
var KEY_ACTIONS_RE = new RegExp('(' + KEY_ACTIONS.join('|') + ')', 'g');
// 购物清单勾选状态存储 Key（与 shopping.js 保持一致）
var STORAGE_KEY_TODAY_SHOPPING = 'tablesync_shopping_checked_today';

function getStepsPreference() {
  var app = getApp();
  var p = app.globalData.preference || {};
  var out = {
    adultTaste: p.adultTaste != null ? p.adultTaste : p.taste,
    babyTaste: p.babyTaste,
    meat: p.meat || 'chicken',
    adultCount: Number(p.adultCount) || 2,
    babyMonth: Number(p.babyMonth) || 6,
    hasBaby: p.hasBaby === '1' || p.hasBaby === true
  };
  if (p.who) out.who = p.who;
  if (p.forceLinear === true) out.forceLinear = true;
  return out;
}

function stepsStorageKey() {
  var q = getStepsPreference();
  return STORAGE_PREFIX + (q.adultTaste || q.taste) + '_' + (q.babyTaste || '') + '_' + q.meat + '_' + q.babyMonth + '_' + q.adultCount + '_' + q.hasBaby;
}

function highlightSegments(text) {
  if (!text || typeof text !== 'string') return [{ text: String(text), strong: false }];
  return [{ text: text, strong: false }];
}

/**
 * 将 segments 数组转为 HTML 字符串，用于 <rich-text> 组件渲染。
 * 优点：避免嵌套 <text> 在部分机型上导致的 "每个 text 自成一行" 问题。
 * @param {Array} segments - highlightSegments 返回的 [{text, strong}]
 * @returns {string} 带内联样式的 HTML 字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/\x3c/g, '&lt;').replace(/\x3e/g, '&gt;');
}

function segmentsToRichText(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  var parts = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var escaped = escapeHtml(seg.text || '');
    if (seg.strong) {
      parts.push('\x3cspan style="font-weight:600;color:#333;"\x3e' + escaped + '\x3c/span\x3e');
    } else {
      parts.push('\x3cspan style="color:#666;"\x3e' + escaped + '\x3c/span\x3e');
    }
  }
  return parts.join('');
}

function stepTag(step) {
  // 先根据 step 自身信息推断角色标签
  var tag = '';
  if (step.role === 'baby') tag = '宝宝餐';
  else if (step.role === 'adult') tag = '成人餐';
  else if (step.role === 'both') tag = '成人+宝宝';
  else {
    var t = (step.title || '').toString();
    if (/宝宝|辅食/.test(t)) tag = '宝宝餐';
    else if (/成人|主菜/.test(t)) tag = '成人餐';
    else if (/联合|并行|分锅|收尾/.test(t)) tag = '成人+宝宝';
  }

  // 若用户当前没有勾选「有宝宝同行」，则不展示任何包含“宝宝”的角色标记，
  // 避免在仅成人用餐场景下出现“成人+宝宝”等字样，影响体验。
  try {
    var pref = getStepsPreference();
    if (!pref.hasBaby && /宝宝/.test(tag)) {
      return '';
    }
  } catch (e) {
    // 容错：偏好获取失败时，回退为原有行为
  }

  return tag;
}

function isBabyPortionLine(line) {
  if (!line || typeof line !== 'string') return false;
  return /宝宝/.test(line) && /分拨|分出/.test(line);
}

/** 短句序号：统一使用 "1." "2." "3." 格式 */
function getOrdinalPrefix(n) {
  return n + '.';
}

/** 短句上限，避免单行拆出过多导致卡顿 */
var MAX_PHRASES_PER_LINE = 6;

/**
 * 把长句拆成短句（按。！？；换行断句；子句长度>25时再按中文逗号，细分；不在“、”处分句）。
 * 性能优化：使用单次扫描与早停，避免 split 产生大量临时数组。
 */
function splitIntoShortPhrases(text) {
  if (!text || typeof text !== 'string') return [];
  var trimmed = text.trim();
  if (!trimmed) return [];

  var result = [];
  var threshold = 25;

  function pushMaybeSplit(p) {
    if (result.length >= MAX_PHRASES_PER_LINE) return;
    if (!p) return;
    var s = p.trim();
    if (!s) return;

    // 仅当过长时允许按中文逗号细分（不按“、”）
    if (s.length > threshold && s.indexOf('，') !== -1 && result.length < MAX_PHRASES_PER_LINE) {
      var start = 0;
      for (var k = 0; k <= s.length && result.length < MAX_PHRASES_PER_LINE; k++) {
        var ch = k < s.length ? s.charAt(k) : ''; // 末尾强制 flush
        if (ch === '，' || k === s.length) {
          var piece = s.slice(start, k).trim();
          if (piece) result.push(piece);
          start = k + 1;
        }
      }
      return;
    }

    result.push(s);
  }

  // 单次扫描：仅在强标点/换行处断句
  var segStart = 0;
  for (var i = 0; i <= trimmed.length && result.length < MAX_PHRASES_PER_LINE; i++) {
    var c = i < trimmed.length ? trimmed.charAt(i) : ''; // 末尾 flush
    var isHardSep = c === '。' || c === '！' || c === '？' || c === '；' || c === '\n' || c === '\r';
    if (isHardSep || i === trimmed.length) {
      var seg = trimmed.slice(segStart, i);
      pushMaybeSplit(seg);
      // 跳过连续分隔符
      segStart = i + 1;
      while (segStart < trimmed.length) {
        var n = trimmed.charAt(segStart);
        if (n === '。' || n === '！' || n === '？' || n === '；' || n === '\n' || n === '\r') segStart++;
        else break;
      }
      i = segStart - 1;
    }
  }

  return result;
}

/**
 * 合并短句：长度 < minLen 的短句优先并入上一句（同一原始行内）
 * - 若没有上一句则保留
 * - 合并时尽量补一个中文逗号，保证可读性
 */
function mergeShortPhrases(phrases, minLen) {
  if (!Array.isArray(phrases) || phrases.length === 0) return [];
  var threshold = typeof minLen === 'number' ? minLen : 5;
  var out = [];
  for (var i = 0; i < phrases.length; i++) {
    var p = (phrases[i] || '').toString().trim();
    if (!p) continue;
    if (p.length < threshold && out.length > 0) {
      var prev = out[out.length - 1];
      var needComma = prev && !/[，、；。！？]$/.test(prev) && !/^[，、；。！？]/.test(p);
      out[out.length - 1] = prev + (needComma ? '，' : '') + p;
    } else {
      out.push(p);
    }
  }
  return out;
}

/** 
 * 判断文本是否为孤立的动作词（仅包含一个 KEY_ACTIONS 中的动词，无其他内容）
 */
function isIsolatedActionVerb(text) {
  if (!text || typeof text !== 'string') return false;
  var trimmed = text.trim();
  for (var i = 0; i < KEY_ACTIONS.length; i++) {
    if (trimmed === KEY_ACTIONS[i]) return true;
  }
  return false;
}

/**
 * details 级归一化：将纯动作词行与下一行合并为「动词：内容」
 * 避免「蒸」「切」「炖」等动词单独成行导致的怪异视觉
 * @param {Array} details - 原始 details 数组
 * @returns {Array} 归一化后的 details 数组
 */
function normalizeDetailsForDisplay(details) {
  if (!Array.isArray(details) || details.length === 0) return [];
  var out = [];
  for (var i = 0; i < details.length; i++) {
    var line = (details[i] || '').toString().trim();
    if (!line) continue;
    // 检查是否为孤立动作词
    if (isIsolatedActionVerb(line) && i + 1 < details.length) {
      var nextLine = (details[i + 1] || '').toString().trim();
      if (nextLine) {
        // 合并为「动词：内容」
        out.push(line + '：' + nextLine);
        i++; // 跳过下一行
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * phrases 级归一化（兜底）：同一 detail 行断句后，若某短句恰好是动作词且后面还有短句，
 * 则合并为「动词：后一句」，避免行首动作词导致的孤立显示
 * @param {Array} phrases - 断句后的短句数组
 * @returns {Array} 归一化后的短句数组
 */
function mergeIsolatedVerbPhrases(phrases) {
  if (!Array.isArray(phrases) || phrases.length === 0) return [];
  var out = [];
  for (var i = 0; i < phrases.length; i++) {
    var p = (phrases[i] || '').toString().trim();
    if (!p) continue;
    // 检查是否为孤立动作词且后面还有短句
    if (isIsolatedActionVerb(p) && i + 1 < phrases.length) {
      var nextPhrase = (phrases[i + 1] || '').toString().trim();
      if (nextPhrase) {
        out.push(p + '：' + nextPhrase);
        i++; // 跳过下一个短句
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * 文案清洗（模板级，尽量保守）：
 * - 动词强绑定：如「蒜、豆豉、剁碎」→「蒜、豆豉剁碎」（避免名词与动词拆开显示）
 * - 调腌料重写：如「与生抽、淀粉、半勺油调成腌料」→「调腌料：生抽、淀粉、油(1/2勺)」
 * - 处理动作提示：如「排骨斩小块洗净沥水」→「处理排骨：斩小块，洗净，沥水」
 */
function simplifyText(line) {
  if (!line || typeof line !== 'string') return line;
  var s = line.trim();
  if (!s) return s;
  // 去掉步骤文案中的 emoji，避免界面出现表情符号
  s = s.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  if (!s) return s;

  function normalizeAmountItem(item) {
    var t = (item || '').toString().trim();
    if (!t) return '';
    // 量词前置：半勺油 / 一勺糖 → 油(1/2勺) / 糖(1勺)
    var m = t.match(/^(半勺|一勺|两勺|二勺|1勺|2勺|少许|适量|一点)(.+)$/);
    if (m) {
      var amount = m[1];
      var name = (m[2] || '').trim();
      var amountDisplay = amount;
      if (amount === '半勺') amountDisplay = '1/2勺';
      if (amount === '两勺' || amount === '二勺') amountDisplay = '2勺';
      if (name) return name + '(' + amountDisplay + ')';
    }
    return t;
  }

  // 1) 调腌料重写：仅在整行以「与/用」开头且包含「调成腌料」时触发，避免误伤
  var marinadeMatch = s.match(/^(?:与|用)(.+?)调成腌料(?:备用)?$/);
  if (marinadeMatch) {
    var listRaw = (marinadeMatch[1] || '').replace(/^[：:\s]+/, '').replace(/^将/, '');
    var items = listRaw.split(/[、，,]+/).map(function (x) { return (x || '').toString().trim(); }).filter(function (x) { return !!x; });
    if (items.length > 0) {
      var outItems = items.map(normalizeAmountItem).filter(function (x) { return !!x; });
      if (outItems.length > 0) {
        return '调腌料：' + outItems.join('、');
      }
    }
  }

  // 2) 处理动作提示：仅在「无明显标点」且「主体+连续动作」完全可解析时触发
  //    目标是提升可读性，不强行改写复杂句。
  if (!/[，。；:：]/.test(s)) {
    var headMatch = s.match(/^([^\s，。；:：]{1,6})(.+)$/);
    if (headMatch) {
      var subject = headMatch[1];
      var rest = headMatch[2];
      var TOKENS = [
        '斩小块', '斩块', '切小块', '切块',
        '洗净', '沥水', '沥干', '控干', '擦干',
        '去皮', '去籽', '去核', '去骨', '去筋',
        '切片', '切丝', '切段', '切丁', '切末',
        '拍碎', '拍扁', '剁碎', '切碎'
      ];
      var actions = [];
      var remaining = rest;
      var safety = 0;
      while (remaining && safety++ < 12) {
        var consumed = false;
        for (var i = 0; i < TOKENS.length; i++) {
          var token = TOKENS[i];
          if (remaining.indexOf(token) === 0) {
            actions.push(token);
            remaining = remaining.slice(token.length);
            consumed = true;
            break;
          }
        }
        if (!consumed) break;
      }
      // 至少 2 个动作，且 rest 必须被完整解析，才改写
      if (actions.length >= 2 && remaining === '') {
        return '处理' + subject + '：' + actions.join('，');
      }
    }
  }

  // 3) 动词强绑定：去掉“、动词”中的分隔符（仅限少数动作词，避免误伤）
  s = s.replace(/、\s*(剁碎|切碎|切末|拍碎|拍扁|捣碎)\b/g, '$1');
  return s;
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

/** 兜底合并：连续同菜品、宝宝角色且文本极短的步骤合并到上一步，避免「切成小丁」等单独成卡。 */
var BABY_SHORT_STEP_MAX_LEN = 12;

function mergeConsecutiveBabyShortSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return steps;
  var out = [];
  var i = 0;
  while (i < steps.length) {
    var cur = steps[i];
    var curRole = cur.role;
    var curRecipe = cur.recipeName || '';
    var curDetails = cur.details || [];
    var outStep = { details: curDetails.slice() };
    for (var k in cur) {
      if (k !== 'details' && Object.prototype.hasOwnProperty.call(cur, k)) outStep[k] = cur[k];
    }
    outStep.details = curDetails.slice();
    out.push(outStep);
    i++;
    if (curRole !== 'baby') continue;
    while (i < steps.length) {
      var next = steps[i];
      if (next.role !== 'baby' || (next.recipeName || '') !== curRecipe) break;
      var nextDetails = next.details || [];
      var nextTextLen = nextDetails.join('').replace(/\s/g, '').length;
      if (nextTextLen > BABY_SHORT_STEP_MAX_LEN) break;
      var lastLine = outStep.details.length > 0 ? outStep.details[outStep.details.length - 1] : '';
      var append = (nextDetails.join('').trim() || '').replace(/^[，、]+/, '');
      if (append) {
        outStep.details = outStep.details.slice(0, outStep.details.length - 1).concat([lastLine + (lastLine ? '，' : '') + append]);
      }
      i++;
    }
  }
  return out;
}

function processStepsForView(steps) {
  // 入参容错：避免传入 null/undefined 时报错
  if (!Array.isArray(steps) || steps.length === 0) {
    return [];
  }
  steps = mergeConsecutiveBabyShortSteps(steps);

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
    // ★ 先用 normalizeDetailsForDisplay 合并孤立动词行（如独立的 "切"、"配"）
    var normalizedDetails = normalizeDetailsForDisplay(s.details || []);
    normalizedDetails.forEach(function (line) {
      var displayLine = menuData.replaceVagueSeasoningInText ? menuData.replaceVagueSeasoningInText(line) : line;
      displayLine = simplifyText(displayLine);
      var phrases = mergeShortPhrases(splitIntoShortPhrases(displayLine), 5);
      // ★ phrases 级别再次合并残留的孤立动词
      phrases = mergeIsolatedVerbPhrases(phrases);
      var isBaby = isBabyPortionLine(line);
      if (phrases.length === 0) {
        detailsWithSegments.push({
          richText: segmentsToRichText(highlightSegments(displayLine)),
          isBabyPortion: isBaby
        });
        return;
      }
      phrases.forEach(function (phrase, idx) {
        var p = (phrase || '').toString().replace(/^[，、\s]+/, '').trim();
        if (!p) return;
        var prefix = phrases.length > 1 ? getOrdinalPrefix(idx + 1) + ' ' : '';
        var fullText = prefix + p;
        detailsWithSegments.push({
          richText: segmentsToRichText(highlightSegments(fullText)),
          isBabyPortion: isBaby && idx === 0
        });
      });
    });
    var rawDetails = s.details || [];
    var stepType = getStepType(s);
    var isPrepStep = stepType === 'prep';
    var seasoningsList = extractSeasonings(rawDetails);

    // 阶段起点标记：
    // - 优先使用上游 generateUnifiedSteps 标记的 isPhaseStart/phaseType
    // - 若未提供，则回退到「首个备菜步骤 + 首个烹饪步骤」的简单分段逻辑
    var isPhaseStart = typeof s.isPhaseStart === 'boolean' ? s.isPhaseStart : false;
    var phaseType = s.phaseType || stepType;
    if (!s.isPhaseStart) {
      if (hasPrepPhase && stepType === 'prep' && index === 0) {
        isPhaseStart = true;
        phaseType = 'prep';
      } else if (hasCookPhase && stepType === 'cook' && index === firstCookIndex) {
        isPhaseStart = true;
        phaseType = 'cook';
      }
    }

    // 阶段标题与副标题：上游若已提供则直接透传，否则使用默认文案
    var phaseTitle = s.phaseTitle;
    var phaseSubtitle = s.phaseSubtitle;
    if (!phaseTitle) {
      if (phaseType === 'prep') {
        phaseTitle = '全局备菜阶段';
        phaseSubtitle = phaseSubtitle || '先把所有食材准备好，再专心烹饪';
      } else if (phaseType === 'cook') {
        phaseTitle = '集中烹饪阶段';
        phaseSubtitle = phaseSubtitle || '多道菜同步推进，注意火候顺序';
      }
    }

    // 并行上下文：用于提示「某道菜正在炖煮中」
    var parallelContext = s.parallelContext || null;

    return {
      id: s.id,
      title: s.title,
      stepType: stepType,          // 添加步骤类型
      recipeName: s.recipeName,    // 关联的菜品名（如果有）
      details: detailsWithSegments,
      duration: s.duration,
      completed: s.completed,
      actionType: s.actionType,
      roleTag: stepTag(s),
      isLast: lastId !== null && s.id === lastId,
      knifeWorkLabel: extractKnifeWork(rawDetails),
      seasoningsList: seasoningsList,
      showSeasoningsList: seasoningsList.length > 0 && !isPrepStep,
      // 阶段分隔相关（供 steps.wxml 渲染横幅）
      isPhaseStart: isPhaseStart,
      phaseType: phaseType,
      phaseTitle: phaseTitle,
      phaseSubtitle: phaseSubtitle,
      // 并行上下文提示
      parallelContext: parallelContext
    };
  });
}

function buildRhythmRings(viewSteps, currentIndex) {
  if (!Array.isArray(viewSteps) || viewSteps.length === 0) return [];
  var map = Object.create(null);
  var order = [];
  for (var i = 0; i < viewSteps.length; i++) {
    var s = viewSteps[i];
    var name = (s && s.recipeName) ? s.recipeName : '全局步骤';
    if (!map[name]) {
      map[name] = { name: name, total: 0, completed: 0, hasLongTerm: false, indices: [] };
      order.push(name);
    }
    map[name].total += 1;
    if (s && s.completed) map[name].completed += 1;
    if (s && (s.actionType === 'long_term' || s.phaseType === 'long_term' || (s.parallelContext && s.parallelContext.remainingMinutes != null))) {
      map[name].hasLongTerm = true;
    }
    map[name].indices.push(i);
  }
  var rings = [];
  for (var k = 0; k < order.length; k++) {
    var key = order[k];
    var g = map[key];
    if (!g || g.total <= 0) continue;
    var pct = Math.round((g.completed / g.total) * 100);
    var isActive = g.indices.indexOf(currentIndex) !== -1;
    rings.push({
      name: g.name,
      completed: g.completed,
      total: g.total,
      percent: pct,
      isActive: isActive,
      isPulsing: g.hasLongTerm && pct < 100,
      ringStyle: '--ring-pct:' + pct + '%;'
    });
  }
  return rings;
}

function buildPipelineSteps(viewSteps, currentIndex) {
  if (!Array.isArray(viewSteps) || viewSteps.length === 0) return [];
  return viewSteps.map(function (s, index) {
    var title = (s && s.title) ? String(s.title) : '';
    return {
      id: s.id,
      title: title,
      shortTitle: title.length > 10 ? title.slice(0, 10) + '…' : title,
      isCompleted: !!(s && s.completed),
      isCurrent: index === currentIndex
    };
  });
}

/**
 * 将外部导入菜谱的 steps 转换为 steps 页面内部格式。
 * 外部菜谱 step: { action: 'prep'|'cook', text: string, duration_num: number }
 * 内部 step: { id, title, details, duration, completed, role, step_type, recipeName, isPhaseStart, phaseType, phaseTitle, phaseSubtitle }
 */
function convertImportedRecipeToSteps(recipe) {
  if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) return [];

  var recipeName = recipe.name || '外部菜谱';
  var result = [];
  var prepSteps = [];
  var cookSteps = [];

  // 分类 prep / cook 步骤
  for (var i = 0; i < recipe.steps.length; i++) {
    var s = recipe.steps[i];
    if (s.action === 'prep') {
      prepSteps.push(s);
    } else {
      cookSteps.push(s);
    }
  }

  var stepIndex = 0;

  // 备菜步骤
  for (var p = 0; p < prepSteps.length; p++) {
    var ps = prepSteps[p];
    result.push({
      id: 'import-prep-' + stepIndex,
      title: recipeName + ' · 备菜',
      details: [ps.text || ''],
      duration: ps.duration_num || null,
      completed: false,
      role: 'adult',
      step_type: 'prep',
      recipeName: recipeName,
      isPhaseStart: p === 0,
      phaseType: p === 0 ? 'prep' : undefined,
      phaseTitle: p === 0 ? '备菜阶段' : undefined,
      phaseSubtitle: p === 0 ? '准备食材，为 ' + recipeName + ' 打好基础' : undefined
    });
    stepIndex++;
  }

  // 烹饪步骤
  for (var c = 0; c < cookSteps.length; c++) {
    var cs = cookSteps[c];
    result.push({
      id: 'import-cook-' + stepIndex,
      title: recipeName + ' · 烹饪',
      details: [cs.text || ''],
      duration: cs.duration_num || null,
      completed: false,
      role: 'adult',
      step_type: 'cook',
      recipeName: recipeName,
      isPhaseStart: c === 0,
      phaseType: c === 0 ? 'cook' : undefined,
      phaseTitle: c === 0 ? '烹饪阶段' : undefined,
      phaseSubtitle: c === 0 ? '开始制作 ' + recipeName : undefined
    });
    stepIndex++;
  }

  return result;
}

Page({
  data: {
    steps: [],
    viewSteps: [],
    allViewSteps: [],          // 全量步骤（步骤列表 sheet 用）
    progressPercentage: 0,
    progressBarStyle: 'width: 0%',
    currentStepLabel: '第 0/0 步',
    currentStepIndexDisplay: 0,
    completedCount: 0,
    totalSteps: 0,
    completionRate: 0,
    currentIndex: 0,
    showPrepPhase: false,
    showCookPhase: false,
    // Cook Mode 聚焦模式
    currentStep: {},           // 当前步骤视图数据
    prevStep: null,            // 上一步摘要
    nextStep: null,            // 下一步摘要
    currentPhaseLabel: '',     // 当前阶段标签文本
    currentPhaseType: '',      // 当前阶段类型（prep/cook/long_term 等）
    activeParallelTasks: [],   // 浮动并行状态条数据
    showStepList: false,       // 步骤列表 sheet
    showGanttSheet: false,     // 甘特图 sheet
    // 并行统筹与阶段高亮相关
    currentPhase: '',
    parallelTasks: [],
    timelineProgress: {},
    // 动态头图相关
    currentStepImage: '',
    currentStepTitle: '开始烹饪',
    currentStepSubtitle: '跟随步骤，轻松完成美味',
    rhythmRings: [],
    pipelineSteps: [],
    secondaryHint: '',
    // 阿姨模式
    isAyiMode: false,
    // 执行者模式（role=helper 分享进入）：单标题+折叠食材、隐藏重新生成/回首页
    isHelperRole: false,
    helperTitle: '',
    helperIngredientsList: [],
    helperIngredientsExpanded: true,
    // Zen Mode 疲惫模式（空气炸锅步骤可标注设备）
    isTiredMode: false,
    currentStepDevice: '',
    // 云端步骤缺失时：是否显示「重新加载」、加载中、同步错误
    showOfflineHint: false,
    stepsReloading: false,
    stepsSyncError: ''
  },

  onLoad: function (options) {
    var that = this;
    var preference = getStepsPreference();
    var steps;

    if (options && options.source === 'import') {
      // ── 外部菜谱导入模式 ──
      that._source = 'import';
      that._importRecipeName = options.recipeName ? decodeURIComponent(options.recipeName) : '';

      try {
        var importedRecipe = null;

        // 优先从 globalData 取，其次从 Storage 还原
        var app = getApp();
        if (app && app.globalData && app.globalData.importedRecipe) {
          importedRecipe = app.globalData.importedRecipe;
        }
        if (!importedRecipe) {
          var cached = wx.getStorageSync('imported_recipe');
          if (cached) importedRecipe = JSON.parse(cached);
        }

        if (importedRecipe && importedRecipe.steps && importedRecipe.steps.length > 0) {
          steps = convertImportedRecipeToSteps(importedRecipe);
          that._importedRecipe = importedRecipe;
        } else {
          console.warn('[steps] 导入菜谱无步骤数据');
          steps = null;
        }
      } catch (e) {
        console.error('[steps] 从 import 来源生成步骤失败:', e);
        steps = null;
      }
    } else if (options && (options.source === 'ayi' || options.role === 'helper') && options.recipeIds) {
      // ── 阿姨/帮手模式：从分享卡片打开（role=helper），用 result.menus 直接生成线性步骤，避免二次 resolve 导致步骤丢失 ──
      that._source = 'ayi';
      that._isAyiMode = true;
      that._isHelperRole = options.role === 'helper';
      try {
        that._ayiRecipeIds = decodeURIComponent(String(options.recipeIds || ''));
      } catch (decodeErr) {
        console.error('[steps] recipeIds 解析失败:', options.recipeIds, decodeErr);
        that._ayiRecipeIds = '';
      }
      that._ayiAdultCount = Number(options.adultCount) || 2;
      wx.setKeepScreenOn({ keepScreenOn: true });

      try {
        var ids = (that._ayiRecipeIds || '').split(',').map(function (s) { return (s || '').trim(); }).filter(Boolean);
        if (ids.length === 0) {
          console.error('[steps] role=helper 分享链路 recipeIds 为空，请检查分享 path 是否携带 recipeIds');
          steps = [];
        } else {
          var adultCount = Number(options.adultCount) || 2;
          var avoidList = [];
          if (options.avoid && typeof options.avoid === 'string') {
            try {
              var decoded = decodeURIComponent(options.avoid);
              avoidList = decoded.split(',').map(function (s) { return (s || '').trim(); }).filter(Boolean);
            } catch (e) {}
          }
          var ayiPref = { adultCount: adultCount, hasBaby: false, babyMonth: 12, avoidList: avoidList };

          var result = menuData.generateStepsFromRecipeIds(ids, ayiPref);
          var appAyi = getApp();
          if (appAyi && appAyi.globalData && Array.isArray(result.menus) && result.menus.length > 0) {
            appAyi.globalData.todayMenus = result.menus;
          }
          var menuGenerator = require('../../data/menuGenerator.js');
          var shopList = menuData.generateShoppingListFromMenus(ayiPref, result.menus || []);
          if (Array.isArray(result.menus) && result.menus.length > 1 && menuGenerator.linearFallback) {
            steps = menuGenerator.linearFallback(result.menus, shopList || []);
          } else if (Array.isArray(result.menus) && result.menus.length === 1 && Array.isArray(result.steps) && result.steps.length > 0) {
            steps = result.steps;
          } else if (Array.isArray(result.steps) && result.steps.length > 0) {
            steps = result.steps;
          } else {
            steps = menuData.generateSteps(ayiPref, { forceLinear: true });
          }
          if (!Array.isArray(steps) || steps.length === 0) {
            console.error('[steps] helper 模式步骤为空，recipeIds=', ids, 'menus.length=', (result.menus || []).length);
          }
          if (that._isHelperRole && result.menus && result.menus.length > 0) {
            var dishNames = result.menus.map(function (m) { return (m.adultRecipe && m.adultRecipe.name) || ''; }).filter(Boolean);
            that._helperTitle = '辛苦啦，今晚想吃：' + dishNames.join('、');
            that._helperIngredientsList = [];
            for (var si = 0; si < (shopList || []).length; si++) {
              var it = shopList[si];
              if (!it || (it.category || '') === '调料') continue;
              var iname = it.name || it.ingredient || '';
              if (!iname) continue;
              var amt = it.amount != null && it.amount !== '' ? it.amount : (it.baseAmount != null ? (it.baseAmount + (it.unit || '')) : (it.unit || '适量'));
              that._helperIngredientsList.push({ name: iname, amount: amt });
            }
          }
        }
      } catch (e) {
        console.error('[steps] 从 ayi/helper 来源生成步骤失败:', e);
        steps = null;
      }
    } else if (options && options.source === 'mix') {
      // ── 混合组餐模式 ──
      that._source = 'mix';
      that._mixRecipeNames = options.recipeNames ? decodeURIComponent(options.recipeNames) : '';

      try {
        var appMix = getApp();
        var mixMenus = appMix && appMix.globalData ? appMix.globalData.mixMenus : null;

        if (Array.isArray(mixMenus) && mixMenus.length > 0) {
          that._mixMenus = mixMenus;
          var mixShoppingList = appMix.globalData.mergedShoppingList || [];

          // 多菜并行统筹步骤
          var menuGenerator = require('../../data/menuGenerator.js');
          if (mixMenus.length > 1 && menuGenerator.generateUnifiedSteps) {
            steps = menuGenerator.generateUnifiedSteps(mixMenus, mixShoppingList);
          } else if (mixMenus.length === 1) {
            steps = menuGenerator.generateSteps(
              mixMenus[0].adultRecipe, mixMenus[0].babyRecipe, mixShoppingList
            );
          } else {
            steps = [];
          }
        } else {
          console.warn('[steps] 混合组餐菜单为空');
          steps = null;
        }
      } catch (e) {
        console.error('[steps] 从 mix 来源生成步骤失败:', e);
        steps = null;
      }
    } else {
      that._source = 'menu';

      // 原有逻辑：从 todayMenus / preference 生成步骤；透传 who/forceLinear 以支持 caregiver 线性分流
      try {
        var stepOptions = (preference && (preference.who || preference.forceLinear != null))
          ? { forceLinear: preference.forceLinear, who: preference.who }
          : undefined;
        steps = menuData.generateSteps(preference, stepOptions);
      } catch (e) {
        console.error('生成步骤失败:', e);
        steps = null;
      }

      // Zen Mode「别人做」：与分享进入的阿姨模式一致，简化 UI（隐藏甘特图、并行任务条等）
      if (preference && (preference.who === 'caregiver' || preference.who === 'ayi')) {
        that._isAyiMode = true;
        wx.setKeepScreenOn({ keepScreenOn: true });
      }
    }

    // 确保 steps 是数组
    if (!Array.isArray(steps)) {
      steps = [];
      console.warn('步骤数据为空或格式错误，已降级为空数组');
    }
    
    // 恢复已完成状态
    var storageKey = that._source === 'import'
        ? STORAGE_PREFIX + 'import_' + (that._importRecipeName || '')
        : that._source === 'mix'
          ? STORAGE_PREFIX + 'mix_' + (that._mixRecipeNames || '')
          : that._source === 'ayi'
            ? STORAGE_PREFIX + 'ayi_' + (that._ayiRecipeIds || '')
            : stepsStorageKey();
    that._storageKey = storageKey;

    try {
      var raw = wx.getStorageSync(storageKey);
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
    this._hasLinearFallback = false;
    this._currentStepIndex = 0;
    this._updateView(steps);
    this._updateHeaderImage(steps, 0);

    if (that._isHelperRole) {
      that.setData({
        isHelperRole: true,
        helperTitle: that._helperTitle || '',
        helperIngredientsList: that._helperIngredientsList || [],
        helperIngredientsExpanded: true
      });
    }

    var isOfflineHint = Array.isArray(steps) && steps.length === 1 && (
      steps[0]._isOfflineHint === true ||
      (steps[0].title === '提示' && steps[0].details && String(steps[0].details[0] || '').indexOf('联网') !== -1)
    );
    if (isOfflineHint) {
      console.log('[steps] 检测到需联网获取，800ms 后自动拉取云端并重试' + (that._isHelperRole ? '（helper 分享入口）' : ''));
      setTimeout(function () { that.retryLoadStepsFromCloud(); }, 800);
    }
  },
  
  /**
   * 加载菜单数据，用于获取菜品图片
   */
  _loadMenuData: function () {
    var that = this;
    that._menuRecipes = [];

    try {
      // 混合组餐来源 —— 使用 _mixMenus 构建菜品列表
      if (that._source === 'mix' && Array.isArray(that._mixMenus) && that._mixMenus.length > 0) {
        that._menuRecipes = that._mixMenus.map(function (m) {
          return {
            name: (m.adultRecipe && m.adultRecipe.name) || '',
            type: 'adult'
          };
        }).filter(function (r) { return r.name; });
        return;
      }

      // 外部导入来源 —— 使用 _importedRecipe 构建菜品列表
      if (that._source === 'import' && that._importedRecipe) {
        that._menuRecipes = [{
          name: that._importedRecipe.name || '',
          type: 'adult'
        }];
        return;
      }

      // 原有逻辑：优先从全局数据获取
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

    // 当前高亮步骤的阶段，用于顶部提示/样式
    var currentPhase = '';
    if (Array.isArray(viewSteps) && currentIndex >= 0 && currentIndex < viewSteps.length) {
      currentPhase = viewSteps[currentIndex].phaseType || viewSteps[currentIndex].stepType || '';
    }

    // ---------- Cook Mode 聚焦数据 ----------
    var currentStep = viewSteps[currentIndex] || {};
    var prevStep = currentIndex > 0 ? viewSteps[currentIndex - 1] : null;
    var nextStep = currentIndex < viewSteps.length - 1 ? viewSteps[currentIndex + 1] : null;

    // 阶段标签
    var currentPhaseLabel = '';
    var currentPhaseType = currentPhase;
    var phaseMap = { prep: '备菜', long_term: '炖煮', gap: '间隙利用', cook: '快炒', finish: '收尾' };
    if (currentPhaseType && phaseMap[currentPhaseType]) {
      currentPhaseLabel = phaseMap[currentPhaseType];
    } else if (currentStep.phaseTitle) {
      currentPhaseLabel = currentStep.phaseTitle;
    }

    // 提取活跃并行任务（浮动条用），预计算 barWidthStyle 避免 WXML 内联表达式触发 CSS 校验并减少渲染时计算
    var activeParallelTasks = [];
    for (var pt = 0; pt < viewSteps.length; pt++) {
      var vs = viewSteps[pt];
      if (vs && vs.parallelContext && !vs.completed) {
        var pct = vs.parallelContext.remainingMinutes != null ? Math.max(10, 100 - (vs.parallelContext.remainingMinutes / 60 * 100)) : 50;
        activeParallelTasks.push({
          stepId: vs.id,
          activeTaskName: vs.parallelContext.activeTaskName || vs.parallelContext.hint || '',
          remainingMinutes: vs.parallelContext.remainingMinutes,
          hint: vs.parallelContext.hint,
          progressPercent: pct,
          barWidthStyle: 'width:' + pct + '%'
        });
      }
    }

    // 副标题：当前菜名
    var subtitle = currentStep.recipeName || '跟随步骤，轻松完成美味';
    var rhythmRings = buildRhythmRings(viewSteps, currentIndex);
    var pipelineSteps = buildPipelineSteps(viewSteps, currentIndex);
    var secondaryHint = '';
    if (activeParallelTasks.length > 0) {
      var firstTask = activeParallelTasks[0];
      var hintName = firstTask.activeTaskName || firstTask.hint || '';
      if (hintName) {
        secondaryHint = hintName + (firstTask.remainingMinutes != null ? ' · ' + firstTask.remainingMinutes + ' 分钟' : '');
      }
    }

    // 是否为「需联网获取步骤」的提示（仅一条且带 _isOfflineHint）
    var showOfflineHint = steps.length === 1 && steps[0]._isOfflineHint === true;

    this.setData({
      steps: viewSteps,
      viewSteps: viewSteps,
      allViewSteps: viewSteps,
      progressPercentage: progress,
      progressBarStyle: 'width: ' + progress + '%',
      currentStepLabel: currentLabel,
      currentStepIndexDisplay: Math.min(currentIndex + 1, total),
      completedCount: completedCount,
      totalSteps: total,
      completionRate: progress,
      currentIndex: currentIndex,
      showPrepPhase: hasPrepPhase,
      showCookPhase: hasCookPhase,
      currentPhase: currentPhase,
      // Cook Mode 聚焦
      currentStep: currentStep,
      prevStep: prevStep,
      nextStep: nextStep,
      currentPhaseLabel: currentPhaseLabel,
      currentPhaseType: currentPhaseType,
      activeParallelTasks: activeParallelTasks,
      currentStepSubtitle: subtitle,
      rhythmRings: rhythmRings,
      pipelineSteps: pipelineSteps,
      secondaryHint: secondaryHint,
      isAyiMode: !!this._isAyiMode,
      isHelperRole: !!this._isHelperRole,
      showOfflineHint: showOfflineHint && !this._isHelperRole,
      isTiredMode: (function () {
        var p = getApp().globalData.preference || {};
        return p.isTimeSave === true || p.is_time_save === true || wx.getStorageSync('zen_cook_status') === 'tired';
      })(),
      currentStepDevice: (currentStep && currentStep.device) ? currentStep.device : ''
    });

    // 刷新时间轴统计与并行任务列表
    this.updateTimelineProgress(steps);
    this.checkParallelCompletion(steps);
  },

  /**
   * 更新时间轴进度（甘特图式）：包含总步数、完成步数与占比，
   * 若上游提供 actionType（long_term/active/idle_prep），则顺带统计不同类型数量。
   */
  updateTimelineProgress: function (stepsOverride) {
    var steps = Array.isArray(stepsOverride) ? stepsOverride : this._stepsRaw;
    if (!Array.isArray(steps)) {
      this.setData({ timelineProgress: {} });
      return;
    }

    var completedCount = 0;
    var total = steps.length;
    var longTermCount = 0;
    var activeCount = 0;
    var idlePrepCount = 0;

    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (s.completed) completedCount++;
      var at = s.actionType;
      if (at === 'long_term') longTermCount++;
      if (at === 'active') activeCount++;
      if (at === 'idle_prep') idlePrepCount++;
    }

    var percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    this.setData({
      timelineProgress: {
        totalSteps: total,
        completedSteps: completedCount,
        percentage: percentage,
        longTermCount: longTermCount,
        activeCount: activeCount,
        idlePrepCount: idlePrepCount
      }
    });
  },

  /**
   * 检测当前并行任务：从步骤中提取带 parallelContext 且尚未完成的步骤，
   * 用于在 UI 上提示「某菜正在炖煮中」等信息。
   */
  checkParallelCompletion: function (stepsOverride) {
    var steps = Array.isArray(stepsOverride) ? stepsOverride : this._stepsRaw;
    if (!Array.isArray(steps) || steps.length === 0) {
      this.setData({ parallelTasks: [] });
      return;
    }

    var tasks = [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (!s || !s.parallelContext || s.completed) continue;
      tasks.push({
        stepId: s.id,
        activeTaskName: s.parallelContext.activeTaskName,
        remainingMinutes: s.parallelContext.remainingMinutes,
        hint: s.parallelContext.hint
      });
    }

    this.setData({ parallelTasks: tasks });
  },

  /**
   * 步骤缺失时从云端重新拉取并刷新步骤
   * - 从今日菜单进入（menu）：同步后清空 todayMenus 并重新生成步骤
   * - 其他来源：仅同步云端，提示用户返回重新进入
   */
  retryLoadStepsFromCloud: function () {
    var that = this;
    console.log('[steps] retryLoadStepsFromCloud 被调用, source=' + (that._source || ''));
    that.setData({ stepsReloading: true, stepsSyncError: '' });

    function done(err) {
      that.setData({
        stepsReloading: false,
        stepsSyncError: err ? ((err && err.message) ? err.message : '同步失败，请检查网络后重试') : ''
      });
    }

    try {
      menuData.syncCloudRecipes({ forceRefresh: true })
        .then(function (result) {
          try {
            if (result && result.message === '同步进行中') {
              that.setData({ stepsReloading: false });
              setTimeout(function () { that.retryLoadStepsFromCloud(); }, 2500);
              return;
            }
            if (that._source === 'menu') {
              var app = getApp();
              if (app && app.globalData) app.globalData.todayMenus = null;
              var preference = getStepsPreference();
              var stepOptions = (preference && (preference.who || preference.forceLinear != null))
                ? { forceLinear: preference.forceLinear, who: preference.who }
                : undefined;
              var steps = menuData.generateSteps(preference, stepOptions);
              if (!Array.isArray(steps)) steps = [];
              console.log('[steps] 重新生成步骤数: ' + steps.length + (steps.length === 1 && steps[0]._isOfflineHint ? ' (仍为联网提示)' : ''));
              that._stepsRaw = steps;
              that._currentStepIndex = 0;
              that._updateView(steps);
              that._updateHeaderImage(steps, 0);
            } else if (that._source === 'mix' && Array.isArray(that._mixMenus) && that._mixMenus.length > 0) {
              // 混合组餐：用当前缓存按 id 重新解析菜谱后再生成步骤
              var appMix = getApp();
              var mixMenus = appMix && appMix.globalData && appMix.globalData.mixMenus ? appMix.globalData.mixMenus : that._mixMenus;
              var mixShoppingList = (appMix && appMix.globalData && appMix.globalData.mergedShoppingList) || [];
              var resolveOne = function (m) {
                var aid = m.adultRecipe && m.adultRecipe.id;
                var bid = m.babyRecipe && m.babyRecipe.id;
                return {
                  adultRecipe: aid ? (menuData.getAdultRecipeById(aid) || m.adultRecipe) : m.adultRecipe,
                  babyRecipe: bid ? (menuData.getBabyRecipeById(bid) || m.babyRecipe) : m.babyRecipe,
                  meat: m.meat,
                  taste: m.taste,
                  checked: m.checked
                };
              };
              var resolvedMix = mixMenus.map(resolveOne);
              var menuGenerator = require('../../data/menuGenerator.js');
              var steps;
              if (resolvedMix.length > 1 && menuGenerator.generateUnifiedSteps) {
                steps = menuGenerator.generateUnifiedSteps(resolvedMix, mixShoppingList);
              } else if (resolvedMix.length === 1) {
                steps = menuGenerator.generateSteps(
                  resolvedMix[0].adultRecipe, resolvedMix[0].babyRecipe, mixShoppingList
                );
              } else {
                steps = [];
              }
              if (!Array.isArray(steps)) steps = [];
              console.log('[steps] mix 重新生成步骤数: ' + steps.length + (steps.length === 1 && steps[0]._isOfflineHint ? ' (仍为联网提示)' : ''));
              that._stepsRaw = steps;
              that._currentStepIndex = 0;
              that._updateView(steps);
              that._updateHeaderImage(steps, 0);
            } else if (that._source === 'ayi' && that._ayiRecipeIds) {
              // 阿姨模式：用当前缓存按 id 重新生成步骤（强制线性）
              var idsAyi = that._ayiRecipeIds.split(',').filter(Boolean);
              var adultCountAyi = that._ayiAdultCount != null ? that._ayiAdultCount : 2;
              var ayiPref = { adultCount: adultCountAyi, hasBaby: false, babyMonth: 12 };
              var resultAyi = menuData.generateStepsFromRecipeIds(idsAyi, ayiPref);
              var appAyi = getApp();
              if (appAyi && appAyi.globalData && Array.isArray(resultAyi.menus) && resultAyi.menus.length > 0) {
                appAyi.globalData.todayMenus = resultAyi.menus;
              }
              var stepsAyi = menuData.generateSteps(ayiPref, { forceLinear: true });
              if (!Array.isArray(stepsAyi)) stepsAyi = [];
              console.log('[steps] ayi 重新生成步骤数: ' + stepsAyi.length + (stepsAyi.length === 1 && stepsAyi[0]._isOfflineHint ? ' (仍为联网提示)' : ''));
              that._stepsRaw = stepsAyi;
              that._currentStepIndex = 0;
              that._updateView(stepsAyi);
              that._updateHeaderImage(stepsAyi, 0);
            } else {
              if (typeof wx !== 'undefined' && wx.showToast) {
                wx.showToast({ title: '已同步，请返回重新进入', icon: 'none' });
              }
            }
            done(null);
          } catch (e) {
            done(e);
          }
        })
        .catch(function (err) {
          done(err);
        });
    } catch (e) {
      done(e);
    }
  },

  /**
   * 自动高亮下一步：
   * - 找到首个未完成步骤（若全完成则使用最后一步）
   * - 更新 currentIndex/_currentStepIndex
   * - 自动滚动到对应卡片
   * - 刷新头图与阶段/并行信息
   */
  autoHighlightNextStep: function () {
    var steps = this._stepsRaw;
    if (!Array.isArray(steps) || steps.length === 0) return;
    // 直接刷新整个视图（包含聚焦数据）
    this._updateView(steps);
    this._updateHeaderImage(steps, this._currentStepIndex);
  },

  /**
   * 点击时间轴/列表中任意步骤：跳转到该步骤
   */
  onStepTap: function (e) {
    var index = e.currentTarget.dataset.index;
    if (typeof index !== 'number') index = Number(index);
    if (isNaN(index)) return;
    this._jumpToIndex(index);
  },

  /** 跳转到指定步骤下标 */
  _jumpToIndex: function (index) {
    if (!Array.isArray(this._stepsRaw) || this._stepsRaw.length === 0) return;
    index = Math.max(0, Math.min(index, this._stepsRaw.length - 1));
    this._currentStepIndex = index;

    var viewSteps = this.data.allViewSteps || this.data.viewSteps || [];
    var currentStep = viewSteps[index] || {};
    var prevStep = index > 0 ? viewSteps[index - 1] : null;
    var nextStep = index < viewSteps.length - 1 ? viewSteps[index + 1] : null;
    var currentPhase = currentStep.phaseType || currentStep.stepType || '';
    var phaseMap = { prep: '备菜', long_term: '炖煮', gap: '间隙利用', cook: '快炒', finish: '收尾' };
    var currentPhaseLabel = phaseMap[currentPhase] || currentStep.phaseTitle || '';
    var subtitle = currentStep.recipeName || '跟随步骤，轻松完成美味';

    this.setData({
      currentIndex: index,
      currentStep: currentStep,
      prevStep: prevStep,
      nextStep: nextStep,
      currentPhase: currentPhase,
      currentPhaseLabel: currentPhaseLabel,
      currentPhaseType: currentPhase,
      currentStepIndexDisplay: Math.min(index + 1, this._stepsRaw.length),
      currentStepSubtitle: subtitle
    });
    this._updateHeaderImage(this._stepsRaw, index);
  },

  /** Cook Mode：上一步 */
  goPrevStep: function () {
    var idx = this._currentStepIndex;
    if (idx > 0) this._jumpToIndex(idx - 1);
  },

  /** Cook Mode：下一步（点击下一步预览） */
  goNextStep: function () {
    var idx = this._currentStepIndex;
    var steps = this._stepsRaw;
    if (Array.isArray(steps) && idx < steps.length - 1) this._jumpToIndex(idx + 1);
  },

  /** 完成当前步骤（底部操作栏主按钮） */
  markCurrentCompleted: function () {
    var steps = this._stepsRaw;
    if (!Array.isArray(steps) || steps.length === 0) return;
    var idx = this._currentStepIndex;
    var step = steps[idx];
    if (!step) return;

    // 模拟 markCompleted 的逻辑
    step.completed = true;
    var that = this;
    try {
      var payload = steps.map(function (s) { return { id: s.id, completed: s.completed }; });
      wx.setStorageSync(that._storageKey || stepsStorageKey(), JSON.stringify(payload));
    } catch (err) {
      console.warn('保存步骤状态失败:', err);
    }
    this._updateView(steps);

    // 检测缺料
    var missingResult = this.checkMissingIngredients();
    if (missingResult && missingResult.hasMissing) {
      this.triggerFallback(missingResult);
    }

    // 最后一步完成
    var lastId = steps[steps.length - 1].id;
    if (step.id === lastId) {
      // ====== 书脊微光：记录烹饪完成时间 ======
      wx.setStorageSync('last_cook_complete_time', Date.now());
      // ====== 烟火集：统一检测所有贴纸掉落 ======
      try {
        var stickerCollection = require('../../data/stickerCollection.js');
        var pref = getApp().globalData.preference || {};
        var isTired = pref.isTimeSave === true || pref.is_time_save === true || wx.getStorageSync('zen_cook_status') === 'tired';
        var recipeNames = (that._menuRecipes || []).map(function (r) { return r.name; }).filter(Boolean);
        var isHesitant = !!getApp().globalData._hesitantStart;
        var drops = stickerCollection.checkAllDropsOnComplete({
          isTired: isTired,
          isHesitant: isHesitant,
          recipeNames: recipeNames
        });
        if (drops.length > 0) {
          getApp().globalData.pendingStickerDrop = drops;
        }
        // 清除犹豫标记
        getApp().globalData._hesitantStart = false;
      } catch (e) {
        console.warn('[steps] 贴纸检测异常:', e);
      }
      if (that._isHelperRole) {
        wx.showModal({
          title: '料理完成！',
          content: '按步骤都做好啦，开启幸福用餐时光吧。',
          showCancel: false,
          confirmText: '知道了'
        });
      } else {
        wx.showModal({
          title: '料理完成！',
          content: '全家人的美味已准备就绪，开启幸福用餐时光吧。',
          confirmText: '回首页',
          cancelText: '再看看',
          success: function (res) {
            if (res.confirm) {
              try { wx.removeStorageSync(that._storageKey || stepsStorageKey()); } catch (e) {}
              wx.reLaunch({ url: '/pages/home/home' });
            }
          }
        });
      }
    }
  },

  /** 步骤列表 Bottom Sheet 开关 */
  toggleStepList: function () {
    this.setData({ showStepList: !this.data.showStepList, showGanttSheet: false });
  },

  /** 甘特图 Bottom Sheet 开关 */
  toggleGanttSheet: function () {
    this.setData({ showGanttSheet: !this.data.showGanttSheet, showStepList: false });
  },

  /** 执行者模式：折叠/展开食材准备 */
  toggleHelperIngredients: function () {
    this.setData({ helperIngredientsExpanded: !this.data.helperIngredientsExpanded });
  },

  /** 从步骤列表 sheet 跳转到指定步骤 */
  onJumpToStep: function (e) {
    var index = e.currentTarget.dataset.index;
    if (typeof index !== 'number') index = Number(index);
    if (isNaN(index)) return;
    this.setData({ showStepList: false });
    this._jumpToIndex(index);
  },

  /**
   * 检查当前购物清单中是否存在未勾选的食材。
   * 返回 { missingIngredients: string[], hasMissing: boolean }
   */
  checkMissingIngredients: function () {
    var missing = [];
    var cart = [];
    var checkedMap = {};

    try {
      cart = wx.getStorageSync('cart_ingredients') || [];
    } catch (e) {
      cart = [];
    }

    try {
      var raw = wx.getStorageSync(STORAGE_KEY_TODAY_SHOPPING);
      checkedMap = raw ? JSON.parse(raw) : {};
      if (typeof checkedMap !== 'object' || checkedMap === null) checkedMap = {};
    } catch (e2) {
      checkedMap = {};
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      return { missingIngredients: [], hasMissing: false };
    }

    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      if (!item || !item.name) continue;
      if (item.name === '请先生成菜单后查看清单') continue;
      var key = item.name;
      var checked = Object.prototype.hasOwnProperty.call(checkedMap, key) ? !!checkedMap[key] : false;
      if (!checked) {
        missing.push(key);
      }
    }

    return { missingIngredients: missing, hasMissing: missing.length > 0 };
  },

  /**
   * 触发线性降级：当检测到存在未勾选食材时，提示用户并可回退为按菜品顺序的线性步骤。
   */
  triggerFallback: function (missingResult) {
    if (!missingResult || !missingResult.hasMissing) return;
    if (this._hasLinearFallback) return;

    var that = this;
    var names = missingResult.missingIngredients.slice(0, 5).join('、');
    var more = missingResult.missingIngredients.length > 5 ? '等' : '';

    wx.showModal({
      title: '检测到可能缺料',
      content: '购物清单中还有未勾选的食材（如：' + names + more + '）。是否切换为更简单的按菜品顺序步骤，减少出错风险？',
      confirmText: '切换线性步骤',
      cancelText: '继续当前流程',
      success: function (res) {
        if (!res.confirm) return;

        // 标记已触发降级，避免重复弹窗
        that._hasLinearFallback = true;

        // 重新按线性逻辑生成步骤
        var preference = getStepsPreference();
        var newSteps;
        try {
          newSteps = menuData.generateSteps(preference, { forceLinear: true });
        } catch (e) {
          console.error('线性降级生成步骤失败:', e);
          that._hasLinearFallback = false;
          return;
        }

        if (!Array.isArray(newSteps)) {
          newSteps = [];
        }

        // 清理原有完成状态，避免与新步骤错位
        try {
          wx.removeStorageSync(that._storageKey || stepsStorageKey());
        } catch (clearErr) {
          console.warn('清理步骤完成状态失败:', clearErr);
        }

        that._stepsRaw = newSteps;
        that._currentStepIndex = 0;
        that._updateView(newSteps);
        that._updateHeaderImage(newSteps, 0);
      }
    });
  },

  markCompleted: function (e) {
    var that = this;
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
      wx.setStorageSync(that._storageKey || stepsStorageKey(), JSON.stringify(payload));
    } catch (err) {
      console.warn('保存步骤状态失败:', err);
    }
    this._updateView(steps);

    // 根据最新进度，自动高亮下一步、滚动并刷新头图/阶段/并行提示
    this.autoHighlightNextStep();

    // 非执行者模式才做缺料检测（执行者从分享进入，无采购页勾选状态）
    if (!this._isHelperRole) {
      var missingResult = this.checkMissingIngredients();
      if (missingResult && missingResult.hasMissing) this.triggerFallback(missingResult);
    }

    var lastId = steps[steps.length - 1].id;
    if (step.id === lastId) {
      // ====== 书脊微光：记录烹饪完成时间 ======
      wx.setStorageSync('last_cook_complete_time', Date.now());
      // ====== 烟火集：统一检测所有贴纸掉落 ======
      try {
        var stickerCollectionComplete = require('../../data/stickerCollection.js');
        var prefComplete = getApp().globalData.preference || {};
        var isTiredComplete = prefComplete.isTimeSave === true || prefComplete.is_time_save === true || wx.getStorageSync('zen_cook_status') === 'tired';
        var recipeNamesComplete = (that._menuRecipes || []).map(function (r) { return r.name; }).filter(Boolean);
        var isHesitantComplete = !!getApp().globalData._hesitantStart;
        var dropsComplete = stickerCollectionComplete.checkAllDropsOnComplete({
          isTired: isTiredComplete,
          isHesitant: isHesitantComplete,
          recipeNames: recipeNamesComplete
        });
        if (dropsComplete.length > 0) {
          getApp().globalData.pendingStickerDrop = dropsComplete;
        }
        getApp().globalData._hesitantStart = false;
      } catch (e) {
        console.warn('[steps] 贴纸检测异常:', e);
      }
      if (that._isHelperRole) {
        wx.showModal({
          title: '料理完成！',
          content: '按步骤都做好啦，开启幸福用餐时光吧。',
          showCancel: false,
          confirmText: '知道了'
        });
      } else {
        wx.showModal({
          title: '料理完成！',
          content: '全家人的美味已准备就绪，开启幸福用餐时光吧。',
          confirmText: '回首页',
          cancelText: '再看看',
          success: function (res) {
            if (res.confirm) {
              try { wx.removeStorageSync(that._storageKey || stepsStorageKey()); } catch (e) {}
              wx.reLaunch({ url: '/pages/home/home' });
            }
          }
        });
      }
    }
  },

  onUnload: function () {
    if (this._isAyiMode) {
      wx.setKeepScreenOn({ keepScreenOn: false });
    }
  },

  onShareAppMessage: function () {
    return { title: '今日家庭午餐 - 做菜步骤', path: '/pages/steps/steps' };
  }
});

module.exports = { stepsStorageKey: stepsStorageKey };
