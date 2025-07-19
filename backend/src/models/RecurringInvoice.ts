import mongoose, { Document, Schema } from 'mongoose';

export interface IRecurringInvoice extends Document {
  userId: mongoose.Types.ObjectId;
  templateName: string;
  
  // Recurrence settings
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number; // Every X weeks/months/quarters/years
  startDate: Date;
  endDate?: Date; // Optional end date
  nextGenerationDate: Date;
  
  // Invoice template data
  invoiceTemplate: {
    invoiceType: 'gst' | 'non-gst';
    customer: {
      name: string;
      email?: string;
      phone?: string;
      address?: string;
      gstNumber?: string;
      stateCode?: string;
    };
    items: Array<{
      description: string;
      quantity: number;
      rate: number;
      unit?: string;
      hsnCode?: string;
      gstRate?: number;
    }>;
    notes?: string;
    terms?: string;
    dueInDays?: number; // Days after generation for due date
  };
  
  // Status and tracking
  isActive: boolean;
  lastGeneratedDate?: Date;
  totalGenerated: number;
  maxGenerations?: number; // Optional limit
  
  // Generated invoice tracking
  generatedInvoices: mongoose.Types.ObjectId[];
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculateNextGenerationDate(): Date;
  shouldGenerate(): boolean;
}

const RecurringInvoiceSchema = new Schema<IRecurringInvoice>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  templateName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  frequency: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },
  interval: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    default: 1
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  nextGenerationDate: {
    type: Date,
    required: true
  },
  invoiceTemplate: {
    invoiceType: {
      type: String,
      enum: ['gst', 'non-gst'],
      required: true,
      default: 'gst'
    },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
      gstNumber: { type: String, trim: true, uppercase: true },
      stateCode: { type: String, trim: true }
    },
    items: [{
      description: { type: String, required: true, trim: true },
      quantity: { type: Number, required: true, min: 0.01 },
      rate: { type: Number, required: true, min: 0 },
      unit: { type: String, trim: true, default: 'pcs' },
      hsnCode: { type: String, trim: true },
      gstRate: { type: Number, min: 0, max: 28 }
    }],
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    dueInDays: { type: Number, min: 0, default: 30 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastGeneratedDate: {
    type: Date
  },
  totalGenerated: {
    type: Number,
    default: 0,
    min: 0
  },
  maxGenerations: {
    type: Number,
    min: 1
  },
  generatedInvoices: [{
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
RecurringInvoiceSchema.index({ userId: 1, isActive: 1 });
RecurringInvoiceSchema.index({ nextGenerationDate: 1, isActive: 1 });
RecurringInvoiceSchema.index({ userId: 1, templateName: 1 });

// Instance methods
RecurringInvoiceSchema.methods.calculateNextGenerationDate = function(): Date {
  const current = this.nextGenerationDate || this.startDate;
  const next = new Date(current);
  
  switch (this.frequency) {
    case 'weekly':
      next.setDate(next.getDate() + (7 * this.interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + this.interval);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + (3 * this.interval));
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + this.interval);
      break;
  }
  
  return next;
};

RecurringInvoiceSchema.methods.shouldGenerate = function(): boolean {
  if (!this.isActive) return false;
  if (this.maxGenerations && this.totalGenerated >= this.maxGenerations) return false;
  if (this.endDate && new Date() > this.endDate) return false;
  
  return new Date() >= this.nextGenerationDate;
};

const RecurringInvoice = mongoose.model<IRecurringInvoice>('RecurringInvoice', RecurringInvoiceSchema);

export default RecurringInvoice;
