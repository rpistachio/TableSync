/**
 * 通用数据容错工具函数
 * 
 * 解决问题：
 * 1. 避免 null/undefined 导致的运行时错误
 * 2. 统一数据类型转换逻辑
 * 3. 消除各文件重复的容错代码
 * 
 * 使用方式：
 * const dataUtil = require('../../utils/dataUtil.js');
 * const arr = dataUtil.toArray(maybeNull);
 */

/**
 * 转换为数组（容错）
 * - null/undefined → []
 * - 已是数组 → 原样返回
 * - 其他值 → 包装为单元素数组
 * 
 * @param {*} value - 任意值
 * @param {Array} defaultValue - 默认值，默认为空数组
 * @returns {Array}
 * 
 * @example
 * toArray(null)           // []
 * toArray(undefined)      // []
 * toArray([1, 2, 3])      // [1, 2, 3]
 * toArray('hello')        // ['hello']
 * toArray(123)            // [123]
 * toArray(null, [1, 2])   // [1, 2]
 */
function toArray(value, defaultValue) {
  if (value == null) {
    return Array.isArray(defaultValue) ? defaultValue : [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

/**
 * 转换为字符串（容错）
 * - null/undefined → 默认值（默认空字符串）
 * - 数字/布尔 → String()
 * - 对象 → JSON.stringify（可选）或 '[object Object]'
 * - 已是字符串 → trim 后返回
 * 
 * @param {*} value - 任意值
 * @param {string} defaultValue - 默认值，默认为空字符串
 * @param {Object} options - 可选配置
 * @param {boolean} options.trim - 是否 trim，默认 true
 * @param {boolean} options.jsonify - 对象是否 JSON 序列化，默认 false
 * @returns {string}
 * 
 * @example
 * toString(null)              // ''
 * toString(undefined, '默认') // '默认'
 * toString(123)               // '123'
 * toString('  hello  ')       // 'hello'
 * toString({a: 1}, '', {jsonify: true}) // '{"a":1}'
 */
function toString(value, defaultValue, options) {
  var def = typeof defaultValue === 'string' ? defaultValue : '';
  var opts = options || {};
  var shouldTrim = opts.trim !== false;
  var shouldJsonify = opts.jsonify === true;
  
  if (value == null) {
    return def;
  }
  
  if (typeof value === 'string') {
    return shouldTrim ? value.trim() : value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    if (shouldJsonify) {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return def;
      }
    }
    return def;
  }
  
  return String(value);
}

/**
 * 转换为数字（容错）
 * - null/undefined → 默认值（默认 0）
 * - 已是数字 → 原样返回（可过滤 NaN/Infinity）
 * - 字符串 → parseFloat
 * - 其他 → 默认值
 * 
 * @param {*} value - 任意值
 * @param {number} defaultValue - 默认值，默认为 0
 * @param {Object} options - 可选配置
 * @param {number} options.min - 最小值限制
 * @param {number} options.max - 最大值限制
 * @param {boolean} options.integer - 是否取整，默认 false
 * @returns {number}
 * 
 * @example
 * toNumber(null)              // 0
 * toNumber(undefined, 10)     // 10
 * toNumber('123.45')          // 123.45
 * toNumber('abc')             // 0
 * toNumber(5, 0, {min: 1, max: 3}) // 3
 * toNumber(1.8, 0, {integer: true}) // 2
 */
function toNumber(value, defaultValue, options) {
  var def = typeof defaultValue === 'number' && isFinite(defaultValue) ? defaultValue : 0;
  var opts = options || {};
  
  var result;
  
  if (value == null) {
    result = def;
  } else if (typeof value === 'number') {
    result = isFinite(value) ? value : def;
  } else if (typeof value === 'string') {
    var parsed = parseFloat(value);
    result = isFinite(parsed) ? parsed : def;
  } else if (typeof value === 'boolean') {
    result = value ? 1 : 0;
  } else {
    result = def;
  }
  
  // 取整
  if (opts.integer === true) {
    result = Math.round(result);
  }
  
  // 范围限制
  if (typeof opts.min === 'number' && isFinite(opts.min)) {
    result = Math.max(opts.min, result);
  }
  if (typeof opts.max === 'number' && isFinite(opts.max)) {
    result = Math.min(opts.max, result);
  }
  
  return result;
}

/**
 * 安全获取嵌套对象属性（容错）
 * 避免 Cannot read property 'x' of undefined 错误
 * 
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径，如 'a.b.c'
 * @param {*} defaultValue - 默认值
 * @returns {*}
 * 
 * @example
 * const obj = { a: { b: { c: 1 } } };
 * safeGet(obj, 'a.b.c')       // 1
 * safeGet(obj, 'a.b.d', 0)    // 0
 * safeGet(null, 'a.b', 'x')   // 'x'
 */
function safeGet(obj, path, defaultValue) {
  if (obj == null || typeof path !== 'string') {
    return defaultValue;
  }
  
  var keys = path.split('.');
  var result = obj;
  
  for (var i = 0; i < keys.length; i++) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[keys[i]];
  }
  
  return result !== undefined ? result : defaultValue;
}

/**
 * 判断值是否为空（null/undefined/空字符串/空数组/空对象）
 * 
 * @param {*} value - 任意值
 * @returns {boolean}
 * 
 * @example
 * isEmpty(null)       // true
 * isEmpty(undefined)  // true
 * isEmpty('')         // true
 * isEmpty('  ')       // true（空白字符串视为空）
 * isEmpty([])         // true
 * isEmpty({})         // true
 * isEmpty(0)          // false（0 不视为空）
 * isEmpty(false)      // false
 */
function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 判断值是否不为空（isEmpty 的反向）
 * 
 * @param {*} value - 任意值
 * @returns {boolean}
 */
function isNotEmpty(value) {
  return !isEmpty(value);
}

module.exports = {
  toArray: toArray,
  toString: toString,
  toNumber: toNumber,
  safeGet: safeGet,
  isEmpty: isEmpty,
  isNotEmpty: isNotEmpty
};
