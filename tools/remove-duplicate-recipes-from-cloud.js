#!/usr/bin/env node
/**
 * 从云数据库 recipes 集合中删除「与本地已去重逻辑一致」的重复菜谱记录。
 * 本地 recipes.js 已删除的 id：a-veg-5（西红柿炒蛋，与 m001 番茄炒蛋重复）、a-beef-3（番茄炖牛腩，与 a-beef-2 番茄牛腩重复）、s001、m006、m007、s004、a-chi-13。
 * 运行此脚本后云端与本地一致，用户同步后不会再看到重复菜。
 *
 * 用法：cd tools && node remove-duplicate-recipes-from-cloud.js
 * 可选：node remove-duplicate-recipes-from-cloud.js --dry-run  仅预览不删除
 *
 * 依赖 .env 中的 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY。
 */

import cloudbase from '@cloudbase/node-sdk';
import chalk from 'chalk';
import { CONFIG } from './config.js';

/** 本地已删除的重复菜 id（与 recipes.js 去重一致） */
const DUPLICATE_IDS_TO_REMOVE = ['a-veg-5', 'a-beef-3', 's001', 'm006', 'm007', 's004', 'a-chi-13'];

function getDb() {
  if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
    throw new Error('TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY 未配置，请在 tools/.env 中设置');
  }
  const app = cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey
  });
  return app.database();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log(chalk.yellow('[remove-duplicate] --dry-run：仅查询并预览，不执行删除。\n'));
  }

  const db = getDb();
  const coll = db.collection('recipes');

  let totalRemoved = 0;
  for (const id of DUPLICATE_IDS_TO_REMOVE) {
    const { data: list } = await coll.where({ id }).get();
    if (list && list.length > 0) {
      const names = list.map((r) => r.name || '-').join(', ');
      if (dryRun) {
        console.log(chalk.gray(`  [dry-run] 将删除 id=${id} (name: ${names})，共 ${list.length} 条`));
      } else {
        await coll.where({ id }).remove();
        totalRemoved += list.length;
        console.log(chalk.green(`  已删除 id=${id} (${names})，${list.length} 条`));
      }
    } else {
      console.log(chalk.gray(`  云端无 id=${id}，跳过`));
    }
  }

  if (dryRun) {
    console.log(chalk.yellow('\n去掉 --dry-run 将执行实际删除。'));
  } else {
    console.log(chalk.cyan(`\n[remove-duplicate] 完成，共删除 ${totalRemoved} 条重复记录。`));
    console.log(chalk.gray('建议：小程序内清除缓存或重新同步菜谱后，重复菜将不再出现。'));
  }
}

main().catch((err) => {
  console.error(chalk.red('\n[remove-duplicate] 错误:'), err.message);
  process.exit(1);
});
