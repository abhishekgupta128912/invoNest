import cron from 'node-cron';
import RecurringInvoice from '../models/RecurringInvoice';
import Invoice from '../models/Invoice';
import User from '../models/User';
import { getEmailService } from './emailService';
import { generateInvoicePDF } from '../utils/pdfGenerator';

export class RecurringInvoiceService {
  private static instance: RecurringInvoiceService;
  private emailService = getEmailService();

  constructor() {
    this.initializeCronJobs();
  }

  static getInstance(): RecurringInvoiceService {
    if (!RecurringInvoiceService.instance) {
      RecurringInvoiceService.instance = new RecurringInvoiceService();
    }
    return RecurringInvoiceService.instance;
  }

  /**
   * Initialize cron jobs for recurring invoice generation
   */
  private initializeCronJobs() {
    // Run daily at 8 AM to generate recurring invoices
    cron.schedule('0 8 * * *', async () => {
      console.log('Running daily recurring invoice generation...');
      await this.processRecurringInvoices();
    });
  }

  /**
   * Process all due recurring invoices
   */
  async processRecurringInvoices(): Promise<void> {
    try {
      const today = new Date();
      
      // Find all active recurring invoices that are due for generation
      const dueRecurringInvoices = await RecurringInvoice.find({
        isActive: true,
        nextGenerationDate: { $lte: today }
      }).populate('userId', 'name email businessName');

      console.log(`Found ${dueRecurringInvoices.length} recurring invoices due for generation`);

      for (const recurringInvoice of dueRecurringInvoices) {
        try {
          await this.generateInvoiceFromRecurring(recurringInvoice);
        } catch (error) {
          console.error(`Error generating invoice for recurring template ${recurringInvoice._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing recurring invoices:', error);
    }
  }

  /**
   * Generate a new invoice from a recurring invoice template
   */
  async generateInvoiceFromRecurring(recurringInvoice: any): Promise<any> {
    try {
      const user = recurringInvoice.userId;
      const template = recurringInvoice.invoiceTemplate;

      // Generate unique invoice number
      const invoiceNumber = await this.generateInvoiceNumber(user._id);

      // Calculate due date
      const invoiceDate = new Date();
      const dueDate = template.dueInDays ? 
        new Date(Date.now() + template.dueInDays * 24 * 60 * 60 * 1000) : 
        undefined;

      // Create the invoice
      const invoiceData = {
        invoiceNumber,
        invoiceDate,
        dueDate,
        userId: user._id,
        invoiceType: template.invoiceType,
        customer: template.customer,
        items: template.items,
        notes: template.notes,
        terms: template.terms,
        status: 'sent', // Auto-generated invoices are sent
        paymentStatus: 'pending'
      };

      const invoice = new Invoice(invoiceData);
      await invoice.save();

      // Update recurring invoice
      recurringInvoice.lastGeneratedDate = new Date();
      recurringInvoice.totalGenerated += 1;
      recurringInvoice.generatedInvoices.push(invoice._id);
      recurringInvoice.nextGenerationDate = recurringInvoice.calculateNextGenerationDate();

      // Check if we should deactivate (reached max generations or end date)
      if (recurringInvoice.maxGenerations && 
          recurringInvoice.totalGenerated >= recurringInvoice.maxGenerations) {
        recurringInvoice.isActive = false;
      }
      
      if (recurringInvoice.endDate && new Date() > recurringInvoice.endDate) {
        recurringInvoice.isActive = false;
      }

      await recurringInvoice.save();

      // Send email notification to customer if email is provided
      if (template.customer.email) {
        await this.sendRecurringInvoiceEmail(invoice, user, template.customer.email);
      }

      // Send notification to user
      await this.sendUserNotification(user, invoice, recurringInvoice.templateName);

      console.log(`Generated recurring invoice ${invoice.invoiceNumber} for user ${user.email}`);
      return invoice;

    } catch (error) {
      console.error('Error generating invoice from recurring template:', error);
      throw error;
    }
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(userId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    
    // Find the last invoice number for this user this month
    const lastInvoice = await Invoice.findOne({
      userId,
      invoiceNumber: new RegExp(`^INV-${year}${month}-`)
    }).sort({ invoiceNumber: -1 });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Send recurring invoice email to customer
   */
  private async sendRecurringInvoiceEmail(invoice: any, user: any, customerEmail: string): Promise<void> {
    try {
      // Generate PDF buffer
      const pdfBuffer = await generateInvoicePDF({ invoice, seller: user });

      const invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer.name,
        amount: invoice.grandTotal,
        dueDate: invoice.dueDate,
        businessName: user.businessName || user.name,
        invoiceUrl: `${process.env.FRONTEND_URL}/dashboard/invoices/${invoice._id}`,
        upiId: user.upiId,
        bankDetails: user.bankDetails
      };

      await this.emailService.sendInvoiceEmail(customerEmail, invoiceData, pdfBuffer);
    } catch (error) {
      console.error('Error sending recurring invoice email:', error);
    }
  }

  /**
   * Send notification to user about generated invoice
   */
  private async sendUserNotification(user: any, invoice: any, templateName: string): Promise<void> {
    try {
      const subject = `Recurring Invoice Generated: ${invoice.invoiceNumber}`;
      const message = `
        Your recurring invoice "${templateName}" has been automatically generated.
        
        Invoice Number: ${invoice.invoiceNumber}
        Customer: ${invoice.customer.name}
        Amount: ₹${invoice.grandTotal.toLocaleString('en-IN')}
        Due Date: ${invoice.dueDate ? invoice.dueDate.toLocaleDateString('en-IN') : 'Not set'}
        
        View Invoice: ${process.env.FRONTEND_URL}/dashboard/invoices/${invoice._id}
      `;

      await this.emailService.sendEmail(user.email, subject, message, message);
    } catch (error) {
      console.error('Error sending user notification:', error);
    }
  }

  /**
   * Create a new recurring invoice
   */
  async createRecurringInvoice(userId: string, recurringInvoiceData: any): Promise<any> {
    try {
      const recurringInvoice = new RecurringInvoice({
        ...recurringInvoiceData,
        userId,
        totalGenerated: 0,
        generatedInvoices: []
      });

      await recurringInvoice.save();
      return recurringInvoice;
    } catch (error) {
      console.error('Error creating recurring invoice:', error);
      throw error;
    }
  }

  /**
   * Get user's recurring invoices
   */
  async getUserRecurringInvoices(userId: string): Promise<any[]> {
    try {
      return await RecurringInvoice.find({ userId })
        .populate('generatedInvoices', 'invoiceNumber invoiceDate grandTotal status paymentStatus')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching user recurring invoices:', error);
      throw error;
    }
  }

  /**
   * Update recurring invoice
   */
  async updateRecurringInvoice(recurringInvoiceId: string, userId: string, updateData: any): Promise<any> {
    try {
      const recurringInvoice = await RecurringInvoice.findOneAndUpdate(
        { _id: recurringInvoiceId, userId },
        updateData,
        { new: true }
      );

      if (!recurringInvoice) {
        throw new Error('Recurring invoice not found');
      }

      return recurringInvoice;
    } catch (error) {
      console.error('Error updating recurring invoice:', error);
      throw error;
    }
  }

  /**
   * Delete recurring invoice
   */
  async deleteRecurringInvoice(recurringInvoiceId: string, userId: string): Promise<boolean> {
    try {
      const result = await RecurringInvoice.deleteOne({ _id: recurringInvoiceId, userId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting recurring invoice:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerRecurringInvoiceGeneration(): Promise<void> {
    console.log('Manually triggering recurring invoice generation...');
    await this.processRecurringInvoices();
  }
}

export default RecurringInvoiceService;
