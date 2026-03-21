const express = require('express');
const userController = require('../../controllers/user.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * User Routes
 */

// Admin only routes
router.use(authenticate, authorize('admin'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.put('/:id/block', userController.toggleBlockUser);

module.exports = router;
