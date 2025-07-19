import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: string;
  planName: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelledAt?: Date;
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: {
    maxInvoices: number;
    maxStorage: number; // in MB
    documentAnalysis: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    multiUser: boolean;
    maxUsers: number;
    advancedReports: boolean;
  };
  usage: {
    invoicesUsed: number;
    storageUsed: number; // in MB
    lastResetDate: Date; // for daily limits
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One subscription per user
  },
  planId: {
    type: String,
    required: true,
    enum: ['free', 'professional', 'business']
  },
  planName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'past_due', 'trialing'],
    default: 'active'
  },
  currentPeriodStart: {
    type: Date,
    required: true,
    default: Date.now
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  razorpaySubscriptionId: {
    type: String,
    sparse: true // Allows multiple null values
  },
  razorpayCustomerId: {
    type: String,
    sparse: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  interval: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  features: {
    maxInvoices: {
      type: Number,
      required: true
    },
    maxStorage: {
      type: Number,
      required: true
    },
    documentAnalysis: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    multiUser: {
      type: Boolean,
      default: false
    },
    maxUsers: {
      type: Number,
      default: 1
    },
    advancedReports: {
      type: Boolean,
      default: false
    }
  },
  usage: {
    invoicesUsed: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ planId: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

// Instance methods
SubscriptionSchema.methods.isActive = function(): boolean {
  return this.status === 'active' || this.status === 'trialing';
};

SubscriptionSchema.methods.isTrialing = function(): boolean {
  return this.status === 'trialing' && 
         this.trialEnd && 
         new Date() < this.trialEnd;
};

SubscriptionSchema.methods.hasFeature = function(feature: string): boolean {
  return this.features[feature] === true;
};

SubscriptionSchema.methods.canCreateInvoice = function(): boolean {
  return this.usage.invoicesUsed < this.features.maxInvoices;
};

SubscriptionSchema.methods.incrementUsage = function(type: 'invoices' | 'storage', amount: number = 1) {
  switch (type) {
    case 'invoices':
      this.usage.invoicesUsed += amount;
      break;
    case 'storage':
      this.usage.storageUsed += amount;
      break;
  }
  return this.save();
};

SubscriptionSchema.methods.resetMonthlyUsage = function() {
  this.usage.invoicesUsed = 0;
  this.usage.storageUsed = 0;
  return this.save();
};

// Static methods for plan definitions
SubscriptionSchema.statics.getPlanFeatures = function(planId: string) {
  const plans = {
    free: {
      maxInvoices: 5,
      maxStorage: 100, // 100MB
      documentAnalysis: false,
      prioritySupport: false,
      apiAccess: false,
      customBranding: false,
      multiUser: false,
      maxUsers: 1,
      advancedReports: false
    },
    professional: {
      maxInvoices: -1, // Unlimited
      maxStorage: 5120, // 5GB
      documentAnalysis: true,
      prioritySupport: true,
      apiAccess: false,
      customBranding: false,
      multiUser: false,
      maxUsers: 1,
      advancedReports: true
    },
    business: {
      maxInvoices: -1, // Unlimited
      maxStorage: 20480, // 20GB
      documentAnalysis: true,
      prioritySupport: true,
      apiAccess: true,
      customBranding: true,
      multiUser: true,
      maxUsers: 5,
      advancedReports: true
    }
  };
  
  return plans[planId as keyof typeof plans];
};

SubscriptionSchema.statics.getPlanPricing = function() {
  return {
    free: {
      monthly: 0,
      yearly: 0
    },
    professional: {
      monthly: 99900, // ₹999 in paise
      yearly: 999000 // ₹9990 (2 months free)
    },
    business: {
      monthly: 299900, // ₹2999 in paise
      yearly: 2999000 // ₹29990 (2 months free)
    }
  };
};

// Instance methods
SubscriptionSchema.methods.hasFeatureAccess = function(feature: string): boolean {
  return this.features[feature] === true;
};

SubscriptionSchema.methods.isActive = function(): boolean {
  return this.status === 'active' || this.status === 'trialing';
};

// Interface for static methods
interface ISubscriptionModel extends Model<ISubscription> {
  getPlanFeatures(planId: string): any;
  getPlanPricing(): any;
}

export default mongoose.model<ISubscription, ISubscriptionModel>('Subscription', SubscriptionSchema);
