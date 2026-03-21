const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../../controllers/category.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Category Routes
 */

// Public routes
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);

const upload = require('../../middlewares/upload');

// Admin-only routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Category name is required')
      .isLength({ max: 50 })
      .withMessage('Category name cannot exceed 50 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('parent')
      .optional()
      .custom((value) => {
        if (!value) return true; // Allow empty
        if (value === 'null' || value === 'undefined' || value === '') return true;
        if (/^[0-9a-fA-F]{24}$/.test(value)) return true;
        throw new Error('Parent must be a valid category ID');
      }),
  ],
  categoryController.createCategory
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  [
    body('name')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Category name cannot exceed 50 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('parent')
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (value === 'null' || value === 'undefined' || value === '') return true;
        if (/^[0-9a-fA-F]{24}$/.test(value)) return true;
        throw new Error('Parent must be a valid category ID');
      }),
  ],
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryController.deleteCategory
);

module.exports = router;
