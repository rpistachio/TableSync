# 数据协议：页面层 ↔ 逻辑层

## userPreference 统一格式

页面传给逻辑层的 **userPreference** 必须使用以下字段名，避免在不同页面混淆：

```js
{
  avoidList: [],    // 忌口/过敏标签，如 ['spicy', 'seafood', 'peanut']
  dietStyle: '',    // 口味偏好：'home' | 'light' | 'rich' | 'quick'
  isTimeSave: false, // 是否省时优先
  kitchenConfig: {  // 厨房设备配置（灶台适配）
    burners: 2,
    hasSteamer: false,
    hasAirFryer: false,
    hasOven: false
  }
}
```

- **avoidList**：与 `avoidOptions` 的 `value` 一致，不要使用 `allergens` 等其它命名。
- **dietStyle**：与 `dietOptions` 的 `value` 一致，不要使用 `dietary_preference` 等其它命名。
- **isTimeSave**：布尔值，不要使用 `is_time_save` 等其它命名。
- **kitchenConfig**：厨房设备配置，用于灶台适配（菜单生成与步骤调度的设备上限）。缺省时逻辑层使用默认双灶配置。

逻辑层（如 `menuGenerator.normalizeUserPreference`）会兼容旧字段名 `allergens`、`dietary_preference`、`is_time_save`，但**新代码请统一使用上述字段**。

---

## 步骤数据统一协议（generateSteps 返回值）

页面通过 `generateSteps(preference, options?)` 获取的步骤列表中，每一项 `step` 至少保证以下字段（新增字段已标注）：

```js
{
  // 基础字段（已存在）
  id: Number,               // 全局唯一步骤 ID
  recipeId: String,         // 所属菜品 ID
  text: String,             // 展示文案
  step_type: 'prep'|'cook', // 备菜 / 烹饪
  duration_num: Number,     // 预计耗时（分钟）

  // 新增：动作类型与并行信息
  actionType: 'long_term' | 'active' | 'idle_prep', // 动作类型枚举
  // long_term：长耗时被动等待（炖、焖、煮汤等）
  // active：需要紧盯火候/翻炒/调味的主动操作
  // idle_prep：可穿插在空档期的备菜/腌制等

  parallel: Boolean,        // 是否设计为可与其他菜并行
  waitTime: Number,         // （可选）本步骤触发后的被动等待时间（分钟，long_term 为主）

  // 新增：阶段信息（用于阶段横幅）
  isPhaseStart: Boolean,    // 是否为阶段起始步骤
  phaseType: String,        // 阶段类型，如 'prep' | 'long_term' | 'gap' | 'finish'
  phaseTitle: String,       // 阶段标题文案，如「全局备菜」「长耗时启动」
  phaseSubtitle: String,    // 阶段副标题/说明，可选

  // 新增：并行上下文提示（可选）
  parallelContext: {
    activeTaskName: String,   // 当前在并行进行的核心任务名，如「牛腩炖煮」
    remainingMinutes: Number, // 预计剩余分钟数
    hint: String              // 展示给用户的提示文案
  } | null
}
```

**约定说明：**

- 页面层（如 `steps` 页）可以安全依赖上述字段进行：
  - 阶段横幅展示（依据 `isPhaseStart` + `phaseTitle` / `phaseSubtitle`）；
  - 并行提示展示（依据 `parallelContext`）；
  - 是否并行的视觉标记（依据 `parallel`）。
- 未使用到的字段可在页面层忽略，但**不要重命名或在页面层自行拼装上述含义相同的字段**。

---

## 接口人（Exports）

所有页面 JS 必须通过 `require('../../data/menuGenerator.js')` 引入并使用：

| 函数 | 说明 | 纯函数 |
|------|------|--------|
| `filterByPreference(recipes, userPreference)` | 过滤忌口 | ✅ 输入→输出，不调用 wx/this |
| `calculateScaling(recipe, totalCount)` | 份额缩放 | ✅ 不修改入参，返回新对象 |
| `computeDashboard(menus, pref)` | 看板计算 | ✅ 输入→输出 |

步骤生成相关约定：

- 页面优先通过 `require('../../data/menuData.js')` 调用 `generateSteps(preference, options?)` 获取步骤列表；
- `options.forceLinear === true` 时，会强制使用按菜品顺序的线性逻辑（不启用多菜并行流水线），用于**缺料或异常时的容错降级**；
- 线性逻辑内部复用单菜 `menuGenerator.generateSteps(adultRecipe, babyRecipe, shoppingList)`，对多道菜按菜单顺序串联步骤，并重新分配全局唯一 `id`。

多菜并行流水线相关约定：

- 默认情况下（未设置 `forceLinear`）逻辑层会根据菜品及步骤信息：
  - 自动推断 `actionType`；
  - 计算长耗时步骤的 `waitTime`；
  - 重排多菜步骤顺序，并填充 `parallel`、`isPhaseStart`、`phaseTitle`、`parallelContext` 等字段。
- 当逻辑层检测到**缺料/异常**时，会自动回退到线性逻辑，页面表现为：
  - `parallel` 多数为 `false`；
  - `parallelContext` 为空或缺失；
  - 阶段横幅相关字段可能不再设置。

逻辑层不调用 `wx.setStorageSync` 或 `this.setData`，这些由页面层在拿到返回值后自行处理。

---

## Taste Profile（口味档案）数据协议

Storage key: `taste_profile`

与 `today_menus_preference`（单次会话偏好）共存。Taste Profile 管理用户的**长期画像**，由需求探针（Demand Probes）逐步收集。

### 完整结构

```js
{
  // 场景（volatile，每次进入首页重置）
  scene: 'couple',           // 'solo' | 'couple' | 'family' | 'gathering' | null
  headcount: 2,              // 从 scene 自动推导

  // 口味亲和度（persistent，累加制，Phase 2 启用）
  flavorAffinity: {
    light: 3,                // 选过 3 次"清淡"
    spicy: 7,                // 选过 7 次"来点辣的"
    sour_fresh: 1,
    salty_umami: 2,
    sweet_sour: 0
  },

  // 食材亲和度（persistent，累加制，Phase 2 启用）
  ingredientAffinity: {
    seafood: 2,
    beef: 5,
    chicken: 3,
    pork: 1,
    vegetable: 4
  },

  // 硬约束（persistent，由约束探针写入）
  avoidList: ['spicy', 'peanut'],

  // 库存急用（volatile，单次消费，用完即清）
  urgentIngredient: null,    // 'meat' | 'vegetable' | 'seafood' | null

  // 厨房配置（persistent，商业化预埋）
  kitchenConfig: {
    burners: 2,
    hasSteamer: false,
    hasAirFryer: false,
    hasOven: false
  },

  // 元数据
  createdAt: '2026-02-24',
  lastProbeAt: '2026-02-24',
  totalCooks: 0,
  visitCount: 0,             // 累计访问次数（驱动库存探针轮换节奏）
  version: 1
}
```

### 字段分类

| 类别 | 字段 | 生命周期 | 写入时机 |
|------|------|----------|----------|
| volatile | `scene`, `headcount`, `urgentIngredient` | 每次 session | 探针回答 / 进入首页时重置 |
| persistent | `flavorAffinity`, `ingredientAffinity` | 累加不清除 | 探针回答（Phase 2） |
| persistent | `avoidList`, `kitchenConfig` | 长期有效 | 探针回答 / 设置页编辑 |
| metadata | `visitCount`, `totalCooks`, `lastProbeAt` | 递增不清除 | 每次进入首页 / 完成烹饪 |

### 接口人（Exports）

读写通过 `require('../../data/tasteProfile.js')`：

| 函数 | 说明 | 副作用 |
|------|------|--------|
| `get()` | 读取完整档案 | 无 |
| `save(profile)` | 写入完整档案 | wx.setStorageSync |
| `update(patch)` | 合并更新部分字段 | wx.setStorageSync |
| `setScene(scene)` | 设置场景 + 推导 headcount | wx.setStorageSync |
| `getSceneConfig()` | 获取场景→菜品结构映射 | 无 |
| `inferDietStyle(affinity?)` | 口味亲和度→dietStyle 推导 | 无 |
| `inferPreferredMeats(affinity?)` | 食材亲和度→推荐主料推导 | 无 |
| `getFlavorHint(affinity?)` | 生成 AI prompt 用的口味描述 | 无 |
| `setUrgent(type)` | 设置库存急用 | wx.setStorageSync |
| `consumeUrgent()` | 消费并清除库存急用（单次） | wx.setStorageSync |
| `incrementVisit()` | 递增访问计数 | wx.setStorageSync |
| `isFirstVisit()` | 是否首次使用 | 无 |

探针选择逻辑通过 `require('../../logic/probeEngine.js')`：

| 函数 | 说明 |
|------|------|
| `selectNextProbe()` | 根据档案完整度选择下一个探针 |
| `resetVolatile()` | 重置 volatile 字段（进入首页时调用） |
| `handleProbeAnswer(type, value)` | 处理用户选择，返回确认文案 |
| `buildSessionSummary()` | 生成当前 session 的综合确认文案 |

### userPreference 扩展字段

`_buildZenPreference()` 现在从 Taste Profile 动态构建，新增以下扩展字段传递给 AI：

```js
{
  // ... 原有字段 ...
  preferredMeats: ['beef', 'chicken'],  // 从 ingredientAffinity 推导
  flavorHint: '偏好辣味(7次)、清淡(3次)',  // AI prompt 可读的口味描述
  urgentIngredient: 'meat'              // 库存急用，单次有效
}
```

逻辑层（menuGenerator）对未识别的扩展字段不报错，仅在 AI 管道（smartMenuGen）中使用。
