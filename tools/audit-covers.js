#!/usr/bin/env node
/**
 * 封面图自动审核：拉取云端成人菜封面，用 Kimi Vision 评分，输出 JSON + HTML 报告。
 * 支持 --recipe 单菜、--threshold 及格线、--regen / --regen-only 重生成不合格图。
 *
 * 重生成后上传云端（覆盖原图，不写云库、不改本地 JS）：
 *   node tools/audit-covers.js --upload-regen --report tools/drafts/cover-audit-YYYY-MM-DD.json
 * 需配置 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY（与 sync 相同）。
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Command } from 'commander';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { scoreImage } from './lib/kimi-vision.js';
import { uploadAdultRecipeImage } from './lib/cloud-uploader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

const CLOUD_HTTP_ROOT = 'https://636c-cloud1-7g5mdmib90e9f670-1401654193.tcb.qcloud.la';
const ADULTS_RECIPES_BASE = `${CLOUD_HTTP_ROOT}/adults_recipes`;
const RATE_LIMIT_MS = 2000;

/** 从 recipeCoverSlugs.js 加载菜名 -> slug 映射（全量） */
function loadSlugMap() {
  const slugsPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipeCoverSlugs.js');
  const mod = require(slugsPath);
  return mod.RECIPE_NAME_TO_SLUG || {};
}

/** 仅成人菜名（到「宝宝菜」第一条之前） */
function getAdultEntries(slugMap) {
  const babyStart = '板栗鲜鸡泥';
  const names = Object.keys(slugMap);
  const idx = names.indexOf(babyStart);
  const adultNames = idx >= 0 ? names.slice(0, idx) : names;
  return adultNames.map((n) => [n, slugMap[n]]);
}

/** 通过 HTTPS 下载图片，返回 base64 */
function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      })
      .on('error', reject)
      .on('timeout', () => {
        reject(new Error('Download timeout'));
      });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 执行审核：下载 + Kimi 评分，写入 JSON 并生成 HTML */
async function runAudit(opts) {
  const apiKey = (CONFIG.moonshotApiKey || '').trim();
  if (!apiKey) {
    console.error(chalk.red('未配置 MOONSHOT_API_KEY，请在 tools/.env 或 cloudfunctions/recipeImport/secret-config.json 中设置'));
    process.exit(1);
  }

  const slugMap = loadSlugMap();
  let entries;
  if (opts.recipe) {
    const name = String(opts.recipe).trim();
    if (!slugMap[name]) {
      console.error(chalk.red(`未找到菜名: ${name}`));
      process.exit(1);
    }
    entries = [[name, slugMap[name]]];
  } else {
    entries = getAdultEntries(slugMap);
  }

  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 7;
  const draftDir = path.isAbsolute(CONFIG.draftsDir) ? CONFIG.draftsDir : path.resolve(__dirname, CONFIG.draftsDir);
  if (!fs.existsSync(draftDir)) fs.mkdirSync(draftDir, { recursive: true });

  const results = [];
  const model = CONFIG.moonshotVisionModel || 'moonshot-v1-8k-vision-preview';

  for (let i = 0; i < entries.length; i++) {
    const [dishName, slug] = entries[i];
    const imageUrl = `${ADULTS_RECIPES_BASE}/${encodeURIComponent(slug)}`;
    console.log(chalk.cyan(`[${i + 1}/${entries.length}] ${dishName}`));

    let base64;
    try {
      base64 = await downloadImageAsBase64(imageUrl);
    } catch (e) {
      console.log(chalk.red(`  下载失败: ${e.message}`));
      results.push({
        dishName,
        slug,
        imageUrl,
        error: e.message,
        overall: 0,
        verdict: 'fail',
        issues: ['图片下载失败'],
      });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    try {
      const score = await scoreImage(apiKey, base64, dishName, { model });
      results.push({
        dishName,
        slug,
        imageUrl,
        ...score,
      });
      const v = score.verdict;
      const color = v === 'pass' ? chalk.green : v === 'warn' ? chalk.yellow : chalk.red;
      console.log(color(`  ${score.verdict} overall=${score.overall} match=${score.match} appetizing=${score.appetizing} quality=${score.quality}`));
    } catch (e) {
      console.log(chalk.red(`  评分失败: ${e.message}`));
      results.push({
        dishName,
        slug,
        imageUrl,
        error: e.message,
        overall: 0,
        verdict: 'fail',
        issues: [e.message],
      });
    }
    await sleep(RATE_LIMIT_MS);
  }

  const date = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(draftDir, `cover-audit-${date}.json`);
  const htmlPath = path.join(draftDir, `cover-audit-${date}.html`);
  const report = { threshold, generatedAt: new Date().toISOString(), results };
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(chalk.green(`\n已写入 ${jsonPath}`));

  const html = buildHtmlReport(report, ADULTS_RECIPES_BASE);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(chalk.green(`已生成报告 ${htmlPath}`));

  return { report, jsonPath };
}

/** 生成 HTML 报告：统计 + 筛选 + 卡片网格 + 点击放大 */
function buildHtmlReport(report, baseUrl) {
  const { threshold, results } = report;
  const sorted = [...results].sort((a, b) => (a.overall || 0) - (b.overall || 0));
  const pass = results.filter((r) => r.verdict === 'pass').length;
  const warn = results.filter((r) => r.verdict === 'warn').length;
  const fail = results.filter((r) => r.verdict === 'fail').length;
  const total = results.length;

  const card = (r) => {
    const imgSrc = r.slug ? `${baseUrl}/${encodeURIComponent(r.slug)}` : '';
    const verdictClass = r.verdict || 'fail';
    const issues = Array.isArray(r.issues) ? r.issues.join('；') : (r.issues || '');
    const err = r.error ? `错误: ${r.error}` : '';
    return `
    <div class="card ${verdictClass}" data-verdict="${verdictClass}">
      <div class="thumb" data-src="${imgSrc}">${imgSrc ? `<img src="${imgSrc}" alt="${(r.dishName || '').replace(/"/g, '&quot;')}" loading="lazy" />` : '<span>无图</span>'}</div>
      <div class="meta">
        <strong class="name">${(r.dishName || '').replace(/</g, '&lt;')}</strong>
        <div class="scores">match ${r.match ?? '-'} · appetizing ${r.appetizing ?? '-'} · quality ${r.quality ?? '-'}</div>
        <div class="overall">overall ${r.overall ?? '-'} <span class="verdict">${verdictClass}</span></div>
        ${issues ? `<div class="issues">${String(issues).replace(/</g, '&lt;')}</div>` : ''}
        ${err ? `<div class="error">${String(err).replace(/</g, '&lt;')}</div>` : ''}
      </div>
    </div>`;
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>封面图审核报告</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; background: #1a1a1a; color: #e0e0e0; }
    h1 { font-size: 1.25rem; margin-bottom: 12px; }
    .stats { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .stats span { padding: 6px 12px; border-radius: 8px; }
    .stats .pass { background: #1b5e20; }
    .stats .warn { background: #f57c00; color: #000; }
    .stats .fail { background: #b71c1c; }
    .filters { margin-bottom: 16px; }
    .filters button { margin-right: 8px; padding: 6px 12px; border-radius: 6px; border: 1px solid #555; background: #333; color: #e0e0e0; cursor: pointer; }
    .filters button.active { background: #555; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .card { border-radius: 12px; overflow: hidden; background: #2a2a2a; border: 2px solid #444; }
    .card.pass { border-color: #2e7d32; }
    .card.warn { border-color: #ef6c00; }
    .card.fail { border-color: #c62828; }
    .card.hidden { display: none; }
    .thumb { aspect-ratio: 1; background: #333; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .meta { padding: 10px; font-size: 12px; }
    .name { display: block; margin-bottom: 4px; }
    .scores, .overall { color: #999; margin-top: 2px; }
    .verdict { font-weight: bold; margin-left: 4px; }
    .issues, .error { margin-top: 4px; color: #ff8a80; font-size: 11px; }
    #lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; align-items: center; justify-content: center; cursor: pointer; }
    #lightbox.show { display: flex; }
    #lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; }
  </style>
</head>
<body>
  <h1>封面图审核报告</h1>
  <div class="stats">
    <span>总数 ${total}</span>
    <span class="pass">pass ${pass}</span>
    <span class="warn">warn ${warn}</span>
    <span class="fail">fail ${fail}</span>
    <span>及格线 overall ≥ ${threshold}</span>
  </div>
  <div class="filters">
    <button class="filter active" data-v="all">全部</button>
    <button class="filter" data-v="pass">pass</button>
    <button class="filter" data-v="warn">warn</button>
    <button class="filter" data-v="fail">fail</button>
  </div>
  <div class="grid" id="grid">
    ${sorted.map(card).join('')}
  </div>
  <div id="lightbox"><img src="" alt="" /></div>
  <script>
    document.querySelectorAll('.filter').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const v = this.dataset.v;
        document.querySelectorAll('.card').forEach(c => {
          c.classList.toggle('hidden', v !== 'all' && c.dataset.verdict !== v);
        });
      });
    });
    document.querySelectorAll('.thumb').forEach(el => {
      el.addEventListener('click', function() {
        const src = this.dataset.src;
        if (!src) return;
        const lb = document.getElementById('lightbox');
        lb.querySelector('img').src = src;
        lb.classList.add('show');
      });
    });
    document.getElementById('lightbox').addEventListener('click', function() {
      this.classList.remove('show');
    });
  </script>
</body>
</html>`;
}

/** 从 recipes.js 按菜名查找菜谱对象 */
function findRecipeByName(dishName) {
  const recipesPath = path.join(CONFIG.projectRoot, 'miniprogram', 'data', 'recipes.js');
  const mod = require(recipesPath);
  const list = mod.adultRecipes || [];
  return list.find((r) => r && r.name === dishName) || null;
}

/** 从报告中筛出需要重生成的条目：overall 低于 regenThreshold 的（默认 5，即原 verdict=fail） */
function getRegenItems(report, regenThreshold) {
  const th = typeof regenThreshold === 'number' ? regenThreshold : 5;
  return (report.results || []).filter(
    (r) => (r.overall ?? 0) < th && r.dishName && r.slug && !r.error
  );
}

/** 重生成 overall 低于阈值的封面图（切换 MJ 模版 + MiniMax） */
async function runRegen(opts) {
  const rawPath = opts.report;
  const reportPath = rawPath && (path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath));
  if (!reportPath || !fs.existsSync(reportPath)) {
    console.error(chalk.red('请指定存在的审核报告: --report drafts/cover-audit-xxx.json'));
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const regenThreshold = opts.regenThreshold ?? 5;
  const failItems = getRegenItems(report, regenThreshold);
  if (failItems.length === 0) {
    console.log(chalk.yellow(`报告中无 overall < ${regenThreshold} 的条目，无需重生成`));
    process.exit(0);
  }
  console.log(chalk.gray(`重生成阈值: overall < ${regenThreshold}，共 ${failItems.length} 条\n`));

  const apiKey = (CONFIG.minimaxApiKey || '').trim();
  if (!apiKey) {
    console.error(chalk.red('未配置 MINIMAX_API_KEY'));
    process.exit(1);
  }

  const { buildPromptsForItem } = await import('./lib/mj-prompt-builder.js');
  const { generateImage } = await import('./lib/minimax-image.js');
  const imagesDir = path.join(CONFIG.draftsDir, 'images');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  const resolvedHost = (CONFIG.minimaxHost === 'api.minimax.io' || CONFIG.minimaxHost === 'api.minimaxi.com')
    ? CONFIG.minimaxHost
    : 'api.minimax.io';
  const minimaxOpts = { host: resolvedHost, model: CONFIG.minimaxModel };

  for (let i = 0; i < failItems.length; i++) {
    const item = failItems[i];
    const recipe = findRecipeByName(item.dishName) || { name: item.dishName };
    const mjItem = { recipe, mj_prompts: [] };
    const prompts = buildPromptsForItem(mjItem);
    const promptIndex = Math.min(1, prompts.length - 1);
    const prompt = prompts[promptIndex] || prompts[0];
    const baseName = (item.slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
    const imageFileName = `${baseName}.jpg`;
    const imagePath = path.join(imagesDir, imageFileName);
    console.log(chalk.cyan(`[${i + 1}/${failItems.length}] ${item.dishName} 使用模版 ${promptIndex + 1} 重生成…`));
    try {
      const buffer = await generateImage(apiKey, prompt, minimaxOpts);
      fs.writeFileSync(imagePath, buffer);
      console.log(chalk.green(`  已保存 ${imageFileName}`));
    } catch (e) {
      console.error(chalk.red(`  失败: ${e.message}`));
    }
    await sleep(RATE_LIMIT_MS);
  }
  console.log(chalk.green('\n重生成完成。上传到云端: node tools/audit-covers.js --upload-regen --report ' + (opts.report || 'drafts/cover-audit-YYYY-MM-DD.json')));
}

/** 将重生成后的图片上传到云存储（覆盖原图），不写云数据库、不改本地 recipes/recipeCoverSlugs */
async function runUploadRegen(opts) {
  const rawPath = opts.report;
  const reportPath = rawPath && (path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath));
  if (!reportPath || !fs.existsSync(reportPath)) {
    console.error(chalk.red('请指定审核报告: --report tools/drafts/cover-audit-YYYY-MM-DD.json'));
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const regenThreshold = opts.regenThreshold ?? 5;
  const failItems = getRegenItems(report, regenThreshold);
  if (failItems.length === 0) {
    console.log(chalk.yellow(`报告中无 overall < ${regenThreshold} 的条目`));
    process.exit(0);
  }

  const imagesDir = path.isAbsolute(CONFIG.draftsDir)
    ? path.join(CONFIG.draftsDir, 'images')
    : path.resolve(__dirname, CONFIG.draftsDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    console.error(chalk.red(`图片目录不存在: ${imagesDir}，请先执行 --regen-only 生成图片`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n将 ${failItems.length} 张重生成图上传到云存储 adults_recipes/（覆盖原图）\n`));
  for (let i = 0; i < failItems.length; i++) {
    const item = failItems[i];
    const baseName = (item.slug || '').replace(/\.(png|jpg|jpeg)$/i, '');
    const localJpg = path.join(imagesDir, `${baseName}.jpg`);
    if (!fs.existsSync(localJpg)) {
      console.log(chalk.yellow(`  跳过（本地无图）: ${item.dishName} ${baseName}.jpg`));
      continue;
    }
    const cloudFileName = item.slug;
    console.log(chalk.cyan(`[${i + 1}/${failItems.length}] ${item.dishName} → ${cloudFileName}`));
    try {
      const fileID = await uploadAdultRecipeImage(localJpg, cloudFileName);
      console.log(chalk.green(`  已上传 ${fileID ? fileID.slice(0, 50) + '…' : fileID}`));
    } catch (e) {
      console.error(chalk.red(`  上传失败: ${e.message}`));
    }
  }
  console.log(chalk.green('\n上传完成。小程序通过 recipeCoverSlugs 的同一 slug 会拉取到新图。'));
}

async function main() {
  const program = new Command();
  program
    .option('--recipe <name>', '只审核指定菜名')
    .option('--threshold <n>', '及格线 overall 阈值（仅影响报告展示）', (v) => Number(v), 7)
    .option('--regen', '审核完成后对低于阈值的项自动重生成封面图')
    .option('--regen-only', '仅重生成（需配合 --report 使用）')
    .option('--regen-threshold <n>', 'overall 低于此分则重生成（默认 5；设为 9 则 9 分以下都重生成）', (v) => Number(v), 5)
    .option('--upload-regen', '将重生成图上传到云存储（需先 --regen-only，再本命令 + --report）')
    .option('--report <path>', '审核报告 JSON 路径（与 --regen-only / --upload-regen 一起用）')
    .parse(process.argv);

  const opts = program.opts();

  if (opts.uploadRegen) {
    await runUploadRegen(opts);
    return;
  }
  if (opts.regenOnly) {
    await runRegen(opts);
    return;
  }

  const { report, jsonPath } = await runAudit(opts);
  if (opts.regen && report.results && jsonPath) {
    const th = opts.regenThreshold ?? 5;
    const toRegen = getRegenItems(report, th);
    if (toRegen.length > 0) {
      console.log(chalk.cyan(`\n开始对 overall < ${th} 的 ${toRegen.length} 张图重生成…`));
      await runRegen({ ...opts, report: jsonPath });
    }
  }
}

main().catch((err) => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});
