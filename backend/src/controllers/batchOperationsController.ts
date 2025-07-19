import { Request, Response } from 'express';
import BatchOperationsService, { BatchInvoiceData } from '../services/batchOperationsService';

const batchService = BatchOperationsService.getInstance();

// Create multiple invoices
export const createBatchInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const batchData: BatchInvoiceData = req.body;

    // Validate required fields
    if (!batchData.customers || !Array.isArray(batchData.customers) || batchData.customers.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Customers array is required and must not be empty'
      });
      return;
    }

    // Validate that we have either a template or items
    if (!batchData.templateId && (!batchData.items || batchData.items.length === 0)) {
      res.status(400).json({
        success: false,
        message: 'Either templateId or items array is required'
      });
      return;
    }

    // Validate customers
    for (const customer of batchData.customers) {
      if (!customer.name) {
        res.status(400).json({
          success: false,
          message: 'All customers must have a name'
        });
        return;
      }
    }

    const result = await batchService.createBatchInvoices(userId.toString(), batchData);

    res.status(201).json({
      success: true,
      message: `Batch operation completed. ${result.successCount} invoices created, ${result.failureCount} failed.`,
      data: result
    });
  } catch (error) {
    console.error('Error in batch invoice creation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create batch invoices'
    });
  }
};

// Send emails to multiple invoices
export const sendBatchEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { invoiceIds } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invoice IDs array is required and must not be empty'
      });
      return;
    }

    const result = await batchService.sendBatchEmails(userId.toString(), invoiceIds);

    res.status(200).json({
      success: true,
      message: `Batch email operation completed. ${result.successCount} emails sent, ${result.failureCount} failed.`,
      data: result
    });
  } catch (error) {
    console.error('Error in batch email sending:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send batch emails'
    });
  }
};

// Update status of multiple invoices
export const updateBatchInvoiceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { invoiceIds, status, paymentStatus } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invoice IDs array is required and must not be empty'
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required'
      });
      return;
    }

    // Validate status values
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    const validPaymentStatuses = ['pending', 'partial', 'paid'];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
      return;
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      res.status(400).json({
        success: false,
        message: 'Invalid payment status value'
      });
      return;
    }

    const result = await batchService.updateBatchInvoiceStatus(userId.toString(), invoiceIds, status, paymentStatus);

    res.status(200).json({
      success: true,
      message: `Batch status update completed. ${result.successCount} invoices updated, ${result.failureCount} failed.`,
      data: result
    });
  } catch (error) {
    console.error('Error in batch status update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update batch invoice status'
    });
  }
};

// Delete multiple invoices
export const deleteBatchInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { invoiceIds } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invoice IDs array is required and must not be empty'
      });
      return;
    }

    const result = await batchService.deleteBatchInvoices(userId.toString(), invoiceIds);

    res.status(200).json({
      success: true,
      message: `Batch deletion completed. ${result.successCount} invoices deleted, ${result.failureCount} failed.`,
      data: result
    });
  } catch (error) {
    console.error('Error in batch deletion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete batch invoices'
    });
  }
};

// Get batch operation status/history
export const getBatchOperationHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    // This would typically fetch from a batch operations log table
    // For now, we'll return a simple response
    res.status(200).json({
      success: true,
      message: 'Batch operation history retrieved',
      data: {
        recentOperations: [],
        totalOperations: 0,
        note: 'Batch operation history tracking will be implemented in future updates'
      }
    });
  } catch (error) {
    console.error('Error fetching batch operation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch batch operation history'
    });
  }
};
