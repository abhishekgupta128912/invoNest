import cron from 'node-cron';
import Invoice from '../models/Invoice';
import User from '../models/User';
import { EmailService, getEmailService } from './emailService';

export interface PaymentReminderSettings {
  enabled: boolean;
  reminderDays: number[]; // Days before due date to send reminders
  overdueReminderDays: number[]; // Days after due date to send reminders
  maxReminders: number;
}

export class PaymentReminderService {
  private static instance: PaymentReminderService;
  private emailService: EmailService;

  constructor() {
    this.emailService = getEmailService();
    this.initializeCronJobs();
  }

  static getInstance(): PaymentReminderService {
    if (!PaymentReminderService.instance) {
      PaymentReminderService.instance = new PaymentReminderService();
    }
    return PaymentReminderService.instance;
  }

  /**
   * Initialize cron jobs for payment reminders
   */
  private initializeCronJobs() {
    // Run daily at 9 AM to check for payment reminders
    cron.schedule('0 9 * * *', async () => {
      console.log('Running daily payment reminder check...');
      await this.processPaymentReminders();
    });

    // Run every hour to check for overdue invoices
    cron.schedule('0 * * * *', async () => {
      await this.updateOverdueInvoices();
    });
  }

  /**
   * Process payment reminders for all users
   */
  async processPaymentReminders(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all unpaid invoices with due dates
      const unpaidInvoices = await Invoice.find({
        paymentStatus: { $in: ['pending', 'partial'] },
        status: { $ne: 'cancelled' },
        dueDate: { $exists: true }
      }).populate('userId', 'name email businessName paymentReminderSettings');

      for (const invoice of unpaidInvoices) {
        await this.checkAndSendReminder(invoice, today);
      }
    } catch (error) {
      console.error('Error processing payment reminders:', error);
    }
  }

  /**
   * Check if reminder should be sent and send it
   */
  private async checkAndSendReminder(invoice: any, today: Date): Promise<void> {
    const user = invoice.userId;
    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const daysDifference = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get user's reminder settings or use defaults
    const settings: PaymentReminderSettings = user.paymentReminderSettings || {
      enabled: true,
      reminderDays: [7, 3, 1], // 7, 3, 1 days before due date
      overdueReminderDays: [1, 7, 14], // 1, 7, 14 days after due date
      maxReminders: 5
    };

    if (!settings.enabled) return;

    let shouldSendReminder = false;
    let reminderType: 'upcoming' | 'due' | 'overdue' = 'upcoming';

    // Check if it's time for a pre-due reminder
    if (daysDifference > 0 && settings.reminderDays.includes(daysDifference)) {
      shouldSendReminder = true;
      reminderType = 'upcoming';
    }
    // Check if it's due today
    else if (daysDifference === 0) {
      shouldSendReminder = true;
      reminderType = 'due';
    }
    // Check if it's overdue
    else if (daysDifference < 0 && settings.overdueReminderDays.includes(Math.abs(daysDifference))) {
      shouldSendReminder = true;
      reminderType = 'overdue';
    }

    if (shouldSendReminder) {
      await this.sendPaymentReminder(invoice, user, reminderType, Math.abs(daysDifference));
    }
  }

  /**
   * Send payment reminder email
   */
  private async sendPaymentReminder(
    invoice: any, 
    user: any, 
    type: 'upcoming' | 'due' | 'overdue',
    days: number
  ): Promise<void> {
    try {
      const reminderData = {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer.name,
        amount: invoice.grandTotal,
        dueDate: invoice.dueDate,
        type,
        days,
        businessName: user.businessName || user.name,
        invoiceUrl: `${process.env.FRONTEND_URL}/dashboard/invoices/${invoice._id}`
      };

      await this.emailService.sendPaymentReminder(user.email, reminderData);
      
      // Log the reminder
      console.log(`Payment reminder sent: ${type} for invoice ${invoice.invoiceNumber} to ${user.email}`);
      
      // Update invoice with reminder sent info
      if (!invoice.remindersSent) {
        invoice.remindersSent = [];
      }
      invoice.remindersSent.push({
        type,
        sentAt: new Date(),
        days
      });
      await invoice.save();

    } catch (error) {
      console.error(`Error sending payment reminder for invoice ${invoice.invoiceNumber}:`, error);
    }
  }

  /**
   * Update overdue invoice status
   */
  async updateOverdueInvoices(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      await Invoice.updateMany(
        {
          dueDate: { $lt: today },
          paymentStatus: { $in: ['pending', 'partial'] },
          status: { $ne: 'overdue' }
        },
        {
          $set: { status: 'overdue' }
        }
      );
    } catch (error) {
      console.error('Error updating overdue invoices:', error);
    }
  }

  /**
   * Send manual payment reminder
   */
  async sendManualReminder(invoiceId: string, userId: string): Promise<boolean> {
    try {
      const invoice = await Invoice.findOne({ _id: invoiceId, userId }).populate('userId');
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (!invoice.dueDate) {
        throw new Error('Invoice has no due date');
      }

      const user = invoice.userId;
      const today = new Date();
      const dueDate = new Date(invoice.dueDate);
      const daysDifference = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let reminderType: 'upcoming' | 'due' | 'overdue' = 'upcoming';
      if (daysDifference === 0) reminderType = 'due';
      else if (daysDifference < 0) reminderType = 'overdue';

      await this.sendPaymentReminder(invoice, user, reminderType, Math.abs(daysDifference));
      return true;
    } catch (error) {
      console.error('Error sending manual reminder:', error);
      return false;
    }
  }

  /**
   * Get payment reminder statistics
   */
  async getReminderStats(userId: string): Promise<any> {
    try {
      const invoices = await Invoice.find({ userId });

      const stats: {
        totalReminders: number;
        upcomingReminders: number;
        overdueInvoices: number;
        recentReminders: any[];
      } = {
        totalReminders: 0,
        upcomingReminders: 0,
        overdueInvoices: 0,
        recentReminders: []
      };

      const today = new Date();

      for (const invoice of invoices) {
        if (invoice.remindersSent) {
          stats.totalReminders += invoice.remindersSent.length;

          // Get recent reminders (last 30 days)
          const recentReminders = invoice.remindersSent.filter((reminder: any) => {
            const sentDate = new Date(reminder.sentAt);
            const daysDiff = (today.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 30;
          });

          stats.recentReminders.push(...recentReminders.map((reminder: any) => ({
            ...reminder,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customer.name
          })));
        }

        // Check for upcoming reminders needed
        if (invoice.paymentStatus !== 'paid' && invoice.dueDate) {
          const dueDate = new Date(invoice.dueDate);
          const daysToDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysToDue <= 7 && daysToDue > 0) {
            stats.upcomingReminders++;
          } else if (daysToDue < 0) {
            stats.overdueInvoices++;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting reminder stats:', error);
      return null;
    }
  }
}

export default PaymentReminderService;
