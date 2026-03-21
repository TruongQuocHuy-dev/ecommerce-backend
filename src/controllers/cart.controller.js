const { validationResult } = require('express-validator');
const CartService = require('../services/cart.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Cart Controller - HTTP Handlers
 */

class CartController {
  /**
   * POST /api/v1/cart/add
   * Add item to cart (supports SKU for product variations)
   */
  addToCart = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, skuId, quantity } = req.body;
      const userId = req.user.userId;

      const result = await CartService.addToCart(userId, productId, skuId, quantity);

      new OK({
        message: 'Item added to cart successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/cart/update/:itemId
   * Update cart item quantity
   */
  updateCartItem = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { itemId } = req.params;
      const { quantity } = req.body;
      const userId = req.user.userId;

      const result = await CartService.updateCartItem(userId, itemId, quantity);

      new OK({
        message: 'Cart updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/cart/remove/:itemId
   * Remove item from cart
   */
  removeFromCart = async (req, res, next) => {
    try {
      const { itemId } = req.params;
      const userId = req.user.userId;

      const result = await CartService.removeFromCart(userId, itemId);

      new OK({
        message: 'Item removed from cart',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/cart
   * Get user cart
   */
  getCart = async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const result = await CartService.getUserCart(userId);

      new OK({
        message: 'Cart retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/cart/clear
   * Clear cart
   */
  clearCart = async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const result = await CartService.clearCart(userId);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new CartController();
