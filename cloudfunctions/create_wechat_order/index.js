/**
 * 云函数：统一下单 create_wechat_order（云调用 CloudPay）
 * 接收前端 outTradeNo、amount、description，校验订单后调用 cloud.cloudPay.unifiedOrder，返回 payment
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SUB_MCH_ID = '1106708135';

exports.main = async (event, context) => {
  const logger = console;
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      logger.warn('[create_wechat_order] 无 OPENID');
      return { code: 401, message: '未登录' };
    }

    const outTradeNo = event && event.outTradeNo;
    const amount = event && event.amount;
    const description = event && event.description;

    if (!outTradeNo || typeof outTradeNo !== 'string') {
      return { code: 400, message: '缺少参数 outTradeNo' };
    }
    const totalFee = Number(amount);
    if (isNaN(totalFee) || totalFee < 1) {
      return { code: 400, message: 'amount 必填且大于 0（单位：分）' };
    }
    const bodyDesc = (description && String(description).trim()) || 'TableSync 增值服务';

    let orderRes;
    try {
      orderRes = await db.collection('orders').where({
        outTradeNo: outTradeNo,
        _openid: OPENID,
        status: 'PENDING'
      }).get();
    } catch (e) {
      logger.error('[create_wechat_order] 查询订单失败', e.message);
      return { code: 500, message: '订单校验失败' };
    }

    if (!orderRes.data || orderRes.data.length === 0) {
      logger.warn('[create_wechat_order] 订单不存在或非待支付', outTradeNo);
      return { code: 400, message: '订单不存在或状态异常' };
    }
    const order = orderRes.data[0];
    if (Number(order.totalFee) !== totalFee) {
      return { code: 400, message: '订单金额与传入不一致' };
    }

    const envId = cloud.DYNAMIC_CURRENT_ENV || (context && context.environment) || '';
    if (!envId) {
      logger.error('[create_wechat_order] 无法获取 envId');
      return { code: 500, message: '环境配置异常' };
    }

    let res;
    try {
      res = await cloud.cloudPay.unifiedOrder({
        body: bodyDesc,
        outTradeNo: outTradeNo,
        spbillCreateIp: '127.0.0.1',
        subMchId: SUB_MCH_ID,
        totalFee: totalFee,
        envId: envId,
        functionName: 'wechat_pay_callback'
      });
    } catch (e) {
      logger.error('[create_wechat_order] CloudPay.unifiedOrder 失败', e.message || e);
      return { code: 500, message: e.message || '统一下单失败' };
    }

    const payment = (res && res.payment) || res;
    if (!payment) {
      logger.error('[create_wechat_order] 未返回 payment', res);
      return { code: 500, message: '统一下单返回异常' };
    }

    return { code: 0, data: payment, message: 'ok' };
  } catch (err) {
    logger.error('[create_wechat_order]', err.message || err);
    return { code: 500, message: err.message || '统一下单异常' };
  }
};
