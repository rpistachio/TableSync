import fs from 'fs';
import path from 'path';
import cloudbase from '@cloudbase/node-sdk';
import { CONFIG } from '../config.js';

let cachedApp = null;

function getApp() {
  if (cachedApp) return cachedApp;
  if (!CONFIG.tcbEnvId || !CONFIG.tcbSecretId || !CONFIG.tcbSecretKey) {
    throw new Error('TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY 未配置，请在 tools/.env 中设置');
  }
  cachedApp = cloudbase.init({
    env: CONFIG.tcbEnvId,
    secretId: CONFIG.tcbSecretId,
    secretKey: CONFIG.tcbSecretKey
  });
  return cachedApp;
}

/**
 * 上传图片到云存储 adults_recipes/ 目录
 * @param {string} localPath 本地图片路径
 * @param {string} fileName  文件名，例如 ginseng_astragalus_black_chicken_soup.png
 * @returns {Promise<string>} fileID (cloud://...)
 */
export async function uploadAdultRecipeImage(localPath, fileName) {
  const app = getApp();
  const cloudPath = path.posix.join('adults_recipes', fileName);
  const stream = fs.createReadStream(localPath);
  const res = await app.uploadFile({
    cloudPath,
    fileContent: stream
  });
  return res.fileID;
}

