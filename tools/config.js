import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 tools/.env（如果存在）
dotenv.config({ path: path.join(__dirname, '.env') });

export const CONFIG = {
  // LLM 相关
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'claude-3-5-sonnet-latest',

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

