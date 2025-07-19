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
  private transporter: nodemailer.Transporter | null = null;
  private isInitializing = false;
  private initPromise: Promise<nodemailer.Transporter> | null = null;

  constructor() {
    // Don't create transporter in constructor - use lazy initialization
    console.log('=== EMAIL SERVICE CONSTRUCTOR DEBUG ===');
    console.log('EmailService instance created - transporter will be initialized on first use');
    console.log('========================================');
  }

  private getLogoUrl(): string {
    // Use backend URL for serving the logo in emails
    const backendUrl = process.env.NODE_ENV === 'production'
      ? process.env.BACKEND_URL || 'https://your-backend-domain.com'
      : 'http://localhost:5000';
    return `${backendUrl}/public/invologo.png`;
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
      const mailPass = process.env.MAIL_PASS || process.env.EMAIL_PASS;

      console.log('=== EMAIL TRANSPORTER INITIALIZATION ===');
      console.log('MAIL_USER:', process.env.MAIL_USER ? 'SET' : 'NOT SET');
      console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
      console.log('MAIL_PASS:', process.env.MAIL_PASS ? 'SET' : 'NOT SET');
      console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
      console.log('Effective mailUser:', mailUser ? 'SET' : 'NOT SET');
      console.log('Effective mailPass:', mailPass ? 'SET' : 'NOT SET');
      console.log('Auth object will be:', mailUser && mailPass ? 'VALID' : 'INVALID');
      console.log('==========================================');

      // Only create transporter if we have valid credentials
      if (mailUser && mailPass) {
        this.transporter = nodemailer.createTransport({
          host: process.env.MAIL_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.MAIL_PORT || process.env.EMAIL_PORT || '587'),
          secure: false, // true for 465, false for other ports
          pool: true, // Enable connection pooling for better performance
          maxConnections: 5, // Limit concurrent connections
          maxMessages: 100, // Limit messages per connection before reconnecting
          auth: {
            user: mailUser,
            pass: mailPass
          }
        });
        console.log('✅ Email transporter created with valid credentials');
      } else {
        console.warn('⚠️ Email service not properly configured - missing credentials');
        // Create a dummy transporter that will fail gracefully
        this.transporter = nodemailer.createTransport({
          host: 'localhost',
          port: 587,
          secure: false,
          auth: {
            user: '',
            pass: ''
          }
        });
        console.log('❌ Created dummy transporter due to missing credentials');
      }
    }
    return this.transporter;
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    try {
      // Check if email service is configured
      const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
      const mailPass = process.env.MAIL_PASS || process.env.EMAIL_PASS;

      if (!mailUser || !mailPass) {
        console.error('Email service not configured: Missing MAIL_USER/EMAIL_USER or MAIL_PASS/EMAIL_PASS');
        console.error('Email authentication failed. Please check MAIL_USER and MAIL_PASS in .env file');
        console.error('For Gmail, make sure you are using an App Password, not your regular password');
        console.error('Gmail App Password setup: https://support.google.com/accounts/answer/185833');
        throw new Error('Email service not configured');
      }

      const mailOptions = {
        from: `"InvoNest" <${mailUser}>`,
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const transporter = this.getTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error: any) {
      console.error('Email sending failed:', error);

      // Log specific error types for debugging
      if (error.code === 'EAUTH') {
        console.error('Email authentication failed. Please check EMAIL_USER and EMAIL_PASS in .env file');
        console.error('For Gmail, make sure you are using an App Password, not your regular password');
        console.error('Gmail App Password setup: https://support.google.com/accounts/answer/185833');
      } else if (error.code === 'ECONNECTION') {
        console.error('Email connection failed. Please check EMAIL_HOST and EMAIL_PORT');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('Email connection timed out. Please check your internet connection');
      }

      throw error; // Re-throw to let the controller handle it
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

  async sendEmailVerificationEmail(to: string, verificationToken: string, userName: string): Promise<boolean> {
    const template = this.getEmailVerificationTemplate(verificationToken, userName);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  async sendOTPEmail(to: string, otp: string, userName: string, purpose: string = 'verification'): Promise<boolean> {
    const template = this.getOTPTemplate(otp, userName, purpose);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  async sendLoginOTPEmail(to: string, otp: string, userName: string): Promise<boolean> {
    const template = this.getLoginOTPTemplate(otp, userName);
    return this.sendEmail(to, template.subject, template.html, template.text);
  }

  async sendInvoiceEmail(
    to: string,
    invoiceData: {
      invoiceNumber: string;
      customerName: string;
      amount: number;
      dueDate?: Date;
      businessName: string;
      invoiceUrl: string;
      upiId?: string;
      bankDetails?: {
        accountNumber?: string;
        ifscCode?: string;
        bankName?: string;
        accountHolderName?: string;
      };
    },
    pdfBuffer: Buffer
  ): Promise<boolean> {
    try {
      // Check if email service is configured
      const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
      const mailPass = process.env.MAIL_PASS || process.env.EMAIL_PASS;

      if (!mailUser || !mailPass) {
        console.error('Email service not configured: Missing MAIL_USER/EMAIL_USER or MAIL_PASS/EMAIL_PASS');
        console.error('Email authentication failed. Please check MAIL_USER and MAIL_PASS in .env file');
        console.error('For Gmail, make sure you are using an App Password, not your regular password');
        console.error('Gmail App Password setup: https://support.google.com/accounts/answer/185833');
        throw new Error('Email service not configured');
      }

      const template = this.getInvoiceEmailTemplate(invoiceData);

      const mailOptions = {
        from: `"${invoiceData.businessName}" <${mailUser}>`,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: [
          {
            filename: `Invoice-${invoiceData.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const transporter = this.getTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log('Invoice email sent successfully:', result.messageId);
      return true;
    } catch (error: any) {
      console.error('Invoice email sending failed:', error);

      // Log specific error types for debugging
      if (error.code === 'EAUTH') {
        console.error('Email authentication failed. Please check MAIL_USER and MAIL_PASS in .env file');
        console.error('For Gmail, make sure you are using an App Password, not your regular password');
        console.error('Gmail App Password setup: https://support.google.com/accounts/answer/185833');
      } else if (error.code === 'ECONNECTION') {
        console.error('Email connection failed. Please check MAIL_HOST and MAIL_PORT');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('Email connection timed out. Please check your internet connection');
      }

      return false;
    }
  }

  async sendReceiptEmail(
    to: string,
    receiptData: {
      receiptNumber: string;
      transactionId: string;
      customerName: string;
      amount: number;
      paidAt: Date;
      invoiceNumber: string;
      businessName: string;
    },
    pdfBuffer: Buffer
  ): Promise<boolean> {
    try {
      const template = this.getReceiptEmailTemplate(receiptData);

      const mailOptions = {
        from: `"${receiptData.businessName}" <${process.env.MAIL_USER || process.env.EMAIL_USER}>`,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: [
          {
            filename: `Receipt-${receiptData.receiptNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const transporter = this.getTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log('Receipt email sent successfully:', result.messageId);
      return true;
    } catch (error: any) {
      console.error('Receipt email sending failed:', error);
      return false;
    }
  }

  private getReceiptEmailTemplate(receiptData: {
    receiptNumber: string;
    transactionId: string;
    customerName: string;
    amount: number;
    paidAt: Date;
    invoiceNumber: string;
    businessName: string;
  }): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(receiptData.amount);

    const formattedDate = receiptData.paidAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const subject = `Payment Receipt ${receiptData.receiptNumber} from ${receiptData.businessName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .success-box { background: #ECFDF5; border: 2px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .receipt-details { background: #F9FAFB; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { background: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Received Successfully!</h1>
          </div>
          <div class="content">
            <div class="success-box">
              <h2 style="color: #059669; margin-top: 0;">Thank you for your payment!</h2>
              <p>Dear ${receiptData.customerName},</p>
              <p>We have successfully received your payment for Invoice ${receiptData.invoiceNumber}.</p>
            </div>

            <div class="receipt-details">
              <h3>Payment Details:</h3>
              <p><strong>Receipt Number:</strong> ${receiptData.receiptNumber}</p>
              <p><strong>Transaction ID:</strong> ${receiptData.transactionId}</p>
              <p><strong>Invoice Number:</strong> ${receiptData.invoiceNumber}</p>
              <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
              <p><strong>Payment Date:</strong> ${formattedDate}</p>
              <p><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">PAID</span></p>
            </div>

            <p>Please keep this receipt for your records. If you have any questions about this payment, please contact us.</p>
            <p>Thank you for your business!</p>
            <p>Best regards,<br>${receiptData.businessName}</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Payment Received Successfully!

      Dear ${receiptData.customerName},

      We have successfully received your payment for Invoice ${receiptData.invoiceNumber}.

      Payment Details:
      Receipt Number: ${receiptData.receiptNumber}
      Transaction ID: ${receiptData.transactionId}
      Invoice Number: ${receiptData.invoiceNumber}
      Amount Paid: ${formattedAmount}
      Payment Date: ${formattedDate}
      Status: PAID

      Please keep this receipt for your records.

      Thank you for your business!
      Best regards,
      ${receiptData.businessName}
    `;

    return { subject, html, text };
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
    const logoUrl = this.getLogoUrl();

    const subject = `Payment Reminder: Invoice ${invoiceNumber} - ${formattedAmount}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { padding: 20px; }
          .invoice-details { background: #F3F4F6; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
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
    const logoUrl = this.getLogoUrl();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { padding: 20px; }
          .feature { margin: 15px 0; padding: 10px; border-left: 3px solid #4F46E5; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
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
    const logoUrl = this.getLogoUrl();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { padding: 20px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          .warning { background: #FEF2F2; border: 1px solid #FECACA; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
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

  private getEmailVerificationTemplate(verificationToken: string, userName: string): EmailTemplate {
    const subject = 'Verify Your InvoNest Email Address';
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const logoUrl = this.getLogoUrl();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - InvoNest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
            <h1>🚀 InvoNest</h1>
            <h2>Verify Your Email Address</h2>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>

            <p>Thank you for registering with InvoNest! To complete your account setup and start using all our features, please verify your email address.</p>

            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${verificationUrl}</p>

            <div class="warning">
              <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security reasons.
            </div>

            <p><strong>Why verify your email?</strong></p>
            <ul>
              <li>✅ Secure your account</li>
              <li>✅ Receive important compliance notifications</li>
              <li>✅ Get invoice and payment updates</li>
              <li>✅ Access all InvoNest features</li>
            </ul>

            <p>If you didn't create an account with InvoNest, please ignore this email.</p>

            <p>Best regards,<br>The InvoNest Team</p>
          </div>
          <div class="footer">
            <p>InvoNest - AI-Powered Invoicing & Compliance Platform for Indian Businesses</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Verify Your InvoNest Email Address

      Hello ${userName},

      Thank you for registering with InvoNest! To complete your account setup, please verify your email address.

      Click here to verify: ${verificationUrl}

      This verification link will expire in 24 hours.

      Why verify your email?
      - Secure your account
      - Receive important compliance notifications
      - Get invoice and payment updates
      - Access all InvoNest features

      If you didn't create an account with InvoNest, please ignore this email.

      Best regards,
      The InvoNest Team
    `;

    return { subject, html, text };
  }

  private getWelcomeEmailTemplate(userName: string): EmailTemplate {
    const subject = 'Welcome to InvoNest! 🎉';
    const logoUrl = this.getLogoUrl();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to InvoNest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .feature { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
            <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to InvoNest!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your smart invoicing journey starts here</p>
          </div>

          <div class="content">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${userName}!</h2>

            <p>Congratulations! Your InvoNest account has been successfully created and is ready to use. 🚀</p>

            <div class="feature">
              <h3 style="margin: 0 0 10px 0; color: #667eea;">✨ What you can do now:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Create professional invoices in minutes</li>
                <li>Track payments and manage clients</li>
                <li>Generate detailed business reports</li>
                <li>Accept online payments seamlessly</li>
                <li>Stay compliant with tax regulations</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Start Creating Invoices</a>
            </div>

            <div class="feature">
              <h3 style="margin: 0 0 10px 0; color: #667eea;">💡 Quick Tips:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Complete your profile for better client trust</li>
                <li>Add your business logo and details</li>
                <li>Set up payment methods for faster collections</li>
                <li>Explore our templates for different industries</li>
              </ul>
            </div>

            <p style="margin-top: 30px;">If you have any questions or need help getting started, our support team is here to assist you.</p>

            <p style="margin-bottom: 0;">Happy invoicing! 📊</p>
          </div>

          <div class="footer">
            <p>Best regards,<br>The InvoNest Team</p>
            <p style="font-size: 12px; color: #999;">
              This email was sent because you created an account with InvoNest.<br>
              If you didn't create this account, please contact our support team.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to InvoNest! 🎉

      Hello ${userName},

      Congratulations! Your InvoNest account has been successfully created and is ready to use.

      What you can do now:
      - Create professional invoices in minutes
      - Track payments and manage clients
      - Generate detailed business reports
      - Accept online payments seamlessly
      - Stay compliant with tax regulations

      Quick Tips:
      - Complete your profile for better client trust
      - Add your business logo and details
      - Set up payment methods for faster collections
      - Explore our templates for different industries

      Get started: ${process.env.FRONTEND_URL}/dashboard

      If you have any questions or need help getting started, our support team is here to assist you.

      Happy invoicing!

      Best regards,
      The InvoNest Team
    `;

    return { subject, html, text };
  }

  private getOTPTemplate(otp: string, userName: string, purpose: string): EmailTemplate {
    const subject = `Your InvoNest OTP: ${otp}`;
    const logoUrl = this.getLogoUrl();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification - InvoNest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .otp-box { background: #F3F4F6; border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; font-family: 'Courier New', monospace; }
          .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
            <h1>🔐 OTP Verification</h1>
            <p>InvoNest Security Code</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>You have requested an OTP for ${purpose}. Please use the following code to complete your verification:</p>

            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #6B7280; font-size: 14px;">Enter this code to proceed</p>
            </div>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>This OTP is valid for 10 minutes only</li>
                <li>Do not share this code with anyone</li>
                <li>InvoNest will never ask for your OTP via phone or email</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>

            <p>If you're having trouble, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from InvoNest. Please do not reply to this email.</p>
            <p>&copy; 2024 InvoNest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      InvoNest OTP Verification

      Hello ${userName},

      You have requested an OTP for ${purpose}.

      Your OTP Code: ${otp}

      Security Notice:
      - This OTP is valid for 10 minutes only
      - Do not share this code with anyone
      - InvoNest will never ask for your OTP via phone or email
      - If you didn't request this, please ignore this email

      Best regards,
      The InvoNest Team
    `;

    return { subject, html, text };
  }

  private getLoginOTPTemplate(otp: string, userName: string): EmailTemplate {
    const subject = `Your InvoNest Login Code: ${otp}`;
    const logoUrl = this.getLogoUrl();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login OTP - InvoNest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .logo { width: 60px; height: 60px; margin-bottom: 10px; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .otp-box { background: #ECFDF5; border: 2px solid #059669; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 36px; font-weight: bold; color: #059669; letter-spacing: 6px; font-family: 'Courier New', monospace; }
          .info { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="InvoNest Logo" class="logo" />
            <h1>🔑 Secure Login</h1>
            <p>InvoNest Login Verification</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Someone is trying to log into your InvoNest account. If this is you, please use the following code to complete your login:</p>

            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #059669; font-weight: 600;">Enter this code to login securely</p>
            </div>

            <div class="info">
              <strong>🛡️ Login Details:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Time: ${new Date().toLocaleString('en-IN')}</li>
                <li>Valid for: 10 minutes</li>
                <li>One-time use only</li>
              </ul>
            </div>

            <p><strong>Didn't try to login?</strong> Please secure your account immediately by changing your password.</p>
          </div>
          <div class="footer">
            <p>This is an automated security message from InvoNest.</p>
            <p>&copy; 2024 InvoNest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      InvoNest Secure Login

      Hello ${userName},

      Someone is trying to log into your InvoNest account. If this is you, please use the following code:

      Login Code: ${otp}

      Login Details:
      - Time: ${new Date().toLocaleString('en-IN')}
      - Valid for: 10 minutes
      - One-time use only

      Didn't try to login? Please secure your account immediately by changing your password.

      Best regards,
      The InvoNest Team
    `;

    return { subject, html, text };
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminder(email: string, reminderData: {
    invoiceNumber: string;
    customerName: string;
    amount: number;
    dueDate: Date;
    type: 'upcoming' | 'due' | 'overdue';
    days: number;
    businessName: string;
    invoiceUrl: string;
  }): Promise<boolean> {
    try {
      const { subject, html, text } = this.getPaymentReminderTemplate(reminderData);

      const mailOptions = {
        from: `"InvoNest" <${process.env.MAIL_FROM}>`,
        to: email,
        subject,
        html,
        text
      };

      const transporter = this.getTransporter();
      await transporter.sendMail(mailOptions);
      console.log(`Payment reminder email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending payment reminder email:', error);
      return false;
    }
  }

  /**
   * Generate payment reminder email template
   */
  private getPaymentReminderTemplate(data: {
    invoiceNumber: string;
    customerName: string;
    amount: number;
    dueDate: Date;
    type: 'upcoming' | 'due' | 'overdue';
    days: number;
    businessName: string;
    invoiceUrl: string;
  }): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(data.amount);

    const formattedDate = new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(data.dueDate));

    let subject = '';
    let urgencyClass = '';
    let title = '';
    let message = '';

    switch (data.type) {
      case 'upcoming':
        subject = `Payment Reminder: Invoice ${data.invoiceNumber} due in ${data.days} day${data.days !== 1 ? 's' : ''}`;
        urgencyClass = 'info';
        title = `Payment Due in ${data.days} Day${data.days !== 1 ? 's' : ''}`;
        message = `This is a friendly reminder that payment for invoice ${data.invoiceNumber} is due in ${data.days} day${data.days !== 1 ? 's' : ''}.`;
        break;
      case 'due':
        subject = `Payment Due Today: Invoice ${data.invoiceNumber}`;
        urgencyClass = 'warning';
        title = 'Payment Due Today';
        message = `Payment for invoice ${data.invoiceNumber} is due today. Please process the payment to avoid any late fees.`;
        break;
      case 'overdue':
        subject = `Overdue Payment: Invoice ${data.invoiceNumber} - ${data.days} day${data.days !== 1 ? 's' : ''} overdue`;
        urgencyClass = 'urgent';
        title = `Payment Overdue - ${data.days} Day${data.days !== 1 ? 's' : ''}`;
        message = `Payment for invoice ${data.invoiceNumber} is now ${data.days} day${data.days !== 1 ? 's' : ''} overdue. Please make the payment immediately to avoid additional charges.`;
        break;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .invoice-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
          .info { background: #dbeafe; border-left: 4px solid #3b82f6; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
          .urgent { background: #fee2e2; border-left: 4px solid #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Reminder</h1>
            <p>InvoNest Payment Management</p>
          </div>
          <div class="content">
            <div class="${urgencyClass}" style="padding: 15px; margin: 15px 0; border-radius: 6px;">
              <h2>${title}</h2>
              <p>${message}</p>
            </div>

            <div class="invoice-details">
              <h3>Invoice Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Invoice Number:</td>
                  <td style="padding: 8px 0;">${data.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Customer:</td>
                  <td style="padding: 8px 0;">${data.customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                  <td style="padding: 8px 0;" class="amount">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Due Date:</td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Business:</td>
                  <td style="padding: 8px 0;">${data.businessName}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center;">
              <a href="${data.invoiceUrl}" class="button">View Invoice</a>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Review the invoice details above</li>
              <li>Process the payment using your preferred method</li>
              <li>Contact us if you have any questions or concerns</li>
              <li>Update your payment status in our system</li>
            </ul>

            <p>Thank you for your prompt attention to this matter.</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from InvoNest Payment Management System.</p>
            <p>&copy; 2024 InvoNest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Payment Reminder - ${title}

      ${message}

      Invoice Details:
      - Invoice Number: ${data.invoiceNumber}
      - Customer: ${data.customerName}
      - Amount: ${formattedAmount}
      - Due Date: ${formattedDate}
      - Business: ${data.businessName}

      View Invoice: ${data.invoiceUrl}

      Please process the payment at your earliest convenience.

      Thank you,
      InvoNest Team
    `;

    return { subject, html, text };
  }

  private getInvoiceEmailTemplate(data: {
    invoiceNumber: string;
    customerName: string;
    amount: number;
    dueDate?: Date;
    businessName: string;
    invoiceUrl: string;
    upiId?: string;
    bankDetails?: {
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
      accountHolderName?: string;
    };
  }): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(data.amount);

    const formattedDate = data.dueDate ? data.dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) : '';

    const subject = `Invoice ${data.invoiceNumber} from ${data.businessName} - ${formattedAmount}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${data.invoiceNumber}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
          .content { padding: 40px 30px; }
          .invoice-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .invoice-details h3 { margin-top: 0; color: #667eea; font-size: 18px; }
          .invoice-details p { margin: 8px 0; font-size: 16px; }
          .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; }
          .attachment-note { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
          /* Table-based buttons for better email client compatibility */
          .email-button { background: #667eea; border-radius: 8px; text-align: center; }
          .email-button a { display: inline-block; padding: 15px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice from ${data.businessName}</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Thank you for your business! Please find your invoice attached to this email.</p>

            <div class="invoice-details">
              <h3>Invoice Details</h3>
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Amount:</strong> ${formattedAmount}</p>
              ${data.dueDate ? `<p><strong>Due Date:</strong> ${formattedDate}</p>` : ''}
              <p><strong>From:</strong> ${data.businessName}</p>
            </div>

            <div class="attachment-note">
              <p><strong>📎 Invoice PDF Attached</strong></p>
              <p>Your invoice is attached as a PDF file to this email. You can download and save it for your records.</p>
            </div>

            ${data.upiId ? `
            <!-- UPI Payment Section -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #e8f5e8; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <h3 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 20px;">💳 Pay Now with UPI</h3>
                  <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Click the button below to pay instantly via UPI</p>

                  <!-- UPI Button - Table-based for better email client support -->
                  <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background: #4caf50; border-radius: 8px; text-align: center;">
                        <a href="upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.businessName)}&am=${data.amount}&cu=INR&tn=${encodeURIComponent(`Payment for Invoice ${data.invoiceNumber}`)}"
                           style="display: inline-block; padding: 15px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; font-family: Arial, sans-serif;">
                          📱 Pay ₹${data.amount.toLocaleString('en-IN')} via UPI
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Alternative UPI Link for email clients that don't support buttons -->
                  <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
                    <strong>Can't see the button?</strong><br>
                    Copy this UPI link: <span style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.businessName)}&am=${data.amount}&cu=INR&tn=${encodeURIComponent(`Payment for Invoice ${data.invoiceNumber}`)}</span>
                  </p>

                  <!-- Payment Details Box -->
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 5px 0; font-size: 14px; color: #495057;"><strong>UPI ID:</strong> ${data.upiId}</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #495057;"><strong>Amount:</strong> ₹${data.amount.toLocaleString('en-IN')}</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #495057;"><strong>Reference:</strong> ${data.invoiceNumber}</p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 15px 0 0 0; font-size: 13px; color: #666; line-height: 1.4;">
                    <strong>📱 Mobile:</strong> Button will open your UPI app (PhonePe, GPay, Paytm, etc.)<br>
                    <strong>💻 Desktop:</strong> Use the UPI ID above in your mobile UPI app<br>
                    <strong>⚡ Manual Payment:</strong> Open any UPI app → Send Money → Enter UPI ID above
                  </p>
                </td>
              </tr>
            </table>
            ` : ''}

            ${data.bankDetails && (data.bankDetails.accountNumber || data.bankDetails.ifscCode) ? `
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
              <h3 style="color: #374151; margin-top: 0;">🏦 Bank Transfer Details</h3>
              ${data.bankDetails.accountHolderName ? `<p><strong>Account Holder:</strong> ${data.bankDetails.accountHolderName}</p>` : ''}
              ${data.bankDetails.accountNumber ? `<p><strong>Account Number:</strong> ${data.bankDetails.accountNumber}</p>` : ''}
              ${data.bankDetails.ifscCode ? `<p><strong>IFSC Code:</strong> ${data.bankDetails.ifscCode}</p>` : ''}
              ${data.bankDetails.bankName ? `<p><strong>Bank Name:</strong> ${data.bankDetails.bankName}</p>` : ''}
              <p style="font-size: 14px; color: #666; margin-top: 15px;">
                <strong>Note:</strong> Please include invoice number <strong>${data.invoiceNumber}</strong> in the transfer reference.
              </p>
            </div>
            ` : ''}

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <!-- View Online Button - Table-based for better email client support -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
              <tr>
                <td style="background: #667eea; border-radius: 8px; text-align: center;">
                  <a href="${data.invoiceUrl}"
                     style="display: inline-block; padding: 15px 30px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px;">
                    View Online
                  </a>
                </td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>This invoice was generated by <strong>InvoNest</strong> - Professional Invoicing Platform</p>
            <p>If you have any questions, please contact ${data.businessName} directly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Invoice from ${data.businessName}

      Dear ${data.customerName},

      Thank you for your business! Please find your invoice attached to this email.

      Invoice Details:
      - Invoice Number: ${data.invoiceNumber}
      - Amount: ${formattedAmount}
      ${data.dueDate ? `- Due Date: ${formattedDate}` : ''}
      - From: ${data.businessName}

      Your invoice is attached as a PDF file to this email.

      ${data.upiId ? `
      💳 PAY NOW WITH UPI:
      UPI ID: ${data.upiId}
      Amount: ₹${data.amount.toLocaleString('en-IN')}

      To pay via UPI:
      1. Open any UPI app (PhonePe, Paytm, GPay, etc.)
      2. Send money to: ${data.upiId}
      3. Enter amount: ₹${data.amount}
      4. Add note: Payment for Invoice ${data.invoiceNumber}
      ` : ''}

      ${data.bankDetails && (data.bankDetails.accountNumber || data.bankDetails.ifscCode) ? `
      🏦 BANK TRANSFER DETAILS:
      ${data.bankDetails.accountHolderName ? `Account Holder: ${data.bankDetails.accountHolderName}` : ''}
      ${data.bankDetails.accountNumber ? `Account Number: ${data.bankDetails.accountNumber}` : ''}
      ${data.bankDetails.ifscCode ? `IFSC Code: ${data.bankDetails.ifscCode}` : ''}
      ${data.bankDetails.bankName ? `Bank Name: ${data.bankDetails.bankName}` : ''}

      Note: Please include invoice number ${data.invoiceNumber} in the transfer reference.
      ` : ''}

      View Online: ${data.invoiceUrl}

      If you have any questions about this invoice, please don't hesitate to contact us.

      Thank you,
      ${data.businessName}
    `;

    return { subject, html, text };
  }

  /**
   * Send payment confirmation email to customer
   */
  async sendPaymentConfirmationEmail(
    to: string,
    paymentData: {
      paymentId: string;
      receiptNumber: string;
      amount: number;
      invoiceNumber: string;
      businessName: string;
      paymentMethod: string;
      transactionId?: string;
      paymentDate: Date;
    }
  ): Promise<boolean> {
    try {
      const template = this.getPaymentConfirmationTemplate(paymentData);
      return this.sendEmail(to, template.subject, template.html, template.text);
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      return false;
    }
  }

  /**
   * Send payment notification email to business owner
   */
  async sendPaymentNotificationEmail(
    to: string,
    paymentData: {
      paymentId: string;
      receiptNumber: string;
      amount: number;
      invoiceNumber: string;
      customerName: string;
      paymentMethod: string;
      transactionId?: string;
      paymentDate: Date;
    }
  ): Promise<boolean> {
    try {
      const template = this.getPaymentNotificationTemplate(paymentData);
      return this.sendEmail(to, template.subject, template.html, template.text);
    } catch (error) {
      console.error('Error sending payment notification email:', error);
      return false;
    }
  }

  /**
   * Generate payment confirmation email template for customer
   */
  private getPaymentConfirmationTemplate(data: {
    paymentId: string;
    receiptNumber: string;
    amount: number;
    invoiceNumber: string;
    businessName: string;
    paymentMethod: string;
    transactionId?: string;
    paymentDate: Date;
  }): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(data.amount);

    const formattedDate = new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(data.paymentDate));

    const subject = `Payment Confirmation - ${formattedAmount} for Invoice ${data.invoiceNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .success-badge { background: #d1fae5; color: #065f46; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border-left: 4px solid #10b981; }
          .payment-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #10b981; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Confirmed</h1>
            <p>Thank you for your payment!</p>
          </div>
          <div class="content">
            <div class="success-badge">
              <h2 style="margin: 0;">Payment Successfully Processed</h2>
              <p style="margin: 10px 0 0 0;">Your payment has been received and confirmed.</p>
            </div>

            <div class="payment-details">
              <h3>Payment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Receipt Number:</td>
                  <td style="padding: 8px 0;">${data.receiptNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Payment ID:</td>
                  <td style="padding: 8px 0;">${data.paymentId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Invoice Number:</td>
                  <td style="padding: 8px 0;">${data.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Amount Paid:</td>
                  <td style="padding: 8px 0;" class="amount">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Payment Method:</td>
                  <td style="padding: 8px 0;">${data.paymentMethod.toUpperCase()}</td>
                </tr>
                ${data.transactionId ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Transaction ID:</td>
                  <td style="padding: 8px 0;">${data.transactionId}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Payment Date:</td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Business:</td>
                  <td style="padding: 8px 0;">${data.businessName}</td>
                </tr>
              </table>
            </div>

            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Save this email as your payment confirmation</li>
              <li>A receipt will be sent to you separately</li>
              <li>Contact ${data.businessName} if you have any questions</li>
            </ul>

            <p>Thank you for your business!</p>
          </div>
          <div class="footer">
            <p>This confirmation was sent by InvoNest Payment System.</p>
            <p>&copy; 2024 InvoNest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Payment Confirmation

      Your payment has been successfully processed!

      Payment Details:
      - Receipt Number: ${data.receiptNumber}
      - Payment ID: ${data.paymentId}
      - Invoice Number: ${data.invoiceNumber}
      - Amount Paid: ${formattedAmount}
      - Payment Method: ${data.paymentMethod.toUpperCase()}
      ${data.transactionId ? `- Transaction ID: ${data.transactionId}` : ''}
      - Payment Date: ${formattedDate}
      - Business: ${data.businessName}

      Thank you for your business!

      InvoNest Payment System
    `;

    return { subject, html, text };
  }

  /**
   * Generate payment notification email template for business owner
   */
  private getPaymentNotificationTemplate(data: {
    paymentId: string;
    receiptNumber: string;
    amount: number;
    invoiceNumber: string;
    customerName: string;
    paymentMethod: string;
    transactionId?: string;
    paymentDate: Date;
  }): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(data.amount);

    const formattedDate = new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(data.paymentDate));

    const subject = `💰 Payment Received - ${formattedAmount} for Invoice ${data.invoiceNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Received</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .notification-badge { background: #dbeafe; color: #1e40af; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .payment-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #10b981; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Received</h1>
            <p>New payment notification</p>
          </div>
          <div class="content">
            <div class="notification-badge">
              <h2 style="margin: 0;">Payment Successfully Received</h2>
              <p style="margin: 10px 0 0 0;">A customer has made a payment for one of your invoices.</p>
            </div>

            <div class="payment-details">
              <h3>Payment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Customer:</td>
                  <td style="padding: 8px 0;">${data.customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Invoice Number:</td>
                  <td style="padding: 8px 0;">${data.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Amount Received:</td>
                  <td style="padding: 8px 0;" class="amount">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Payment Method:</td>
                  <td style="padding: 8px 0;">${data.paymentMethod.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Receipt Number:</td>
                  <td style="padding: 8px 0;">${data.receiptNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Payment ID:</td>
                  <td style="padding: 8px 0;">${data.paymentId}</td>
                </tr>
                ${data.transactionId ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Transaction ID:</td>
                  <td style="padding: 8px 0;">${data.transactionId}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Payment Date:</td>
                  <td style="padding: 8px 0;">${formattedDate}</td>
                </tr>
              </table>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>The invoice has been automatically marked as paid</li>
              <li>A receipt has been generated and sent to the customer</li>
              <li>You can view the payment details in your InvoNest dashboard</li>
            </ul>

            <p>Congratulations on receiving this payment!</p>
          </div>
          <div class="footer">
            <p>This notification was sent by InvoNest Payment System.</p>
            <p>&copy; 2024 InvoNest. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Payment Received Notification

      You have received a new payment!

      Payment Details:
      - Customer: ${data.customerName}
      - Invoice Number: ${data.invoiceNumber}
      - Amount Received: ${formattedAmount}
      - Payment Method: ${data.paymentMethod.toUpperCase()}
      - Receipt Number: ${data.receiptNumber}
      - Payment ID: ${data.paymentId}
      ${data.transactionId ? `- Transaction ID: ${data.transactionId}` : ''}
      - Payment Date: ${formattedDate}

      The invoice has been automatically marked as paid and a receipt has been sent to the customer.

      InvoNest Payment System
    `;

    return { subject, html, text };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }


}

// Export the class instead of an instance to avoid early instantiation
export { EmailService };

// Create and export a singleton instance that will be created after env vars are loaded
let emailServiceInstance: EmailService | null = null;

export const getEmailService = (): EmailService => {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
};

export default getEmailService;
