# getRegionByIP 云函数

根据微信云上下文中的 `CLIENTIP` 调用腾讯位置服务 IP 定位接口，返回省/市/区，用于静默粗定位（无需用户授权定位）。

## 配置

- **TENCENT_MAP_KEY** 或 **QQ_MAP_KEY**：腾讯位置服务 Key（必填），在 [控制台](https://lbs.qq.com/) 创建并勾选「WebServiceAPI」。
- **TENCENT_MAP_SK** 或 **QQ_MAP_SK**：可选。若 Key 启用了「签名校验」，在此填写 SecretKey，云函数会带 `sig` 请求，**无需配置授权 IP**。

配置方式：云开发控制台 → 该云函数 → 配置 → 环境变量；或本地在 `secret-config.json` 中填写（勿提交到仓库）。

## 报错「来源IP未被授权」

云函数运行在微信云上，出口 IP 可能为 `49.235.178.22` 等。若腾讯 LBS 的 Key 开启了「授权 IP」且未包含该 IP，会返回此错误。

**解决方式任选其一：**

### 方式一：添加授权 IP（快速）

1. 打开 [腾讯位置服务 - Key 管理](https://lbs.qq.com/)，找到用于 WebServiceAPI 的 Key。
2. 进入设置 → 安全设置 → **授权 IP**。
3. 添加当前报错中提示的 IP（如 `49.235.178.22`），保存。

注意：云函数出口 IP 可能变化，若之后再次报错，可补新 IP 或改用方式二。

### 方式二：使用签名校验（推荐）

1. 在 Key 设置中启用 **签名校验（SN）**，复制生成的 **SecretKey (SK)**。
2. 在云函数环境变量或 `secret-config.json` 中配置 **TENCENT_MAP_SK**（或 **QQ_MAP_SK**）为上述 SK。
3. 重新部署并调用云函数。云函数已支持自动计算 `sig` 并携带请求，不再依赖授权 IP。

参考：[WebServiceAPI Key 配置说明](https://lbs.qq.com/faq/serverFaq/webServiceKey)
