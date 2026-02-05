var menuData = require('../../data/menuData.js');
var recipeResources = require('../../data/recipeResources.js');
var imageLib = require('../../utils/imageLib.js');

var IMAGE_CONFIG = recipeResources.IMAGE_CONFIG;
var STORAGE_PREFIX = 'tablesync_steps_completed_';
var KEY_ACTIONS = ['下锅', '打泥', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];
var KEY_ACTIONS_RE = new RegExp('(' + KEY_ACTIONS.join('|') + ')', 'g');
var KEY_ACTIONS_SET = (function () {
  var set = Object.create(null);
  for (var i = 0; i < KEY_ACTIONS.length; i++) {
    set[KEY_ACTIONS[i]] = true;
  }
  return set;
})();
// 购物清单勾选状态存储 Key（与 shopping.js 保持一致）
var STORAGE_KEY_TODAY_SHOPPING = 'tablesync_shopping_checked_today';

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

/**
 * 将 segments 数组转换为 rich-text 可用的 HTML 字符串
 * 用于解决嵌套 <text> 标签在部分设备上导致意外换行的问题
 * 注意：rich-text 内部的 span 不支持 class，需要使用内联样式
 */
function segmentsToRichText(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  var html = '';
  // 内联样式：与 WXSS 中 .detail-strong / .detail-light 保持一致
  var strongStyle = 'font-weight:600;color:#2d2d2d;padding:0 2px;border-radius:3px;background:linear-gradient(to top,#fff3e0 40%,transparent 40%);';
  var lightStyle = 'color:#666;';
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var escapedText = (seg.text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (seg.strong) {
      html += '<span style="' + strongStyle + '">' + escapedText + '</span>';
    } else {
      html += '<span style="' + lightStyle + '">' + escapedText + '</span>';
    }
  }
  return html;
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

function isPureKeyActionText(text) {
  if (text == null) return false;
  var t = text.toString().trim();
  return !!(t && KEY_ACTIONS_SET[t]);
}

/**
 * 从一段文本中识别“纯动作词”（允许少量前后缀/标点）：
 * - 支持：'蒸' / '蒸：' / '🔥 蒸' / '👶 【宝宝端】🔥 蒸' / '① 蒸'
 * - 不支持：'蒸锅' / '蒸好' / '蒸 8分钟'（这些本就不是“孤立动词行”）
 * @returns {string} 命中的动作词，否则返回空串
 */
function extractPureKeyAction(text) {
  if (text == null) return '';
  var raw = text.toString();
  var s = raw.trim();
  if (!s) return '';

  // 去掉可能的序号前缀：① / 1.
  s = s.replace(/^(?:[\u2460-\u2469]|\d+\.)\s+/, '');

  // 去掉常见的角色/提示前缀：👨/👶/【xx】/✨🔥⏳等
  s = s.replace(/^(?:👨|👶)\s*/, '');
  s = s.replace(/^【[^】]{1,12}】\s*/, '');
  s = s.replace(/^(?:[✨🔥⏳🍼✅🔪]\s*)+/, '');

  // 去掉前后常见标点（只允许“剩下的是动作词”）
  s = s
    .replace(/^[：:\-•·\u00B7\s]+/, '')
    .replace(/[：:，,。．；;！？!?…\s]+$/, '')
    .trim();

  return KEY_ACTIONS_SET[s] ? s : '';
}

/**
 * 保留原始前缀（如“👶 【宝宝端】🔥 ”），并识别末尾动作词。
 * @returns {{prefix: string, action: string} | null}
 */
function splitPrefixAndPureAction(raw) {
  var action = extractPureKeyAction(raw);
  if (!action) return null;
  var str = raw == null ? '' : raw.toString();
  var idx = str.lastIndexOf(action);
  var prefix = idx === -1 ? '' : str.slice(0, idx).trim();
  return { prefix: prefix, action: action };
}

/**
 * 归一化 details（渲染前，不改数据源）：
 * - 若某一行仅为动作词（如“蒸/切/炖”）且下一行有内容，则合并为“动词：下一行”
 * - 同步保留“宝宝分拨/分出”标记：若合并的任一行命中，则合并后行也视为宝宝分拨行
 */
function normalizeDetailsForView(details) {
  var out = [];
  if (!Array.isArray(details) || details.length === 0) return out;
  for (var i = 0; i < details.length; i++) {
    var currRaw = details[i] == null ? '' : details[i].toString();
    var currTrim = currRaw.trim();
    var currIsBaby = isBabyPortionLine(currRaw);

    var pa = splitPrefixAndPureAction(currTrim);
    if (pa && i + 1 < details.length) {
      var nextRaw = details[i + 1] == null ? '' : details[i + 1].toString();
      var nextTrim = nextRaw.trim();
      if (nextTrim) {
        out.push({
          text: (pa.prefix ? pa.prefix + ' ' : '') + pa.action + '：' + nextTrim,
          isBabyPortion: currIsBaby || isBabyPortionLine(nextRaw)
        });
        i++; // skip next
        continue;
      }
    }

    out.push({ text: currRaw, isBabyPortion: currIsBaby });
  }
  return out;
}

/**
 * 归一化短句数组（同一原始行内兜底）：
 * - 若某短句仅为动作词且后面还有短句，则合并为“动词：后一句”
 */
function mergeIsolatedActionPhrases(phrases) {
  if (!Array.isArray(phrases) || phrases.length === 0) return [];
  var out = [];
  for (var i = 0; i < phrases.length; i++) {
    var p = (phrases[i] || '').toString().trim();
    if (!p) continue;
    var pa = splitPrefixAndPureAction(p);
    if (pa && i + 1 < phrases.length) {
      var next = (phrases[i + 1] || '').toString().trim();
      if (next) {
        out.push((pa.prefix ? pa.prefix + ' ' : '') + pa.action + '：' + next);
        i++; // skip next
        continue;
      }
    }
    out.push(p);
  }
  return out;
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
 * 文案清洗（模板级，尽量保守）：
 * - 动词强绑定：如「蒜、豆豉、剁碎」→「蒜、豆豉剁碎」（避免名词与动词拆开显示）
 * - 调腌料重写：如「与生抽、淀粉、半勺油调成腌料」→「调腌料：生抽、淀粉、油(1/2勺)」
 * - 处理动作提示：如「排骨斩小块洗净沥水」→「处理排骨：斩小块，洗净，沥水」
 */
function simplifyText(line) {
  if (!line || typeof line !== 'string') return line;
  var s = line.trim();
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
 * 渲染层最终兜底：合并"孤立动作词行"
 * 检查 detailsWithSegments 中每一行的 segments 拼接后是否为纯动作词，
 * 若是且有下一行，则将当前行与下一行合并（动作词 + "：" + 下一行内容）
 */
function postMergeIsolatedSegmentLines(lines, highlightFn) {
  if (!Array.isArray(lines) || lines.length === 0) return lines;

  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var curr = lines[i];
    var segs = curr.segments || [];

    // 拼接当前行所有 segment 的文本，去掉序号前缀后判断是否为纯动作词
    var fullText = '';
    for (var j = 0; j < segs.length; j++) {
      fullText += segs[j].text || '';
    }
    var stripped = fullText.replace(/^(?:[\u2460-\u2469]|\d+\.)\s*/, '').trim();

    // 如果当前行是纯动作词（如"切"），且有下一行，则合并
    if (KEY_ACTIONS_SET[stripped] && i + 1 < lines.length) {
      var next = lines[i + 1];
      var nextSegs = next.segments || [];
      var nextText = '';
      for (var k = 0; k < nextSegs.length; k++) {
        nextText += nextSegs[k].text || '';
      }
      // 去掉下一行可能的序号前缀
      nextText = nextText.replace(/^(?:[\u2460-\u2469]|\d+\.)\s*/, '').trim();

      // 合并成：当前行序号(如有) + 动作词 + "：" + 下一行内容
      var prefix = '';
      var prefixMatch = fullText.match(/^([\u2460-\u2469]|\d+\.)\s*/);
      if (prefixMatch) prefix = prefixMatch[0];

      var merged = prefix + stripped + '：' + nextText;
      var mergedSegs = highlightFn(merged);
      out.push({
        segments: mergedSegs,
        richTextHtml: segmentsToRichText(mergedSegs),
        isBabyPortion: curr.isBabyPortion || next.isBabyPortion
      });
      i++; // skip next line
      continue;
    }

    // 确保非合并行也有 richTextHtml
    if (!curr.richTextHtml && curr.segments) {
      curr.richTextHtml = segmentsToRichText(curr.segments);
    }
    out.push(curr);
  }
  return out;
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

  // 兜底：防止辅助方法缺失导致整页白屏
  var safeHighlightSegments =
    typeof highlightSegments === 'function'
      ? highlightSegments
      : function (text) {
          return [{ text: text == null ? '' : String(text), strong: false }];
        };
  var safeGetOrdinalPrefix =
    typeof getOrdinalPrefix === 'function'
      ? getOrdinalPrefix
      : function (n) {
          return n + '.';
        };

  // 预计算阶段信息：首个烹饪步骤索引、是否存在备菜/烹饪阶段
  var firstPrepIndex = -1;
  var firstCookIndex = -1;
  var hasPrepPhase = false;
  var hasCookPhase = false;
  for (var i = 0; i < steps.length; i++) {
    var t = getStepType(steps[i]);
    if (t === 'prep') {
      hasPrepPhase = true;
      if (firstPrepIndex === -1) firstPrepIndex = i;
    }
    if (t === 'cook') {
      hasCookPhase = true;
      if (firstCookIndex === -1) firstCookIndex = i;
    }
  }

  var lastId = steps[steps.length - 1].id;
  var view = new Array(steps.length);
  for (var stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    var s = steps[stepIndex];
    var detailsWithSegments = [];

    // details 级归一化：合并“纯动作词行”到下一行，避免孤立动词单独成行
    var normalized = normalizeDetailsForView(s.details || []);
    for (var di = 0; di < normalized.length; di++) {
      var line = normalized[di].text;
      var displayLine = menuData.replaceVagueSeasoningInText ? menuData.replaceVagueSeasoningInText(line) : line;
      displayLine = simplifyText(displayLine);
      // 移除步骤详情中的 emoji 前缀（如 👨/👶/🔥/✨ 等），保持页面简洁
      displayLine = displayLine.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
      // 关键修复：将换行符替换为空格，避免 splitIntoShortPhrases 把文本错误拆成多行
      displayLine = displayLine.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      // phrases 级归一化：兜底合并“纯动作词短句”到后一句，避免行内断句导致孤立动词
      var phrasesRaw = splitIntoShortPhrases(displayLine);
      var phrasesNorm = mergeIsolatedActionPhrases(phrasesRaw);
      var phrases = mergeShortPhrases(phrasesNorm, 5);
      var isBaby = !!normalized[di].isBabyPortion;
      if (phrases.length === 0) {
        var segsEmpty = safeHighlightSegments(displayLine);
        detailsWithSegments.push({
          segments: segsEmpty,
          richTextHtml: segmentsToRichText(segsEmpty),
          isBabyPortion: isBaby
        });
        continue;
      }
      phrases.forEach(function (phrase, index) {
        var prefix = phrases.length > 1 ? safeGetOrdinalPrefix(index + 1) + ' ' : '';
        var fullText = prefix + phrase;
        var segsPhrase = safeHighlightSegments(fullText);
        detailsWithSegments.push({
          segments: segsPhrase,
          richTextHtml: segmentsToRichText(segsPhrase),
          isBabyPortion: isBaby && index === 0
        });
      });
    }

    // ===== 最终兜底：合并"渲染层孤立动作词行" =====
    // 若某行 segments 拼接后仍为纯动作词，则和下一行合并，彻底杜绝"切/丁"分行问题
    detailsWithSegments = postMergeIsolatedSegmentLines(detailsWithSegments, safeHighlightSegments);

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
      if (hasPrepPhase && stepType === 'prep' && stepIndex === firstPrepIndex) {
        isPhaseStart = true;
        phaseType = 'prep';
      } else if (hasCookPhase && stepType === 'cook' && stepIndex === firstCookIndex) {
        isPhaseStart = true;
        phaseType = 'cook';
      }
    }

    // 阶段标题与副标题：上游若已提供则直接透传，否则使用默认文案
    var phaseTitle = s.phaseTitle;
    var phaseSubtitle = s.phaseSubtitle;
    if (!phaseTitle) {
      if (phaseType === 'prep') {
        phaseTitle = '备料总览';
        phaseSubtitle = phaseSubtitle || '清点今日所需食材';
      } else if (phaseType === 'cook') {
        phaseTitle = '烹饪阶段';
        phaseSubtitle = phaseSubtitle || '多道菜同步推进';
      }
    }

    // 并行上下文：用于提示「某道菜正在炖煮中」
    var parallelContext = s.parallelContext || null;

    view[stepIndex] = {
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
      // 阶段分隔相关（供 steps.wxml 渲染横幅）
      isPhaseStart: isPhaseStart,
      phaseType: phaseType,
      phaseTitle: phaseTitle,
      phaseSubtitle: phaseSubtitle,
      // 并行上下文提示
      parallelContext: parallelContext
    };
  }
  return view;
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
    // 并行统筹与阶段高亮相关
    currentPhase: '',          // 当前阶段（prep/cook/long_term 等）
    parallelTasks: [],         // 当前并行任务列表（用于提示长耗时菜正在进行中）
    timelineProgress: {},      // 甘特图式进度概览（总步数、完成数、占比等）
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
    this._hasLinearFallback = false; // 标记是否已触发线性降级
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
    try {
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
        showCookPhase: hasCookPhase,
        currentPhase: currentPhase
      });

      // 刷新时间轴统计与并行任务列表
      this.updateTimelineProgress(steps);
      this.checkParallelCompletion(steps);
    } catch (err) {
      // 容错：防止数据加工异常导致整页白屏
      console.error('_updateView: steps 数据处理失败，已降级渲染:', err);
      try {
        this.setData({
          steps: [],
          viewSteps: [],
          progressPercentage: 0,
          currentStepLabel: '步骤加载失败',
          completedCount: 0,
          totalSteps: Array.isArray(steps) ? steps.length : 0,
          completionRate: 0,
          currentIndex: 0,
          showPrepPhase: false,
          showCookPhase: false,
          currentPhase: ''
        });
      } catch (setErr) {
        console.warn('_updateView: setData 降级也失败:', setErr);
      }
    }
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
   * 自动高亮下一步：
   * - 找到首个未完成步骤（若全完成则使用最后一步）
   * - 更新 currentIndex/_currentStepIndex
   * - 自动滚动到对应卡片
   * - 刷新头图与阶段/并行信息
   */
  autoHighlightNextStep: function () {
    var steps = this._stepsRaw;
    if (!Array.isArray(steps) || steps.length === 0) return;

    var nextIndex = -1;
    for (var i = 0; i < steps.length; i++) {
      if (!steps[i].completed) {
        nextIndex = i;
        break;
      }
    }
    if (nextIndex === -1) {
      nextIndex = steps.length - 1;
    }

    this._currentStepIndex = nextIndex;

    // 计算当前阶段（直接基于视图数据以保证与 UI 一致）
    var viewSteps = this.data.steps || this.data.viewSteps || [];
    var currentPhase = '';
    if (Array.isArray(viewSteps) && nextIndex >= 0 && nextIndex < viewSteps.length) {
      currentPhase = viewSteps[nextIndex].phaseType || viewSteps[nextIndex].stepType || '';
    }

    this.setData({
      currentIndex: nextIndex,
      currentPhase: currentPhase
    });

    var targetStep = steps[nextIndex];
    if (targetStep && !targetStep.completed) {
      var selector = '#step-' + targetStep.id;
      try {
        wx.pageScrollTo({
          selector: selector,
          duration: 300,
          offsetTop: -200 // 留出头图区域
        });
      } catch (scrollErr) {
        console.warn('autoHighlightNextStep: 自动滚动到下一步骤失败:', scrollErr);
      }
    }

    this._updateHeaderImage(steps, nextIndex);

    // 同步刷新统计信息与并行任务列表
    this.updateTimelineProgress(steps);
    this.checkParallelCompletion(steps);
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
          wx.removeStorageSync(stepsStorageKey());
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

    // 根据最新进度，自动高亮下一步、滚动并刷新头图/阶段/并行提示
    this.autoHighlightNextStep();

    // 在用户开始执行步骤后检测是否存在缺料情况，必要时触发线性降级
    var missingResult = this.checkMissingIngredients();
    if (missingResult && missingResult.hasMissing) {
      this.triggerFallback(missingResult);
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
