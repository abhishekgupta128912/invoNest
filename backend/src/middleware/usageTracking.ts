import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';

/**
 * Middleware to check usage limits before allowing actions
 */
export const checkUsageLimit = (action: 'invoice' | 'storage' | 'user', amount: number = 1) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Check if user can perform the action
      const canPerform = await SubscriptionService.checkUsageLimit(
        userId.toString(),
        action,
        amount
      );

      if (!canPerform) {
        const subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());
        
        let message = '';
        let upgradeRequired = false;
        
        switch (action) {
          case 'invoice':
            message = `Invoice limit reached. You have used ${subscriptionDetails?.subscription.usage.invoicesUsed}/${subscriptionDetails?.plan?.features.maxInvoices === -1 ? 'unlimited' : subscriptionDetails?.plan?.features.maxInvoices} invoices this month.`;
            upgradeRequired = subscriptionDetails?.subscription.planId === 'free';
            break;
          case 'storage':
            message = `Storage limit reached. You have used ${subscriptionDetails?.subscription.usage.storageUsed}MB/${subscriptionDetails?.plan?.features.maxStorage}MB.`;
            upgradeRequired = true;
            break;
          case 'user':
            message = `User limit reached. You have ${subscriptionDetails?.subscription.usage.usersCount}/${subscriptionDetails?.plan?.features.maxUsers === -1 ? 'unlimited' : subscriptionDetails?.plan?.features.maxUsers} users.`;
            upgradeRequired = true;
            break;
        }

        return res.status(403).json({
          success: false,
          message,
          code: 'USAGE_LIMIT_EXCEEDED',
          data: {
            action,
            currentUsage: subscriptionDetails?.subscription.usage,
            limits: subscriptionDetails?.plan?.features,
            upgradeRequired,
            currentPlan: subscriptionDetails?.subscription.planId
          }
        });
      }

      // Store action type for post-processing
      req.usageAction = { type: action, amount };
      next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check usage limits'
      });
    }
  };
};

/**
 * Middleware to track usage after successful action
 */
export const trackUsageAfterAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    const usageAction = req.usageAction;

    if (userId && usageAction) {
      await SubscriptionService.trackUsage(
        userId.toString(),
        usageAction.type,
        usageAction.amount
      );
    }

    next();
  } catch (error) {
    console.error('Usage tracking error:', error);
    // Don't fail the request if usage tracking fails
    next();
  }
};

/**
 * Middleware to check feature access
 */
export const checkFeatureAccess = (feature: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());

      if (!subscriptionDetails) {
        return res.status(403).json({
          success: false,
          message: 'No subscription found',
          code: 'NO_SUBSCRIPTION'
        });
      }

      if (!subscriptionDetails.subscription.isActive()) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found',
          code: 'NO_ACTIVE_SUBSCRIPTION'
        });
      }

      // Check if user has access to the feature
      const hasAccess = subscriptionDetails.plan?.features && subscriptionDetails.plan.features[feature as keyof typeof subscriptionDetails.plan.features];
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Feature '${feature}' not available in your current plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          data: {
            feature,
            currentPlan: subscriptionDetails.subscription.planId,
            upgradeRequired: true
          }
        });
      }

      next();
    } catch (error) {
      console.error('Feature access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check feature access'
      });
    }
  };
};

/**
 * Middleware to add subscription info to response
 */
export const addSubscriptionInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    if (userId) {
      const subscriptionDetails = await SubscriptionService.getSubscriptionWithDetails(userId.toString());
      req.userSubscription = subscriptionDetails;
    }
    next();
  } catch (error) {
    console.error('Add subscription info error:', error);
    next(); // Continue without subscription info
  }
};

// Extend Request interface to include usage tracking
declare global {
  namespace Express {
    interface Request {
      usageAction?: {
        type: 'invoice' | 'storage' | 'user';
        amount: number;
      };
      userSubscription?: any;
    }
  }
}
