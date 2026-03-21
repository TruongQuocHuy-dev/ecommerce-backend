const Discount = require('../models/discount.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require('../utils/error.response');

/**
 * Discount Service - Voucher/Coupon Business Logic
 */

class DiscountService {
  /**
   * Create a new discount (Admin only)
   */
  static createDiscount = async (adminId, discountData) => {
    const {
      name,
      code,
      description,
      type,
      value,
      minOrderValue,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      usagePerUser,
      applicableCategories,
      applicableProducts,
      scope,
    } = discountData;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new BadRequestError('End date must be after start date');
    }

    // Validate percentage value
    if (type === 'percentage' && value > 100) {
      throw new BadRequestError('Percentage discount cannot exceed 100%');
    }

    // Check if code already exists
    const existingDiscount = await Discount.findOne({ code: code.toUpperCase() });
    if (existingDiscount) {
      throw new BadRequestError('Discount code already exists');
    }

    const discount = await Discount.create({
      name,
      code: code.toUpperCase(),
      description,
      type,
      value,
      minOrderValue: minOrderValue || 0,
      maxDiscount,
      startDate: start,
      endDate: end,
      usageLimit,
      usagePerUser: usagePerUser || 1,
      applicableCategories: applicableCategories || [],
      applicableProducts: applicableProducts || [],
      isActive: true,
      scope: scope || 'shop',
      createdBy: adminId,
    });

    return {
      discount: {
        id: discount._id,
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        maxDiscount: discount.maxDiscount,
        startDate: discount.startDate,
        endDate: discount.endDate,
        usageLimit: discount.usageLimit,
        usagePerUser: discount.usagePerUser,
        isActive: discount.isActive,
      },
    };
  };

  /**
   * Get all discounts (Admin only)
   */
  static getAllDiscounts = async (filters = {}, options = {}) => {
    const { isActive, type } = filters;
    const { page = 1, limit = 20 } = options;

    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true' || isActive === true;
    }
    if (type) {
      query.type = type;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit) > 50 ? 50 : parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [discounts, totalCount] = await Promise.all([
      Discount.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Discount.countDocuments(query),
    ]);

    return {
      discounts: discounts.map((d) => ({
        id: d._id,
        name: d.name,
        code: d.code,
        description: d.description,
        type: d.type,
        value: d.value,
        minOrderValue: d.minOrderValue,
        maxDiscount: d.maxDiscount,
        startDate: d.startDate,
        endDate: d.endDate,
        usageLimit: d.usageLimit,
        usageCount: d.usageCount,
        usagePerUser: d.usagePerUser,
        isActive: d.isActive,
        isValid: d.isActive && new Date() >= d.startDate && new Date() <= d.endDate,
      })),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount,
      },
    };
  };

  /**
   * Get all active and valid discounts for users
   */
  static getAvailableDiscounts = async (userId) => {
    const now = new Date();

    // Find discounts that are active, unexpired, and have available usage
    const discounts = await Discount.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usageCount', '$usageLimit'] } }
      ]
    }).sort({ endDate: 1 }).populate('shopId', 'shopName');

    // Filter by canUserUse
    const availableDiscounts = discounts.filter(d => d.canUserUse(userId)).map((d) => ({
      id: d._id,
      name: d.name,
      code: d.code,
      description: d.description,
      type: d.type,
      value: d.value,
      minOrderValue: d.minOrderValue,
      maxDiscount: d.maxDiscount,
      startDate: d.startDate,
      endDate: d.endDate,
      scope: d.scope,
      shopId: d.shopId,
      usageLimit: d.usageLimit,
      usageCount: d.usageCount,
      usagePerUser: d.usagePerUser
    }));

    return {
      discounts: availableDiscounts,
    };
  };

  /**
   * Validate and apply discount to cart
   */
  static applyToCart = async (userId, code) => {
    // Find discount by code
    const discount = await Discount.findOne({ code: code.toUpperCase() });

    if (!discount) {
      throw new NotFoundError('Discount code not found');
    }

    // Check if active
    if (!discount.isActive) {
      throw new BadRequestError('This discount code is no longer active');
    }

    // Check date range
    const now = new Date();
    if (now < discount.startDate) {
      throw new BadRequestError('This discount code is not yet active');
    }
    if (now > discount.endDate) {
      throw new BadRequestError('This discount code has expired');
    }

    // Check total usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      throw new BadRequestError('This discount code has reached its usage limit');
    }

    // Check per-user usage
    if (!discount.canUserUse(userId)) {
      throw new BadRequestError('You have already used this discount code');
    }

    // Get user cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    // Check minimum order value
    if (cart.totalAmount < discount.minOrderValue) {
      throw new BadRequestError(
        `Minimum order value of $${discount.minOrderValue} required for this discount`
      );
    }

    // Calculate eligible amount (filter by applicable products/categories and shop)
    let eligibleTotal = cart.totalAmount;

    // Filter items first by shop if it's a shop discount
    let eligibleItems = cart.items;
    if (discount.scope === 'shop') {
      eligibleItems = eligibleItems.filter(
        item => item.product.seller && item.product.seller.toString() === discount.shopId.toString()
      );

      if (eligibleItems.length === 0) {
        throw new BadRequestError('No items in your cart are from this shop');
      }

      eligibleTotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    if (discount.applicableProducts.length > 0 || discount.applicableCategories.length > 0) {
      eligibleTotal = 0;

      for (const item of eligibleItems) {
        const product = item.product;

        // Check if product is in applicable list
        const isProductApplicable =
          discount.applicableProducts.length === 0 ||
          discount.applicableProducts.some(p => p.toString() === product._id.toString());

        // Check if category is in applicable list
        const isCategoryApplicable =
          discount.applicableCategories.length === 0 ||
          discount.applicableCategories.some(c => c.toString() === product.category.toString());

        if (isProductApplicable && isCategoryApplicable) {
          eligibleTotal += item.price * item.quantity;
        }
      }

      if (eligibleTotal === 0) {
        throw new BadRequestError('No items in your cart are eligible for this discount');
      }
    }

    // Calculate discount amount based on eligible items
    const discountAmount = discount.calculateDiscount(eligibleTotal, eligibleTotal);

    const discountData = {
      discountId: discount._id,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      amount: discountAmount,
      appliedAt: new Date(),
    };

    // Apply to cart based on scope AND type
    if (discount.scope === 'shop') {
      discountData.shopId = discount.shopId;
      cart.shopDiscount = discountData;
    } else if (discount.type === 'freeship') {
      // Freeship always goes into its own dedicated slot
      cart.freeshippingDiscount = discountData;
    } else {
      cart.systemDiscount = discountData;
    }

    await cart.save();

    // Recalculate total discounted correctly from schema saving hook
    let totalDiscount = 0;
    if (cart.shopDiscount) totalDiscount += cart.shopDiscount.amount;
    if (cart.systemDiscount) totalDiscount += cart.systemDiscount.amount;

    const discountedTotal = Math.max(0, cart.totalAmount - totalDiscount);

    return {
      cart: {
        id: cart._id,
        totalAmount: cart.totalAmount,
        shopDiscount: cart.shopDiscount,
        systemDiscount: cart.systemDiscount,
        freeshippingDiscount: cart.freeshippingDiscount,
        discountedTotal,
        savings: totalDiscount,
      },
    };
  };

  /**
   * Remove discount from cart
   */
  static removeFromCart = async (userId, scope) => {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    if (scope === 'shop') {
      if (!cart.shopDiscount?.code) throw new BadRequestError('No shop discount applied');
      cart.shopDiscount = undefined;
    } else if (scope === 'system') {
      if (!cart.systemDiscount?.code) throw new BadRequestError('No system discount applied');
      cart.systemDiscount = undefined;
    } else if (scope === 'freeship') {
      if (!cart.freeshippingDiscount?.code) throw new BadRequestError('No freeship discount applied');
      cart.freeshippingDiscount = undefined;
    } else {
      // Remove all if no scope given
      cart.shopDiscount = undefined;
      cart.systemDiscount = undefined;
      cart.freeshippingDiscount = undefined;
    }

    await cart.save();

    return {
      message: 'Discount removed successfully',
      cart: {
        id: cart._id,
        totalAmount: cart.totalAmount,
        discountedTotal: cart.discountedTotal,
      },
    };
  };

  /**
   * Record discount usage (called during order creation)
   */
  static recordUsage = async (discountId, userId, orderId, amount) => {
    await Discount.findByIdAndUpdate(discountId, {
      $inc: { usageCount: 1 },
      $push: {
        usedBy: {
          user: userId,
          orderId,
          amount,
          usedAt: new Date(),
        },
      },
    });
  };

  /**
   * Update discount (Admin only)
   */
  static updateDiscount = async (discountId, updateData) => {
    const discount = await Discount.findById(discountId);

    if (!discount) {
      throw new NotFoundError('Discount not found');
    }

    // Don't allow changing code
    delete updateData.code;
    delete updateData.usageCount;
    delete updateData.usedBy;

    // Validate dates if being updated
    if (updateData.startDate || updateData.endDate) {
      const start = new Date(updateData.startDate || discount.startDate);
      const end = new Date(updateData.endDate || discount.endDate);

      if (start >= end) {
        throw new BadRequestError('End date must be after start date');
      }
    }

    // Validate percentage
    if (updateData.type === 'percentage' && updateData.value > 100) {
      throw new BadRequestError('Percentage discount cannot exceed 100%');
    }

    Object.assign(discount, updateData);
    await discount.save();

    return {
      discount: {
        id: discount._id,
        name: discount.name,
        code: discount.code,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        maxDiscount: discount.maxDiscount,
        startDate: discount.startDate,
        endDate: discount.endDate,
        usageLimit: discount.usageLimit,
        usageCount: discount.usageCount,
        usagePerUser: discount.usagePerUser,
        isActive: discount.isActive,
      },
    };
  };

  /**
   * Deactivate discount (Admin only)
   */
  static deactivateDiscount = async (discountId) => {
    const discount = await Discount.findById(discountId);

    if (!discount) {
      throw new NotFoundError('Discount not found');
    }

    discount.isActive = false;
    await discount.save();

    return {
      message: 'Discount deactivated successfully',
      discount: {
        id: discount._id,
        code: discount.code,
        isActive: discount.isActive,
      },
    };
  };

  /**
   * Get discount by ID (Admin only)
   */
  static getDiscountById = async (discountId) => {
    const discount = await Discount.findById(discountId)
      .populate('applicableCategories', 'name')
      .populate('applicableProducts', 'name');

    if (!discount) {
      throw new NotFoundError('Discount not found');
    }

    return {
      discount: {
        id: discount._id,
        name: discount.name,
        code: discount.code,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        maxDiscount: discount.maxDiscount,
        startDate: discount.startDate,
        endDate: discount.endDate,
        usageLimit: discount.usageLimit,
        usageCount: discount.usageCount,
        usagePerUser: discount.usagePerUser,
        applicableCategories: discount.applicableCategories,
        applicableProducts: discount.applicableProducts,
        isActive: discount.isActive,
        isValid: discount.isValid,
        usedBy: discount.usedBy.length,
        createdAt: discount.createdAt,
      },
    };
  };
}

module.exports = DiscountService;
