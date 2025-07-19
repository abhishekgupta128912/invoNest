import crypto from 'crypto';
import Razorpay from 'razorpay';
import Payment from '../models/Payment';
import Subscription from '../models/Subscription';
import User from '../models/User';

// Lazy initialization of Razorpay
let razorpay: Razorpay | null = null;

function getRazorpayInstance(): Razorpay {
  const isRazorpayConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;

  if (!isRazorpayConfigured) {
    throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
  }

  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || ''
    });
  }

  return razorpay;
}

export class PaymentService {
  
  /**
   * Create Razorpay order for subscription payment
   */
  static async createSubscriptionOrder(
    userId: string,
    planId: string,
    interval: 'monthly' | 'yearly' = 'monthly'
  ) {
    try {
      // Get Razorpay instance (will throw if not configured)
      const razorpayInstance = getRazorpayInstance();

      // Get user and subscription details
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get plan pricing
      const pricing = Subscription.getPlanPricing();
      const amount = pricing[planId as keyof typeof pricing][interval];
      
      if (amount === 0) {
        throw new Error('Cannot create payment order for free plan');
      }

      // Create Razorpay order
      // Generate short receipt ID (max 40 chars) - use last 8 chars of userId + timestamp
      const shortUserId = userId.slice(-8);
      const shortTimestamp = Date.now().toString().slice(-8);
      const receipt = `sub_${shortUserId}_${shortTimestamp}`;

      console.log(`💳 Creating Razorpay order with receipt: ${receipt} (length: ${receipt.length})`);

      const orderOptions = {
        amount: amount, // Amount in paise
        currency: 'INR',
        receipt: receipt, // Max 40 characters
        notes: {
          userId,
          planId,
          interval,
          type: 'subscription'
        }
      };

      console.log('🔄 Calling Razorpay API with options:', JSON.stringify(orderOptions, null, 2));
      const order = await razorpayInstance.orders.create(orderOptions);
      console.log('✅ Razorpay order created successfully:', order.id);

      // Create payment record
      const subscription = await Subscription.findOne({ userId });
      const payment = new Payment({
        userId,
        subscriptionId: subscription?._id,
        razorpayOrderId: order.id,
        amount,
        currency: 'INR',
        status: 'pending',
        description: `${this.getPlanName(planId)} - ${interval} subscription`,
        metadata: {
          planId,
          interval,
          orderDetails: order
        }
      });

      await payment.save();
      console.log('💾 Payment record saved successfully');

      const result = {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id,
        key: process.env.RAZORPAY_KEY_ID
      };

      console.log('🎉 Subscription order created successfully:', result);
      return result;

    } catch (error) {
      console.error('Error creating subscription order:', error);
      throw error;
    }
  }

  /**
   * Verify payment signature
   */
  static verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    try {
      // Check if Razorpay is configured
      const isRazorpayConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
      if (!isRazorpayConfigured) {
        throw new Error('Razorpay is not configured');
      }

      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(body.toString())
        .digest('hex');

      return expectedSignature === razorpaySignature;
    } catch (error) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Handle successful payment
   */
  static async handleSuccessfulPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    try {
      // Verify signature
      const isValid = this.verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isValid) {
        throw new Error('Invalid payment signature');
      }

      // Find payment record
      const payment = await Payment.findOne({ razorpayOrderId });
      if (!payment) {
        throw new Error('Payment record not found');
      }

      // Update payment status
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'completed';
      payment.paidAt = new Date();
      await payment.save();

      // Update or create subscription
      const { planId, interval } = payment.metadata as any;
      let subscription = await Subscription.findOne({ userId: payment.userId });

      if (subscription) {
        // Upgrade existing subscription
        const features = Subscription.getPlanFeatures(planId);
        subscription.planId = planId;
        subscription.planName = this.getPlanName(planId);
        subscription.amount = payment.amount;
        subscription.interval = interval;
        subscription.features = features;
        subscription.status = 'active';
        
        // Extend period
        const now = new Date();
        subscription.currentPeriodStart = now;
        
        const periodEnd = new Date(now);
        if (interval === 'monthly') {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }
        subscription.currentPeriodEnd = periodEnd;
        
        await subscription.save();
      } else {
        // Create new subscription
        const SubscriptionService = require('./subscriptionService').default;
        subscription = await SubscriptionService.createSubscription(
          payment.userId.toString(),
          planId,
          interval,
          false // No trial for paid subscriptions
        );
      }

      return {
        payment,
        subscription
      };

    } catch (error) {
      console.error('Error handling successful payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  static async handleFailedPayment(
    razorpayOrderId: string,
    failureReason: string
  ) {
    try {
      const payment = await Payment.findOne({ razorpayOrderId });
      if (payment) {
        payment.status = 'failed';
        payment.failureReason = failureReason;
        await payment.save();
      }
      return payment;
    } catch (error) {
      console.error('Error handling failed payment:', error);
      throw error;
    }
  }

  /**
   * Create refund
   */
  static async createRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ) {
    try {
      // Check if Razorpay is configured
      const isRazorpayConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
      if (!isRazorpayConfigured) {
        throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
      }

      const payment = await Payment.findById(paymentId);
      if (!payment || !payment.razorpayPaymentId) {
        throw new Error('Payment not found or not completed');
      }

      const refundAmount = amount || payment.amount;

      const refund = await razorpay!.payments.refund(payment.razorpayPaymentId, {
        amount: refundAmount,
        notes: {
          reason: reason || 'Subscription cancellation'
        }
      });

      // Update payment record
      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = refundAmount;
      payment.refundReason = reason;
      await payment.save();

      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  /**
   * Get payment history for user
   */
  static async getPaymentHistory(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [payments, total] = await Promise.all([
        Payment.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Payment.countDocuments({ userId })
      ]);

      return {
        payments,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      };
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(startDate?: Date, endDate?: Date) {
    try {
      const matchStage: any = {
        status: 'completed'
      };

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      const analytics = await Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            averageOrderValue: { $avg: '$amount' }
          }
        }
      ]);

      const planBreakdown = await Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$metadata.planId',
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        overview: analytics[0] || {
          totalRevenue: 0,
          totalTransactions: 0,
          averageOrderValue: 0
        },
        planBreakdown
      };
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Helper method to get plan name
   */
  private static getPlanName(planId: string): string {
    const names = {
      free: 'Free Plan',
      professional: 'Professional Plan',
      business: 'Business Plan'
    };
    return names[planId as keyof typeof names] || 'Unknown Plan';
  }
}

export default PaymentService;
