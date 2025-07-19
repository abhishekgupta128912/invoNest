import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getReminderSettings,
  updateReminderSettings,
  sendManualReminder,
  getReminderStats,
  getUpcomingReminders,
  getOverdueInvoices
} from '../controllers/paymentReminderController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/payment-reminders/settings
 * @desc    Get payment reminder settings
 * @access  Private
 */
router.get('/settings', getReminderSettings);

/**
 * @route   PUT /api/payment-reminders/settings
 * @desc    Update payment reminder settings
 * @access  Private
 */
router.put('/settings', updateReminderSettings);

/**
 * @route   POST /api/payment-reminders/send/:invoiceId
 * @desc    Send manual payment reminder for an invoice
 * @access  Private
 */
router.post('/send/:invoiceId', sendManualReminder);

/**
 * @route   GET /api/payment-reminders/stats
 * @desc    Get payment reminder statistics
 * @access  Private
 */
router.get('/stats', getReminderStats);

/**
 * @route   GET /api/payment-reminders/upcoming
 * @desc    Get upcoming payment reminders
 * @access  Private
 */
router.get('/upcoming', getUpcomingReminders);

/**
 * @route   GET /api/payment-reminders/overdue
 * @desc    Get overdue invoices
 * @access  Private
 */
router.get('/overdue', getOverdueInvoices);

export default router;
