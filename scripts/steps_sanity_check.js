/**
 * Steps 页面「断句/合并/序号/高亮」快速 sanity check（本地脚本）
 *
 * 运行：
 *   node scripts/steps_sanity_check.js
 */
/* eslint-disable no-console */

var menuData = require('../miniprogram/data/menuData.js');

// ---- 从 miniprogram/pages/steps/steps.js 同步拷贝的最小实现（避免依赖 Page/wx） ----
var KEY_ACTIONS = ['下锅', '打泥', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];
var KEY_ACTIONS_RE = new RegExp('(' + KEY_ACTIONS.join('|') + ')', 'g');
var KEY_ACTIONS_SET = (function () {
  var set = Object.create(null);
  for (var i = 0; i < KEY_ACTIONS.length; i++) {
    set[KEY_ACTIONS[i]] = true;
  }
  return set;
})();

function isBabyPortionLine(line) {
  if (!line || typeof line !== 'string') return false;
  return /宝宝/.test(line) && /分拨|分出/.test(line);
}

function isPureKeyActionText(text) {
  if (text == null) return false;
  var t = text.toString().trim();
  return !!(t && KEY_ACTIONS_SET[t]);
}

function extractPureKeyAction(text) {
  if (text == null) return '';
  var raw = text.toString();
  var s = raw.trim();
  if (!s) return '';
  s = s.replace(/^(?:[\u2460-\u2469]|\d+\.)\s+/, '');
  s = s.replace(/^(?:👨|👶)\s*/, '');
  s = s.replace(/^【[^】]{1,12}】\s*/, '');
  s = s.replace(/^(?:[✨🔥⏳🍼✅🔪]\s*)+/, '');
  s = s
    .replace(/^[：:\-•·\u00B7\s]+/, '')
    .replace(/[：:，,。．；;！？!?…\s]+$/, '')
    .trim();
  return KEY_ACTIONS_SET[s] ? s : '';
}

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

var ORDINAL_CIRCLED = '\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467\u2468\u2469';
function getOrdinalPrefix(n) {
  if (n >= 1 && n <= 10) return ORDINAL_CIRCLED[n - 1];
  return n + '.';
}

var MAX_PHRASES_PER_LINE = 6;
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
        var ch = k < s.length ? s.charAt(k) : '';
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
    var c = i < trimmed.length ? trimmed.charAt(i) : '';
    var isHardSep = c === '。' || c === '！' || c === '？' || c === '；' || c === '\n' || c === '\r';
    if (isHardSep || i === trimmed.length) {
      var seg = trimmed.slice(segStart, i);
      pushMaybeSplit(seg);
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

function renderLinesForDetailLine(line) {
  var displayLine = menuData.replaceVagueSeasoningInText ? menuData.replaceVagueSeasoningInText(line) : line;
  var phrasesRaw = splitIntoShortPhrases(displayLine);
  var phrasesNorm = mergeIsolatedActionPhrases(phrasesRaw);
  var phrases = mergeShortPhrases(phrasesNorm, 5);
  if (!phrases || phrases.length === 0) phrases = [displayLine];

  return phrases.map(function (p, idx) {
    var prefix = phrases.length > 1 ? getOrdinalPrefix(idx + 1) + ' ' : '';
    var fullText = prefix + p;
    var segs = highlightSegments(fullText);
    return {
      raw: fullText,
      segments: segs
    };
  });
}

function printCase(title, line) {
  console.log('\n=== ' + title + ' ===');
  console.log('输入: ' + line);
  var out = renderLinesForDetailLine(line);
  out.forEach(function (r, idx) {
    var segPreview = r.segments
      .map(function (s) { return (s.strong ? '[' + s.text + ']' : s.text); })
      .join('');
    console.log('  - 渲染行#' + (idx + 1) + ': ' + r.raw);
    console.log('    分段预览: ' + segPreview);
  });
}

function renderLinesForDetails(details) {
  var normalized = normalizeDetailsForView(details || []);
  var out = [];
  for (var i = 0; i < normalized.length; i++) {
    var line = normalized[i].text;
    out = out.concat(renderLinesForDetailLine(line));
  }
  return out;
}

function stripOrdinalPrefix(s) {
  return (s || '').toString().replace(/^(?:[\u2460-\u2469]|\d+\.)\s+/, '');
}

function assertNoIsolatedActionLines(title, lines) {
  for (var i = 0; i < lines.length; i++) {
    var raw = stripOrdinalPrefix(lines[i] && lines[i].raw);
    var t = (raw || '').toString().trim();
    if (isPureKeyActionText(t)) {
      throw new Error(title + ' 失败：检测到“孤立动词行” -> ' + JSON.stringify(lines[i].raw));
    }
  }
}

function assertContains(title, lines, needle) {
  for (var i = 0; i < lines.length; i++) {
    if ((lines[i].raw || '').indexOf(needle) !== -1) return;
  }
  throw new Error(title + ' 失败：未找到预期片段 ' + JSON.stringify(needle));
}

function printDetailsCase(title, details) {
  console.log('\n=== ' + title + ' ===');
  console.log('输入(details): ' + JSON.stringify(details));
  var out = renderLinesForDetails(details);
  out.forEach(function (r, idx) {
    var segPreview = r.segments
      .map(function (s) { return (s.strong ? '[' + s.text + ']' : s.text); })
      .join('');
    console.log('  - 渲染行#' + (idx + 1) + ': ' + r.raw);
    console.log('    分段预览: ' + segPreview);
  });
  return out;
}

// ---- 用例：覆盖 “、/，” 与短句合并 与 序号策略 与 高亮 ----
printCase('不在“、”处分句（应保持同一短句）', '葱、姜、蒜切末备用');
printCase('强标点断句（。！？；/换行）', '焯水去腥。捞出沥干；再下锅翻炒！');
printCase('长句>25 按中文逗号细分（不按“、”）', '加入生抽、淀粉、半勺油调成腌料，抓匀，静置10分钟后下锅翻炒至变色');
printCase('短句<5 合并进上一句（避免单独编号）', '翻炒，装盘');
printCase('只有 1 句不加序号（即使包含逗号但长度不超阈值）', '切片，备用');
printCase('高亮加粗：动作词应被拆段并标记 strong', '下锅翻炒至出香，焖5分钟后装盘');

// ---- 用例：覆盖 “孤立动词行/短句” 合并（避免出现单独一行的“蒸/切/炖”）----
var c1 = printDetailsCase('details 级合并：["蒸","8分钟后取出"] -> "蒸：8分钟后取出"', ['蒸', '8分钟后取出']);
assertNoIsolatedActionLines('details 级合并：孤立动词不应单独成行', c1);
assertContains('details 级合并：应合并为“动词：后一句”', c1, '蒸：8分钟');

var c3 = printDetailsCase('details 级合并（带前缀/标点）：["🔥 蒸：","8分钟后取出"]', ['🔥 蒸：', '8分钟后取出']);
assertNoIsolatedActionLines('details 级合并（带前缀/标点）：孤立动词不应单独成行', c3);
assertContains('details 级合并（带前缀/标点）：应合并为“动词：后一句”', c3, '蒸：8分钟');

var c2 = (function () {
  console.log('\n=== phrases 级合并：行内断句 "蒸\\n8分钟后取出" -> "蒸：8分钟后取出" ===');
  var out = renderLinesForDetailLine('蒸\n8分钟后取出');
  out.forEach(function (r, idx) {
    var segPreview = r.segments
      .map(function (s) { return (s.strong ? '[' + s.text + ']' : s.text); })
      .join('');
    console.log('  - 渲染行#' + (idx + 1) + ': ' + r.raw);
    console.log('    分段预览: ' + segPreview);
  });
  return out;
})();
assertNoIsolatedActionLines('phrases 级合并：孤立动词不应单独成行', c2);
assertContains('phrases 级合并：应合并为“动词：后一句”', c2, '蒸：8分钟');

console.log('\n（说明）分段预览里用 [动作词] 表示 seg.strong=true（对应 steps.wxml 的 detail-strong）。');
