# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

TableSync is a family meal planning product. The codebase has three independent npm package roots:

1. **Root (`/`)** — Vue 3 + Vite web app (early-stage prototype mirroring the mini-program logic)
2. **`tools/`** — Node.js CLI developer toolchain (recipe generation, cloud sync, etc.)
3. **`miniprogram/`** — WeChat Mini Program (native WXML/WXSS/JS, no npm)

### Running the Vue Web App

- `npm run dev` starts the Vite dev server on `http://localhost:5173`
- Use `npx vite --host 0.0.0.0` if you need the server accessible externally
- `npm run build` produces a production build in `dist/`
- Dependencies require `--legacy-peer-deps` due to a peer conflict between `vite@^7` and `@vitejs/plugin-vue@^5`

### Validation Scripts

- `node scripts/validate_recipes.js` — validates recipe data consistency
- `node scripts/steps_sanity_check.js` — validates cooking step rendering logic

### Notes

- No ESLint, Prettier, or test framework is configured in this codebase. There are no automated unit/integration tests to run.
- The WeChat Mini Program (`miniprogram/`) cannot be run outside WeChat DevTools. Only the Vue web app is runnable in the cloud environment.
- Cloud functions (`cloudfunctions/`) depend on `wx-server-sdk` and WeChat Cloud (TCB) — they cannot be tested locally without WeChat cloud credentials.
- `tools/` CLI commands require API keys (Anthropic, MiniMax, TCB) configured via `tools/.env` or `tools/secret-config.json`. Without these keys, tools will fail at runtime.
