// cloudfunctions/recipeCoverGen/index.js
// 为导入菜谱静默生成「暗调高级感」封面图（复用 generate.js 的 Midjourney 风格 prompt）
// 支持 MiniMax image-01 或 OpenAI DALL·E 2，优先使用已配置的 MiniMax

const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');
const { buildCoverPrompt } = require('./lib/cover-prompt');
const openaiImage = require('./lib/openai-image');
const minimaxImage = require('./lib/minimax-image');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

let SECRET_CONFIG = {};
try {
  SECRET_CONFIG = require('./secret-config.json');
} catch (_) {
  // 可选配置
}

function getConfig(key) {
  const raw = SECRET_CONFIG[key] || process.env[key] || '';
  return typeof raw === 'string' ? raw.trim() : raw;
}

/**
 * 将 Buffer 上传到云存储
 * @param {Buffer} buffer
 * @param {string} cloudPath
 * @returns {Promise<string>} fileID
 */
async function uploadBufferToCloud(buffer, cloudPath) {
  const ext = cloudPath.endsWith('.jpg') ? 'jpg' : 'png';
  const tmpPath = path.join('/tmp', `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    const res = await cloud.uploadFile({
      cloudPath,
      filePath: tmpPath,
    });
    return res.fileID;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {}
  }
}

/**
 * 云函数入口
 * @param {Object} event - { docId: string } 必填，imported_recipes 集合中某条记录的 _id
 * @returns {Object} { code, message?, coverUrl? }
 */
exports.main = async (event, context) => {
  const { docId } = event || {};
  if (!docId) {
    return { code: 400, message: '缺少参数 docId' };
  }

  const minimaxKey = (getConfig('MINIMAX_API_KEY') || '').trim();
  const openaiKey = (getConfig('OPENAI_API_KEY') || '').trim();
  const useMiniMax = minimaxKey.length > 0;
  const apiKey = useMiniMax ? minimaxKey : openaiKey;
  if (!apiKey) {
    console.log('[recipeCoverGen] MINIMAX_API_KEY 与 OPENAI_API_KEY 均未配置，跳过封面生成');
    return { code: 200, message: '未配置 MINIMAX_API_KEY 或 OPENAI_API_KEY，封面生成已跳过', skipped: true };
  }
  if (useMiniMax && apiKey.length < 20) {
    console.warn('[recipeCoverGen] MINIMAX_API_KEY 长度异常，请确认复制的是完整的 API Key');
  }

  try {
    const docSnap = await db.collection('imported_recipes').doc(docId).get();
    const doc = docSnap.data;
    if (!doc) {
      return { code: 404, message: '未找到该菜谱记录' };
    }

    const recipe = doc;
    if (recipe.coverUrl) {
      return { code: 200, message: '已有封面', coverUrl: recipe.coverUrl };
    }

    const prompt = buildCoverPrompt(recipe);
    if (!prompt) {
      return { code: 400, message: '无法生成封面文案（菜名缺失）' };
    }

    console.log('[recipeCoverGen] 生成封面:', recipe.name, 'provider:', useMiniMax ? 'MiniMax' : 'OpenAI');
    const generate = useMiniMax ? minimaxImage.generateImage : openaiImage.generateImage;
    const buffer = await generate(apiKey, prompt);
    if (!buffer || buffer.length === 0) {
      return { code: 500, message: '图片生成失败' };
    }

    const ext = useMiniMax ? 'jpg' : 'png';
    const cloudPath = `recipe_covers/${docId}_${Date.now()}.${ext}`;
    const fileID = await uploadBufferToCloud(buffer, cloudPath);
    if (!fileID) {
      return { code: 500, message: '封面上传失败' };
    }

    await db.collection('imported_recipes').doc(docId).update({
      data: {
        coverUrl: fileID,
        coverGeneratedAt: Date.now(),
      },
    });

    console.log('[recipeCoverGen] 封面已更新:', docId, fileID);
    return { code: 200, message: '封面已生成', coverUrl: fileID };
  } catch (err) {
    console.error('[recipeCoverGen] 执行出错:', err.message, err.stack);
    return {
      code: 500,
      message: err.message || '封面生成失败',
    };
  }
};
