const AuditLog = require('../models/auditLog.model');

class AuditLogService {
    /**
     * Create a new audit log entry
     */
    async createLog(logData) {
        try {
            const log = await AuditLog.create(logData);
            return log;
        } catch (error) {
            console.error('Error creating audit log:', error);
            // Don't throw - audit logs shouldn't break app flow
            return null;
        }
    }

    /**
     * Get audit logs with filters and pagination
     */
    async getLogs(filters = {}) {
        const {
            userId,
            action,
            entity,
            entityId,
            status,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = filters;

        const query = {};

        if (userId) query.userId = userId;
        if (action) query.action = action;
        if (entity) query.entity = entity;
        if (entityId) query.entityId = entityId;
        if (status) query.status = status;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .populate('userId', 'name email role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            AuditLog.countDocuments(query),
        ]);

        return {
            logs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
        };
    }

    /**
     * Get activity history for a specific user
     */
    async getUserActivity(userId, filters = {}) {
        return this.getLogs({ ...filters, userId });
    }

    /**
     * Get history for a specific entity
     */
    async getEntityHistory(entity, entityId, filters = {}) {
        return this.getLogs({ ...filters, entity, entityId });
    }

    /**
     * Get activity history for a specific shop
     */
    async getShopActivity(shopId, filters = {}) {
        return this.getLogs({ ...filters, shopId });
    }

    /**
     * Get statistics
     */
    async getStatistics(filters = {}) {
        const { startDate, endDate } = filters;
        const match = {};

        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) match.createdAt.$lte = new Date(endDate);
        }

        const [actionStats, entityStats, userStats] = await Promise.all([
            AuditLog.aggregate([
                { $match: match },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            AuditLog.aggregate([
                { $match: match },
                { $group: { _id: '$entity', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            AuditLog.aggregate([
                { $match: match },
                { $group: { _id: '$userId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                { $unwind: '$user' },
                {
                    $project: {
                        userId: '$_id',
                        count: 1,
                        name: '$user.name',
                        email: '$user.email',
                    },
                },
            ]),
        ]);

        return {
            byAction: actionStats,
            byEntity: entityStats,
            topUsers: userStats,
        };
    }

    /**
     * Clean up old logs (optional - can be run as a cron job)
     */
    async cleanupOldLogs(retentionDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const result = await AuditLog.deleteMany({
            createdAt: { $lt: cutoffDate },
        });

        return {
            deletedCount: result.deletedCount,
            cutoffDate,
        };
    }
}

module.exports = new AuditLogService();
