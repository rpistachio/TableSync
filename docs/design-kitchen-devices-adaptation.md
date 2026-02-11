# 厨房设备与并行调度适配方案

> **目标**：增加烤箱、独立电蒸锅等不占灶台插电厨具，将设备从 stove_long/steamer 中剥离；将 DEVICE_LIMITS 参数化由 UserPreference 注入；单灶模式下自动识别洗锅/刷锅时间间隙，避免步骤生硬重叠。  
> **关联**：spec.md 4.3 UserPreference / kitchenConfig；menuGenerator.js 设备互斥与 fillGaps。

---

## 1. Data Model 更新（spec.md）

### 1.1 kitchenConfig 子结构（与代码一致）

在 **spec.md §4.3 UserPreference** 的「kitchenConfig 子结构」表中，补全并统一为以下定义（与 `menuGenerator.computeDeviceLimits` 一致）：

| 字段 | 类型 | 必填 | 约束 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `burners` | Number | 否 | 1-4 | `2` | 燃气灶火眼数 |
| `hasSteamer` | Boolean | 否 | — | `false` | **独立电蒸锅**（不占灶；无则为灶上蒸锅，占 1 灶） |
| `hasAirFryer` | Boolean | 否 | — | `false` | 空气炸锅（不占灶） |
| `hasRiceCooker` | Boolean | 否 | — | `false` | 电饭煲（不占灶） |
| `hasOven` | Boolean | 否 | — | `false` | **烤箱**（不占灶） |

**设计说明**：

- **占灶 vs 不占灶**：仅 `wok`、`stove_long`、`pot` 及「无独立电蒸锅时的 steamer」占用 burners；`steamer` 在 `hasSteamer === true` 时不占灶；`air_fryer`、`rice_cooker`、`oven` 永不占灶。
- **设备上限来源**：各设备槽位上限由 `kitchenConfig` 唯一推导，不单独存储；算法层通过 `computeDeviceLimits(kitchenConfig)` 得到动态 limits（见第 2 节）。

### 1.2 cook_type 与设备映射（供菜谱/云函数使用）

菜谱或导入数据中的 `cook_type` / `cook_method` 与「逻辑设备」的对应关系（与 `menuGenerator.COOK_TYPE_TO_DEVICE` 一致）：

| cook_type | 逻辑设备 | 是否占灶 |
|-----------|----------|----------|
| stir_fry / quick_stir_fry / fry / braise | wok | 是 |
| stew | stove_long | 是 |
| steam | steamer | 由 hasSteamer 决定 |
| boil | pot | 是 |
| cold / cold_dress / salad | none | 否 |
| air_fryer | air_fryer | 否 |
| rice_cooker | rice_cooker | 否 |
| **oven** | **oven** | **否** |

新增 `oven`：菜谱可设 `cook_type: 'oven'`，仅在用户 `hasOven === true` 时计入设备上限 1，且不占灶。

---

## 2. menuGenerator.js 参数化：DEVICE_LIMITS 由 UserPreference 注入

### 2.1 现状与目标

- **现状**：存在静态常量 `DEVICE_LIMITS`，部分路径在「无 kitchenConfig」时回退到该常量；`computeDeviceLimits(kitchenConfig)` 已根据 kitchenConfig 计算动态上限。
- **目标**：所有「设备上限」均视为由 UserPreference 注入的**动态对象**；`DEVICE_LIMITS` 仅作为**无 kitchenConfig 时的默认 fallback**，不在有 preference 时使用。

### 2.2 数据流约定

- **入口**：`generateMenuWithFilters(..., filters)` 中 `filters.kitchenConfig` 或 `filters.userPreference.kitchenConfig`。
- **生成步骤**：`generateSteps(preference, options)` 的 `options.kitchenConfig` 或 `preference.kitchenConfig`。
- **统一取值**：凡需「设备上限」的地方，使用：
  - `limits = (kitchenConfig != null) ? computeDeviceLimits(kitchenConfig) : DEVICE_LIMITS`  
  即：有配置则动态计算，无配置才用静态默认。

### 2.3 需保证的调用点（已符合或需核对）

| 位置 | 当前行为 | 说明 |
|------|----------|------|
| `generateMenuWithFilters` 内 deviceLimits | `kitchenConfig ? computeDeviceLimits(kitchenConfig) : null` | 传 null 时内部用 pickOneWithDeviceBalance(pool, counts, **limits**) 的 limits 由上层传入；需保证上层在无 kitchenConfig 时传 `DEVICE_LIMITS` 或 `computeDeviceLimits({})`，避免 undefined。 |
| `createDeviceTracker(kitchenConfig)` | 无 config 时用 `{ wok:2, stove_long:1, ... }` 字面量 | 与 DEVICE_LIMITS 对齐并包含 oven（见 2.4）。 |
| `fillGaps(..., kitchenConfig)` | `kitchenConfig ? computeDeviceLimits(kitchenConfig) : DEVICE_LIMITS` | 已参数化。 |
| `buildTimeline(..., kitchenConfig)` | 内部 createDeviceTracker(kitchenConfig) | 已参数化。 |
| `detectBurnerOverflow(steps, kitchenConfig)` | computeDeviceLimits(kitchenConfig) | 已参数化。 |
| `wouldExceedDeviceLimit` / `filterByDeviceLimits` / `pickOneWithDeviceBalance` | 参数 `limits`，调用方传入 | 调用方统一传「动态 limits 或 DEVICE_LIMITS」。 |

建议：在 `generateMenuWithFilters` 中显式写：

```js
var deviceLimits = kitchenConfig ? computeDeviceLimits(kitchenConfig) : DEVICE_LIMITS;
```

并在调用 `pickOneWithDeviceBalance(..., deviceLimits)` 时始终传 `deviceLimits`（不要传 null），这样「无 kitchenConfig」时仍有一致默认行为。

### 2.4 新增设备：烤箱 (oven)

在 **menuGenerator.js** 中与现有 air_fryer / rice_cooker 一致地加入 oven：

- **COOK_TYPE_TO_DEVICE**：`oven: 'oven'`
- **DEVICE_LIMITS**（fallback）：`oven: 1`
- **initDeviceCounts**：`oven: 0`
- **computeDeviceLimits**：
  - `oven: hasOven ? 1 : 0`
  - `_needsBurner.oven: false`
- **createDeviceTracker** 无 config 时的 fallback 对象：加入 `oven: 1`
- **reservations**：allocate 已支持动态 key，可不改；若希望初始化一致，可给 `reservations.oven = []`
- **DEVICE_GANTT_COLORS**：`oven: '#ff5722'`（或其它区分色）

独立电蒸锅无需新增设备类型：仍为 `steamer`，通过 `_needsBurner.steamer = !hasSteamer` 区分占灶/不占灶。

---

## 3. fillGaps 逻辑修正：单灶洗锅/刷锅时间间隙

### 3.1 问题

- 单灶（burners=1）时，连续两个 wok 步骤之间应插入「洗锅/刷锅」时间（如 3 分钟），避免步骤在时间上重叠。
- 当前实现已在**步骤序列**上插入一条“快速冲洗炒锅”的虚拟步骤，但：
  - 该步骤没有 `gapStartAt` / `gapEndAt`，时间线未显式留出这段间隙；
  - 若存在仅「active_tail」无长耗时任务的场景，tail 里的多个 wok 步骤可能既无时间戳也无洗锅间隙，易被理解为“可并行”或时间重叠。

### 3.2 目标行为

- **单灶**下，任意两个在时间上相邻的、同为 wok 的步骤之间，算法**自动识别**一段洗锅间隙（如 3 分钟），并满足其一或两者：
  - 插入一条带 `duration_num` 的洗锅步骤，且
  - 为该洗锅步骤与前后 wok 步骤赋予 `gapStartAt` / `gapEndAt`，使时间线连续、无重叠。
- 这样并行调度在单灶下会显式体现“同一口锅顺序用 + 中间洗锅”，而不是步骤重叠。

### 3.3 实现要点

1. **保留现有“插入洗锅步骤”逻辑**（burners=1 且连续两步均为 wok 时插入 3 分钟洗锅步骤）。
2. **为洗锅步骤与受影响的步骤补时间线**（在单灶分支内）：
   - 从第一条带 `startAt`/`endAt` 或 `gapStartAt`/`gapEndAt` 的步骤开始，向后扫描；
   - 遇到「上一为 wok、当前为 wok」时，在中间插入的 wash 步骤上设置：
     - `gapStartAt = prevEnd`，`gapEndAt = prevEnd + 3`（prevEnd 为上一步骤结束时间）；
   - 再将当前 wok 步骤的 `gapStartAt`/`gapEndAt` 设为从 `prevEnd + 3` 开始，使其紧接洗锅之后；
   - 若当前步骤原无时间，则用「上一结束 + 3 + 当前 duration」推导结束时间，保证后续步骤可依次类推。
3. **仅 active_tail 且无 long_term 的纯 wok 序列**：
   - 在「无长耗时任务」的简化分支（mergedPrep → activeAndIdle → finish）里，若 `kitchenConfig && burners === 1`，且 activeAndIdle 中存在多个 wok 步骤，可在合并后对 result 做一次「单灶 wok 顺序化」：按顺序为每个 wok 步骤与中间的洗锅步骤赋予 `gapStartAt`/`gapEndAt`（从 0 起累加 duration 与 3 分钟间隙），这样甘特与总时长统计一致且无重叠。

### 3.4 边界

- 仅当 `kitchenConfig` 存在且 `limits._burners === 1` 时启用「洗锅间隙」插入与时间赋值。
- 洗锅步骤的 `device: 'none'`，不参与灶台占用计数；`pipelineStage: 'wash_gap'` 便于前端区分展示。

---

## 4. 实施顺序建议

1. **spec.md**：按 1.1 更新 kitchenConfig 表，补全 hasRiceCooker、hasOven，并加 1.2 的 cook_type↔设备表（含 oven）。
2. **menuGenerator.js**：  
   - 按 2.4 增加 oven 全链路；  
   - 按 2.3 统一 `generateMenuWithFilters` 的 deviceLimits 为「有 kitchenConfig 用 computeDeviceLimits，否则 DEVICE_LIMITS」并始终传入 pickOneWithDeviceBalance。
3. **fillGaps**：按 3.2–3.3 在单灶分支内为洗锅步骤与相邻 wok 步骤补全 `gapStartAt`/`gapEndAt`；若有「无 long_term 仅 tail」路径，在该路径下增加单灶 wok 顺序时间赋值。

完成以上三步后，烤箱与独立电蒸锅在数据模型和调度上均与现有不占灶设备一致，单灶下的洗锅间隙也会被时间线显式识别，避免步骤重叠。
