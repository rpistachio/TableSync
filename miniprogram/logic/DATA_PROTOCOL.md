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

## 接口人（Exports）

所有页面 JS 必须通过 `require('../../data/menuGenerator.js')` 引入并使用：

| 函数 | 说明 | 纯函数 |
|------|------|--------|
| `filterByPreference(recipes, userPreference)` | 过滤忌口 | ✅ 输入→输出，不调用 wx/this |
| `calculateScaling(recipe, totalCount)` | 份额缩放 | ✅ 不修改入参，返回新对象 |
| `computeDashboard(menus, pref)` | 看板计算 | ✅ 输入→输出 |

逻辑层不调用 `wx.setStorageSync` 或 `this.setData`，这些由页面层在拿到返回值后自行处理。
