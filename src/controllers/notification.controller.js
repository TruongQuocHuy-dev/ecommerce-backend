const NotificationService = require('../services/notification.service');

class NotificationController {
    // @desc    Get user's notifications
    // @route   GET /api/v1/notifications
    // @access  Private
    async getNotifications(req, res) {
        try {
            const result = await NotificationService.getUserNotifications(
                req.user.userId,
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

    // @desc    Get unread count
    // @route   GET /api/v1/notifications/unread-count
    // @access  Private
    async getUnreadCount(req, res) {
        try {
            const count = await NotificationService.getUnreadCount(req.user.userId);
            res.status(200).json({
                success: true,
                data: { count },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Mark notification as read
    // @route   PATCH /api/v1/notifications/:id/read
    // @access  Private
    async markAsRead(req, res) {
        try {
            const notification = await NotificationService.markAsRead(
                req.params.id,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                data: notification,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Mark all as read
    // @route   PATCH /api/v1/notifications/mark-all-read
    // @access  Private
    async markAllAsRead(req, res) {
        try {
            await NotificationService.markAllAsRead(req.user.userId);
            res.status(200).json({
                success: true,
                message: 'All notifications marked as read',
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Delete notification
    // @route   DELETE /api/v1/notifications/:id
    // @access  Private
    async deleteNotification(req, res) {
        try {
            await NotificationService.deleteNotification(
                req.params.id,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'Notification deleted',
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Delete all read notifications
    // @route   DELETE /api/v1/notifications/read
    // @access  Private
    async deleteAllRead(req, res) {
        try {
            const result = await NotificationService.deleteAllRead(req.user.userId);
            res.status(200).json({
                success: true,
                ...result,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
}

module.exports = new NotificationController();
