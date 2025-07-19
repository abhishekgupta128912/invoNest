import { Request, Response, NextFunction } from 'express';
import SubscriptionService from '../services/subscriptionService';

// Middleware to check and track usage limits
export const checkUsageLimit = (action: 'invoice' | 'storage') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Get amount from request body or default to 1
      let amount = 1;
      if (action === 'storage') {
        if (req.file) {
          amount = Math.ceil(req.file.size / (1024 * 1024)); // Convert bytes to MB
        } else if (req.files && Array.isArray(req.files)) {
          // Handle multiple files
          amount = req.files.reduce((total, file) => {
            return total + Math.ceil(file.size / (1024 * 1024));
          }, 0);
        }
      }

      // Check if user can perform the action
      const canPerform = await SubscriptionService.checkUsageLimit(
        userId.toString(),
        action,
        amount
      );

      if (!canPerform) {
        const subscription = await SubscriptionService.getSubscriptionWithUsage(userId.toString());
        
        let message = '';
        let upgradeRequired = false;
        
        switch (action) {
          case 'invoice':
            message = `Invoice limit reached. You have used ${subscription?.usage.invoicesUsed}/${subscription?.features.maxInvoices} invoices this month.`;
            upgradeRequired = subscription?.planId === 'free';
            break;
          case 'storage':
            message = `Storage limit reached. You have used ${subscription?.usage.storageUsed}MB/${subscription?.features.maxStorage}MB.`;
            upgradeRequired = true;
            break;
        }

        return res.status(403).json({
          success: false,
          message,
          code: 'USAGE_LIMIT_EXCEEDED',
          data: {
            action,
            currentUsage: subscription?.usage,
            limits: subscription?.features,
            upgradeRequired,
            currentPlan: subscription?.planId
          }
        });
      }

      // Store action type for post-processing (map to service types)
      const serviceTypeMap = {
        'invoice': 'invoices' as const,
        'storage': 'storage' as const
      };

      req.usageAction = { type: serviceTypeMap[action], amount };
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

// Middleware to increment usage after successful action
export const incrementUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    const usageAction = req.usageAction;

    if (userId && usageAction) {
      await SubscriptionService.incrementUsage(
        userId.toString(),
        usageAction.type,
        usageAction.amount
      );
    }

    next();
  } catch (error) {
    console.error('Usage increment error:', error);
    // Don't fail the request if usage tracking fails
    next();
  }
};

// Middleware to check feature access
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

      const subscription = await SubscriptionService.getSubscriptionWithUsage(userId.toString());

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No subscription found',
          code: 'NO_SUBSCRIPTION'
        });
      }

      if (!SubscriptionService.isSubscriptionActive(subscription)) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found',
          code: 'NO_ACTIVE_SUBSCRIPTION'
        });
      }

      // Check if user has access to the feature
      const hasAccess = subscription.features && subscription.features[feature];
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Feature '${feature}' not available in your current plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          data: {
            feature,
            currentPlan: subscription.planId,
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

// Middleware to add subscription info to response
export const addSubscriptionInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    if (userId) {
      const subscription = await SubscriptionService.getSubscriptionWithUsage(userId.toString());
      req.userSubscription = subscription;
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
        type: 'invoices' | 'storage';
        amount: number;
      };
      userSubscription?: any;
    }
  }
}
