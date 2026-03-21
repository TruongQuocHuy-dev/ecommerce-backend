const express = require('express');
const { body } = require('express-validator');
const productController = require('../../controllers/product.controller');
const approvalController = require('../../controllers/productApproval.controller');
const reviewController = require('../../controllers/review.controller');
const { authenticate, authorize, optionalAuthenticate } = require('../../middlewares/authUtils');
const upload = require('../../middlewares/upload');
const reviewRoutes = require('../review');

const router = express.Router();

/**
 * Product Routes
 */

// Approval routes (MUST be before /:id to avoid conflicts)
// Admin only
router.get(
  '/pending',
  authenticate,
  authorize('admin'),
  approvalController.getPendingProducts
);

router.post(
  '/bulk-approve',
  authenticate,
  authorize('admin'),
  [body('productIds').isArray().withMessage('Product IDs must be an array')],
  approvalController.bulkApproveProducts
);

router.post(
  '/bulk-reject',
  authenticate,
  authorize('admin'),
  [
    body('productIds').isArray().withMessage('Product IDs must be an array'),
    body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
  ],
  approvalController.bulkRejectProducts
);

// Consolidated stock management route (MUST be before /:id)
router.get(
  '/stock',
  authenticate,
  authorize('admin', 'seller'),
  async (req, res) => {
    const { type, limit } = req.query;
    try {
      let data;
      if (type === 'low') {
        data = await require('../../controllers/productApproval.controller').getLowStockProducts(req, res);
      } else if (type === 'out') {
        data = await require('../../controllers/productApproval.controller').getOutOfStockProducts(req, res);
      } else {
        // Return both if no type specified
        const Product = require('../../models/product.model');
        const products = await Product.find({
          $or: [{ stock: { $lte: 10 } }, { stock: 0 }]
        }).limit(parseInt(limit) || 20).lean();
        return res.json({ success: true, data: { products } });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Stock management routes (legacy - for backwards compatibility)
router.get(
  '/out-of-stock',
  authenticate,
  authorize('admin', 'seller'),
  approvalController.getOutOfStockProducts
);

router.get(
  '/low-stock',
  authenticate,
  authorize('admin', 'seller'),
  approvalController.getLowStockProducts
);

router.post(
  '/:id/approve',
  authenticate,
  authorize('admin'),
  approvalController.approveProduct
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('admin'),
  [body('reason').trim().notEmpty().withMessage('Rejection reason is required')],
  approvalController.rejectProduct
);

// Public routes
router.get('/', optionalAuthenticate, productController.getProducts);
router.get('/:id', optionalAuthenticate, productController.getProduct);

// Rating distribution (public)
router.get('/:productId/rating-distribution', reviewController.getRatingDistribution);

// Nested review routes
router.use('/:productId/reviews', reviewRoutes);

// Protected routes (seller/admin only)
router.post(
  '/',
  authenticate,
  authorize('seller', 'admin'),
  upload.any(), // Allow multiple file fields including skuImages_*
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Product name is required')
      .isLength({ max: 200 })
      .withMessage('Product name cannot exceed 200 characters'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Product description is required')
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
    body('price')
      .notEmpty()
      .withMessage('Price is required')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('originalPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Original price must be a positive number'),
    body('stock')
      .notEmpty()
      .withMessage('Stock is required')
      .isInt({ min: 0 })
      .withMessage('Stock must be a non-negative integer'),
    body('category')
      .notEmpty()
      .withMessage('Category is required')
      .isMongoId()
      .withMessage('Category must be a valid ID'),
  ],
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  upload.any(), // Allow multiple file fields including skuImages_*
  [
    body('name')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Product name cannot exceed 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('originalPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Original price must be a positive number'),
    body('stock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Stock must be a non-negative integer'),
    body('category')
      .optional()
      .isMongoId()
      .withMessage('Category must be a valid ID'),
  ],
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  productController.deleteProduct
);

module.exports = router;
