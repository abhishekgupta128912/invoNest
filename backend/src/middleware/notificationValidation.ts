import { Request, Response, NextFunction } from 'express';

export const validateNotificationCreation = (req: Request, res: Response, next: NextFunction) => {
  const { userId, title, message, type } = req.body;

  // Validate required fields
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'User ID is required and must be a string'
    });
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title is required and must be a non-empty string'
    });
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a non-empty string'
    });
  }

  // Validate type
  const validTypes = ['compliance', 'invoice', 'system', 'reminder', 'alert'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Type must be one of: compliance, invoice, system, reminder, alert'
    });
  }

  // Validate title length
  if (title.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Title cannot exceed 200 characters'
    });
  }

  // Validate message length
  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot exceed 1000 characters'
    });
  }

  // Validate priority if provided
  if (req.body.priority) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(req.body.priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high, urgent'
      });
    }
  }

  // Validate channels if provided
  if (req.body.channels) {
    const { email, inApp, push } = req.body.channels;
    
    if (email !== undefined && typeof email !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Email channel must be a boolean'
      });
    }

    if (inApp !== undefined && typeof inApp !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'InApp channel must be a boolean'
      });
    }

    if (push !== undefined && typeof push !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Push channel must be a boolean'
      });
    }
  }

  // Validate scheduled date if provided
  if (req.body.scheduledFor) {
    const scheduledDate = new Date(req.body.scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled date format'
      });
    }

    // Check if scheduled date is in the future
    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date must be in the future'
      });
    }
  }

  // Validate related entity if provided
  if (req.body.relatedEntity) {
    const { type: entityType, id } = req.body.relatedEntity;
    
    const validEntityTypes = ['compliance', 'invoice', 'user'];
    if (!entityType || !validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Related entity type must be one of: compliance, invoice, user'
      });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Related entity ID is required and must be a string'
      });
    }
  }

  next();
};

export const validateNotificationPreferences = (req: Request, res: Response, next: NextFunction) => {
  const {
    emailNotifications,
    emailAddress,
    complianceReminders,
    invoiceReminders,
    systemUpdates,
    marketingEmails,
    reminderTiming,
    maxDailyEmails,
    digestMode
  } = req.body;

  // Validate boolean fields
  const booleanFields = {
    emailNotifications,
    complianceReminders,
    invoiceReminders,
    systemUpdates,
    marketingEmails,
    digestMode
  };

  for (const [field, value] of Object.entries(booleanFields)) {
    if (value !== undefined && typeof value !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: `${field} must be a boolean`
      });
    }
  }

  // Validate email address if provided
  if (emailAddress) {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(emailAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }
  }

  // Validate reminder timing if provided
  if (reminderTiming) {
    const { days, timeOfDay, timezone } = reminderTiming;

    // Validate days array
    if (days) {
      if (!Array.isArray(days)) {
        return res.status(400).json({
          success: false,
          message: 'Reminder days must be an array'
        });
      }

      for (const day of days) {
        if (typeof day !== 'number' || day < 0 || day > 365) {
          return res.status(400).json({
            success: false,
            message: 'Reminder days must be numbers between 0 and 365'
          });
        }
      }
    }

    // Validate time of day
    if (timeOfDay) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(timeOfDay)) {
        return res.status(400).json({
          success: false,
          message: 'Time of day must be in HH:MM format'
        });
      }
    }

    // Validate timezone
    if (timezone && typeof timezone !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Timezone must be a string'
      });
    }
  }

  // Validate max daily emails
  if (maxDailyEmails !== undefined) {
    if (typeof maxDailyEmails !== 'number' || maxDailyEmails < 1 || maxDailyEmails > 20) {
      return res.status(400).json({
        success: false,
        message: 'Max daily emails must be a number between 1 and 20'
      });
    }
  }

  next();
};
