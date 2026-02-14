# 菜谱同步使用说明（generate → 选图 → sync 上传）

## 一、流程概览

1. **生成草稿**：用 `generate.js` 或 `trend-hunter.js` 生成菜谱草稿，得到 `drafts/YYYY-MM-DD_batch.json`。
2. **封面图**（二选一）：
   - **自动出图**：生成时加 `--gen-images`，或对已有草稿补图：`node tools/generate.js --gen-images-only --draft <草稿路径>`（需在 tools/.env 配置 MINIMAX_API_KEY）。
   - **手动选图**：在本地（如 Downloads）找到心仪的封面图，sync 时用 `--image <路径>` 指定。
3. **同步**：用 `sync.js` 指定草稿 + 第几道菜 + 图片路径，一键上传图片、写入云数据库、更新本地 `recipes.js` 和 `recipeCoverSlugs.js`。

---

## 二、sync.js 命令格式

**必须**指定草稿文件，**可选**指定「第几道菜」和「本地图片路径」：

```bash
node tools/sync.js --draft <草稿路径> [--index <序号>] [--image <图片路径>] [--dry-run]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `--draft <file>` | 是 | 草稿 JSON 路径，如 `drafts/2026-02-07_batch.json` |
| `--index <n>` | 否 | 只同步第 n 道菜（从 0 开始）。不传则按草稿内 status 批量处理 |
| `--image <path>` | 否 | 本地封面图路径。**与 --index 一起用时**会把这图当作该道的封面并上传 |
| `--dry-run` | 否 | 只预览，不上传、不写库、不改本地文件 |

---

## 三、你当前场景：心仪图在本地 download

假设：

- 草稿是 `drafts/2026-02-07_batch.json`
- 你要同步的是**第 1 道菜**（序号为 **0**）
- 图片在**系统下载目录**：`~/Downloads/心仪图.jpg`

在**项目根目录**执行：

```bash
node tools/sync.js --draft drafts/2026-02-07_batch.json --index 0 --image ~/Downloads/心仪图.jpg
```

若草稿在 tools 目录下，且你用相对路径：

```bash
node tools/sync.js --draft tools/drafts/2026-02-07_batch.json --index 0 --image ~/Downloads/心仪图.jpg
```

**第 2 道菜**（序号 1）、**第 3 道菜**（序号 2）同理，只改 `--index` 和 `--image`：

```bash
node tools/sync.js --draft drafts/2026-02-07_batch.json --index 1 --image ~/Downloads/第二道菜的图.png
```

> 图片会按草稿里该道菜的 slug 自动重命名并上传到云存储；同步成功后会自动更新本地 `miniprogram/data/recipes.js` 和 `recipeCoverSlugs.js`。

---

## 四、路径说明

- **草稿路径**：相对项目根或相对当前工作目录均可，例如  
  `drafts/2026-02-07_batch.json` 或 `tools/drafts/2026-02-07_batch.json`。
- **图片路径**：建议用**绝对路径**，避免 zsh 解析问题：
  - macOS 下载目录：`/Users/你的用户名/Downloads/文件名.jpg`
  - 或 `~/Downloads/文件名.jpg`（不要复制到多余换行）。

若出现 `zsh: parse error near '\n'`，多半是复制时带了隐藏换行，可手敲一行或只复制命令主体再执行。

---

## 五、先预览再执行

不确定时先用 `--dry-run` 看会同步哪一道、会用什么图：

```bash
node tools/sync.js --draft drafts/2026-02-07_batch.json --index 0 --image ~/Downloads/心仪图.jpg --dry-run
```

确认无误后去掉 `--dry-run` 再执行一次。

---

## 六、批量同步（多道菜都已选好图）

若草稿里多道菜的 `image_file` 已在 JSON 里填好（或你手动改过），可以不传 `--image`，只传 `--draft`，sync 会按草稿里的 `image_file` 上传；此时通常需要把对应条目改为 `status: "approved"` 再跑，避免误同步。单道菜用 `--index` + `--image` 最直接。

---

## 七、空气炸锅菜封面补图（无草稿）

`recipes.js` 里 9 道「空气炸锅替代菜谱」未走 generate 流程，默认无封面图。可用脚本一次性生成图并上传、更新 `recipeCoverSlugs.js`：

```bash
cd tools && node generate-covers-for-airfryer.js
```

- **依赖**：`tools/.env` 中 `MINIMAX_API_KEY`（或复用 `cloudfunctions/recipeCoverGen/secret-config.json`）；上传需 `TCB_ENV_ID` / `TCB_SECRET_ID` / `TCB_SECRET_KEY`。
- **预览**：`node generate-covers-for-airfryer.js --dry-run` 只出图到 `drafts/images/`，不上传、不写 slug。

---

**查看 sync 帮助**：`node tools/sync.js --help`
