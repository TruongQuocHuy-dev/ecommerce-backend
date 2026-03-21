const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../../controllers/review.controller');
const { authenticate } = require('../../middlewares/authUtils');

const router = express.Router({ mergeParams: true }); // For nested routes (productId from parent)

/**
 * Review Routes
 * Nested under /api/v1/products/:productId/reviews
 */

// Public routes
router.get('/', reviewController.getProductReviews);

// Protected routes (require authentication)
router.post(
  '/',
  authenticate,
  [
    body('rating')
      .notEmpty()
      .withMessage('Rating is required')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 100 })
      .withMessage('Title cannot exceed 100 characters'),
    body('comment')
      .trim()
      .notEmpty()
      .withMessage('Comment is required')
      .isLength({ max: 1000 })
      .withMessage('Comment cannot exceed 1000 characters'),
  ],
  reviewController.createReview
);

// Note: Update and delete routes are not nested under product
// They will be registered in routes/index.js as /reviews/:id

module.exports = router;
