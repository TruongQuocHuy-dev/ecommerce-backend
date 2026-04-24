const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a product description'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    // ===== SEO FIELDS =====
    metaTitle: {
      type: String,
      maxlength: [200, 'Meta title cannot exceed 200 characters'],
    },
    metaDescription: {
      type: String,
      maxlength: [300, 'Meta description cannot exceed 300 characters'],
    },
    metaKeywords: {
      type: String, // Comma separated keywords
      maxlength: [200, 'Meta keywords cannot exceed 200 characters'],
    },
    // Old fields (for backward compatibility - deprecated when using SKUs)
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },

    // ===== TIER VARIATIONS (Phase 2.5) =====
    tierVariations: [
      {
        name: {
          type: String, // e.g., "Color", "Size", "Storage"
          required: true,
        },
        options: {
          type: [String], // e.g., ["Red", "Blue"], ["S", "M", "L"]
          required: true,
          validate: {
            validator: function (v) {
              return v && v.length > 0;
            },
            message: 'Tier must have at least one option'
          }
        },
        images: [String], // Optional: images for each option
      },
    ],

    // ===== SKUs (AUTO-GENERATED FROM TIERS) =====
    skus: [
      {
        skuCode: {
          type: String,
          required: true,
        },
        tierIndex: {
          type: [Number], // e.g., [0, 1] means tier1[0], tier2[1]
          required: true,
          default: [],
        },
        price: {
          type: Number,
          required: true,
          min: [0, 'SKU price cannot be negative'],
        },
        originalPrice: {
          type: Number,
          min: [0, 'SKU original price cannot be negative'],
        },
        stock: {
          type: Number,
          required: true,
          default: 0,
          min: [0, 'SKU stock cannot be negative'],
        },
        images: [String], // Optional: specific images for this SKU
        isActive: {
          type: Boolean,
          default: true,
        },
        sold: {
          type: Number,
          default: 0,
          min: [0, 'Sold count cannot be negative'],
        },
      },
    ],

    // ===== AGGREGATED INFO =====
    priceRange: {
      min: Number,
      max: Number,
    },
    totalStock: {
      type: Number,
      default: 0,
    },
    totalSold: {
      type: Number,
      default: 0,
      min: [0, 'Sold count cannot be negative'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please provide a category'],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    images: {
      type: [String], // Array of Cloudinary URLs
      validate: {
        validator: function (v) {
          return v && v.length > 0 && v.length <= 5;
        },
        message: 'Product must have at least 1 and at most 5 images',
      },
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Product must have a seller'],
    },
    // Ratings
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5'],
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    ratingDistribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 },
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    // Approval Workflow (Phase 2 - Advanced)
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved', // Default for backward compatibility
    },
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug from name before saving (must run before SKU pre-save hook)
productSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    // Add random suffix to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(7);
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
    }) + '-' + randomSuffix;
  }
  next();
});

// Method to calculate average rating
productSchema.methods.calculateAverageRating = function (reviews) {
  if (reviews.length === 0) {
    this.averageRating = 0;
    this.numReviews = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = totalRating / reviews.length;
    this.numReviews = reviews.length;
  }
};

// ===== SKU HELPER METHODS (Phase 2.5) =====

// Method to find SKU by tier indices
productSchema.methods.findSKUByTierIndex = function (tierIndex) {
  if (!this.skus || this.skus.length === 0) return null;

  return this.skus.find((sku) => {
    if (!sku.tierIndex || sku.tierIndex.length !== tierIndex.length) return false;
    return sku.tierIndex.every((val, idx) => val === tierIndex[idx]);
  });
};

// Method to update price range
productSchema.methods.updatePriceRange = function () {
  if (!this.skus || this.skus.length === 0) {
    this.priceRange = { min: this.price, max: this.price };
    return;
  }

  const prices = this.skus.map(sku => sku.price);
  this.priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
};

// Method to update total stock
productSchema.methods.updateTotalStock = function () {
  if (!this.skus || this.skus.length === 0) {
    this.totalStock = this.stock;
    return;
  }

  this.totalStock = this.skus.reduce((total, sku) => total + sku.stock, 0);
};

// Pre-save hook to auto-update aggregated fields
productSchema.pre('save', function (next) {
  // Update price range and total stock if SKUs exist
  if (this.skus && this.skus.length > 0) {
    this.updatePriceRange();
    this.updateTotalStock();

    // Sync root level old fields with aggregated data for backward compatibility
    this.price = this.priceRange.min;
    this.stock = this.totalStock;

    // Calculate aggregated originalPrice (max of all SKU originalPrices, fallback to max regular price)
    const originalPrices = this.skus.map(sku => sku.originalPrice || sku.price);
    this.originalPrice = Math.max(...originalPrices);
  }

  next();
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Ensure virtuals are included in JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text' }); // Text search
productSchema.index({ category: 1 }); // Category filter
productSchema.index({ brand: 1 }); // Brand filter
productSchema.index({ supplier: 1 }); // Supplier filter
productSchema.index({ seller: 1 }); // Seller products
productSchema.index({ price: 1 }); // Price sorting
productSchema.index({ averageRating: -1 }); // Rating sorting
productSchema.index({ createdAt: -1 }); // Latest products
productSchema.index({ isActive: 1 }); // Active products
productSchema.index({ approvalStatus: 1 }); // Approval filtering
// Note: slug index removed - already defined with unique: true in schema field

// Static method to update product rating from reviews
productSchema.statics.updateProductRating = async function (productId) {
  const Review = require('./review.model');

  const stats = await Review.getProductStats(productId);

  await this.findByIdAndUpdate(productId, {
    averageRating: stats.averageRating,
    numReviews: stats.totalReviews,
    ratingDistribution: stats.distribution,
  });

  return stats;
};

module.exports = mongoose.model('Product', productSchema);
