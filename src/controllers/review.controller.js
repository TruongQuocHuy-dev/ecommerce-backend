const { validationResult } = require('express-validator');
const ReviewService = require('../services/review.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Review Controller - HTTP Handlers
 */

class ReviewController {
  /**
   * POST /api/v1/products/:productId/reviews
   * Create product review
   */
  createReview = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId } = req.params;
      const userId = req.user.userId;
      const { rating, title, comment } = req.body;

      const result = await ReviewService.createReview(userId, productId, {
        rating,
        title,
        comment,
      });

      new CREATED({
        message: 'Review created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/products/:productId/reviews
   * Get product reviews
   */
  getProductReviews = async (req, res, next) => {
    try {
      const { productId } = req.params;
      const filters = {
        rating: req.query.rating,
        verifiedOnly: req.query.verifiedOnly,
      };
      const options = {
        page: req.query.page,
        limit: req.query.limit,
        sort: req.query.sort,
      };

      const result = await ReviewService.getProductReviews(
        productId,
        filters,
        options
      );

      new OK({
        message: 'Reviews retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/reviews/:id
   * Update review
   */
  updateReview = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const userId = req.user.userId;
      const { rating, title, comment } = req.body;

      const result = await ReviewService.updateReview(id, userId, {
        rating,
        title,
        comment,
      });

      new OK({
        message: 'Review updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/reviews/:id
   * Delete review
   */
  deleteReview = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const result = await ReviewService.deleteReview(id, userId, userRole);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/reviews/:id/helpful
   * Mark review as helpful (toggle)
   */
  addHelpfulVote = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const result = await ReviewService.addHelpfulVote(id, userId);

      new OK({
        message: result.message,
        data: {
          helpfulVotes: result.helpfulVotes,
          voted: result.voted,
        },
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/products/:productId/rating-distribution
   * Get rating distribution
   */
  getRatingDistribution = async (req, res, next) => {
    try {
      const { productId } = req.params;

      const result = await ReviewService.getRatingDistribution(productId);

      new OK({
        message: 'Rating distribution retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/reviews/admin
   * Get all reviews for admin (with filters)
   */
  getAllReviewsForAdmin = async (req, res, next) => {
    try {
      const filters = {
        search: req.query.search,
        rating: req.query.rating,
        status: req.query.status,
      };
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 15,
      };

      const result = await ReviewService.getAllReviewsForAdmin(filters, options);

      new OK({
        message: 'Reviews retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/reviews/:id/approve
   * Approve review (admin only)
   */
  approveReview = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await ReviewService.approveReview(id);

      new OK({
        message: 'Review approved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/reviews/:id/reject
   * Reject review (admin only)
   */
  rejectReview = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await ReviewService.rejectReview(id);

      new OK({
        message: 'Review rejected successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new ReviewController();
