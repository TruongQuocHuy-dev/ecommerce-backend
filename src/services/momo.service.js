const crypto = require('crypto');

/**
 * MoMo Payment Service
 * API v2 - Pay With ATM/QR
 */

class MomoService {
  /**
   * Create MoMo payment URL
   * @param {Object} data - { amount, orderId, orderInfo, requestId }
   * @returns {Promise<Object>} - { payUrl, deeplink, qrCodeUrl }
   */
  static createPaymentUrl = async ({ amount, orderId, orderInfo, requestId }) => {
    // Get config from env
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const apiEndpoint = process.env.MOMO_API_ENDPOINT;
    const notifyUrl = process.env.MOMO_NOTIFY_URL; // Webhook IPN
    const redirectUrl = process.env.MOMO_REDIRECT_URL; // Frontend redirect

    if (!partnerCode || !accessKey || !secretKey || !apiEndpoint) {
      throw new Error('MoMo configuration missing. Check .env file.');
    }

    // Request type: payWithATM, payWithCC, captureWallet
    const requestType = 'payWithATM';
    const lang = 'vi';
    const extraData = ''; // Base64 encoded JSON for additional data

    // Create raw signature (order required by MoMo docs)
    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${notifyUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    // Create HMAC SHA256 signature
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    // Prepare request body
    const requestBody = {
      partnerCode,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl: notifyUrl,
      requestType,
      extraData,
      lang,
      signature,
    };

    console.log('[MoMo] Creating payment URL for order:', orderId);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.resultCode !== 0) {
        console.error('[MoMo] Error:', data.message, 'Code:', data.resultCode);
        throw new Error(`MoMo Error: ${data.message} (Code: ${data.resultCode})`);
      }

      console.log('[MoMo] Payment URL created successfully');

      return {
        payUrl: data.payUrl,
        deeplink: data.deeplink,
        qrCodeUrl: data.qrCodeUrl,
        requestId: data.requestId,
        orderId: data.orderId,
      };
    } catch (err) {
      console.error('[MoMo] Failed to create payment URL:', err.message);
      throw new Error('Failed to create MoMo payment URL');
    }
  };

  /**
   * Verify MoMo IPN signature
   * @param {Object} body - IPN request body from MoMo
   * @returns {Boolean} - true if signature is valid
   */
  static verifySignature = (body) => {
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const momoSignature = body.signature;

    // Create raw signature from IPN data (order required by MoMo docs)
    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${body.amount}` +
      `&extraData=${body.extraData || ''}` +
      `&message=${body.message || ''}` +
      `&orderId=${body.orderId}` +
      `&orderInfo=${body.orderInfo}` +
      `&orderType=${body.orderType}` +
      `&partnerCode=${body.partnerCode}` +
      `&payType=${body.payType}` +
      `&requestId=${body.requestId}` +
      `&responseTime=${body.responseTime}` +
      `&resultCode=${body.resultCode}` +
      `&transId=${body.transId}`;

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const isValid = momoSignature === calculatedHash;
    
    if (!isValid) {
      console.error('[MoMo] Signature verification failed');
      console.log('[MoMo] Expected:', calculatedHash);
      console.log('[MoMo] Received:', momoSignature);
    }

    return isValid;
  };

  /**
   * Check if payment was successful
   * @param {Object} body - IPN or redirect data
   * @returns {Boolean}
   */
  static isPaymentSuccess = (body) => {
    return body.resultCode === 0 || body.resultCode === '0';
  };

  /**
   * Get transaction info from IPN body
   * @param {Object} body - IPN request body
   * @returns {Object}
   */
  static getTransactionInfo = (body) => {
    return {
      orderId: body.orderId,
      requestId: body.requestId,
      transId: body.transId,
      amount: body.amount,
      resultCode: body.resultCode,
      message: body.message,
      payType: body.payType,
      responseTime: body.responseTime,
    };
  };
}

module.exports = MomoService;
