import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stringifyRecipe(recipe) {
  // 使用 JSON.stringify，缩进 2 格，再整体缩进两空格，保持与数组缩进基本一致
  const json = JSON.stringify(recipe, null, 2);
  return json
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function ensureBackup(filePath) {
  const bak = `${filePath}.bak`;
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(filePath, bak);
  }
}

function applyAdultRecipe(recipe) {
  const recipesPath = path.join(
    CONFIG.projectRoot,
    'miniprogram',
    'data',
    'recipes.js'
  );
  const original = fs.readFileSync(recipesPath, 'utf8');
  const marker = '];\n\nvar babyRecipes';
  const idx = original.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      '未在 recipes.js 中找到 adultRecipes 结束标记（"];\\n\\nvar babyRecipes"）'
    );
  }
  const before = original.slice(0, idx);
  const after = original.slice(idx + marker.length);

  const recipeBlock = stringifyRecipe(recipe);
  const beforeTrimmed = before.replace(/\s*$/, '');
  const injected = `${beforeTrimmed},\n${recipeBlock}\n${marker}${after}`;

  ensureBackup(recipesPath);
  fs.writeFileSync(recipesPath, injected, 'utf8');
}

function applySlug(slugMap) {
  const slugsPath = path.join(
    CONFIG.projectRoot,
    'miniprogram',
    'data',
    'recipeCoverSlugs.js'
  );
  const original = fs.readFileSync(slugsPath, 'utf8');
  const marker = '  /* 宝宝菜 */';
  const idx = original.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      '未在 recipeCoverSlugs.js 中找到分隔注释（"  /* 宝宝菜 */"）'
    );
  }
  const before = original.slice(0, idx);
  const after = original.slice(idx);

  const entries = Object.entries(slugMap).map(
    ([cn, file]) => `  '${cn}': '${file}',`
  );
  const injected = `${before}${entries.join('\n')}\n${after}`;

  ensureBackup(slugsPath);
  fs.writeFileSync(slugsPath, injected, 'utf8');
}

export function applyLocalPatches({ recipe, slug }) {
  if (recipe) applyAdultRecipe(recipe);
  if (slug && Object.keys(slug).length > 0) applySlug(slug);
}

// 仍保留一个可选的 patch 文件导出工具，方便调试或手动应用。
// recipe 若含 baby_variant，会随 stringifyRecipe 一并输出，写入 recipes.js 后前端可按月龄使用。
export function buildAdultRecipePatch(recipe) {
  const recipeBlock = stringifyRecipe(recipe);
  return `// === 新增成人菜谱，手动插入到 adultRecipes 数组末尾（babyRecipes 之前） ===\n${recipeBlock},\n`;
}

export function buildSlugPatch(slugMap) {
  const entries = Object.entries(slugMap).map(
    ([cn, file]) => `  '${cn}': '${file}',`
  );
  return `// === 新增封面图 slug，手动插入到 RECIPE_NAME_TO_SLUG 对象中成人菜部分 ===\n${entries.join(
    '\n'
  )}\n`;
}

export function writePatchFiles({ recipe, slug }) {
  const outDir = path.join(__dirname, '..', 'drafts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = recipe && recipe.name ? recipe.name : 'new-recipe';
  const safeName = baseName.replace(/[\\s/]/g, '_');
  const patchPath = path.join(outDir, `${ts}_${safeName}.patch.txt`);

  const content = [
    `# Patch suggestion for recipes.js & recipeCoverSlugs.js`,
    '',
    buildAdultRecipePatch(recipe),
    '',
    buildSlugPatch(slug || {})
  ].join('\n');

  fs.writeFileSync(patchPath, content, 'utf8');
  return patchPath;
}


