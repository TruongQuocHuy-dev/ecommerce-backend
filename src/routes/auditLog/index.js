const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/auditLog.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');
const Shop = require('../../models/shop.model');

// All routes require authentication
router.use(authenticate);

// Current user's activity (admin/seller/user)
router.get('/me', auditLogController.getMyActivity);

// Seller/Admin: shop activity (ownership checked)
router.get('/shop/:shopId', async (req, res, next) => {
    try {
        const { shopId } = req.params;

        // Admin can view any shop
        if (req.user.role === 'admin') {
            return auditLogController.getShopActivity(req, res);
        }

        // Seller: verify they own the shop
        const shop = await Shop.findById(shopId).select('owner');
        if (!shop || String(shop.owner) !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view logs for this shop',
            });
        }

        return auditLogController.getShopActivity(req, res);
    } catch (error) {
        next(error);
    }
});

// Admin-only routes
router.use(authorize('admin'));

// Get statistics
router.get('/stats', auditLogController.getStatistics);

// Get all logs
router.get('/', auditLogController.getLogs);

// Get user activity
router.get('/user/:userId', auditLogController.getUserActivity);

// Get entity history
router.get('/entity/:entity/:entityId', auditLogController.getEntityHistory);

module.exports = router;
