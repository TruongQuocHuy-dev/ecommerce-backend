const express = require('express');
const { body } = require('express-validator');
const inventoryController = require('../../controllers/inventory.controller');
const { authenticate, authorize } = require('../../middlewares/authUtils');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/overview', inventoryController.getOverview);
router.get('/warehouses', inventoryController.listWarehouses);
router.post(
    '/warehouses',
    [
        body('name').trim().notEmpty().withMessage('Warehouse name is required'),
        body('code').trim().notEmpty().withMessage('Warehouse code is required'),
    ],
    inventoryController.createWarehouse
);
router.put(
    '/warehouses/:id',
    [
        body('name').optional().trim().notEmpty().withMessage('Warehouse name cannot be empty'),
        body('code').optional().trim().notEmpty().withMessage('Warehouse code cannot be empty'),
    ],
    inventoryController.updateWarehouse
);
router.get('/movements', inventoryController.getMovements);
router.post(
    '/movements',
    [
        body('productId').isMongoId().withMessage('Product ID is required'),
        body('movementType').notEmpty().withMessage('Movement type is required'),
        body('quantity').notEmpty().withMessage('Quantity is required'),
        body('reason').trim().notEmpty().withMessage('Reason is required'),
    ],
    inventoryController.createMovement
);

module.exports = router;