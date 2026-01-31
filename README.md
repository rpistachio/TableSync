## Technical Updates

### 核心功能逻辑

- **多阶育儿引擎 (Multi-stage Feeding Logic)**：
  - 基于 `getBabyStageConfig` 实现 6-36 个月龄的 5 阶段适配。
  - 动态注入性状（泥/末/丁）与调味克数（基于儿保标准）。
- **解耦式数据架构 (Decoupled Data Architecture)**：
  - `recipes.js` 模板化，利用占位符实现数据与逻辑分离。
- **智能食材平替 (Ingredient Substitution)**：
  - 建立等效营养映射表，支持一键切换同类食材并同步更新烹饪指令。
- **UI/UX 优化 (Interface Overhaul)**：
  - 引入极简主义视觉规范，优化信息密度，提升职场妈妈的使用效率。
- **协作卡片渲染 (Collaboration Card)**：
  - 导出针对移动端优化的执行卡片，解决家庭内部跨角色的信息不对称。

---
