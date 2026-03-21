const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        userRole: {
            type: String,
            enum: ['admin', 'seller', 'user'],
            index: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                'CREATE',
                'UPDATE',
                'DELETE',
                'LOGIN',
                'LOGOUT',
                'APPROVE',
                'REJECT',
                'SUSPEND',
                'ACTIVATE',
                'EXPORT',
                'VIEW',
                'REGISTER',
                'PASSWORD_CHANGE',
                'PROFILE_UPDATE',
                'LOGIN_FAILED',
            ],
            index: true,
        },
        entity: {
            type: String,
            required: true,
            enum: [
                'User',
                'Product',
                'Order',
                'Category',
                'Discount',
                'Shop',
                'Review',
                'Setting',
                'Banner',
                'Voucher',
                'FlashSale',
                'Report',
                'Transaction',
                'AuditLog',
            ],
            index: true,
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            index: true,
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            index: true,
        },
        changes: {
            before: mongoose.Schema.Types.Mixed,
            after: mongoose.Schema.Types.Mixed,
        },
        ipAddress: {
            type: String,
        },
        userAgent: {
            type: String,
        },
        status: {
            type: String,
            enum: ['success', 'failed'],
            default: 'success',
            index: true,
        },
        errorMessage: {
            type: String,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ userRole: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ shopId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
