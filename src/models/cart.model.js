const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  // ===== SKU FIELDS (Phase 2.5) =====
  skuId: {
    type: mongoose.Schema.Types.ObjectId,
    // SKU reference within product.skus array
  },
  skuCode: {
    type: String,
    // For display purposes
  },
  tierIndex: {
    type: [Number],
    default: [],
    // e.g., [0, 1] means Color: Red (tier1[0]), Size: M (tier2[1])
  },
  variationText: {
    type: String,
    // e.g., "Color: Red, Size: M" for display
  },
  // ===== END SKU FIELDS =====
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  price: {
    type: Number,
    required: true, // Snapshot of SKU price at time of adding
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One cart per user
    },
    items: [cartItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    // ===== DISCOUNT FIELDS (Phase 5) =====
    shopDiscount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      code: String,
      type: { type: String, enum: ['percentage', 'fixed', 'freeship'] },
      value: Number,
      amount: Number,
      appliedAt: Date,
      shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    systemDiscount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      code: String,
      type: { type: String, enum: ['percentage', 'fixed', 'freeship'] },
      value: Number,
      amount: Number,
      appliedAt: Date,
    },
    // Dedicated slot for freeship vouchers (independent of systemDiscount)
    freeshippingDiscount: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
      code: String,
      type: { type: String, enum: ['freeship'] },
      value: Number,
      amount: Number,
      appliedAt: Date,
    },
    discountedTotal: {
      type: Number,
      default: 0,
    },
    // ===== END DISCOUNT FIELDS =====
  },
  {
    timestamps: true,
  }
);

// Calculate total amount and discounted total before saving
cartSchema.pre('save', function (next) {
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);
  } else {
    this.totalAmount = 0;
  }

  // Calculate discounted total
  let totalDiscountAmount = 0;
  if (this.shopDiscount && this.shopDiscount.amount) {
    totalDiscountAmount += this.shopDiscount.amount;
  }
  if (this.systemDiscount && this.systemDiscount.amount) {
    totalDiscountAmount += this.systemDiscount.amount;
  }

  this.discountedTotal = Math.max(0, this.totalAmount - totalDiscountAmount);

  next();
});

// Method to add or update item (SKU-aware)
cartSchema.methods.addItem = function (itemData) {
  const { product, skuId, skuCode, tierIndex, variationText, quantity, price } = itemData;

  // For SKU products: find by skuId
  // For non-SKU products: find by productId only
  let existingItemIndex = -1;

  if (skuId) {
    existingItemIndex = this.items.findIndex(
      (item) => item.skuId && item.skuId.toString() === skuId.toString()
    );
  } else {
    existingItemIndex = this.items.findIndex(
      (item) => item.product.toString() === product.toString() && !item.skuId
    );
  }

  if (existingItemIndex >= 0) {
    // Item exists, update quantity
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // New item, add to cart
    this.items.push({
      product,
      skuId,
      skuCode,
      tierIndex,
      variationText,
      quantity,
      price,
    });
  }
};

// Method to update item quantity
cartSchema.methods.updateItem = function (itemId, quantity) {
  const item = this.items.id(itemId);
  if (item) {
    item.quantity = quantity;
  }
};

// Method to remove item
cartSchema.methods.removeItem = function (itemId) {
  this.items.pull(itemId);
};

// Method to clear cart
cartSchema.methods.clearCart = function () {
  this.items = [];
  this.totalAmount = 0;
};

// Index for faster user lookup not needed - user field has unique: true

module.exports = mongoose.model('Cart', cartSchema);
