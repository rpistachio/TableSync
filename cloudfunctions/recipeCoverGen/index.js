// cloudfunctions/recipeCoverGen/index.js
// 为导入菜谱静默生成「暗调高级感」封面图（复用 generate.js 的 Midjourney 风格 prompt）
// 优先 MiniMax image-01，未配置时使用 OpenAI DALL·E 2

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
  const res = await cloud.uploadFile({
    cloudPath,
    fileContent: buffer,
  });
  return res.fileID;
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

    const rawHost = (getConfig('MINIMAX_HOST') || '').trim();
    const minimaxHost = (rawHost === 'api.minimax.io' || rawHost === 'api.minimaxi.com') ? rawHost : undefined;
    console.log('[recipeCoverGen] 生成封面:', recipe.name, 'provider:', useMiniMax ? 'MiniMax' : 'OpenAI', useMiniMax && minimaxHost ? ', host: ' + minimaxHost : '');
    console.log('[recipeCoverGen] 正在请求图生接口，约需 20–60 秒…');
    const buffer = useMiniMax
      ? await minimaxImage.generateImage(apiKey, prompt, minimaxHost ? { host: minimaxHost } : {})
      : await openaiImage.generateImage(apiKey, prompt);
    console.log('[recipeCoverGen] 图片已获取, size:', buffer ? buffer.length : 0);
    if (!buffer || buffer.length === 0) {
      return { code: 500, message: '图片生成失败' };
    }

    const ext = useMiniMax ? 'jpg' : 'png';
    const cloudPath = `recipe_covers/${docId}_${Date.now()}.${ext}`;
    console.log('[recipeCoverGen] 开始上传云存储:', cloudPath);
    const fileID = await uploadBufferToCloud(buffer, cloudPath);
    console.log('[recipeCoverGen] 上传完成 fileID:', fileID ? fileID.slice(0, 50) + '...' : '');
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
