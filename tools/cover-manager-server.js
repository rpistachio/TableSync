#!/usr/bin/env node
/**
 * 封面图管理本地服务：预览所有成人菜封面，勾选后重生成并上传云端。
 * 启动：node tools/cover-manager-server.js
 * 浏览器打开 http://localhost:3847
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { CONFIG } from './config.js';
import { uploadAdultRecipeImage } from './lib/cloud-uploader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

const PORT = 3847;
const CLOUD_HTTP_ROOT = 'https://636c-cloud1-7g5mdmib90e9f670-1401654193.tcb.qcloud.la';
const ADULTS_BASE = `${CLOUD_HTTP_ROOT}/adults_recipes`;
const RATE_LIMIT_MS = 1500;

function getRefImagesPath() {
  const draftsDir = path.isAbsolute(CONFIG.draftsDir)
    ? CONFIG.draftsDir
    : path.join(__dirname, CONFIG.draftsDir);
  return path.join(draftsDir, 'ref-images.json');
}

function getCustomPromptsPath() {
  const draftsDir = path.isAbsolute(CONFIG.draftsDir)
    ? CONFIG.draftsDir
    : path.join(__dirname, CONFIG.draftsDir);
  return path.join(draftsDir, 'custom-prompts.json');
}

function loadCustomPrompts() {
  const p = getCustomPromptsPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

function saveCustomPrompts(data) {
  const p = getCustomPromptsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

/** 持久化参考图：key = slug 的 baseName（无扩展名），value = 图片 URL */
function loadRefImages() {
  const p = getRefImagesPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

function saveRefImages(data) {
  const p = getRefImagesPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

const AUDIT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getAuditCachePath() {
  const draftsDir = path.isAbsolute(CONFIG.draftsDir)
    ? CONFIG.draftsDir
    : path.join(__dirname, CONFIG.draftsDir);
  return path.join(draftsDir, 'audit-cache.json');
}

function loadAuditCache() {
  const p = getAuditCachePath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

function saveAuditCache(data) {
  const p = getAuditCachePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const out = { generatedAt: new Date().toISOString(), byDish: data };
  fs.writeFileSync(p, JSON.stringify(out, null, 2), 'utf8');
}

function getImageBase64(imageUrl, imagesDir) {
  if (imageUrl.startsWith('/images/')) {
    const filename = imageUrl.replace(/^\/images\//, '').split('?')[0];
    const localPath = path.join(imagesDir, filename);
    if (fs.existsSync(localPath)) {
      const buf = fs.readFileSync(localPath);
      return Promise.resolve(buf.toString('base64'));
    }
    return Promise.resolve(null);
  }
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return new Promise((resolve, reject) => {
      const mod = imageUrl.startsWith('https://') ? https : require('http');
      mod.get(imageUrl, { timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      }).on('error', reject);
    });
  }
  return Promise.resolve(null);
}

function loadSlugMap() {
  const slugsPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipeCoverSlugs.js');
  const mod = require(slugsPath);
  return mod.RECIPE_NAME_TO_SLUG || {};
}

function getAdultEntries(slugMap) {
  const babyStart = '板栗鲜鸡泥';
  const names = Object.keys(slugMap);
  const idx = names.indexOf(babyStart);
  const adultNames = idx >= 0 ? names.slice(0, idx) : names;
  return adultNames.map((n) => ({ dishName: n, slug: slugMap[n] }));
}

function findRecipeByName(dishName) {
  const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
  const mod = require(recipesPath);
  const list = mod.adultRecipes || [];
  return list.find((r) => r && r.name === dishName) || null;
}

function getImagesDir() {
  return path.isAbsolute(CONFIG.draftsDir)
    ? path.join(CONFIG.draftsDir, 'images')
    : path.join(__dirname, CONFIG.draftsDir, 'images');
}

function getFixedImagePath(imagesDir, baseName) {
  const fixedDir = path.join(imagesDir, 'fixed');
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    const p = path.join(fixedDir, baseName + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getCandidatesDir() {
  return path.join(getImagesDir(), 'candidates');
}

async function regenOne(dishName, slug, refImageUrl, saveAsCandidate = false) {
  const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
  const imagesDir = getImagesDir();
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  // 蛋花汤等易被画成面条的菜：若在 fixed 目录放了同名图，直接使用，不调 API
  const fixedPath = getFixedImagePath(imagesDir, baseName);
  if (fixedPath) {
    const imagePath = saveAsCandidate
      ? path.join(getCandidatesDir(), `${baseName}.jpg`)
      : path.join(imagesDir, `${baseName}.jpg`);
    if (saveAsCandidate && !fs.existsSync(path.dirname(imagePath))) {
      fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    }
    fs.copyFileSync(fixedPath, imagePath);
    return { dishName, slug, path: imagePath };
  }

  const { buildPromptsForItem } = await import('./lib/mj-prompt-builder.js');
  const { generateImage } = await import('./lib/minimax-image.js');
  const apiKey = (CONFIG.minimaxApiKey || '').trim();
  if (!apiKey) throw new Error('未配置 MINIMAX_API_KEY');
  const customPrompts = loadCustomPrompts();
  let prompts = Array.isArray(customPrompts[baseName]) && customPrompts[baseName].length >= 1
    ? customPrompts[baseName].slice(0, 3)
    : null;
  if (!prompts || prompts.length === 0) {
    const recipe = findRecipeByName(dishName) || { name: dishName };
    const mjItem = { recipe, mj_prompts: [] };
    prompts = buildPromptsForItem(mjItem);
  }
  const prompt = prompts[1] || prompts[0];
  const host = (CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com')
    ? CONFIG.minimaxHost
    : 'api.minimax.io';
  const genOpts = { host, model: CONFIG.minimaxModel };
  if (refImageUrl && typeof refImageUrl === 'string' && refImageUrl.trim()) {
    genOpts.referenceImageUrl = refImageUrl.trim();
  }
  const buffer = await generateImage(apiKey, prompt, genOpts);
  const imagePath = saveAsCandidate
    ? path.join(getCandidatesDir(), `${baseName}.jpg`)
    : path.join(imagesDir, `${baseName}.jpg`);
  if (saveAsCandidate && !fs.existsSync(path.dirname(imagePath))) {
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  }
  fs.writeFileSync(imagePath, buffer);
  if (!saveAsCandidate) {
    const historyDir = path.join(imagesDir, 'history');
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
    const ts = Date.now();
    fs.writeFileSync(path.join(historyDir, `${baseName}_${ts}.jpg`), buffer);
  }
  return { dishName, slug, path: imagePath };
}

async function uploadOne(dishName, slug) {
  const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
  const imagesDir = getImagesDir();
  const localJpg = path.join(imagesDir, `${baseName}.jpg`);
  if (!fs.existsSync(localJpg)) throw new Error(`本地无图: ${baseName}.jpg`);
  await uploadAdultRecipeImage(localJpg, slug);
  return { dishName, slug };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const regenJobs = new Map();

function sendJobEvent(jobId, event) {
  const job = regenJobs.get(jobId);
  if (!job) return;
  job.events.push(event);
  if (job.res && !job.res.writableEnded) {
    job.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

async function handleRegen(dishNames, refImagesFromRequest = {}, saveAsCandidate = false, progressJobId = null) {
  const slugMap = loadSlugMap();
  const refImagesPersisted = loadRefImages();
  const ok = [];
  const failed = [];
  const total = dishNames.length;
  for (let i = 0; i < dishNames.length; i++) {
    const name = dishNames[i];
    const slug = slugMap[name];
    if (!slug) {
      failed.push({ dishName: name, error: '无 slug 映射' });
      if (progressJobId) sendJobEvent(progressJobId, { type: 'progress', done: i + 1, total, currentDish: name, error: '无 slug 映射' });
      continue;
    }
    const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
    const refUrl = refImagesFromRequest[name] || refImagesPersisted[baseName] || null;
    if (progressJobId) sendJobEvent(progressJobId, { type: 'progress', done: i, total, currentDish: name });
    try {
      await regenOne(name, slug, refUrl, saveAsCandidate);
      ok.push(name);
      if (progressJobId) sendJobEvent(progressJobId, { type: 'progress', done: i + 1, total, currentDish: name });
    } catch (e) {
      failed.push({ dishName: name, error: e.message });
      if (progressJobId) sendJobEvent(progressJobId, { type: 'progress', done: i + 1, total, currentDish: name, error: e.message });
    }
    await sleep(RATE_LIMIT_MS);
  }
  return { ok, failed };
}

async function handleUpload(dishNames) {
  const slugMap = loadSlugMap();
  const ok = [];
  const failed = [];
  for (const name of dishNames) {
    const slug = slugMap[name];
    if (!slug) {
      failed.push({ dishName: name, error: '无 slug 映射' });
      continue;
    }
    try {
      await uploadOne(name, slug);
      ok.push(name);
    } catch (e) {
      failed.push({ dishName: name, error: e.message });
    }
  }
  return { ok, failed };
}

async function handleAdopt(dishNames) {
  const slugMap = loadSlugMap();
  const imagesDir = getImagesDir();
  const candidatesDir = getCandidatesDir();
  const ok = [];
  const failed = [];
  for (const name of dishNames) {
    const slug = slugMap[name];
    if (!slug) {
      failed.push({ dishName: name, error: '无 slug 映射' });
      continue;
    }
    const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
    const candidatePath = path.join(candidatesDir, `${baseName}.jpg`);
    const mainPath = path.join(imagesDir, `${baseName}.jpg`);
    if (!fs.existsSync(candidatePath)) {
      failed.push({ dishName: name, error: '无候选图' });
      continue;
    }
    try {
      fs.copyFileSync(candidatePath, mainPath);
      fs.unlinkSync(candidatePath);
      await uploadOne(name, slug);
      ok.push(name);
    } catch (e) {
      failed.push({ dishName: name, error: e.message });
    }
  }
  return { ok, failed };
}

async function handleDiscard(dishNames) {
  const slugMap = loadSlugMap();
  const candidatesDir = getCandidatesDir();
  const ok = [];
  const failed = [];
  for (const name of dishNames) {
    const slug = slugMap[name];
    if (!slug) {
      failed.push({ dishName: name, error: '无 slug 映射' });
      continue;
    }
    const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
    const candidatePath = path.join(candidatesDir, `${baseName}.jpg`);
    try {
      if (fs.existsSync(candidatePath)) fs.unlinkSync(candidatePath);
      ok.push(name);
    } catch (e) {
      failed.push({ dishName: name, error: e.message });
    }
  }
  return { ok, failed };
}

function getHistoryList(baseName) {
  const historyDir = path.join(getImagesDir(), 'history');
  if (!fs.existsSync(historyDir)) return [];
  const files = fs.readdirSync(historyDir);
  const prefix = baseName + '_';
  const list = files
    .filter((f) => f.startsWith(prefix) && /\.(jpg|jpeg|png)$/i.test(f))
    .map((f) => {
      const m = f.match(/^(.+)_(\d+)\.(jpg|jpeg|png)$/i);
      const ts = m ? parseInt(m[2], 10) : 0;
      return { timestamp: ts, filename: f };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
  return list;
}

async function handleRestore(dishName, timestamp) {
  const slugMap = loadSlugMap();
  const slug = slugMap[dishName];
  if (!slug) return { ok: false, error: '无 slug 映射' };
  const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
  const historyDir = path.join(getImagesDir(), 'history');
  const historyPath = path.join(historyDir, `${baseName}_${timestamp}.jpg`);
  const mainPath = path.join(getImagesDir(), `${baseName}.jpg`);
  if (!fs.existsSync(historyPath)) return { ok: false, error: '历史文件不存在' };
  fs.copyFileSync(historyPath, mainPath);
  await uploadOne(dishName, slug);
  return { ok: true };
}

const AUDIT_RATE_LIMIT_MS = 2000;

async function handleAudit(dishNames) {
  const apiKey = (CONFIG.moonshotApiKey || '').trim();
  if (!apiKey) {
    return { ok: false, error: '未配置 MOONSHOT_API_KEY', results: [] };
  }
  const slugMap = loadSlugMap();
  const imagesDir = getImagesDir();
  const entries = dishNames && dishNames.length > 0
    ? dishNames.filter((n) => slugMap[n]).map((n) => ({ dishName: n, slug: slugMap[n] }))
    : getAdultEntries(slugMap).map(({ dishName, slug }) => ({ dishName, slug }));
  const { scoreImage } = await import('./lib/kimi-vision.js');
  const model = CONFIG.moonshotVisionModel || 'moonshot-v1-8k-vision-preview';
  const cache = loadAuditCache();
  const byDish = typeof cache.byDish === 'object' ? cache.byDish : {};
  const results = [];
  for (const { dishName, slug } of entries) {
    const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
    const localJpg = path.join(imagesDir, `${baseName}.jpg`);
    const useLocal = fs.existsSync(localJpg);
    const imageUrl = useLocal ? `/images/${baseName}.jpg` : `${ADULTS_BASE}/${encodeURIComponent(slug)}`;
    let base64;
    try {
      base64 = await getImageBase64(imageUrl, imagesDir);
    } catch (e) {
      results.push({ dishName, slug, error: e.message, overall: 0, verdict: 'fail', issues: [e.message] });
      await sleep(AUDIT_RATE_LIMIT_MS);
      continue;
    }
    if (!base64) {
      results.push({ dishName, slug, error: '无法获取图片', overall: 0, verdict: 'fail', issues: ['无法获取图片'] });
      await sleep(AUDIT_RATE_LIMIT_MS);
      continue;
    }
    try {
      const score = await scoreImage(apiKey, base64, dishName, { model });
      byDish[dishName] = score;
      results.push({ dishName, slug, ...score });
    } catch (e) {
      results.push({ dishName, slug, error: e.message, overall: 0, verdict: 'fail', issues: [e.message] });
    }
    await sleep(AUDIT_RATE_LIMIT_MS);
  }
  saveAuditCache(byDish);
  return { ok: true, results };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const APP_DIR = path.join(__dirname, 'cover-manager-app');

const LONG_REQUEST_MS = 15 * 60 * 1000;

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  if (req.method === 'POST' && (url === '/api/regen' || url === '/api/upload')) {
    req.setTimeout(LONG_REQUEST_MS);
    res.setTimeout(LONG_REQUEST_MS);
  }
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };

  if (req.method === 'OPTIONS') {
    setCors();
    res.writeHead(204);
    res.end();
    return;
  }

  // 本地图片：优先展示刚生成的图，避免 CDN 缓存
  const imagesDir = getImagesDir();
  const candidatesDir = getCandidatesDir();
  const imageMatch = url.match(/^\/images\/([a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png))$/);
  if (imageMatch) {
    const filename = imageMatch[1];
    const localPath = path.join(imagesDir, filename);
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Type', filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200);
      res.end(fs.readFileSync(localPath));
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const historyMatch = url.match(/^\/images\/history\/([a-zA-Z0-9_.-]+_\d+\.(?:jpg|jpeg|png))$/);
  if (historyMatch) {
    const filename = historyMatch[1];
    const historyDir = path.join(imagesDir, 'history');
    const localPath = path.join(historyDir, filename);
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200);
      res.end(fs.readFileSync(localPath));
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const candidateMatch = url.match(/^\/images\/candidates\/([a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png))$/);
  if (candidateMatch) {
    const filename = candidateMatch[1];
    const localPath = path.join(candidatesDir, filename);
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Type', filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200);
      res.end(fs.readFileSync(localPath));
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  if (url === '/api/recipes') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const slugMap = loadSlugMap();
      const entries = getAdultEntries(slugMap);
      const refImages = loadRefImages();
      const auditCache = loadAuditCache();
      const byDish = typeof auditCache.byDish === 'object' ? auditCache.byDish : {};
      const list = entries.map(({ dishName, slug }) => {
        const baseName = (slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
        const localJpg = path.join(imagesDir, `${baseName}.jpg`);
        const useLocal = fs.existsSync(localJpg);
        const imageUrl = useLocal
          ? `/images/${baseName}.jpg`
          : `${ADULTS_BASE}/${encodeURIComponent(slug)}`;
        const refImageUrl = refImages[baseName] || null;
        const audit = byDish[dishName] || null;
        const candidatePath = path.join(getCandidatesDir(), `${baseName}.jpg`);
        const hasCandidate = fs.existsSync(candidatePath);
        return { dishName, slug, imageUrl, refImageUrl, audit, hasCandidate };
      });
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: list }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/audit' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(LONG_REQUEST_MS);
    res.setTimeout(LONG_REQUEST_MS);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const dishNames = Array.isArray(body.dishNames) ? body.dishNames : null;
      const result = await handleAudit(dishNames);
      if (!result.ok) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: result.error || '审计失败' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, results: result.results }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/regen' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const dishNames = body.dishNames;
      const refImages = body.refImages && typeof body.refImages === 'object' ? body.refImages : {};
      const saveAsCandidate = !!body.saveAsCandidate;
      const streamProgress = !!body.streamProgress;
      if (!Array.isArray(dishNames) || dishNames.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 dishNames 数组' }));
        return;
      }
      if (streamProgress) {
        const jobId = `regen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        regenJobs.set(jobId, { events: [], res: null, status: 'running' });
        setImmediate(() => {
          handleRegen(dishNames, refImages, saveAsCandidate, jobId)
            .then((result) => {
              const job = regenJobs.get(jobId);
              if (job) {
                sendJobEvent(jobId, { type: 'done', ok: result.ok, failed: result.failed });
                job.status = 'done';
                job.result = result;
                if (job.res && !job.res.writableEnded) job.res.end();
              }
            })
            .catch((err) => {
              const job = regenJobs.get(jobId);
              if (job) {
                sendJobEvent(jobId, { type: 'done', ok: [], failed: [], error: err.message });
                job.status = 'done';
                if (job.res && !job.res.writableEnded) job.res.end();
              }
            });
        });
        res.writeHead(202);
        res.end(JSON.stringify({ ok: true, jobId }));
        return;
      }
      const result = await handleRegen(dishNames, refImages, saveAsCandidate);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/regen/stream' && req.method === 'GET') {
    setCors();
    const query = (req.url || '').split('?')[1] || '';
    const params = new URLSearchParams(query);
    const jobId = params.get('jobId') || '';
    const job = regenJobs.get(jobId);
    if (!job) {
      res.writeHead(404);
      res.end('Job not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    job.events.forEach((ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`));
    if (job.status === 'done') {
      res.end();
      return;
    }
    job.res = res;
    return;
  }

  if (url === '/api/ref-images' && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const data = loadRefImages();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/ref-images' && req.method === 'PUT') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const data = body.data && typeof body.data === 'object' ? body.data : body;
      saveRefImages(data);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/upload' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const { dishNames } = JSON.parse(raw || '{}');
      if (!Array.isArray(dishNames) || dishNames.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 dishNames 数组' }));
        return;
      }
      const result = await handleUpload(dishNames);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/adopt' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const { dishNames } = JSON.parse(raw || '{}');
      if (!Array.isArray(dishNames) || dishNames.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 dishNames 数组' }));
        return;
      }
      const result = await handleAdopt(dishNames);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/discard' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const { dishNames } = JSON.parse(raw || '{}');
      if (!Array.isArray(dishNames) || dishNames.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 dishNames 数组' }));
        return;
      }
      const result = await handleDiscard(dishNames);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  const promptsPathMatch = url.match(/^\/api\/prompts\/([a-zA-Z0-9_.-]+)$/);
  if (promptsPathMatch && req.method === 'GET') {
    setCors();
    const baseName = promptsPathMatch[1];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const customPrompts = loadCustomPrompts();
      let prompts = Array.isArray(customPrompts[baseName]) ? customPrompts[baseName].slice(0, 3) : null;
      let custom = !!prompts;
      if (!prompts || prompts.length === 0) {
        const slugMap = loadSlugMap();
        const dishName = Object.keys(slugMap).find((n) => (slugMap[n] || '').replace(/\.(png|jpg|jpeg)$/i, '') === baseName);
        const recipe = findRecipeByName(dishName || '') || { name: dishName || '未知' };
        const { buildPromptsForItem } = await import('./lib/mj-prompt-builder.js');
        prompts = buildPromptsForItem({ recipe, mj_prompts: [] });
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, prompts, custom }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/custom-prompts' && req.method === 'PUT') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { baseName, prompts } = body;
      if (!baseName || !Array.isArray(prompts)) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 baseName 和 prompts 数组' }));
        return;
      }
      const data = loadCustomPrompts();
      data[baseName] = prompts.slice(0, 3);
      saveCustomPrompts(data);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  const historyPathMatch = url.match(/^\/api\/history\/([a-zA-Z0-9_.-]+)$/);
  if (historyPathMatch && req.method === 'GET') {
    setCors();
    const baseName = historyPathMatch[1];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const list = getHistoryList(baseName);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: list }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/restore' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const { dishName, timestamp } = JSON.parse(raw || '{}');
      if (!dishName || !timestamp) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 dishName 和 timestamp' }));
        return;
      }
      const result = await handleRestore(dishName, timestamp);
      if (!result.ok) {
        res.writeHead(400);
        res.end(JSON.stringify(result));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/' || url === '/index.html') {
    const file = path.join(APP_DIR, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(fs.readFileSync(file, 'utf8'));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const FIXED_README = `# 固定封面图
将图片放在此目录，文件名与 recipeCoverSlugs 中的 slug 一致（扩展名 .jpg 或 .png）。
重生成时若存在同名文件则直接使用，不调用 MiniMax API。
例如：紫菜蛋花汤 → seaweed_and_egg_drop_soup.jpg
`;

server.listen(PORT, () => {
  const imagesDir = getImagesDir();
  const fixedDir = path.join(imagesDir, 'fixed');
  if (!fs.existsSync(fixedDir)) {
    fs.mkdirSync(fixedDir, { recursive: true });
    fs.writeFileSync(path.join(fixedDir, 'README.md'), FIXED_README, 'utf8');
  }
  console.log(`封面管理页: http://localhost:${PORT}`);
  console.log('API: GET /api/recipes, GET /images/:file.jpg, POST /api/regen, POST /api/upload');
  console.log('图片优先从本地 drafts/images 读取，无本地文件时回退云端');
  console.log(`固定图目录: ${fixedDir}（放入与 slug 同名的 jpg/png 则重生成时直接使用，不调 API）`);
});
