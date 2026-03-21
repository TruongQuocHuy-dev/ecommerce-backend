const MomoService = require('../services/momo.service');
const VnpayService = require('../services/vnpay.service');
const Order = require('../models/order.model');
const { OK } = require('../utils/success.response');
const { NotFoundError, BadRequestError } = require('../utils/error.response');
const crypto = require('crypto');

/**
 * Payment Controller - Payment Gateway Handlers
 */

class PaymentController {
  /**
   * POST /api/v1/payments/momo/create
   * Create MoMo payment URL for order
   */
  createMomoPayment = async (req, res, next) => {
    try {
      const { orderId } = req.body;
      const userId = req.user.userId;

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Verify ownership
      if (order.user.toString() !== userId) {
        throw new BadRequestError('You are not authorized to pay for this order');
      }

      // Check order status
      if (order.status !== 'pending') {
        throw new BadRequestError('Order is not pending payment');
      }

      if (order.paymentInfo.status === 'paid') {
        throw new BadRequestError('Order is already paid');
      }

      // Create unique request ID
      const requestId = `${order.orderNumber}-${Date.now()}`;

      // Create MoMo payment URL
      const result = await MomoService.createPaymentUrl({
        amount: Math.round(order.totalAmount),
        orderId: order.orderNumber,
        orderInfo: `Thanh toan don hang ${order.orderNumber}`,
        requestId,
      });

      // Update order with payment request info
      order.paymentInfo.method = 'momo';
      order.paymentInfo.requestId = requestId;
      await order.save();

      new OK({
        message: 'MoMo payment URL created',
        data: {
          payUrl: result.payUrl,
          deeplink: result.deeplink,
          qrCodeUrl: result.qrCodeUrl,
          orderId: order.orderNumber,
        },
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/payments/momo/ipn
   * MoMo IPN Webhook (Instant Payment Notification)
   */
  momoIPN = async (req, res, next) => {
    try {
      const body = req.body;
      console.log('[MoMo IPN] Received:', JSON.stringify(body, null, 2));

      // Verify signature
      if (!MomoService.verifySignature(body)) {
        console.error('[MoMo IPN] Invalid signature');
        return res.status(400).json({ message: 'Invalid signature' });
      }

      // Find order by orderId (orderNumber)
      const order = await Order.findOne({ orderNumber: body.orderId });
      if (!order) {
        console.error('[MoMo IPN] Order not found:', body.orderId);
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check if payment was successful
      if (MomoService.isPaymentSuccess(body)) {
        order.paymentInfo.status = 'paid';
        order.paymentInfo.paidAt = new Date();
        order.paymentInfo.transactionId = body.transId;
        
        // Update order status to processing
        if (order.status === 'pending') {
          order.status = 'processing';
        }

        await order.save();
        console.log('[MoMo IPN] Payment successful for order:', body.orderId);
      } else {
        order.paymentInfo.status = 'failed';
        await order.save();
        console.log('[MoMo IPN] Payment failed for order:', body.orderId);
      }

      // MoMo expects HTTP 204 No Content on success
      res.status(204).send();
    } catch (error) {
      console.error('[MoMo IPN] Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  /**
   * POST /api/v1/payments/vnpay/create
   * Create VNPay payment URL for order
   */
  createVnpayPayment = async (req, res, next) => {
    try {
      const { orderId, bankCode } = req.body;
      const userId = req.user.userId;

      // Get client IP
      const ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Verify ownership
      if (order.user.toString() !== userId) {
        throw new BadRequestError('You are not authorized to pay for this order');
      }

      // Check order status
      if (order.status !== 'pending') {
        throw new BadRequestError('Order is not pending payment');
      }

      if (order.paymentInfo.status === 'paid') {
        throw new BadRequestError('Order is already paid');
      }

      // Create VNPay payment URL
      const paymentUrl = VnpayService.createPaymentUrl({
        amount: Math.round(order.totalAmount),
        orderId: order.orderNumber,
        orderInfo: `Thanh toan don hang ${order.orderNumber}`,
        ipAddr: ipAddr.split(',')[0].trim(),
        bankCode,
      });

      // Update order with payment method
      order.paymentInfo.method = 'vnpay';
      await order.save();

      new OK({
        message: 'VNPay payment URL created',
        data: {
          paymentUrl,
          orderId: order.orderNumber,
        },
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/payments/vnpay/return
   * VNPay Return URL handler (frontend redirect)
   */
  vnpayReturn = async (req, res, next) => {
    try {
      const vnp_Params = req.query;
      console.log('[VNPay Return] Received:', JSON.stringify(vnp_Params, null, 2));

      // Verify signature
      if (!VnpayService.verifySignature(vnp_Params)) {
        console.error('[VNPay Return] Invalid signature');
        return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?message=Invalid signature`);
      }

      const transactionInfo = VnpayService.getTransactionInfo(vnp_Params);

      // Find order
      const order = await Order.findOne({ orderNumber: transactionInfo.orderId });
      if (!order) {
        return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?message=Order not found`);
      }

      if (VnpayService.isPaymentSuccess(vnp_Params)) {
        // Redirect to success page
        return res.redirect(
          `${process.env.FRONTEND_URL}/payment/success?orderId=${order._id}&transId=${transactionInfo.transId}`
        );
      } else {
        // Redirect to failed page
        const message = VnpayService.getResponseMessage(vnp_Params.vnp_ResponseCode);
        return res.redirect(
          `${process.env.FRONTEND_URL}/payment/failed?orderId=${order._id}&message=${encodeURIComponent(message)}`
        );
      }
    } catch (error) {
      console.error('[VNPay Return] Error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?message=Error processing payment`);
    }
  };

  /**
   * POST /api/v1/payments/vnpay/ipn
   * VNPay IPN Webhook
   */
  vnpayIPN = async (req, res, next) => {
    try {
      const vnp_Params = req.query;
      console.log('[VNPay IPN] Received:', JSON.stringify(vnp_Params, null, 2));

      // Verify signature
      if (!VnpayService.verifySignature(vnp_Params)) {
        console.error('[VNPay IPN] Invalid signature');
        return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
      }

      const transactionInfo = VnpayService.getTransactionInfo(vnp_Params);

      // Find order
      const order = await Order.findOne({ orderNumber: transactionInfo.orderId });
      if (!order) {
        console.error('[VNPay IPN] Order not found:', transactionInfo.orderId);
        return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
      }

      // Check amount
      if (Math.round(order.totalAmount) !== transactionInfo.amount) {
        console.error('[VNPay IPN] Amount mismatch');
        return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
      }

      // Check if already processed
      if (order.paymentInfo.status === 'paid') {
        return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
      }

      // Update payment status
      if (VnpayService.isPaymentSuccess(vnp_Params)) {
        order.paymentInfo.status = 'paid';
        order.paymentInfo.paidAt = new Date();
        order.paymentInfo.transactionId = transactionInfo.transId;
        order.paymentInfo.bankCode = transactionInfo.bankCode;
        
        // Update order status to processing
        if (order.status === 'pending') {
          order.status = 'processing';
        }

        await order.save();
        console.log('[VNPay IPN] Payment successful for order:', transactionInfo.orderId);
        return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
      } else {
        order.paymentInfo.status = 'failed';
        await order.save();
        console.log('[VNPay IPN] Payment failed for order:', transactionInfo.orderId);
        return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
      }
    } catch (error) {
      console.error('[VNPay IPN] Error:', error);
      return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
  };

  /**
   * GET /api/v1/payments/:orderId/status
   * Check payment status for order
   */
  checkPaymentStatus = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.userId;

      const order = await Order.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Verify ownership (unless admin)
      if (order.user.toString() !== userId && req.user.role !== 'admin') {
        throw new BadRequestError('Not authorized');
      }

      new OK({
        message: 'Payment status retrieved',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentInfo: order.paymentInfo,
          orderStatus: order.status,
          totalAmount: order.totalAmount,
        },
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new PaymentController();
