import express from 'express';
import { authenticateApiKey, checkApiPermission } from '../../../middleware/apiAuth';
import Invoice from '../../../models/Invoice';
import { ApiAuthRequest } from '../../../middleware/apiAuth';

const router = express.Router();

// All routes require API key authentication
router.use(authenticateApiKey);

/**
 * @route   GET /api/v1/invoices
 * @desc    Get invoices for API key user
 * @access  Private (API Key with invoices.read permission)
 */
router.get('/', checkApiPermission('invoices', 'read'), async (req: ApiAuthRequest, res) => {
  try {
    const userId = req.apiKey?.userId;
    const { page = 1, limit = 10, status, paymentStatus } = req.query;

    // Build query
    const query: any = { userId };
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // Pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Get invoices
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-hash'); // Don't expose blockchain hash via API

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error getting invoices via API:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/invoices/:id
 * @desc    Get specific invoice
 * @access  Private (API Key with invoices.read permission)
 */
router.get('/:id', checkApiPermission('invoices', 'read'), async (req: ApiAuthRequest, res) => {
  try {
    const userId = req.apiKey?.userId;
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId }).select('-hash');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error getting invoice via API:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/invoices
 * @desc    Create new invoice
 * @access  Private (API Key with invoices.create permission)
 */
router.post('/', checkApiPermission('invoices', 'create'), async (req: ApiAuthRequest, res) => {
  try {
    const userId = req.apiKey?.userId;
    const invoiceData = req.body;

    // Validate required fields
    const requiredFields = ['customer', 'items', 'invoiceDate'];
    for (const field of requiredFields) {
      if (!invoiceData[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    // Create invoice
    const invoice = new Invoice({
      ...invoiceData,
      userId,
      status: 'sent' // API created invoices are automatically sent
    });

    // Generate invoice number if not provided
    if (!invoice.invoiceNumber) {
      invoice.invoiceNumber = await (Invoice as any).generateInvoiceNumber(userId);
    }

    // Generate hash
    invoice.hash = invoice.generateHash();

    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error creating invoice via API:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/v1/invoices/:id
 * @desc    Update invoice
 * @access  Private (API Key with invoices.update permission)
 */
router.put('/:id', checkApiPermission('invoices', 'update'), async (req: ApiAuthRequest, res) => {
  try {
    const userId = req.apiKey?.userId;
    const { id } = req.params;
    const updates = req.body;

    // Find invoice
    const invoice = await Invoice.findOne({ _id: id, userId });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Prevent updating paid invoices
    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid invoices'
      });
    }

    // Apply updates
    Object.assign(invoice, updates);
    
    // Regenerate hash if content changed
    invoice.hash = invoice.generateHash();

    await invoice.save();

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error updating invoice via API:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route   DELETE /api/v1/invoices/:id
 * @desc    Delete invoice
 * @access  Private (API Key with invoices.delete permission)
 */
router.delete('/:id', checkApiPermission('invoices', 'delete'), async (req: ApiAuthRequest, res) => {
  try {
    const userId = req.apiKey?.userId;
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Prevent deleting paid invoices
    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoices'
      });
    }

    await Invoice.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice via API:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
