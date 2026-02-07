// cloudfunctions/recipeImport/lib/link-fetcher.js
// 小红书/抖音链接抓取 → 提取正文文本 + 图片

const https = require('https');
const http = require('http');

/** 支持的平台正则 */
const PLATFORM_PATTERNS = [
  { platform: 'xiaohongshu', regex: /xhslink\.com|xiaohongshu\.com/ },
  { platform: 'douyin', regex: /v\.douyin\.com|douyin\.com/ },
];

/** 最大跟踪重定向次数 */
const MAX_REDIRECTS = 5;
/** HTTP 请求超时（ms） */
const REQUEST_TIMEOUT = 15000;
/** 最大响应体大小（约 2MB） */
const MAX_BODY_SIZE = 2 * 1024 * 1024;

/**
 * 检测链接属于哪个平台
 * @param {string} url
 * @returns {string|null} 'xiaohongshu' | 'douyin' | null
 */
function detectPlatform(url) {
  if (!url || typeof url !== 'string') return null;
  for (let i = 0; i < PLATFORM_PATTERNS.length; i++) {
    if (PLATFORM_PATTERNS[i].regex.test(url)) return PLATFORM_PATTERNS[i].platform;
  }
  return null;
}

/**
 * 从 URL 抓取页面 HTML 文本
 * @param {string} url - 目标 URL
 * @returns {Promise<{ html: string, finalUrl: string, platform: string }>}
 */
async function fetchPageContent(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('[LinkFetcher] URL 不能为空');
  }

  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error('[LinkFetcher] 不支持的链接平台，目前支持小红书和抖音');
  }

  console.log(`[LinkFetcher] 开始抓取: ${url} (平台: ${platform})`);

  // 跟踪重定向，获取最终页面
  const finalUrl = await followRedirects(url);
  console.log(`[LinkFetcher] 最终 URL: ${finalUrl}`);

  // 抓取 HTML 内容
  const html = await httpGet(finalUrl);

  if (!html || html.length < 100) {
    throw new Error('[LinkFetcher] 页面内容为空或过短');
  }

  console.log(`[LinkFetcher] 抓取成功，HTML 长度: ${html.length}`);

  return { html, finalUrl, platform };
}

/**
 * 从 HTML 中提取正文文本（去除 HTML 标签、脚本、样式）
 * @param {string} html
 * @returns {string} 纯文本内容
 */
function extractTextFromHtml(html) {
  if (!html) return '';
  let text = html;

  // 移除 script 和 style 标签及内容
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 尝试提取 JSON-LD 数据（小红书和抖音常用此格式存放内容）
  const jsonLdBlocks = [];
  const jsonLdRegex = /<script[^>]*type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch;
  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(ldMatch[1]);
      if (data.name) jsonLdBlocks.push('菜名: ' + data.name);
      if (data.description) jsonLdBlocks.push('描述: ' + data.description);
      if (data.articleBody) jsonLdBlocks.push(data.articleBody);
    } catch (_) {}
  }

  // 尝试提取 meta description
  const metaDesc = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([\s\S]*?)["\'][^>]*>/i);
  if (metaDesc && metaDesc[1]) {
    jsonLdBlocks.push('描述: ' + metaDesc[1]);
  }

  // 尝试提取 og:description (小红书常用)
  const ogDesc = html.match(/<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([\s\S]*?)["\'][^>]*>/i);
  if (ogDesc && ogDesc[1]) {
    jsonLdBlocks.push('内容: ' + ogDesc[1]);
  }

  // 尝试提取 og:title
  const ogTitle = html.match(/<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([\s\S]*?)["\'][^>]*>/i);
  if (ogTitle && ogTitle[1]) {
    jsonLdBlocks.push('标题: ' + ogTitle[1]);
  }

  // 提取小红书/抖音特定的内容区域
  // 小红书笔记详情
  const xhsContent = html.match(/<div[^>]*class="[^"]*note-text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
  if (xhsContent) {
    xhsContent.forEach(function (block) {
      jsonLdBlocks.push(block.replace(/<[^>]+>/g, '').trim());
    });
  }

  // 尝试提取 window.__INITIAL_STATE__ (小红书 SPA 数据)
  const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*(?:<\/script>|;\s*\(function)/);
  if (initialStateMatch) {
    try {
      // 处理 undefined → null 以避免 JSON.parse 失败
      const cleaned = initialStateMatch[1].replace(/\bundefined\b/g, 'null');
      const stateObj = JSON.parse(cleaned);
      // 提取笔记内容
      const noteData = extractNoteFromState(stateObj);
      if (noteData) jsonLdBlocks.push(noteData);
    } catch (_) {
      console.warn('[LinkFetcher] 解析 __INITIAL_STATE__ 失败');
    }
  }

  // HTML 标签转换
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  // 移除剩余 HTML 标签
  text = text.replace(/<[^>]+>/g, '');
  // HTML 实体解码
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // 压缩多余空白
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  // 合并结构化数据和正文
  let combined = '';
  if (jsonLdBlocks.length > 0) {
    combined = jsonLdBlocks.join('\n\n') + '\n\n---\n\n';
  }
  combined += text;

  // 限制长度（避免 LLM token 过多）
  if (combined.length > 8000) {
    combined = combined.slice(0, 8000) + '\n...(内容过长，已截断)';
  }

  return combined;
}

/**
 * 从小红书 __INITIAL_STATE__ 中提取笔记内容
 */
function extractNoteFromState(state) {
  if (!state) return '';
  const parts = [];

  try {
    // 尝试不同的路径
    const note = state.note && state.note.noteDetailMap;
    if (note && typeof note === 'object') {
      const keys = Object.keys(note);
      for (let i = 0; i < keys.length; i++) {
        const n = note[keys[i]] && note[keys[i]].note;
        if (n) {
          if (n.title) parts.push('标题: ' + n.title);
          if (n.desc) parts.push('正文: ' + n.desc);
          if (n.user && n.user.nickname) parts.push('作者: @' + n.user.nickname);
        }
      }
    }
  } catch (_) {}

  return parts.join('\n');
}

/**
 * 跟踪 HTTP 重定向，返回最终 URL
 */
function followRedirects(url, depth) {
  depth = depth || 0;
  if (depth >= MAX_REDIRECTS) return Promise.resolve(url);

  return new Promise(function (resolve, reject) {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      method: 'HEAD',
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location;
        // 处理相对 URL
        if (next.startsWith('/')) {
          const parsed = new URL(url);
          next = parsed.protocol + '//' + parsed.host + next;
        }
        res.resume();
        resolve(followRedirects(next, depth + 1));
      } else {
        res.resume();
        resolve(url);
      }
    });
    req.on('error', function (err) {
      // 如果 HEAD 失败，尝试直接返回原 URL
      console.warn('[LinkFetcher] HEAD 请求失败，使用原 URL:', err.message);
      resolve(url);
    });
    req.on('timeout', function () {
      req.destroy();
      resolve(url);
    });
    req.end();
  });
}

/**
 * HTTP GET 请求，返回响应体文本
 */
function httpGet(url) {
  return new Promise(function (resolve, reject) {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'identity',
      },
    }, function (res) {
      // 处理重定向（GET 也可能遇到）
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(httpGet(res.headers.location));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('[LinkFetcher] HTTP ' + res.statusCode));
        return;
      }

      const chunks = [];
      let totalSize = 0;
      res.on('data', function (chunk) {
        totalSize += chunk.length;
        if (totalSize <= MAX_BODY_SIZE) chunks.push(chunk);
      });
      res.on('end', function () {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', function () {
      req.destroy();
      reject(new Error('[LinkFetcher] 请求超时'));
    });
  });
}

module.exports = { fetchPageContent, extractTextFromHtml, detectPlatform };
