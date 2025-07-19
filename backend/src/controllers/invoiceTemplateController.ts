import { Request, Response } from 'express';
import InvoiceTemplate from '../models/InvoiceTemplate';
import Invoice from '../models/Invoice';

// Get all templates for a user
export const getInvoiceTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { category, active } = req.query;
    const filter: any = { userId };

    if (category) filter.category = category;
    if (active !== undefined) filter.isActive = active === 'true';

    const templates = await InvoiceTemplate.find(filter)
      .sort({ isDefault: -1, usageCount: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching invoice templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice templates'
    });
  }
};

// Get a specific template
export const getInvoiceTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const template = await InvoiceTemplate.findOne({ _id: id, userId: userId.toString() });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Invoice template not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching invoice template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice template'
    });
  }
};

// Create a new template
export const createInvoiceTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const {
      templateName,
      description,
      invoiceType,
      customerTemplate,
      itemsTemplate,
      defaultSettings,
      category,
      tags,
      isDefault
    } = req.body;

    // Validate required fields
    if (!templateName || !itemsTemplate?.length) {
      res.status(400).json({
        success: false,
        message: 'Template name and at least one item are required'
      });
      return;
    }

    const template = new InvoiceTemplate({
      userId: userId.toString(),
      templateName,
      description,
      invoiceType: invoiceType || 'gst',
      customerTemplate,
      itemsTemplate,
      defaultSettings: defaultSettings || {},
      category,
      tags: tags || [],
      isDefault: isDefault || false,
      usageCount: 0
    });

    await template.save();

    res.status(201).json({
      success: true,
      message: 'Invoice template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Error creating invoice template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice template'
    });
  }
};

// Update a template
export const updateInvoiceTemplate = async (req: Request, res: Response): Promise<void> => {
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
    delete updateData.usageCount;
    delete updateData.lastUsedAt;

    const template = await InvoiceTemplate.findOneAndUpdate(
      { _id: id, userId: userId.toString() },
      updateData,
      { new: true }
    );

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Invoice template not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Invoice template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Error updating invoice template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice template'
    });
  }
};

// Delete a template
export const deleteInvoiceTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const result = await InvoiceTemplate.deleteOne({ _id: id, userId: userId.toString() });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Invoice template not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Invoice template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice template'
    });
  }
};

// Create invoice from template
export const createInvoiceFromTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const template = await InvoiceTemplate.findOne({ _id: id, userId: userId.toString() });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Invoice template not found'
      });
      return;
    }

    // Get any overrides from request body
    const overrides = req.body;

    // Convert template to invoice data
    const invoiceData = template.toInvoiceData(overrides);

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber(userId.toString());

    // Create the invoice
    const invoice = new Invoice({
      ...invoiceData,
      invoiceNumber,
      invoiceDate: new Date(),
      userId: userId.toString(),
      status: 'draft',
      paymentStatus: 'pending'
    });

    await invoice.save();

    // Update template usage
    await template.incrementUsage();

    res.status(201).json({
      success: true,
      message: 'Invoice created from template successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error creating invoice from template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice from template'
    });
  }
};

// Set template as default
export const setDefaultTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const template = await InvoiceTemplate.findOne({ _id: id, userId: userId.toString() });

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Invoice template not found'
      });
      return;
    }

    template.isDefault = true;
    await template.save();

    res.status(200).json({
      success: true,
      message: 'Template set as default successfully',
      data: template
    });
  } catch (error) {
    console.error('Error setting default template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default template'
    });
  }
};

// Get template categories
export const getTemplateCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const categories = await InvoiceTemplate.distinct('category', { userId: userId.toString(), isActive: true });

    res.status(200).json({
      success: true,
      data: categories.filter(cat => cat) // Remove null/undefined values
    });
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template categories'
    });
  }
};

// Helper function to generate invoice number
async function generateInvoiceNumber(userId: string): Promise<string> {
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
