const express = require('express');
const { body, param } = require('express-validator');
const paymentController = require('../../controllers/payment.controller');
const { authenticate } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Payment Routes
 * MoMo & VNPay Integration
 */

// ===== MOMO ROUTES =====

// POST /api/v1/payments/momo/create - Create MoMo payment (requires auth)
router.post(
  '/momo/create',
  authenticate,
  [
    body('orderId')
      .notEmpty()
      .withMessage('Order ID is required')
      .isMongoId()
      .withMessage('Invalid order ID'),
  ],
  paymentController.createMomoPayment
);

// POST /api/v1/payments/momo/ipn - MoMo IPN webhook (no auth - called by MoMo)
router.post('/momo/ipn', paymentController.momoIPN);

// ===== VNPAY ROUTES =====

// POST /api/v1/payments/vnpay/create - Create VNPay payment (requires auth)
router.post(
  '/vnpay/create',
  authenticate,
  [
    body('orderId')
      .notEmpty()
      .withMessage('Order ID is required')
      .isMongoId()
      .withMessage('Invalid order ID'),
    body('bankCode').optional().isString(),
  ],
  paymentController.createVnpayPayment
);

// GET /api/v1/payments/vnpay/return - VNPay return URL (no auth - redirect from VNPay)
router.get('/vnpay/return', paymentController.vnpayReturn);

// GET /api/v1/payments/vnpay/ipn - VNPay IPN webhook (no auth - called by VNPay)
router.get('/vnpay/ipn', paymentController.vnpayIPN);

// ===== COMMON ROUTES =====

// GET /api/v1/payments/:orderId/status - Check payment status
router.get(
  '/:orderId/status',
  authenticate,
  [param('orderId').isMongoId().withMessage('Invalid order ID')],
  paymentController.checkPaymentStatus
);

module.exports = router;
