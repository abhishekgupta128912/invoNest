import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';
import './Counter'; // Import Counter model

export interface IInvoiceItem {
  description: string;
  hsn: string; // HSN/SAC code for GST
  quantity: number;
  unit: string;
  rate: number;
  discount?: number;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface ICustomer {
  name: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  userId: mongoose.Types.ObjectId;

  // Invoice type
  invoiceType: 'gst' | 'non-gst';

  // Customer details
  customer: ICustomer;

  // Invoice items
  items: IInvoiceItem[];

  // GST calculations (for GST invoices)
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotal: number;

  // Additional details
  notes?: string;
  terms?: string;

  // Status and tracking
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  paymentDate?: Date;

  // Blockchain integrity
  hash: string;

  // Payment reminders
  remindersSent?: Array<{
    type: 'upcoming' | 'due' | 'overdue';
    sentAt: Date;
    days: number;
  }>;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Methods
  generateHash(): string;
  verifyIntegrity(): boolean;
}

const CustomerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format'],
    required: false // Made optional for non-GST customers
  },
  address: {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true }
  }
});

const InvoiceItemSchema = new Schema({
  description: { type: String, required: true, trim: true },
  hsn: { type: String, trim: true, default: '' }, // HSN/SAC code - optional for non-GST
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  taxableAmount: { type: Number, required: true, min: 0 },
  cgstRate: { type: Number, default: 0, min: 0, max: 50 },
  sgstRate: { type: Number, default: 0, min: 0, max: 50 },
  igstRate: { type: Number, default: 0, min: 0, max: 50 },
  cgstAmount: { type: Number, default: 0, min: 0 },
  sgstAmount: { type: Number, default: 0, min: 0 },
  igstAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 }
});

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invoiceType: {
    type: String,
    enum: ['gst', 'non-gst'],
    required: true,
    default: 'gst'
  },
  customer: {
    type: CustomerSchema,
    required: true
  },
  items: {
    type: [InvoiceItemSchema],
    required: true,
    validate: {
      validator: function(items: IInvoiceItem[]) {
        return items.length > 0;
      },
      message: 'Invoice must have at least one item'
    }
  },
  subtotal: { type: Number, required: true, min: 0 },
  totalDiscount: { type: Number, default: 0, min: 0 },
  taxableAmount: { type: Number, required: true, min: 0 },
  totalCGST: { type: Number, required: true, min: 0 },
  totalSGST: { type: Number, required: true, min: 0 },
  totalIGST: { type: Number, required: true, min: 0 },
  totalTax: { type: Number, required: true, min: 0 },
  grandTotal: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true },
  terms: { type: String, trim: true },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  paymentDate: { type: Date },
  hash: { type: String, default: '' },
  remindersSent: [{
    type: {
      type: String,
      enum: ['upcoming', 'due', 'overdue'],
      required: true
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    days: {
      type: Number,
      required: true
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
InvoiceSchema.index({ userId: 1, invoiceNumber: 1 });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ userId: 1, paymentStatus: 1 });
InvoiceSchema.index({ invoiceDate: -1 });
InvoiceSchema.index({ dueDate: 1 });

// Generate invoice number
InvoiceSchema.statics.generateInvoiceNumber = async function(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}-`;

  // Use a counter collection to ensure unique sequence numbers
  const Counter = mongoose.model('Counter');
  const counterId = `invoice_${userId}_${year}${month}`;

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { sequence: 1 } },
      { upsert: true, new: true }
    );

    return `${prefix}${String(counter.sequence).padStart(4, '0')}`;
  } catch (error) {
    // Fallback to the old method if counter fails
    console.warn('Counter method failed, falling back to old method:', error);

    const lastInvoice = await this.findOne({
      userId,
      invoiceNumber: new RegExp(`^${prefix}`)
    }).sort({ invoiceNumber: -1 });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
};

// Generate hash for blockchain integrity
InvoiceSchema.methods.generateHash = function(): string {
  try {
    const data = {
      invoiceNumber: this.invoiceNumber || '',
      invoiceDate: this.invoiceDate || new Date(),
      userId: this.userId || '',
      customer: this.customer || {},
      items: this.items || [],
      grandTotal: this.grandTotal || 0
    };

    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    console.log('Generated hash for invoice:', this.invoiceNumber, 'Hash:', hash);
    return hash;
  } catch (error) {
    console.error('Error in generateHash:', error);
    // Return a fallback hash if generation fails
    return crypto.createHash('sha256')
      .update(`${this.invoiceNumber || 'unknown'}-${Date.now()}`)
      .digest('hex');
  }
};

// Pre-save middleware to generate hash
InvoiceSchema.pre('save', function(next) {
  try {
    // Always generate hash for new invoices or when modified
    if (this.isModified() || this.isNew || !this.hash) {
      const generatedHash = this.generateHash();
      if (generatedHash) {
        this.hash = generatedHash;
        console.log('Hash set for invoice:', this.invoiceNumber, 'Hash:', this.hash);
      } else {
        console.error('Failed to generate hash for invoice:', this.invoiceNumber);
        return next(new Error('Failed to generate invoice hash'));
      }
    }
    next();
  } catch (error) {
    console.error('Error in pre-save middleware:', error);
    next(error as Error);
  }
});

// Method to verify invoice integrity
InvoiceSchema.methods.verifyIntegrity = function(): boolean {
  const currentHash = this.generateHash();
  return currentHash === this.hash;
};

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
