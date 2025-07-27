import { Request, Response } from 'express';
import crypto from 'crypto';
import Invoice, { IInvoice } from '../models/Invoice';
import User from '../models/User';
import { calculateInvoiceGST, calculateInvoiceSimple, convertToInvoiceItems } from '../utils/gstCalculations';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import SubscriptionService from '../services/SubscriptionService';
import { getEmailService } from '../services/emailService';
import EmailQueueService from '../services/emailQueueService';
import { timeOperation } from '../utils/performanceMonitor';
import PerformanceMonitor from '../utils/performanceMonitor';

// Create new invoice
export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const {
      customer,
      items,
      dueDate,
      notes,
      terms,
      invoiceType = 'gst' // Default to GST invoice
    } = req.body;

    // Get user details for seller information
    const seller = await User.findById(userId);
    if (!seller) {
      res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
      return;
    }

    // Validate seller has required address information for GST invoices
    if (invoiceType === 'gst' && !seller.address?.state) {
      res.status(400).json({
        success: false,
        message: 'Seller address information is incomplete. Please update your profile for GST invoices.'
      });
      return;
    }

    // Calculate totals based on invoice type
    let calculation;
    if (invoiceType === 'gst') {
      // Validate GST-specific requirements
      if (!customer.address?.state) {
        res.status(400).json({
          success: false,
          message: 'Customer state is required for GST invoices.'
        });
        return;
      }

      calculation = calculateInvoiceGST(
        items,
        seller.address!.state,
        customer.address.state
      );
    } else {
      // Simple calculation for non-GST invoices
      calculation = calculateInvoiceSimple(items);
    }

    // Generate invoice number
    const invoiceNumber = await (Invoice as any).generateInvoiceNumber(userId);

    // Convert calculated items to database format
    const invoiceItems = convertToInvoiceItems(calculation.items);

    // Create invoice
    console.log('Creating invoice with data:', {
      invoiceNumber,
      userId,
      customerName: customer.name,
      itemsCount: invoiceItems.length,
      grandTotal: calculation.grandTotal
    });

    const invoice = new Invoice({
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      userId,
      invoiceType,
      customer,
      items: invoiceItems,
      subtotal: calculation.subtotal,
      totalDiscount: calculation.totalDiscount,
      taxableAmount: calculation.taxableAmount,
      totalCGST: calculation.totalCGST,
      totalSGST: calculation.totalSGST,
      totalIGST: calculation.totalIGST,
      totalTax: calculation.totalTax,
      grandTotal: calculation.grandTotal,
      notes,
      terms
    });

    console.log('Invoice object created, saving...');
    await invoice.save();
    console.log('Invoice saved successfully with hash:', invoice.hash);

    // Increment usage after successful invoice creation
    try {
      await SubscriptionService.trackUsage(userId.toString(), 'invoice', 1);
      console.log('Usage incremented successfully for invoice creation');
    } catch (error) {
      console.error('Failed to increment usage:', error);
      // Don't fail the request if usage tracking fails
    }

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          customer: invoice.customer,
          items: invoice.items,
          subtotal: invoice.subtotal,
          totalDiscount: invoice.totalDiscount,
          taxableAmount: invoice.taxableAmount,
          totalCGST: invoice.totalCGST,
          totalSGST: invoice.totalSGST,
          totalIGST: invoice.totalIGST,
          totalTax: invoice.totalTax,
          grandTotal: invoice.grandTotal,
          status: invoice.status,
          paymentStatus: invoice.paymentStatus,
          hash: invoice.hash,
          notes: invoice.notes,
          terms: invoice.terms,
          createdAt: invoice.createdAt
        }
      }
    });

  } catch (error: any) {
    console.error('Create invoice error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all invoices for user
export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 10, status, paymentStatus, search } = req.query;

    // Build query
    const query: any = { userId };
    
    if (status) {
      query.status = status;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Invoice.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: {
        invoices,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single invoice
export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId });
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Invoice retrieved successfully',
      data: { invoice }
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update invoice
export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const updates = req.body;

    const invoice = await Invoice.findOne({ _id: id, userId });
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    // Don't allow updates to paid invoices
    if (invoice.paymentStatus === 'paid') {
      res.status(400).json({
        success: false,
        message: 'Cannot update paid invoices'
      });
      return;
    }

    // If items are being updated, recalculate GST
    if (updates.items || updates.customer) {
      const seller = await User.findById(userId);
      if (!seller?.address?.state) {
        res.status(400).json({
          success: false,
          message: 'Seller address information is incomplete'
        });
        return;
      }

      const itemsToCalculate = updates.items || invoice.items.map(item => ({
        description: item.description,
        hsn: item.hsn,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discount: item.discount
      }));

      const customerForCalculation = updates.customer || invoice.customer;

      const calculation = calculateInvoiceGST(
        itemsToCalculate,
        seller.address.state,
        customerForCalculation.address.state
      );

      const invoiceItems = convertToInvoiceItems(calculation.items);

      Object.assign(updates, {
        items: invoiceItems,
        subtotal: calculation.subtotal,
        totalDiscount: calculation.totalDiscount,
        taxableAmount: calculation.taxableAmount,
        totalCGST: calculation.totalCGST,
        totalSGST: calculation.totalSGST,
        totalIGST: calculation.totalIGST,
        totalTax: calculation.totalTax,
        grandTotal: calculation.grandTotal
      });
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice: updatedInvoice }
    });

  } catch (error: any) {
    console.error('Update invoice error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete invoice
export const deleteInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId });
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    // Don't allow deletion of paid invoices
    if (invoice.paymentStatus === 'paid') {
      res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoices'
      });
      return;
    }

    await Invoice.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Generate and download invoice PDF
export const downloadInvoicePDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const [invoice, seller] = await Promise.all([
      Invoice.findOne({ _id: id, userId }),
      User.findById(userId).lean(false) // Ensure we get the latest data, not cached
    ]);
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    if (!seller) {
      res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
      return;
    }

    // Debug: Log seller data to verify it's fresh
    console.log(`🔍 Seller data for invoice ${invoice.invoiceNumber}:`, {
      name: seller.name,
      businessName: seller.businessName,
      userId: seller._id
    });

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF({ invoice, seller });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF'
    });
  }
};

// Send invoice via email
export const sendInvoiceEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { email } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
      return;
    }

    // Find invoice and seller in parallel for better performance
    const [invoice, seller] = await Promise.all([
      Invoice.findOne({ _id: id, userId }),
      User.findById(userId).lean(false) // Ensure we get the latest data, not cached
    ]);

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    if (!seller) {
      res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
      return;
    }

    console.log(`📧 Starting email process for invoice ${invoice.invoiceNumber}`);

    // Debug: Log seller data to verify it's fresh
    console.log(`🔍 Seller data for email ${invoice.invoiceNumber}:`, {
      name: seller.name,
      businessName: seller.businessName,
      userId: seller._id
    });

    const emailStartTime = Date.now();
    const endEmailProcess = timeOperation('invoice_email_process');
    const endPDFGeneration = timeOperation('pdf_generation');

    // Generate PDF and prepare email data in parallel
    const [pdfBuffer] = await Promise.all([
      generateInvoicePDF({ invoice, seller })
    ]);

    endPDFGeneration({ invoiceNumber: invoice.invoiceNumber });

    // Prepare invoice data for email
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      amount: invoice.grandTotal,
      dueDate: invoice.dueDate,
      businessName: seller.businessName || seller.name,
      invoiceUrl: `${process.env.FRONTEND_URL}/dashboard/invoices/${invoice._id}`,
      upiId: seller.upiId,
      bankDetails: seller.bankDetails
    };

    // Queue email for background processing (much faster response)
    const emailQueue = EmailQueueService.getInstance();
    const jobId = await emailQueue.queueInvoiceEmail(email, invoiceData, pdfBuffer, true);

    const emailEndTime = Date.now();
    endEmailProcess({
      invoiceNumber: invoice.invoiceNumber,
      emailJobId: jobId,
      recipientEmail: email
    });

    // Update invoice status to 'sent' if it was 'draft'
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      await invoice.save();
    }

    res.status(200).json({
      success: true,
      message: 'Invoice email queued successfully and will be sent shortly',
      data: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        sentTo: email,
        status: invoice.status,
        emailJobId: jobId,
        processingTime: `${emailEndTime - emailStartTime}ms`
      }
    });

  } catch (error) {
    console.error('Send invoice email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invoice email'
    });
  }
};

// Get email queue status (for debugging)
export const getEmailQueueStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode'
      });
      return;
    }

    const emailQueue = EmailQueueService.getInstance();
    const status = emailQueue.getQueueStatus();

    res.status(200).json({
      success: true,
      message: 'Email queue status retrieved',
      data: status
    });

  } catch (error) {
    console.error('Get email queue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving email queue status'
    });
  }
};

// Get performance statistics (for debugging)
export const getPerformanceStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode'
      });
      return;
    }

    const monitor = PerformanceMonitor.getInstance();
    const { operation } = req.query;

    const stats = monitor.getStats(operation as string);
    const operations = monitor.getOperations();

    res.status(200).json({
      success: true,
      message: 'Performance statistics retrieved',
      data: {
        stats,
        availableOperations: operations
      }
    });

  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving performance statistics'
    });
  }
};

// Verify invoice integrity
export const verifyInvoiceIntegrity = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId });
    
    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    const isValid = invoice.verifyIntegrity();

    res.status(200).json({
      success: true,
      message: 'Invoice integrity verified',
      data: {
        isValid,
        hash: invoice.hash,
        message: isValid ? 'Invoice integrity is intact' : 'Invoice has been tampered with'
      }
    });

  } catch (error) {
    console.error('Verify integrity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
