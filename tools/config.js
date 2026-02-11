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
    };
  } catch {
    return { key: '', host: '' };
  }
}

const minimaxSecret = loadMinimaxSecret();

export const CONFIG = {
  // LLM 相关
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'claude-3-5-sonnet-latest',

  // MiniMax 文生图（与 MJ 风格 prompt 共用，自动出图）
  // 优先 .env，否则复用 cloudfunctions/recipeCoverGen/secret-config.json（与云函数同一 key，且 host 一致避免 invalid api key）
  minimaxApiKey: normalizeApiKey(process.env.MINIMAX_API_KEY) || minimaxSecret.key,
  minimaxHost: (process.env.MINIMAX_HOST || '').trim() || minimaxSecret.host,

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

