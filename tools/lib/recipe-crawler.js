/**
 * 参考菜谱 HTTP 爬虫：下厨房、爱料理、美食杰、Cookpad、豆果美食
 * 输出标准化 RefRecipe 格式，供生成与校验使用。
 */

import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REQUEST_DELAY_MS = 800;

/**
 * @typedef {Object} RefRecipe
 * @property {string} source - "xiachufang" | "icook" | "meishij" | "cookpad" | "douguo"
 * @property {string} url
 * @property {string} title
 * @property {number} [rating]
 * @property {number} [likes]
 * @property {{ name: string, amount?: string }[]} ingredients
 * @property {{ index: number, text: string }[]} steps
 * @property {string} crawled_at
 */

/**
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<string>}
 */
async function fetchHtml(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...opts.headers
    },
    ...opts
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 下厨房：搜索并返回详情页链接（按热度取前几条）
 * @param {string} keyword
 * @param {number} maxResults
 * @returns {Promise<string[]>}
 */
async function xiachufangSearch(keyword, maxResults = 5) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://www.xiachufang.com/search/?keyword=${encoded}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="/recipe/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `https://www.xiachufang.com${href}`;
    const match = full.match(/\/recipe\/(\d+)/);
    if (match && !links.includes(full)) links.push(full);
  });
  return links.slice(0, maxResults);
}

/**
 * 下厨房：解析详情页
 * @param {string} url
 * @returns {Promise<Partial<RefRecipe>>}
 */
async function xiachufangParseDetail(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $('.page-title').text().trim() || $('h1').first().text().trim() || '';
  let rating = 0;
  const ratingEl = $('.score').first();
  if (ratingEl.length) {
    const r = parseFloat(ratingEl.text().trim());
    if (!Number.isNaN(r)) rating = r;
  }
  let likes = 0;
  $('a[href*="collect"], .collect, .fav').each((_, el) => {
    const t = $(el).text().replace(/\D/g, '');
    if (t) { const n = parseInt(t, 10); if (!Number.isNaN(n) && n > likes) likes = n; }
  });

  const ingredients = [];
  $('.ingredient-block .name, .ings tr td:first-child, [class*="ingredient"] .name').each((_, el) => {
    const name = $(el).text().trim();
    if (name) ingredients.push({ name, amount: '' });
  });
  if (ingredients.length === 0) {
    $('table.ingredients td, .ingredients li').each((_, el) => {
      const text = $(el).text().trim();
      const parts = text.split(/\s+/);
      const name = parts[0] || text;
      const amount = parts.slice(1).join(' ') || '';
      if (name) ingredients.push({ name, amount });
    });
  }

  const steps = [];
  $('.steps li, .step, [class*="step"] ol li, .recipe-step').each((i, el) => {
    const text = $(el).text().trim().replace(/^\d+[\.\s]*/, '');
    if (text) steps.push({ index: i + 1, text });
  });

  return {
    source: 'xiachufang',
    url,
    title: title || '未知菜名',
    rating: rating || undefined,
    likes: likes || undefined,
    ingredients,
    steps
  };
}

/**
 * 爱料理：搜索并返回详情页链接
 * @param {string} keyword
 * @param {number} maxResults
 * @returns {Promise<string[]>}
 */
async function icookSearch(keyword, maxResults = 5) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://icook.tw/search/${encoded}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="/recipes/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `https://icook.tw${href}`;
    if (/\/recipes\/\d+/.test(full) && !links.includes(full)) links.push(full);
  });
  return links.slice(0, maxResults);
}

/**
 * 爱料理：解析详情页
 * @param {string} url
 * @returns {Promise<Partial<RefRecipe>>}
 */
async function icookParseDetail(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $('h1.recipe-name, .recipe-title, h1').first().text().trim() || '';

  const ingredients = [];
  $('.ingredient-name, .ingredients-list li, [class*="ingredient"] .name').each((_, el) => {
    const name = $(el).text().trim();
    if (name) ingredients.push({ name, amount: '' });
  });
  if (ingredients.length === 0) {
    $('.ingredients li, table.ingredients td').each((_, el) => {
      const text = $(el).text().trim();
      const [name, ...rest] = text.split(/\s+/);
      if (name) ingredients.push({ name, amount: rest.join(' ') || '' });
    });
  }

  const steps = [];
  $('.step-content, .recipe-steps li, .steps li, [class*="step"]').each((i, el) => {
    const text = $(el).text().trim().replace(/^\d+[\.\s]*/, '');
    if (text) steps.push({ index: i + 1, text });
  });

  return {
    source: 'icook',
    url,
    title: title || '未知菜名',
    ingredients,
    steps
  };
}

// ─── 美食杰 meishij.net ─────────────────────────────────

async function meishijSearch(keyword, maxResults = 5) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://so.meishij.net/index.php?q=${encoded}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="meishij.net/zuofa/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `https://www.meishij.net${href}`;
    if (!links.includes(full)) links.push(full);
  });
  if (links.length === 0) {
    $('a[href*="/zuofa/"], .listtyle1 a, .indexlist a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || !href.includes('zuofa')) return;
      const full = href.startsWith('http') ? href : `https://www.meishij.net${href}`;
      if (!links.includes(full)) links.push(full);
    });
  }
  return links.slice(0, maxResults);
}

async function meishijParseDetail(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('.recipe_title').text().trim() || '';

  const ingredients = [];
  $('.recipe_ingredients .ingredient, .recipe_ingredients li, .yl_zl_list li, .materials_list li').each((_, el) => {
    const nameEl = $(el).find('.yl_zl_cai, .ingredient_name, h4, span').first();
    const amountEl = $(el).find('.yl_zl_unit, .ingredient_unit, .unit').first();
    const name = nameEl.length ? nameEl.text().trim() : $(el).text().trim().split(/\s+/)[0];
    const amount = amountEl.length ? amountEl.text().trim() : '';
    if (name && name.length < 20) ingredients.push({ name, amount });
  });
  if (ingredients.length === 0) {
    $('.recipe_ingredientscontent a, .ingredient a').each((_, el) => {
      const name = $(el).text().trim();
      if (name) ingredients.push({ name, amount: '' });
    });
  }

  const steps = [];
  $('.recipe_step .step_content, .recipe_step li, .stepbox .step_text, .edit_step_content').each((i, el) => {
    const text = $(el).text().trim().replace(/^\d+[\.\s、]*/, '');
    if (text && text.length > 2) steps.push({ index: i + 1, text });
  });
  if (steps.length === 0) {
    $('.step_content, .content .text').each((i, el) => {
      const text = $(el).text().trim().replace(/^\d+[\.\s、]*/, '');
      if (text && text.length > 2) steps.push({ index: i + 1, text });
    });
  }

  return { source: 'meishij', url, title: title || '未知菜名', ingredients, steps };
}

// ─── Cookpad (中文版) ───────────────────────────────────

async function cookpadSearch(keyword, maxResults = 5) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://cookpad.com/cn/search/${encoded}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="/recipes/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `https://cookpad.com${href}`;
    if (/\/recipes\/\d+/.test(full) && !links.includes(full)) links.push(full);
  });
  return links.slice(0, maxResults);
}

async function cookpadParseDetail(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('[class*="recipe-title"]').text().trim() || '';

  const ingredients = [];
  $('[class*="ingredient"] li, .ingredient-list li, #ingredients li, #ingredients_list li').each((_, el) => {
    const nameEl = $(el).find('.ingredient-name, [class*="name"], span').first();
    const amountEl = $(el).find('.ingredient-quantity, [class*="quantity"], bdi').first();
    const name = nameEl.length ? nameEl.text().trim() : $(el).text().trim().split(/\s+/)[0];
    const amount = amountEl.length ? amountEl.text().trim() : '';
    if (name && name.length < 30) ingredients.push({ name, amount });
  });

  const steps = [];
  $('[class*="step"] p, .step-text, #steps li .step-description, #steps li p, .step_text').each((i, el) => {
    const text = $(el).text().trim().replace(/^\d+[\.\s、]*/, '');
    if (text && text.length > 2) steps.push({ index: i + 1, text });
  });

  return { source: 'cookpad', url, title: title || '未知菜名', ingredients, steps };
}

// ─── 豆果美食 douguo.com ─────────────────────────────────

async function douguoSearch(keyword, maxResults = 5) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://www.douguo.com/search/recipe/${encoded}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="/cookbook/"], .cook-list a, .cookshow a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const full = href.startsWith('http') ? href : `https://www.douguo.com${href}`;
    if (/\/cookbook\/\d+/.test(full) && !links.includes(full)) links.push(full);
  });
  return links.slice(0, maxResults);
}

async function douguoParseDetail(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || $('.cookname').text().trim() || '';

  const ingredients = [];
  $('.zl-item, .material_list li, .materials .item, .recipe-ingredients li').each((_, el) => {
    const nameEl = $(el).find('.zl-name, .name, h4, a').first();
    const amountEl = $(el).find('.zl-unit, .unit, span:last-child').first();
    const name = nameEl.length ? nameEl.text().trim() : $(el).text().trim().split(/\s+/)[0];
    const amount = amountEl.length ? amountEl.text().trim() : '';
    if (name && name.length < 20) ingredients.push({ name, amount });
  });
  if (ingredients.length === 0) {
    $('.ingredients a, .zl a').each((_, el) => {
      const name = $(el).text().trim();
      if (name) ingredients.push({ name, amount: '' });
    });
  }

  const steps = [];
  $('.step-item .step-text, .steps .step .content, .step-content, .recipe-step .text').each((i, el) => {
    const text = $(el).text().trim().replace(/^\d+[\.\s、]*/, '');
    if (text && text.length > 2) steps.push({ index: i + 1, text });
  });
  if (steps.length === 0) {
    $('.recipeStep_content, .step_text').each((i, el) => {
      const text = $(el).text().trim().replace(/^\d+[\.\s、]*/, '');
      if (text && text.length > 2) steps.push({ index: i + 1, text });
    });
  }

  return { source: 'douguo', url, title: title || '未知菜名', ingredients, steps };
}

// ─── 统一爬取入口 ────────────────────────────────────────

const SITE_CRAWLERS = {
  xiachufang: { search: xiachufangSearch, parse: xiachufangParseDetail, label: '下厨房' },
  icook: { search: icookSearch, parse: icookParseDetail, label: '爱料理' },
  meishij: { search: meishijSearch, parse: meishijParseDetail, label: '美食杰' },
  cookpad: { search: cookpadSearch, parse: cookpadParseDetail, label: 'Cookpad' },
  douguo: { search: douguoSearch, parse: douguoParseDetail, label: '豆果美食' },
};

/**
 * 爬取指定关键词的参考菜谱
 * @param {string} keyword - 菜名或关键词
 * @param {{ maxPerSite?: number, sites?: string[] }} [options]
 * @returns {Promise<RefRecipe[]>}
 */
export async function crawlRefRecipes(keyword, options = {}) {
  const { maxPerSite = 3, sites = ['xiachufang', 'icook', 'meishij', 'cookpad', 'douguo'] } = options;
  const results = [];
  const now = new Date().toISOString();

  for (const siteKey of sites) {
    const crawler = SITE_CRAWLERS[siteKey];
    if (!crawler) continue;
    try {
      const links = await crawler.search(keyword, maxPerSite);
      for (const link of links) {
        await delay(REQUEST_DELAY_MS);
        try {
          const partial = await crawler.parse(link);
          results.push({ ...partial, crawled_at: now });
        } catch (e) {
          console.warn(`[recipe-crawler] ${crawler.label}详情解析失败 ${link}:`, e.message);
        }
      }
    } catch (e) {
      console.warn(`[recipe-crawler] ${crawler.label}搜索失败:`, e.message);
    }
  }

  return results.map((r) => ({
    source: r.source,
    url: r.url,
    title: r.title,
    rating: r.rating,
    likes: r.likes,
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    steps: Array.isArray(r.steps) ? r.steps : [],
    crawled_at: r.crawled_at || now
  }));
}

export default { crawlRefRecipes };
