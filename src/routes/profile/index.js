const express = require('express');
const profileController = require('../../controllers/profile.controller');
const { authenticate } = require('../../middlewares/authUtils');
const { body } = require('express-validator');
const upload = require('../../middlewares/upload');

const router = express.Router();

/**
 * Profile Routes
 * All routes require authentication
 */
router.use(authenticate);

// Profile Management
router.get('/', profileController.getProfile);

router.put(
    '/',
    [
        body('name')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Name cannot exceed 50 characters'),
    ],
    profileController.updateProfile
);

router.post(
    '/avatar',
    upload.single('avatar'),
    profileController.uploadAvatar
);

// Favorites Management
router.get('/favorites', profileController.getFavorites);

router.post(
    '/favorites',
    [
        body('productId').notEmpty().withMessage('Product ID is required')
    ],
    profileController.addFavorite
);

router.delete('/favorites/:productId', profileController.removeFavorite);

module.exports = router;
