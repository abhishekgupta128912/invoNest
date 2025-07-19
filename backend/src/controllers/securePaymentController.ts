import { Request, Response } from 'express';
import SecurePaymentService from '../services/securePaymentService';
import Invoice from '../models/Invoice';

// Generate secure payment link
export const generatePaymentLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId, expiryHours } = req.body;

    if (!invoiceId) {
      res.status(400).json({
        success: false,
        message: 'Invoice ID is required'
      });
      return;
    }

    // Verify invoice belongs to user
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId: (req.user as any)?._id
    });

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    const result = await SecurePaymentService.generateSecurePaymentLink({
      invoiceId,
      amount: invoice.grandTotal,
      expiryHours: expiryHours || 24
    });

    res.status(201).json({
      success: true,
      message: 'Secure payment link generated',
      data: {
        tokenId: result.token.tokenId,
        paymentUrl: result.paymentUrl,
        qrCodeDataUrl: result.qrCodeDataUrl,
        expiresAt: result.token.expiresAt,
        amount: result.token.amount
      }
    });

  } catch (error) {
    console.error('Generate payment link error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating payment link'
    });
  }
};

// Validate payment token (public endpoint)
export const validatePaymentToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenId } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress;

    const validation = await SecurePaymentService.validatePaymentToken(tokenId, clientIP);

    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: validation.error || 'Invalid payment token'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment token is valid',
      data: {
        tokenId: validation.token?.tokenId,
        amount: validation.token?.amount,
        currency: validation.token?.currency,
        expiresAt: validation.token?.expiresAt,
        invoice: {
          invoiceNumber: validation.invoice?.invoiceNumber,
          invoiceDate: validation.invoice?.invoiceDate,
          customer: validation.invoice?.customer
        },
        seller: {
          name: validation.seller?.name,
          businessName: validation.seller?.businessName,
          upiId: validation.seller?.upiId
        }
      }
    });

  } catch (error) {
    console.error('Validate payment token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating payment token'
    });
  }
};

// Initiate payment using secure token (public endpoint)
export const initiateSecurePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenId } = req.params;
    const { paymentMethod, customerInfo } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!paymentMethod) {
      res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
      return;
    }

    const result = await SecurePaymentService.initiatePayment({
      tokenId,
      paymentMethod,
      customerInfo,
      ip: clientIP
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.error || 'Error initiating payment'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentId: result.paymentId
      }
    });

  } catch (error) {
    console.error('Initiate secure payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating payment'
    });
  }
};

// Complete payment using secure token (public endpoint)
export const completeSecurePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenId } = req.params;
    const { transactionId, gatewayResponse, customerInfo } = req.body;

    if (!transactionId) {
      res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
      return;
    }

    const result = await SecurePaymentService.completePayment(tokenId, transactionId, {
      gatewayResponse,
      customerInfo
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.error || 'Error completing payment'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment completed successfully',
      data: {
        paymentId: result.paymentId,
        receiptNumber: result.receiptNumber
      }
    });

  } catch (error) {
    console.error('Complete secure payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing payment'
    });
  }
};

// Get payment token details (authenticated)
export const getPaymentTokenDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenId } = req.params;

    const token = await SecurePaymentService.getPaymentTokenDetails(tokenId);

    if (!token) {
      res.status(404).json({
        success: false,
        message: 'Payment token not found'
      });
      return;
    }

    // Check if user owns this token
    if (token.userId.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment token details retrieved',
      data: token
    });

  } catch (error) {
    console.error('Get payment token details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payment token details'
    });
  }
};

// Get invoice payment tokens (authenticated)
export const getInvoicePaymentTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    // Verify invoice belongs to user
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId: (req.user as any)?._id
    });

    if (!invoice) {
      res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      return;
    }

    const tokens = await SecurePaymentService.getInvoicePaymentTokens(invoiceId);

    res.status(200).json({
      success: true,
      message: 'Invoice payment tokens retrieved',
      data: tokens
    });

  } catch (error) {
    console.error('Get invoice payment tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving invoice payment tokens'
    });
  }
};

// UPI callback handler (webhook)
export const upiCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tokenId } = req.params;
    const { transactionId, status, amount } = req.body;

    console.log(`📱 UPI callback received for token: ${tokenId}`, { transactionId, status, amount });

    if (status === 'SUCCESS' && transactionId) {
      const result = await SecurePaymentService.completePayment(tokenId, transactionId, {
        gatewayResponse: req.body
      });

      if (result.success) {
        console.log(`✅ UPI payment completed: ${tokenId} -> ${result.paymentId}`);
      } else {
        console.error(`❌ UPI payment completion failed: ${result.error}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'UPI callback processed'
    });

  } catch (error) {
    console.error('UPI callback error:', error);
    res.status(500).json({
      success: false,
      message: 'UPI callback processing failed'
    });
  }
};

// Cleanup expired tokens (admin)
export const cleanupExpiredTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedCount = await SecurePaymentService.cleanupExpiredTokens();

    res.status(200).json({
      success: true,
      message: 'Expired tokens cleaned up',
      data: {
        deletedCount
      }
    });

  } catch (error) {
    console.error('Cleanup expired tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up expired tokens'
    });
  }
};
