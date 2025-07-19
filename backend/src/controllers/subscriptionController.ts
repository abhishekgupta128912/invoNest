import { Request, Response } from 'express';
import SubscriptionService from '../services/subscriptionService';
import PaymentService from '../services/paymentService';
import Subscription from '../models/Subscription';
import Payment from '../models/Payment';

// Get available plans
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = SubscriptionService.getAvailablePlans();
    
    res.status(200).json({
      success: true,
      message: 'Plans retrieved successfully',
      data: { plans }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve plans'
    });
  }
};

// Get user's current subscription
export const getCurrentSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const subscription = await SubscriptionService.getSubscriptionWithUsage(userId.toString());

    if (!subscription) {
      // Create free subscription if none exists
      const freeSubscription = await SubscriptionService.createSubscription(
        userId.toString(),
        'free',
        'monthly',
        false
      );

      res.status(200).json({
        success: true,
        message: 'Free subscription created',
        data: { subscription: freeSubscription }
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Subscription retrieved successfully',
      data: { subscription }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription'
    });
  }
};

// Create payment order for subscription
export const createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { planId, interval = 'monthly' } = req.body;

    if (!planId || !['professional', 'business'].includes(planId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan ID'
      });
      return;
    }

    if (!['monthly', 'yearly'].includes(interval)) {
      res.status(400).json({
        success: false,
        message: 'Invalid interval'
      });
      return;
    }

    const orderData = await PaymentService.createSubscriptionOrder(
      userId.toString(),
      planId,
      interval
    );

    res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: orderData
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create payment order'
    });
  }
};

// Verify payment and activate subscription
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
      return;
    }

    const result = await PaymentService.handleSuccessfulPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: result
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Payment verification failed'
    });
  }
};

// Handle payment failure
export const handlePaymentFailure = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, error } = req.body;

    if (!razorpay_order_id) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
      return;
    }

    await PaymentService.handleFailedPayment(
      razorpay_order_id,
      error?.description || 'Payment failed'
    );

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded'
    });
  } catch (error) {
    console.error('Handle payment failure error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle payment failure'
    });
  }
};

// Change subscription plan
export const changeSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { planId, interval = 'monthly' } = req.body;

    if (!planId || !['free', 'professional', 'business'].includes(planId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan ID'
      });
      return;
    }

    const subscription = await SubscriptionService.changeSubscription(
      userId.toString(),
      planId,
      interval
    );

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: { subscription }
    });
  } catch (error) {
    console.error('Change subscription error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to change subscription'
    });
  }
};

// Cancel subscription
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { immediate = false } = req.body;

    const subscription = await SubscriptionService.cancelSubscription(
      userId.toString(),
      immediate
    );

    res.status(200).json({
      success: true,
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at period end',
      data: { subscription }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
};

// Get payment history
export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { page = 1, limit = 10 } = req.query;

    const result = await PaymentService.getPaymentHistory(
      userId.toString(),
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment history'
    });
  }
};

// Start free trial
export const startFreeTrial = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { planId } = req.body;

    if (!planId || !['professional', 'business'].includes(planId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan ID for trial'
      });
      return;
    }

    // Check if user already has a subscription
    const existingSubscription = await Subscription.findOne({ userId });
    if (existingSubscription && existingSubscription.trialEnd) {
      res.status(400).json({
        success: false,
        message: 'Trial already used'
      });
      return;
    }

    const subscription = await SubscriptionService.createSubscription(
      userId.toString(),
      planId,
      'monthly',
      true // Start trial
    );

    res.status(200).json({
      success: true,
      message: 'Free trial started successfully',
      data: { subscription }
    });
  } catch (error) {
    console.error('Start free trial error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start trial'
    });
  }
};

// Sync subscription usage with actual data
export const syncUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    await SubscriptionService.syncUsageWithActualData(userId.toString());

    res.status(200).json({
      success: true,
      message: 'Usage synced successfully'
    });

  } catch (error) {
    console.error('Sync usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Check usage limits (middleware helper)
export const checkUsageLimit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { action, amount = 1 } = req.query;

    if (!action || !['invoice', 'storage'].includes(action as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action type'
      });
      return;
    }

    const canPerform = await SubscriptionService.checkUsageLimit(
      userId.toString(),
      action as 'invoice' | 'storage',
      parseInt(amount as string)
    );

    res.status(200).json({
      success: true,
      data: { canPerform }
    });
  } catch (error) {
    console.error('Check usage limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check usage limit'
    });
  }
};

// Admin: Get revenue analytics
export const getRevenueAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is admin (you can implement admin role check)
    const { startDate, endDate } = req.query;

    const analytics = await PaymentService.getRevenueAnalytics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.status(200).json({
      success: true,
      message: 'Revenue analytics retrieved successfully',
      data: analytics
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve revenue analytics'
    });
  }
};
