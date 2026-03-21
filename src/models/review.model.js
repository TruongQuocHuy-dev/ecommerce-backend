const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      // Reference to order for verified purchase
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    title: {
      type: String,
      required: [true, 'Please provide a review title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Please provide a review comment'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    votedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    // Admin moderation (for future use)
    isApproved: {
      type: Boolean,
      default: true,
    },
    isReported: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Indexes for efficient queries
reviewSchema.index({ product: 1, createdAt: -1 }); // Product reviews, newest first
reviewSchema.index({ product: 1, helpfulVotes: -1 }); // Most helpful reviews
reviewSchema.index({ product: 1, rating: 1 }); // Filter by rating

// Method to add helpful vote
reviewSchema.methods.addHelpfulVote = function (userId) {
  // Check if user already voted
  if (this.votedBy.includes(userId)) {
    return false; // Already voted
  }
  
  this.votedBy.push(userId);
  this.helpfulVotes += 1;
  return true;
};

// Method to remove helpful vote
reviewSchema.methods.removeHelpfulVote = function (userId) {
  const index = this.votedBy.indexOf(userId);
  if (index === -1) {
    return false; // Not voted
  }
  
  this.votedBy.splice(index, 1);
  this.helpfulVotes -= 1;
  return true;
};

// Static method to get product rating statistics
reviewSchema.statics.getProductStats = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: new mongoose.Types.ObjectId(productId) },
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);

  // Convert to distribution object
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalReviews = 0;
  let totalRating = 0;

  stats.forEach((stat) => {
    distribution[stat._id] = stat.count;
    totalReviews += stat.count;
    totalRating += stat._id * stat.count;
  });

  const averageRating =
    totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;

  return {
    averageRating,
    totalReviews,
    distribution,
  };
};

module.exports = mongoose.model('Review', reviewSchema);
