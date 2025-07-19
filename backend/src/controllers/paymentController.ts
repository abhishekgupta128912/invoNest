import { Request, Response } from 'express';
import InvoicePaymentService from '../services/invoicePaymentService';
import Invoice from '../models/Invoice';

// Record a manual payment
export const recordPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      invoiceId,
      amount,
      paymentMethod,
      transactionId,
      upiTransactionId,
      upiId,
      bankTransactionId,
      bankReference,
      customerName,
      customerEmail,
      customerPhone,
      notes
    } = req.body;

    if (!invoiceId || !amount || !paymentMethod) {
      res.status(400).json({
        success: false,
        message: 'Invoice ID, amount, and payment method are required'
      });
      return;
    }

    // Verify invoice belongs to user
    const invoice = await Invoice.findOne({ 
      _id: invoiceId, 
      userId: req.user?._id 
    });

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    const payment = await InvoicePaymentService.recordPayment({
      invoiceId,
      amount: parseFloat(amount),
      paymentMethod,
      transactionId,
      upiTransactionId,
      upiId,
      bankTransactionId,
      bankReference,
      customerName,
      customerEmail,
      customerPhone,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId: payment.paymentId,
        receiptNumber: payment.receiptNumber,
        status: payment.status
      }
    });

  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording payment'
    });
  }
};

// Verify payment (webhook or manual)
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      paymentId,
      transactionId,
      amount,
      status,
      gatewayResponse,
      failureReason
    } = req.body;

    if (!paymentId || !transactionId || !amount || !status) {
      res.status(400).json({
        success: false,
        message: 'Payment ID, transaction ID, amount, and status are required'
      });
      return;
    }

    const payment = await InvoicePaymentService.verifyPayment({
      paymentId,
      transactionId,
      amount: parseFloat(amount),
      status,
      gatewayResponse,
      failureReason
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: payment.paymentId,
        receiptNumber: payment.receiptNumber,
        status: payment.status,
        isVerified: payment.isVerified
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment'
    });
  }
};

// Get payment details
export const getPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    const payment = await InvoicePaymentService.getPaymentById(paymentId);

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
      return;
    }

    // Check if user owns this payment
    if (payment.userId.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment details retrieved',
      data: payment
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payment'
    });
  }
};

// Get invoice payments
export const getInvoicePayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    // Verify invoice belongs to user
    const invoice = await Invoice.findOne({ 
      _id: invoiceId, 
      userId: req.user?._id 
    });

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    const payments = await InvoicePaymentService.getInvoicePayments(invoiceId);

    res.status(200).json({
      success: true,
      message: 'Invoice payments retrieved',
      data: payments
    });

  } catch (error) {
    console.error('Get invoice payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving invoice payments'
    });
  }
};

// Get user payments
export const getUserPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 50 } = req.query;
    const userId = (req.user as any)?._id;

    const payments = await InvoicePaymentService.getUserPayments(
      userId.toString(),
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      message: 'User payments retrieved',
      data: payments
    });

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user payments'
    });
  }
};

// Manual verify payment (admin)
export const manualVerifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;
    const verifiedBy = (req.user as any)?._id;

    const payment = await InvoicePaymentService.manualVerifyPayment(
      paymentId,
      verifiedBy.toString(),
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Payment manually verified',
      data: {
        paymentId: payment.paymentId,
        receiptNumber: payment.receiptNumber,
        status: payment.status,
        isVerified: payment.isVerified
      }
    });

  } catch (error) {
    console.error('Manual verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error manually verifying payment'
    });
  }
};

// UPI payment webhook (for future integration)
export const upiWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // This would handle UPI payment confirmations from payment gateways
    // For now, it's a placeholder
    
    console.log('UPI Webhook received:', req.body);
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed'
    });

  } catch (error) {
    console.error('UPI webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};
