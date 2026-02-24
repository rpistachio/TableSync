import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 tools/.env（如果存在）
dotenv.config({ path: path.join(__dirname, '.env') });

/** 规范 API Key：去除首尾与中间换行/多余空格，避免粘贴时带入错误 */
function normalizeApiKey(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\s+/g, ' ').trim();
}

/** 从云函数 secret-config 读取 MiniMax 配置（未配置 .env 时复用同一 key/host） */
function loadMinimaxSecret() {
  const p = path.join(__dirname, '..', 'cloudfunctions', 'recipeCoverGen', 'secret-config.json');
  try {
    const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    const o = JSON.parse(raw);
    return {
      key: normalizeApiKey(o.MINIMAX_API_KEY),
      host: (o.MINIMAX_HOST || '').trim(),
      model: (o.MINIMAX_MODEL || '').trim(),
    };
  } catch {
    return { key: '', host: '', model: '' };
  }
}

/** 从云函数 recipeImport secret-config 读取 Moonshot/Kimi API Key（封面审核 Vision 用） */
function loadMoonshotSecret() {
  const p = path.join(__dirname, '..', 'cloudfunctions', 'recipeImport', 'secret-config.json');
  try {
    const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    const o = JSON.parse(raw);
    return normalizeApiKey(o.MOONSHOT_API_KEY || '');
  } catch {
    return '';
  }
}

const minimaxSecret = loadMinimaxSecret();

export const CONFIG = {
  // LLM 菜谱生成：默认 MiniMax（海外站），可选 LLM_PROVIDER=anthropic 用 Claude
  llmProvider: (process.env.LLM_PROVIDER || 'minimax').toLowerCase(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'claude-3-5-sonnet-latest',

  // MiniMax：文生图 + 文本生成（海外站 api.minimax.io；注意是 minimax.io 不是 minimaxi.io）
  minimaxApiKey: normalizeApiKey(process.env.MINIMAX_API_KEY) || minimaxSecret.key,
  minimaxHost: (() => {
    const raw = (process.env.MINIMAX_HOST || '').trim() || minimaxSecret.host || 'api.minimax.io';
    if (raw === 'api.minimaxi.io') return 'api.minimax.io';
    return raw;
  })(),
  minimaxModel: (process.env.MINIMAX_MODEL || '').trim() || minimaxSecret.model || 'image-01',
  minimaxLlmModel: (process.env.MINIMAX_LLM_MODEL || '').trim() || 'MiniMax-M2.1',

  // Kimi/Moonshot Vision（封面审核 audit-covers.js）
  moonshotApiKey: normalizeApiKey(process.env.MOONSHOT_API_KEY || '') || loadMoonshotSecret(),
  moonshotVisionModel: (process.env.MOONSHOT_VISION_MODEL || '').trim() || 'moonshot-v1-8k-vision-preview',

  // 腾讯云开发环境
  tcbEnvId: process.env.TCB_ENV_ID || 'cloud1-7g5mdmib90e9f670',
  tcbSecretId: process.env.TCB_SECRET_ID || '',
  tcbSecretKey: process.env.TCB_SECRET_KEY || '',

  // 路径相关
  projectRoot: path.resolve(__dirname, '..'),
  draftsDir: path.join(__dirname, 'drafts'),
  templatesDir: path.join(__dirname, 'templates'),

  // 默认生成参数
  defaultGenerateCount: 5
};

