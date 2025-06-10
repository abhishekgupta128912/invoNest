import { Request, Response } from 'express';
import { Notification, NotificationPreference } from '../models/Notification';
import emailService from '../services/emailService';

// Get user's notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 20, type, status } = req.query;

    // Build filter
    let filter: any = { userId };
    if (type && type !== 'all') {
      filter.type = type;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .populate('relatedEntity.id', 'title invoiceNumber');

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// Mark notification as read
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.status = 'read';
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    await Notification.updateMany(
      { userId, status: { $ne: 'read' } },
      { 
        status: 'read',
        readAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

// Get notification preferences
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    let preferences = await NotificationPreference.findOne({ userId });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = new NotificationPreference({
        userId,
        emailNotifications: true,
        complianceReminders: true,
        invoiceReminders: true,
        systemUpdates: true,
        marketingEmails: false,
        reminderTiming: {
          days: [7, 3, 1],
          timeOfDay: '09:00',
          timezone: 'Asia/Kolkata'
        },
        maxDailyEmails: 5,
        digestMode: false
      });
      await preferences.save();
    }

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences'
    });
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const updateData = req.body;

    let preferences = await NotificationPreference.findOne({ userId });

    if (!preferences) {
      preferences = new NotificationPreference({ userId, ...updateData });
    } else {
      Object.assign(preferences, updateData);
    }

    await preferences.save();

    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: preferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences'
    });
  }
};

// Create a new notification
export const createNotification = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      title,
      message,
      type,
      priority,
      relatedEntity,
      channels,
      scheduledFor
    } = req.body;

    const notification = new Notification({
      userId,
      title,
      message,
      type,
      priority: priority || 'medium',
      relatedEntity,
      channels: {
        email: channels?.email || false,
        inApp: channels?.inApp !== false, // Default to true
        push: channels?.push || false
      },
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
    });

    await notification.save();

    // Send immediately if not scheduled
    if (!scheduledFor) {
      await processNotification(notification);
    }

    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
};

// Get unread notification count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    const count = await Notification.countDocuments({
      userId,
      status: { $ne: 'read' }
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// Helper function to process notification delivery
async function processNotification(notification: any): Promise<void> {
  try {
    // Get user preferences
    const preferences = await NotificationPreference.findOne({ 
      userId: notification.userId 
    });

    // Send email if enabled
    if (notification.channels.email && preferences?.emailNotifications) {
      const emailAddress = preferences.emailAddress || notification.userId.email;
      
      if (notification.emailDetails) {
        const success = await emailService.sendEmail(
          emailAddress,
          notification.emailDetails.subject,
          notification.emailDetails.htmlContent,
          notification.emailDetails.textContent
        );

        if (success) {
          notification.status = 'sent';
          notification.sentAt = new Date();
        } else {
          notification.status = 'failed';
          notification.errorMessage = 'Email delivery failed';
        }
      }
    }

    // Update in-app notification status
    if (notification.channels.inApp) {
      notification.status = notification.status === 'failed' ? 'failed' : 'delivered';
      notification.deliveredAt = new Date();
    }

    await notification.save();
  } catch (error) {
    console.error('Error processing notification:', error);
    notification.status = 'failed';
    notification.errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await notification.save();
  }
}
