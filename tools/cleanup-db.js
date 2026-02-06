#!/usr/bin/env node
/**
 * 临时脚本：清理「测试示例菜」等误同步的测试数据。
 * 1. 云数据库 recipes：物理删除 name 为指定菜名的记录
 * 2. 云存储：删除测试封面图 adults_recipes/test_dish.png
 *
 * 使用：cd tools && node cleanup-db.js
 * 可选：node cleanup-db.js --name=测试示例菜
 *
 * 依赖 .env 中的 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY。
 */

import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from './config.js';

const TARGET_NAME = process.argv.find((a) => a.startsWith('--name='))
  ? process.argv.find((a) => a.startsWith('--name=')).split('=')[1]
  : '测试示例菜';

/** 与 miniprogram/data/recipeResources.js 中 CLOUD_ROOT 一致 */
const CLOUD_ROOT = 'cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193';
const TEST_COVER_FILE_ID = `${CLOUD_ROOT}/adults_recipes/test_dish.png`;

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

  // ---------- 1. 云数据库：删除指定菜名记录 ----------
  const { data: list } = await coll.where({ name: TARGET_NAME }).get();
  if (list && list.length > 0) {
    console.log(`\n[DB] 找到 ${list.length} 条 name="${TARGET_NAME}"，即将删除：`);
    list.forEach((doc, i) => {
      console.log(`  ${i + 1}. _id=${doc._id}, id=${doc.id || '-'}`);
    });
    const res = await coll.where({ name: TARGET_NAME }).remove();
    console.log(`[DB] 已删除 ${res.deleted ?? list.length} 条记录。`);
  } else {
    console.log(`\n[DB] 未找到 name="${TARGET_NAME}" 的记录，跳过。`);
  }

  // ---------- 2. 云存储：删除测试封面图 ----------
  try {
    await app.deleteFile({ fileList: [TEST_COVER_FILE_ID] });
    console.log('[Storage] 已删除测试封面: adults_recipes/test_dish.png');
  } catch (e) {
    if (e.message && (e.message.includes('不存在') || e.message.includes('not exist') || e.code === 'FILE_NOT_FOUND')) {
      console.log('[Storage] 测试封面 test_dish.png 不存在，跳过。');
    } else {
      console.warn('[Storage] 删除 test_dish.png 失败（可到云开发控制台手动删）:', e.message);
    }
  }

  console.log('\n大扫除完成。若小程序仍显示测试菜，请清除本地缓存或重新进入 Preview。');
}

main().catch((err) => {
  console.error('\n[cleanup-db] 错误:', err.message);
  process.exit(1);
});
