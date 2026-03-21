const mongoose = require('mongoose');

/**
 * Discount/Voucher Model
 * Supports percentage and fixed amount discounts with usage tracking
 */

const discountSchema = new mongoose.Schema(
  {
    // Basic Info
    scope: {
      type: String,
      enum: ['shop', 'system'],
      default: 'shop',
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // the seller
      required: function () {
        return this.scope === 'shop';
      },
    },
    name: {
      type: String,
      required: [true, 'Discount name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Discount code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, 'Code cannot exceed 20 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // Discount Type & Value
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'freeship'],
      required: [true, 'Discount type is required'],
    },
    value: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Value cannot be negative'],
    },

    // Constraints
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative'],
    },
    maxDiscount: {
      type: Number,
      // Maximum discount amount (useful for percentage discounts)
      min: [0, 'Maximum discount cannot be negative'],
    },

    // Date Range
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    // Usage Limits
    usageLimit: {
      type: Number,
      // Total uses allowed (null = unlimited)
      min: [1, 'Usage limit must be at least 1'],
    },
    usageCount: {
      type: Number,
      default: 0,
      min: [0, 'Usage count cannot be negative'],
    },
    usagePerUser: {
      type: Number,
      default: 1,
      min: [1, 'Usage per user must be at least 1'],
    },

    // Track who used this discount
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order',
        },
        amount: {
          type: Number,
        },
      },
    ],

    // Scope - Which products/categories this applies to
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Created by (admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (code index not needed - defined with unique: true in field)
discountSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
discountSchema.index({ 'usedBy.user': 1 });
discountSchema.index({ createdAt: -1 });

// Virtual to check if discount is currently valid
discountSchema.virtual('isValid').get(function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.usageLimit === null || this.usageCount < this.usageLimit)
  );
});

// Method to calculate discount amount
discountSchema.methods.calculateDiscount = function (orderTotal, eligibleTotal) {
  if (orderTotal < this.minOrderValue) {
    return 0;
  }

  let discountAmount;

  if (this.type === 'freeship') {
    // Freeship vouchers conceptually apply to shipping, not the subtotal
    // The exact shipping fee is typically calculated at cart/checkout.
    // So for the product calculation, it returns 0.
    return 0;
  } else if (this.type === 'percentage') {
    discountAmount = eligibleTotal * (this.value / 100);
    // Apply max discount cap if set
    if (this.maxDiscount) {
      discountAmount = Math.min(discountAmount, this.maxDiscount);
    }
  } else {
    // Fixed amount
    discountAmount = Math.min(this.value, eligibleTotal);
  }

  return Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
};

// Method to check if user can use this discount
discountSchema.methods.canUserUse = function (userId) {
  const userUsage = this.usedBy.filter(
    (use) => use.user.toString() === userId.toString()
  ).length;
  return userUsage < this.usagePerUser;
};

// Ensure virtuals are included in JSON
discountSchema.set('toJSON', { virtuals: true });
discountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Discount', discountSchema);
