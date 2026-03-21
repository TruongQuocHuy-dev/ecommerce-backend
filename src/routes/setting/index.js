const express = require('express');
const router = express.Router();
const settingController = require('../../controllers/setting.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');
const upload = require('../../middlewares/upload');

// ===== PUBLIC ROUTES =====

// Get public setting by key (e.g., /settings/general, /settings/shipping)
router.get('/public/:key', settingController.getSetting);

// Get all banners (public endpoint for storefront)
router.get('/banners', settingController.getBanners);

// ===== ADMIN ROUTES =====
// All routes below require admin authentication

// Get all settings
router.get('/', authenticate, authorize('admin'), settingController.getAllSettings);

// Get any setting by key (admin can access private settings too)
router.get('/:key', authenticate, authorize('admin'), settingController.getSetting);

// Initialize default settings
router.post('/init', authenticate, authorize('admin'), settingController.initDefaults);

// Update general settings
router.put('/general', authenticate, authorize('admin'), settingController.updateGeneral);

// Update shipping settings
router.put('/shipping', authenticate, authorize('admin'), settingController.updateShipping);

// Banner management (Admin)
router.post('/banners', authenticate, authorize('admin'), upload.single('image'), settingController.addBanner);
router.put('/banners/reorder', authenticate, authorize('admin'), settingController.reorderBanners);
router.put('/banners/:bannerId', authenticate, authorize('admin'), upload.single('image'), settingController.updateBanner);
router.delete('/banners/:bannerId', authenticate, authorize('admin'), settingController.deleteBanner);

module.exports = router;
