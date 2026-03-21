const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/analytics.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

// All routes require admin access
router.use(authenticate);
router.use(authorize('admin'));

router.get('/overview', analyticsController.getOverview);
router.get('/revenue', analyticsController.getRevenue);
router.get('/products', analyticsController.getTopProducts);
router.get('/orders', analyticsController.getOrderStats);
router.get('/users', analyticsController.getUserAnalytics);

module.exports = router;
