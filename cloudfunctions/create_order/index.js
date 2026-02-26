/**
 * 云函数：创建订单 create_order
 * 由前端在支付前调用，在服务端生成 outTradeNo 并写入 orders 集合
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const PRODUCTS = {
  vip_monthly: { totalFee: 1990, description: 'TableSync VIP 月卡' }
};

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const buf = require('crypto').randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 401, message: '未登录' };

    const productId = (event && event.productId) || 'vip_monthly';
    const product = PRODUCTS[productId] || PRODUCTS.vip_monthly;
    const outTradeNo = 'ts_' + Date.now() + '_' + randomString(8);

    await db.collection('orders').add({
      data: {
        _openid: OPENID,
        outTradeNo: outTradeNo,
        productId: productId,
        description: product.description,
        totalFee: product.totalFee,
        status: 'PENDING',
        transactionId: '',
        entitlementStatus: false,
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      data: { outTradeNo, amount: product.totalFee, description: product.description },
      message: 'ok'
    };
  } catch (err) {
    console.error('[create_order]', err.message || err);
    return { code: 500, message: err.message || '创建订单失败' };
  }
};
