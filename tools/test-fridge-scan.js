#!/usr/bin/env node
// tools/test-fridge-scan.js
// 冰箱扫描云函数 —— 部署测试脚本
//
// 用法：
//   node tools/test-fridge-scan.js                     # 仅本地单元测试（matcher）
//   node tools/test-fridge-scan.js --cloud             # 调用已部署的云函数（需 TCB 配置）
//   node tools/test-fridge-scan.js --cloud --image <url>   # 用指定图片 URL 测试
//   node tools/test-fridge-scan.js --cloud --file-id <id>  # 用云存储 fileID 测试
//
// 前置条件：
//   - 本地测试：无需任何配置
//   - 云函数测试：需在 tools/.env 中配置 TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY
//                 云函数需已部署，且 secret-config.json 已配置 MOONSHOT_API_KEY（Kimi）

import { createRequire } from 'module';
import { CONFIG } from './config.js';
import chalk from 'chalk';

const require = createRequire(import.meta.url);

// ── 命令行参数解析 ─────────────────────────────────────────────
const args = process.argv.slice(2);
const isCloudMode = args.includes('--cloud');
const imageArgIdx = args.indexOf('--image');
const testImageUrl = imageArgIdx !== -1 ? args[imageArgIdx + 1] : '';
const fileIdArgIdx = args.indexOf('--file-id');
const testFileId = fileIdArgIdx !== -1 ? args[fileIdArgIdx + 1] : '';

// ── 工具函数 ──────────────────────────────────────────────────
function printHeader(title) {
  console.log('\n' + chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan('═'.repeat(60)));
}

function printPass(msg) {
  console.log(chalk.green('  ✓ ') + msg);
}

function printFail(msg) {
  console.log(chalk.red('  ✗ ') + msg);
}

function printInfo(msg) {
  console.log(chalk.gray('  ℹ ') + msg);
}

// ═══════════════════════════════════════════════════════════════
// Part 1: 本地单元测试 —— Matcher 模块
// ═══════════════════════════════════════════════════════════════

async function testMatcherLocal() {
  printHeader('本地测试 · matcher.js 食材匹配模块');

  const {
    matchRecipes,
    scoreRecipe,
    normalize,
    normalizeAll,
    extractMainIngredients,
    extractSeasonings,
  } = require('../cloudfunctions/fridgeScan/lib/matcher.js');

  let passed = 0;
  let failed = 0;

  // ── Test 1: 同义词归一化 ──────────────────────────────────
  printInfo('Test 1: 同义词归一化 normalize()');
  const synonymTests = [
    ['番茄', '西红柿'],
    ['马铃薯', '土豆'],
    ['鸡胸肉', '鸡肉'],
    ['虾仁', '虾'],
    ['蛋', '鸡蛋'],
    ['大白菜', '白菜'],
    ['不存在的食材', '不存在的食材'], // 无映射时返回原名
  ];

  for (const [input, expected] of synonymTests) {
    const result = normalize(input);
    if (result === expected) {
      printPass(`normalize("${input}") → "${result}"`);
      passed++;
    } else {
      printFail(`normalize("${input}") → "${result}"，期望 "${expected}"`);
      failed++;
    }
  }

  // ── Test 2: 批量归一化去重 ────────────────────────────────
  printInfo('Test 2: 批量归一化去重 normalizeAll()');
  const batchInput = ['番茄', '西红柿', '鸡蛋', '蛋', '土豆'];
  const batchResult = normalizeAll(batchInput);
  if (batchResult.length === 3 && batchResult.includes('西红柿') && batchResult.includes('鸡蛋') && batchResult.includes('土豆')) {
    printPass(`normalizeAll(${JSON.stringify(batchInput)}) → ${JSON.stringify(batchResult)}（去重后 3 项）`);
    passed++;
  } else {
    printFail(`normalizeAll 结果: ${JSON.stringify(batchResult)}，期望 3 项 [西红柿, 鸡蛋, 土豆]`);
    failed++;
  }

  // ── Test 3: 主料/调料提取 ─────────────────────────────────
  printInfo('Test 3: 主料/调料提取');
  const mockRecipe = {
    name: '西红柿炒鸡蛋',
    main_ingredients: [
      { name: '西红柿', baseAmount: 200 },
      { name: '鸡蛋', baseAmount: 3 },
    ],
    seasonings: [
      { name: '盐', baseAmount: 3 },
      { name: '糖', baseAmount: 5 },
    ],
    meat: 'vegetable',
  };

  const mainIng = extractMainIngredients(mockRecipe);
  const seasonings = extractSeasonings(mockRecipe);
  if (mainIng.length === 2 && seasonings.length === 2) {
    printPass(`提取主料 ${mainIng.length} 项，调料 ${seasonings.length} 项`);
    passed++;
  } else {
    printFail(`主料 ${mainIng.length} 项(期望2)，调料 ${seasonings.length} 项(期望2)`);
    failed++;
  }

  // ── Test 4: 单菜评分 ─────────────────────────────────────
  printInfo('Test 4: 单菜评分 scoreRecipe()');

  // 场景 A：完全匹配的用户食材
  const userIngredientsA = [
    { name: '番茄', quantity: '2个', category: '蔬菜' },
    { name: '鸡蛋', quantity: '3个', category: '蛋类' },
    { name: '盐', quantity: '适量', category: '其他' },
    { name: '糖', quantity: '适量', category: '其他' },
  ];
  const scoreA = scoreRecipe(userIngredientsA, mockRecipe);
  if (scoreA.score > 0.8 && scoreA.matchedIngredients.length === 2) {
    printPass(`完全匹配：score=${scoreA.score}，匹配主料=${scoreA.matchedIngredients.join(',')}，categoryBonus=${scoreA.categoryBonus}`);
    passed++;
  } else {
    printFail(`完全匹配评分异常：score=${scoreA.score}，matchedIngredients=${JSON.stringify(scoreA.matchedIngredients)}`);
    failed++;
  }

  // 场景 B：部分匹配
  const userIngredientsB = [
    { name: '番茄', quantity: '2个', category: '蔬菜' },
    { name: '牛肉', quantity: '300g', category: '肉类' },
  ];
  const scoreB = scoreRecipe(userIngredientsB, mockRecipe);
  if (scoreB.score > 0 && scoreB.score < scoreA.score && scoreB.missingIngredients.length > 0) {
    printPass(`部分匹配：score=${scoreB.score}，缺少=${scoreB.missingIngredients.join(',')}`);
    passed++;
  } else {
    printFail(`部分匹配评分异常：score=${scoreB.score}，missing=${JSON.stringify(scoreB.missingIngredients)}`);
    failed++;
  }

  // 场景 C：完全不匹配
  const userIngredientsC = [
    { name: '三文鱼', quantity: '1块', category: '海鲜' },
  ];
  const scoreC = scoreRecipe(userIngredientsC, mockRecipe);
  if (scoreC.score <= 0.2 && scoreC.matchedIngredients.length === 0) {
    printPass(`无匹配：score=${scoreC.score}，matchedIngredients为空`);
    passed++;
  } else {
    printFail(`无匹配评分异常：score=${scoreC.score}，matchedIngredients=${JSON.stringify(scoreC.matchedIngredients)}`);
    failed++;
  }

  // ── Test 5: 批量匹配排序 ─────────────────────────────────
  printInfo('Test 5: 批量匹配排序 matchRecipes()');

  const mockRecipes = [
    {
      _id: 'recipe_001',
      name: '西红柿炒鸡蛋',
      main_ingredients: [{ name: '西红柿' }, { name: '鸡蛋' }],
      seasonings: [{ name: '盐' }],
      meat: 'vegetable',
    },
    {
      _id: 'recipe_002',
      name: '红烧排骨',
      main_ingredients: [{ name: '排骨' }, { name: '土豆' }],
      seasonings: [{ name: '酱油' }, { name: '冰糖' }],
      meat: 'pork',
    },
    {
      _id: 'recipe_003',
      name: '清炒土豆丝',
      main_ingredients: [{ name: '土豆' }, { name: '青椒' }],
      seasonings: [{ name: '盐' }, { name: '醋' }],
      meat: 'vegetable',
    },
    {
      _id: 'recipe_004',
      name: '蒜蓉西兰花',
      main_ingredients: [{ name: '西兰花' }, { name: '蒜' }],
      seasonings: [{ name: '盐' }],
      meat: 'vegetable',
    },
  ];

  const userIngredients = [
    { name: '番茄', quantity: '2个', category: '蔬菜' },
    { name: '鸡蛋', quantity: '3个', category: '蛋类' },
    { name: '马铃薯', quantity: '1个', category: '蔬菜' },
    { name: '盐', quantity: '适量', category: '其他' },
  ];

  const ranked = matchRecipes(userIngredients, mockRecipes);

  if (ranked.length > 0 && ranked[0].name === '西红柿炒鸡蛋') {
    printPass(`排序正确：第1名="${ranked[0].name}"(score=${ranked[0].score})，共 ${ranked.length} 条结果`);
    passed++;
  } else {
    printFail(`排序异常：第1名="${ranked[0] && ranked[0].name}"，期望"西红柿炒鸡蛋"`);
    failed++;
  }

  // 验证土豆相关菜谱排在中间
  const potatoRecipes = ranked.filter((r) => r.name.includes('土豆'));
  if (potatoRecipes.length > 0 && potatoRecipes[0].score > 0) {
    printPass(`土豆相关菜谱匹配到 ${potatoRecipes.length} 道，最高分=${potatoRecipes[0].score}`);
    passed++;
  } else {
    printFail(`土豆相关菜谱未正确匹配`);
    failed++;
  }

  // ── Test 6: minScore 过滤 ─────────────────────────────────
  printInfo('Test 6: minScore 过滤');
  const filtered = matchRecipes(userIngredients, mockRecipes, { minScore: 0.3 });
  const allAboveThreshold = filtered.every((r) => r.score >= 0.3);
  if (allAboveThreshold) {
    printPass(`minScore=0.3 过滤后 ${filtered.length} 条，全部 ≥ 0.3`);
    passed++;
  } else {
    printFail(`minScore 过滤异常，存在低于 0.3 的结果`);
    failed++;
  }

  // ── 汇总 ─────────────────────────────────────────────────
  console.log('');
  const total = passed + failed;
  if (failed === 0) {
    console.log(chalk.green.bold(`  全部通过 ✓  ${passed}/${total} 测试`));
  } else {
    console.log(chalk.red.bold(`  ${failed} 项失败 ✗  ${passed}/${total} 测试`));
  }

  return { passed, failed };
}

// ═══════════════════════════════════════════════════════════════
// Part 2: 云函数远程调用测试
// ═══════════════════════════════════════════════════════════════

async function testCloudFunction() {
  printHeader('云函数远程测试 · fridgeScan');
  printInfo('若出现「3 秒超时」，请在腾讯云开发控制台将 fridgeScan 的超时时间改为 60 秒');

  // ── 检查 TCB 配置 ────────────────────────────────────────
  if (!CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
    printFail('TCB_SECRET_ID 或 TCB_SECRET_KEY 未配置');
    printInfo('请在 tools/.env 中配置以下变量：');
    printInfo('  TCB_ENV_ID=cloud1-xxx');
    printInfo('  TCB_SECRET_ID=你的SecretId');
    printInfo('  TCB_SECRET_KEY=你的SecretKey');
    return { passed: 0, failed: 1 };
  }

  printInfo(`TCB 环境: ${CONFIG.tcbEnvId}`);

  // 动态导入 @cloudbase/node-sdk
  const cloudbase = (await import('@cloudbase/node-sdk')).default;

  // 冰箱扫描含 Vision + 组餐，可能需 20–60 秒，调用端至少等 70 秒
  const app = cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey,
    timeout: 70000,
  });

  let passed = 0;
  let failed = 0;

  // ── Test A: 参数校验 —— 空参数应返回 400 ─────────────────
  printInfo('Test A: 空参数调用（应返回 400）');
  try {
    const res = await app.callFunction({
      name: 'fridgeScan',
      data: {},
    });
    const result = res.result;
    if (result && result.code === 400) {
      printPass(`空参数返回 code=${result.code}，message="${result.message}"`);
      passed++;
    } else {
      printFail(`空参数返回异常: ${JSON.stringify(result).slice(0, 200)}`);
      failed++;
    }
  } catch (err) {
    printFail(`调用云函数失败: ${err.message}`);
    printInfo('请确认云函数 fridgeScan 已部署到云环境');
    failed++;
    return { passed, failed };
  }

  // ── Test B: 带图片的完整调用（fileID 或 imageUrl）────────────
  if (testFileId) {
    printInfo(`Test B: 带云存储 fileID 完整调用 fileID="${testFileId.slice(0, 50)}..."`);
    try {
      const startMs = Date.now();
      const progressInterval = setInterval(() => process.stdout.write('.'), 3000);
      let res;
      try {
        res = await app.callFunction({
          name: 'fridgeScan',
          data: { fileID: testFileId },
        });
      } finally {
        clearInterval(progressInterval);
        process.stdout.write('\n');
      }
      const elapsed = Date.now() - startMs;
      const result = res.result;

      if (result && result.code === 200 && result.data) {
        const d = result.data;
        printPass(`完整调用成功 (${elapsed}ms)`);
        printInfo(`  识别食材: ${(d.ingredients || []).map((i) => i.name).join('、') || '无'}`);
        printInfo(`  置信度: ${d.confidence}`);
        printInfo(`  推荐菜谱: ${(d.recommendations || []).map((r) => r.name).join('、') || '无'}`);
        printInfo(`  购物清单: ${(d.shopping_list || []).join('、') || '无'}`);
        if (d.timings) {
          printInfo(`  耗时明细: 图片下载=${d.timings.step1_image_download_ms}ms, Vision=${d.timings.step2_vision_ms}ms, 匹配=${d.timings.step3_match_ms}ms, 组餐=${d.timings.step4_compose_ms}ms`);
        }
        passed++;
      } else {
        printFail(`完整调用返回异常 (${elapsed}ms): code=${result && result.code}, message=${result && result.message}`);
        if (result && result.error) {
          printInfo(`  云端错误详情: ${result.error}`);
        }
        failed++;
      }
    } catch (err) {
      printFail(`完整调用出错: ${err.message}`);
      if (err.message && (err.message.includes('3 seconds') || err.message.includes('FUNCTIONS_TIME_LIMIT_EXCEEDED'))) {
        console.log('');
        console.log(chalk.yellow.bold('  ⚠ 云函数执行被 3 秒超时中断，请按下面步骤修改：'));
        console.log(chalk.yellow('  1. 打开 https://console.cloud.tencent.com/tcb'));
        console.log(chalk.yellow('  2. 选择环境 cloud1-7g5mdmib90e9f670'));
        console.log(chalk.yellow('  3. 左侧【云函数】→ 找到 fridgeScan → 点击进入'));
        console.log(chalk.yellow('  4. 【配置】→ 超时时间改为 60 秒 → 保存'));
        console.log(chalk.yellow('  5. 再次运行本测试'));
        console.log('');
      }
      failed++;
    }
  } else if (testImageUrl) {
    printInfo(`Test B: 带图片 URL 完整调用 imageUrl="${testImageUrl.slice(0, 50)}..."`);
    try {
      const startMs = Date.now();
      const progressInterval = setInterval(() => process.stdout.write('.'), 3000);
      let res;
      try {
        res = await app.callFunction({
          name: 'fridgeScan',
          data: { imageUrl: testImageUrl },
        });
      } finally {
        clearInterval(progressInterval);
        process.stdout.write('\n');
      }
      const elapsed = Date.now() - startMs;
      const result = res.result;

      if (result && result.code === 200 && result.data) {
        const d = result.data;
        printPass(`完整调用成功 (${elapsed}ms)`);
        printInfo(`  识别食材: ${(d.ingredients || []).map((i) => i.name).join('、') || '无'}`);
        printInfo(`  置信度: ${d.confidence}`);
        printInfo(`  推荐菜谱: ${(d.recommendations || []).map((r) => r.name).join('、') || '无'}`);
        printInfo(`  购物清单: ${(d.shopping_list || []).join('、') || '无'}`);
        if (d.timings) {
          printInfo(`  耗时明细: 图片下载=${d.timings.step1_image_download_ms}ms, Vision=${d.timings.step2_vision_ms}ms, 匹配=${d.timings.step3_match_ms}ms, 组餐=${d.timings.step4_compose_ms}ms`);
        }
        passed++;
      } else {
        printFail(`完整调用返回异常 (${elapsed}ms): code=${result && result.code}, message=${result && result.message}`);
        if (result && result.error) {
          printInfo(`  云端错误详情: ${result.error}`);
        }
        failed++;
      }
    } catch (err) {
      printFail(`完整调用出错: ${err.message}`);
      if (err.message && (err.message.includes('3 seconds') || err.message.includes('FUNCTIONS_TIME_LIMIT_EXCEEDED'))) {
        console.log('');
        console.log(chalk.yellow.bold('  ⚠ 云函数执行被 3 秒超时中断，请按下面步骤修改：'));
        console.log(chalk.yellow('  1. 打开 https://console.cloud.tencent.com/tcb'));
        console.log(chalk.yellow('  2. 选择环境 cloud1-7g5mdmib90e9f670'));
        console.log(chalk.yellow('  3. 左侧【云函数】→ 找到 fridgeScan → 点击进入'));
        console.log(chalk.yellow('  4. 【配置】→ 超时时间改为 60 秒 → 保存'));
        console.log(chalk.yellow('  5. 再次运行本测试'));
        console.log('');
      }
      failed++;
    }
  } else {
    printInfo('Test B: 跳过（未提供 --file-id 或 --image 参数）');
    printInfo('  用法: node tools/test-fridge-scan.js --cloud --file-id "cloud://xxx/fridge_scans/xxx.jpg"');
    printInfo('  或:   node tools/test-fridge-scan.js --cloud --image "https://example.com/fridge.jpg"');
  }

  // ── 汇总 ─────────────────────────────────────────────────
  console.log('');
  const total = passed + failed;
  if (failed === 0) {
    console.log(chalk.green.bold(`  云函数测试通过 ✓  ${passed}/${total}`));
  } else {
    console.log(chalk.red.bold(`  云函数测试 ${failed} 项失败 ✗  ${passed}/${total}`));
  }

  return { passed, failed };
}

// ═══════════════════════════════════════════════════════════════
// 配置检查
// ═══════════════════════════════════════════════════════════════

function checkConfigurations() {
  printHeader('配置检查 · 云函数部署清单');

  const checks = [];

  // 1. config.json 存在且超时设为 60s
  try {
    const config = require('../cloudfunctions/fridgeScan/config.json');
    if (config.timeout === 60) {
      printPass(`config.json: timeout=${config.timeout}s ✓`);
    } else {
      printFail(`config.json: timeout=${config.timeout}s（期望 60s）`);
    }
    if (config.memorySize >= 256) {
      printPass(`config.json: memorySize=${config.memorySize}MB ✓`);
    } else {
      printFail(`config.json: memorySize=${config.memorySize}MB（建议 ≥ 256MB）`);
    }
    checks.push(true);
  } catch (e) {
    printFail('config.json 不存在或格式错误');
    checks.push(false);
  }

  // 2. secret-config.example.json 存在
  try {
    const example = require('../cloudfunctions/fridgeScan/secret-config.example.json');
    if (example.MOONSHOT_API_KEY) {
      printPass('secret-config.example.json: 模板文件存在 ✓');
    }
    checks.push(true);
  } catch (e) {
    printFail('secret-config.example.json 模板文件缺失');
    checks.push(false);
  }

  // 3. secret-config.json 是否已配置（本地检查）
  try {
    const secret = require('../cloudfunctions/fridgeScan/secret-config.json');
    if (secret.MOONSHOT_API_KEY && !secret.MOONSHOT_API_KEY.includes('在 https://')) {
      printPass('secret-config.json: Kimi API Key 已配置 ✓');
    } else {
      printFail('secret-config.json: MOONSHOT_API_KEY 未配置（仍为占位值）');
      printInfo('  请复制 secret-config.example.json 为 secret-config.json 并填入 Kimi API Key');
    }
    checks.push(true);
  } catch (e) {
    printFail('secret-config.json 不存在');
    printInfo('  请执行: cp cloudfunctions/fridgeScan/secret-config.example.json cloudfunctions/fridgeScan/secret-config.json');
    printInfo('  然后编辑填入 MOONSHOT_API_KEY（在 https://platform.moonshot.cn 获取）');
    checks.push(false);
  }

  // 4. package.json 依赖
  try {
    const pkg = require('../cloudfunctions/fridgeScan/package.json');
    const deps = pkg.dependencies || {};
    if (deps['wx-server-sdk']) {
      printPass(`package.json: 依赖完整 (wx-server-sdk: ${deps['wx-server-sdk']}) ✓`);
    } else {
      printFail('package.json: 缺少 wx-server-sdk');
    }
    checks.push(true);
  } catch (e) {
    printFail('package.json 不存在或格式错误');
    checks.push(false);
  }

  // 5. TCB 凭证（用于远程测试）
  if (CONFIG.tcbSecretId && CONFIG.tcbSecretKey) {
    printPass(`tools/.env: TCB 凭证已配置 (envId=${CONFIG.tcbEnvId}) ✓`);
  } else {
    printInfo('tools/.env: TCB 凭证未配置（--cloud 远程测试不可用）');
  }

  console.log('');
  const allPassed = checks.every(Boolean);
  if (allPassed) {
    console.log(chalk.green.bold('  配置检查全部通过 ✓'));
  } else {
    console.log(chalk.yellow.bold('  部分配置未就绪，请根据提示完善'));
  }

  return allPassed;
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log(chalk.bold('\n🍳 fridgeScan 云函数 · 部署测试工具\n'));

  // Step 1: 配置检查
  checkConfigurations();

  // Step 2: 本地单元测试
  const localResult = await testMatcherLocal();

  // Step 3: 云函数远程测试（仅 --cloud 模式）
  let cloudResult = { passed: 0, failed: 0 };
  if (isCloudMode) {
    cloudResult = await testCloudFunction();
  } else {
    printInfo('\n跳过云函数远程测试（添加 --cloud 参数以启用）');
  }

  // ── 最终汇总 ─────────────────────────────────────────────
  printHeader('最终汇总');
  const totalPassed = localResult.passed + cloudResult.passed;
  const totalFailed = localResult.failed + cloudResult.failed;
  const total = totalPassed + totalFailed;

  console.log(`  本地测试: ${localResult.passed} 通过, ${localResult.failed} 失败`);
  if (isCloudMode) {
    console.log(`  云函数测试: ${cloudResult.passed} 通过, ${cloudResult.failed} 失败`);
  }
  console.log(`  总计: ${totalPassed}/${total} 通过`);
  console.log('');

  if (totalFailed > 0) {
    console.log(chalk.red.bold('  存在失败项，请检查上方输出 ✗'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('  全部测试通过 ✓'));

    if (!isCloudMode) {
      console.log('');
      printInfo('部署提示：');
      printInfo('  1. 在微信开发者工具中右键 cloudfunctions/fridgeScan → "上传并部署：云端安装依赖"');
      printInfo('  2. 确保 secret-config.json 已配置 MOONSHOT_API_KEY（Kimi）');
      printInfo('  3. 部署后运行 node tools/test-fridge-scan.js --cloud 验证远程调用');
    }
  }
}

main().catch((err) => {
  console.error(chalk.red(`\n执行出错: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
