import Invoice from '../models/Invoice';
import InvoiceTemplate from '../models/InvoiceTemplate';
import { getEmailService } from './emailService';
import { generateInvoicePDF } from '../utils/pdfGenerator';

export interface BatchInvoiceData {
  templateId?: string;
  customers: Array<{
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
    stateCode?: string;
  }>;
  items?: Array<{
    description: string;
    quantity: number;
    rate: number;
    unit?: string;
    hsnCode?: string;
    gstRate?: number;
  }>;
  commonData?: {
    invoiceType?: 'gst' | 'non-gst';
    notes?: string;
    terms?: string;
    dueInDays?: number;
  };
}

export interface BatchOperationResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    success: boolean;
    data?: any;
    error?: string;
    customer: string;
  }>;
}

export class BatchOperationsService {
  private static instance: BatchOperationsService;
  private emailService = getEmailService();

  static getInstance(): BatchOperationsService {
    if (!BatchOperationsService.instance) {
      BatchOperationsService.instance = new BatchOperationsService();
    }
    return BatchOperationsService.instance;
  }

  /**
   * Create multiple invoices from a template or common data
   */
  async createBatchInvoices(userId: string, batchData: BatchInvoiceData): Promise<BatchOperationResult> {
    const results: BatchOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      results: []
    };

    try {
      let template: any = null;
      
      // Get template if provided
      if (batchData.templateId) {
        template = await InvoiceTemplate.findOne({ 
          _id: batchData.templateId, 
          userId 
        });
        
        if (!template) {
          throw new Error('Template not found');
        }
      }

      // Process each customer
      for (const customer of batchData.customers) {
        results.totalProcessed++;
        
        try {
          const invoice = await this.createSingleInvoice(userId, customer, template, batchData);
          
          results.results.push({
            success: true,
            data: invoice,
            customer: customer.name
          });
          
          results.successCount++;
          
          // Send email if customer has email
          if (customer.email) {
            await this.sendBatchInvoiceEmail(invoice, customer.email, userId);
          }
          
        } catch (error) {
          results.results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            customer: customer.name
          });
          
          results.failureCount++;
        }
      }

      // Update template usage if used
      if (template) {
        template.usageCount += results.successCount;
        template.lastUsedAt = new Date();
        await template.save();
      }

      results.success = results.successCount > 0;
      return results;

    } catch (error) {
      console.error('Error in batch invoice creation:', error);
      throw error;
    }
  }

  /**
   * Create a single invoice for batch processing
   */
  private async createSingleInvoice(
    userId: string, 
    customer: any, 
    template: any, 
    batchData: BatchInvoiceData
  ): Promise<any> {
    // Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber(userId);
    
    // Determine invoice data source (template or batch data)
    const invoiceType = template?.invoiceType || batchData.commonData?.invoiceType || 'gst';
    const items = template?.itemsTemplate || batchData.items || [];
    const notes = template?.defaultSettings?.notes || batchData.commonData?.notes;
    const terms = template?.defaultSettings?.terms || batchData.commonData?.terms;
    const dueInDays = template?.defaultSettings?.dueInDays || batchData.commonData?.dueInDays || 30;

    // Calculate due date
    const invoiceDate = new Date();
    const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

    // Create invoice
    const invoiceData = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      userId,
      invoiceType,
      customer,
      items,
      notes,
      terms,
      status: 'sent', // Batch invoices are automatically sent
      paymentStatus: 'pending'
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();
    
    return invoice;
  }

  /**
   * Send batch invoice emails
   */
  async sendBatchEmails(userId: string, invoiceIds: string[]): Promise<BatchOperationResult> {
    const results: BatchOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      results: []
    };

    try {
      const invoices = await Invoice.find({
        _id: { $in: invoiceIds },
        userId
      }).populate('userId', 'name email businessName');

      for (const invoice of invoices) {
        results.totalProcessed++;
        
        try {
          if (!invoice.customer.email) {
            throw new Error('Customer email not provided');
          }

          await this.sendBatchInvoiceEmail(invoice, invoice.customer.email, userId);
          
          results.results.push({
            success: true,
            data: { invoiceNumber: invoice.invoiceNumber },
            customer: invoice.customer.name
          });
          
          results.successCount++;
          
        } catch (error) {
          results.results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            customer: invoice.customer.name
          });
          
          results.failureCount++;
        }
      }

      results.success = results.successCount > 0;
      return results;

    } catch (error) {
      console.error('Error in batch email sending:', error);
      throw error;
    }
  }

  /**
   * Update multiple invoices status
   */
  async updateBatchInvoiceStatus(
    userId: string, 
    invoiceIds: string[], 
    status: string,
    paymentStatus?: string
  ): Promise<BatchOperationResult> {
    const results: BatchOperationResult = {
      success: false,
      totalProcessed: invoiceIds.length,
      successCount: 0,
      failureCount: 0,
      results: []
    };

    try {
      const updateData: any = { status };
      if (paymentStatus) updateData.paymentStatus = paymentStatus;

      const updateResult = await Invoice.updateMany(
        { _id: { $in: invoiceIds }, userId },
        updateData
      );

      results.successCount = updateResult.modifiedCount;
      results.failureCount = invoiceIds.length - updateResult.modifiedCount;
      results.success = results.successCount > 0;

      // Create individual results
      for (let i = 0; i < invoiceIds.length; i++) {
        results.results.push({
          success: i < results.successCount,
          customer: `Invoice ${i + 1}`,
          data: i < results.successCount ? { updated: true } : undefined,
          error: i >= results.successCount ? 'Update failed' : undefined
        });
      }

      return results;

    } catch (error) {
      console.error('Error in batch status update:', error);
      throw error;
    }
  }

  /**
   * Delete multiple invoices
   */
  async deleteBatchInvoices(userId: string, invoiceIds: string[]): Promise<BatchOperationResult> {
    const results: BatchOperationResult = {
      success: false,
      totalProcessed: invoiceIds.length,
      successCount: 0,
      failureCount: 0,
      results: []
    };

    try {
      const deleteResult = await Invoice.deleteMany({
        _id: { $in: invoiceIds },
        userId
      });

      results.successCount = deleteResult.deletedCount;
      results.failureCount = invoiceIds.length - deleteResult.deletedCount;
      results.success = results.successCount > 0;

      // Create individual results
      for (let i = 0; i < invoiceIds.length; i++) {
        results.results.push({
          success: i < results.successCount,
          customer: `Invoice ${i + 1}`,
          data: i < results.successCount ? { deleted: true } : undefined,
          error: i >= results.successCount ? 'Delete failed' : undefined
        });
      }

      return results;

    } catch (error) {
      console.error('Error in batch deletion:', error);
      throw error;
    }
  }

  /**
   * Send batch invoice email
   */
  private async sendBatchInvoiceEmail(invoice: any, customerEmail: string, userId: string): Promise<void> {
    try {
      const user = invoice.userId || await this.getUserData(userId);

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
      console.error('Error sending batch invoice email:', error);
      throw error;
    }
  }

  /**
   * Get user data
   */
  private async getUserData(userId: string): Promise<any> {
    const User = require('../models/User').default;
    return await User.findById(userId).select('name email businessName');
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
}

export default BatchOperationsService;
