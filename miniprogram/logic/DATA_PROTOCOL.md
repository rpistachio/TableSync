# 数据协议：页面层 ↔ 逻辑层

## userPreference 统一格式

页面传给逻辑层的 **userPreference** 必须使用以下字段名，避免在不同页面混淆：

```js
{
  avoidList: [],    // 忌口/过敏标签，如 ['spicy', 'seafood', 'peanut']
  dietStyle: '',    // 口味偏好：'home' | 'light' | 'rich' | 'quick'
  isTimeSave: false // 是否省时优先
}
```

- **avoidList**：与 `avoidOptions` 的 `value` 一致，不要使用 `allergens` 等其它命名。
- **dietStyle**：与 `dietOptions` 的 `value` 一致，不要使用 `dietary_preference` 等其它命名。
- **isTimeSave**：布尔值，不要使用 `is_time_save` 等其它命名。

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
