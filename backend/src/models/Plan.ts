import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: {
    maxInvoices: number; // -1 for unlimited
    maxStorage: number; // in MB
    maxUsers: number;
    documentAnalysis: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    advancedReports: boolean;
    automatedReminders: boolean;
    recurringInvoices: boolean;
    multiCurrency: boolean;
    exportOptions: string[]; // ['pdf', 'excel', 'csv']
  };
  isActive: boolean;
  sortOrder: number;
  isPopular?: boolean;
  metadata?: Record<string, any>;
}

const PlanSchema = new Schema<IPlan>({
  id: {
    type: String,
    required: true,
    unique: true,
    enum: ['free', 'professional', 'business']
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    monthly: {
      type: Number,
      required: true,
      min: 0
    },
    yearly: {
      type: Number,
      required: true,
      min: 0
    }
  },
  features: {
    maxInvoices: {
      type: Number,
      required: true,
      default: 5
    },
    maxStorage: {
      type: Number,
      required: true,
      default: 100 // 100MB
    },
    maxUsers: {
      type: Number,
      required: true,
      default: 1
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
    advancedReports: {
      type: Boolean,
      default: false
    },
    automatedReminders: {
      type: Boolean,
      default: false
    },
    recurringInvoices: {
      type: Boolean,
      default: false
    },
    multiCurrency: {
      type: Boolean,
      default: false
    },
    exportOptions: {
      type: [String],
      default: ['pdf']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
PlanSchema.index({ id: 1 });
PlanSchema.index({ isActive: 1 });
PlanSchema.index({ sortOrder: 1 });

// Static method to get all active plans
PlanSchema.statics.getActivePlans = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1 });
};

// Static method to get plan by ID
PlanSchema.statics.getPlanById = function(planId: string) {
  return this.findOne({ id: planId, isActive: true });
};

// Interface for static methods
interface IPlanModel extends mongoose.Model<IPlan> {
  getActivePlans(): Promise<IPlan[]>;
  getPlanById(planId: string): Promise<IPlan | null>;
}

export default mongoose.model<IPlan, IPlanModel>('Plan', PlanSchema);
