import nodemailer from 'nodemailer';
import { INotification } from '../models/Notification';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"InvoNest" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  async sendComplianceReminder(
    to: string, 
    complianceTitle: string, 
    dueDate: Date, 
    daysLeft: number,
    penaltyInfo?: string
  ): Promise<boolean> {
    const template = this.getComplianceReminderTemplate(complianceTitle, dueDate, daysLeft, penaltyInfo);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  async sendInvoiceReminder(
    to: string, 
    invoiceNumber: string, 
    dueDate: Date, 
    amount: number,
    customerName: string
  ): Promise<boolean> {
    const template = this.getInvoiceReminderTemplate(invoiceNumber, dueDate, amount, customerName);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
    const template = this.getWelcomeTemplate(userName);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const template = this.getPasswordResetTemplate(resetToken);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  private getComplianceReminderTemplate(
    title: string, 
    dueDate: Date, 
    daysLeft: number,
    penaltyInfo?: string
  ): EmailTemplate {
    const formattedDate = dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const urgencyClass = daysLeft <= 3 ? 'urgent' : daysLeft <= 7 ? 'warning' : 'info';
    const urgencyText = daysLeft <= 3 ? 'URGENT' : daysLeft <= 7 ? 'Important' : 'Reminder';

    const subject = `${urgencyText}: ${title} - Due ${formattedDate}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .urgent { border-left: 4px solid #EF4444; background: #FEF2F2; }
          .warning { border-left: 4px solid #F59E0B; background: #FFFBEB; }
          .info { border-left: 4px solid #3B82F6; background: #EFF6FF; }
          .footer { background: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>InvoNest Compliance Reminder</h1>
          </div>
          <div class="content">
            <div class="${urgencyClass}" style="padding: 15px; margin: 15px 0; border-radius: 6px;">
              <h2>${title}</h2>
              <p><strong>Due Date:</strong> ${formattedDate}</p>
              <p><strong>Days Remaining:</strong> ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</p>
              ${penaltyInfo ? `<p><strong>Penalty Info:</strong> ${penaltyInfo}</p>` : ''}
            </div>
            <p>Don't miss this important compliance deadline. Late filing may result in penalties and interest charges.</p>
            <a href="${process.env.FRONTEND_URL}/dashboard/compliance" class="button">View Compliance Calendar</a>
          </div>
          <div class="footer">
            <p>This is an automated reminder from InvoNest. You can manage your notification preferences in your dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      InvoNest Compliance Reminder
      
      ${title}
      Due Date: ${formattedDate}
      Days Remaining: ${daysLeft}
      ${penaltyInfo ? `Penalty Info: ${penaltyInfo}` : ''}
      
      Don't miss this important compliance deadline. Visit ${process.env.FRONTEND_URL}/dashboard/compliance to view your compliance calendar.
    `;

    return { subject, html, text };
  }

  private getInvoiceReminderTemplate(
    invoiceNumber: string, 
    dueDate: Date, 
    amount: number,
    customerName: string
  ): EmailTemplate {
    const formattedDate = dueDate.toLocaleDateString('en-IN');
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);

    const subject = `Payment Reminder: Invoice ${invoiceNumber} - ${formattedAmount}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .invoice-details { background: #F3F4F6; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Reminder</h1>
          </div>
          <div class="content">
            <p>Dear ${customerName},</p>
            <div class="invoice-details">
              <h3>Invoice Details</h3>
              <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
              <p><strong>Amount:</strong> ${formattedAmount}</p>
              <p><strong>Due Date:</strong> ${formattedDate}</p>
            </div>
            <p>This is a friendly reminder that the above invoice is due for payment. Please process the payment at your earliest convenience.</p>
            <a href="${process.env.FRONTEND_URL}/dashboard/invoices" class="button">View Invoice</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Payment Reminder
      
      Dear ${customerName},
      
      Invoice Number: ${invoiceNumber}
      Amount: ${formattedAmount}
      Due Date: ${formattedDate}
      
      This is a friendly reminder that the above invoice is due for payment.
    `;

    return { subject, html, text };
  }

  private getWelcomeTemplate(userName: string): EmailTemplate {
    const subject = 'Welcome to InvoNest - Your AI-Powered Invoicing Platform';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .feature { margin: 15px 0; padding: 10px; border-left: 3px solid #4F46E5; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to InvoNest!</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Welcome to InvoNest - your AI-powered invoicing and compliance platform designed specifically for Indian businesses!</p>
            
            <div class="feature">
              <h3>🧾 GST-Compliant Invoices</h3>
              <p>Generate professional invoices with automated Indian tax calculations</p>
            </div>
            
            <div class="feature">
              <h3>🤖 AI Tax Assistant</h3>
              <p>Get instant answers to GST, TDS, and Indian tax law questions</p>
            </div>
            
            <div class="feature">
              <h3>📅 Smart Compliance Calendar</h3>
              <p>Never miss a deadline with proactive alerts and reminders</p>
            </div>
            
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to InvoNest!
      
      Dear ${userName},
      
      Welcome to InvoNest - your AI-powered invoicing and compliance platform designed specifically for Indian businesses!
      
      Features:
      - GST-Compliant Invoices
      - AI Tax Assistant  
      - Smart Compliance Calendar
      
      Get started: ${process.env.FRONTEND_URL}/dashboard
    `;

    return { subject, html, text };
  }

  private getPasswordResetTemplate(resetToken: string): EmailTemplate {
    const subject = 'Reset Your InvoNest Password';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          .warning { background: #FEF2F2; border: 1px solid #FECACA; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>You requested a password reset for your InvoNest account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <p><strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      You requested a password reset for your InvoNest account.
      
      Reset your password: ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
    `;

    return { subject, html, text };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export default new EmailService();
