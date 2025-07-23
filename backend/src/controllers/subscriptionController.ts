import { Request, Response } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';

/**
 * Get all available subscription plans
 */
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await SubscriptionService.getAvailablePlans();
    
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

/**
 * Get user's current subscription
 */
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

    let subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());
    
    // If no subscription exists, create a free one
    if (!subscriptionDetails) {
      const freeSubscription = await SubscriptionService.createSubscription(
        userId.toString(),
        'free',
        'monthly',
        false
      );
      
      subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());
    }

    res.status(200).json({
      success: true,
      message: 'Subscription retrieved successfully',
      data: subscriptionDetails
    });
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription'
    });
  }
};

/**
 * Change subscription plan
 */
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

    const { planId, billingCycle = 'monthly' } = req.body;

    if (!planId || !['free', 'professional', 'business'].includes(planId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan ID'
      });
      return;
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      res.status(400).json({
        success: false,
        message: 'Invalid billing cycle'
      });
      return;
    }

    const subscription = await SubscriptionService.changeSubscription(
      userId.toString(),
      planId,
      billingCycle
    );

    const subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscriptionDetails
    });
  } catch (error) {
    console.error('Change subscription error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to change subscription'
    });
  }
};

/**
 * Cancel subscription
 */
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

    const { immediate = false, reason } = req.body;

    const subscription = await SubscriptionService.cancelSubscription(
      userId.toString(),
      immediate,
      reason
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

/**
 * Start free trial
 */
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

    const { planId = 'starter' } = req.body;

    if (!['professional', 'business'].includes(planId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan ID for trial'
      });
      return;
    }

    // Check if user already has a subscription - if so, change it instead
    const existingSubscription = await SubscriptionService.getUserSubscription(userId.toString());
    if (existingSubscription) {
      // Change existing subscription instead of creating new one
      const subscription = await SubscriptionService.changeSubscription(
        userId.toString(),
        planId,
        'monthly',
        true // Start trial
      );

      const subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());

      res.status(200).json({
        success: true,
        message: 'Free trial started successfully',
        data: subscriptionDetails
      });
      return;
    }

    const subscription = await SubscriptionService.createSubscription(
      userId.toString(),
      planId,
      'monthly',
      true // Start trial
    );

    const subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());

    res.status(201).json({
      success: true,
      message: 'Free trial started successfully',
      data: subscriptionDetails
    });
  } catch (error) {
    console.error('Start free trial error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start free trial'
    });
  }
};

/**
 * Check usage limits
 */
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

    if (!action || !['invoice', 'storage', 'user'].includes(action as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action type'
      });
      return;
    }

    const canPerform = await SubscriptionService.checkUsageLimit(
      userId.toString(),
      action as 'invoice' | 'storage' | 'user',
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

/**
 * Track usage
 */
export const trackUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { action, amount = 1 } = req.body;

    if (!action || !['invoice', 'storage', 'user'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action type'
      });
      return;
    }

    await SubscriptionService.trackUsage(
      userId.toString(),
      action,
      amount
    );

    res.status(200).json({
      success: true,
      message: 'Usage tracked successfully'
    });
  } catch (error) {
    console.error('Track usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track usage'
    });
  }
};
