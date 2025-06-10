import { Request, Response, NextFunction } from 'express';

export const validateComplianceCreation = (req: Request, res: Response, next: NextFunction) => {
  const { title, description, dueDate, frequency } = req.body;

  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title is required and must be a non-empty string'
    });
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Description is required and must be a non-empty string'
    });
  }

  if (!dueDate) {
    return res.status(400).json({
      success: false,
      message: 'Due date is required'
    });
  }

  // Validate due date
  const dueDateObj = new Date(dueDate);
  if (isNaN(dueDateObj.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid due date format'
    });
  }

  // Validate frequency
  const validFrequencies = ['monthly', 'quarterly', 'annually', 'one_time'];
  if (!frequency || !validFrequencies.includes(frequency)) {
    return res.status(400).json({
      success: false,
      message: 'Frequency must be one of: monthly, quarterly, annually, one_time'
    });
  }

  // Validate title length
  if (title.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Title cannot exceed 200 characters'
    });
  }

  // Validate description length
  if (description.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Description cannot exceed 1000 characters'
    });
  }

  // Validate priority if provided
  if (req.body.priority) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(req.body.priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high, critical'
      });
    }
  }

  // Validate reminder days if provided
  if (req.body.reminderDays) {
    if (!Array.isArray(req.body.reminderDays)) {
      return res.status(400).json({
        success: false,
        message: 'Reminder days must be an array'
      });
    }

    for (const day of req.body.reminderDays) {
      if (typeof day !== 'number' || day < 0 || day > 365) {
        return res.status(400).json({
          success: false,
          message: 'Reminder days must be numbers between 0 and 365'
        });
      }
    }
  }

  next();
};

export const validateComplianceUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { isEnabled, customDueDate, reminderDays } = req.body;

  // Validate isEnabled if provided
  if (isEnabled !== undefined && typeof isEnabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isEnabled must be a boolean'
    });
  }

  // Validate custom due date if provided
  if (customDueDate) {
    const dueDateObj = new Date(customDueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid custom due date format'
      });
    }
  }

  // Validate reminder days if provided
  if (reminderDays) {
    if (!Array.isArray(reminderDays)) {
      return res.status(400).json({
        success: false,
        message: 'Reminder days must be an array'
      });
    }

    for (const day of reminderDays) {
      if (typeof day !== 'number' || day < 0 || day > 365) {
        return res.status(400).json({
          success: false,
          message: 'Reminder days must be numbers between 0 and 365'
        });
      }
    }
  }

  next();
};
