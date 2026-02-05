/**
 * TableSync Steps 逻辑辅助函数
 */
var recipeResources = require('../data/recipeResources.js');
var menuData = require('../data/menuData.js');

var KEY_ACTIONS = ['下锅', '打泥', '切', '炒', '煮', '蒸', '煎', '搅拌', '焯水', '腌制', '加盐', '装盘', '翻炒', '焖', '烤', '炖', '剁'];
var KEY_ACTIONS_RE = new RegExp('(' + KEY_ACTIONS.join('|') + ')', 'g');
var SEASONING_NAMES = ['生抽', '老抽', '料酒', '蚝油', '盐', '酱油', '醋', '糖', '淀粉', '姜片', '蒜', '葱'];
var AMOUNT_RE = /(少许|适量|一点|半勺|一勺|1勺|2勺|少量)\s*$/;
var ORDINAL_CIRCLED = '\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467\u2468\u2469';

/** 语法高亮：关键词加粗 */
function highlightSegments(text) {
  if (!text || typeof text !== 'string') return [{ text: String(text), strong: false }];
  var parts = text.split(KEY_ACTIONS_RE);
  if (parts.length <= 1) return [{ text: text, strong: false }];
  var segments = [];
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    segments.push({ text: parts[i], strong: i % 2 === 1 });
  }
  return segments;
}

/** 步骤标签识别 */
function getStepTag(step) {
  if (step.role === 'baby') return '宝宝餐';
  if (step.role === 'adult') return '成人餐';
  if (step.role === 'both') return '成人+宝宝';
  var t = (step.title || '').toString();
  if (/宝宝|辅食/.test(t)) return '宝宝餐';
  if (/成人|主菜/.test(t)) return '成人餐';
  if (/联合|并行|分锅|收尾/.test(t)) return '成人+宝宝';
  return '';
}

/** 拆分长句为带序号的短句 */
function splitIntoShortPhrases(text) {
  if (!text || typeof text !== 'string') return [];
  var trimmed = text.trim();
  var parts = trimmed.split(/[。！？；\n]+/);
  var result = [];
  var MAX_PHRASES = 6;
  
  for (var i = 0; i < parts.length && result.length < MAX_PHRASES; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    // 如果句子过长，按逗号进一步拆分
    if (p.length > 18 && /[，、]/.test(p)) {
      var clauses = p.split(/[，、]+/);
      for (var j = 0; j < clauses.length && result.length < MAX_PHRASES; j++) {
        if (clauses[j].trim()) result.push(clauses[j].trim());
      }
    } else {
      result.push(p);
    }
  }
  return result;
}

/** 提取刀工描述 */
function extractKnifeWork(details) {
  if (!Array.isArray(details)) return '';
  var full = details.join('');
  var m = full.match(/切(成)?(大?)(块|片|丁|丝|段|末)/);
  return m ? '切' + m[3] : '';
}

/** 提取调料 */
function extractSeasonings(details) {
  if (!Array.isArray(details)) return [];
  var full = details.join('');
  var list = [];
  for (var i = 0; i < SEASONING_NAMES.length && list.length < 8; i++) {
    var name = SEASONING_NAMES[i];
    var idx = full.indexOf(name);
    if (idx === -1) continue;
    var before = full.slice(Math.max(0, idx - 12), idx);
    var amount = AMOUNT_RE.test(before) ? before.match(AMOUNT_RE)[1] : '适量';
    list.push({ name: name, amount: amount });
  }
  return list;
}

/** 获取序号图标 */
function getOrdinal(n) {
  return (n >= 1 && n <= 10) ? ORDINAL_CIRCLED[n - 1] : n + '.';
}

module.exports = {
  highlightSegments: highlightSegments,
  getStepTag: getStepTag,
  splitIntoShortPhrases: splitIntoShortPhrases,
  extractKnifeWork: extractKnifeWork,
  extractSeasonings: extractSeasonings,
  getOrdinal: getOrdinal
};