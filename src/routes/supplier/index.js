const express = require('express');
const { body } = require('express-validator');
const supplierController = require('../../controllers/supplier.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

router.get('/', supplierController.getSuppliers);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Supplier name is required').isLength({ max: 150 }).withMessage('Supplier name cannot exceed 150 characters'),
    body('contactName').optional().isLength({ max: 150 }).withMessage('Contact name cannot exceed 150 characters'),
    body('email').optional().isEmail().withMessage('Email is invalid'),
    body('phone').optional().isLength({ max: 50 }).withMessage('Phone cannot exceed 50 characters'),
    body('address').optional().isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
  ],
  supplierController.createSupplier
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty().withMessage('Supplier name cannot be empty').isLength({ max: 150 }).withMessage('Supplier name cannot exceed 150 characters'),
    body('contactName').optional().isLength({ max: 150 }).withMessage('Contact name cannot exceed 150 characters'),
    body('email').optional().isEmail().withMessage('Email is invalid'),
    body('phone').optional().isLength({ max: 50 }).withMessage('Phone cannot exceed 50 characters'),
    body('address').optional().isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  supplierController.updateSupplier
);

router.delete('/:id', authenticate, authorize('admin'), supplierController.deleteSupplier);

module.exports = router;
