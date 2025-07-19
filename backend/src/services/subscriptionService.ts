import Subscription, { ISubscription } from '../models/Subscription';
import Payment from '../models/Payment';
import User from '../models/User';
import mongoose from 'mongoose';

// Plan configurations
const PLAN_FEATURES = {
  free: {
    maxInvoices: 5,
    maxStorage: 100,
    documentAnalysis: false,
    prioritySupport: false,
    apiAccess: false,
    customBranding: false,
    multiUser: false,
    maxUsers: 1,
    advancedReports: false
  },
  professional: {
    maxInvoices: -1,
    maxStorage: 5120,
    documentAnalysis: true,
    prioritySupport: true,
    apiAccess: false,
    customBranding: false,
    multiUser: false,
    maxUsers: 1,
    advancedReports: true
  },
  business: {
    maxInvoices: -1,
    maxStorage: 20480,
    documentAnalysis: true,
    prioritySupport: true,
    apiAccess: true,
    customBranding: true,
    multiUser: true,
    maxUsers: 5,
    advancedReports: true
  }
};

const PLAN_PRICING = {
  free: { monthly: 0, yearly: 0 },
  professional: { monthly: 9900, yearly: 99000 },
  business: { monthly: 29900, yearly: 299000 }
};

export class SubscriptionService {
  
  /**
   * Create a new subscription for a user
   */
  static async createSubscription(
    userId: string, 
    planId: string, 
    interval: 'monthly' | 'yearly' = 'monthly',
    startTrial: boolean = false
  ): Promise<ISubscription> {
    
    // Check if user already has a subscription
    const existingSubscription = await Subscription.findOne({ userId });
    if (existingSubscription) {
      throw new Error('User already has an active subscription');
    }

    // Get plan features and pricing
    const features = PLAN_FEATURES[planId as keyof typeof PLAN_FEATURES];
    const pricing = PLAN_PRICING;
    
    if (!features) {
      throw new Error('Invalid plan ID');
    }

    const amount = pricing[planId as keyof typeof pricing][interval];
    
    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    
    if (interval === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Set trial period for paid plans
    let trialStart, trialEnd, status;
    if (startTrial && planId !== 'free') {
      trialStart = now;
      trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial
      status = 'trialing';
    } else {
      status = 'active';
    }

    const subscription = new Subscription({
      userId,
      planId,
      planName: this.getPlanName(planId),
      status,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart,
      trialEnd,
      amount,
      currency: 'INR',
      interval,
      features,
      usage: {
        invoicesUsed: 0,
        storageUsed: 0,
        lastResetDate: now
      }
    });

    return await subscription.save();
  }

  /**
   * Upgrade/downgrade subscription
   */
  static async changeSubscription(
    userId: string, 
    newPlanId: string, 
    interval: 'monthly' | 'yearly' = 'monthly'
  ): Promise<ISubscription> {
    
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const newFeatures = PLAN_FEATURES[newPlanId as keyof typeof PLAN_FEATURES];
    const pricing = PLAN_PRICING;
    
    if (!newFeatures) {
      throw new Error('Invalid plan ID');
    }

    const newAmount = pricing[newPlanId as keyof typeof pricing][interval];

    // Update subscription
    subscription.planId = newPlanId;
    subscription.planName = this.getPlanName(newPlanId);
    subscription.amount = newAmount;
    subscription.interval = interval;
    subscription.features = newFeatures;
    
    // If downgrading, check usage limits
    if (newFeatures.maxInvoices !== -1 && subscription.usage.invoicesUsed > newFeatures.maxInvoices) {
      throw new Error(`Cannot downgrade: You have ${subscription.usage.invoicesUsed} invoices but new plan allows only ${newFeatures.maxInvoices}`);
    }

    return await subscription.save();
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId: string, immediate: boolean = false): Promise<ISubscription> {
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    if (immediate) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
    } else {
      // Cancel at period end
      subscription.status = 'cancelled';
      subscription.cancelledAt = subscription.currentPeriodEnd;
    }

    return await subscription.save();
  }

  /**
   * Check if user can perform an action
   */
  static async checkUsageLimit(userId: string, action: 'invoice' | 'storage', amount: number = 1): Promise<boolean> {
    const subscription = await Subscription.findOne({ userId });

    console.log('🔍 Usage limit check:', {
      userId,
      action,
      amount,
      hasSubscription: !!subscription,
      subscriptionStatus: subscription?.status,
      planId: subscription?.planId,
      maxInvoices: subscription?.features?.maxInvoices,
      invoicesUsed: subscription?.usage?.invoicesUsed,
      isActive: subscription ? SubscriptionService.isSubscriptionActive(subscription) : false
    });

    if (!subscription || !SubscriptionService.isSubscriptionActive(subscription)) {
      console.log('❌ No active subscription found');
      return false;
    }

    switch (action) {
      case 'invoice':
        const canCreate = SubscriptionService.canCreateInvoice(subscription);
        console.log('🔍 Can create invoice:', canCreate);
        return canCreate;
      case 'storage':
        return subscription.usage.storageUsed + amount <= subscription.features.maxStorage;
      default:
        return false;
    }
  }

  /**
   * Increment usage
   */
  static async incrementUsage(userId: string, type: 'invoices' | 'storage', amount: number = 1): Promise<void> {
    const subscription = await Subscription.findOne({ userId });
    if (subscription) {
      await SubscriptionService.incrementSubscriptionUsage(subscription, type, amount);
    }
  }

  /**
   * Sync subscription usage with actual data
   */
  static async syncUsageWithActualData(userId: string): Promise<void> {
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) return;

    // Count actual invoices
    const invoiceCount = await mongoose.model('Invoice').countDocuments({ 
      userId, 
      createdAt: { $gte: subscription.currentPeriodStart } 
    });

    // Calculate actual storage usage (simplified)
    const documents = await mongoose.model('Document').find({ userId });
    const storageUsed = documents.reduce((total, doc) => total + (doc.size || 0), 0) / (1024 * 1024); // Convert to MB

    // Update usage
    subscription.usage.invoicesUsed = invoiceCount;
    subscription.usage.storageUsed = Math.ceil(storageUsed);
    await subscription.save();
  }

  /**
   * Get subscription with usage percentage
   */
  static async getSubscriptionWithUsage(userId: string): Promise<any> {
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) return null;

    const usagePercentages = {
      invoices: subscription.features.maxInvoices === -1 ? 0 : Math.round((subscription.usage.invoicesUsed / subscription.features.maxInvoices) * 100),
      storage: Math.round((subscription.usage.storageUsed / subscription.features.maxStorage) * 100)
    };

    const isNearLimit = usagePercentages.invoices > 80 || usagePercentages.storage > 80;

    return {
      ...subscription.toObject(),
      usagePercentages,
      isNearLimit
    };
  }

  /**
   * Reset monthly usage for all subscriptions
   */
  static async resetMonthlyUsage(): Promise<void> {
    const now = new Date();
    const subscriptions = await Subscription.find({
      status: { $in: ['active', 'trialing'] },
      currentPeriodEnd: { $lte: now }
    });

    for (const subscription of subscriptions) {
      // Calculate new period
      const newPeriodStart = new Date(subscription.currentPeriodEnd);
      let newPeriodEnd = new Date(newPeriodStart);
      
      if (subscription.interval === 'monthly') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }

      // Reset usage and update period
      subscription.currentPeriodStart = newPeriodStart;
      subscription.currentPeriodEnd = newPeriodEnd;
      subscription.usage.invoicesUsed = 0;
      subscription.usage.storageUsed = 0;
      subscription.usage.lastResetDate = now;

      await subscription.save();
    }
  }

  /**
   * Handle trial expiration
   */
  static async handleTrialExpiration(): Promise<void> {
    const now = new Date();
    const expiringTrials = await Subscription.find({
      status: 'trialing',
      trialEnd: { $lte: now }
    });

    for (const subscription of expiringTrials) {
      subscription.status = 'inactive';
      await subscription.save();
    }
  }

  /**
   * Get plan name
   */
  private static getPlanName(planId: string): string {
    const names = {
      free: 'Free Plan',
      professional: 'Professional Plan',
      business: 'Business Plan'
    };
    return names[planId as keyof typeof names] || 'Unknown Plan';
  }

  /**
   * Get available plans
   */
  static getAvailablePlans() {
    const planDetails = {
      free: {
        description: 'Perfect for getting started',
        popular: false
      },
      professional: {
        description: 'For growing businesses',
        popular: true
      },
      business: {
        description: 'For teams and enterprises',
        popular: false
      }
    };

    return Object.keys(PLAN_FEATURES).map(planId => ({
      id: planId,
      name: this.getPlanName(planId),
      description: planDetails[planId as keyof typeof planDetails]?.description,
      features: PLAN_FEATURES[planId as keyof typeof PLAN_FEATURES],
      pricing: PLAN_PRICING[planId as keyof typeof PLAN_PRICING],
      popular: planDetails[planId as keyof typeof planDetails]?.popular
    }));
  }

  // Helper methods to handle subscription instance methods
  static isSubscriptionActive(subscription: any): boolean {
    return subscription.status === 'active' || subscription.status === 'trialing';
  }

  static canCreateInvoice(subscription: any): boolean {
    // If maxInvoices is -1, it means unlimited
    if (subscription.features.maxInvoices === -1) {
      console.log('🔍 Invoice creation check: Unlimited invoices allowed');
      return true;
    }

    const canCreate = subscription.usage.invoicesUsed < subscription.features.maxInvoices;
    console.log('🔍 Invoice creation check:', {
      invoicesUsed: subscription.usage.invoicesUsed,
      maxInvoices: subscription.features.maxInvoices,
      canCreate,
      planId: subscription.planId
    });
    return canCreate;
  }

  static async incrementSubscriptionUsage(subscription: any, type: 'invoices' | 'storage', amount: number = 1): Promise<void> {
    if (type === 'invoices') {
      subscription.usage.invoicesUsed += amount;
    } else if (type === 'storage') {
      subscription.usage.storageUsed += amount;
    }
    await subscription.save();
  }
}

export default SubscriptionService;
