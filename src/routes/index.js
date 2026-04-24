const express = require('express');
const { body } = require('express-validator');
const accessRoutes = require('./access');
const userRoutes = require('./user');
const productRoutes = require('./product');
const categoryRoutes = require('./category');
const cartRoutes = require('./cart');
const orderRoutes = require('./order');
const addressRoutes = require('./address');
const discountRoutes = require('./discount');
const shopRoutes = require('./shop');
const reviewController = require('../controllers/review.controller');
const discountController = require('../controllers/discount.controller');
const analyticsRoutes = require('./analytics');
const inventoryRoutes = require('./inventory');
const brandRoutes = require('./brand');
const supplierRoutes = require('./supplier');
const { auditLogger } = require('../middlewares/auditLog.middleware');
const { authenticate, authorize, optionalAuthenticate } = require('../middlewares/authUtils');

const router = express.Router();

// Attach req.user when token exists (so auditLogger can work globally)
router.use(optionalAuthenticate);

// Enable audit logging for state-changing requests
router.use(auditLogger());

/**
 * Root API Router
 * Aggregates all route modules
 */

// Authentication routes
router.use('/auth', accessRoutes);

// User routes (Admin)
router.use('/users', userRoutes);

// Product routes (includes nested review routes)
router.use('/products', productRoutes);

// Category routes
router.use('/categories', categoryRoutes);

// Cart routes
router.use('/cart', cartRoutes);

// Order routes
router.use('/orders', orderRoutes);

// Address routes
router.use('/addresses', addressRoutes);

// Discount routes (Admin)
router.use('/discounts', discountRoutes);

// Review management routes (Admin)
router.get('/reviews/admin', authenticate, authorize('admin'), reviewController.getAllReviewsForAdmin);
router.patch('/reviews/:id/approve', authenticate, authorize('admin'), reviewController.approveReview);
router.patch('/reviews/:id/reject', authenticate, authorize('admin'), reviewController.rejectReview);

// Shop routes (Admin/Seller)
router.use('/shops', shopRoutes);

// Analytics routes (Admin)
router.use('/analytics', analyticsRoutes);

// Inventory routes (Admin)
router.use('/inventory', inventoryRoutes);

// Brand routes
router.use('/brands', brandRoutes);

// Supplier routes
router.use('/suppliers', supplierRoutes);

// Settings routes
const settingRoutes = require('./setting');
router.use('/settings', settingRoutes);

// Profile routes
const profileRoutes = require('./profile');
router.use('/profile', profileRoutes);

// Audit log routes (Admin only)
const auditLogRoutes = require('./auditLog');
router.use('/audit-logs', auditLogRoutes);

// Notification routes (Authenticated users)
const notificationRoutes = require('./notification');
router.use('/notifications', notificationRoutes);

// Payment routes (MoMo & VNPay)
const paymentRoutes = require('./payment');
router.use('/payments', paymentRoutes);

// Cart discount endpoints (User)
router.post(
  '/cart/apply-discount',
  authenticate,
  [body('code').notEmpty().withMessage('Discount code is required')],
  discountController.applyToCart
);

router.delete(
  '/cart/remove-discount',
  authenticate,
  discountController.removeFromCart
);

// Standalone review routes (not nested under product)
router.put(
  '/reviews/:id',
  authenticate,
  [
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Title cannot exceed 100 characters'),
    body('comment')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Comment cannot exceed 1000 characters'),
  ],
  reviewController.updateReview
);

router.delete('/reviews/:id', authenticate, reviewController.deleteReview);

router.post('/reviews/:id/helpful', authenticate, reviewController.addHelpfulVote);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
