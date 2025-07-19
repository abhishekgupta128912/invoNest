import InvoicePayment, { IInvoicePayment } from '../models/InvoicePayment';
import Invoice from '../models/Invoice';
import User from '../models/User';
import { getEmailService } from './emailService';
// import { generatePaymentReceiptPDF } from '../utils/receiptGenerator'; // We'll create this
import crypto from 'crypto';

export interface PaymentData {
  invoiceId: string;
  amount: number;
  paymentMethod: 'upi' | 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'other';
  transactionId?: string;
  upiTransactionId?: string;
  upiId?: string;
  bankTransactionId?: string;
  bankReference?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerificationData {
  paymentId: string;
  transactionId: string;
  amount: number;
  status: 'completed' | 'failed';
  gatewayResponse?: any;
  failureReason?: string;
}

class InvoicePaymentService {
  /**
   * Record a new payment
   */
  async recordPayment(paymentData: PaymentData): Promise<IInvoicePayment> {
    try {
      // Find the invoice
      const invoice = await Invoice.findById(paymentData.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Generate unique payment ID
      const paymentId = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // Create payment record
      const payment = new InvoicePayment({
        invoiceId: paymentData.invoiceId,
        userId: invoice.userId,
        paymentId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        transactionId: paymentData.transactionId,
        upiTransactionId: paymentData.upiTransactionId,
        upiId: paymentData.upiId,
        bankTransactionId: paymentData.bankTransactionId,
        bankReference: paymentData.bankReference,
        customerName: paymentData.customerName || invoice.customer.name,
        customerEmail: paymentData.customerEmail || invoice.customer.email,
        customerPhone: paymentData.customerPhone || invoice.customer.phone,
        notes: paymentData.notes,
        metadata: paymentData.metadata,
        status: 'pending'
      });

      await payment.save();

      console.log(`💰 Payment recorded: ${paymentId} for invoice ${invoice.invoiceNumber}`);
      return payment;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Verify and complete payment
   */
  async verifyPayment(verificationData: PaymentVerificationData): Promise<IInvoicePayment> {
    try {
      const payment = await InvoicePayment.findOne({ paymentId: verificationData.paymentId });
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      payment.status = verificationData.status;
      payment.transactionId = verificationData.transactionId;
      payment.gatewayResponse = verificationData.gatewayResponse;
      payment.failureReason = verificationData.failureReason;
      payment.isVerified = verificationData.status === 'completed';
      payment.verifiedAt = new Date();

      if (verificationData.status === 'completed') {
        // Update invoice status
        const invoice = await Invoice.findById(payment.invoiceId);
        if (invoice) {
          invoice.paymentStatus = 'paid';
          invoice.paymentDate = new Date();
          invoice.status = 'paid';
          await invoice.save();
        }

        // Generate receipt
        await this.generateReceipt(payment);

        // Send confirmation emails
        await this.sendPaymentConfirmation(payment);
      }

      await payment.save();

      console.log(`✅ Payment ${verificationData.status}: ${payment.paymentId}`);
      return payment;
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  }

  /**
   * Generate payment receipt
   */
  private async generateReceipt(payment: IInvoicePayment): Promise<void> {
    try {
      const invoice = await Invoice.findById(payment.invoiceId);
      const user = await User.findById(payment.userId);

      if (!invoice || !user) {
        throw new Error('Invoice or user not found for receipt generation');
      }

      // Generate receipt PDF (placeholder for now)
      // const receiptBuffer = await generatePaymentReceiptPDF({
      //   payment,
      //   invoice,
      //   seller: user
      // });

      // In a real implementation, you'd save this to cloud storage
      // For now, we'll just mark it as generated
      payment.receiptGenerated = true;
      payment.receiptUrl = `/receipts/${payment.receiptNumber}.pdf`;

      console.log(`📄 Receipt generated: ${payment.receiptNumber}`);
    } catch (error) {
      console.error('Error generating receipt:', error);
      // Don't throw error as this shouldn't block payment completion
    }
  }

  /**
   * Send payment confirmation emails
   */
  private async sendPaymentConfirmation(payment: IInvoicePayment): Promise<void> {
    try {
      const invoice = await Invoice.findById(payment.invoiceId);
      const user = await User.findById(payment.userId);

      if (!invoice || !user) {
        throw new Error('Invoice or user not found for email confirmation');
      }

      const emailService = getEmailService();

      // Send confirmation to customer
      if (payment.customerEmail) {
        await emailService.sendPaymentConfirmationEmail(
          payment.customerEmail,
          {
            paymentId: payment.paymentId,
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            invoiceNumber: invoice.invoiceNumber,
            businessName: user.businessName || user.name,
            paymentMethod: payment.paymentMethod,
            transactionId: payment.transactionId,
            paymentDate: payment.paymentDate
          }
        );
      }

      // Send notification to business owner
      await emailService.sendPaymentNotificationEmail(
        user.email,
        {
          paymentId: payment.paymentId,
          receiptNumber: payment.receiptNumber,
          amount: payment.amount,
          invoiceNumber: invoice.invoiceNumber,
          customerName: payment.customerName || 'Unknown',
          paymentMethod: payment.paymentMethod,
          transactionId: payment.transactionId,
          paymentDate: payment.paymentDate
        }
      );

      console.log(`📧 Payment confirmation emails sent for ${payment.paymentId}`);
    } catch (error) {
      console.error('Error sending payment confirmation emails:', error);
      // Don't throw error as this shouldn't block payment completion
    }
  }

  /**
   * Get payment history for an invoice
   */
  async getInvoicePayments(invoiceId: string): Promise<IInvoicePayment[]> {
    return await InvoicePayment.find({ invoiceId }).sort({ createdAt: -1 });
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<IInvoicePayment | null> {
    return await InvoicePayment.findOne({ paymentId });
  }

  /**
   * Get payments for a user
   */
  async getUserPayments(userId: string, limit: number = 50): Promise<IInvoicePayment[]> {
    return await InvoicePayment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('invoiceId', 'invoiceNumber customer');
  }

  /**
   * Manual payment verification (for admin)
   */
  async manualVerifyPayment(paymentId: string, verifiedBy: string, notes?: string): Promise<IInvoicePayment> {
    const payment = await InvoicePayment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.isVerified = true;
    payment.verifiedAt = new Date();
    payment.verifiedBy = verifiedBy as any;
    payment.status = 'completed';
    if (notes) {
      payment.notes = notes;
    }

    // Update invoice status
    const invoice = await Invoice.findById(payment.invoiceId);
    if (invoice) {
      invoice.paymentStatus = 'paid';
      invoice.paymentDate = new Date();
      invoice.status = 'paid';
      await invoice.save();
    }

    await payment.save();

    // Generate receipt and send confirmations
    await this.generateReceipt(payment);
    await this.sendPaymentConfirmation(payment);

    return payment;
  }
}

export default new InvoicePaymentService();
