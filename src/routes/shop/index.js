const express = require('express');
const router = express.Router();
const shopController = require('../../controllers/shop.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');
const upload = require('../../middlewares/upload');

// Public routes (must be before /:id)
router.get('/public', shopController.getPublicShops);

// All routes below require authentication
router.use(authenticate);

// Request to become a seller
router.post(
    '/register',
    upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]),
    shopController.registerShop
);

// Get current user's shop
router.get('/my-shop', shopController.getMyShop);

// Stats route (must be before /:id routes)
router.get('/stats', authorize('admin'), shopController.getShopStats);

// Main CRUD routes
router
    .route('/')
    .get(authorize('admin'), shopController.getShops)
    .post(authorize('seller', 'admin'), shopController.createShop);

router
    .route('/:id')
    .get(authorize('admin', 'seller'), shopController.getShop)
    .patch(
        authorize('admin', 'seller'),
        upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]),
        shopController.updateShop
    )
    .delete(authorize('admin'), shopController.deleteShop);

// Admin approval routes
router.patch(
    '/:id/approve',
    authorize('admin'),
    shopController.approveShop
);

router.patch(
    '/:id/reject',
    authorize('admin'),
    shopController.rejectShop
);

router.patch(
    '/:id/suspend',
    authorize('admin'),
    shopController.suspendShop
);

router.patch(
    '/:id/reactivate',
    authorize('admin'),
    shopController.reactivateShop
);

// Revenue route
router.get(
    '/:id/revenue',
    authorize('admin', 'seller'),
    shopController.getShopRevenue
);

module.exports = router;
