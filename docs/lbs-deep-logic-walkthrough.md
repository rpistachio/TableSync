# LBS 深化 + 工具链融合 — 逻辑走查

> 本文档覆盖两条核心链路的完整数据流：  
> 1. **摇一摇 → 预览文案**：前端 LBS 地域加权 + 概率门控 + 文案选择  
> 2. **batch-planner → fusion-spider**：工具链 cuisine 维度传递与闭环

---

## 链路一：摇一摇 → 预览文案

整条数据流经过 5 个阶段，涉及 4 个文件。

### 阶段 1：存量菜谱自动带地域标签

**文件**：`miniprogram/data/menuGenerator.js` — `defaultTagsForRecipe(r)`

`CUISINE_NAME_HINTS` 定义了菜名关键词到菜系 key 的映射：

| cuisine key | 关键词示例 |
|-------------|-----------|
| cantonese | 白切、白灼、煲仔、叉烧、蚝油 |
| sichuan | 麻婆、宫保、回锅、水煮、鱼香 |
| jiangzhe | 红烧、糖醋、狮子头、东坡 |
| dongbei | 锅包、小鸡炖、地三鲜、酸菜 |
| hunan | 剁椒、湘味、毛氏、小炒肉 |
| minyue | 闽南、台式、沙茶、三杯 |
| yungui | 过桥、汽锅、酸汤、折耳根 |
| xibei | 手抓、大盘鸡、羊肉泡、馕 |
| huaiyang | 淮扬、徽式、鲁菜、家常 |

`defaultTagsForRecipe` 在生成 tags 时遍历 `CUISINE_NAME_HINTS`，菜名命中关键词即 push 对应 cuisine tag。这使得**即使存量菜谱没有手写 tags**，类似「麻婆豆腐」会自动获得 `sichuan`，「白灼虾」会获得 `cantonese`。

**这是地域加权能命中的前提条件。**

### 阶段 2：40% 概率门控 — 地域加权注入

**文件**：`miniprogram/data/menuGenerator.js` — `generateMenuWithFilters()` 约第 1838–1858 行

用户摇一摇触发 `generateMenuWithFilters()`，其中：

1. 调用 `tasteProfile.getActiveRegion()` 获取用户地理位置（IP / 手动设置）
2. 调用 `regionCuisineMap.getCuisineKeyByCity(city, province)` 解析 cuisine key
   - 覆盖全国所有省份 + 港澳台
   - **永远不返回 null**，最差返回 `'generic'`
3. 调用 `getTagsByCuisineKey(cuisineKey)` 获取标签列表
   - 例：`'sichuan'` → `['sichuan', 'spicy', 'numbing']`
   - `'generic'` → `['comfort', 'salty_umami']`
4. **关键：`Math.random() < 0.4` 概率门控**
   - 约 40% 概率：注入 `flavorOptions.regionTags = regionTags`
   - 约 60% 概率：不注入，走纯随机
5. 将结果写入 `getApp().globalData.lastRegionWeightTriggered`（`true`/`false`），供文案层读取

```
if (regionTags && regionTags.length > 0 && Math.random() < 0.4) {
  flavorOptions.regionTags = regionTags;
}
globalData.lastRegionWeightTriggered = !!(flavorOptions && flavorOptions.regionTags);
```

### 阶段 3：加权选菜

**文件**：`miniprogram/data/menuGenerator.js` — `pickOneWithStewBalance()` 内部权重计算

```javascript
if (regionTags.length > 0 && Array.isArray(r.tags)) {
  for (var rt = 0; rt < regionTags.length; rt++) {
    if (r.tags.indexOf(regionTags[rt]) !== -1) {
      w += 2;   // 命中地域标签的菜谱权重 +2
      break;
    }
  }
}
```

- 如果阶段 2 触发了地域（40% 中签），匹配到地域标签的菜谱 **weight + 2**
- 如果 40% 没中，`regionTags` 为空数组，此处不生效，完全随机

### 阶段 4：注入文案上下文

**文件**：`miniprogram/pages/preview/preview.js` — `injectRegionCopyContext()`

菜单生成后构建 omakase 展示数据时：

```javascript
var copyContext = {
  isTired: isTiredMode,
  hasExpiringIngredient: ...,
  heroIngredient: ...,
  heroFlavor: ...,
  heroCookType: ...
};
injectRegionCopyContext(copyContext, heroName);
var microCopy = pickOmakaseCopy(copyContext);
```

`injectRegionCopyContext` 读取用户地理位置，设置：

- `context.regionLabel`：四级兜底链 `manual → city → province → '你所在的城市'`
- `context.regionCuisineKey`：解析出的 cuisine key（保底 `'generic'`）

### 阶段 5：文案选择 — 只有触发加权才用地域文案

**文件**：`miniprogram/pages/preview/preview.js` — `pickOmakaseCopy()`

```javascript
var regionTriggered = getApp().globalData.lastRegionWeightTriggered === true;

if (context.regionLabel && context.regionCuisineKey && regionTriggered) {
  // → 走地域文案池（如 '主厨嗅探到{region}的气息…'）
} else {
  // → fallback 到 tired / expiring / heavy / light / random
}
```

地域文案池覆盖 11 个 cuisine key：

| key | 示例文案 |
|-----|---------|
| cantonese | 靓汤已经在心里煲上了，{region}的夜晚值得一碗好汤 |
| sichuan | 想念{region}的麻辣？主厨懂你，今晚微辣刚刚好 |
| jiangzhe | {region}的鲜甜，都在这道{dish}里 |
| dongbei | 一份{region}的实在，今晚吃得踏实 |
| minyue | {region}的汤汤水水，今晚慰劳你的胃 |
| yungui | 酸辣鲜香，{region}的烟火气都在{dish}里 |
| xibei | 一份{region}的扎实风味，今晚吃得过瘾 |
| huaiyang | {region}的踏实味道，今晚好好吃一顿 |
| hunan | （复用 sichuan 辣系路径或 heavy 文案） |
| hubei | （走 generic 兜底） |
| generic | 身在{region}，主厨为你选了最对味的一道 |

文案中的 `{region}` 替换为 `regionLabel`，`{dish}` 替换为 `heroName`。

### 链路一总结流程图

```
用户摇一摇
  │
  ▼
generateMenuWithFilters()
  ├── getActiveRegion() → { city, province }
  ├── getCuisineKeyByCity(city, province)
  │     → 'sichuan' / 'minyue' / 'generic' / ...（永不 null）
  ├── getTagsByCuisineKey('sichuan')
  │     → ['sichuan', 'spicy', 'numbing']
  ├── Math.random() < 0.4 ?
  │     ├── YES → flavorOptions.regionTags = tags
  │     │         globalData.lastRegionWeightTriggered = true
  │     └── NO  → regionTags 不注入
  │               globalData.lastRegionWeightTriggered = false
  │
  ├── pickOneWithStewBalance() 选菜
  │     └── regionTags 有值时，命中标签的菜 w += 2
  │
  ▼
preview.js 展示
  ├── injectRegionCopyContext()
  │     → context.regionLabel / regionCuisineKey
  ├── pickOmakaseCopy(context)
  │     ├── lastRegionWeightTriggered === true  → 地域文案
  │     └── lastRegionWeightTriggered === false → tired/expiring/heavy/light/random
  ▼
用户看到 omakase 文案
```

---

## 链路二：batch-planner → fusion-spider 的 cuisine 传递

### 阶段 1：分析 cuisine 覆盖矩阵

**文件**：`tools/batch-planner.js`

`getRecipeCuisine(recipe)` 从 `recipe.cuisine` 字段或 `recipe.tags` 数组中提取菜系标签：

```javascript
function getRecipeCuisine(recipe) {
  if (recipe.cuisine && CUISINES.includes(recipe.cuisine)) return recipe.cuisine;
  const tags = recipe.tags || [];
  for (const c of CUISINES) {
    if (tags.includes(c)) return c;
  }
  return null;
}
```

`buildCuisineMatrix(recipes)` 构建 `meat|cuisine → count` 二维矩阵：

```
{ 'pork|sichuan': 3, 'beef|cantonese': 1, 'lamb|minyue': 0, ... }
```

`findCuisineGaps(cuisineMatrix)` 发现空洞，优先级设定：

| 覆盖情况 | 优先级 |
|----------|--------|
| count = 0 | 0.5 × rarity |
| count = 1 | 0.2 × rarity |

优先级远低于主矩阵（meat × taste × flavor）的 3.0，**确保 cuisine 批次不抢占主矩阵位置**。

### 阶段 2：generateBatchPlan 混入 cuisine 批次

**文件**：`tools/batch-planner.js` — `generateBatchPlan()`

在 Batch 1–6（稀缺食材 / 风味多样 / 蒸凉拌 / 糖醋 / 薄弱加深 / cook_type）之后：

```javascript
// Batch 7 (低优先级): 地域菜系缺口 — meat × cuisine
const cuisineGaps = opts.cuisineGaps || [];
if (batches.length < maxBatches && cuisineGaps.length > 0) {
  const cuisineSlots = cuisineGaps
    .filter(g => g.count === 0)
    .slice(0, batchSize)
    .map(g => ({
      meat: g.meat, cuisine: g.cuisine,
      hint: `${CUISINE_CN[g.cuisine]} ${MEAT_CN[g.meat]} 地域扩展`,
    }));
  batches.push({ theme: '地域菜系扩展', slots: cuisineSlots });
}
```

Slot 对象带 `cuisine` 字段，如 `{ meat: 'lamb', cuisine: 'minyue', hint: '闽粤 羊肉 地域扩展' }`。

### 阶段 3：fusion-spider CLI 构建 slots

**文件**：`tools/recipe-fusion-spider.js` — CLI `main()`

```javascript
const {
  buildCuisineMatrix, findCuisineGaps, generateBatchPlan,
  CUISINE_CN, ...
} = await import('./batch-planner.js');

const cuisineMatrix = buildCuisineMatrix(unique);
const cuisineGaps = findCuisineGaps(cuisineMatrix);
const batches = generateBatchPlan(matrixGaps, cookTypeGaps, babyGaps, {
  cuisineGaps,   // ← 传入
});

const labelMap = { MEAT_CN, TASTE_CN, FLAVOR_CN, COOK_CN, CUISINE_CN };
for (const s of batch.slots) {
  const gap = {
    meat: s.meat, taste: s.taste, flavor: s.flavor_profile,
    cook_type: s.cook_type,
    cuisine: s.cuisine,   // ← cuisine 传递
    hint: s.hint,
  };
  slots.push(gapToSlot(gap, labelMap));
}
```

### 阶段 4：gapToSlot 生成搜索关键词 + 约束

**文件**：`tools/recipe-fusion-spider.js` — `gapToSlot()`

```javascript
export function gapToSlot(gap, labelMap = {}) {
  const parts = [];
  if (gap.cuisine && CUISINE_CN) parts.push(CUISINE_CN[gap.cuisine]);
  //                              ↑ 菜系中文放在最前面
  if (MEAT_CN && meat) parts.push(MEAT_CN[meat]);
  // ...
  const dishHint = gap.hint || parts.join(' ');
  // → "闽粤 羊肉 地域扩展"
  const constraints = {
    meat: gap.meat,
    cuisine: gap.cuisine || undefined,
    // ↑ cuisine 进入 constraints
  };
  return { dishHint, constraints };
}
```

### 阶段 5：fuseOneRecipe 爬取 + LLM 融合 + 强制覆盖

**文件**：`tools/recipe-fusion-spider.js` — `fuseOneRecipe()`

```javascript
// dishHint 作为爬虫搜索关键词
const refs = await crawlRefRecipes(dishHint, ...);
// constraints 传给 LLM 作为约束
const parsed = await callLlmForJson({ systemPrompt, constraintsJson, ... });

// 强制覆盖约束字段，确保 LLM 输出正确
if (constraints.cuisine) recipe.cuisine = constraints.cuisine;
```

### 阶段 6：Prompt 约定

**文件**：`tools/templates/recipe-fusion-prompt.md`

字段约定中声明：

> - **cuisine**（可选）：`cantonese`|`sichuan`|`jiangzhe`|`dongbei`|`hunan`|`minyue`|`yungui`|`xibei`|`huaiyang`。若输入中提供则输出 recipe 中必须带此字段。
> - **tags**：除属性标签外，若提供了 cuisine，应包含该菜系 tag。

### 阶段 7：云端持久化

| 环节 | 文件 | 机制 |
|------|------|------|
| 写入云端 | `tools/lib/cloud-db.js` — `buildCloudRecipeDoc()` | `...rest` 展开保留 `cuisine` |
| 读回本地 | `miniprogram/utils/cloudRecipeService.js` — `normalizeCloudRecipe()` | `basicFields` 包含 `'cuisine'` |

### 阶段 8：前端闭环

新生成的菜谱（带 `cuisine` 字段或对应 tags）通过云同步到小程序后：
- `defaultTagsForRecipe()` 通过 `CUISINE_NAME_HINTS` 推断 / `ensureRecipeTags()` 保留已有 tags
- LBS 加权时 `regionTags = ['minyue', 'soup', 'steamed', 'light']` 中的 `'minyue'` 可以匹配菜谱 tags
- 完成从「工具链生成」到「前端 LBS 加权命中」的闭环

### 链路二总结流程图

```
batch-planner.js
  │
  ├── buildCuisineMatrix(recipes)
  │     → { 'pork|sichuan': 3, 'lamb|minyue': 0, ... }
  ├── findCuisineGaps(matrix)
  │     → [{ meat:'lamb', cuisine:'minyue', count:0, priority:0.75 }]
  ├── generateBatchPlan(..., { cuisineGaps })
  │     └── Batch 7: '地域菜系扩展'
  │           slots: [{ meat:'lamb', cuisine:'minyue', hint:'闽粤 羊肉 地域扩展' }]
  │
  ▼
recipe-fusion-spider.js (CLI)
  ├── gapToSlot(gap, labelMap)
  │     → dishHint: "闽粤 羊肉 地域扩展"
  │     → constraints: { meat:'lamb', cuisine:'minyue' }
  │
  ├── fuseOneRecipe(dishHint, constraints)
  │     ├── crawlRefRecipes("闽粤 羊肉 地域扩展")  → 参考菜谱
  │     ├── callLlmForJson(systemPrompt, ...)       → LLM 融合
  │     ├── recipe.cuisine = 'minyue'               → 强制覆盖
  │     └── return { recipe, ... }
  │
  ▼
cloud-db.js  buildCloudRecipeDoc(recipe)
  └── ...rest 展开 → cuisine: 'minyue' 写入云端

cloudRecipeService.js  normalizeCloudRecipe(cloudRecipe)
  └── basicFields 含 'cuisine' → 读回时保留

  ▼
前端 defaultTagsForRecipe → tags 含 'minyue'
  → LBS 加权时 regionTags 含 'minyue' 可以匹配
  → 闭环 ✓
```

---

## 文件变更清单

| 文件 | 变更 | 所属模块 |
|------|------|----------|
| `miniprogram/data/regionCuisineMap.js` | 扩展至全国 + 海外 + generic 兜底 | Module 1 |
| `miniprogram/data/menuGenerator.js` | CUISINE_NAME_HINTS + defaultTagsForRecipe 推断; RECIPE_TAGS_VOCABULARY 扩展; 40% 概率门控 + flag | Module 2, 4 |
| `miniprogram/data/tasteProfile.js` | REGIONAL_SEASONAL_INGREDIENTS + pickHeroIngredient 地域化 | Module 3 |
| `miniprogram/pages/preview/preview.js` | regionLabel 兜底; 新菜系文案池; regionTriggered 联动 | Module 1.3, 2.2 |
| `tools/batch-planner.js` | CUISINES/CUISINE_CN; buildCuisineMatrix; findCuisineGaps; Batch 7 | Module 5.1 |
| `tools/recipe-fusion-spider.js` | cuisine in constraints + gapToSlot 适配 | Module 5.2 |
| `tools/templates/recipe-fusion-prompt.md` | 字段约定新增 cuisine + tags | Module 5.3 |
| `tools/lib/cloud-db.js` | buildCloudRecipeDoc 保留 cuisine | Module 5.4 |
| `miniprogram/utils/cloudRecipeService.js` | normalizeCloudRecipe basicFields 含 cuisine | Module 5.4 |
