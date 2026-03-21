const { validationResult } = require('express-validator');
const ProductApprovalService = require('../services/productApproval.service');
const { OK } = require('../utils/success.response');

/**
 * Product Approval Controller - HTTP Handlers for approval workflow
 */

class ProductApprovalController {
    /**
     * GET /api/v1/products/pending
     * Get pending products (Admin only)
     */
    getPendingProducts = async (req, res, next) => {
        try {
            const filters = {
                seller: req.query.seller,
                category: req.query.category,
                search: req.query.search,
            };

            const options = {
                page: req.query.page,
                limit: req.query.limit,
            };

            const result = await ProductApprovalService.getPendingProducts(filters, options);

            new OK({
                message: 'Pending products retrieved successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/products/:id/approve
     * Approve a product (Admin only)
     */
    approveProduct = async (req, res, next) => {
        try {
            const adminId = req.user.userId;
            const result = await ProductApprovalService.approveProduct(req.params.id, adminId);

            new OK({
                message: 'Product approved successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/products/:id/reject
     * Reject a product (Admin only)
     */
    rejectProduct = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const adminId = req.user.userId;
            const { reason } = req.body;

            const result = await ProductApprovalService.rejectProduct(
                req.params.id,
                adminId,
                reason
            );

            new OK({
                message: 'Product rejected successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/products/bulk-approve
     * Bulk approve products (Admin only)
     */
    bulkApproveProducts = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const adminId = req.user.userId;
            const { productIds } = req.body;

            const result = await ProductApprovalService.bulkApproveProducts(productIds, adminId);

            new OK({
                message: result.message,
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/products/bulk-reject
     * Bulk reject products (Admin only)
     */
    bulkRejectProducts = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const adminId = req.user.userId;
            const { productIds, reason } = req.body;

            const result = await ProductApprovalService.bulkRejectProducts(
                productIds,
                adminId,
                reason
            );

            new OK({
                message: result.message,
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/products/out-of-stock
     * Get out of stock products
     */
    getOutOfStockProducts = async (req, res, next) => {
        try {
            const filters = {
                seller: req.query.seller,
                category: req.query.category,
            };

            const options = {
                page: req.query.page,
                limit: req.query.limit,
            };

            const result = await ProductApprovalService.getOutOfStockProducts(filters, options);

            new OK({
                message: 'Out of stock products retrieved successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/products/low-stock
     * Get low stock products
     */
    getLowStockProducts = async (req, res, next) => {
        try {
            const threshold = req.query.threshold || 10;
            const filters = {
                seller: req.query.seller,
                category: req.query.category,
            };

            const options = {
                page: req.query.page,
                limit: req.query.limit,
            };

            const result = await ProductApprovalService.getLowStockProducts(
                threshold,
                filters,
                options
            );

            new OK({
                message: 'Low stock products retrieved successfully',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new ProductApprovalController();
