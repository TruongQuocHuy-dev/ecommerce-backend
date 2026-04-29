const { validationResult } = require('express-validator');
const OrderService = require('../services/order.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Order Controller - HTTP Handlers
 */

class OrderController {
  /**
   * POST /api/v1/orders
   * Create order (checkout)
   */
  createOrder = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { shippingAddress, paymentMethod, notes } = req.body;

      const result = await OrderService.createOrder(userId, {
        shippingAddress,
        paymentMethod,
        notes,
      });

      new CREATED({
        message: 'Order created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/orders/manual
   * Create order manually (admin/seller)
   */
  createManualOrder = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const adminId = req.user.userId;
      // Body: userId, items: [{productId, skuId, quantity}], shippingAddress, paymentMethod...

      const result = await OrderService.createManualOrder(adminId, req.body);

      new CREATED({
        message: 'Manual order created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/orders
   * Get user orders
   */
  getUserOrders = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const userRole = req.user.role;
      const filters = { 
        status: req.query.status, 
        userId: req.query.userId,
        asSeller: req.query.asSeller === 'true'
      };
      const options = { page: req.query.page, limit: req.query.limit };

      const result = await OrderService.getUserOrders(userId, userRole, filters, options);

      new OK({
        message: 'Orders retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/orders/:id
   * Get order details
   */
  getOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const result = await OrderService.getOrderById(id, userId, userRole);

      new OK({
        message: 'Order retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/orders/:id/status
   * Update order status (seller/admin)
   */
  updateOrderStatus = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const result = await OrderService.updateOrderStatus(
        id,
        status,
        userId,
        userRole
      );

      new OK({
        message: 'Order status updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/orders/:id/cancel
   * Cancel order
   */
  cancelOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const result = await OrderService.cancelOrder(id, userId, userRole);

      new OK({
        message: result.message,
        data: result.order,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new OrderController();
