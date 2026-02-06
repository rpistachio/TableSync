#!/usr/bin/env node
/**
 * tools/slim-recipes.js
 * 一次性脚本：读取完整 recipes.js，生成精简版（只保留算法核心字段），备份原文件。
 *
 * 用法：
 *   node tools/slim-recipes.js             # 执行精简并写文件
 *   node tools/slim-recipes.js --dry-run   # 只输出统计，不写文件
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__filename);

// ─── 路径配置 ───────────────────────────────────────────────
const RECIPES_PATH = path.resolve(__dirname, '..', 'miniprogram', 'data', 'recipes.js');
const BACKUP_PATH  = RECIPES_PATH.replace(/\.js$/, '.full.bak.js');

// ─── 保留的算法核心字段 ─────────────────────────────────────
const KEEP_FIELDS = [
  'id', 'name', 'type',
  'meat', 'taste', 'flavor_profile', 'cook_type', 'dish_type',
  'prep_time', 'cook_minutes',
  'is_baby_friendly', 'can_share_base', 'common_allergens',
  'base_serving',
];

// ─── 工具函数 ───────────────────────────────────────────────

/** 从完整菜谱对象中只保留核心字段 */
function pickFields(recipe) {
  const slim = {};
  for (const key of KEEP_FIELDS) {
    if (recipe[key] !== undefined) {
      slim[key] = recipe[key];
    }
  }
  return slim;
}

/**
 * 将 JS 值格式化为不带引号键名的字面量字符串
 * 数组 → ['a', 'b']；布尔 → true/false；字符串 → 'xxx'
 */
function formatValue(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return quoteStr(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return '[' + v.map(formatValue).join(', ') + ']';
  }
  // 普通对象
  if (typeof v === 'object') {
    const pairs = Object.entries(v).map(([k, val]) => `${k}: ${formatValue(val)}`);
    return '{ ' + pairs.join(', ') + ' }';
  }
  return String(v);
}

/** 单引号转义 */
function quoteStr(s) {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

/** 格式化单道菜为一行对象字面量 */
function formatRecipe(r) {
  const parts = Object.entries(r).map(([k, v]) => `${k}: ${formatValue(v)}`);
  return '  { ' + parts.join(', ') + ' }';
}

/**
 * 格式化 templateCombos 为可读 JS 字面量（不用 JSON 引号键名）
 * 保持与原文件一致的风格
 */
function formatTemplateCombos(combos) {
  const blocks = combos.map(combo => {
    const lines = [];
    lines.push('  {');
    // 基本属性
    for (const key of ['name', 'description', 'meat_count', 'veg_count', 'soup_count', 'flavor_logic']) {
      if (combo[key] !== undefined) {
        lines.push(`    ${key}: ${formatValue(combo[key])},`);
      }
    }
    // items 数组
    lines.push('    items: [');
    for (const item of combo.items) {
      const pairs = Object.entries(item).map(([k, v]) => `${k}: ${formatValue(v)}`);
      lines.push('      { ' + pairs.join(', ') + ' },');
    }
    lines.push('    ],');
    // baby_link_index
    if (combo.baby_link_index !== undefined) {
      lines.push(`    baby_link_index: ${combo.baby_link_index}`);
    }
    lines.push('  }');
    return lines.join('\n');
  });
  return 'var templateCombos = [\n' + blocks.join(',\n') + '\n];';
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
  const dryRun = process.argv.includes('--dry-run');

  // 1. 读取完整 recipes.js（require 会执行其中的 forEach 补全默认值）
  console.log('📖 读取完整 recipes.js ...');

  // 清除 require 缓存以确保读到最新内容
  delete require.cache[RECIPES_PATH];
  const full = require(RECIPES_PATH);

  if (!full.adultRecipes || !full.babyRecipes || !full.templateCombos) {
    console.error('❌ recipes.js 导出格式不符合预期，终止');
    process.exit(1);
  }

  // 2. 精简
  const slimAdult = full.adultRecipes.map(pickFields);
  const slimBaby  = full.babyRecipes.map(pickFields);

  // 3. 统计
  const origSize  = fs.statSync(RECIPES_PATH).size;
  const origLines = fs.readFileSync(RECIPES_PATH, 'utf8').split('\n').length;

  console.log(`  成人菜 ${slimAdult.length} 道，宝宝菜 ${slimBaby.length} 道`);
  console.log(`  templateCombos ${full.templateCombos.length} 套`);
  console.log(`  原始文件: ${(origSize / 1024).toFixed(1)} KB / ${origLines} 行`);

  // 4. 生成精简版文件内容
  const header = [
    '/**',
    ' * 核心数据库 — 精简离线 fallback 版（微信小程序版 - CommonJS）',
    ' * 仅保留菜单生成算法核心字段，不含 ingredients / steps / baby_variant 等展示字段。',
    ' * 完整数据从云端获取；离线时此文件支持算法运行，但无法显示步骤和购物清单。',
    ' *',
    ' * 由 tools/slim-recipes.js 自动生成，请勿手动编辑。',
    ' * 原始完整版备份: recipes.full.bak.js',
    ' */',
  ].join('\n');

  const adultBlock = 'var adultRecipes = [\n' +
    slimAdult.map(formatRecipe).join(',\n') +
    '\n];';

  const babyBlock = 'var babyRecipes = [\n' +
    slimBaby.map(formatRecipe).join(',\n') +
    '\n];';

  const templateBlock = formatTemplateCombos(full.templateCombos);

  const exportLine = 'module.exports = { adultRecipes: adultRecipes, babyRecipes: babyRecipes, templateCombos: templateCombos };';

  const output = [header, '', adultBlock, '', babyBlock, '', templateBlock, '', exportLine, ''].join('\n');

  const newSize  = Buffer.byteLength(output, 'utf8');
  const newLines = output.split('\n').length;
  const reduction = ((1 - newSize / origSize) * 100).toFixed(1);

  console.log(`\n  精简版: ${(newSize / 1024).toFixed(1)} KB / ${newLines} 行 (缩减 ${reduction}%)`);

  if (dryRun) {
    console.log('\n🏁 --dry-run 模式，未写文件。');
    process.exit(0);
  }

  // 5. 备份原文件
  console.log(`\n💾 备份原文件 → ${path.basename(BACKUP_PATH)}`);
  fs.copyFileSync(RECIPES_PATH, BACKUP_PATH);
  console.log(`   已备份: ${BACKUP_PATH}`);

  // 6. 写入精简版
  console.log(`✏️  写入精简版 → ${path.basename(RECIPES_PATH)}`);
  fs.writeFileSync(RECIPES_PATH, output, 'utf8');

  // 7. 验证：重新 require 确保语法正确
  console.log('🔍 验证精简版可正常加载 ...');
  delete require.cache[RECIPES_PATH];
  try {
    const verify = require(RECIPES_PATH);
    const adultOk = Array.isArray(verify.adultRecipes) && verify.adultRecipes.length === slimAdult.length;
    const babyOk  = Array.isArray(verify.babyRecipes) && verify.babyRecipes.length === slimBaby.length;
    const comboOk = Array.isArray(verify.templateCombos) && verify.templateCombos.length === full.templateCombos.length;
    if (!adultOk || !babyOk || !comboOk) {
      throw new Error('数据条数不匹配');
    }
    // 抽查第一道成人菜是否缺少 ingredients（确认确实被精简掉了）
    if (verify.adultRecipes[0].ingredients) {
      throw new Error('精简版仍包含 ingredients 字段');
    }
    console.log('   ✅ 验证通过');
  } catch (err) {
    console.error(`   ❌ 验证失败: ${err.message}`);
    console.log('   ⚠️  正在恢复备份 ...');
    fs.copyFileSync(BACKUP_PATH, RECIPES_PATH);
    console.log('   已恢复原文件');
    process.exit(1);
  }

  console.log('\n✅ 精简完成！');
  console.log(`   原始: ${(origSize / 1024).toFixed(1)} KB → 精简: ${(newSize / 1024).toFixed(1)} KB (缩减 ${reduction}%)`);
}

main();
