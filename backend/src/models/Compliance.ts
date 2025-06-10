import mongoose, { Document, Schema } from 'mongoose';

export interface IComplianceDeadline extends Document {
  title: string;
  description: string;
  type: 'gst' | 'tds' | 'income_tax' | 'pf' | 'esi' | 'custom';
  category: 'filing' | 'payment' | 'return' | 'audit' | 'other';
  dueDate: Date;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one_time';
  applicableFor: string[]; // Business types this applies to
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // For recurring deadlines
  nextDueDate?: Date;
  lastUpdated: Date;
  
  // Penalty information
  penaltyInfo?: {
    lateFilingPenalty?: string;
    interestRate?: string;
    additionalCharges?: string;
  };
  
  // Links and resources
  resources?: {
    officialLink?: string;
    guideLink?: string;
    formNumber?: string;
  };
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserCompliance extends Document {
  userId: mongoose.Types.ObjectId;
  complianceId: mongoose.Types.ObjectId;
  
  // User-specific settings
  isEnabled: boolean;
  customDueDate?: Date; // Override default due date
  reminderDays: number[]; // Days before due date to send reminders
  
  // Completion tracking
  isCompleted: boolean;
  completedDate?: Date;
  notes?: string;
  
  // Next occurrence for recurring items
  nextDueDate: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceDeadlineSchema = new Schema<IComplianceDeadline>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['gst', 'tds', 'income_tax', 'pf', 'esi', 'custom'],
    required: true
  },
  category: {
    type: String,
    enum: ['filing', 'payment', 'return', 'audit', 'other'],
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'annually', 'one_time'],
    required: true
  },
  applicableFor: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  nextDueDate: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  penaltyInfo: {
    lateFilingPenalty: { type: String, trim: true },
    interestRate: { type: String, trim: true },
    additionalCharges: { type: String, trim: true }
  },
  resources: {
    officialLink: { type: String, trim: true },
    guideLink: { type: String, trim: true },
    formNumber: { type: String, trim: true }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const UserComplianceSchema = new Schema<IUserCompliance>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  complianceId: {
    type: Schema.Types.ObjectId,
    ref: 'ComplianceDeadline',
    required: true
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  customDueDate: {
    type: Date
  },
  reminderDays: [{
    type: Number,
    min: 0,
    max: 365
  }],
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  nextDueDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
ComplianceDeadlineSchema.index({ type: 1, dueDate: 1 });
ComplianceDeadlineSchema.index({ frequency: 1, isActive: 1 });
UserComplianceSchema.index({ userId: 1, nextDueDate: 1 });
UserComplianceSchema.index({ userId: 1, complianceId: 1 }, { unique: true });

export const ComplianceDeadline = mongoose.model<IComplianceDeadline>('ComplianceDeadline', ComplianceDeadlineSchema);
export const UserCompliance = mongoose.model<IUserCompliance>('UserCompliance', UserComplianceSchema);
