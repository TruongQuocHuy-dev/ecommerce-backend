const express = require('express');
const { body } = require('express-validator');
const cartController = require('../../controllers/cart.controller');
const { authenticate } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Cart Routes
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authenticate);

// POST /api/v1/cart/add
router.post(
  '/add',
  [
    body('productId')
      .notEmpty()
      .withMessage('Product ID is required')
      .isMongoId()
      .withMessage('Invalid product ID'),
    body('skuId')
      .optional()
      .isMongoId()
      .withMessage('Invalid SKU ID'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1'),
  ],
  cartController.addToCart
);

// PUT /api/v1/cart/update/:itemId
router.put(
  '/update/:itemId',
  [
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1'),
  ],
  cartController.updateCartItem
);

// DELETE /api/v1/cart/remove/:itemId
router.delete('/remove/:itemId', cartController.removeFromCart);

// GET /api/v1/cart
router.get('/', cartController.getCart);

// DELETE /api/v1/cart/clear
router.delete('/clear', cartController.clearCart);

module.exports = router;
