# TableSync · Software Design Specification

> **版本**: v1.7 · 2026-02-08  
> **用途**: 面向 AI Agent / 协作开发者的工程规范文档  
> **适用范围**: 项目全部运行时代码、云函数、工具链  
> **维护者**: TableSync 团队  
> **v1.7 变更**: 灵感篮子深层优化 — BasketItem 唯一键 uniqueId、addItem 幂等去重 (B-11); 主厨报告 reasoning 降级模板与 sourceDetail 强制; 首页冷启动 basketCount 同步 Storage、onBasketChange 通知  
> **v1.6 变更**: 代码审查对齐 — myRecipes 投篮、Preview 闭环清理/来源标签移入已部署; BasketItem 补充 meat 字段; Spinner 注入流程补充 globalData 写入链; 架构图更新  
> **v1.5 变更**: 新增第 10 章「灵感篮子交互规范」— 已部署/未部署清单、数据模型、Agent 必遵守规则  
> **v1.4 变更**: 新增 R-14 UI/算法变更隔离原则 — 改 UI 不动算法, 改算法不动 UI, 严格单一职责  
> **v1.3 变更**: 新增 R-12 UI 文件保护规则、R-13 WXML↔WXSS 一致性规则、X-11 禁止整体重写 WXML/WXSS 规则 — 防止业务逻辑修改意外破坏页面 UI  
> **v1.2 变更**: 新增第 9 章「用户行为埋点协议」— steps.js 核心烹饪页全链路事件追踪  
> **v1.1 变更**: 新增 R-11 UI 避让原则 (Donut/iOS safe-area); mood 标准枚举 (5 值); recipeImport 社区属性字段

---

## 目录

1. [Agent 工作手册 (必读)](#1-agent-工作手册-必读)
2. [API 设计](#2-api-设计)
3. [状态机与流程图](#3-状态机与流程图)
4. [数据模型](#4-数据模型)
5. [边界情况与容错](#5-边界情况与容错)
6. [与现有模块的交互点](#6-与现有模块的交互点)
7. [错误处理策略](#7-错误处理策略)
8. [验证工具与命令](#8-验证工具与命令)
9. [用户行为埋点协议 (Tracking Protocol)](#9-用户行为埋点协议-tracking-protocol)
10. [灵感篮子交互规范 (Inspiration Basket)](#10-灵感篮子交互规范-inspiration-basket)

---

## 1. Agent 工作手册 (必读)

> **本节告诉任何 AI Agent 四件事：你在哪里工作、你要遵守什么、你绝对不能做什么、多 Agent 并发安全规则。**

### 1.1 你在哪里工作

```
工作区根目录: /Users/ronafan/WeChatProjects/TableSync

关键目录:
├── miniprogram/              # 微信小程序主代码 (WXML/WXSS/JS/WXS)
│   ├── pages/                # 10 个页面模块 (home/spinner/preview/menu/steps/shopping/scan/import/mix/myRecipes)
│   ├── data/                 # 数据层 (recipes.js, menuData.js, menuGenerator.js, recipeSchema.js, recipeCoverSlugs.js)
│   ├── logic/                # 业务逻辑层 (comboOptions.js, dashboard.js, DATA_PROTOCOL.md)
│   ├── utils/                # 工具层 (cloudRecipeService.js, imageLib.js, step-helper.js, menuHistory.js)
│   └── config/               # 配置 (constant.js)
├── cloudfunctions/           # 微信云函数 (5个: fridgeScan, smartMenuGen, recipeImport, recipeCoverGen, getWeather)
├── tools/                    # Node.js 自动化工具链 (ES Module, 用 dotenv 加载 .env)
├── docs/                     # 文档目录 (本文件所在)
├── src/                      # Vue 3 Web 版 (备用, 不在主开发路径上)
└── scripts/                  # 辅助脚本 (steps_sanity_check.js)
```

**技术栈**:
- 前端: 微信小程序原生框架 (WXML + WXSS + JS + WXS), 不使用 TypeScript
- 云端: 微信云开发 (TCB), Node.js 运行时, wx-server-sdk
- 数据库: 微信云开发 MongoDB (文档型)
- 文件存储: 微信云存储 (COS)
- AI 服务: Kimi (月之暗面) Vision/Chat, MiniMax Image API, OpenAI DALL-E 2
- 天气: 和风天气 QWeather
- 工具链: Node.js ES Module + @anthropic-ai/sdk + @cloudbase/node-sdk + dotenv

**运行环境**:
- 小程序: 微信开发者工具 / 真机调试
- 云函数: 微信云开发控制台部署
- 工具链: 本地 Node.js (>= 18), 在 `tools/` 目录下运行

**Donut / iOS 冷启动** (1.1 与 10.7): 进程被杀后重开时 `globalData` 清空而 Storage 仍在。首页 `basketCount` 初值须从 Storage 同步读取（如 data 初始化时或 onLoad 首行），避免角标 0→N 闪烁；入篮/出篮后可选调用 `getApp().onBasketChange(count)`，home 在 onShow 注册、onHide 注销，使 .basket-bar 平滑更新。

**你现在要改什么？**
├── UI 展示 / 交互 → pages/
├── 菜单逻辑 / 生成 → data/ logic/
├── 数据来源 / 同步 → cloudRecipeService
├── AI 能力 → cloudfunctions/

### 1.2 你要遵守什么规则

| 编号 | 规则 | 说明 |
|------|------|------|
| R-01 | **纯函数设计** | `menuGenerator.js` 中的核心函数 (`filterByPreference`, `calculateScaling`, `computeDashboard`) 是纯函数, 不得在其中调用 `wx.setStorageSync` 或 `this.setData` |
| R-02 | **数据协议一致** | 页面层传递 `userPreference` 必须使用 `{ avoidList, dietStyle, isTimeSave }` 字段名, 不得使用 `allergens` / `dietary_preference` / `is_time_save` 等旧命名 (见 `logic/DATA_PROTOCOL.md`) |
| R-03 | **三级降级** | 数据获取必须遵循: 内存缓存 → 本地 Storage → 本地 `recipes.js` 兜底, 任何一级失败必须 fallback 到下一级 |
| R-04 | **步骤数据协议** | `generateSteps()` 返回的每个 step 必须包含: `id`, `recipeId`, `text`, `step_type`, `duration_num`, `actionType`, `parallel` 字段 (见 `DATA_PROTOCOL.md`) |
| R-05 | **云端格式转本地** | 云端菜谱使用 `main_ingredients` + `seasonings` 分块存储; 本地统一为 `ingredients` 数组; 转换在 `cloudRecipeService.js` 中完成, 不得在页面层自行拼装 |
| R-06 | **CSS 高度约束** | 不得使用 `height: 100vh` 或 `height: 100%` (项目中有 `.cursor/rules/no-height-100.mdc` 限制) |
| R-07 | **兜底图片** | 所有封面图渲染必须提供 fallback, 使用 `recipeCoverSlugs.js` 中的 `DEFAULT_COVER_URL` 作为兜底 |
| R-08 | **增量同步** | 云端数据同步必须基于 `updateTime` 字段做增量拉取, 不得每次全量拉取 |
| R-09 | **分页拉取** | 云数据库单次最多返回 100 条, 必须实现分页循环拉取直到数据完整 |
| R-10 | **模块导入路径** | 页面 JS 通过 `require('../../data/menuGenerator.js')` / `require('../../data/menuData.js')` 引入逻辑层, 不得自建同名导出 |
| R-11 | **UI 避让原则** | 所有全屏页面必须使用自定义 Navigation Bar, 并预留 iOS 灵动岛/刘海屏的 safe-area 高度; 不得硬编码顶部距离, 必须通过 `wx.getSystemInfoSync().statusBarHeight` + `wx.getMenuButtonBoundingClientRect()` 动态计算; Donut 多端适配时同样遵守此规则 |
| R-12 | **UI 文件保护 (WXML/WXSS 不可随意重写)** | 修改业务逻辑 (JS) 时, **严禁** 重写或整体替换同页面的 `.wxml` / `.wxss` 文件。只允许 **增量修改** (添加/删除/调整局部标签或样式规则)。如需在 WXML 中新增 class, 必须在对应 WXSS 中同步添加样式定义, 确保 WXML 引用的每个 class 在 WXSS 中都有对应规则。违反此规则会导致整个页面样式丢失、UI 崩坏。 |
| R-13 | **WXML ↔ WXSS 一致性** | 每次修改 `.wxml` 或 `.wxss` 后, 必须验证: ① WXML 中每个 class 名在 WXSS 中有对应规则; ② WXSS 中不存在孤立的、WXML 未引用的新规则 (历史遗留可保留); ③ 嵌套标签 `<view>` / `</view>` 完全配对, 无多余/遗漏 |
| R-14 | **UI / 算法变更隔离 (单一职责)** | **改 UI 就不动算法, 改算法就不动 UI。** 具体而言: ① 当任务目标是"修改算法逻辑"(如 `menuGenerator.js` 的设备调度、`menuData.js` 的菜单生成) 时, 只允许修改 `data/` 和 `logic/` 目录下的 JS 文件, **严禁** 同时修改任何页面的 `.wxml` / `.wxss` 文件; ② 当任务目标是"修改页面 UI"(如 steps 页面 Cook Mode 重构) 时, 只允许修改对应页面的 `.wxml` / `.wxss` / 页面 `.js` 文件, **严禁** 同时修改 `menuGenerator.js` / `menuData.js` 等数据算法文件; ③ 如果一个需求确实横跨 UI 和算法, 必须拆分为两个独立步骤: 先完成算法改动并验证通过, 再进行 UI 改动 (或反过来), 每步完成后各自验证。**历史教训**: 灶台适配(算法任务)期间意外重写了 home/steps 的 WXML/WXSS/JS, 导致首页和步骤页 UI 全部崩坏 |

### 1.3 你绝对不能做什么

| 编号 | 禁止行为 | 原因 |
|------|----------|------|
| X-01 | **不得在逻辑层/数据层调用 `wx.*` API** | 逻辑层必须保持纯函数可测试性, `wx.*` 调用只能在页面层 |
| X-02 | **不得修改 `recipes.js` 的精简字段结构** | 这是离线兜底数据, 仅保留菜单生成算法核心字段; 完整数据必须从云端获取 |
| X-03 | **不得在云函数中硬编码 API Key** | 所有密钥必须放在 `secret-config.json` 或环境变量中, `secret-config.json` 已被 `.gitignore` 忽略 |
| X-04 | **不得删除或重命名 `cloudRecipeService.js` 的公开接口** | `init()`, `getAdultRecipes()`, `getBabyRecipes()`, `syncFromCloud()` 被多个页面依赖 |
| X-05 | **不得修改菜谱的 `id` 生成规则** | ID 格式 (如 `a-chi-1`, `b-porridge-1`, `m001`) 已在云数据库和本地缓存中广泛引用 |
| X-06 | **不得在 `menuGenerator.js` 中引入异步操作** | 该文件所有导出函数必须是同步纯函数, 异步操作应在调用方处理 |
| X-07 | **不得跳过安全网校验** | `cloudRecipeService.js` 中有数据量安全网 (云端数据少于本地基线 50% 时用本地 fallback 补齐), 不得绕过 |
| X-08 | **不得直接修改 `project.config.json` 中的 appid** | 这会导致微信开发者工具绑定失败 |
| X-09 | **不得在工具链中使用 CommonJS (`require`)** | `tools/` 目录是 ES Module (`"type": "module"`), 必须使用 `import/export` |
| X-10 | **不得 push 含 `secret-config.json` / `.env` 的 commit** | 这些文件包含 API 密钥, 泄露会导致严重安全问题 |
| X-11 | **不得在修改 JS 逻辑时整体重写 WXML/WXSS** | 修改后端逻辑 (`menuGenerator.js` / `menuData.js` / `home.js` 等) 时, 不得对同页面的 WXML/WXSS 做全文替换。只允许定点增量编辑。历史教训: 灶台适配改动期间, `home.wxss` 被错误地整体替换为不相干的样式表, 导致首页 UI 完全崩坏 |
| X-12 | **不得在同一次改动中混合修改算法层和 UI 层** | 算法层 = `data/menuGenerator.js`, `data/menuData.js`, `logic/`; UI 层 = `pages/**/*.wxml`, `pages/**/*.wxss`, 页面 JS 的视图/交互逻辑。一次 commit 中不得同时包含两层的实质性变更 (纯透传参数的一行桥接代码除外)。必须先完成一层并验证, 再改另一层 |

### 1.4 多 Agent 并发安全规则

当多个 AI Agent 同时修改本项目时, 必须遵循以下规则:

| 编号 | 规则 | 详细说明 |
|------|------|----------|
| C-01 | **文件锁定** | 每个 Agent 一次只操作一个文件, 修改前必须检查 git status 确认无冲突 |
| C-02 | **不得并发写同一文件** | `menuGenerator.js` (3053行)、`menuData.js` (1485行) 等核心文件, 同一时间只允许一个 Agent 修改 |
| C-03 | **数据层只读** | `recipes.js` 和 `recipeCoverSlugs.js` 只能通过 `tools/sync.js` 工具修改, Agent 不得直接手动编辑这两个文件 |
| C-04 | **云函数独立部署** | 每个云函数 (`fridgeScan/`, `smartMenuGen/`, `recipeImport/`, `recipeCoverGen/`, `getWeather/`) 是独立部署单元; 修改某个云函数不应影响其他云函数 |
| C-05 | **Storage Key 命名空间** | 本地 Storage Key 必须加前缀避免冲突, 已有命名空间: `cloud_recipes_*` (cloudRecipeService), `menu_history_*` (menuHistory), `imported_recipes_*` (myRecipes) |
| C-06 | **幂等性要求** | 所有云函数必须设计为幂等的: 重复调用同一请求应产生相同结果, 不产生重复数据 |
| C-07 | **分支隔离** | 多 Agent 并发开发时, 每个 Agent 应在独立 feature 分支上工作, 通过 PR 合并到 main |
| C-08 | **测试先行** | 修改 `menuGenerator.js` 或 `menuData.js` 后, 必须运行 `node scripts/steps_sanity_check.js` 验证步骤生成的完整性 |
| C-09 | **不得并发同步云数据库** | `tools/batch-sync-recipes.js` 和 `tools/sync.js` 不得同时运行, 否则可能产生重复记录 |
| C-10 | **配置文件隔离** | 每个 Agent 使用独立的 `tools/.env` 配置, 不得在代码中硬编码另一个 Agent 的环境变量 |

---

## 2. API 设计

### 2.1 云函数 API 总览

本项目通过微信云函数 (`wx.cloud.callFunction`) 暴露 5 个 API 端点。所有调用方式统一为:

```javascript
wx.cloud.callFunction({
  name: '<云函数名>',
  data: { /* 请求参数 */ }
})
```

### 2.2 fridgeScan — 冰箱扫描识别 + AI 组餐

**端点**: `wx.cloud.callFunction({ name: 'fridgeScan' })`  
**超时**: 60s  
**内存**: 256MB

**请求 Schema**:

```javascript
{
  // 必填: 冰箱照片的云文件 ID 列表 (最多 5 张)
  imageFileIDs: ["cloud://xxx/img1.jpg", "cloud://xxx/img2.jpg"],
  
  // 可选: 用户偏好
  preference: {
    adultCount: Number,       // 用餐人数, 默认 2
    hasBaby: Boolean,         // 是否有宝宝, 默认 false
    babyMonth: Number,        // 宝宝月龄 6-36, 默认 12
    avoidList: [String],      // 忌口列表, 如 ["seafood", "spicy"]
  }
}
```

**响应 Schema**:

```javascript
// 成功
{
  code: 0,
  data: {
    ingredients: [            // AI 识别出的食材列表
      {
        name: String,         // 食材名, 如 "鸡胸肉"
        confidence: Number,   // 置信度 0-1
        category: String      // 分类: 肉类/蔬菜/蛋类/干货/调料/其他
      }
    ],
    recommendations: [        // AI 推荐的菜品
      {
        recipeId: String,     // 菜谱 ID
        recipeName: String,   // 菜名
        matchScore: Number,   // 匹配度 0-1
        missingIngredients: [String]  // 缺少的食材
      }
    ]
  }
}

// 错误
{ code: 400, message: "缺少 imageFileIDs 参数" }
{ code: 500, message: "AI 识别服务暂时不可用" }
```

**错误码**:

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| 0 | 成功 | 正常返回 |
| 400 | 参数错误 | 缺少 `imageFileIDs` 或数组为空 |
| 413 | 图片过多 | `imageFileIDs.length > 5` |
| 500 | 内部错误 | Kimi Vision API 调用失败 / 数据库查询异常 |
| 503 | AI 服务不可用 | Kimi API 超时或返回非 200 |

---

### 2.3 smartMenuGen — 智能菜单推荐

**端点**: `wx.cloud.callFunction({ name: 'smartMenuGen' })`  
**超时**: 60s  
**内存**: 256MB

**请求 Schema**:

```javascript
{
  // 必填: 用户偏好
  preference: {
    adultCount: Number,       // 用餐人数 1-6
    hasBaby: Boolean,
    babyMonth: Number,        // 6-36
    meatCount: Number,        // 荤菜数量 1-3
    vegCount: Number,         // 素菜数量 0-3
    soupCount: Number,        // 汤品数量 0-1
    soupType: "meat" | "veg", // 汤品类型
    avoidList: [String],
    dietStyle: "home" | "light" | "rich" | "quick",
    isTimeSave: Boolean
  },
  
  // 可选: 上下文信息
  mood: String,               // 心情标准枚举 (见下方 Mood 枚举表)
  weather: {                  // 天气信息
    text: String,             // 如 "晴"
    temp: Number              // 如 8
  },
  recentDishNames: String,    // 近期菜名 (逗号分隔), 用于去重
  candidates: [Object]        // 候选菜谱列表 (精简格式)
}
```

**Mood 枚举标准值**:

> 客户端 UI 显示中文, 但传给云函数和 AI 的标准值使用英文枚举, 便于模型训练和数据分析。

| 枚举值 (传给 AI) | 客户端 UI 文本 | AI 推荐倾向 | 说明 |
|-------------------|---------------|-------------|------|
| `"exhausted"` | 疲惫 | 快手菜、少步骤、cook_minutes ≤ 20 | 用户精力不足, 优先省时方案 |
| `"celebratory"` | 开心 | 复杂菜、多菜品、丰盛组合 | 有兴致做大餐, 可推荐炖菜/硬菜 |
| `"health_conscious"` | 想吃轻食 | 蒸/拌为主、低油低盐、vegetable 占比高 | dietStyle 自动倾向 `"light"` |
| `"craving_heavy"` | 馋了 | 重口味、salty_umami/spicy、肉类多 | dietStyle 自动倾向 `"rich"` |
| `"random"` | 随便 | 无特殊偏向, 完全按 preference 生成 | 默认值, 不附加额外 AI 权重 |

> **兼容性**: 旧版客户端可能传 `"开心"` / `"疲惫"` 等中文值, 云函数 `prompt-builder.js` 需做 fallback 映射:
> `"开心" → "celebratory"`, `"疲惫" → "exhausted"`, `"馋了" → "craving_heavy"`, `"随便" → "random"`

```javascript
// (续上方请求 Schema 闭合)
```

**响应 Schema**:

```javascript
// 成功
{
  code: 0,
  data: {
    recipeIds: [String]       // AI 推荐的菜谱 ID 列表
  }
}

// 错误
{ code: 400, message: "参数校验失败" }
{ code: 500, message: "AI 推荐服务异常" }
```

**降级策略**: 此 API 失败时, 客户端自动调用 `menuGenerator.generateMenuWithFilters()` 做本地随机生成。

---

### 2.4 recipeImport — 菜谱导入

**端点**: `wx.cloud.callFunction({ name: 'recipeImport' })`  
**超时**: 60s  
**内存**: 256MB

**请求 Schema**:

```javascript
// 模式 A: 链接导入
{
  mode: "link",
  url: String               // 小红书/抖音等链接
}

// 模式 B: 截图导入
{
  mode: "image",
  imageFileIDs: [String]    // 截图云文件 ID (最多 5 张)
}
```

**响应 Schema**:

```javascript
// 成功
{
  code: 0,
  data: {
    recipe: {
      name: String,
      type: "adult",
      source: "external",
      meat: String,
      taste: String,
      flavor_profile: String,
      cook_type: String,
      prep_time: Number,
      cook_minutes: Number,
      is_baby_friendly: Boolean,
      common_allergens: [String],
      main_ingredients: [{
        name: String,
        amount: Number,
        unit: String,
        category: String
      }],
      seasonings: [{
        name: String,
        amount: Number,
        unit: String
      }],
      steps: [{
        step_index: Number,
        step_type: "prep" | "cook",
        duration_num: Number,
        text: String
      }],

      // --- 社区属性字段 (v1.1 新增) ---
      is_public_candidate: Boolean,       // 是否符合社区共享标准 (内容完整度 > 80%: 有名称+食材+步骤+时间)
      content_completeness: Number,       // 内容完整度评分 0-100 (AI 自动计算)
      original_source_attribution: String // 自动提取的原作者/博主名 (如 "小红书@xxx", "抖音@xxx")
    }
  }
}

// 错误
{ code: 400, message: "缺少链接或截图" }
{ code: 422, message: "无法解析该链接内容" }
{ code: 500, message: "AI 提取服务异常" }
```

**错误码**:

| 错误码 | 含义 | 触发条件 |
|--------|------|----------|
| 0 | 成功 | — |
| 400 | 参数缺失 | 既无 url 也无 imageFileIDs |
| 422 | 内容无法解析 | 链接抓取失败或 AI 无法从截图中提取菜谱结构 |
| 429 | 请求过于频繁 | Kimi API rate limit |
| 500 | 内部错误 | AI 服务调用异常 |

---

### 2.5 recipeCoverGen — 菜谱封面图生成

**端点**: `wx.cloud.callFunction({ name: 'recipeCoverGen' })`  
**超时**: 90s  
**内存**: 256MB

**请求 Schema**:

```javascript
{
  docId: String             // 必填: 云数据库文档 _id
}
```

**响应 Schema**:

```javascript
// 成功 (新生成)
{ code: 200, message: "封面已生成", coverUrl: "cloud://xxx/cover.png" }

// 成功 (已有封面, 跳过)
{ code: 200, message: "已有封面", coverUrl: "cloud://xxx/existing.png" }

// 成功 (未配置 API Key, 跳过)
{ code: 200, message: "未配置 API Key", skipped: true }

// 错误
{ code: 400, message: "缺少 docId" }
{ code: 404, message: "未找到对应菜谱记录" }
{ code: 500, message: "图片生成失败: <详细信息>" }
```

**处理链路**: 校验 docId → 读取 DB 记录 → 检查已有封面 → 构建 prompt → MiniMax API (主) / OpenAI DALL-E (备) → 上传云存储 → 更新 DB `coverUrl` 字段 → 返回结果

**MiniMax Image API 调用细节**:

```
POST https://api.minimax.io/v1/image_generation
Headers: Authorization: Bearer <MINIMAX_API_KEY>
Body: {
  model: "image-01",
  prompt: "<max 1500 chars>",
  aspect_ratio: "1:1",
  response_format: "base64",
  n: 1,
  prompt_optimizer: false
}
Timeout: 85s
```

---

### 2.6 getWeather — 天气获取

**端点**: `wx.cloud.callFunction({ name: 'getWeather' })`  
**超时**: 15s

**请求 Schema**:

```javascript
{
  latitude: Number,         // 纬度
  longitude: Number         // 经度
}
```

**响应 Schema**:

```javascript
// 成功
{
  code: 0,
  data: {
    text: String,           // 天气描述, 如 "晴"
    temp: Number,           // 温度, 如 8
    fullText: String        // 完整描述, 如 "晴 8°C"
  }
}

// 错误
{ code: 500, message: "天气服务暂时不可用" }
```

**降级策略**: 失败时静默处理, 首页不显示天气信息, 使用默认问候语。

---

### 2.7 客户端本地 API (非云函数)

以下是客户端内部重要的模块接口:

#### cloudRecipeService.js

```javascript
// 初始化 (app.js onLaunch 时调用)
await cloudRecipeService.init({ autoSync: true, forceRefresh: false })
// → { initialized: Boolean, localAdultCount: Number, localBabyCount: Number }

// 获取菜谱数据
cloudRecipeService.getAdultRecipes()   // → Recipe[]
cloudRecipeService.getBabyRecipes()    // → Recipe[]
cloudRecipeService.getAdultRecipeById(id)  // → Recipe | null
cloudRecipeService.getBabyRecipeById(id)   // → Recipe | null

// 手动同步
await cloudRecipeService.syncFromCloud({ forceRefresh, onProgress })
// → { adultCount, babyCount, fromCloud, newAdult, newBaby }

// 状态查询
cloudRecipeService.getSyncState()      // → { syncing, lastError, syncCount, lastSync, adultCount, babyCount }
cloudRecipeService.hasCloudData()      // → Boolean

// 调试
cloudRecipeService.clearCache()
```

#### menuGenerator.js 核心接口

```javascript
// 纯函数 (无副作用, 同步)
filterByPreference(recipes, userPreference)      // → Recipe[] (过滤忌口)
calculateScaling(recipe, totalCount)              // → Recipe   (份额缩放)
computeDashboard(menus, pref)                     // → Dashboard (看板数据)
normalizeUserPreference(pref)                     // → UserPreference (规范化)
getFallbackMessage(pref)                          // → String   (降级提示)

// 菜单生成 (同步)
generateMenu(options)                             // → Menu[]
generateMenuFromRecipe(recipe, babyMonth, hasBaby, adultCount, babyTaste)  // → Menu
generateMenuFromExternalRecipe(recipe, ...)       // → Menu
generateMenuWithFilters(recipes, userPreference, options)  // → Menu[]

// 辅助函数 (同步)
checkFlavorBalance(menus)                         // → { suggestions, analysis }
generateShoppingListRaw(menus)                    // → ShoppingItem[]
dynamicScaling(recipe, totalCount)                // → Recipe
```

#### menuData.js 核心接口

```javascript
getRecipeSource()                                 // → { adultRecipes, babyRecipes } (优先云端)
serializeMenusForStorage(menus)                   // → SlimMenu[] (精简存储)
deserializeMenusFromStorage(slimMenus, options)   // → Menu[]    (还原菜单)
getAdultRecipeById(id)                            // → Recipe | null
getBabyRecipeById(id)                             // → Recipe | null
saveMenuHistory(dateKey, menus, preferences)       // → void
getMenuHistoryByDate(dateKey)                     // → { menus, preferences } | null
hasTodayHistory()                                 // → Boolean
generateSteps(preference, options?)               // → Step[]  (多菜并行流水线)
```

---

## 3. 状态机与流程图

### 3.1 菜单生成主流程状态机

```
[IDLE] 用户在首页
  │
  ├── 点击"今天吃什么" ──→ [CONFIGURING] 转盘页
  │                            │
  │                            ├── 选择心情 (mood)
  │                            ├── 配置偏好 (preference)
  │                            └── 点击"开始"
  │                                 │
  │                                 ▼
  │                         [GENERATING_AI] 调用云函数 smartMenuGen
  │                            │          │
  │                       成功 │          │ 失败/超时
  │                            ▼          ▼
  │                   [AI_RESULT]    [FALLBACK_LOCAL]
  │                   AI 返回菜谱ID  调用 menuGenerator.generateMenuWithFilters()
  │                            │          │
  │                            └────┬─────┘
  │                                 │
  │                                 ▼
  │                         [SPINNING] 三环转盘动画
  │                                 │
  │                                 ▼ (动画结束)
  │                         [PREVIEWING] 菜单预览页
  │                            │          │
  │                       换菜 │          │ 确认
  │                   (回到选菜) │          │
  │                            │          ▼
  │                            │   [SHOPPING] 购物清单页
  │                            │          │
  │                            │          ▼ 点击"食材已买齐"
  │                            │   [COOKING] 烹饪步骤页
  │                            │          │
  │                            │     完成所有步骤
  │                            │          │
  │                            │          ▼
  │                            │   [COMPLETED] 料理完成
  │                            │          │
  │                            │          ▼ 保存历史记录
  │                            │   [IDLE] 返回首页
```

**状态转换说明**:

| 转换 | 触发条件 | 执行操作 |
|------|----------|----------|
| IDLE → CONFIGURING | 用户点击"今天吃什么" | `wx.navigateTo('/pages/spinner/spinner')` |
| CONFIGURING → GENERATING_AI | 用户点击"开始" | `wx.cloud.callFunction({ name: 'smartMenuGen' })` |
| GENERATING_AI → AI_RESULT | 云函数返回 `code: 0` | 解析 `recipeIds`, 映射到本地菜谱对象 |
| GENERATING_AI → FALLBACK_LOCAL | 云函数超时/返回非 0/catch 异常 | 调用 `_applyLocalMenus()`, console.warn 记录 |
| AI_RESULT / FALLBACK_LOCAL → SPINNING | 菜单数据就绪 | 构建转盘数据, 启动旋转动画 |
| SPINNING → PREVIEWING | 动画计时结束 | `wx.navigateTo('/pages/preview/preview')`, 数据写入 Storage |
| PREVIEWING → SHOPPING | 用户点击"开始做饭" | `wx.navigateTo('/pages/shopping/shopping')` |
| SHOPPING → COOKING | 用户点击"食材已买齐" | `wx.navigateTo('/pages/steps/steps')` |
| COOKING → COMPLETED | 最后一个步骤 `markCompleted` | `wx.showModal('料理完成！')`, 保存历史记录 |

---

### 3.2 云端数据同步状态机

```
[UNINITIALIZED]
  │
  ▼ cloudRecipeService.init()
  │
[CHECKING_CACHE] 检查内存缓存
  │
  ├── 内存缓存有效 ──→ [READY] (命中率最高, 最快)
  │
  ├── 内存缓存为空 ──→ [LOADING_LOCAL] 读取本地 Storage
  │                        │
  │                        ├── Storage 有数据 ──→ [READY] + 后台增量同步
  │                        │
  │                        └── Storage 为空 ──→ [SYNCING_CLOUD] 从云端全量拉取
  │                                               │
  │                                               ├── 成功 ──→ [READY]
  │                                               │            (数据写入内存 + Storage)
  │                                               │
  │                                               └── 失败 ──→ [OFFLINE_FALLBACK]
  │                                                             (使用本地 recipes.js)
  │
  └── 版本号不匹配 ──→ [SYNCING_CLOUD] 强制全量刷新

[READY] ──→ 后台定期增量同步 ──→ [SYNCING_CLOUD]
  │                                    │
  │                                    ├── 新数据 > 0 ──→ 合并到缓存 ──→ [READY]
  │                                    │
  │                                    └── 无新数据 ──→ [READY]

[SYNCING_CLOUD] 安全网检查:
  │
  ├── 云端数量 >= 本地基线 50% ──→ 正常使用云端数据
  │
  └── 云端数量 < 本地基线 50% ──→ 用本地 recipes.js 补齐 (标记 _isOfflineFallback)
```

**增量同步细节**:
1. 查询条件: `db.collection('recipes').where({ updateTime: _.gt(lastSyncTime) })`
2. 分页: 每次 limit 100, 循环 skip 直到无数据
3. 合并策略: 按 `id` 匹配, 新增或覆盖
4. 写入顺序: 先内存缓存, 再异步写入 Storage

---

### 3.3 冰箱扫描流程状态机

```
[IDLE] 扫描页
  │
  ▼ 用户选择照片 (最多 5 张)
  │
[UPLOADING] 并行上传图片到云存储
  │
  ▼ 所有图片上传完成
  │
[RECOGNIZING] 调用 fridgeScan 云函数
  │ (内部: Kimi Vision 并行识别 + 数据库加载菜谱库)
  │
  ├── 成功 ──→ [RESULT_READY] 展示食材列表 + 推荐菜品
  │                │
  │                ├── 用户编辑/补充食材 ──→ [RESULT_READY] (更新推荐)
  │                │
  │                └── 用户勾选菜品, 点击"开始做" ──→ 跳转购物/步骤
  │
  └── 失败 ──→ [ERROR] 显示错误提示, 可重试
```

---

### 3.4 菜谱导入流程状态机

```
[IDLE] 导入页
  │
  ├── 粘贴链接 ──→ [FETCHING] 云函数 recipeImport (mode: "link")
  │                    │
  │                    ├── 成功 ──→ [PREVIEW] 展示结构化菜谱
  │                    └── 失败 ──→ [ERROR] "无法解析该链接"
  │
  └── 选择截图 ──→ [UPLOADING] 上传图片
                     │
                     ▼
                 [EXTRACTING] 云函数 recipeImport (mode: "image")
                     │
                     ├── 成功 ──→ [PREVIEW] 展示结构化菜谱
                     └── 失败 ──→ [ERROR] "无法从截图中提取菜谱"

[PREVIEW] 菜谱预览 (可编辑)
  │
  ├── "直接开始做" ──→ 跳转步骤页
  │
  └── "保存到我的菜谱" ──→ [SAVING] 写入云DB + 本地缓存
                              │
                              └── 完成 ──→ [SAVED] 跳转我的菜谱页
```

---

### 3.5 并行烹饪流水线状态机

```
[INIT] 接收菜单数据
  │
  ▼ 调用 menuData.generateSteps(preference, options)
  │
[PHASE_1_PREP] 全局统一备菜
  │ · 合并所有菜的 prep 步骤
  │ · 去重 (同一食材只切一次)
  │ · isPhaseStart: true, phaseType: 'prep'
  │
  ▼ 所有 prep 步骤完成
  │
[PHASE_2_LONG_TERM] 启动长耗时任务
  │ · 识别 actionType === 'long_term' 的步骤
  │ · 优先启动 (利用等待时间做其他事)
  │ · isPhaseStart: true, phaseType: 'long_term'
  │
  ▼ 长耗时任务开始执行
  │
[PHASE_3_GAP_FILL] 间隙填充
  │ · 在 waitTime 窗口中插入其他菜的 active/idle_prep 步骤
  │ · parallelContext: { activeTaskName, remainingMinutes, hint }
  │ · isPhaseStart: true, phaseType: 'gap'
  │
  ▼ 所有烹饪步骤完成
  │
[PHASE_4_FINISH] 统一收尾
  │ · 出锅/装盘步骤
  │ · isPhaseStart: true, phaseType: 'finish'
  │
  ▼
[DONE] 料理完成

异常降级:
  任何阶段检测到缺料/数据异常
  ──→ options.forceLinear = true
  ──→ 回退为按菜品顺序的线性步骤 (不启用并行)
  ──→ parallel 字段多数为 false, parallelContext 为空
```

---

## 4. 数据模型

### 4.1 Recipe (菜谱) — 核心实体

#### 4.1.1 本地精简格式 (`recipes.js`, 用于离线算法)

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `id` | String | 是 | 唯一, 格式: `a-xxx-N` (成人) / `b-xxx-N` (宝宝) / `mNNN` (新版) | — | 业务主键 |
| `name` | String | 是 | 非空, 中文菜名 | — | 如 "宫保鸡丁" |
| `type` | String | 是 | `"adult"` \| `"baby"` | — | 菜谱类型 |
| `meat` | String | 是 | `"chicken"` \| `"pork"` \| `"beef"` \| `"fish"` \| `"shrimp"` \| `"vegetable"` | — | 主料类型 |
| `taste` | String | 是 | 成人: `"quick_stir_fry"` \| `"slow_stew"` \| `"steamed_salad"` ; 宝宝: `"finger_food"` \| `"soft_porridge"` \| `"braised_mash"` | — | 烹饪风格 |
| `flavor_profile` | String | 否 | `"salty_umami"` \| `"light"` \| `"spicy"` \| `"sweet_sour"` \| `"sour_fresh"` | `null` | 风味画像 |
| `cook_type` | String | 否 | `"stir_fry"` \| `"stew"` \| `"steam"` \| `"cold_dress"` | `null` | 烹饪方式 |
| `dish_type` | String | 否 | `"soup"` \| `null` | `null` | 菜品类型 |
| `prep_time` | Number | 是 | >= 0, 单位: 分钟 | `0` | 备菜时间 |
| `cook_minutes` | Number | 是 | >= 0, 单位: 分钟 | `0` | 烹饪时间 |
| `is_baby_friendly` | Boolean | 是 | — | `false` | 是否可做宝宝版 |
| `can_share_base` | Boolean | 是 | — | `false` | 是否可共享底料 |
| `common_allergens` | Array\<String\> | 是 | 元素: `"peanut"`, `"seafood"`, `"egg"`, `"soy"`, `"gluten"`, `"lactose"`, `"beef_lamb"` 等 | `[]` | 过敏原列表 |
| `base_serving` | Number | 是 | > 0 | `2` | 基准份量 (人) |
| `tags` | Array\<String\> | 否 | 如 `["quick", "home", "high_protein"]` | `[]` | 标签 |
| `coverFileID` | String | 否 | `cloud://...` 格式 | `null` | 封面图云文件 ID |

> **注意**: 精简格式不包含 `ingredients` 和 `steps`, 这些在云端完整版中。

#### 4.1.2 云端完整格式 (recipes 集合)

在精简格式基础上增加:

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `_id` | String | 自动 | 云数据库自动生成 | — | 文档主键 |
| `main_ingredients` | Array\<Ingredient\> | 是 | 至少 1 项 | — | 主要食材 |
| `seasonings` | Array\<Seasoning\> | 是 | — | `[]` | 调料 |
| `steps` | Array\<Step\> | 是 | 至少 1 项 | — | 烹饪步骤 |
| `baby_variant` | Object | 否 | — | `null` | 宝宝变体 |
| `cover_image_url` | String | 否 | `cloud://...` 格式 | `null` | 封面图 URL |
| `updateTime` | Date | 自动 | 云端自动更新 | — | 最后更新时间 (增量同步依据) |
| `source` | String | 否 | `"native"` \| `"external"` | `"native"` | 数据来源 |

#### 4.1.3 Ingredient (食材) 子模型

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `name` | String | 是 | 非空 | — | 食材名, 如 "鸡胸肉" |
| `amount` | Number | 是 | >= 0 (调料可为 0) | — | 用量数值 |
| `unit` | String | 是 | 如 `"g"`, `"ml"`, `"个"`, `"适量"`, `"少许"` | — | 单位 |
| `category` | String | 否 | `"肉类"` \| `"蔬菜"` \| `"蛋类"` \| `"干货"` \| `"调料"` \| `"其他"` | `"其他"` | 分类 |
| `sub_type` | String | 否 | 如 `"去骨"`, `"切丁"` | `null` | 子类型/规格 |

#### 4.1.4 Step (步骤) 子模型

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `step_index` | Number | 是 | >= 1 | — | 步骤序号 |
| `step_type` | String | 是 | `"prep"` \| `"cook"` | — | 步骤类型 |
| `actionType` | String | 是 | `"long_term"` \| `"active"` \| `"idle_prep"` | `"active"` | 动作类型 (并行调度用) |
| `parallel` | Boolean | 是 | — | `false` | 是否可并行 |
| `waitTime` | Number | 否 | >= 0, 单位: 分钟 | `0` | 被动等待时间 |
| `duration_num` | Number | 是 | > 0, 单位: 分钟 | prep: `5`, cook: `10` | 预计耗时 |
| `action` | String | 否 | `"prep"` \| `"cook"` \| `"process"` \| `"seasoning"` | — | 兼容旧字段 |
| `text` | String | 是 | 非空 | — | 步骤描述文案 |
| `step_image_url` | String | 否 | `cloud://...` 格式 | `null` | 步骤配图 |

---

### 4.2 Menu (菜单) — 生成单元

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `adultRecipe` | Recipe | 否 | — | `null` | 成人菜谱完整对象 |
| `babyRecipe` | Recipe | 否 | — | `null` | 宝宝菜谱对象 |
| `meat` | String | 是 | 同 Recipe.meat | — | 主料类型 |
| `taste` | String | 是 | 同 Recipe.taste | — | 烹饪风格 |
| `checked` | Boolean | 否 | — | `true` | 是否选中 |

#### MenuSlim (精简存储格式)

```javascript
{
  adultRecipeId: String | null,   // 大人菜谱 ID
  babyRecipeId: String | null,    // 宝宝菜谱 ID
  meat: String,                    // 肉类 key
  taste: String                    // 口味 key
}
```

> 读取时通过 `menuData.deserializeMenusFromStorage()` 根据 ID 从菜谱库还原完整数据。

---

### 4.3 UserPreference (用户偏好)

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `adultCount` | Number | 否 | 1-6 | `2` | 用餐人数 |
| `hasBaby` | Boolean | 否 | — | `false` | 是否有宝宝 |
| `babyMonth` | Number | 否 | 6-36 | `12` | 宝宝月龄 |
| `meatCount` | Number | 否 | 1-3 | `2` | 荤菜数量 |
| `vegCount` | Number | 否 | 0-3 | `1` | 素菜数量 |
| `soupCount` | Number | 否 | 0-1 | `0` | 汤品数量 |
| `soupType` | String | 否 | `"meat"` \| `"veg"` | `"meat"` | 汤品类型 |
| `avoidList` | Array\<String\> | 是 | 元素: `"spicy"`, `"seafood"`, `"peanut"`, `"lactose"`, `"gluten"`, `"beef_lamb"`, `"egg"`, `"soy"` | `[]` | 忌口列表 |
| `dietStyle` | String | 是 | `"home"` \| `"light"` \| `"rich"` \| `"quick"` | `"home"` | 饮食风格 |
| `isTimeSave` | Boolean | 是 | — | `false` | 省时模式 |
| `kitchenConfig` | Object | 否 | — | 见下表 | 厨房设备配置（灶台适配） |

**kitchenConfig 子结构**:

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `burners` | Number | 否 | 1-4 | `2` | 燃气灶火眼数 |
| `hasSteamer` | Boolean | 否 | — | `false` | 独立电蒸锅（不占灶） |
| `hasAirFryer` | Boolean | 否 | — | `false` | 空气炸锅（不占灶） |
| `hasOven` | Boolean | 否 | — | `false` | 烤箱（不占灶） |

> **命名规范**: 新代码必须使用 `avoidList` / `dietStyle` / `isTimeSave`, 不得使用 `allergens` / `dietary_preference` / `is_time_save` 等旧名。

---

### 4.4 ShoppingItem (购物清单项)

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `name` | String | 是 | 非空 | — | 食材名 |
| `sub_type` | String | 否 | — | `null` | 规格 |
| `amount` | String | 是 | 显示格式, 如 "450g" | — | 显示用量 |
| `rawAmount` | Number | 是 | >= 0 | — | 原始数值 (用于缩放) |
| `unit` | String | 是 | — | — | 单位 |
| `category` | String | 是 | `"蔬菜"` \| `"肉类"` \| `"蛋类"` \| `"干货"` \| `"调料"` \| `"其他"` | — | 分类 |
| `checked` | Boolean | 否 | — | `false` | 是否已购买 |
| `isShared` | Boolean | 否 | — | `false` | 是否多菜共用 |
| `fromRecipes` | Array\<String\> | 否 | — | `[]` | 来源菜品名列表 |

---

### 4.5 本地 Storage Key 规范

| Storage Key | 数据类型 | TTL | 说明 |
|-------------|----------|-----|------|
| `cloud_recipes_adult` | JSON (Recipe[]) | 永久 | 成人菜谱缓存 |
| `cloud_recipes_baby` | JSON (Recipe[]) | 永久 | 宝宝菜谱缓存 |
| `cloud_recipes_last_sync` | ISO Date String | 永久 | 上次同步时间 |
| `cloud_recipes_version` | Number | 永久 | 缓存版本号 |
| `menu_history_YYYY-MM-DD` | JSON ({ menus, preferences }) | 7 天 | 菜单历史 (按日期) |
| `imported_recipes_local` | JSON (Recipe[]) | 永久 | 导入菜谱本地缓存 |
| `step_progress_{source}_{key}` | JSON (Object) | 会话级 | 步骤完成进度 |
| `inspiration_basket` | JSON (BasketItem[]) | 每日清空 | 灵感篮子内容 (跨天自动重置) |
| `inspiration_basket_date` | String (YYYY-MM-DD) | 随篮子 | 篮子所属日期 (用于跨天清空判断) |
| `menu_history` | JSON ({ dateKey: { menus, preference, savedAt } }) | 7 天滚动 | 烹饪历史记录 (智能推荐数据源) |

---

### 4.6 云数据库集合

| 集合名 | 用途 | 索引字段 | 预估数据量 |
|--------|------|----------|-----------|
| `recipes` | 原生菜谱库 | `id` (唯一), `type`, `updateTime` | ~200+ |
| `imported_recipes` | 用户导入菜谱 | `_openid` (自动), `name` | 随用户增长 |

---

### 4.7 云存储路径规范

```
cloud://cloud1-7g5mdmib90e9f670.636c-cloud1-7g5mdmib90e9f670-1401654193/
├── adults_recipes/              # 成人菜谱封面图 (~200+)
│   ├── {recipe_slug}.png
│   └── {recipe_slug}.jpg
├── babies_recipes/              # 宝宝菜谱封面图
├── prep_cover_pic/              # 备菜步骤封面
├── shopping_cover_pic/          # 购物清单封面
└── logo/                        # 品牌 Logo 资源
```

**文件命名约定**: 菜名 → 英文标识符 (下划线连接) → 如 `kung_pao_chicken_with_peanut.png`

**兜底图**: `basic_cut_0_3_ar4.5.jpeg` (无匹配封面时使用)

---

## 5. 边界情况与容错

### 5.1 网络超时

| 场景 | 超时阈值 | 处理策略 | 用户感知 |
|------|----------|----------|----------|
| **smartMenuGen 云函数** | 60s | catch → `_applyLocalMenus()` 本地随机生成 | 无感知, 转盘照常旋转 |
| **fridgeScan 云函数** | 60s | catch → 显示错误弹窗, 提供"重试"按钮 | `wx.showModal("识别服务暂时不可用")` |
| **recipeImport 云函数** | 60s | catch → 显示错误弹窗 | `wx.showModal("导入失败, 请稍后重试")` |
| **recipeCoverGen 云函数** | 90s | catch → 返回 `{ code: 500 }`, 使用默认封面 | 无感知, 显示兜底图 |
| **recipeCoverGen 内部 MiniMax API** | 85s | `setTimeout` 销毁请求并 reject | 云函数层 catch 后返回 500 |
| **getWeather 云函数** | 15s | catch → 静默失败 | 首页不显示天气, 使用默认问候 |
| **云端数据同步** | 30s (每批) | catch → 使用本地 Storage 缓存, 标记 `_isOfflineFallback` | 无感知, 使用缓存数据 |
| **wx.cloud.getTempFileURL** | 10s (微信默认) | fail 回调 → `isImageReady: false`, 尝试切换扩展名 | 封面图不显示或显示兜底图 |

### 5.2 并发冲突

| 场景 | 冲突描述 | 处理策略 |
|------|----------|----------|
| **多次点击"开始"** | 用户快速多次点击生成按钮 | 防抖: 按钮点击后立即 `disabled: true`, 请求完成后恢复 |
| **云端同步中再次触发同步** | `_syncState.syncing === true` 时再次调用 `syncFromCloud()` | 锁机制: 检查 `_syncState.syncing`, 为 true 时直接返回, 不重复请求 |
| **多页面同时读写 Storage** | preview/steps/shopping 同时操作同一菜单数据 | 写时复制: 每个页面在 `onLoad` 时从 Storage 读取独立副本, 修改后写回; 步骤页用独立的 `step_progress_*` key |
| **多工具同时写入云数据库** | `batch-sync-recipes.js` 和 `sync.js` 同时运行 | **禁止并发**: 同一时间只能运行一个写入工具 (见 C-09 规则) |
| **云函数冷启动** | 多个用户同时调用同一云函数 | 微信云开发自动处理实例扩缩, 无需应用层处理; 但注意云函数内全局变量在不同实例间不共享 |

### 5.3 空输入

| 场景 | 空输入描述 | 处理策略 |
|------|------------|----------|
| **菜谱库为空** | `getAdultRecipes()` 返回 `[]` | 安全网: 使用本地 `recipes.js` 的 `adultRecipes` 兜底, 保证至少有离线数据 |
| **avoidList 过滤后无候选菜** | 忌口太多导致过滤后 0 道菜 | `getFallbackMessage(pref)` 返回降级提示: "当前忌口条件过多, 已放宽限制" |
| **用户偏好全部为空** | preference 对象缺失或字段为空 | `normalizeUserPreference()` 填充默认值: `{ avoidList: [], dietStyle: 'home', isTimeSave: false }` |
| **导入链接为空字符串** | `url: ""` | 云函数参数校验返回 `{ code: 400, message: "缺少链接" }` |
| **冰箱照片 0 张** | `imageFileIDs: []` | 云函数参数校验返回 `{ code: 400, message: "请至少上传一张照片" }` |
| **云函数返回空 recipeIds** | AI 推荐 0 道菜 | 客户端 fallback 到 `_applyLocalMenus()` 本地随机生成 |
| **菜谱无步骤数据** | `recipe.steps` 为 `undefined` 或 `[]` | `normalizeRecipeSteps()` 返回原对象; 步骤页显示为空列表, 不崩溃 |
| **菜谱无封面图** | `coverFileID` / `cover_image_url` 为空 | `recipeCoverSlugs.getRecipeCoverImageUrl()` 返回 `DEFAULT_COVER_URL` |
| **Storage 读取返回空** | `wx.getStorageSync()` 返回 `""` 或 `undefined` | 所有 Storage 读取点都有 try-catch + 默认值兜底 |

### 5.4 数据一致性

| 场景 | 问题描述 | 处理策略 |
|------|----------|----------|
| **缓存版本不匹配** | 代码升级后数据格式变化 | `CURRENT_CACHE_VERSION` 比对, 不匹配时强制全量刷新 |
| **云端字段名与本地不一致** | 云端 `main_ingredients` vs 本地 `ingredients` | `cloudRecipeService.js` 统一做格式转换: `amount → baseAmount`, `step_type → action` |
| **菜谱 ID 在缓存中存在但云端已删除** | 孤儿引用 | 全量同步时重建缓存; 增量同步不处理删除 (当前无删除场景) |
| **图片临时 URL 过期** | `wx.cloud.getTempFileURL` 返回的 URL 有时效 | 每次进入预览页重新调用 `_resolvePreviewImages()`, 不缓存临时 URL |
| **扩展名不匹配** | 实际文件是 .png 但代码拼的是 .jpg | `preview.js` 中 fail 回调自动切换扩展名 (png ↔ jpg) 重试一次 |

---

## 6. 与现有模块的交互点

### 6.1 模块依赖图

```
                    ┌──────────────┐
                    │   app.js     │ ─── 初始化入口
                    │ (onLaunch)   │
                    └──────┬───────┘
                           │ cloudRecipeService.init()
                           ▼
                    ┌──────────────┐
                    │ cloudRecipe- │ ─── 数据源管理
                    │ Service.js   │
                    └──────┬───────┘
                           │ 缓存菜谱到全局
                           ▼
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌────────────┐  ┌────────────┐  ┌─────────────┐
   │ menuData.js│  │ menuGen.js │  │recipeCover-  │
   │            │  │            │  │ Slugs.js     │
   │ ·序列化    │  │ ·过滤      │  │              │
   │ ·反序列化  │  │ ·生成      │  │ ·菜名→封面   │
   │ ·历史管理  │  │ ·缩放      │  │ ·兜底图      │
   │ ·按ID查找  │  │ ·步骤      │  │              │
   └────┬───────┘  └─────┬──────┘  └──────┬──────┘
        │                │                │
        │     被以下页面依赖:              │
        │                │                │
   ┌────┴──┬─────┬──────┴──┬──────┬─────┴──┬────────┐
   │       │     │         │      │        │        │
   ▼       ▼     ▼         ▼      ▼        ▼        ▼
 home  spinner preview   steps shopping   scan   myRecipes
              menu                       import    mix
```

### 6.2 交互影响矩阵

修改某个模块时, 以下矩阵标记了受影响的模块:

| 被修改模块 | 影响的模块 | 兼容性风险 | 验证方法 |
|-----------|-----------|-----------|----------|
| `menuGenerator.js` | spinner, preview, steps, shopping, mix, scan | **高** — 所有菜单生成/步骤/购物清单都依赖 | 运行 `node scripts/steps_sanity_check.js` |
| `menuData.js` | spinner, preview, steps, shopping, mix, scan, myRecipes | **高** — 数据序列化/反序列化格式变化会导致历史记录失效 | 检查 `serializeMenusForStorage` / `deserializeMenusFromStorage` 双向一致 |
| `cloudRecipeService.js` | 所有页面 (通过 `getRecipeSource()`) | **高** — 数据源切换影响全局 | 分别测试: 有网/无网/缓存失效 三种场景 |
| `recipeCoverSlugs.js` | preview, menu, myRecipes | **中** — 封面图 URL 变化导致图片不显示 | 检查 `getCoverSlug()` 对所有已有菜名的映射 |
| `recipes.js` | menuGenerator, menuData (作为兜底数据源) | **中** — 字段删减会导致算法异常 | 检查 `filterByPreference` 依赖的字段都存在 |
| `recipeSchema.js` | 云初始化脚本, tools/ 工具链 | **低** — 仅被工具链引用 | — |
| `DATA_PROTOCOL.md` | 无运行时影响 (文档) | **无** | — |
| 任一云函数 | 独立部署, 不影响其他云函数 | **低** — 仅影响对应功能 | 在微信开发者工具中单独测试 |

### 6.3 接口兼容性保证

**核心原则**: 所有模块对外接口遵循 **加法兼容**, 即:

1. **只加不删**: 新增字段/函数可以, 但不得删除或重命名已有公开接口
2. **默认值兼容**: 新增参数必须有默认值, 旧调用方无需修改
3. **返回值扩展**: 返回对象可以新增字段, 但不得删除已有字段
4. **旧字段名兼容**: `normalizeUserPreference()` 内部兼容 `allergens` → `avoidList` 等旧名映射

**示例 — 安全的修改**:

```javascript
// ✅ 安全: 新增可选字段, 有默认值
function generateMenu(options) {
  const { recipes, preference, maxRetries = 3 } = options;  // maxRetries 是新增
  ...
}

// ❌ 不安全: 删除了已有的返回字段
function computeDashboard(menus, pref) {
  return { totalTime, peakStoves };  // 删除了 nutrition 字段
}
```

---

## 7. 错误处理策略

### 7.1 错误分类与处理

| 错误类别 | 示例 | 处理策略 | 用户体验 |
|----------|------|----------|----------|
| **可恢复 - 自动降级** | smartMenuGen 超时 | 自动 fallback 到本地生成 | 用户无感知 |
| **可恢复 - 提示重试** | fridgeScan 识别失败 | 显示弹窗 + 重试按钮 | "识别失败, 请重试" |
| **不可恢复 - 提示退出** | Storage 已满 | 显示弹窗 + 返回按钮 | "存储空间不足" |
| **静默忽略** | 天气获取失败 | console.warn, 不影响主流程 | 首页无天气显示 |

### 7.2 重试策略表

| 操作 | 是否重试 | 最大重试次数 | 重试间隔 | 重试条件 |
|------|----------|-------------|----------|----------|
| `smartMenuGen` 云函数 | **否** | 0 | — | 直接降级到本地生成 |
| `fridgeScan` 云函数 | **用户手动** | 不限 | 用户点击 | 用户点击"重试"按钮 |
| `recipeImport` 云函数 | **用户手动** | 不限 | 用户点击 | 用户点击"重试"按钮 |
| `recipeCoverGen` 云函数 | **否** | 0 | — | 失败后使用默认封面 |
| `getWeather` 云函数 | **否** | 0 | — | 静默失败 |
| `cloudRecipeService.syncFromCloud()` | **自动** | 1 | 下次 `onShow` | 页面再次进入前台时检查并补偿 |
| `wx.cloud.getTempFileURL` | **自动** | 1 | 立即 | 扩展名不匹配时切换 png ↔ jpg 重试 |
| `tools/batch-sync-recipes.js` 单条写入 | **否** | 0 | — | 失败记录日志, 继续下一条 |
| MiniMax Image API (云函数内) | **否** | 0 | — | 85s 超时后直接 reject |
| 云数据库分页拉取 (每页 100) | **否** | 0 | — | 失败时使用已拉取的部分数据 |

### 7.3 限频保护

| 操作 | 限频策略 | 实现方式 |
|------|----------|----------|
| `batch-sync-recipes.js` 批量写入 | 每 20 条休息 1 秒 | `await sleep(1000)` |
| `wx.cloud.getTempFileURL` 批量获取 | 每批最多 50 个文件 ID | 数组切片, 分批调用 |
| AI 云函数调用 | 无应用层限频 (依赖 API Provider) | Kimi/MiniMax 自身 rate limit 返回 429 |
| 菜单生成按钮 | 防抖: 按钮即时 disabled | `this.setData({ isGenerating: true })` |

### 7.4 错误日志策略

| 级别 | 使用场景 | 输出方式 |
|------|----------|----------|
| `console.error()` | 云函数内部异常、数据库写入失败 | 微信云开发控制台日志 |
| `console.warn()` | 降级处理、非致命错误 | 开发者工具控制台 |
| `console.log()` | 关键流程节点 (同步开始/结束、生成完成) | 开发者工具控制台 |
| 用户提示 | 需要用户操作的错误 | `wx.showModal()` / `wx.showToast()` |

---

## 8. 验证工具与命令

> 本项目是微信小程序 + 微信云开发架构, 部分传统 Web 工具链 (如 pnpm test, tsgo, psql) 需适配。以下列出实际可用的验证方式和推荐的标准化改进。

### 8.1 单元测试

**当前状态**: 项目暂无自动化测试框架, 但核心算法 (`menuGenerator.js`) 为纯函数设计, 天然适合单元测试。

**现有验证脚本**:

```bash
# 步骤生成完整性检查 (在项目根目录运行)
node scripts/steps_sanity_check.js
```

**推荐的标准化方案**:

```bash
# 安装测试框架 (推荐 vitest, 项目已有 vite 配置)
npm install -D vitest

# 在 package.json 中添加:
# "scripts": { "test": "vitest run" }

# 运行单元测试:
pnpm test
# 或
npm test
```

**优先覆盖的测试目标**:

| 模块 | 函数 | 测试重点 |
|------|------|----------|
| `menuGenerator.js` | `filterByPreference()` | 忌口过滤正确性, 空列表兜底 |
| `menuGenerator.js` | `calculateScaling()` | 份额缩放准确性, 调料不缩放 |
| `menuGenerator.js` | `computeDashboard()` | 看板数据完整性 |
| `menuGenerator.js` | `normalizeUserPreference()` | 旧字段名兼容 |
| `menuData.js` | `serializeMenusForStorage()` + `deserializeMenusFromStorage()` | 序列化/反序列化双向一致 |
| `recipeSchema.js` | `normalizeStep()` | 旧字段名映射、默认值填充 |

---

### 8.2 类型检查

**当前状态**: 项目使用纯 JavaScript, 无 TypeScript。

**推荐的类型检查方案**:

```bash
# 方案 A: JSDoc + TypeScript 类型检查 (无需改写代码)
# 在 jsconfig.json 或 tsconfig.json 中启用:
# { "compilerOptions": { "checkJs": true, "allowJs": true } }

# 运行类型检查:
npx tsc --noEmit --allowJs --checkJs

# 方案 B: 如果项目后续迁移到 TypeScript:
pnpm tsgo
# 或
npx tsc --noEmit
```

**当前可用的替代检查**:

```bash
# 微信小程序项目配置校验
# 在微信开发者工具中: 工具 → 项目配置检查

# 手动检查数据协议一致性
# 对照 miniprogram/logic/DATA_PROTOCOL.md 检查字段命名
```

---

### 8.3 Lint 代码检查

**当前状态**: 项目未配置 ESLint, 但 `recipeSchema.js` 中有 `/* eslint-disable quotes */` 注释, 说明曾使用过。

**推荐的标准化方案**:

```bash
# 安装 ESLint
npm install -D eslint

# 初始化配置
npx eslint --init

# 运行 lint:
pnpm lint
# 或
npx eslint miniprogram/**/*.js cloudfunctions/**/*.js

# 工具链 lint (ES Module):
npx eslint tools/**/*.js
```

**项目特殊规则** (应加入 `.eslintrc`):

```json
{
  "rules": {
    "no-undef": "off",
    "no-unused-vars": "warn"
  },
  "globals": {
    "wx": "readonly",
    "getApp": "readonly",
    "getCurrentPages": "readonly",
    "Page": "readonly",
    "Component": "readonly",
    "App": "readonly",
    "require": "readonly",
    "module": "readonly"
  }
}
```

---

### 8.4 日志查看

**微信云开发日志** (主要日志来源):

```bash
# 方式 1: 微信开发者工具 GUI
# 云开发控制台 → 云函数 → 日志 → 选择函数名和时间范围

# 方式 2: 微信 CLI (如已安装)
# 查看 recipeCoverGen 最近 100 条日志:
wx-cloud-cli function:log --name recipeCoverGen --limit 100

# 方式 3: 腾讯云 CLI (如已配置)
tccli scf GetFunctionLogs --FunctionName recipeCoverGen --Limit 50
```

**客户端日志**:

```bash
# 微信开发者工具控制台:
# 1. 打开项目 → 调试器 → Console 标签
# 2. 使用 Filter 过滤关键字: "sync", "error", "fallback", "cloudRecipe"

# 真机调试日志:
# 微信开发者工具 → 真机调试 → 开启 vConsole
```

**工具链日志**:

```bash
# 工具链脚本直接输出到 stdout/stderr
# 运行时实时查看:
node tools/batch-sync-recipes.js 2>&1 | tee sync.log

# 检查上次同步日志:
cat sync.log | grep -i error
```

**如果项目后续接入 Axiom / Vercel CLI**:

```bash
# Axiom 日志查询 (需配置 AXIOM_TOKEN):
axiom query "dataset='tablesync' | where level == 'error'" --start="-24h"

# Vercel 日志查看 (需配置 vercel login):
vercel logs --follow
vercel logs --since 1h
```

---

### 8.5 数据库访问

**微信云开发 MongoDB** (项目使用的数据库):

```bash
# 方式 1: 微信开发者工具 GUI
# 云开发控制台 → 数据库 → 选择集合 (recipes / imported_recipes)
# 支持: 查询、添加、删除、导入/导出 JSON

# 方式 2: 通过 @cloudbase/node-sdk (工具链使用)
# 在 tools/ 目录下, 先配置 .env:
cp tools/.env.example tools/.env
# 编辑 tools/.env 填入:
#   TCB_ENV_ID=cloud1-你的环境ID
#   TCB_SECRET_ID=你的SecretId
#   TCB_SECRET_KEY=你的SecretKey

# 然后运行任意工具脚本 (自动通过 config.js 加载 .env):
node tools/batch-sync-recipes.js        # 批量同步菜谱
node tools/cleanup-db.js                 # 清理数据库
node tools/remove-duplicate-recipes-from-cloud.js  # 去重
```

**连接示例 (Node.js)**:

```javascript
import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from './config.js';

const app = cloudbase.init({
  env: CONFIG.tcbEnvId,          // 'cloud1-7g5mdmib90e9f670'
  secretId: CONFIG.tcbSecretId,
  secretKey: CONFIG.tcbSecretKey
});

const db = app.database();

// 查询所有菜谱
const { data } = await db.collection('recipes').limit(100).get();
console.log(`共 ${data.length} 条菜谱`);

// 查询指定菜谱
const { data: [recipe] } = await db.collection('recipes')
  .where({ id: 'a-chi-1' })
  .get();
```

**环境变量加载**:

```bash
# tools/.env 文件格式:
ANTHROPIC_API_KEY=sk-ant-api03-你的key
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_BASE_URL=https://your-proxy.example.com
TCB_ENV_ID=cloud1-你的环境ID
TCB_SECRET_ID=你的SecretId
TCB_SECRET_KEY=你的SecretKey
```

```javascript
// 在 tools/config.js 中自动加载:
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });
```

**如果项目后续接入 PostgreSQL (psql)**:

```bash
# 加载环境变量并连接:
source .env
psql $DATABASE_URL

# 或直接连接:
psql "host=xxx.supabase.co port=5432 dbname=postgres user=postgres password=xxx"

# 常用查询:
\dt                    # 列出所有表
SELECT count(*) FROM recipes;
SELECT * FROM recipes WHERE id = 'a-chi-1';
```

---

### 8.6 部署验证

**云函数部署**:

```bash
# 方式 1: 微信开发者工具 GUI
# 右键点击 cloudfunctions/<函数名> → 上传并部署: 云端安装依赖

# 方式 2: 命令行 (如已安装微信 CLI)
wx-cloud-cli deploy --name recipeCoverGen

# 部署后验证:
# 在云开发控制台 → 云函数 → 测试, 输入测试参数手动触发
```

**小程序构建验证**:

```bash
# 微信开发者工具:
# 1. 编译按钮 (Ctrl/Cmd + B) — 检查编译错误
# 2. 预览按钮 — 生成二维码真机测试
# 3. 上传按钮 — 提交审核版本
```

---

### 8.7 完整验证清单 (Checklist)

每次重大修改后, 按以下顺序验证:

```
□ 1. 编译检查: 微信开发者工具编译无报错
□ 2. 步骤完整性: node scripts/steps_sanity_check.js 通过
□ 3. 离线测试: 关闭网络 → 首页/转盘/预览 功能正常 (降级模式)
□ 4. 在线测试: 打开网络 → smartMenuGen / fridgeScan 正常返回
□ 5. 缓存测试: 清除 Storage → 重新进入 → 云端同步正常
□ 6. 封面图测试: 预览页封面图加载 → 无图的菜显示兜底图
□ 7. 历史记录: 完成一次完整流程 → 首页检查历史记录存在
□ 8. 工具链: node tools/batch-sync-recipes.js --dry-run 正常执行
□ 9. 数据协议: 对照 DATA_PROTOCOL.md 检查新增字段命名
□ 10. Git: git diff 检查无意外的 secret/env 文件变更
```

---

## 9. 用户行为埋点协议 (Tracking Protocol)

> **设计目标**: 回答一个致命的产品问题 — *用户是因为「太忙乱」而流失, 还是因为「太简单」而觉得没必要用?*
>
> 对于 TableSync 这种强调「并行效率」的应用, 埋点不能只记录页面访问, 必须记录**流程节奏** — 即用户在烹饪步骤中的实际行为轨迹、时间偏差和流失拐点。这套协议专为 `steps.js` (核心烹饪页) 设计, 是数据驱动产品演进的基石。

### 9.1 核心埋点事件表 (Event Schema)

| 事件 ID | 触发时机 | 关键属性 (Properties) | 业务价值 |
|---------|---------|----------------------|---------|
| `cook_session_start` | 页面 `onLoad` 且 `_updateView()` 首次完成 | `recipe_ids`, `source`, `is_dual_mode`, `is_time_save`, `total_steps_count`, `has_parallel` | 建立漏斗入口, 区分单餐/双餐任务复杂度, 区分来源 (menu/scan/import/mix) |
| `step_action_click` | 用户点击步骤 Checkbox (`markCompleted`) | `step_id`, `step_index`, `step_type`, `phase_type`, `is_parallel_block`, `expected_duration`, `actual_duration`, `recipe_name` | **最核心指标** — 计算用户实际操作与 AI 预测的时间偏差 (Variance) |
| `parallel_group_sync` | 一个并行块 (Block) 内所有步骤全部完成 | `block_id`, `phase_type`, `completed_steps_count`, `total_block_steps`, `wait_time`, `saved_minutes` | 衡量并行调度的平衡性 — 是否有步骤让用户等得太久? |
| `cooking_pause_resume` | 页面 `onHide` (pause) / `onShow` (resume) | `action` (pause/resume), `pause_type` (switch_app/lock_screen), `pause_duration`, `current_step_id`, `progress_pct` | 衡量「烹饪干扰」 — 用户频繁切出可能是步骤描述不清需要查资料 |
| `cooking_abort` | 任务未完成即 `navigateBack` 或页面 `onUnload` | `last_step_id`, `last_step_index`, `progress_pct`, `exit_reason` (manual/timeout/error), `total_duration`, `completed_count` | **流失分析** — 找出哪个步骤是「劝退点」 |
| `cook_session_finish` | 点击最后一步的「完成料理」(`markCompleted` 检测 `isLast`) | `total_actual_time`, `total_expected_time`, `compression_ratio`, `steps_completed`, `pause_count`, `parallel_blocks_completed`, `source` | 计算最终「时间压缩比」, 验证 AI 提效成果 |
| `linear_fallback_trigger` | 用户触发线性降级 (`triggerFallback`) | `trigger_reason` (missing_ingredients/user_choice), `missing_count`, `progress_at_trigger`, `step_id_at_trigger` | 衡量并行模式的实用性 — 降级率过高说明并行调度需优化 |

---

### 9.2 事件属性详细定义

#### 9.2.1 `cook_session_start`

> **触发点**: `steps.js` → `onLoad()` → `_updateView(steps)` 执行完毕后

```javascript
{
  event: "cook_session_start",
  properties: {
    recipe_ids: [String],        // 本次烹饪涉及的菜谱 ID 列表
    recipe_names: [String],      // 菜谱名称列表 (用于人工分析)
    source: String,              // 来源: "menu" | "scan" | "import" | "mix"
    is_dual_mode: Boolean,       // 是否有宝宝同行 (hasBaby)
    is_time_save: Boolean,       // 是否省时模式
    adult_count: Number,         // 用餐人数
    total_steps_count: Number,   // 总步骤数
    prep_steps_count: Number,    // 备菜步骤数
    cook_steps_count: Number,    // 烹饪步骤数
    has_parallel: Boolean,       // 是否启用并行调度 (非 forceLinear)
    total_expected_time: Number, // AI 预估总烹饪时间 (分钟, 所有 duration 之和)
    session_id: String           // 本次会话唯一 ID (UUID, 串联同一次烹饪的所有事件)
  }
}
```

**代码锚点**: `onLoad()` 内 `_updateView(steps)` 调用之后, `_stepsRaw` 已赋值处

#### 9.2.2 `step_action_click`

> **触发点**: `steps.js` → `markCompleted(e)` → `step.completed = true` 之后

```javascript
{
  event: "step_action_click",
  properties: {
    session_id: String,          // 同 cook_session_start 的 session_id
    step_id: String,             // 步骤 ID (如 "prep-0", "cook-2", "import-cook-3")
    step_index: Number,          // 步骤在列表中的索引 (0-based)
    step_type: String,           // "prep" | "cook"
    phase_type: String,          // "prep" | "long_term" | "gap" | "cook" | "finish"
    action_type: String,         // "long_term" | "active" | "idle_prep" (来自 step.actionType)
    is_parallel_block: Boolean,  // 步骤是否属于并行块 (step.parallel === true)
    recipe_name: String,         // 关联菜品名 (step.recipeName)
    expected_duration: Number,   // AI 预估该步骤耗时 (分钟, 来自 step.duration)
    actual_duration: Number,     // 用户实际耗时 (分钟, 上一步 click 到本步 click 的时间差)
    variance: Number,            // 时间偏差 = actual_duration - expected_duration (正值=超时, 负值=提前)
    progress_pct: Number,        // 当前总进度百分比
    cumulative_time: Number      // 从 session_start 到此刻的累计时间 (分钟)
  }
}
```

**代码锚点**: `markCompleted(e)` 内, `step.completed = true` 之后、`_updateView(steps)` 之前

**关键计算**:
- `actual_duration`: 需在页面维护 `_lastStepClickTime` 时间戳, 每次 `markCompleted` 时计算差值
- `variance`: `actual_duration - expected_duration`, 正值表示用户比 AI 预期慢, 负值表示更快
- `cumulative_time`: `Date.now() - _sessionStartTime`

#### 9.2.3 `parallel_group_sync`

> **触发点**: `steps.js` → `checkParallelCompletion(steps)` 中检测到某个并行块的所有步骤都已完成

```javascript
{
  event: "parallel_group_sync",
  properties: {
    session_id: String,
    block_id: String,            // 并行块标识 (可用 phaseType + 首步骤 ID 拼接)
    phase_type: String,          // "long_term" | "gap" | "cook"
    completed_steps_count: Number, // 该块内完成的步骤数
    total_block_steps: Number,   // 该块内总步骤数
    wait_time: Number,           // 最长等待时间 (来自 parallelContext.remainingMinutes)
    saved_minutes: Number,       // 该块节省的时间 (来自 phaseTimeline.savedMinutes, 若有)
    active_task_name: String     // 并行中的主任务名 (如 "花旗参石斛炖鸡汤正在炖煮")
  }
}
```

**代码锚点**: `checkParallelCompletion(steps)` 内, 当检测到 `parallelContext` 步骤列表从非空变为空时

#### 9.2.4 `cooking_pause_resume`

> **触发点**: 页面 `onHide` (pause) 和 `onShow` (resume)

```javascript
{
  event: "cooking_pause_resume",
  properties: {
    session_id: String,
    action: String,              // "pause" | "resume"
    pause_type: String,          // "switch_app" (切出) | "lock_screen" (锁屏) | "unknown"
    pause_duration: Number,      // 暂停时长 (秒, 仅 resume 时有值)
    current_step_id: String,     // 暂停/恢复时的当前步骤 ID
    current_step_index: Number,  // 当前步骤索引
    progress_pct: Number,        // 当前进度百分比
    pause_count: Number          // 本次会话累计暂停次数
  }
}
```

**代码锚点**: 需在 `steps.js` 中新增 `onHide()` / `onShow()` 生命周期方法

**实现要点**:
- `onHide` 时记录 `_pauseStartTime = Date.now()` 和 `_pauseCount++`
- `onShow` 时计算 `pause_duration = (Date.now() - _pauseStartTime) / 1000`
- `pause_type` 推断: 暂停时长 < 3s 通常是锁屏, > 3s 通常是切换应用 (粗略推断)

#### 9.2.5 `cooking_abort`

> **触发点**: 页面 `onUnload` 且 `progress_pct < 100`

```javascript
{
  event: "cooking_abort",
  properties: {
    session_id: String,
    last_step_id: String,        // 最后完成的步骤 ID
    last_step_index: Number,     // 最后完成的步骤索引
    progress_pct: Number,        // 退出时的进度百分比
    exit_reason: String,         // "manual" (用户主动返回) | "timeout" | "error"
    total_duration: Number,      // 从 session_start 到退出的总时长 (秒)
    completed_count: Number,     // 已完成的步骤数
    total_steps: Number,         // 总步骤数
    pause_count: Number,         // 累计暂停次数
    source: String,              // 来源: "menu" | "scan" | "import" | "mix"
    abort_phase: String          // 退出时所在阶段: "prep" | "cook" | "finish"
  }
}
```

**代码锚点**: 需在 `steps.js` 中新增 `onUnload()` 生命周期方法, 判断 `completionRate < 100` 时触发

#### 9.2.6 `cook_session_finish`

> **触发点**: `steps.js` → `markCompleted(e)` → 检测到 `step.id === lastId` 且用户点击「回首页」

```javascript
{
  event: "cook_session_finish",
  properties: {
    session_id: String,
    recipe_ids: [String],
    recipe_names: [String],
    source: String,
    total_actual_time: Number,   // 实际总耗时 (分钟, session_start 到 finish)
    total_expected_time: Number, // AI 预估总耗时 (分钟)
    compression_ratio: Number,   // 时间压缩比 = total_expected_time / total_actual_time (>1 表示比预期快)
    steps_completed: Number,     // 完成的步骤数 (应 = total_steps)
    total_steps: Number,
    pause_count: Number,         // 累计暂停次数
    total_pause_duration: Number, // 累计暂停时长 (秒)
    parallel_blocks_completed: Number, // 完成的并行块数量
    linear_fallback_used: Boolean,     // 是否触发过线性降级
    is_dual_mode: Boolean,
    adult_count: Number
  }
}
```

**代码锚点**: `markCompleted(e)` 内, `wx.showModal('料理完成！')` 的 `success` 回调中, `res.confirm` 之后

**核心指标 — 时间压缩比**:
- `compression_ratio > 1.0` → AI 并行调度有效, 用户比顺序做更快
- `compression_ratio ≈ 1.0` → 并行调度没有明显效果
- `compression_ratio < 1.0` → 用户比预期慢, 可能是步骤过于复杂或干扰过多

#### 9.2.7 `linear_fallback_trigger`

> **触发点**: `steps.js` → `triggerFallback(missingResult)` → 用户选择「切换线性步骤」

```javascript
{
  event: "linear_fallback_trigger",
  properties: {
    session_id: String,
    trigger_reason: String,      // "missing_ingredients" (检测到缺料) | "user_choice"
    missing_ingredients: [String], // 缺少的食材名列表
    missing_count: Number,       // 缺少食材数量
    progress_at_trigger: Number, // 触发时的进度百分比
    step_id_at_trigger: String,  // 触发时的当前步骤 ID
    steps_completed_before: Number // 降级前已完成的步骤数
  }
}
```

**代码锚点**: `triggerFallback()` → `wx.showModal` → `res.confirm` → `that._hasLinearFallback = true` 之后

---

### 9.3 会话状态管理

所有事件通过 `session_id` 串联为一次完整的烹饪会话。以下是页面需要维护的追踪状态变量:

```javascript
// 在 Page({}) 内部作为实例属性管理, 不放入 data (无需渲染)

_trackingState: {
  sessionId: String,           // UUID, 在 onLoad 时生成
  sessionStartTime: Number,    // Date.now(), 在 onLoad 完成时记录
  lastStepClickTime: Number,   // 上一次 markCompleted 的时间戳
  pauseStartTime: Number,      // onHide 时记录
  pauseCount: Number,          // 累计暂停次数
  totalPauseDuration: Number,  // 累计暂停时长 (ms)
  parallelBlocksCompleted: Number, // 完成的并行块计数
  stepsCompleted: Number,      // 已完成步骤数 (冗余, 快速读取)
  linearFallbackUsed: Boolean  // 是否触发过降级
}
```

**`session_id` 生成规则**: 使用简单的时间戳 + 随机数方案 (微信小程序无原生 UUID):

```javascript
function generateSessionId() {
  return 'cs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
// 示例输出: "cs_m1abc2d_x7k9f2"
```

---

### 9.4 上报方式与存储

#### 9.4.1 上报通道

| 方案 | 优先级 | 说明 |
|------|--------|------|
| **微信自定义分析** | 推荐 (Phase 1) | 零成本, 在微信后台「数据分析 → 自定义分析」中配置事件; 通过 `wx.reportEvent(eventId, data)` 上报; 无需额外后端 |
| **云数据库直写** | 备选 (Phase 2) | 创建 `tracking_events` 集合, 直接 `db.collection('tracking_events').add()`; 数据自主可控, 适合深度分析 |
| **第三方平台** | 远期 (Phase 3) | 接入 GrowingIO / 神策 / Mixpanel 等专业平台; 提供漏斗、留存、路径等开箱即用分析能力 |

#### 9.4.2 微信自定义分析上报示例

```javascript
// 在 steps.js 中封装统一上报函数
function trackEvent(eventId, properties) {
  try {
    // Phase 1: 微信自定义分析
    wx.reportEvent(eventId, properties);

    // 同时输出到控制台, 便于开发阶段调试
    console.log('[Track]', eventId, properties);
  } catch (e) {
    console.warn('[Track] 上报失败:', eventId, e);
  }
}

// 调用示例
trackEvent('cook_session_start', {
  recipe_ids: 'a-chi-1,a-pork-3',  // wx.reportEvent 的 value 类型有限, 数组需序列化
  source: 'menu',
  is_dual_mode: false,
  total_steps_count: 12,
  has_parallel: true
});
```

#### 9.4.3 本地缓存兜底

网络异常时, 事件暂存 Storage, 下次启动时批量补报:

```javascript
// Storage Key: tablesync_tracking_queue
// 格式: [{ eventId, properties, timestamp }]
// 容量上限: 50 条, 超出时 FIFO 淘汰最旧事件
// 补报时机: app.js onLaunch 或 steps.js onLoad 时检查并上报
```

---

### 9.5 关键指标与分析模型

#### 9.5.1 核心漏斗

```
cook_session_start (100%)
  │
  ├── 完成 ≥ 1 步 (step_action_click)      → 步骤启动率
  │
  ├── 完成 50% 步骤                         → 半程留存率
  │
  ├── 完成并行块 (parallel_group_sync)       → 并行模式使用率
  │
  ├── 无暂停完成 (pause_count === 0)         → 沉浸式完成率
  │
  └── cook_session_finish                   → 任务完成率
```

#### 9.5.2 关键衍生指标

| 指标名 | 计算公式 | 目标值 | 业务含义 |
|--------|---------|--------|---------|
| **任务完成率** | `finish_count / start_count` | > 70% | 核心留存指标 |
| **平均时间偏差** | `AVG(step.variance)` | ±2 min | AI 预估准确度, 偏差大说明步骤时间标注不准 |
| **时间压缩比** | `AVG(compression_ratio)` | > 1.2 | AI 并行调度的提效价值, <1.0 说明并行反而更慢 |
| **劝退步骤 Top 5** | `abort 时 last_step_id 频次排名` | — | 找出导致流失的具体步骤, 优化文案或拆分步骤 |
| **切出率** | `AVG(pause_count) per session` | < 2 | 高切出率说明步骤描述不清, 用户需要查资料 |
| **并行降级率** | `fallback_count / parallel_session_count` | < 15% | 降级率过高说明并行调度过于激进 |
| **来源完成率差异** | 按 `source` 分组比较完成率 | 无显著差异 | 若 import 来源完成率低, 说明外部菜谱步骤质量差 |

#### 9.5.3 致命问题诊断矩阵

| 用户类型 | 数据特征 | 诊断 | 对策 |
|----------|---------|------|------|
| **「太忙乱」而流失** | abort_phase=cook, pause_count>3, variance>5min, 常在并行块中退出 | 并行调度过于复杂, 步骤描述不清 | 降低并行密度, 增加步骤间提示, 优化文案清晰度 |
| **「太简单」而不用** | session_start 后 0 步完成, 或完成 1-2 步即 abort, compression_ratio 极高 | 用户觉得不需要跟步骤, 自己做更快 | 强化独家价值 (并行调度节省时间可视化, 采购清单联动) |
| **「步骤太多」而疲劳** | abort 集中在 progress_pct 60%-80%, 后半段 variance 递增 | 烹饪疲劳, 后期步骤缺乏激励 | 增加阶段完成奖励, 后半段简化步骤, 增加鼓励性文案 |
| **「缺料」而放弃** | linear_fallback_trigger 频繁, abort 紧跟 fallback | 购物清单未买齐就开始烹饪 | 强化购物清单卡点, 在 steps 入口增加检查提示 |

---

### 9.6 实现优先级与里程碑

| 阶段 | 事件 | 开发量 | 说明 |
|------|------|--------|------|
| **P0 — MVP** | `cook_session_start`, `cook_session_finish`, `cooking_abort` | 0.5 天 | 最小可用漏斗: 知道多少人开始、完成、放弃 |
| **P1 — 核心** | `step_action_click`, `cooking_pause_resume` | 1 天 | 步骤级时间偏差分析, 切出率分析 |
| **P2 — 进阶** | `parallel_group_sync`, `linear_fallback_trigger` | 0.5 天 | 并行调度效果验证, 降级率监控 |
| **P3 — 平台化** | 迁移至第三方分析平台, 搭建自动化 Dashboard | 2-3 天 | Mixpanel/GrowingIO 接入, 自动报表 |

---

### 9.7 隐私与合规

| 规则 | 说明 |
|------|------|
| **不采集个人身份信息** | 所有事件不包含 openid、手机号、地理位置等 PII; `session_id` 为随机生成, 不可逆向关联用户 |
| **不采集菜谱内容** | 仅采集 `recipe_id` 和 `recipe_name`, 不采集食材详情、步骤文案等用户内容 |
| **本地处理优先** | 时间差计算、进度计算等全部在客户端完成, 仅上报聚合结果 |
| **用户可选退出** | 预留 `wx.getStorageSync('tracking_opt_out')` 开关, 值为 `true` 时所有 `trackEvent()` 静默跳过 |
| **数据保留期** | 云数据库中的 tracking 数据保留 90 天, 过期自动清理 (通过定时触发器) |
| **合规声明** | 若使用第三方分析平台, 需在小程序隐私协议中声明数据采集范围 |

---

### 9.8 埋点实施检查清单

```
□ 1. steps.js 新增 _trackingState 对象和 generateSessionId() 函数
□ 2. steps.js 新增 trackEvent() 封装函数
□ 3. onLoad 末尾触发 cook_session_start
□ 4. markCompleted 内触发 step_action_click (含 actual_duration 计算)
□ 5. markCompleted 检测 isLast 时触发 cook_session_finish
□ 6. 新增 onHide/onShow 生命周期, 触发 cooking_pause_resume
□ 7. 新增 onUnload 生命周期, 触发 cooking_abort (progress < 100%)
□ 8. checkParallelCompletion 内触发 parallel_group_sync
□ 9. triggerFallback 内触发 linear_fallback_trigger
□ 10. 微信后台配置自定义分析事件 (7 个)
□ 11. 控制台验证: 完整走一次烹饪流程, 检查所有事件正确上报
□ 12. 隐私协议更新 (若接入第三方平台)
```

---

## 10. 灵感篮子交互规范 (Inspiration Basket)

> **灵感篮子**是连接「收集灵感」和「生成菜单」之间的临时暂存区。用户在导入菜谱、扫冰箱、浏览菜谱库等场景中收集感兴趣的菜品，统一存入篮子，生成菜单时优先从篮子中选取。

### 10.1 部署状态总览

#### 已部署 (Production)

| 模块 | 文件 | 功能 | 状态 |
|------|------|------|------|
| **数据层** | `miniprogram/data/inspirationBasket.js` | 纯函数数据操作 (增删查序列化) | ✅ 已上线 |
| **首页入口** | `miniprogram/pages/home/home.js` + `.wxml` + `.wxss` | 角标计数、预览条、历史推荐卡片 | ✅ 已上线 |
| **篮子管理页** | `miniprogram/pages/basketPreview/` (js/wxml/wxss) | 查看/排序/删除/优先级切换/历史推荐加入 | ✅ 已上线 |
| **Spinner 集成** | `miniprogram/pages/spinner/spinner.js` + `.wxml` | 优先策略开关、basketItems 注入云函数、历史快捷加入 | ✅ 已上线 |
| **历史推荐** | `miniprogram/utils/menuHistory.js` | 智能推荐算法 (频率+新鲜度+多样性综合评分) | ✅ 已上线 |
| **globalData 同步** | `app.js` → `getApp().globalData.inspirationBasket` | 跨页面篮子状态共享 | ✅ 已上线 |
| **myRecipes 页投篮** | `miniprogram/pages/myRecipes/myRecipes.js` + `.wxml` | 心形按钮切换加入/移出篮子 (source: `imported`); 用 `basketIds` 追踪 UI 状态 | ✅ 已上线 |
| **Preview 篮子来源标签** | `miniprogram/pages/preview/preview.js` | 读取 `globalData.lastBasketItems`, 在菜单卡片上显示 `fromBasket` + `basketSourceLabel` (如"导入菜谱""冰箱匹配") | ✅ 已上线 |
| **Preview 闭环清理** | `miniprogram/pages/preview/preview.js` | `confirmAndGo()` 中调用 `basket.removeItemsByMenu(list, menus)`, 确认做饭后自动从篮子移除已选菜品 | ✅ 已上线 |

#### 未部署 (Planned)

| 模块 | 涉及文件 | 功能 | 优先级 | 备注 |
|------|----------|------|--------|------|
| **scan 页投篮** | `pages/scan/scan.js` | 冰箱扫描结果勾选后自动加入篮子 (source: `fridge_match`) | P1 | 需在 scan 页结果列表加「加入灵感篮」按钮 |
| **import 页投篮** | `pages/import/import.js` | 导入菜谱保存后弹出「同时加入灵感篮？」确认 (source: `imported`) | P1 | 需在保存成功回调中加 `basket.createItem()` |
| **smartMenuGen 篮子权重** | `cloudfunctions/smartMenuGen/lib/prompt-builder.js` | 云函数 prompt 中注入 basketItems, AI 优先推荐篮子内菜品 | P2 | spinner.js 已传 basketItems, 云函数端需解析 |
| **篮子满溢提示** | `pages/home/home.js` | 篮子超过 10 道时提示"建议精简" | P3 | 纯 UI 提示, 不阻塞流程 |
| **篮子数据上云** | `cloudRecipeService.js` | 篮子数据持久化到云 DB (OpenID 关联), 实现跨设备同步 | P4 | 依赖 OpenID 静默画像 (Phase 1.5) |

---

### 10.2 架构与数据流

```
入篮触点 (已部署 ✅ / 待开发 ⬜)                     消费端
─────────────────────────────────               ──────────────
                                                
⬜ scan 页 (冰箱匹配结果) ─┐                        
⬜ import 页 (保存后) ─────┤                    ┌─ spinner.js
✅ myRecipes 页 (心形toggle)┤                    │  ·读取篮子
✅ basketPreview 页 ───────┤── inspirationBasket.js ──┤  ·注入 candidates + meat
   (历史推荐加入)          │   (纯函数, 不调 wx.*)    │  ·优先策略开关
✅ spinner 页 ─────────────┤                    │
   (历史快捷加入)          │                    ├─ ⬜ smartMenuGen
                           │                    │  (云函数 prompt 注入)
                           │                    │
                           │                    └─ ✅ preview.js
                           │                       ·来源标签 (fromBasket)
                           │                       ·闭环清理 (removeItemsByMenu)
                           │
                           ├── Storage: inspiration_basket (JSON)
                           ├── Storage: inspiration_basket_date (日期)
                           └── globalData.inspirationBasket (内存)

首页展示:
✅ home.wxml  ←── basketCount (角标)
              ←── basket-bar (预览条, 非空时)
              ←── history-hint-card (空篮时, 有历史记录)
```

---

### 10.3 数据模型

#### BasketItem (篮子项)

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `id` | String | 是 | 唯一; 原生菜谱用 recipe.id, 历史推荐用 `'history-' + name` | — | 去重主键 |
| `name` | String | 是 | 非空 | `'未命名'` | 菜品名 |
| `source` | String | 是 | `'native'` \| `'imported'` \| `'fridge_match'` | — | 来源类型 |
| `sourceDetail` | String | 否 | — | 自动推断 | 来源描述文本 (如 "小红书导入", "冰箱匹配", "菜谱库收藏", "历史推荐") |
| `addedAt` | Number | 是 | `Date.now()` 时间戳 | — | 加入时间 |
| `priority` | String | 否 | `'high'` \| `'normal'` | `'normal'` | 优先级 (用户可在 basketPreview 页切换) |
| `meat` | String | 条件必填 | `'chicken'` \| `'pork'` \| `'beef'` \| `'fish'` \| `'shrimp'` \| `'vegetable'` | 自动推导 | **仅当 `source === 'imported'` 时存在**; 若原始菜谱无 `meat` 字段, 由 `inferMeatFromName(name)` 从菜名中按关键词自动推导 (如"鸡"→chicken, "牛"→beef), 默认 `'vegetable'`; 用于 menuGenerator 兼容 |
| `meta` | Object | 否 | — | `{}` | 扩展元数据 |
| `meta.fridgeIngredients` | Array\<String\> | 否 | — | — | 冰箱匹配时识别到的食材列表 |
| `meta.expiringIngredients` | Array\<String\> | 否 | — | — | 临期食材列表 (用于优先排序) |
| `meta.importPlatform` | String | 否 | `'xiaohongshu'` \| `'douyin'` \| 其他 | — | 导入平台标识 |

**sourceDetail 自动推断规则** (在 `createItem()` 中):

```
source === 'imported' && recipe.sourcePlatform === 'xiaohongshu' → '小红书导入'
source === 'imported' && recipe.sourcePlatform === 'douyin'      → '抖音导入'
source === 'imported' && 其他                                     → '导入'
source === 'fridge_match'                                         → '冰箱匹配'
source === 'native'                                               → '菜谱库收藏'
```

#### 闭环清理函数 `removeItemsByMenu(list, menus)`

> preview.js `confirmAndGo()` 在用户确认做饭后调用此函数, 自动将已选入菜单的篮子项移除。

```
输入:
  list   — 当前篮子数组
  menus  — 完整菜单 [{ adultRecipe: { id, name }, ... }]

匹配规则:
  1. 提取 menus 中所有 adultRecipe.id → ids 集合
  2. 提取 menus 中所有 adultRecipe.name → names 集合
  3. 篮子项的 id 命中 ids 或 name 命中 names → 移除

返回: 新数组 (不修改原数组)
```

#### 辅助导出别名

| 导出名 | 实际实现 | 用途 |
|--------|----------|------|
| `getAll(raw)` | `parseBasket(raw)` | 兼容别名, 由调用方先读 Storage 再传入 |
| `clear()` | `return []` | 兼容别名, 返回空数组 |

#### 排序策略 (basketPreview 页)

| 排序模式 | key | 排序规则 |
|----------|-----|----------|
| 智能排序 | `smart` | `priority: high` 置顶 → `fridge_match` > `imported` > `native` → 组内按 `addedAt` 倒序 |
| 按时间 | `time` | 纯按 `addedAt` 倒序 |
| 按来源 | `source` | `fridge_match` > `imported` > `native` → 组内按 `addedAt` 倒序 |

#### 历史推荐评分算法 (`menuHistory.getSmartRecommendations`)

```
score = freqScore + recencyPenalty + timeFactor

freqScore       = min(frequency, 3)           // 做过多次说明喜欢, 上限 3 分
recencyPenalty  = lastDayIdx === 0 ? -1.5 : 0 // 昨天刚做过的降权 (避免连续重复)
timeFactor      = lastDayIdx <= 2 ? 1          // 2 天内做过 → +1
                : lastDayIdx <= 4 ? 0.5        // 3-4 天前 → +0.5
                : 0.2                          // 5+ 天前 → +0.2

排序: score 降序 → 取前 maxItems 条
```

---

### 10.4 生命周期与跨天清空

```
用户打开小程序
    │
    ▼
home.onShow() → _refreshBasket()
    │
    ├── 读取 Storage: inspiration_basket_date
    │
    ├── 日期 === 今天 ──→ 正常加载篮子数据
    │
    └── 日期 !== 今天 (跨天) ──→ 清空篮子
                                   ├── Storage 写入空数组
                                   ├── 更新 date key 为今天
                                   └── setData({ basketCount: 0 })
```

**关键行为**:
- 篮子是 **日粒度** 临时暂存, 每日自动重置
- 跨天判断在 `home.onShow()` 中执行, 每次进入首页都检查
- 篮子首次有数据时自动补写 date key (首次添加场景兼容)
- **幂等**：入篮去重以 `uniqueId` 为准，同源同菜只保留一条；`uniqueId` 在 `createItem()` 内由 source 与稳定 id（及可选 sourceUrl）拼接（见 B-11）

---

### 10.5 Spinner 页篮子注入流程

```
spinner.onLoad()
    │
    ▼
_refreshBasketData()
    │ ·读取 Storage
    │ ·统计: basketCount, importedBasketCount, fridgeBasketCount
    │ ·计算 historyQuickList (最近常做 & 不在篮子中, 最多 3 条)
    │
    ▼
用户点击「开始生成」→ onStartGenerate()
    │
    ├── 根据优先策略开关 (priorityImported / priorityFridge) 过滤篮子项
    │   ·priorityImported === false → 跳过 source: 'imported' 的项
    │   ·priorityFridge === false   → 跳过 source: 'fridge_match' 的项
    │
    ├── 构建 basketItems 数组: [{ id, name, source, sourceDetail, priority, meat }]
    │   ·meat 字段仅 imported 来源的项才有 (由 createItem 时通过 inferMeatFromName 自动推导)
    │   ·sourceDetail 必传，供 AI 主厨报告话术体现「我看到了你的灵感」及具体来源
    │
    ├── 传给云函数 smartMenuGen:
    │   data: { preference, mood, weather, recentDishNames, candidates, basketItems }
    │
    ├── AI 成功返回后写入 globalData:
    │   ·globalData.chefReportText    ← out.data.reasoning (主厨报告文本；空/过短时云函数降级为预设模板)
    │   ·globalData.dishHighlights    ← out.data.dishHighlights (菜品亮点 { recipeId: text })
    │   ·globalData.lastBasketItems   ← basketItems (供 preview 页展示来源标签)
    │
    └── AI 失败或本地降级时清空上述三个字段 (避免残留旧数据)
```

**主厨报告 (reasoning) 约定**:
- 云函数在 AI 返回的 reasoning 为空或过短（如 &lt; 10 字）时，**降级为预设模板**：有篮子时为「基于你收藏的 [菜名…] 灵感，我为你补全了这顿营养均衡的晚餐。」，无篮子时为「根据今日心情与家常口味，为你搭配了这份套餐。」
- `basketItems` 必含 `sourceDetail`；prompt 要求 AI 话术必须体现「我看到了你的灵感」并点名来源（冰箱匹配/小红书导入/菜谱库收藏等）。

---

### 10.6 Agent 必遵守的规则

> **以下规则与第 1 章 Agent 工作手册同等效力。任何修改灵感篮子相关代码的 Agent 必须遵守。**

| 编号 | 规则 | 说明 |
|------|------|------|
| B-01 | **`inspirationBasket.js` 必须保持纯函数** | 所有函数不得调用 `wx.*`、`this.setData`、`getApp()`; Storage 读写由页面层 (调用方) 完成; 这与 R-01 纯函数设计原则一致 |
| B-02 | **去重以 `uniqueId` 为准（兼容 `id`）** | `addItem()` 优先按 `item.uniqueId` 去重，同 uniqueId 不重复添加；兼容旧数据无 uniqueId 时按 `item.id` 判断；历史推荐项的 `id` 格式为 `'history-' + dishName`, 不得改为其他格式 |
| B-11 | **篮子唯一键 `uniqueId`** | `uniqueId` 在 `createItem()` 内由 `source` 与稳定 id（及可选 `sourceUrl`）拼接生成，业务层不得手写；同源同菜只保留一条，后续可扩展「同链接同 uniqueId」以覆盖同一链接多次导入的重复 |
| B-03 | **跨天清空逻辑只在 `home.onShow()` 中执行** | 不得在 spinner / basketPreview / 其他页面自行实现跨天清空; 统一入口避免竞态 |
| B-04 | **Storage Key 不得修改** | `inspiration_basket` 和 `inspiration_basket_date` 是已部署的 key, 修改会导致用户数据丢失 |
| B-05 | **globalData.inspirationBasket 是内存镜像** | 任何对 Storage 的写操作后, 必须同步更新 `getApp().globalData.inspirationBasket`; 读操作优先从 Storage 读 (globalData 可能过期) |
| B-06 | **入篮后必须更新 date key** | 向篮子添加项后, 必须同时 `wx.setStorageSync(basket.BASKET_DATE_KEY, basket.getTodayDateKey())`, 否则跨天清空逻辑失效 |
| B-07 | **source 枚举值不得擅自扩展** | 当前仅支持 `'native'`, `'imported'`, `'fridge_match'` 三个值; 新增来源类型需同步更新: `inspirationBasket.js` 的 sourceDetail 推断、`basketPreview.js` 的 SOURCE_LABELS 映射、spinner.js 的优先策略过滤 |
| B-08 | **不得在篮子数据中存储完整 Recipe 对象** | 篮子项只存 `{ id, uniqueId, name, source, sourceDetail, addedAt, priority, meta }`, 不包含 ingredients / steps 等大字段; 完整数据在消费时按 id 从菜谱库还原 |
| B-09 | **新增入篮触点必须使用 `basket.createItem()` 工厂函数** | 不得手动构造篮子项对象; `createItem()` 确保字段完整、sourceDetail 自动推断、addedAt 自动填充 |
| B-10 | **不修改排序逻辑时不碰 `basketPreview.js`** | basketPreview 的排序/优先级/删除/历史推荐 UI 已稳定; 新增入篮触点 (scan/import/myRecipes) 只需在对应页面加 `basket.createItem()` + `basket.addItem()` + Storage 写入, 不需要改动 basketPreview |

---

### 10.7 新增入篮触点的标准实现模式

**冷启动角标**：首页 `data.basketCount` 初值须从 Storage 同步读取（与 `BASKET_DATE_KEY` 同天则取 `getCount(parseBasket(raw))`），避免 Donut 下 0→N 闪烁。**可选**：写入 Storage 与 globalData 后调用 `getApp().onBasketChange && getApp().onBasketChange(newList.length)`，home 在 onShow 注册、onHide 注销，使 .basket-bar 平滑更新。

> 给 scan / import / myRecipes 页面添加入篮功能时, 统一使用以下模板:

```javascript
// === 1. 文件头部引入 ===
var basket = require('../../data/inspirationBasket.js');

// === 2. 在合适的事件回调中添加入篮逻辑 ===
// 例如: import 页的保存成功回调, scan 页的勾选菜品回调

function addToBasket(recipe, source, options) {
  // 2a. 创建篮子项 (纯函数)
  var item = basket.createItem(recipe, source, options);
  
  // 2b. 读取当前篮子
  var raw = '';
  try { raw = wx.getStorageSync(basket.STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
  var list = basket.parseBasket(raw);
  
  // 2c. 去重添加 (纯函数)
  var newList = basket.addItem(list, item);
  
  // 2d. 只在实际新增时写入
  if (newList.length > list.length) {
    try {
      wx.setStorageSync(basket.STORAGE_KEY, basket.serializeBasket(newList));
      wx.setStorageSync(basket.BASKET_DATE_KEY, basket.getTodayDateKey()); // B-06!
    } catch (e) { /* ignore */ }
    
    // 2e. 同步 globalData (B-05!)
    var app = getApp();
    if (app && app.globalData) app.globalData.inspirationBasket = newList;
    if (app.onBasketChange) app.onBasketChange(newList.length);
    
    wx.showToast({ title: '已加入灵感篮', icon: 'success' });
  } else {
    wx.showToast({ title: '已在篮子中', icon: 'none' });
  }
}

// === 3. 各页面调用示例 ===

// scan 页: AI 推荐菜品被勾选时
addToBasket(
  { id: recipe.id, name: recipe.name },
  'fridge_match',
  { meta: { fridgeIngredients: recognizedItems } }
);

// import 页: 菜谱保存成功后
addToBasket(
  { id: savedRecipe._id, name: savedRecipe.name, sourcePlatform: 'xiaohongshu' },
  'imported'
);

// myRecipes 页: 点击收藏按钮
addToBasket(
  { id: recipe.id || recipe._id, name: recipe.name },
  'native',
  { sourceDetail: '菜谱库收藏' }
);
```

---

### 10.8 首页 UI 组件对照表

| WXML 元素 | CSS class | 显示条件 | 功能 |
|-----------|-----------|----------|------|
| 角标 (今天吃什么入口右侧) | `.basket-badge` | `basketCount > 0` | 显示篮子内菜品数量 |
| 灵感篮预览条 | `.basket-bar` | `basketCount > 0` | 点击跳转 basketPreview 页 |
| 历史推荐卡片 | `.history-hint-card` | `basketCount === 0 && showHistoryHint && historyDishNames.length > 0` | 篮子为空时, 推荐最近 7 天内的高频菜品 |

**视觉规范** (不得修改):

```
角标:       背景 #c1663e, 文字 #fff, 圆角 100rpx, 最小宽度 36rpx
预览条:     背景渐变 rgba(193,102,62,0.1→0.06), 边框 rgba(193,102,62,0.2)
历史推荐:   背景渐变 rgba(139,119,101,0.08→0.04), 边框 rgba(139,119,101,0.2)
```

---

### 10.9 与现有模块交互影响

| 被修改/新增 | 影响的模块 | 注意事项 |
|------------|-----------|----------|
| 新增 scan 页入篮 | `scan.js` only | 不影响 AI 识别和配菜逻辑; 仅在结果展示层加按钮 |
| 新增 import 页入篮 | `import.js` only | 在保存成功回调中添加, 不改变导入/解析流程 |
| ✅ myRecipes 页投篮 | `myRecipes.js` + `myRecipes.wxml` | **已部署**: 心形按钮 toggle 加入/移出篮子; `basketIds` 追踪 UI 状态; `_refreshBasketIds()` 在 `onShow` 中刷新 |
| ✅ Preview 篮子来源标签 | `preview.js` | **已部署**: 读取 `globalData.lastBasketItems`, 在菜单卡片上显示 `fromBasket` (Boolean) 和 `basketSourceLabel` (如"导入菜谱""冰箱匹配""收藏"); sourceLabels 映射: `{ imported: '导入菜谱', fridge_match: '冰箱匹配', native: '收藏' }` |
| ✅ Preview 闭环清理 | `preview.js` → `confirmAndGo()` | **已部署**: 确认做饭后调用 `basket.removeItemsByMenu(list, menus)`, 按 id + name 双重匹配移除已选菜品; 同步更新 Storage 和 globalData |
| smartMenuGen 解析 basketItems | `smartMenuGen/lib/prompt-builder.js` | spinner.js 已传 `basketItems` 字段 (含 meat), 云函数端需在 prompt 中加 "优先从以下菜品中选取: ..." |
| `inspirationBasket.js` | home, spinner, basketPreview, **myRecipes, preview** | **任何修改必须验证五个页面都正常工作** |
| `menuHistory.js` | home, spinner, basketPreview | `getSmartRecommendations()` 的评分公式变更会影响三个页面的推荐结果 |

---

> **文档编制**: TableSync 工程团队  
> **最后更新**: 2026-02-08  
> **版本**: v1.7
