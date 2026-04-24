const express = require('express');
const { body } = require('express-validator');
const brandController = require('../../controllers/brand.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

router.get('/', brandController.getBrands);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Brand name is required').isLength({ max: 120 }).withMessage('Brand name cannot exceed 120 characters'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('website').optional().isLength({ max: 300 }).withMessage('Website cannot exceed 300 characters'),
    body('country').optional().isLength({ max: 120 }).withMessage('Country cannot exceed 120 characters'),
  ],
  brandController.createBrand
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty().withMessage('Brand name cannot be empty').isLength({ max: 120 }).withMessage('Brand name cannot exceed 120 characters'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('website').optional().isLength({ max: 300 }).withMessage('Website cannot exceed 300 characters'),
    body('country').optional().isLength({ max: 120 }).withMessage('Country cannot exceed 120 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  brandController.updateBrand
);

router.delete('/:id', authenticate, authorize('admin'), brandController.deleteBrand);

module.exports = router;
