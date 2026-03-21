const express = require('express');
const { body } = require('express-validator');
const orderController = require('../../controllers/order.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Order Routes
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authenticate);

// POST /api/v1/orders (checkout)
router.post(
  '/',
  [
    body('shippingAddress.name')
      .trim()
      .notEmpty()
      .withMessage('Recipient name is required'),
    body('shippingAddress.phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('shippingAddress.address')
      .trim()
      .notEmpty()
      .withMessage('Address is required'),
    body('shippingAddress.city')
      .trim()
      .notEmpty()
      .withMessage('City is required'),
    body('shippingAddress.province')
      .optional()
      .trim(),
    body('shippingAddress.postalCode')
      .optional()
      .trim(),
    body('paymentMethod')
      .notEmpty()
      .withMessage('Payment method is required')
      .isIn(['COD', 'card', 'bank_transfer'])
      .withMessage('Invalid payment method'),
    body('notes')
      .optional()
      .trim(),
  ],
  orderController.createOrder
);

// POST /api/v1/orders/manual (admin/seller only)
router.post(
  '/manual',
  authorize('admin', 'seller'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  ],
  orderController.createManualOrder
);

// GET /api/v1/orders
router.get('/', orderController.getUserOrders);

// GET /api/v1/orders/:id
router.get('/:id', orderController.getOrder);

// PUT /api/v1/orders/:id/status (seller/admin only)
router.put(
  '/:id/status',
  authorize('seller', 'admin'),
  [
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
  ],
  orderController.updateOrderStatus
);

// DELETE /api/v1/orders/:id/cancel
router.delete('/:id/cancel', orderController.cancelOrder);

module.exports = router;
