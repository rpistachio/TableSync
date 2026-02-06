# TableSync — 家庭餐桌智能助手

微信小程序：根据人数、荤素配比、忌口与口味偏好生成今日菜单，并输出购物清单与做菜步骤。

---

## 一、数据结构

### 1. 菜谱数据源与优先级

| 来源 | 说明 |
|------|------|
| **云端** | 微信云开发 `recipes` 集合，含完整字段（ingredients、steps、封面等） |
| **本地缓存** | `wx.setStorageSync('cloud_recipes_adult'/'cloud_recipes_baby')`，云端拉取后写入 |
| **本地 fallback** | `miniprogram/data/recipes.js`，精简版（仅算法字段，无 ingredients/steps），离线时保证菜单生成不报错 |

**统一入口**：`menuData.getRecipeSource()` → `{ adultRecipes, babyRecipes, source: 'cloud'|'local' }`。业务层通过 `cloudRecipeService.getAdultRecipes()` / `getBabyRecipes()` 获取，内部已实现「云端 → 缓存 → recipes.js」降级。

**单道菜核心字段（算法/展示）**：

- 算法必需：`id`, `name`, `type`, `meat`, `taste`, `flavor_profile`, `cook_type`, `dish_type`, `prep_time`, `cook_minutes`, `is_baby_friendly`, `can_share_base`, `common_allergens`, `base_serving`
- 展示用（云端/完整版才有）：`ingredients`, `steps`, `baby_variant`, `cover_image_url` 等

### 2. 菜单：完整格式 vs 存储格式（MenuSlim）

**完整菜单项**（内存/页面间传递）：

```js
{
  adultRecipe: { /* 完整菜谱对象 */ },
  babyRecipe: { /* 或 null */ },
  meat: 'chicken',
  taste: 'quick_stir_fry',
  checked: true
}
```

**存储用精简格式（MenuSlim）**：仅存 ID，减小 Storage 体积。

```js
{
  adultRecipeId: 'm001',
  babyRecipeId: null,
  meat: 'chicken',
  taste: 'quick_stir_fry',
  checked: true
}
```

- 序列化：`menuData.serializeMenusForStorage(menus)`
- 反序列化：`menuData.deserializeMenusFromStorage(slimMenus, { babyMonth, adultCount, hasBaby, babyTaste })`
- 判断：`menuData.isSlimMenuFormat(menus)`（有 `adultRecipeId` 且无 `adultRecipe` 即为 slim）

### 3. 购物清单

- 生成：`menuData.generateShoppingListFromMenus(preference, menus)` 或 `menuData.generateShoppingList(preference)`（单菜）。
- 每条：`{ id, name, sub_type, amount, rawAmount, unit, checked, category, order, isShared }`。
- **离线降级**：当菜谱无 `ingredients`（使用精简版 recipes.js）时，清单仍会生成主料兜底项，且返回的数组上会挂载 `_isOfflineFallback: true`、`_offlineHint: '...'`，供 UI 提示「联网后可获取完整清单」。

### 4. 用户偏好（与逻辑层约定）

页面传给逻辑层的偏好对象建议统一为：

```js
{
  adultCount: 2,
  hasBaby: false,
  babyMonth: 12,
  meatCount: 1,
  vegCount: 1,
  soupCount: 0,
  avoidList: [],      // 忌口：如 ['spicy','cilantro']
  dietStyle: 'home',  // 口味：'home'|'light'|'rich'|'quick'
  isTimeSave: false
}
```

详见 `miniprogram/logic/DATA_PROTOCOL.md`。

### 5. 本地 Storage 键

| 键 | 说明 |
|----|------|
| `today_menus` | 今日菜单，可能是**完整**或 **MenuSlim** JSON；preview 确认后写入为 slim |
| `today_menus_preference` | 生成菜单时的 preference JSON，用于 slim 还原 |
| `menu_generated_date` | 日期 key（YYYY-MM-DD），跨天清空今日菜单相关 key |
| `cart_ingredients` | 合并后的购物清单数组（可能带 `_isOfflineFallback`） |
| `selected_dish_name` | 今日菜名摘要，如「番茄炒蛋、清炒时蔬」 |
| `today_prep_time` | 今日备菜最长时间（分钟） |
| `today_allergens` | 今日过敏原 JSON 数组 |
| `cloud_recipes_adult` / `cloud_recipes_baby` | 云端菜谱缓存 |
| `cloud_recipes_last_sync` | 上次同步时间 |
| `cloud_recipes_version` | 缓存版本号 |
| `menu_history` | 历史菜单（按日期 key 存，最多 7 天） |

---

## 二、产品 UI 与页面流程

### 页面路由（app.json）

1. **home** — 首页：人数、荤素汤配比、是否带娃、月龄、忌口/口味 → 点击「生成今日菜单」
2. **spinner** — 转盘动效页：用当日菜单主菜/素菜/汤品名做转盘，结束后自动跳转
3. **preview** — 预览页：展示当日多道菜卡片、看板（耗时/灶台/营养提示）、可勾选替换单道菜 →「开始做饭」
4. **menu** — 菜单概览（可从 tab 等进入）：展示今日菜单与第一道菜的食材摘要，支持从 Storage 还原 slim 格式
5. **shopping** — 购物清单：勾选已买、展示品类与用量
6. **steps** — 做菜步骤：多菜时支持并行流水线步骤，可线性/并行两种模式

### 主流程

```
首页(home) 设置偏好 → 点击生成
  → getTodayMenusByCombo(preference)
  → globalData.todayMenus + preference
  → navigateTo 转盘(spinner)

转盘(spinner) 结束
  → generateShoppingListFromMenus + 写入 cart_ingredients、today_menus(完整)、menu_generated_date
  → buildPreviewPayload → globalData.menuPreview
  → redirectTo 预览(preview)

预览(preview) 确认「开始做饭」
  → generateShoppingListFromMenus
  → 写入 cart_ingredients、today_menus(改为 slim)、today_menus_preference、selected_dish_name、today_prep_time、today_allergens
  → navigateTo 购物清单(shopping)
```

从 **menu** / **steps** 进入时，若读到的是 slim 的 `today_menus`，会先 `deserializeMenusFromStorage(parsed, storedPref)` 再使用。

### 步骤数据协议（与逻辑层约定）

步骤列表每项包含：`id`, `recipeId`, `text`, `step_type`, `duration_num`, `actionType`, `parallel`, `isPhaseStart`, `phaseTitle`, `phaseSubtitle`, `parallelContext` 等。详见 `miniprogram/logic/DATA_PROTOCOL.md`。页面通过 `menuData.generateSteps(preference, options)` 获取；`options.forceLinear === true` 时强制线性步骤（不做多菜并行）。

---

## 三、需要同步/一致的关键点

### 1. 云端与本地菜谱

- **云集合**：`recipes`，字段需与 `recipeSchema.js` 及 `cloudRecipeService.normalizeCloudRecipe()` 一致（如 `main_ingredients` + `seasonings` 合并为本地 `ingredients`）。
- **同步**：`app.onLaunch` 中 `cloudRecipeService.init({ autoSync: true })`；手动刷新可用 `getApp().syncCloudRecipes({ forceRefresh: true })`。
- **本地 fallback**：`recipes.js` 为精简版（由 `tools/slim-recipes.js` 生成），仅保留算法字段；完整版备份在 `recipes.full.bak.js`。若在 tools 侧修改菜谱，需同步更新云端或备份后再跑 slim 脚本。

### 2. 草稿 → 云端 → 封面（tools 侧）

- **generate**：`tools/generate.js` / `trend-hunter.js` 生成草稿 JSON。
- **sync**：`tools/sync.js --draft <path> [--index n] [--image <path>]` 上传封面、写云数据库，并可选更新本地 `recipes.js` / `recipeCoverSlugs.js`。
- 约定：云库与本地 `recipeCoverSlugs.js`（菜名 → 封面 slug/fileID）需一致，否则预览/列表封面显示会错。

### 3. 菜单与购物清单

- 写入 `today_menus` 的时机有两处：**spinner 结束**写完整菜单；**preview 确认**写 slim 菜单。后续所有读 `today_menus` 的页面都要兼容 slim（用 `isSlimMenuFormat` + `deserializeMenusFromStorage`）。
- 购物清单若来自无 `ingredients` 的菜谱，会带 `_isOfflineFallback` / `_offlineHint`，UI 应避免报错并可选择展示提示。

### 4. 历史与跨天

- 历史菜单存 `menu_history`，按日期 key 存，最多 7 天；条目内为 slim 菜单 + preference。
- 首页 `onLoad` 若发现 `menu_generated_date !== 今日`，会清空 `today_menus`、`cart_ingredients`、`selected_dish_name`、`today_prep_time`、`today_allergens`，保证「今日」只对应一套数据。

### 5. 逻辑层与页面层

- 逻辑层（`menuGenerator.js`、`menuData.js`）不直接调用 `wx.setStorageSync` / `this.setData`，仅做输入→输出；写 Storage 与 setData 由页面完成。
- 偏好字段名以 `DATA_PROTOCOL.md` 为准（如 `avoidList`、`dietStyle`），避免与旧字段混用导致筛选/看板不一致。

---

## 四、技术栈与仓库结构（简要）

- **运行时**：微信小程序（云开发）。
- **核心逻辑**：`miniprogram/data/menuData.js`（数据源、菜单序列化、购物清单、历史）、`menuGenerator.js`（生成菜单、步骤、购物清单 raw、看板）。
- **云端同步**：`miniprogram/utils/cloudRecipeService.js`。
- **工具链**：`tools/` 下 generate、sync、slim-recipes、batch-sync 等，见 `tools/README-SYNC.md`。

以上为当前数据结构、产品 UI 交互与需要保持同步的要点的说明，便于协作与提交到 GitHub 时保持上下文一致。
