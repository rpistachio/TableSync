#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import { getSeasonalKeywords, fetchTrendingTopics, composeInput } from './lib/trend-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const program = new Command();
  program
    .option('--count <n>', '生成菜谱数量', (v) => Number(v), 5)
    .option('--extra <keywords>', '额外自定义关键词（逗号或空格分隔）', '')
    .option('--out <file>', '输出草稿路径（透传给 generate.js）', '')
    .option('--dry-run', '仅打印组装的 input，不调用 generate.js', false)
    .parse(process.argv);

  const opts = program.opts();
  const count = opts.count;
  const extra = opts.extra || '';
  const outFile = opts.out || '';
  const dryRun = !!opts.dryRun;

  console.log(chalk.cyan('\n[trend-hunter] 正在获取时令与热点关键词…\n'));

  const seasonal = getSeasonalKeywords(new Date());
  const trending = await fetchTrendingTopics();

  const composedInput = composeInput({
    seasonal,
    trending,
    extra
  });

  console.log(chalk.gray('时令主题:'), seasonal.season);
  console.log(chalk.gray('饮食主题:'), seasonal.themes.join('、'));
  console.log(chalk.gray('当季食材:'), seasonal.ingredients.join('、'));
  if (trending.length > 0) {
    console.log(chalk.gray('实时热点:'), trending.join('、'));
  } else {
    console.log(chalk.gray('实时热点:'), chalk.dim('（暂无，可后续在 trend-service 接入 LLM/API）'));
  }
  console.log(chalk.magenta('\n组装 --input:\n'), composedInput);

  if (dryRun) {
    console.log(chalk.yellow('\n[dry-run] 未调用 generate.js，仅预览上述 input。'));
    return;
  }

  const generatePath = path.resolve(__dirname, 'generate.js');
  const args = [
    generatePath,
    '--mode', 'trending',
    '--input', composedInput,
    '--count', String(count)
  ];
  if (outFile) {
    args.push('--out', outFile);
  }

  console.log(chalk.cyan('\n[trend-hunter] 调用 generate.js…\n'));

  const child = spawn('node', args, {
    stdio: 'inherit',
    cwd: __dirname
  });

  child.on('close', (code) => {
    if (code !== 0) {
      process.exitCode = code ?? 1;
    }
  });
}

main().catch((err) => {
  console.error(chalk.red('\n[trend-hunter] 发生错误：'));
  console.error(err);
  process.exit(1);
});
