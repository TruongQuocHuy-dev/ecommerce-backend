const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                'NEW_ORDER',
                'ORDER_STATUS_CHANGE',
                'LOW_STOCK',
                'OUT_OF_STOCK',
                'PENDING_APPROVAL',
                'APPROVAL_RESULT',
                'NEW_REVIEW',
                'SYSTEM_ALERT',
            ],
            index: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
        },
        link: {
            type: String,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient user notifications query
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// TTL index to auto-delete read notifications after 30 days (optional)
// notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { isRead: true } });

module.exports = mongoose.model('Notification', notificationSchema);
