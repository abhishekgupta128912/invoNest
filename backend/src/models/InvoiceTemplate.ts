import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoiceTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  templateName: string;
  description?: string;

  // Template data
  invoiceType: 'gst' | 'non-gst';

  // Customer template (can be partial for reuse)
  customerTemplate?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
    stateCode?: string;
  };

  // Items template
  itemsTemplate: Array<{
    description: string;
    quantity?: number;
    rate?: number;
    unit?: string;
    hsnCode?: string;
    gstRate?: number;
  }>;

  // Default settings
  defaultSettings: {
    notes?: string;
    terms?: string;
    dueInDays?: number;
  };

  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date;

  // Categories for organization
  category?: string;
  tags?: string[];

  // Template status
  isActive: boolean;
  isDefault: boolean; // User's default template

  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  incrementUsage(): Promise<IInvoiceTemplate>;
  toInvoiceData(overrides?: any): any;
}

const InvoiceTemplateSchema = new Schema<IInvoiceTemplate>({
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
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  invoiceType: {
    type: String,
    enum: ['gst', 'non-gst'],
    required: true,
    default: 'gst'
  },
  customerTemplate: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    stateCode: { type: String, trim: true }
  },
  itemsTemplate: [{
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0.01 },
    rate: { type: Number, min: 0 },
    unit: { type: String, trim: true, default: 'pcs' },
    hsnCode: { type: String, trim: true },
    gstRate: { type: Number, min: 0, max: 28 }
  }],
  defaultSettings: {
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    dueInDays: { type: Number, min: 0, default: 30 }
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUsedAt: {
    type: Date
  },
  category: {
    type: String,
    trim: true,
    maxlength: 50
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
InvoiceTemplateSchema.index({ userId: 1, isActive: 1 });
InvoiceTemplateSchema.index({ userId: 1, templateName: 1 });
InvoiceTemplateSchema.index({ userId: 1, category: 1 });
InvoiceTemplateSchema.index({ userId: 1, isDefault: 1 });
InvoiceTemplateSchema.index({ usageCount: -1 }); // For popular templates

// Ensure only one default template per user
InvoiceTemplateSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other templates of the same user
    await mongoose.model('InvoiceTemplate').updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Instance methods
InvoiceTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

InvoiceTemplateSchema.methods.toInvoiceData = function(overrides: any = {}) {
  return {
    invoiceType: this.invoiceType,
    customer: { ...this.customerTemplate, ...overrides.customer },
    items: overrides.items || this.itemsTemplate.map((item: any) => ({
      description: item.description,
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      unit: item.unit || 'pcs',
      hsnCode: item.hsnCode,
      gstRate: item.gstRate
    })),
    notes: overrides.notes || this.defaultSettings.notes,
    terms: overrides.terms || this.defaultSettings.terms,
    dueDate: overrides.dueDate || (this.defaultSettings.dueInDays ? 
      new Date(Date.now() + this.defaultSettings.dueInDays * 24 * 60 * 60 * 1000) : 
      undefined)
  };
};

const InvoiceTemplate = mongoose.model<IInvoiceTemplate>('InvoiceTemplate', InvoiceTemplateSchema);

export default InvoiceTemplate;
