import { Request, Response } from 'express';
import RecurringInvoice from '../models/RecurringInvoice';
import RecurringInvoiceService from '../services/recurringInvoiceService';

const recurringInvoiceService = RecurringInvoiceService.getInstance();

// Get all recurring invoices for a user
export const getRecurringInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const recurringInvoices = await recurringInvoiceService.getUserRecurringInvoices(userId.toString());

    res.status(200).json({
      success: true,
      data: recurringInvoices
    });
  } catch (error) {
    console.error('Error fetching recurring invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recurring invoices'
    });
  }
};

// Get a specific recurring invoice
export const getRecurringInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const recurringInvoice = await RecurringInvoice.findOne({ _id: id, userId: userId.toString() })
      .populate('generatedInvoices', 'invoiceNumber invoiceDate grandTotal status paymentStatus');

    if (!recurringInvoice) {
      res.status(404).json({
        success: false,
        message: 'Recurring invoice not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: recurringInvoice
    });
  } catch (error) {
    console.error('Error fetching recurring invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recurring invoice'
    });
  }
};

// Create a new recurring invoice
export const createRecurringInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const {
      templateName,
      frequency,
      interval,
      startDate,
      endDate,
      maxGenerations,
      invoiceTemplate
    } = req.body;

    // Validate required fields
    if (!templateName || !frequency || !startDate || !invoiceTemplate) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: templateName, frequency, startDate, invoiceTemplate'
      });
      return;
    }

    // Validate invoice template
    if (!invoiceTemplate.customer?.name || !invoiceTemplate.items?.length) {
      res.status(400).json({
        success: false,
        message: 'Invoice template must include customer name and at least one item'
      });
      return;
    }

    // Calculate next generation date
    const nextGenerationDate = new Date(startDate);

    const recurringInvoiceData = {
      templateName,
      frequency,
      interval: interval || 1,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      nextGenerationDate,
      maxGenerations,
      invoiceTemplate,
      isActive: true
    };

    const recurringInvoice = await recurringInvoiceService.createRecurringInvoice(userId.toString(), recurringInvoiceData);

    res.status(201).json({
      success: true,
      message: 'Recurring invoice created successfully',
      data: recurringInvoice
    });
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create recurring invoice'
    });
  }
};

// Update a recurring invoice
export const updateRecurringInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const updateData = req.body;
    
    // Don't allow updating certain fields
    delete updateData.userId;
    delete updateData.totalGenerated;
    delete updateData.generatedInvoices;
    delete updateData.lastGeneratedDate;

    const updatedRecurringInvoice = await recurringInvoiceService.updateRecurringInvoice(id, userId.toString(), updateData);

    res.status(200).json({
      success: true,
      message: 'Recurring invoice updated successfully',
      data: updatedRecurringInvoice
    });
  } catch (error) {
    console.error('Error updating recurring invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update recurring invoice'
    });
  }
};

// Delete a recurring invoice
export const deleteRecurringInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const deleted = await recurringInvoiceService.deleteRecurringInvoice(id, userId.toString());

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Recurring invoice not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Recurring invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recurring invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete recurring invoice'
    });
  }
};

// Toggle active status
export const toggleRecurringInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const recurringInvoice = await RecurringInvoice.findOne({ _id: id, userId: userId.toString() });

    if (!recurringInvoice) {
      res.status(404).json({
        success: false,
        message: 'Recurring invoice not found'
      });
      return;
    }

    recurringInvoice.isActive = !recurringInvoice.isActive;
    await recurringInvoice.save();

    res.status(200).json({
      success: true,
      message: `Recurring invoice ${recurringInvoice.isActive ? 'activated' : 'deactivated'} successfully`,
      data: recurringInvoice
    });
  } catch (error) {
    console.error('Error toggling recurring invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle recurring invoice status'
    });
  }
};

// Generate invoice manually from recurring template
export const generateInvoiceNow = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const recurringInvoice = await RecurringInvoice.findOne({ _id: id, userId: userId.toString() })
      .populate('userId', 'name email businessName');

    if (!recurringInvoice) {
      res.status(404).json({
        success: false,
        message: 'Recurring invoice not found'
      });
      return;
    }

    const generatedInvoice = await recurringInvoiceService.generateInvoiceFromRecurring(recurringInvoice);

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: generatedInvoice
    });
  } catch (error) {
    console.error('Error generating invoice manually:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
};
