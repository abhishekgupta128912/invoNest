import { Request, Response } from 'express';
import PaymentReminderService from '../services/paymentReminderService';
import User from '../models/User';

const paymentReminderService = PaymentReminderService.getInstance();

/**
 * Get payment reminder settings for the user
 */
export const getReminderSettings = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const settings = user.paymentReminderSettings || {
      enabled: true,
      reminderDays: [7, 3, 1],
      overdueReminderDays: [1, 7, 14],
      maxReminders: 5
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting reminder settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Update payment reminder settings
 */
export const updateReminderSettings = async (req: any, res: Response) => {
  try {
    const { enabled, reminderDays, overdueReminderDays, maxReminders } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    if (!Array.isArray(reminderDays) || !reminderDays.every(day => typeof day === 'number' && day > 0)) {
      return res.status(400).json({ message: 'reminderDays must be an array of positive numbers' });
    }

    if (!Array.isArray(overdueReminderDays) || !overdueReminderDays.every(day => typeof day === 'number' && day > 0)) {
      return res.status(400).json({ message: 'overdueReminderDays must be an array of positive numbers' });
    }

    if (typeof maxReminders !== 'number' || maxReminders < 1 || maxReminders > 10) {
      return res.status(400).json({ message: 'maxReminders must be a number between 1 and 10' });
    }

    const user = await User.findByIdAndUpdate(
      req.user?.userId,
      {
        paymentReminderSettings: {
          enabled,
          reminderDays: reminderDays.sort((a, b) => b - a), // Sort descending
          overdueReminderDays: overdueReminderDays.sort((a, b) => a - b), // Sort ascending
          maxReminders
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Payment reminder settings updated successfully',
      data: user.paymentReminderSettings
    });
  } catch (error) {
    console.error('Error updating reminder settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Send manual payment reminder for an invoice
 */
export const sendManualReminder = async (req: any, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user?.userId;

    if (!invoiceId) {
      return res.status(400).json({ message: 'Invoice ID is required' });
    }

    const success = await paymentReminderService.sendManualReminder(invoiceId, userId!);

    if (success) {
      res.json({
        success: true,
        message: 'Payment reminder sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send payment reminder'
      });
    }
  } catch (error) {
    console.error('Error sending manual reminder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get payment reminder statistics
 */
export const getReminderStats = async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const stats = await paymentReminderService.getReminderStats(userId!);

    if (stats) {
      res.json({
        success: true,
        data: stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get reminder statistics'
      });
    }
  } catch (error) {
    console.error('Error getting reminder stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get upcoming payment reminders
 */
export const getUpcomingReminders = async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const Invoice = require('../models/Invoice').default;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Find invoices due in the next 7 days
    const upcomingInvoices = await Invoice.find({
      userId,
      paymentStatus: { $in: ['pending', 'partial'] },
      status: { $ne: 'cancelled' },
      dueDate: {
        $gte: today,
        $lte: nextWeek
      }
    }).sort({ dueDate: 1 });

    const reminders = upcomingInvoices.map((invoice: any) => {
      const dueDate = new Date(invoice.dueDate);
      const daysToDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer.name,
        amount: invoice.grandTotal,
        dueDate: invoice.dueDate,
        daysToDue,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus
      };
    });

    res.json({
      success: true,
      data: reminders
    });
  } catch (error) {
    console.error('Error getting upcoming reminders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get overdue invoices
 */
export const getOverdueInvoices = async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const Invoice = require('../models/Invoice').default;
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Find overdue invoices
    const overdueInvoices = await Invoice.find({
      userId,
      paymentStatus: { $in: ['pending', 'partial'] },
      status: { $ne: 'cancelled' },
      dueDate: { $lt: today }
    }).sort({ dueDate: 1 });

    const overdue = overdueInvoices.map((invoice: any) => {
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer.name,
        amount: invoice.grandTotal,
        dueDate: invoice.dueDate,
        daysOverdue,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        remindersSent: invoice.remindersSent || []
      };
    });

    res.json({
      success: true,
      data: overdue
    });
  } catch (error) {
    console.error('Error getting overdue invoices:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
