import mongoose, { Document, Schema } from 'mongoose';

// Extend the interface to include instance methods
export interface IUserSubscriptionMethods {
  isActive(): boolean;
  isTrialing(): boolean;
  canUpgrade(): boolean;
  canDowngrade(): boolean;
  resetUsage(): Promise<IUserSubscription>;
  incrementUsage(type: 'invoices' | 'storage', amount?: number): Promise<IUserSubscription>;
}

// Update the interface to include methods
export interface IUserSubscription extends Document, IUserSubscriptionMethods {
  userId: mongoose.Types.ObjectId;
  planId: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
  billingCycle: 'monthly' | 'yearly';

  // Subscription periods
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;

  // Payment information
  nextBillingDate?: Date;
  lastPaymentDate?: Date;
  amount: number;
  currency: string;

  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelAtPeriodEnd: boolean;

  // Usage tracking
  usage: {
    invoicesUsed: number;
    storageUsed: number; // in MB
    usersCount: number;
    lastResetDate: Date;
  };

  // Metadata
  metadata?: Record<string, any>;
  notes?: string;
}

const UserSubscriptionSchema = new Schema<IUserSubscription>({
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
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'past_due', 'trialing', 'paused'],
    default: 'active'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
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
  nextBillingDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
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
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
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
    usersCount: {
      type: Number,
      default: 1
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
UserSubscriptionSchema.index({ userId: 1 });
UserSubscriptionSchema.index({ planId: 1 });
UserSubscriptionSchema.index({ status: 1 });
UserSubscriptionSchema.index({ currentPeriodEnd: 1 });
UserSubscriptionSchema.index({ nextBillingDate: 1 });

// Instance methods
UserSubscriptionSchema.methods.isActive = function(): boolean {
  return this.status === 'active' || this.status === 'trialing';
};

UserSubscriptionSchema.methods.isTrialing = function(): boolean {
  return this.status === 'trialing' &&
         this.trialEnd &&
         new Date() < this.trialEnd;
};

UserSubscriptionSchema.methods.canUpgrade = function(): boolean {
  return this.status === 'active' || this.status === 'trialing';
};

UserSubscriptionSchema.methods.canDowngrade = function(): boolean {
  return this.status === 'active' && !this.cancelAtPeriodEnd;
};

UserSubscriptionSchema.methods.resetUsage = function() {
  this.usage.invoicesUsed = 0;
  this.usage.storageUsed = 0;
  this.usage.lastResetDate = new Date();
  return this.save();
};

UserSubscriptionSchema.methods.incrementUsage = function(type: 'invoices' | 'storage', amount: number = 1) {
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

export default mongoose.model<IUserSubscription>('UserSubscription', UserSubscriptionSchema);
