const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  // ===== SKU FIELDS (Phase 2.5) =====
  skuId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  skuCode: {
    type: String,
  },
  tierIndex: {
    type: [Number],
    default: [],
  },
  variationText: {
    type: String,
    // e.g., "Color: Red, Size: M" - for display in order history
  },
  // ===== END SKU FIELDS =====
  name: {
    type: String,
    required: true, // Snapshot of product name
  },
  price: {
    type: Number,
    required: true, // Snapshot of SKU price
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  image: {
    type: String, // Snapshot of SKU or product image
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      name: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      province: {
        type: String,
      },
      postalCode: {
        type: String,
      },
    },
    // ===== DISCOUNT FIELDS (Phase 5) =====
    // ===== DISCOUNT FIELDS (Phase 5) =====
    shopDiscount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      code: String,
      amount: Number,
    },
    systemDiscount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      code: String,
      amount: Number,
    },
    subtotal: {
      type: Number, // Total before discount
    },
    // ===== END DISCOUNT FIELDS =====
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentInfo: {
      method: {
        type: String,
        enum: ['COD', 'card', 'bank_transfer', 'momo', 'vnpay'],
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending',
      },
      paidAt: {
        type: Date,
      },
      transactionId: {
        type: String,
      },
      requestId: {
        type: String, // For MoMo
      },
      bankCode: {
        type: String, // For VNPay
      },
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries (orderNumber index not needed - defined with unique: true in field)
orderSchema.index({ user: 1, createdAt: -1 }); // User's orders, newest first
orderSchema.index({ seller: 1, status: 1 }); // Seller's orders by status
orderSchema.index({ status: 1 }); // Admin filter by status

// Virtual for checking if order is cancellable
orderSchema.virtual('isCancellable').get(function () {
  return ['pending', 'processing'].includes(this.status);
});

// Ensure virtuals are included in JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
