#!/usr/bin/env node
/**
 * 统一菜谱管理本地服务：菜谱生成、步骤校验、封面图管理。
 * 启动：node tools/recipe-manager-server.js
 * 浏览器打开 http://localhost:3847
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from './config.js';
import { uploadAdultRecipeImage } from './lib/cloud-uploader.js';
import { insertAdultRecipeToCloud } from './lib/cloud-db.js';
import { applyLocalPatches } from './lib/local-file-patcher.js';

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

function getRefRecipesPath() {
  const draftsDir = path.isAbsolute(CONFIG.draftsDir)
    ? CONFIG.draftsDir
    : path.join(__dirname, CONFIG.draftsDir);
  return path.join(draftsDir, 'ref-recipes.json');
}

function loadRefRecipes() {
  const p = getRefRecipesPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

function saveRefRecipes(data) {
  const p = getRefRecipesPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function getDraftsDir() {
  return path.isAbsolute(CONFIG.draftsDir)
    ? CONFIG.draftsDir
    : path.join(__dirname, CONFIG.draftsDir);
}

function listDraftFiles() {
  const dir = getDraftsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && (f.includes('batch') || f.includes('_batch') || f.match(/^\d{4}-\d{2}-\d{2}/)))
    .sort((a, b) => b.localeCompare(a));
}

const generateJobs = new Map();
const reviewJobs = new Map();
const spiderJobs = new Map();

function sendGenerateJobEvent(jobId, event) {
  const job = generateJobs.get(jobId);
  if (!job) return;
  job.events.push(event);
  if (job.res && !job.res.writableEnded) {
    job.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

function sendReviewJobEvent(jobId, event) {
  const job = reviewJobs.get(jobId);
  if (!job) return;
  job.events.push(event);
  if (job.res && !job.res.writableEnded) {
    job.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

function sendSpiderJobEvent(jobId, event) {
  const job = spiderJobs.get(jobId);
  if (!job) return;
  job.events.push(event);
  if (job.res && !job.res.writableEnded) {
    job.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
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

const APP_DIR = path.join(__dirname, 'recipe-manager-app');

const LONG_REQUEST_MS = 15 * 60 * 1000;

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';
  if (req.method === 'POST' && (url === '/api/regen' || url === '/api/upload')) {
    req.setTimeout(LONG_REQUEST_MS);
    res.setTimeout(LONG_REQUEST_MS);
  }
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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

  if (url === '/api/drafts' && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const files = listDraftFiles();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: files }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  const draftFileMatch = url.match(/^\/api\/draft\/([a-zA-Z0-9_.-]+\.json)$/);
  if (draftFileMatch && req.method === 'GET') {
    setCors();
    const filename = draftFileMatch[1];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const draftPath = path.join(getDraftsDir(), filename);
      if (!fs.existsSync(draftPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '草稿不存在' }));
        return;
      }
      const raw = fs.readFileSync(draftPath, 'utf8');
      const data = JSON.parse(raw);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/ref-recipes' && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const data = loadRefRecipes();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/ref-recipes' && req.method === 'PUT') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const data = body.data && typeof body.data === 'object' ? body.data : body;
      saveRefRecipes(data);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/crawl' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const { keyword, sites } = JSON.parse(raw || '{}');
      if (!keyword || typeof keyword !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 keyword' }));
        return;
      }
      const { crawlRefRecipes } = await import('./lib/recipe-crawler.js');
      const crawlOpts = { maxPerSite: 3 };
      if (Array.isArray(sites) && sites.length > 0) crawlOpts.sites = sites;
      const refs = await crawlRefRecipes(keyword, crawlOpts);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: refs }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/spider/gaps' && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const {
        loadRecipes,
        buildMatrix,
        findMatrixGaps,
        findCookTypeGaps,
        MEATS,
        ADULT_TASTES,
        FLAVORS,
      } = await import('./batch-planner.js');
      const { adults } = await loadRecipes(false);
      const seen = new Set();
      const unique = adults.filter((r) => {
        if (!r || !r.name || seen.has(r.name)) return false;
        seen.add(r.name);
        return true;
      });
      const { matrix, cookMatrix } = buildMatrix(unique);
      const matrixGaps = findMatrixGaps(matrix);
      const cookTypeGaps = findCookTypeGaps(cookMatrix);
      const totalCells = MEATS.length * ADULT_TASTES.length * FLAVORS.length;
      const emptyCells = matrixGaps.filter((g) => g.count === 0).length;
      const sparseCells = matrixGaps.filter((g) => g.count === 1).length;
      const covered = totalCells - emptyCells;
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          gaps: matrixGaps.filter((g) => g.priority > 0),
          cook_type_gaps: cookTypeGaps.filter((g) => g.count === 0),
          stats: {
            total: unique.length,
            totalCells,
            covered,
            empty: emptyCells,
            sparse: sparseCells,
          },
        })
      );
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/spider/fuse' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(120000);
    res.setTimeout(120000);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { dishHint, constraints } = body;
      if (!dishHint || typeof dishHint !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 dishHint' }));
        return;
      }
      const { fuseOneRecipe } = await import('./recipe-fusion-spider.js');
      const result = await fuseOneRecipe(dishHint, constraints || {}, { autoReview: true });
      const recipe = result.recipe;

      if (!recipe.id) {
        const meat = recipe.meat || 'vegetable';
        const prefixMap = { chicken: 'a-chi', pork: 'a-pork', beef: 'a-beef', fish: 'a-fish', shrimp: 'a-shrimp', lamb: 'a-lamb', duck: 'a-duck', shellfish: 'a-shell', vegetable: 'a-veg' };
        const prefix = prefixMap[meat] || 'a-veg';
        recipe.id = `${prefix}-fuse-${Date.now()}`;
      }
      if (!recipe.type) recipe.type = 'adult';

      const recipeName = recipe.name || dishHint;
      const slugFileName = recipeName.replace(/\s+/g, '_') + '.png';
      const slug = { [recipeName]: slugFileName };

      let mj_prompts = [];
      try {
        const { buildPromptsForItem } = await import('./lib/mj-prompt-builder.js');
        mj_prompts = buildPromptsForItem({ recipe, mj_prompts: [] });
      } catch (_) {}

      const draft = {
        status: 'pending_review',
        recipe,
        slug,
        mj_prompts,
        selected_prompt_index: null,
        image_file: null,
        ref_recipes: result.refRecipes,
        review: result.review,
        fusedAt: result.fusedAt,
      };
      const draftsPath = path.join(getDraftsDir(), 'draft_recipes.json');
      let drafts = [];
      if (fs.existsSync(draftsPath)) {
        try {
          drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
        } catch (_) {}
      }
      if (!Array.isArray(drafts)) drafts = [];
      drafts.push(draft);
      if (!fs.existsSync(getDraftsDir())) fs.mkdirSync(getDraftsDir(), { recursive: true });
      fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2), 'utf8');
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          message: `${result.recipe.name} 融合完毕，已入草稿箱`,
          data: { recipe: result.recipe, review: result.review },
        })
      );
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/spider/batch' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const count = Math.max(1, Math.min(50, parseInt(body.count, 10) || 10));
      const intervalMs = body.intervalMs || 120000;
      const autoReview = body.autoReview !== false;
      const focus = body.focus || 'all';
      const jobId = `spider-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      spiderJobs.set(jobId, { events: [], res: null, status: 'running' });
      setImmediate(async () => {
        try {
          const {
            loadRecipes,
            buildMatrix,
            findMatrixGaps,
            findCookTypeGaps,
            generateBatchPlan,
            MEAT_CN,
            TASTE_CN,
            FLAVOR_CN,
            COOK_CN,
          } = await import('./batch-planner.js');
          const { fuseBatch, gapToSlot } = await import('./recipe-fusion-spider.js');
          const { adults } = await loadRecipes(false);
          const seen = new Set();
          const unique = adults.filter((r) => {
            if (!r || !r.name || seen.has(r.name)) return false;
            seen.add(r.name);
            return true;
          });
          const { matrix, cookMatrix } = buildMatrix(unique);
          const matrixGaps = findMatrixGaps(matrix);
          const cookTypeGaps = findCookTypeGaps(cookMatrix);
          const babyGaps = [];
          const batches = generateBatchPlan(matrixGaps, cookTypeGaps, babyGaps, {
            batchSize: Math.max(count, 20),
            maxBatches: 6,
            focus,
          });
          const labelMap = { MEAT_CN, TASTE_CN, FLAVOR_CN, COOK_CN };
          const slots = [];
          for (const batch of batches) {
            for (const s of batch.slots || []) {
              slots.push(
                gapToSlot(
                  {
                    meat: s.meat,
                    taste: s.taste,
                    flavor: s.flavor_profile,
                    cook_type: s.cook_type,
                    hint: s.hint,
                  },
                  labelMap
                )
              );
              if (slots.length >= count) break;
            }
            if (slots.length >= count) break;
          }
          const toRun = slots.slice(0, count);
          const result = await fuseBatch(toRun, {
            intervalMs,
            autoReview,
            draftsDir: getDraftsDir(),
            onProgress: (ev) => {
              sendSpiderJobEvent(jobId, {
                type: 'progress',
                done: ev.done,
                total: ev.total,
                currentDish: ev.currentDish,
                recipe: ev.recipe,
                error: ev.error,
              });
            },
          });
          sendSpiderJobEvent(jobId, { type: 'done', filename: result.filename, stats: result.stats });
        } catch (err) {
          sendSpiderJobEvent(jobId, { type: 'done', ok: false, error: err.message });
        }
        const job = spiderJobs.get(jobId);
        if (job) {
          job.status = 'done';
          if (job.res && !job.res.writableEnded) job.res.end();
        }
      });
      res.writeHead(202);
      res.end(JSON.stringify({ ok: true, jobId }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/spider/batch/stream' && req.method === 'GET') {
    setCors();
    const query = (req.url || '').split('?')[1] || '';
    const params = new URLSearchParams(query);
    const jobId = params.get('jobId') || '';
    const job = spiderJobs.get(jobId);
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

  if (url === '/api/spider/draft-recipes' && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const draftsPath = path.join(getDraftsDir(), 'draft_recipes.json');
      let drafts = [];
      if (fs.existsSync(draftsPath)) {
        try {
          drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
        } catch (_) {}
      }
      if (!Array.isArray(drafts)) drafts = [];
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: drafts }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/spider/approve-draft' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(120000);
    res.setTimeout(120000);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const index = body.index;
      const withCover = !!body.withCover;
      if (typeof index !== 'number' || index < 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 index（数字）' }));
        return;
      }
      const draftsPath = path.join(getDraftsDir(), 'draft_recipes.json');
      if (!fs.existsSync(draftsPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '草稿箱为空' }));
        return;
      }
      let drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
      if (!Array.isArray(drafts) || !drafts[index]) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '无效 index' }));
        return;
      }
      const item = drafts[index];
      const recipe = item.recipe;
      if (!recipe || !recipe.name) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '草稿项缺少 recipe 或 name' }));
        return;
      }
      if (!recipe.id) {
        const meat = recipe.meat || 'vegetable';
        const prefixMap = { chicken: 'a-chi', pork: 'a-pork', beef: 'a-beef', fish: 'a-fish', shrimp: 'a-shrimp', lamb: 'a-lamb', duck: 'a-duck', shellfish: 'a-shell', vegetable: 'a-veg' };
        const prefix = prefixMap[meat] || 'a-veg';
        recipe.id = `${prefix}-fuse-${Date.now()}`;
      }
      if (!recipe.type) recipe.type = 'adult';
      const slugMap = item.slug || { [recipe.name]: `${(recipe.name || '').replace(/\s+/g, '_')}.png` };

      let fileID = null;
      if (withCover) {
        if (!item.mj_prompts || !Array.isArray(item.mj_prompts) || item.mj_prompts.length === 0) {
          const { buildPromptsForItem } = await import('./lib/mj-prompt-builder.js');
          item.mj_prompts = buildPromptsForItem({ recipe, mj_prompts: [] });
        }
        const promptIndex = item.selected_prompt_index != null ? item.selected_prompt_index : 0;
        const prompt = item.mj_prompts[promptIndex] || item.mj_prompts[0];
        const apiKey = (CONFIG.minimaxApiKey || '').trim();
        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: '未配置 MINIMAX_API_KEY，无法生成封面' }));
          return;
        }
        const { generateImage } = await import('./lib/minimax-image.js');
        const host = (CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com') ? CONFIG.minimaxHost : 'api.minimax.io';
        const buffer = await generateImage(apiKey, prompt, { host, model: CONFIG.minimaxModel });
        const imagesDir = getImagesDir();
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        const slugFileName = Object.values(slugMap)[0] || `${recipe.name}.png`;
        const baseName = slugFileName.replace(/\.(png|jpg|jpeg)$/i, '');
        const imagePath = path.join(imagesDir, `${baseName}.jpg`);
        fs.writeFileSync(imagePath, buffer);
        fileID = await uploadAdultRecipeImage(imagePath, slugFileName);
      }

      const doc = fileID ? { ...recipe, coverFileID: fileID } : recipe;
      await insertAdultRecipeToCloud(doc);
      applyLocalPatches({ recipe: doc, slug: slugMap });
      drafts.splice(index, 1);
      fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2), 'utf8');
      const msg = withCover ? '已生成封面、入库并更新本地' : '已入库并更新本地';
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, message: msg }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/spider/discard-draft' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const index = body.index;
      if (typeof index !== 'number' || index < 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 index' }));
        return;
      }
      const draftsPath = path.join(getDraftsDir(), 'draft_recipes.json');
      if (!fs.existsSync(draftsPath)) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      let drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
      if (!Array.isArray(drafts) || !drafts[index]) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      drafts.splice(index, 1);
      fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2), 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/import-ref' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { input, sourceLabel, recipeName } = body;
      if (!input || typeof input !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 input（URL 或文本）' }));
        return;
      }
      const { extractRefRecipeFromInput } = await import('./lib/recipe-extractor.js');
      const refRecipe = await extractRefRecipeFromInput(input, { sourceLabel });
      const key = (recipeName && String(recipeName).trim()) || refRecipe.title || '未知';
      const store = loadRefRecipes();
      if (!store[key]) store[key] = [];
      store[key].push(refRecipe);
      saveRefRecipes(store);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: refRecipe, key }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/validate-recipe' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { recipe } = body;
      if (!recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 recipe' }));
        return;
      }
      const { validateIngredientStepConsistency } = await import('./lib/validate-recipe-consistency.js');
      const result = validateIngredientStepConsistency(recipe);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: result }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/review' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(LONG_REQUEST_MS);
    res.setTimeout(LONG_REQUEST_MS);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { recipe, refRecipes } = body;
      if (!recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 recipe' }));
        return;
      }
      const { reviewRecipeWithRefs } = await import('./lib/recipe-reviewer.js');
      const review = await reviewRecipeWithRefs(recipe, refRecipes || []);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: review }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/auto-fix-recipe' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(LONG_REQUEST_MS);
    res.setTimeout(LONG_REQUEST_MS);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { recipe, validation, review } = body;
      if (!recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 recipe' }));
        return;
      }
      const promptPath = path.join(__dirname, 'templates', 'recipe-autofix-prompt.md');
      const systemPrompt = fs.readFileSync(promptPath, 'utf8');
      const userParts = ['## 当前菜谱\n```json\n' + JSON.stringify(recipe, null, 2) + '\n```'];
      if (validation) {
        userParts.push('## 烹饪逻辑校验结果\n```json\n' + JSON.stringify(validation, null, 2) + '\n```');
      }
      if (review) {
        userParts.push('## AI 校验结果\n```json\n' + JSON.stringify(review, null, 2) + '\n```');
      }
      const { callLlmForJson } = await import('./lib/llm-client.js');
      const result = await callLlmForJson(systemPrompt, userParts.join('\n\n'), { maxTokens: 8192, temperature: 0.2 });
      if (!result || !result.recipe) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: 'LLM 返回格式异常' }));
        return;
      }
      const fixedRecipe = { ...recipe, ...result.recipe };
      fixedRecipe.id = recipe.id;
      fixedRecipe.type = recipe.type;
      fixedRecipe.meat = recipe.meat || fixedRecipe.meat;
      fixedRecipe.taste = recipe.taste || fixedRecipe.taste;
      fixedRecipe.cook_type = recipe.cook_type || fixedRecipe.cook_type;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: { recipe: fixedRecipe, changes: result.changes || [] } }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/update-draft-item' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { draftFile, itemIndex, recipe } = body;
      if (!draftFile || typeof itemIndex !== 'number' || !recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 draftFile, itemIndex, recipe' }));
        return;
      }
      const draftPath = path.join(getDraftsDir(), draftFile);
      if (!fs.existsSync(draftPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '草稿不存在' }));
        return;
      }
      const payload = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
      if (!payload.items || !payload.items[itemIndex]) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '项目索引无效' }));
        return;
      }
      payload.items[itemIndex].recipe = recipe;
      fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/approve' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { draftFile, itemIndex } = body;
      if (!draftFile) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 draftFile' }));
        return;
      }
      const draftPath = path.join(getDraftsDir(), draftFile);
      if (!fs.existsSync(draftPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '草稿不存在' }));
        return;
      }
      const payload = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
      if (payload.items && Array.isArray(payload.items) && typeof itemIndex === 'number') {
        const it = payload.items[itemIndex];
        if (it) it.approved = true;
      }
      fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/generate-cover-for-draft' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(120000);
    res.setTimeout(120000);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { draftFile, itemIndex } = body;
      if (!draftFile || typeof itemIndex !== 'number') {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 draftFile 和 itemIndex' }));
        return;
      }
      const draftPath = path.join(getDraftsDir(), draftFile);
      if (!fs.existsSync(draftPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '草稿不存在' }));
        return;
      }
      const payload = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
      const it = payload.items && payload.items[itemIndex];
      if (!it || !it.recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '该项无 recipe' }));
        return;
      }
      // 融合车间生成的草稿可能无 slug/mj_prompts，在此补全
      if (!it.slug || typeof it.slug !== 'object' || Object.keys(it.slug).length === 0) {
        const recipeName = it.recipe.name || '未命名';
        const fileName = `${String(recipeName).replace(/\s+/g, '_')}.png`;
        it.slug = { [recipeName]: fileName };
      }
      if (!it.mj_prompts || !Array.isArray(it.mj_prompts) || it.mj_prompts.length === 0) {
        const { buildPromptsForItem } = await import('./lib/mj-prompt-builder.js');
        it.mj_prompts = buildPromptsForItem({ recipe: it.recipe, mj_prompts: [] });
      }
      fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
      const slugFileName = Object.values(it.slug)[0];
      const baseName = (slugFileName || '').replace(/\.(png|jpg|jpeg)$/i, '');
      const promptIndex = it.selected_prompt_index != null ? it.selected_prompt_index : 0;
      const prompt = it.mj_prompts[promptIndex] || it.mj_prompts[0];
      const apiKey = (CONFIG.minimaxApiKey || '').trim();
      if (!apiKey) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '未配置 MINIMAX_API_KEY' }));
        return;
      }
      const { generateImage } = await import('./lib/minimax-image.js');
      const host = (CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com') ? CONFIG.minimaxHost : 'api.minimax.io';
      const buffer = await generateImage(apiKey, prompt, { host, model: CONFIG.minimaxModel });
      const imagesDir = getImagesDir();
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      const imagePath = path.join(imagesDir, `${baseName}.jpg`);
      fs.writeFileSync(imagePath, buffer);
      it.image_file = path.relative(__dirname, imagePath);
      it.status = 'has_image';
      fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, imageFile: it.image_file }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/sync-item' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(60000);
    res.setTimeout(60000);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { draftFile, itemIndex } = body;
      if (!draftFile || typeof itemIndex !== 'number') {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 draftFile 和 itemIndex' }));
        return;
      }
      const draftPath = path.join(getDraftsDir(), draftFile);
      if (!fs.existsSync(draftPath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '草稿不存在' }));
        return;
      }
      const payload = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
      const it = payload.items && payload.items[itemIndex];
      if (!it || !it.recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '该项无 recipe' }));
        return;
      }
      // 融合车间生成的草稿可能无 slug，在此补全
      if (!it.slug || typeof it.slug !== 'object' || Object.keys(it.slug).length === 0) {
        const recipeName = it.recipe.name || '未命名';
        it.slug = { [recipeName]: `${String(recipeName).replace(/\s+/g, '_')}.png` };
      }
      const recipe = it.recipe;
      const slugMap = it.slug;
      const fileName = Object.values(slugMap)[0];
      if (!fileName) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'slug 为空' }));
        return;
      }
      let fileID = null;
      const rawImage = it.image_file;
      if (rawImage) {
        const rawPath = path.isAbsolute(rawImage) ? rawImage : path.join(__dirname, rawImage);
        if (!fs.existsSync(rawPath)) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: '封面图不存在: ' + rawImage }));
          return;
        }
        fileID = await uploadAdultRecipeImage(rawPath, fileName);
      }
      const doc = fileID ? { ...recipe, coverFileID: fileID } : recipe;
      await insertAdultRecipeToCloud(doc);
      applyLocalPatches({ recipe: doc, slug: slugMap });
      if (it) it.approved = true;
      fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, message: '已上传到云端并更新本地' }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  const cloudRecipeMatch = url.match(/^\/api\/cloud-recipe$/);
  if (cloudRecipeMatch && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(15000);
    res.setTimeout(15000);
    const query = (req.url || '').split('?')[1] || '';
    const params = new URLSearchParams(query);
    const recipeId = params.get('id') || '';
    if (!recipeId) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: '请传 id 参数' }));
      return;
    }
    try {
      if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
        throw new Error('TCB 未配置');
      }
      const app = cloudbase.init({ env: CONFIG.tcbEnvId, secretId: CONFIG.tcbSecretId, secretKey: CONFIG.tcbSecretKey });
      const db = app.database();
      const { data: list } = await db.collection('recipes').where({ id: recipeId }).get();
      if (!list || list.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '云端未找到该菜谱' }));
        return;
      }
      const cloudDoc = list[0];
      const ingredients = [];
      if (Array.isArray(cloudDoc.main_ingredients)) {
        cloudDoc.main_ingredients.forEach((m) => {
          ingredients.push({ name: m.name, baseAmount: m.amount || 0, unit: m.unit || 'g', category: m.category || '食材' });
        });
      }
      if (Array.isArray(cloudDoc.seasonings)) {
        cloudDoc.seasonings.forEach((s) => {
          ingredients.push({ name: s.name, baseAmount: s.amount || 0, unit: s.unit || '适量', category: '调料' });
        });
      }
      if (ingredients.length === 0 && Array.isArray(cloudDoc.ingredients)) {
        cloudDoc.ingredients.forEach((ing) => ingredients.push(ing));
      }
      const steps = Array.isArray(cloudDoc.steps) ? cloudDoc.steps.map((s) => ({
        text: s.text || '',
        action: s.action || s.step_type || 'cook',
        duration_minutes: s.duration_num != null ? s.duration_num : (s.duration_minutes != null ? s.duration_minutes : undefined)
      })) : [];

      const recipe = {
        id: cloudDoc.id || recipeId,
        name: cloudDoc.name || '',
        type: cloudDoc.type || 'adult',
        meat: cloudDoc.meat || '',
        taste: cloudDoc.taste || '',
        flavor_profile: cloudDoc.flavor_profile || '',
        cook_type: cloudDoc.cook_type || '',
        dish_type: cloudDoc.dish_type || '',
        prep_time: cloudDoc.prep_time,
        cook_minutes: cloudDoc.cook_time || cloudDoc.cook_minutes,
        is_baby_friendly: cloudDoc.is_baby_friendly,
        base_serving: cloudDoc.base_serving || 2,
        ingredients,
        steps
      };
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: recipe, _cloudId: cloudDoc._id }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/update-cloud-recipe' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(30000);
    res.setTimeout(30000);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { recipeId, recipe } = body;
      if (!recipeId || !recipe) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 recipeId 和 recipe' }));
        return;
      }
      if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
        throw new Error('TCB 未配置');
      }
      const app = cloudbase.init({ env: CONFIG.tcbEnvId, secretId: CONFIG.tcbSecretId, secretKey: CONFIG.tcbSecretKey });
      const db = app.database();
      const coll = db.collection('recipes');
      const { data: existing } = await coll.where({ id: recipeId }).get();
      if (!existing || existing.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: '云端未找到该菜谱' }));
        return;
      }

      const { buildCloudRecipeDoc } = await import('./lib/cloud-db.js');
      let updateDoc;
      if (typeof buildCloudRecipeDoc === 'function') {
        updateDoc = buildCloudRecipeDoc(recipe);
      } else {
        const mainIngredients = [];
        const seasonings = [];
        (recipe.ingredients || []).forEach((ing) => {
          const isSeasoning = ing.category === '调料' || ing.category === '佐料' ||
            (!ing.category && (ing.unit === '适量' || ing.unit === '少许'));
          if (isSeasoning) {
            seasonings.push({ name: ing.name, amount: ing.baseAmount || 0, unit: ing.unit || '适量' });
          } else {
            mainIngredients.push({ name: ing.name, amount: ing.baseAmount || 0, unit: ing.unit || 'g', category: ing.category || '其他' });
          }
        });
        const steps = (recipe.steps || []).map((s, idx) => ({
          step_index: idx + 1,
          step_type: s.action === 'prep' ? 'prep' : 'cook',
          actionType: s.action === 'prep' ? 'idle_prep' : 'active',
          parallel: s.action === 'prep',
          waitTime: 0,
          duration_num: s.duration_minutes != null ? s.duration_minutes : (s.action === 'prep' ? 5 : 10),
          action: s.action || 'cook',
          text: s.text || '',
          step_image_url: ''
        }));
        updateDoc = {
          name: recipe.name,
          type: recipe.type,
          meat: recipe.meat,
          taste: recipe.taste,
          cook_type: recipe.cook_type,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_minutes,
          main_ingredients: mainIngredients,
          seasonings,
          steps,
          updateTime: new Date()
        };
      }
      updateDoc.updateTime = new Date();

      await coll.where({ id: recipeId }).update(updateDoc);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, message: '云端菜谱已更新' }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/all-recipes' && req.method === 'GET') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(30000);
    res.setTimeout(30000);
    try {
      const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
      delete require.cache[require.resolve(recipesPath)];
      const mod = require(recipesPath);
      const localAdult = Array.isArray(mod.adultRecipes) ? mod.adultRecipes : [];
      const localBaby = Array.isArray(mod.babyRecipes) ? mod.babyRecipes : [];
      const localMap = new Map();
      localAdult.forEach((r) => { if (r && r.id) localMap.set(r.id, { ...r, _source: 'local', _type: r.type || 'adult' }); });
      localBaby.forEach((r) => { if (r && r.id) localMap.set(r.id, { ...r, _source: 'local', _type: r.type || 'baby' }); });

      let cloudRecipes = [];
      try {
        if (CONFIG.tcbEnvId && CONFIG.tcbSecretId && CONFIG.tcbSecretKey) {
          const app = cloudbase.init({ env: CONFIG.tcbEnvId, secretId: CONFIG.tcbSecretId, secretKey: CONFIG.tcbSecretKey });
          const db = app.database();
          const coll = db.collection('recipes');
          const PAGE = 100;
          let offset = 0;
          while (true) {
            const batch = await coll.skip(offset).limit(PAGE).get();
            if (!batch.data || batch.data.length === 0) break;
            cloudRecipes.push(...batch.data);
            if (batch.data.length < PAGE) break;
            offset += PAGE;
          }
        }
      } catch (cloudErr) {
        console.error('[all-recipes] 云端拉取失败:', cloudErr.message);
      }

      const merged = new Map();
      localMap.forEach((v, k) => merged.set(k, v));
      cloudRecipes.forEach((r) => {
        const id = r.id || r._id;
        if (!id) return;
        if (merged.has(id)) {
          const existing = merged.get(id);
          existing._source = 'both';
          existing._cloudId = r._id;
          if (r.coverFileID) existing._coverFileID = r.coverFileID;
          if (r.steps && r.steps.length > 0 && (!existing.steps || existing.steps.length === 0)) {
            existing.steps = r.steps;
          }
          if (r.main_ingredients) existing.main_ingredients = r.main_ingredients;
          if (r.seasonings) existing.seasonings = r.seasonings;
        } else {
          merged.set(id, {
            id,
            name: r.name || id,
            type: r.type || 'unknown',
            meat: r.meat || '',
            taste: r.taste || '',
            cook_type: r.cook_type || '',
            dish_type: r.dish_type || '',
            _source: 'cloud',
            _type: r.type || 'unknown',
            _cloudId: r._id,
            _coverFileID: r.coverFileID || null
          });
        }
      });

      const list = Array.from(merged.values());
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, data: list, localCount: localMap.size, cloudCount: cloudRecipes.length }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/delete-recipes' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(60000);
    res.setTimeout(60000);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { ids, deleteFromCloud, deleteFromLocal } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 ids 数组' }));
        return;
      }

      const results = { cloudDeleted: 0, localDeleted: 0, errors: [] };

      if (deleteFromCloud !== false) {
        try {
          if (CONFIG.tcbEnvId && CONFIG.tcbSecretId && CONFIG.tcbSecretKey) {
            const app = cloudbase.init({ env: CONFIG.tcbEnvId, secretId: CONFIG.tcbSecretId, secretKey: CONFIG.tcbSecretKey });
            const db = app.database();
            const coll = db.collection('recipes');
            for (const id of ids) {
              try {
                const { data: list } = await coll.where({ id }).get();
                if (list && list.length > 0) {
                  await coll.where({ id }).remove();
                  results.cloudDeleted += list.length;
                }
              } catch (e) {
                results.errors.push({ id, target: 'cloud', error: e.message });
              }
            }
          }
        } catch (e) {
          results.errors.push({ target: 'cloud', error: e.message });
        }
      }

      if (deleteFromLocal !== false) {
        try {
          const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
          let content = fs.readFileSync(recipesPath, 'utf8');
          const idSet = new Set(ids);
          const mod = require(recipesPath);
          const origAdultLen = Array.isArray(mod.adultRecipes) ? mod.adultRecipes.length : 0;
          const origBabyLen = Array.isArray(mod.babyRecipes) ? mod.babyRecipes.length : 0;

          const newAdult = (mod.adultRecipes || []).filter((r) => !r || !idSet.has(r.id));
          const newBaby = (mod.babyRecipes || []).filter((r) => !r || !idSet.has(r.id));
          results.localDeleted = (origAdultLen - newAdult.length) + (origBabyLen - newBaby.length);

          if (results.localDeleted > 0) {
            const header = content.match(/^[\s\S]*?(?=var\s+adultRecipes)/);
            const headerStr = header ? header[0] : '';
            const serialize = (arr) => arr.map((r) => '  ' + JSON.stringify(r)).join(',\n');
            const newContent = headerStr +
              'var adultRecipes = [\n' + serialize(newAdult) + '\n];\n\n' +
              'var babyRecipes = [\n' + serialize(newBaby) + '\n];\n\n' +
              'module.exports = { adultRecipes, babyRecipes };\n';
            fs.writeFileSync(recipesPath, newContent, 'utf8');
            delete require.cache[require.resolve(recipesPath)];
          }

          const slugsPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipeCoverSlugs.js');
          if (fs.existsSync(slugsPath)) {
            const slugMod = require(slugsPath);
            const slugMap = slugMod.RECIPE_NAME_TO_SLUG || {};
            const deletedNames = new Set();
            (mod.adultRecipes || []).concat(mod.babyRecipes || []).forEach((r) => {
              if (r && idSet.has(r.id) && r.name) deletedNames.add(r.name);
            });
            let slugChanged = false;
            deletedNames.forEach((name) => {
              if (slugMap[name]) {
                delete slugMap[name];
                slugChanged = true;
              }
            });
            if (slugChanged) {
              delete require.cache[require.resolve(slugsPath)];
            }
          }
        } catch (e) {
          results.errors.push({ target: 'local', error: e.message });
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...results }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url === '/api/generate' && req.method === 'POST') {
    setCors();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.setTimeout(LONG_REQUEST_MS);
    res.setTimeout(LONG_REQUEST_MS);
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const { mode, input, count, withRef, autoReview, streamProgress } = body;
      const stream = !!streamProgress;
      if (!input || typeof input !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: '请传 input' }));
        return;
      }
      const n = Math.max(1, Math.min(20, parseInt(count, 10) || 5));
      const jobId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      if (stream) {
        generateJobs.set(jobId, { events: [], res: null, status: 'running' });
        setImmediate(async () => {
          try {
            const { generateRecipesFromInput } = await import('./lib/llm-client.js');
            const { normalizeGeneratedItems } = await import('./lib/recipe-formatter.js');
            const { ensurePromptsForItems } = await import('./lib/mj-prompt-builder.js');
            const { crawlRefRecipes } = await import('./lib/recipe-crawler.js');
            const { reviewRecipeWithRefs } = await import('./lib/recipe-reviewer.js');
            let excludeNames = [];
            try {
              const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
              const mod = require(recipesPath);
              if (Array.isArray(mod.adultRecipes)) mod.adultRecipes.forEach((r) => { if (r && r.name) excludeNames.push(r.name); });
              if (Array.isArray(mod.babyRecipes)) mod.babyRecipes.forEach((r) => { if (r && r.name) excludeNames.push(r.name); });
            } catch (_) {}
            sendGenerateJobEvent(jobId, { type: 'progress', step: 'llm', message: '正在生成菜谱…' });
            const rawRes = await generateRecipesFromInput({
              mode: mode || 'text',
              input,
              count: n,
              excludeNames
            });
            sendGenerateJobEvent(jobId, { type: 'progress', step: 'normalize', message: '正在规范化…' });
            const normalized = normalizeGeneratedItems(rawRes);
            const withPrompts = ensurePromptsForItems(normalized);
            const payload = {
              generated_at: new Date().toISOString(),
              source: `${mode || 'text'}:${input}`,
              items: withPrompts.items.map((it) => ({
                status: 'pending',
                recipe: it.recipe,
                slug: it.slug,
                mj_prompts: it.mj_prompts,
                selected_prompt_index: null,
                image_file: null,
                ref_recipes: null,
                review: null
              }))
            };
            if (withRef) {
              sendGenerateJobEvent(jobId, { type: 'progress', step: 'crawl', message: '正在爬取参考菜谱…' });
              for (let i = 0; i < payload.items.length; i++) {
                const it = payload.items[i];
                const name = it.recipe && it.recipe.name;
                if (name) {
                  try {
                    it.ref_recipes = await crawlRefRecipes(name, { maxPerSite: 2 });
                  } catch (_) {
                    it.ref_recipes = [];
                  }
                }
              }
            }
            if (autoReview) {
              sendGenerateJobEvent(jobId, { type: 'progress', step: 'review', message: '正在 AI 交叉校验…' });
              for (const it of payload.items) {
                try {
                  it.review = await reviewRecipeWithRefs(it.recipe, it.ref_recipes || []);
                } catch (_) {
                  it.review = { scores: {}, overall: 0, verdict: 'fail', suggestions: [], needs_revision: true };
                }
              }
            }
            const filename = `${new Date().toISOString().slice(0, 10)}_batch.json`;
            const draftPath = path.join(getDraftsDir(), filename);
            fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
            const job = generateJobs.get(jobId);
            if (job) {
              job.status = 'done';
              job.result = { ok: true, filename, path: draftPath };
            }
            sendGenerateJobEvent(jobId, { type: 'done', ok: true, filename });
          } catch (err) {
            sendGenerateJobEvent(jobId, { type: 'done', ok: false, error: err.message });
            const job = generateJobs.get(jobId);
            if (job) job.status = 'done';
          }
          const job = generateJobs.get(jobId);
          if (job && job.res && !job.res.writableEnded) job.res.end();
        });
        res.writeHead(202);
        res.end(JSON.stringify({ ok: true, jobId }));
        return;
      }
      const { generateRecipesFromInput } = await import('./lib/llm-client.js');
      const { normalizeGeneratedItems } = await import('./lib/recipe-formatter.js');
      const { ensurePromptsForItems } = await import('./lib/mj-prompt-builder.js');
      const { crawlRefRecipes } = await import('./lib/recipe-crawler.js');
      const { reviewRecipeWithRefs } = await import('./lib/recipe-reviewer.js');
      const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
      let excludeNames = [];
      try {
        const mod = require(recipesPath);
        if (Array.isArray(mod.adultRecipes)) mod.adultRecipes.forEach((r) => { if (r && r.name) excludeNames.push(r.name); });
        if (Array.isArray(mod.babyRecipes)) mod.babyRecipes.forEach((r) => { if (r && r.name) excludeNames.push(r.name); });
      } catch (_) {}
      const rawRes = await generateRecipesFromInput({ mode: mode || 'text', input, count: n, excludeNames });
      const normalized = normalizeGeneratedItems(rawRes);
      const withPrompts = ensurePromptsForItems(normalized);
      const payload = {
        generated_at: new Date().toISOString(),
        source: `${mode || 'text'}:${input}`,
        items: withPrompts.items.map((it) => ({
          status: 'pending',
          recipe: it.recipe,
          slug: it.slug,
          mj_prompts: it.mj_prompts,
          selected_prompt_index: null,
          image_file: null,
          ref_recipes: null,
          review: null
        }))
      };
      if (withRef) {
        for (const it of payload.items) {
          const name = it.recipe && it.recipe.name;
          if (name) {
            try {
              it.ref_recipes = await crawlRefRecipes(name, { maxPerSite: 2 });
            } catch (_) {
              it.ref_recipes = [];
            }
          }
        }
      }
      if (autoReview) {
        for (const it of payload.items) {
          try {
            it.review = await reviewRecipeWithRefs(it.recipe, it.ref_recipes || []);
          } catch (_) {
            it.review = { scores: {}, overall: 0, verdict: 'fail', suggestions: [], needs_revision: true };
          }
        }
      }
      const filename = `${new Date().toISOString().slice(0, 10)}_batch.json`;
      const draftPath = path.join(getDraftsDir(), filename);
      fs.writeFileSync(draftPath, JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, filename, data: payload }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (url.startsWith('/api/generate/stream') && req.method === 'GET') {
    setCors();
    const query = (req.url || '').split('?')[1] || '';
    const params = new URLSearchParams(query);
    const jobId = params.get('jobId') || '';
    const job = generateJobs.get(jobId);
    if (!job) {
      res.writeHead(404);
      res.end('Job not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    job.events.forEach((ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`));
    if (job.status === 'done') {
      res.end();
      return;
    }
    job.res = res;
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

  if (url === '/cover/' || url === '/cover/index.html') {
    const coverAppDir = path.join(__dirname, 'cover-manager-app');
    const file = path.join(coverAppDir, 'index.html');
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
  console.log(`统一菜谱管理: http://localhost:${PORT}`);
  console.log('API: /api/recipes, /api/drafts, /api/draft/:file, /api/generate, /api/crawl, /api/spider/gaps, /api/spider/fuse, /api/spider/batch, /api/spider/batch/stream, /api/spider/draft-recipes, /api/import-ref, /api/ref-recipes, /api/review, /api/approve');
  console.log('总览: GET /api/all-recipes, POST /api/delete-recipes, GET /api/cloud-recipe, POST /api/update-cloud-recipe');
  console.log('封面: POST /api/regen, /api/upload, /api/audit');
  console.log(`固定图目录: ${fixedDir}`);
});
