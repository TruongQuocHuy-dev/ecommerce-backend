const AuditLogService = require('../services/auditLog.service');

class AuditLogController {
    // @desc    Get all audit logs
    // @route   GET /api/v1/audit-logs
    // @access  Private/Admin
    async getLogs(req, res) {
        try {
            const result = await AuditLogService.getLogs(req.query);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get user activity
    // @route   GET /api/v1/audit-logs/user/:userId
    // @access  Private/Admin
    async getUserActivity(req, res) {
        try {
            const result = await AuditLogService.getUserActivity(
                req.params.userId,
                req.query
            );
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get my activity (current user)
    // @route   GET /api/v1/audit-logs/me
    // @access  Private (Admin/Seller/User)
    async getMyActivity(req, res) {
        try {
            const userId = req.user.userId;
            const result = await AuditLogService.getUserActivity(userId, req.query);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get shop activity (for seller/admin)
    // @route   GET /api/v1/audit-logs/shop/:shopId
    // @access  Private/Seller/Admin (with ownership check for seller)
    async getShopActivity(req, res) {
        try {
            const { shopId } = req.params;
            const result = await AuditLogService.getShopActivity(shopId, req.query);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get entity history
    // @route   GET /api/v1/audit-logs/entity/:entity/:entityId
    // @access  Private/Admin
    async getEntityHistory(req, res) {
        try {
            const { entity, entityId } = req.params;
            const result = await AuditLogService.getEntityHistory(
                entity,
                entityId,
                req.query
            );
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get audit log statistics
    // @route   GET /api/v1/audit-logs/stats
    // @access  Private/Admin
    async getStatistics(req, res) {
        try {
            const stats = await AuditLogService.getStatistics(req.query);
            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}

module.exports = new AuditLogController();
