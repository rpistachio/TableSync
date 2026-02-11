#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { uploadAdultRecipeImage } from './lib/cloud-uploader.js';
import { insertAdultRecipeToCloud } from './lib/cloud-db.js';
import { applyLocalPatches, writePatchFiles } from './lib/local-file-patcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDraft(draftPath) {
  const full = path.isAbsolute(draftPath)
    ? draftPath
    : path.join(__dirname, draftPath);
  const raw = fs.readFileSync(full, 'utf8');
  return { full, data: JSON.parse(raw) };
}

/**
 * 将 MJ 原始长文件名图片复制并重命名为 slug 文件名
 * 返回重命名后的本地路径
 */
function importAndRenameImage(rawImagePath, slugFileName) {
  const imagesDir = path.join(__dirname, 'drafts', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  const destPath = path.join(imagesDir, slugFileName);
  fs.copyFileSync(rawImagePath, destPath);
  return destPath;
}

async function syncOneItem({ item, dryRun, imageOverride }) {
  const recipe = item.recipe;
  const slugMap = item.slug || {};
  const [cnName] = Object.keys(slugMap);
  const fileName = slugMap[cnName];

  console.log(chalk.cyan(`\n[SYNC] ${recipe.name}`));

  // 解析图片路径：优先使用 --image 指定的路径，否则用 draft 中的 image_file
  const rawImage = imageOverride || item.image_file;

  // 1. 图片上传
  let fileID = null;
  if (rawImage) {
    const rawPath = path.isAbsolute(rawImage)
      ? rawImage
      : path.join(__dirname, rawImage);

    if (!fs.existsSync(rawPath)) {
      console.error(chalk.red(`  图片不存在: ${rawPath}`));
      process.exit(1);
    }

    // 自动重命名：把 MJ 长文件名复制为 slug 标准名
    const renamedPath = importAndRenameImage(rawPath, fileName);
    const originalName = path.basename(rawImage);
    if (originalName !== fileName) {
      console.log(chalk.blue(`  图片重命名: ${originalName}`));
      console.log(chalk.blue(`          → ${fileName}`));
    }

    if (dryRun) {
      console.log(
        chalk.gray(
          `  (dry-run) 将上传图片 ${renamedPath} → adults_recipes/${fileName}`
        )
      );
    } else {
      fileID = await uploadAdultRecipeImage(renamedPath, fileName);
      console.log(chalk.green(`  图片已上传: ${fileID}`));
    }

    // 更新 draft JSON 中的 image_file 为重命名后的路径
    item.image_file = path.relative(__dirname, renamedPath);
  } else {
    console.log(chalk.yellow('  未指定 image_file 且未传入 --image，跳过图片上传'));
  }

  // 2. 云数据库写入
  const doc = fileID ? { ...recipe, coverFileID: fileID } : recipe;
  if (dryRun) {
    console.log(chalk.gray('  (dry-run) 将写入云端 recipes 集合：'));
    console.log(
      chalk.gray(`  id=${doc.id}, name=${doc.name}, dish_type=${doc.dish_type}`)
    );
  } else {
    await insertAdultRecipeToCloud(doc);
    console.log(chalk.green('  云数据库写入成功'));
  }

  // 3. 本地文件自动修改（带 .bak 备份）
  if (dryRun) {
    const patchPath = writePatchFiles({ recipe: doc, slug: slugMap });
    console.log(
      chalk.yellow(
        `  (dry-run) 已生成本地 patch 提示文件（实际不会修改 JS）：${patchPath}`
      )
    );
  } else {
    applyLocalPatches({ recipe: doc, slug: slugMap });
    console.log(
      chalk.green(
        '  已自动更新本地 recipes.js 与 recipeCoverSlugs.js，并生成 .bak 备份'
      )
    );
  }
}

async function main() {
  const program = new Command();
  program
    .requiredOption('--draft <file>', 'draft JSON 路径，如 drafts/2026-02-06_batch.json')
    .option('--index <n>', '只同步第 N 个菜（从 0 开始）', (v) => Number(v))
    .option('--image <path>', 'MJ 原始图片路径（自动重命名为 slug 文件名）')
    .option('--dry-run', '仅预览，不执行上传/写入', false)
    .parse(process.argv);

  const opts = program.opts();
  const { full, data } = loadDraft(opts.draft);
  const dryRun = !!opts.dryRun;
  const imageOverride = opts.image || null;

  console.log(
    chalk.cyan(
      `\n[sync] draft=${full}, items=${data.items.length}, dryRun=${dryRun}`
    )
  );

  const pending = data.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.status === 'approved' || it.status === 'pending' || it.status === 'has_image');

  if (opts.index != null) {
    const target = data.items[opts.index];
    if (!target) {
      console.error(chalk.red(`索引 ${opts.index} 超出范围`));
      process.exit(1);
    }
    await syncOneItem({ item: target, dryRun, imageOverride });
  } else {
    if (imageOverride && data.items.length > 1) {
      console.log(
        chalk.yellow('提示：--image 只在单条模式下生效，请配合 --index 使用。')
      );
    }
    // 批量：只处理 status=approved 的条目，避免误发
    const approved = data.items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.status === 'approved');
    if (approved.length === 0) {
      console.log(
        chalk.yellow('没有 status=approved 的条目，将尝试处理全部 pending / has_image / approved 项。')
      );
      for (const { it } of pending) {
        // eslint-disable-next-line no-await-in-loop
        await syncOneItem({ item: it, dryRun, imageOverride: null });
      }
    } else {
      for (const { it } of approved) {
        // eslint-disable-next-line no-await-in-loop
        await syncOneItem({ item: it, dryRun, imageOverride: null });
      }
    }
  }

  // 同步完成后，把更新过的 image_file 写回 draft JSON
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(chalk.green(`\n[sync] draft 已更新: ${full}`));
}

main().catch((err) => {
  console.error(chalk.red('\n[sync] 发生错误：'));
  console.error(err);
  process.exit(1);
});

