import Plan, { IPlan } from '../models/Plan';
import UserSubscription, { IUserSubscription } from '../models/UserSubscription';
import User from '../models/User';
import mongoose from 'mongoose';

export class SubscriptionService {
  
  /**
   * Get all available plans
   */
  static async getAvailablePlans(): Promise<IPlan[]> {
    return await Plan.getActivePlans();
  }

  /**
   * Get plan by ID
   */
  static async getPlanById(planId: string): Promise<IPlan | null> {
    return await Plan.getPlanById(planId);
  }

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string): Promise<IUserSubscription | null> {
    return await UserSubscription.findOne({ userId }).populate('userId');
  }

  /**
   * Create a new subscription for a user
   */
  static async createSubscription(
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    startTrial: boolean = false
  ): Promise<IUserSubscription> {
    
    // Check if user already has a subscription
    const existingSubscription = await UserSubscription.findOne({ userId });
    if (existingSubscription) {
      throw new Error('User already has a subscription');
    }

    // Get plan details
    const plan = await Plan.getPlanById(planId);
    if (!plan) {
      throw new Error('Invalid plan ID');
    }

    const now = new Date();
    let periodEnd: Date;
    let trialStart: Date | undefined;
    let trialEnd: Date | undefined;
    let status: string = 'active';
    let amount = plan.price[billingCycle];

    // Handle trial period
    if (startTrial && planId !== 'free') {
      status = 'trialing';
      trialStart = now;
      trialEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days trial
      periodEnd = trialEnd;
      amount = 0; // No charge during trial
    } else {
      // Calculate period end based on billing cycle
      if (billingCycle === 'yearly') {
        periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      } else {
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
    }

    const subscription = new UserSubscription({
      userId,
      planId,
      status,
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart,
      trialEnd,
      amount,
      currency: 'INR',
      nextBillingDate: periodEnd,
      usage: {
        invoicesUsed: 0,
        storageUsed: 0,
        usersCount: 1,
        lastResetDate: now
      }
    });

    return await subscription.save();
  }

  /**
   * Change user's subscription plan
   */
  static async changeSubscription(
    userId: string,
    newPlanId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    startTrial: boolean = false
  ): Promise<IUserSubscription> {
    
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription) {
      throw new Error('No subscription found');
    }

    const newPlan = await Plan.getPlanById(newPlanId);
    if (!newPlan) {
      throw new Error('Invalid plan ID');
    }

    // Update subscription
    subscription.planId = newPlanId;
    subscription.billingCycle = billingCycle;
    subscription.amount = newPlan.price[billingCycle];

    // Handle trial mode
    if (startTrial && newPlanId !== 'free') {
      const now = new Date();
      subscription.status = 'trialing';
      subscription.trialStart = now;
      subscription.trialEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days trial
      subscription.currentPeriodEnd = subscription.trialEnd;
      subscription.amount = 0; // No charge during trial
    } else if (newPlanId === 'free') {
      // If changing to free plan, cancel immediately
      subscription.status = 'active';
      subscription.amount = 0;
      subscription.cancelAtPeriodEnd = false;
      subscription.trialStart = undefined;
      subscription.trialEnd = undefined;
    } else {
      // Regular plan change
      subscription.status = 'active';
      subscription.trialStart = undefined;
      subscription.trialEnd = undefined;
    }

    return await subscription.save();
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    userId: string,
    immediate: boolean = false,
    reason?: string
  ): Promise<IUserSubscription> {
    
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription) {
      throw new Error('No subscription found');
    }

    if (immediate) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
    }

    if (reason) {
      subscription.cancellationReason = reason;
    }

    return await subscription.save();
  }

  /**
   * Check if user can perform an action based on their plan limits
   */
  static async checkUsageLimit(
    userId: string,
    action: 'invoice' | 'storage' | 'user',
    amount: number = 1
  ): Promise<boolean> {
    
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription || !subscription.isActive()) {
      return false;
    }

    const plan = await Plan.getPlanById(subscription.planId);
    if (!plan) {
      return false;
    }

    switch (action) {
      case 'invoice':
        if (plan.features.maxInvoices === -1) return true; // Unlimited
        return subscription.usage.invoicesUsed + amount <= plan.features.maxInvoices;
      
      case 'storage':
        return subscription.usage.storageUsed + amount <= plan.features.maxStorage;
      
      case 'user':
        return subscription.usage.usersCount + amount <= plan.features.maxUsers;
      
      default:
        return false;
    }
  }

  /**
   * Track usage for a user
   */
  static async trackUsage(
    userId: string,
    action: 'invoice' | 'storage' | 'user',
    amount: number = 1
  ): Promise<void> {
    
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription) return;

    switch (action) {
      case 'invoice':
        subscription.usage.invoicesUsed += amount;
        break;
      case 'storage':
        subscription.usage.storageUsed += amount;
        break;
      case 'user':
        subscription.usage.usersCount += amount;
        break;
    }

    await subscription.save();
  }

  /**
   * Get subscription with plan details and usage percentages
   */
  static async getSubscriptionWithDetails(userId: string) {
    const subscription = await UserSubscription.findOne({ userId });
    if (!subscription) return null;

    const plan = await Plan.getPlanById(subscription.planId);
    if (!plan) return null;

    // Calculate usage percentages
    const usagePercentages = {
      invoices: plan.features.maxInvoices === -1 ? 0 : 
        Math.round((subscription.usage.invoicesUsed / plan.features.maxInvoices) * 100),
      storage: Math.round((subscription.usage.storageUsed / plan.features.maxStorage) * 100),
      users: Math.round((subscription.usage.usersCount / plan.features.maxUsers) * 100)
    };

    return {
      subscription,
      plan,
      usagePercentages,
      isNearLimit: Object.values(usagePercentages).some(percentage => percentage > 80)
    };
  }

  /**
   * Initialize default plans in the database
   */
  static async initializeDefaultPlans(): Promise<void> {
    // Clear existing plans and recreate with new structure
    await Plan.deleteMany({});

    const defaultPlans = [
      {
        id: 'free',
        name: 'Free',
        description: 'Perfect for getting started',
        price: { monthly: 0, yearly: 0 },
        features: {
          maxInvoices: 5,
          maxStorage: 100,
          maxUsers: 1,
          documentAnalysis: false,
          prioritySupport: false,
          apiAccess: false,
          customBranding: false,
          advancedReports: false,
          automatedReminders: false,
          recurringInvoices: false,
          multiCurrency: false,
          exportOptions: ['pdf']
        },
        sortOrder: 1
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'For growing businesses',
        price: { monthly: 99, yearly: 990 },
        features: {
          maxInvoices: -1,
          maxStorage: 5120,
          maxUsers: 5,
          documentAnalysis: true,
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          advancedReports: true,
          automatedReminders: true,
          recurringInvoices: true,
          multiCurrency: true,
          exportOptions: ['pdf', 'excel', 'csv']
        },
        sortOrder: 2,
        isPopular: true
      },
      {
        id: 'business',
        name: 'Business',
        description: 'For large organizations',
        price: { monthly: 299, yearly: 2990 },
        features: {
          maxInvoices: -1,
          maxStorage: 20480,
          maxUsers: -1,
          documentAnalysis: true,
          prioritySupport: true,
          apiAccess: true,
          customBranding: true,
          advancedReports: true,
          automatedReminders: true,
          recurringInvoices: true,
          multiCurrency: true,
          exportOptions: ['pdf', 'excel', 'csv']
        },
        sortOrder: 3
      }
    ];

    await Plan.insertMany(defaultPlans);
  }
}
