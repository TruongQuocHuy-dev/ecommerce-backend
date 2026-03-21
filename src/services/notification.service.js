const Notification = require('../models/notification.model');

class NotificationService {
    /**
     * Create a notification
     */
    async createNotification(data) {
        try {
            const notification = await Notification.create(data);
            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }

    /**
     * Create notification for multiple users
     */
    async createBulkNotifications(userIds, notificationData) {
        try {
            const notifications = userIds.map((userId) => ({
                ...notificationData,
                userId,
            }));
            await Notification.insertMany(notifications);
            return true;
        } catch (error) {
            console.error('Error creating bulk notifications:', error);
            return false;
        }
    }

    /**
     * Get notifications for a user
     */
    async getUserNotifications(userId, filters = {}) {
        const { isRead, type, page = 1, limit = 20 } = filters;
        const query = { userId };

        if (isRead !== undefined) query.isRead = isRead === 'true';
        if (type) query.type = type;

        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Notification.countDocuments(query),
            Notification.countDocuments({ userId, isRead: false }),
        ]);

        return {
            notifications,
            total,
            unreadCount,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
        };
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        );
        return notification;
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        await Notification.updateMany(
            { userId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
        return true;
    }

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId, userId) {
        await Notification.findOneAndDelete({ _id: notificationId, userId });
        return true;
    }

    /**
     * Delete all read notifications for a user
     */
    async deleteAllRead(userId) {
        const result = await Notification.deleteMany({ userId, isRead: true });
        return { deletedCount: result.deletedCount };
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId) {
        const count = await Notification.countDocuments({ userId, isRead: false });
        return count;
    }

    // ===== NOTIFICATION CREATORS =====

    /**
     * Notify seller when a new order is placed for their products
     */
    async notifyNewOrderToSeller(sellerId, orderId, orderNumber, totalAmount, itemCount) {
        await this.createNotification({
            userId: sellerId,
            type: 'NEW_ORDER',
            title: '📦 Đơn hàng mới!',
            message: `Đơn hàng #${orderNumber} vừa được đặt – ${itemCount} sản phẩm – Tổng $${totalAmount.toFixed(2)}. Vui lòng xác nhận và xử lý.`,
            link: `/orders/${orderId}`,
            data: { orderId, totalAmount, itemCount },
        });
    }

    /**
     * Notify admins about new order
     */
    async notifyNewOrder(orderId, orderData) {
        const admins = await this._getAdminUserIds();
        await this.createBulkNotifications(admins, {
            type: 'NEW_ORDER',
            title: 'Đơn hàng mới',
            message: `Đơn hàng #${orderId.slice(-6)} vừa được tạo`,
            link: `/orders/${orderId}`,
            data: { orderId, totalAmount: orderData.totalAmount },
        });
    }

    /**
     * Notify about low stock
     */
    async notifyLowStock(productId, productName, stock) {
        const admins = await this._getAdminUserIds();
        await this.createBulkNotifications(admins, {
            type: 'LOW_STOCK',
            title: 'Sản phẩm sắp hết hàng',
            message: `${productName} chỉ còn ${stock} sản phẩm`,
            link: `/products/${productId}`,
            data: { productId, stock },
        });
    }

    /**
     * Notify about pending approval
     */
    async notifyPendingApproval(entityType, entityId, entityName) {
        const admins = await this._getAdminUserIds();
        const link = entityType === 'Product' ? `/products/pending` : `/${entityType.toLowerCase()}s/${entityId}`;

        await this.createBulkNotifications(admins, {
            type: 'PENDING_APPROVAL',
            title: `${entityType} chờ duyệt`,
            message: `${entityName} đang chờ phê duyệt`,
            link,
            data: { entityType, entityId },
        });
    }

    /**
     * Notify seller about product approval/rejection
     */
    async notifyProductApprovalResult(sellerId, productId, productName, isApproved, rejectionReason = '') {
        const title = isApproved ? 'Sản phẩm đã được duyệt' : 'Sản phẩm bị từ chối';
        const message = isApproved
            ? `Sản phẩm "${productName}" của bạn đã được Admin phê duyệt và hiện đang hiển thị trên sàn.`
            : `Sản phẩm "${productName}" của bạn đã bị từ chối. Lý do: ${rejectionReason}`;

        await this.createNotification({
            userId: sellerId,
            type: 'APPROVAL_RESULT',
            title,
            message,
            link: isApproved ? `/products/${productId}` : `/seller/products/edit/${productId}`, // Assuming seller has a dashboard to edit
            data: { productId, isApproved, rejectionReason },
        });
    }

    /**
     * Get all admin user IDs
     */
    async _getAdminUserIds() {
        const User = require('../models/user.model');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        return admins.map((admin) => admin._id);
    }
}

module.exports = new NotificationService();
