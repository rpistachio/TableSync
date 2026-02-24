#!/usr/bin/env node
/**
 * 从 tools/recipes-to-optimize-ids.txt 读取待优化 id 列表，调用 optimize-recipes.js。
 * 跨平台（不依赖 sed），用法：
 *   node tools/run-optimize-from-list.js           # 优化列表中的菜谱
 *   node tools/run-optimize-from-list.js --dry-run # 仅预览
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listPath = path.join(__dirname, 'recipes-to-optimize-ids.txt');

if (!fs.existsSync(listPath)) {
  console.error('未找到 recipes-to-optimize-ids.txt');
  process.exit(1);
}

const content = fs.readFileSync(listPath, 'utf8');
const lines = content.split(/\r?\n/).map((l) => l.trim());
// 第一行非注释、非空即 id 列表（逗号分隔）
const idsLine = lines.find((l) => l.length > 0 && !l.startsWith('#'));
if (!idsLine) {
  console.error('recipes-to-optimize-ids.txt 中未找到 id 列表（逗号分隔的一行）');
  process.exit(1);
}

const args = ['tools/optimize-recipes.js', '--ids', idsLine];
if (process.argv.includes('--dry-run')) args.push('--dry-run');
if (process.argv.includes('--batch-size')) {
  const i = process.argv.indexOf('--batch-size');
  if (process.argv[i + 1]) args.push('--batch-size', process.argv[i + 1]);
}

const child = spawn(process.execPath, args, {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: false
});
child.on('exit', (code) => process.exit(code != null ? code : 0));
