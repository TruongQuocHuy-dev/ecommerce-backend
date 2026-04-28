const { validationResult } = require('express-validator');
const DiscountService = require('../services/discount.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Discount Controller - HTTP Handlers
 */

class DiscountController {
  /**
   * POST /api/v1/discounts
   * Create new discount (Admin only)
   */
  createDiscount = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const adminId = req.user.userId;
      const result = await DiscountService.createDiscount(adminId, req.body);

      new CREATED({
        message: 'Discount created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/discounts
   * Get all discounts (Admin only)
   */
  getAllDiscounts = async (req, res, next) => {
    try {
      const { isActive, type, page, limit } = req.query;
      const result = await DiscountService.getAllDiscounts(
        { isActive, type },
        { page, limit }
      );

      new OK({
        message: 'Discounts retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/discounts/:id
   * Get discount by ID (Admin only)
   */
  getDiscountById = async (req, res, next) => {
    try {
      const result = await DiscountService.getDiscountById(req.params.id);

      new OK({
        message: 'Discount retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/discounts/:id
   * Update discount (Admin only)
   */
  updateDiscount = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await DiscountService.updateDiscount(req.params.id, req.body);

      new OK({
        message: 'Discount updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/discounts/:id
   * Deactivate discount (Admin only)
   */
  deactivateDiscount = async (req, res, next) => {
    try {
      const result = await DiscountService.deactivateDiscount(req.params.id);

      new OK({
        message: result.message,
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/cart/apply-discount
   * Apply discount code to cart (User)
   */
  applyToCart = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { code } = req.body;
      const result = await DiscountService.applyToCart(userId, code);

      new OK({
        message: 'Discount applied successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/cart/remove-discount
   * Remove discount from cart (User)
   */
  removeFromCart = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { scope } = req.body;
      const result = await DiscountService.removeFromCart(userId, scope);

      new OK({
        message: result.message,
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/discounts/available
   * Get available discounts for user
   */
  getAvailableDiscounts = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const result = await DiscountService.getAvailableDiscounts(userId);

      new OK({
        message: 'Available discounts retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
  /**
   * POST /api/v1/discounts/seller
   * Create shop-scoped discount (Seller only)
   */
  createSellerDiscount = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sellerId = req.user.userId;
      const result = await DiscountService.createSellerDiscount(sellerId, req.body);

      new CREATED({
        message: 'Voucher created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/discounts/seller/mine
   * Get all vouchers of current seller
   */
  getMyDiscounts = async (req, res, next) => {
    try {
      const sellerId = req.user.userId;
      const result = await DiscountService.getSellerDiscounts(sellerId);

      new OK({
        message: 'Vouchers retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/discounts/seller/:id
   * Update seller's own discount
   */
  updateSellerDiscount = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sellerId = req.user.userId;
      const result = await DiscountService.updateSellerDiscount(
        sellerId,
        req.params.id,
        req.body
      );

      new OK({
        message: 'Voucher updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/discounts/seller/:id
   * Deactivate seller's own discount
   */
  deactivateSellerDiscount = async (req, res, next) => {
    try {
      const sellerId = req.user.userId;
      const result = await DiscountService.deactivateSellerDiscount(
        sellerId,
        req.params.id
      );

      new OK({
        message: result.message,
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new DiscountController();
