import PaymentToken, { IPaymentToken } from '../models/PaymentToken';
import Invoice from '../models/Invoice';
import User from '../models/User';
import InvoicePaymentService from './invoicePaymentService';
import QRCode from 'qrcode';

export interface SecurePaymentLinkData {
  invoiceId: string;
  amount: number;
  expiryHours?: number;
}

export interface PaymentInitiationData {
  tokenId: string;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  paymentMethod: 'upi' | 'bank_transfer' | 'card' | 'other';
  ip?: string;
}

class SecurePaymentService {
  /**
   * Generate a secure one-time payment token and QR code
   */
  async generateSecurePaymentLink(data: SecurePaymentLinkData): Promise<{
    token: IPaymentToken;
    qrCodeDataUrl: string;
    paymentUrl: string;
  }> {
    try {
      // Validate invoice
      const invoice = await Invoice.findById(data.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.paymentStatus === 'paid') {
        throw new Error('Invoice is already paid');
      }

      // Get seller info
      const seller = await User.findById(invoice.userId);
      if (!seller) {
        throw new Error('Seller not found');
      }

      // Generate secure payment token
      const token = await PaymentToken.generatePaymentToken(
        data.invoiceId,
        invoice.userId.toString(),
        data.amount,
        data.expiryHours || 24
      );

      // Create secure payment URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const paymentUrl = `${baseUrl}/pay/${token.tokenId}`;

      // Generate QR code with secure payment URL
      const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: '#1a202c',
          light: '#ffffff'
        }
      });

      console.log(`🔐 Secure payment token generated: ${token.tokenId} for invoice ${invoice.invoiceNumber}`);

      return {
        token,
        qrCodeDataUrl,
        paymentUrl
      };
    } catch (error) {
      console.error('Error generating secure payment link:', error);
      throw error;
    }
  }

  /**
   * Validate payment token and get payment details
   */
  async validatePaymentToken(tokenId: string, ip?: string): Promise<{
    isValid: boolean;
    token?: IPaymentToken;
    invoice?: any;
    seller?: any;
    error?: string;
  }> {
    try {
      const token = await PaymentToken.findOne({ tokenId });

      if (!token) {
        return { isValid: false, error: 'Payment token not found' };
      }

      // Track the scan
      await token.trackScan(ip);

      if (!token.isValid()) {
        if (token.isUsed) {
          return { isValid: false, error: 'Payment has already been completed' };
        } else {
          return { isValid: false, error: 'Payment link has expired' };
        }
      }

      // Get invoice and seller details
      const [invoice, seller] = await Promise.all([
        Invoice.findById(token.invoiceId),
        User.findById(token.userId)
      ]);

      if (!invoice || !seller) {
        return { isValid: false, error: 'Invoice or seller not found' };
      }

      return {
        isValid: true,
        token,
        invoice,
        seller
      };
    } catch (error) {
      console.error('Error validating payment token:', error);
      return { isValid: false, error: 'Error validating payment token' };
    }
  }

  /**
   * Initiate payment using secure token
   */
  async initiatePayment(data: PaymentInitiationData): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    try {
      // Validate token
      const validation = await this.validatePaymentToken(data.tokenId, data.ip);
      
      if (!validation.isValid || !validation.token || !validation.invoice) {
        return { success: false, error: validation.error };
      }

      const { token, invoice } = validation;

      // Record the payment
      const payment = await InvoicePaymentService.recordPayment({
        invoiceId: invoice._id.toString(),
        amount: token.amount,
        paymentMethod: data.paymentMethod,
        customerName: data.customerInfo?.name,
        customerEmail: data.customerInfo?.email,
        customerPhone: data.customerInfo?.phone,
        notes: `Payment via secure token: ${token.tokenId}`
      });

      // Mark token as used
      await token.markAsUsed(payment.paymentId);

      console.log(`💰 Payment initiated via secure token: ${token.tokenId} -> ${payment.paymentId}`);

      return {
        success: true,
        paymentId: payment.paymentId
      };
    } catch (error) {
      console.error('Error initiating payment:', error);
      return { success: false, error: 'Error processing payment' };
    }
  }

  /**
   * Complete payment using secure token
   */
  async completePayment(
    tokenId: string,
    transactionId: string,
    paymentData: {
      gatewayResponse?: any;
      customerInfo?: {
        name?: string;
        email?: string;
        phone?: string;
      };
    }
  ): Promise<{
    success: boolean;
    paymentId?: string;
    receiptNumber?: string;
    error?: string;
  }> {
    try {
      // Find the token
      const token = await PaymentToken.findOne({ tokenId });
      
      if (!token || !token.paymentId) {
        return { success: false, error: 'Invalid payment token or payment not initiated' };
      }

      // Complete the payment
      const payment = await InvoicePaymentService.verifyPayment({
        paymentId: token.paymentId,
        transactionId,
        amount: token.amount,
        status: 'completed',
        gatewayResponse: paymentData.gatewayResponse
      });

      // Update token with transaction ID
      if (!token.transactionId) {
        token.transactionId = transactionId;
        await token.save();
      }

      console.log(`✅ Payment completed via secure token: ${tokenId} -> ${payment.paymentId}`);

      return {
        success: true,
        paymentId: payment.paymentId,
        receiptNumber: payment.receiptNumber
      };
    } catch (error) {
      console.error('Error completing payment:', error);
      return { success: false, error: 'Error completing payment' };
    }
  }

  /**
   * Get payment token details
   */
  async getPaymentTokenDetails(tokenId: string): Promise<IPaymentToken | null> {
    return await PaymentToken.findOne({ tokenId });
  }

  /**
   * Get all payment tokens for an invoice
   */
  async getInvoicePaymentTokens(invoiceId: string): Promise<IPaymentToken[]> {
    return await PaymentToken.find({ invoiceId }).sort({ createdAt: -1 });
  }

  /**
   * Cleanup expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await PaymentToken.deleteMany({
      expiresAt: { $lt: new Date() },
      isUsed: false
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} expired payment tokens`);
    return result.deletedCount;
  }

  /**
   * Generate UPI payment URL with secure token
   */
  async generateSecureUPILink(
    invoiceId: string,
    upiId: string,
    businessName: string,
    amount: number
  ): Promise<{
    upiUrl: string;
    qrCodeDataUrl: string;
    tokenId: string;
  }> {
    try {
      // Generate secure payment token
      const { token } = await this.generateSecurePaymentLink({
        invoiceId,
        amount,
        expiryHours: 24
      });

      // Create UPI URL with secure callback
      const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/upi-callback/${token.tokenId}`;
      
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Payment for Invoice - Secure Token: ${token.tokenId}`)}&url=${encodeURIComponent(callbackUrl)}`;

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: '#1a202c',
          light: '#ffffff'
        }
      });

      return {
        upiUrl,
        qrCodeDataUrl,
        tokenId: token.tokenId
      };
    } catch (error) {
      console.error('Error generating secure UPI link:', error);
      throw error;
    }
  }
}

export default new SecurePaymentService();
