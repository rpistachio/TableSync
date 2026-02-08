# recipeCoverGen

为导入的外部菜谱静默生成「暗调高级感」封面图。

- 使用与 `tools/generate.js` 中一致的 Midjourney 风格 prompt（Krautkopf style, moody tones）。
- **优先使用 MiniMax image-01**，未配置时使用 OpenAI DALL·E 2。

## 配置

在云函数目录下创建 `secret-config.json`（或云开发控制台环境变量）：

- **`MINIMAX_API_KEY`**（推荐）：[MiniMax 开放平台](https://platform.minimaxi.com/) 的 API Key。
  - 需在 **按量付费** 下点击「创建新的 API Key」（[接口密钥](https://platform.minimaxi.com/user-center/basic-information/interface-key)），Coding Plan 的 Key 不支持图像接口。
  - 复制时不要带空格或换行；代码会自动去除 Key 中的空格。
  - **默认请求国际站** `api.minimax.io`。若你的 Key 来自**国内站** [minimaxi.com](https://platform.minimaxi.com)，请在 `secret-config.json` 中增加 `"MINIMAX_HOST": "api.minimaxi.com"`。
  - 若提示 `invalid api key`：确认是**按量付费**创建的 Key、已充值余额。
- **`OPENAI_API_KEY`**：可选，未配置 MiniMax 时使用 OpenAI DALL·E 2。

两者均未配置时云函数会正常返回并跳过生成，不影响保存菜谱。

配置后，用户在导入页点击「保存到我的菜谱」时，会静默触发本云函数为该条记录生成封面；生成完成后，我的菜谱库中会显示新封面。
