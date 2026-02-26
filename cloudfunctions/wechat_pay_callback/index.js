/**
 * 云函数：微信支付结果回调 wechat_pay_callback（云调用底层自动触发）
 * event 已由云底层解析并防伪验证，无需手动验签/解密
 * 职责：幂等核账 → 更新订单 PAID → 发放权益 → 标记 entitlementStatus
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function ev(event, camelKey) {
  if (event[camelKey] != null) return event[camelKey];
  const snake = camelKey.replace(/([A-Z])/g, function (m) { return '_' + m.toLowerCase(); }).replace(/^_/, '');
  return event[snake];
}

exports.main = async (event, context) => {
  const logger = console;
  try {
    const returnCode = ev(event, 'returnCode') || ev(event, 'return_code');
    const resultCode = ev(event, 'resultCode') || ev(event, 'result_code');
    if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
      logger.warn('[callback] 非成功状态', returnCode, resultCode);
      return { errcode: 0, errmsg: 'SUCCESS' };
    }

    const outTradeNo = ev(event, 'outTradeNo') || ev(event, 'out_trade_no');
    const totalFee = ev(event, 'totalFee') != null ? ev(event, 'totalFee') : ev(event, 'total_fee');
    const transactionId = ev(event, 'transactionId') || ev(event, 'transaction_id') || '';
    if (!outTradeNo) {
      logger.error('[callback] 无 outTradeNo');
      return { errcode: 1, errmsg: '缺少订单号' };
    }

    let orderRes;
    try {
      orderRes = await db.collection('orders').where({ outTradeNo: outTradeNo }).get();
    } catch (e) {
      logger.error('[callback] 查询订单失败', e.message);
      return { errcode: 1, errmsg: 'DB_ERROR' };
    }

    if (!orderRes.data || orderRes.data.length === 0) {
      logger.warn('[callback] 订单不存在', outTradeNo);
      return { errcode: 0, errmsg: 'SUCCESS' };
    }
    const order = orderRes.data[0];
    const openid = order._openid;

    if (order.status === 'PAID') {
      logger.log('[callback] 幂等：订单已支付', outTradeNo);
      return { errcode: 0, errmsg: 'SUCCESS' };
    }

    const orderTotal = Number(order.totalFee);
    const notifyTotal = Number(totalFee);
    if (isNaN(orderTotal) || isNaN(notifyTotal) || orderTotal !== notifyTotal) {
      logger.error('[callback] 金额不一致', orderTotal, notifyTotal);
      return { errcode: 1, errmsg: '金额不一致' };
    }

    try {
      await db.collection('orders').where({ outTradeNo: outTradeNo }).update({
        data: {
          status: 'PAID',
          transactionId: transactionId,
          paidAt: new Date()
        }
      });
    } catch (e) {
      logger.error('[callback] 更新订单失败', e.message);
      return { errcode: 1, errmsg: 'UPDATE_ORDER_FAIL' };
    }

    const now = new Date();
    const vipMonths = (order.productId === 'vip_monthly') ? 1 : 1;
    const expireAt = new Date(now.getTime() + vipMonths * 30 * 24 * 60 * 60 * 1000);
    const usersCol = db.collection('users');
    let entitlementOk = false;
    try {
      const userRes = await usersCol.where({ _openid: openid }).get();
      if (userRes.data && userRes.data.length > 0) {
        await usersCol.doc(userRes.data[0]._id).update({
          data: { isVip: true, vipExpireAt: expireAt, _updateTime: now }
        });
      } else {
        await usersCol.add({
          data: { _openid: openid, isVip: true, vipExpireAt: expireAt, _createTime: now, _updateTime: now }
        });
      }
      entitlementOk = true;
    } catch (e) {
      logger.error('[callback] 权益发放失败', e.message);
    }

    if (entitlementOk) {
      try {
        await db.collection('orders').where({ outTradeNo: outTradeNo }).update({
          data: { entitlementStatus: true }
        });
      } catch (e) {
        logger.error('[callback] 更新 entitlementStatus 失败', e.message);
      }
    }

    logger.log('[callback] 完成', outTradeNo, 'entitlement:', entitlementOk);
    return { errcode: 0, errmsg: 'SUCCESS' };
  } catch (err) {
    logger.error('[callback]', err.message || err);
    return { errcode: 1, errmsg: err.message || '处理异常' };
  }
};
