const mongoose = require('mongoose');
const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Address = require('../models/address.model');
const Shop = require('../models/shop.model');
const { generateOrderNumber } = require('../utils/orderNumber');
const { getVariationText } = require('../utils/skuGenerator');
const RedisLock = require('../utils/redisLock');
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require('../utils/error.response');


/**
 * Order Service - Order Management Business Logic
 * Updated for SKU support (Phase 2.5 and Phase 3.6 - Redis Locking)
 */

class OrderService {
  /**
   * Create order from cart (Checkout) - SKU-aware with distributed locking
   */
  static createOrder = async (userId, orderData) => {
    const { shippingAddress, addressId, paymentMethod, notes } = orderData;

    let finalShippingAddress;

    // If addressId is provided, use saved address
    if (addressId) {
      const savedAddress = await Address.findById(addressId);
      if (!savedAddress) {
        throw new NotFoundError('Saved address not found');
      }
      if (savedAddress.user.toString() !== userId) {
        throw new ForbiddenError('You are not authorized to use this address');
      }

      finalShippingAddress = {
        name: savedAddress.name,
        phone: savedAddress.phone,
        address: savedAddress.address,
        city: savedAddress.city,
        province: savedAddress.province,
        postalCode: savedAddress.postalCode,
      };
    } else if (shippingAddress) {
      finalShippingAddress = shippingAddress;
    } else {
      throw new BadRequestError('Please provide shipping address or select a saved address');
    }

    // Get user cart with product details
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    // Validate all products/SKUs still active and in stock
    const orderItems = [];
    let seller = null;
    const lockResourceIds = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product.isActive) {
        throw new BadRequestError(`Product ${product.name} is no longer available`);
      }

      // SKU-aware stock checking
      let availableStock = product.stock;
      let currentPrice = product.price;
      let variationText = '';

      if (item.skuId && product.skus && product.skus.length > 0) {
        const sku = product.skus.id(item.skuId);
        if (!sku) {
          throw new BadRequestError(`Product variation no longer exists for ${product.name}`);
        }
        if (!sku.isActive) {
          throw new BadRequestError(`Product variation ${item.variationText} is no longer available`);
        }
        availableStock = sku.stock;
        currentPrice = sku.price;
        variationText = item.variationText || getVariationText(product.tierVariations, sku.tierIndex);
        // Lock by SKU ID
        lockResourceIds.push(item.skuId.toString());
      } else {
        // Lock by product ID
        lockResourceIds.push(product._id.toString());
      }

      if (availableStock < item.quantity) {
        const varText = variationText ? ` (${variationText})` : '';
        throw new BadRequestError(
          `Insufficient stock for ${product.name}${varText}. Only ${availableStock} available.`
        );
      }

      // Set seller from first product
      if (!seller) {
        seller = product.seller;
      }

      // Order item with SKU info
      orderItems.push({
        product: product._id,
        skuId: item.skuId || undefined,
        skuCode: item.skuCode || undefined,
        tierIndex: item.tierIndex || [],
        variationText: variationText || undefined,
        name: product.name,
        price: item.price, // Use snapshot price from cart
        quantity: item.quantity,
        image: product.images[0] || '',
      });
    }

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Acquire distributed locks for all inventory items
    let locks = null;
    let redisAvailable = true;

    try {
      const { getRedis } = require('../configs/config.redis');
      const redis = getRedis();
      await redis.ping();
    } catch (err) {
      redisAvailable = false;
      console.warn('Redis lock unavailable, proceeding with atomic checks only');
    }

    if (redisAvailable) {
      try {
        locks = await RedisLock.acquireMultiple(lockResourceIds, 15000);
        if (!locks) {
          throw new BadRequestError('High demand. Please try again in a few seconds.');
        }
      } catch (error) {
        if (error.message.includes('High demand')) {
          throw error;
        }
        console.warn('Redis lock error, proceeding with atomic checks only', error.message);
      }
    }

    // Use transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Reduce stock for all products/SKUs (atomic operation)
      for (const item of cart.items) {
        if (item.skuId) {
          // SKU-level stock reduction
          const result = await Product.findOneAndUpdate(
            {
              _id: item.product._id,
              skus: {
                $elemMatch: {
                  _id: item.skuId,
                  stock: { $gte: item.quantity }
                }
              }
            },
            {
              $inc: {
                'skus.$.stock': -item.quantity,
                'skus.$.sold': item.quantity,
                totalStock: -item.quantity,
                totalSold: item.quantity,
                stock: -item.quantity // also deduct root stock for backward compatibility
              }
            },
            { session, new: true }
          );

          if (!result) {
            throw new BadRequestError(
              `Stock changed. Please refresh cart for ${item.product.name}`
            );
          }
        } else {
          // Product-level stock reduction (backward compatibility)
          const result = await Product.findOneAndUpdate(
            {
              _id: item.product._id,
              stock: { $gte: item.quantity }
            },
            {
              $inc: { stock: -item.quantity, totalSold: item.quantity }
            },
            { session, new: true }
          );

          if (!result) {
            throw new BadRequestError(
              `Stock changed. Please refresh cart for ${item.product.name}`
            );
          }
        }
      }

      // Prepare discount info from all voucher slots
      let subtotal = cart.totalAmount;

      // Collect all applied discounts
      const appliedDiscounts = [];
      let totalDiscountAmount = 0;

      if (cart.shopDiscount?.code) {
        appliedDiscounts.push(cart.shopDiscount);
        totalDiscountAmount += cart.shopDiscount.amount || 0;
      }
      if (cart.systemDiscount?.code) {
        appliedDiscounts.push(cart.systemDiscount);
        totalDiscountAmount += cart.systemDiscount.amount || 0;
      }
      // freeshippingDiscount reduces shipping (amount is 0 for subtotal), but we still record it

      let finalTotal = cart.discountedTotal > 0 ? cart.discountedTotal : Math.max(0, subtotal - totalDiscountAmount);

      // Build order discount summary (primary discount for order.discount field)
      let orderDiscount = undefined;
      if (appliedDiscounts.length > 0) {
        const primary = appliedDiscounts[0];
        orderDiscount = {
          discountId: primary.discountId,
          code: appliedDiscounts.map(d => d.code).join(', '),
          amount: totalDiscountAmount,
        };
      }

      // Create order
      const order = await Order.create(
        [
          {
            orderNumber,
            user: userId,
            items: orderItems,
            shippingAddress: finalShippingAddress,
            discount: orderDiscount,
            subtotal,
            totalAmount: finalTotal,
            status: 'pending',
            paymentInfo: {
              method: paymentMethod,
              status: 'pending',
            },
            seller,
            notes,
          },
        ],
        { session }
      );

      // Record usage for ALL applied vouchers (outside session to avoid session conflicts)
      const DiscountService = require('./discount.service');
      const orderId = order[0]._id;

      for (const disc of appliedDiscounts) {
        if (disc.discountId) {
          await DiscountService.recordUsage(disc.discountId, userId, orderId, disc.amount || 0);
        }
      }
      // Also record freeship usage if applied
      if (cart.freeshippingDiscount?.code && cart.freeshippingDiscount?.discountId) {
        await DiscountService.recordUsage(
          cart.freeshippingDiscount.discountId,
          userId,
          orderId,
          0
        );
      }

      // Clear cart and all discount slots
      cart.items = [];
      cart.totalAmount = 0;
      cart.shopDiscount = undefined;
      cart.systemDiscount = undefined;
      cart.freeshippingDiscount = undefined;
      cart.discountedTotal = 0;
      await cart.save({ session });

      await session.commitTransaction();

      // Send notifications AFTER commit (non-blocking, errors don't affect order)
      const NotificationService = require('./notification.service');
      const createdOrder = order[0];
      try {
        // Notify the seller
        if (seller) {
          await NotificationService.notifyNewOrderToSeller(
            seller.toString(),
            createdOrder._id.toString(),
            createdOrder.orderNumber,
            createdOrder.totalAmount,
            orderItems.length
          );
        }
        // Also notify admins
        await NotificationService.notifyNewOrder(
          createdOrder._id.toString(),
          { totalAmount: createdOrder.totalAmount }
        );
      } catch (notifErr) {
        console.warn('[OrderService] Notification failed (non-critical):', notifErr.message);
      }

      return {
        order: {
          id: createdOrder._id,
          orderNumber: createdOrder.orderNumber,
          items: createdOrder.items.map(item => ({
            product: item.product,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            variationText: item.variationText,
            skuCode: item.skuCode,
          })),
          shippingAddress: createdOrder.shippingAddress,
          totalAmount: createdOrder.totalAmount,
          status: createdOrder.status,
          paymentInfo: createdOrder.paymentInfo,
          createdAt: createdOrder.createdAt,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();

      // Release all Redis locks
      if (locks) {
        await RedisLock.releaseMultiple(locks);
      }
    }
  }

  /**
   * Create manual order (Admin/Seller) - Bypasses cart
   */
  static createManualOrder = async (adminId, orderData) => {
    const { userId, items, shippingAddress, paymentMethod, paymentStatus, notes } = orderData;

    // Verify admin/seller permissions (handled by route middleware, but good to have check)
    // Here we assume caller has verified permissions

    // Validate user exists
    const customer = await User.findById(userId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Validate items and check stock
    const orderItems = [];
    let seller = null; // For multi-vendor, manual order might be restricted to single seller or handling mixed
    // For simplicity, let's assume manual order items belong to the logged-in seller if seller, or any if admin
    // If admin, we might need to split orders if multi-vendor, but let's stick to simple logic for now:
    // Manual orders are typically single-seller or system-wide.

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new BadRequestError(`Product ${item.productId} not found`);
      }

      // SKU logic
      let availableStock = product.stock;
      let currentPrice = product.price;
      let variationText = '';
      let skuCode = '';

      if (item.skuId && product.skus && product.skus.length > 0) {
        const sku = product.skus.id(item.skuId);
        if (!sku) {
          throw new BadRequestError(`SKU not found for product ${product.name}`);
        }
        availableStock = sku.stock;
        currentPrice = sku.price;
        skuCode = sku.skuCode;
        variationText = getVariationText(product.tierVariations, sku.tierIndex);
      }

      if (availableStock < item.quantity) {
        throw new BadRequestError(`Insufficient stock for ${product.name}`);
      }

      // Set seller from first product (or logic to multiple sellers)
      if (!seller) seller = product.seller;

      orderItems.push({
        product: product._id,
        skuId: item.skuId,
        skuCode,
        variationText,
        name: product.name,
        price: currentPrice,
        quantity: item.quantity,
        image: product.images[0] || '',
      });
    }

    // Acquire distributed locks for all inventory items
    let locks = null;
    let redisAvailable = true;

    try {
      const { getRedis } = require('../configs/config.redis');
      const redis = getRedis();
      await redis.ping();
    } catch (err) {
      redisAvailable = false;
      console.warn('Redis lock unavailable, proceeding with atomic checks only for manual order');
    }

    if (redisAvailable) {
      try {
        locks = await RedisLock.acquireMultiple(lockResourceIds, 15000);
        if (!locks) {
          throw new BadRequestError('High demand. Please try again in a few seconds.');
        }
      } catch (error) {
        if (error.message.includes('High demand')) {
          throw error;
        }
        console.warn('Redis lock error, proceeding with atomic checks only for manual order', error.message);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Reduce stock
      for (const item of orderItems) {
        if (item.skuId) {
          await Product.findOneAndUpdate(
            {
              _id: item.product,
              skus: {
                $elemMatch: {
                  _id: item.skuId
                }
              }
            },
            {
              $inc: {
                'skus.$.stock': -item.quantity,
                'skus.$.sold': item.quantity,
                totalStock: -item.quantity,
                totalSold: item.quantity,
                stock: -item.quantity
              }
            },
            { session }
          );
        } else {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: -item.quantity, totalSold: item.quantity } },
            { session }
          );
        }
      }

      const orderNumber = await generateOrderNumber();
      const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const order = await Order.create([{
        orderNumber,
        user: userId,
        items: orderItems,
        shippingAddress,
        totalAmount,
        subtotal: totalAmount,
        status: 'pending', // Manual orders start as pending or processing? Let's say pending.
        paymentInfo: {
          method: paymentMethod || 'manual',
          status: paymentStatus || 'pending',
          paidAt: paymentStatus === 'paid' ? new Date() : undefined
        },
        seller,
        notes,
        isManual: true // Flag to identify manual orders if schema supports it (optional)
      }], { session });

      await session.commitTransaction();

      if (locks) {
        await RedisLock.releaseMultiple(locks);
      }

      return {
        order: {
          id: order[0]._id,
          orderNumber: order[0].orderNumber,
          totalAmount: order[0].totalAmount,
          status: order[0].status
        }
      };

    } catch (error) {
      await session.abortTransaction();
      if (locks) {
        await RedisLock.releaseMultiple(locks);
      }
      throw error;
    } finally {
      session.endSession();
    }
  };

  /**
   * Get user orders with pagination
   */
  static getUserOrders = async (userId, userRole, filters, options) => {
    const { status, userId: filterUserId, asSeller } = filters;
    const { page = 1, limit = 10 } = options;

    const query = {};

    // Admin can view all orders, or filter by specific user
    // Regular users only see their own orders
    if (userRole === 'admin') {
      if (filterUserId) query.user = filterUserId;
    } else if (userRole === 'seller' && asSeller) {
      query.seller = userId;
    } else {
      query.user = userId;
    }

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit) > 50 ? 50 : parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return {
      orders: orders.map((order) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        items: order.items,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentInfo: order.paymentInfo,
        customer: order.user,
        createdAt: order.createdAt,
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  };

  /**
   * Get order by ID
   */
  static getOrderById = async (orderId, userId, userRole) => {
    const order = await Order.findById(orderId)
      .populate('items.product', 'name images')
      .populate('seller', 'name email');

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Verify user owns order or is admin or is the seller
    if (
      order.user.toString() !== userId &&
      userRole !== 'admin' &&
      order.seller?._id.toString() !== userId
    ) {
      throw new ForbiddenError('You are not authorized to view this order');
    }

    return {
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        user: order.user,
        items: order.items,
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentInfo: order.paymentInfo,
        seller: order.seller,
        notes: order.notes,
        isCancellable: order.isCancellable,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    };
  };

  /**
   * Update order status (seller/admin)
   */
  static updateOrderStatus = async (orderId, status, userId, userRole) => {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Verify user is seller or admin
    if (
      order.seller.toString() !== userId &&
      userRole !== 'admin'
    ) {
      throw new ForbiddenError('You are not authorized to update this order');
    }

    // Validate status transition
    const validTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestError(
        `Cannot change status from ${order.status} to ${status}`
      );
    }

    order.status = status;

    // If delivered and COD, mark as paid
    if (status === 'delivered' && order.paymentInfo.method === 'COD') {
      order.paymentInfo.status = 'paid';
      order.paymentInfo.paidAt = new Date();
    }

    await order.save();

    // Update shop statistics when order is delivered
    if (status === 'delivered' && order.seller) {
      try {
        await Shop.findOneAndUpdate(
          { owner: order.seller },
          { $inc: { totalOrders: 1, totalRevenue: order.totalAmount } }
        );
      } catch (shopStatErr) {
        console.warn('[OrderService] Failed to update shop stats (non-critical):', shopStatErr.message);
      }
    }

    return {
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentInfo: order.paymentInfo,
        updatedAt: order.updatedAt,
      },
    };
  };

  /**
   * Cancel order (SKU-aware stock restoration)
   */
  static cancelOrder = async (orderId, userId, userRole) => {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Verify user owns order or is admin
    if (order.user.toString() !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You are not authorized to cancel this order');
    }

    // Check if cancellable
    if (!order.isCancellable) {
      throw new BadRequestError(
        `Cannot cancel order with status ${order.status}`
      );
    }

    // Restore stock for all items (SKU-aware)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const item of order.items) {
        if (item.skuId) {
          // SKU-level stock restoration
          await Product.findOneAndUpdate(
            {
              _id: item.product,
              'skus._id': item.skuId
            },
            {
              $inc: {
                'skus.$.stock': item.quantity,
                'skus.$.sold': -item.quantity,
                totalStock: item.quantity,
                totalSold: -item.quantity
              }
            },
            { session }
          );
        } else {
          // Product-level stock restoration
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity, totalSold: -item.quantity } },
            { session }
          );
        }
      }

      order.status = 'cancelled';
      await order.save({ session });

      await session.commitTransaction();

      return {
        message: 'Order cancelled successfully',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  };
}

module.exports = OrderService;
