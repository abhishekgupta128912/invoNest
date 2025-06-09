import { Request, Response } from 'express';
import Invoice, { IInvoice } from '../models/Invoice';
import User from '../models/User';
import { calculateInvoiceGST, convertToInvoiceItems } from '../utils/gstCalculations';
import { generateInvoicePDF } from '../utils/pdfGenerator';

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
      terms
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

    // Validate seller has required address information
    if (!seller.address?.state) {
      res.status(400).json({
        success: false,
        message: 'Seller address information is incomplete. Please update your profile.'
      });
      return;
    }

    // Calculate GST for all items
    const calculation = calculateInvoiceGST(
      items,
      seller.address.state,
      customer.address.state
    );

    // Generate invoice number
    const invoiceNumber = await (Invoice as any).generateInvoiceNumber(userId);

    // Convert calculated items to database format
    const invoiceItems = convertToInvoiceItems(calculation.items);

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      userId,
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

    await invoice.save();

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
      User.findById(userId)
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
