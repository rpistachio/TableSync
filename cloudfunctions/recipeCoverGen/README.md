# recipeCoverGen

为导入的外部菜谱静默生成「暗调高级感」封面图。

- 使用与 `tools/generate.js` 中一致的 Midjourney 风格 prompt（Krautkopf style, moody tones）。
- 支持 **MiniMax** 或 **OpenAI DALL·E 2** 生成图片，**优先使用 MiniMax**（若已配置）。

## 配置

在云函数目录下创建 `secret-config.json`（或云开发控制台环境变量）：

- **`MINIMAX_API_KEY`**（推荐）：[MiniMax 开放平台](https://platform.minimaxi.com/) 的 API Key，使用 image-01 文生图。
  - 必须是 **按量付费** 下创建的「创建新的 API Key」（[接口密钥](https://platform.minimaxi.com/user-center/basic-information/interface-key)），Coding Plan 的 Key 不支持图像接口。
  - 复制时不要带空格或换行，填完整一串。
- **`OPENAI_API_KEY`**：OpenAI API Key（DALL·E 2）。未配置 MiniMax 时使用。

两者均未配置时云函数会正常返回并跳过生成，不影响保存菜谱。

配置后，用户在导入页点击「保存到我的菜谱」时，会静默触发本云函数为该条记录生成封面；生成完成后，我的菜谱库中会显示新封面。
