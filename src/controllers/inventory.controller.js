const { validationResult } = require('express-validator');
const InventoryService = require('../services/inventory.service');
const { OK, CREATED } = require('../utils/success.response');

class InventoryController {
    getOverview = async (req, res, next) => {
        try {
            const result = await InventoryService.getOverview({
                search: req.query.search,
                productId: req.query.productId,
                warehouseId: req.query.warehouseId,
                threshold: req.query.threshold,
                page: req.query.page,
                limit: req.query.limit,
            });

            new OK({
                message: 'Inventory overview retrieved successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    listWarehouses = async (req, res, next) => {
        try {
            const result = await InventoryService.listWarehouses();

            new OK({
                message: 'Warehouses retrieved successfully',
                data: { warehouses: result },
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    createWarehouse = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const result = await InventoryService.createWarehouse(req.body);

            new CREATED({
                message: 'Warehouse created successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    updateWarehouse = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const result = await InventoryService.updateWarehouse(req.params.id, req.body);

            new OK({
                message: 'Warehouse updated successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    getMovements = async (req, res, next) => {
        try {
            const result = await InventoryService.getMovements({
                productId: req.query.productId,
                warehouseId: req.query.warehouseId,
                page: req.query.page,
                limit: req.query.limit,
            });

            new OK({
                message: 'Inventory movements retrieved successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    createMovement = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const result = await InventoryService.recordMovement(req.body, req.user.userId);

            new CREATED({
                message: 'Inventory movement recorded successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new InventoryController();