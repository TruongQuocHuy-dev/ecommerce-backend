const Review = require('../models/review.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const Shop = require('../models/shop.model');
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} = require('../utils/error.response');
const { getRedis } = require('../configs/config.redis');

/**
 * Recalculate and update shop's reviewCount and rating based on all product reviews
 * @param {ObjectId} shopOwnerId - The seller/owner user ID
 */
async function _updateShopReviewStats(shopOwnerId) {
  if (!shopOwnerId) return;
  try {
    const stats = await Review.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: '$prod' },
      { $match: { 'prod.seller': shopOwnerId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    const reviewCount = stats[0]?.count || 0;
    const rating = stats[0] ? Math.round(stats[0].avgRating * 10) / 10 : 0;

    await Shop.findOneAndUpdate(
      { owner: shopOwnerId },
      { reviewCount, rating }
    );
  } catch (err) {
    console.warn('[ReviewService] Failed to update shop review stats (non-critical):', err.message);
  }
}

/**
 * Review Service - Product Review Business Logic
 */

class ReviewService {
  /**
   * Create product review
   */
  static createReview = async (userId, productId, reviewData) => {
    const { rating, title, comment } = reviewData;

    // Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new NotFoundError('Product not found or inactive');
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });

    if (existingReview) {
      throw new ConflictError('You have already reviewed this product');
    }

    // Check if user purchased this product (verified purchase)
    const order = await Order.findOne({
      user: userId,
      status: 'delivered',
      'items.product': productId,
    });

    const isVerifiedPurchase = !!order;

    // Create review
    const review = await Review.create({
      user: userId,
      product: productId,
      order: order?._id,
      rating,
      title,
      comment,
      isVerifiedPurchase,
    });

    // Update product rating
    await Product.updateProductRating(productId);

    // Update shop review stats
    await _updateShopReviewStats(product.seller);

    // Invalidate product reviews cache
    try {
      const redis = getRedis();
      if (redis) {
        const keys = await redis.keys(`reviews:${productId}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (cacheErr) {
      console.warn('[Cache] Failed to invalidate review cache:', cacheErr.message);
    }

    // Populate user info
    await review.populate('user', 'name');

    return {
      review: {
        id: review._id,
        user: {
          id: review.user._id,
          name: review.user.name,
        },
        product: review.product,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpfulVotes: review.helpfulVotes,
        isVerifiedPurchase: review.isVerifiedPurchase,
        createdAt: review.createdAt,
      },
    };
  };

  /**
   * Get product reviews with filters and pagination
   */
  static getProductReviews = async (productId, filters, options) => {
    const { rating, verifiedOnly } = filters;
    const { page = 1, limit = 10, sort = 'newest' } = options;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Build query
    const query = { product: productId };

    if (rating) {
      query.rating = parseInt(rating);
    }

    if (verifiedOnly === 'true') {
      query.isVerifiedPurchase = true;
    }

    // Sort options
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      helpful: { helpfulVotes: -1, createdAt: -1 },
      rating_high: { rating: -1, createdAt: -1 },
      rating_low: { rating: 1, createdAt: -1 },
    };

    const sortBy = sortOptions[sort] || sortOptions.newest;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit) > 50 ? 50 : parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Check Cache first
    const cacheKey = `reviews:${productId}:P${pageNum}-L${limitNum}-R${rating || 'all'}-V${verifiedOnly || false}-S${sort}`;
    try {
      const redis = getRedis();
      if (redis) {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      }
    } catch (cacheErr) {
      console.warn('[Cache] Redis error on get reviews:', cacheErr.message);
    }

    // Execute query
    const [reviews, totalCount, stats] = await Promise.all([
      Review.find(query)
        .populate('user', 'name')
        .sort(sortBy)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(query),
      Review.getProductStats(productId),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    const result = {
      reviews: reviews.map((review) => ({
        id: review._id,
        user: {
          id: review.user._id,
          name: review.user.name,
        },
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpfulVotes: review.helpfulVotes,
        isVerifiedPurchase: review.isVerifiedPurchase,
        createdAt: review.createdAt,
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      summary: stats,
    };

    // Save to Cache (Expire in 5 minutes)
    try {
      const redis = getRedis();
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
      }
    } catch (cacheErr) {
      console.warn('[Cache] Failed to set review cache:', cacheErr.message);
    }

    return result;
  };

  /**
   * Update review
   */
  static updateReview = async (reviewId, userId, updateData) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Verify user owns review
    if (review.user.toString() !== userId) {
      throw new ForbiddenError('You can only update your own reviews');
    }

    const oldRating = review.rating;

    // Update review
    Object.assign(review, updateData);
    await review.save();

    // If rating changed, update product rating
    if (updateData.rating && updateData.rating !== oldRating) {
      await Product.updateProductRating(review.product);
    }

    // Invalidate product reviews cache
    try {
      const redis = getRedis();
      if (redis) {
        const keys = await redis.keys(`reviews:${review.product}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (cacheErr) {
      console.warn('[Cache] Failed to invalidate review cache:', cacheErr.message);
    }

    await review.populate('user', 'name');

    return {
      review: {
        id: review._id,
        user: {
          id: review.user._id,
          name: review.user.name,
        },
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpfulVotes: review.helpfulVotes,
        isVerifiedPurchase: review.isVerifiedPurchase,
        updatedAt: review.updatedAt,
      },
    };
  };

  /**
   * Delete review
   */
  static deleteReview = async (reviewId, userId, userRole) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Verify user owns review or is admin
    if (review.user.toString() !== userId && userRole !== 'admin') {
      throw new ForbiddenError('You can only delete your own reviews');
    }

    const productId = review.product;

    // Get product to find seller before deleting
    const productForShop = await Product.findById(productId).select('seller').lean();

    // Delete review
    await review.deleteOne();

    // Update product rating
    await Product.updateProductRating(productId);

    // Update shop review stats
    await _updateShopReviewStats(productForShop?.seller);

    // Invalidate product reviews cache
    try {
      const redis = getRedis();
      if (redis) {
        const keys = await redis.keys(`reviews:${productId}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (cacheErr) {
      console.warn('[Cache] Failed to invalidate review cache:', cacheErr.message);
    }

    return {
      message: 'Review deleted successfully',
    };
  };

  /**
   * Add helpful vote to review
   */
  static addHelpfulVote = async (reviewId, userId) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Cannot vote on own review
    if (review.user.toString() === userId) {
      throw new BadRequestError('You cannot vote on your own review');
    }

    // Check if already voted
    if (review.votedBy.includes(userId)) {
      // Remove vote (toggle)
      review.removeHelpfulVote(userId);
      await review.save();

      return {
        message: 'Helpful vote removed',
        helpfulVotes: review.helpfulVotes,
        voted: false,
      };
    }

    // Add vote
    review.addHelpfulVote(userId);
    await review.save();

    // Invalidate product reviews cache
    try {
      const redis = getRedis();
      if (redis) {
        const keys = await redis.keys(`reviews:${review.product}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } catch (cacheErr) {
      console.warn('[Cache] Failed to invalidate review cache:', cacheErr.message);
    }

    return {
      message: 'Review marked as helpful',
      helpfulVotes: review.helpfulVotes,
      voted: true,
    };
  };

  /**
   * Get rating distribution
   */
  static getRatingDistribution = async (productId) => {
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const stats = await Review.getProductStats(productId);

    // Calculate percentages
    const percentages = {};
    Object.keys(stats.distribution).forEach((rating) => {
      percentages[rating] =
        stats.totalReviews > 0
          ? Math.round((stats.distribution[rating] / stats.totalReviews) * 100)
          : 0;
    });

    return {
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      distribution: stats.distribution,
      distribution,
    };
  };

  /**
   * Get all reviews for admin (with pagination and filters)
   */
  static getAllReviewsForAdmin = async (filters, options) => {
    const { search, rating, status } = filters;
    const { page = 1, limit = 15 } = options;

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { comment: { $regex: search, $options: 'i' } },
      ];
    }

    if (rating && rating !== 'all') {
      query.rating = parseInt(rating);
    }

    // Note: Review model doesn't have status field currently
    // If you want to add moderation, add 'status' field to model
    // For now, we'll skip this filter
    // if (status && status !== 'all') {
    //   query.status = status;
    // }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('user', 'name email')
        .populate('product', 'name images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments(query),
    ]);

    return {
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    };
  };

  /**
   * Approve review (admin)
   * Note: Requires 'status' field in Review model to work
   */
  static approveReview = async (reviewId) => {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // If you add status field to model, uncomment this:
    // review.status = 'approved';
    // await review.save();

    return review;
  };

  /**
   * Reject review (admin)
   * Note: Requires 'status' field in Review model to work
   */
  static rejectReview = async (reviewId) => {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // If you add status field to model, uncomment this:
    // review.status = 'rejected';
    // await review.save();

    return review;
  };
}

module.exports = ReviewService;
