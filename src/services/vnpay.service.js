const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment-timezone');

/**
 * VNPay Payment Service
 * Sandbox & Production ready
 */

/**
 * Sort object keys alphabetically and URL encode values
 * Required by VNPay signature algorithm
 */
function sortObject(obj) {
  const sorted = {};
  const keys = [];
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(encodeURIComponent(key));
    }
  }
  
  keys.sort();
  
  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
  }
  
  return sorted;
}

class VnpayService {
  /**
   * Create VNPay payment URL
   * @param {Object} data - { amount, orderId, orderInfo, ipAddr, bankCode? }
   * @returns {String} - Payment URL to redirect user
   */
  static createPaymentUrl = ({ amount, orderId, orderInfo, ipAddr, bankCode }) => {
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
      throw new Error('VNPay configuration missing. Check .env file.');
    }

    // Create date in Vietnam timezone
    const createDate = moment().tz('Asia/Ho_Chi_Minh').format('YYYYMMDDHHmmss');
    const expireDate = moment().tz('Asia/Ho_Chi_Minh').add(15, 'minutes').format('YYYYMMDDHHmmss');

    // Build params
    let vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay uses smallest currency unit
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr || '127.0.0.1',
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    // Add bank code if specified
    if (bankCode) {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    // Sort params alphabetically and encode
    const sortedParams = sortObject(vnp_Params);

    // Create signature string (no encoding as sortObject already encoded)
    const signData = qs.stringify(sortedParams, {
      arrayFormat: 'brackets',
      encode: false,
    });

    // Create HMAC SHA512 signature
    const hmac = crypto.createHmac('sha512', secretKey);
    const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Add signature to params
    sortedParams['vnp_SecureHash'] = vnp_SecureHash;

    // Build final URL
    const paymentUrl = vnpUrl + '?' + qs.stringify(sortedParams, {
      arrayFormat: 'brackets',
      encode: false,
    });

    console.log('[VNPay] Payment URL created for order:', orderId);

    return paymentUrl;
  };

  /**
   * Verify VNPay return/IPN signature
   * @param {Object} vnp_Params - Query params from VNPay
   * @returns {Boolean} - true if signature is valid
   */
  static verifySignature = (vnp_Params) => {
    const secretKey = process.env.VNP_HASH_SECRET;
    
    // Clone params to avoid modifying original
    const params = { ...vnp_Params };
    
    const vnp_SecureHash = params['vnp_SecureHash'];

    // Remove hash fields for signature calculation
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    // Sort and encode params
    const sortedParams = sortObject(params);

    // Create signature string
    const signData = qs.stringify(sortedParams, {
      arrayFormat: 'brackets',
      encode: false,
    });

    // Calculate expected hash
    const hmac = crypto.createHmac('sha512', secretKey);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = vnp_SecureHash === calculatedHash;

    if (!isValid) {
      console.error('[VNPay] Signature verification failed');
      console.log('[VNPay] Expected:', calculatedHash);
      console.log('[VNPay] Received:', vnp_SecureHash);
    }

    return isValid;
  };

  /**
   * Check if payment was successful
   * @param {Object} params - Return/IPN params
   * @returns {Boolean}
   */
  static isPaymentSuccess = (params) => {
    return params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
  };

  /**
   * Get transaction info from VNPay params
   * @param {Object} params - Return/IPN params
   * @returns {Object}
   */
  static getTransactionInfo = (params) => {
    return {
      orderId: params.vnp_TxnRef,
      amount: parseInt(params.vnp_Amount) / 100, // Convert back to VND
      transId: params.vnp_TransactionNo,
      bankCode: params.vnp_BankCode,
      cardType: params.vnp_CardType,
      payDate: params.vnp_PayDate,
      responseCode: params.vnp_ResponseCode,
      transactionStatus: params.vnp_TransactionStatus,
    };
  };

  /**
   * Get response message from response code
   * @param {String} code - VNPay response code
   * @returns {String}
   */
  static getResponseMessage = (code) => {
    const messages = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
      '10': 'Giao dịch không thành công do: Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản bị khóa',
      '13': 'Giao dịch không thành công do: Nhập sai mật khẩu xác thực OTP',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản không đủ số dư',
      '65': 'Giao dịch không thành công do: Tài khoản đã vượt quá hạn mức giao dịch trong ngày',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '79': 'Giao dịch không thành công do: Nhập sai mật khẩu thanh toán quá số lần quy định',
      '99': 'Lỗi không xác định',
    };
    return messages[code] || 'Lỗi không xác định';
  };
}

module.exports = VnpayService;
