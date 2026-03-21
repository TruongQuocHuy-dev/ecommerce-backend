const express = require('express');
const { body } = require('express-validator');
const addressController = require('../../controllers/address.controller');
const { authenticate } = require('../../middlewares/authUtils');

const router = express.Router();

/**
 * Address Routes
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authenticate);

// GET /api/v1/addresses/default (must be before /:id route)
router.get('/default', addressController.getDefaultAddress);

// POST /api/v1/addresses
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Recipient name is required'),
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
    body('address')
      .trim()
      .notEmpty()
      .withMessage('Street address is required'),
    body('city')
      .trim()
      .notEmpty()
      .withMessage('City is required'),
    body('province')
      .optional()
      .trim(),
    body('postalCode')
      .optional()
      .trim(),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
  ],
  addressController.createAddress
);

// GET /api/v1/addresses
router.get('/', addressController.getUserAddresses);

// GET /api/v1/addresses/:id
router.get('/:id', addressController.getAddress);

// PUT /api/v1/addresses/:id
router.put(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('phone')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Phone cannot be empty'),
    body('address')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Address cannot be empty'),
    body('city')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('City cannot be empty'),
    body('province')
      .optional()
      .trim(),
    body('postalCode')
      .optional()
      .trim(),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
  ],
  addressController.updateAddress
);

// DELETE /api/v1/addresses/:id
router.delete('/:id', addressController.deleteAddress);

// PUT /api/v1/addresses/:id/set-default
router.put('/:id/set-default', addressController.setAsDefault);

module.exports = router;
