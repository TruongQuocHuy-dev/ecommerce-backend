const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/analytics.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

// All routes require authentication
router.use(authenticate);

// Seller routes (accessible by sellers and admins)
router.get('/seller/overview', authorize('seller', 'admin'), analyticsController.getSellerOverview);
router.get('/seller/revenue', authorize('seller', 'admin'), analyticsController.getSellerRevenue);
router.get('/seller/products', authorize('seller', 'admin'), analyticsController.getSellerTopProducts);
router.get('/seller/orders', authorize('seller', 'admin'), analyticsController.getSellerOrderStats);

// Admin routes (require admin role)
router.use(authorize('admin'));

router.get('/overview', analyticsController.getOverview);
router.get('/revenue', analyticsController.getRevenue);
router.get('/products', analyticsController.getTopProducts);
router.get('/orders', analyticsController.getOrderStats);
router.get('/users', analyticsController.getUserAnalytics);

module.exports = router;
