import express from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  createNotification,
  getUnreadCount,
  deleteNotification
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { validateNotificationCreation, validateNotificationPreferences } from '../middleware/notificationValidation';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', getNotifications);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Mark notification as read
router.patch('/:notificationId/read', markNotificationRead);

// Mark all notifications as read
router.patch('/mark-all-read', markAllNotificationsRead);

// Delete notification
router.delete('/:notificationId', deleteNotification);

// Create notification (admin/system use)
router.post('/', validateNotificationCreation, createNotification);

// Notification preferences
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', validateNotificationPreferences, updateNotificationPreferences);

export default router;
