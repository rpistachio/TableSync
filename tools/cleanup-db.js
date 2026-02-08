#!/usr/bin/env node
/**
 * 临时脚本：从云开发数据库 recipes 集合中物理删除指定菜名的记录，并删除云存储中的测试封面图。
 * 用途：清理「测试示例菜」等误同步的测试数据。
 *
 * 使用：cd tools && node cleanup-db.js
 * 可选：node cleanup-db.js --name "测试示例菜"
 *
 * 依赖 .env 中的 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY。
 */

import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from './config.js';

const TARGET_NAME = process.argv.find((a) => a.startsWith('--name='))
  ? process.argv.find((a) => a.startsWith('--name=')).split('=')[1]
  : '测试示例菜';

/** 测试封面图在云存储中的路径（与 recipeCoverSlugs 中 test_dish 对应） */
const TEST_COVER_FILE_ID = `cloud://${CONFIG.tcbEnvId}.636c-${CONFIG.tcbEnvId}-1401654193/adults_recipes/test_dish.png`;

function getApp() {
  if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
    throw new Error('TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY 未配置，请在 tools/.env 中设置');
  }
  return cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey
  });
}

async function main() {
  const app = getApp();
  const db = app.database();
  const coll = db.collection('recipes');

  // 1. 云数据库：删除指定菜名记录
  const { data: list } = await coll.where({ name: TARGET_NAME }).get();
  if (list && list.length > 0) {
    console.log(`\n找到 ${list.length} 条 name="${TARGET_NAME}" 的记录，即将删除：`);
    list.forEach((doc, i) => {
      console.log(`  ${i + 1}. _id=${doc._id}, id=${doc.id || '-'}`);
    });
    const res = await coll.where({ name: TARGET_NAME }).remove();
    console.log(`已删除 ${res.deleted ?? list.length} 条数据库记录。`);
  } else {
    console.log(`\n未找到 name="${TARGET_NAME}" 的数据库记录，跳过。`);
  }

  // 2. 云存储：删除测试封面图 test_dish.png
  try {
    await app.deleteFile({ fileList: [TEST_COVER_FILE_ID] });
    console.log(`已删除云存储文件: ${TEST_COVER_FILE_ID}`);
  } catch (e) {
    if (e.code === 'STORAGE_FILE_NOT_FOUND' || (e.message && e.message.includes('not exist'))) {
      console.log('云存储中未找到 test_dish.png，无需删除。');
    } else {
      console.warn('删除云存储 test_dish.png 失败（可到控制台手动删）:', e.message);
    }
  }
}

main().catch((err) => {
  console.error('\n[cleanup-db] 错误:', err.message);
  process.exit(1);
});
