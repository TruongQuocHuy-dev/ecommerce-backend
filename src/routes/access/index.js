const express = require('express');
const { body } = require('express-validator');
const accessController = require('../../controllers/access.controller');
const { authenticate } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Authentication Routes
 */

// Register new user
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 50 })
      .withMessage('Name cannot exceed 50 characters'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  accessController.register
);

// Login
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  accessController.login
);

// Get current user (Me)
router.get('/me', authenticate, accessController.getMe);

// Logout (requires authentication)
router.post('/logout', authenticate, accessController.logout);

// Refresh token
router.post('/refresh-token', accessController.refreshToken);

// Verify email
router.get('/verify-email/:token', accessController.verifyEmail);

// Forgot password
router.post(
  '/forgot-password',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
  ],
  accessController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  accessController.resetPassword
);

module.exports = router;
