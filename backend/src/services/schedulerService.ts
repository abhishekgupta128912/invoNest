import cron from 'node-cron';
import { UserCompliance } from '../models/Compliance';
import { Notification, NotificationPreference } from '../models/Notification';
import User from '../models/User';
import getEmailService from './emailService';

class SchedulerService {
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log('Starting compliance reminder scheduler...');
    
    // Run every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Running daily compliance reminder check...');
      await this.checkComplianceReminders();
    });

    // Run every hour to process scheduled notifications
    cron.schedule('0 * * * *', async () => {
      console.log('Processing scheduled notifications...');
      await this.processScheduledNotifications();
    });

    this.isRunning = true;
    console.log('Scheduler started successfully');
  }

  stop() {
    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  async checkComplianceReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get all active compliance items due in the next 30 days
      const upcomingCompliances = await UserCompliance.find({
        isEnabled: true,
        isCompleted: false,
        nextDueDate: {
          $gte: today,
          $lte: thirtyDaysFromNow
        }
      })
      .populate('complianceId')
      .populate('userId');

      for (const userCompliance of upcomingCompliances) {
        const daysUntilDue = Math.ceil(
          (userCompliance.nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we should send a reminder for this compliance item
        if (userCompliance.reminderDays.includes(daysUntilDue)) {
          await this.sendComplianceReminder(userCompliance, daysUntilDue);
        }
      }

      console.log(`Processed ${upcomingCompliances.length} compliance items`);
    } catch (error) {
      console.error('Error checking compliance reminders:', error);
    }
  }

  async sendComplianceReminder(userCompliance: any, daysUntilDue: number) {
    try {
      const user = userCompliance.userId;
      const compliance = userCompliance.complianceId;

      // Get user's notification preferences
      const preferences = await NotificationPreference.findOne({ 
        userId: user._id 
      });

      // Skip if user has disabled compliance reminders
      if (preferences && !preferences.complianceReminders) {
        return;
      }

      // Create in-app notification
      const notification = new Notification({
        userId: user._id,
        title: `Compliance Reminder: ${compliance.title}`,
        message: `Your ${compliance.title} is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}. Due date: ${userCompliance.nextDueDate.toLocaleDateString('en-IN')}.`,
        type: 'compliance',
        priority: daysUntilDue <= 3 ? 'urgent' : daysUntilDue <= 7 ? 'high' : 'medium',
        relatedEntity: {
          type: 'compliance',
          id: userCompliance._id
        },
        channels: {
          email: preferences?.emailNotifications || false,
          inApp: true,
          push: false
        }
      });

      // Add email details if email notifications are enabled
      if (preferences?.emailNotifications) {
        notification.emailDetails = {
          subject: `Compliance Reminder: ${compliance.title}`,
          htmlContent: await this.generateComplianceEmailHTML(compliance, userCompliance, daysUntilDue),
          textContent: await this.generateComplianceEmailText(compliance, userCompliance, daysUntilDue)
        };
      }

      await notification.save();

      // Send email if enabled
      if (preferences?.emailNotifications) {
        const emailAddress = preferences.emailAddress || user.email;
        const emailService = getEmailService();
        const success = await emailService.sendComplianceReminder(
          emailAddress,
          compliance.title,
          userCompliance.nextDueDate,
          daysUntilDue,
          compliance.penaltyInfo?.lateFilingPenalty
        );

        if (success) {
          notification.status = 'sent';
          notification.sentAt = new Date();
        } else {
          notification.status = 'failed';
          notification.errorMessage = 'Email delivery failed';
        }

        await notification.save();
      }

      console.log(`Sent compliance reminder for ${compliance.title} to ${user.email}`);
    } catch (error) {
      console.error('Error sending compliance reminder:', error);
    }
  }

  async processScheduledNotifications() {
    try {
      const now = new Date();
      
      // Get all notifications scheduled for now or earlier
      const scheduledNotifications = await Notification.find({
        status: 'pending',
        scheduledFor: { $lte: now }
      }).populate('userId');

      for (const notification of scheduledNotifications) {
        await this.processNotification(notification);
      }

      console.log(`Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    }
  }

  async processNotification(notification: any) {
    try {
      const user = notification.userId;

      // Get user preferences
      const preferences = await NotificationPreference.findOne({ 
        userId: user._id 
      });

      // Send email if enabled
      if (notification.channels.email && preferences?.emailNotifications && notification.emailDetails) {
        const emailAddress = preferences.emailAddress || user.email;
        const emailService = getEmailService();

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
      } else {
        // Mark as delivered for in-app only notifications
        notification.status = 'delivered';
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

  private async generateComplianceEmailHTML(compliance: any, userCompliance: any, daysUntilDue: number): Promise<string> {
    const urgencyClass = daysUntilDue <= 3 ? 'urgent' : daysUntilDue <= 7 ? 'warning' : 'info';
    
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #4F46E5; color: white; padding: 20px; text-align: center;">
          <h1>Compliance Reminder</h1>
        </div>
        <div style="padding: 20px;">
          <div style="padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid ${urgencyClass === 'urgent' ? '#EF4444' : urgencyClass === 'warning' ? '#F59E0B' : '#3B82F6'}; background: ${urgencyClass === 'urgent' ? '#FEF2F2' : urgencyClass === 'warning' ? '#FFFBEB' : '#EFF6FF'};">
            <h2>${compliance.title}</h2>
            <p><strong>Due Date:</strong> ${userCompliance.nextDueDate.toLocaleDateString('en-IN')}</p>
            <p><strong>Days Remaining:</strong> ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</p>
            ${compliance.penaltyInfo?.lateFilingPenalty ? `<p><strong>Penalty Info:</strong> ${compliance.penaltyInfo.lateFilingPenalty}</p>` : ''}
          </div>
          <p>${compliance.description}</p>
          <a href="${process.env.FRONTEND_URL}/dashboard/compliance" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">View Compliance Calendar</a>
        </div>
      </div>
    `;
  }

  private async generateComplianceEmailText(compliance: any, userCompliance: any, daysUntilDue: number): Promise<string> {
    return `
      Compliance Reminder: ${compliance.title}
      
      Due Date: ${userCompliance.nextDueDate.toLocaleDateString('en-IN')}
      Days Remaining: ${daysUntilDue}
      ${compliance.penaltyInfo?.lateFilingPenalty ? `Penalty Info: ${compliance.penaltyInfo.lateFilingPenalty}` : ''}
      
      ${compliance.description}
      
      View your compliance calendar: ${process.env.FRONTEND_URL}/dashboard/compliance
    `;
  }

  // Manual trigger for testing
  async triggerComplianceCheck() {
    console.log('Manually triggering compliance check...');
    await this.checkComplianceReminders();
  }

  async triggerNotificationProcessing() {
    console.log('Manually triggering notification processing...');
    await this.processScheduledNotifications();
  }
}

export default new SchedulerService();
