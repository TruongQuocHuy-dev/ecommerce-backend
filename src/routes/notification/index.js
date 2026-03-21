const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notification.controller');
const { authenticate } = require('../../middlewares/authUtils');

// All routes require authentication
router.use(authenticate);

// Get unread count (must be before /:id routes)
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all as read (must be before /:id routes)
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete all read notifications
router.delete('/read', notificationController.deleteAllRead);

// Get all notifications
router.get('/', notificationController.getNotifications);

// Mark specific notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Delete specific notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
