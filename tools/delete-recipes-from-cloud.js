#!/usr/bin/env node
/**
 * 从云数据库 recipes 集合中按 id 删除指定菜谱。
 * 用法：node tools/delete-recipes-from-cloud.js [--dry-run]
 * 依赖 .env 中的 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY。
 */

import cloudbase from '@cloudbase/node-sdk';
import chalk from 'chalk';
import { CONFIG } from './config.js';

const IDS_TO_DELETE = ['a-soup-5', 's003', 's005']; // 紫菜蛋花汤、丝瓜蛋花汤、番茄金针菇蛋花汤

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
    console.log(chalk.yellow('[delete-recipes] --dry-run：仅预览，不执行删除。\n'));
  }

  const db = getDb();
  const coll = db.collection('recipes');

  let totalRemoved = 0;
  for (const id of IDS_TO_DELETE) {
    const { data: list } = await coll.where({ id }).get();
    if (list && list.length > 0) {
      const names = list.map((r) => r.name || '-').join(', ');
      if (dryRun) {
        console.log(chalk.gray(`  [dry-run] 将删除 id=${id} (${names})，共 ${list.length} 条`));
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
    console.log(chalk.cyan(`\n[delete-recipes] 完成，共删除 ${totalRemoved} 条。`));
  }
}

main().catch((err) => {
  console.error(chalk.red('\n[delete-recipes] 错误:'), err.message);
  process.exit(1);
});
