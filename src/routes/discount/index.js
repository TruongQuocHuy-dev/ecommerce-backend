const express = require('express');
const { body, param } = require('express-validator');
const discountController = require('../../controllers/discount.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Discount Routes
 * Admin routes for discount management
 */

// All routes require authentication
router.use(authenticate);

// GET /api/v1/discounts/available - Get available discounts for user
// MUST BE BEFORE authorize('admin')
router.get('/available', discountController.getAvailableDiscounts);

// Admin only routes
router.use(authorize('admin'));

// POST /api/v1/discounts - Create discount
router.post(
  '/',
  [
    body('name')
      .notEmpty()
      .withMessage('Discount name is required')
      .trim(),
    body('code')
      .notEmpty()
      .withMessage('Discount code is required')
      .isLength({ min: 3, max: 20 })
      .withMessage('Code must be 3-20 characters'),
    body('type')
      .notEmpty()
      .isIn(['percentage', 'fixed', 'freeship'])
      .withMessage('Type must be percentage, fixed or freeship'),
    body('value')
      .notEmpty()
      .isFloat({ min: 0 })
      .withMessage('Value must be a positive number'),
    body('minOrderValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Min order value must be positive'),
    body('maxDiscount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max discount must be positive'),
    body('startDate')
      .notEmpty()
      .isISO8601()
      .withMessage('Valid start date is required'),
    body('endDate')
      .notEmpty()
      .isISO8601()
      .withMessage('Valid end date is required'),
    body('usageLimit')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Usage limit must be at least 1'),
    body('usagePerUser')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Usage per user must be at least 1'),
    body('applicableCategories')
      .optional()
      .isArray()
      .withMessage('Applicable categories must be an array'),
    body('applicableProducts')
      .optional()
      .isArray()
      .withMessage('Applicable products must be an array'),
  ],
  discountController.createDiscount
);

// GET /api/v1/discounts - Get all discounts
router.get('/', discountController.getAllDiscounts);

// GET /api/v1/discounts/:id - Get discount by ID
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid discount ID')],
  discountController.getDiscountById
);

// PATCH /api/v1/discounts/:id - Update discount
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid discount ID'),
    body('name').optional().trim(),
    body('type')
      .optional()
      .isIn(['percentage', 'fixed', 'freeship'])
      .withMessage('Type must be percentage, fixed or freeship'),
    body('value')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Value must be positive'),
  ],
  discountController.updateDiscount
);

// DELETE /api/v1/discounts/:id - Deactivate discount
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid discount ID')],
  discountController.deactivateDiscount
);

module.exports = router;
