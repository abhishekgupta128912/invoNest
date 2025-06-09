import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

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

  // Customer details
  customer: ICustomer;

  // Invoice items
  items: IInvoiceItem[];

  // GST calculations
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
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format']
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
  hsn: { type: String, required: true, trim: true }, // HSN/SAC code
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  taxableAmount: { type: Number, required: true, min: 0 },
  cgstRate: { type: Number, required: true, min: 0, max: 50 },
  sgstRate: { type: Number, required: true, min: 0, max: 50 },
  igstRate: { type: Number, required: true, min: 0, max: 50 },
  cgstAmount: { type: Number, required: true, min: 0 },
  sgstAmount: { type: Number, required: true, min: 0 },
  igstAmount: { type: Number, required: true, min: 0 },
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
  hash: { type: String, required: true }
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
  
  // Find the last invoice for this user in current month
  const lastInvoice = await this.findOne({
    userId,
    invoiceNumber: new RegExp(`^INV-${year}${month}-`)
  }).sort({ invoiceNumber: -1 });
  
  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }
  
  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Generate hash for blockchain integrity
InvoiceSchema.methods.generateHash = function(): string {
  const data = {
    invoiceNumber: this.invoiceNumber,
    invoiceDate: this.invoiceDate,
    userId: this.userId,
    customer: this.customer,
    items: this.items,
    grandTotal: this.grandTotal
  };
  
  return crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
};

// Pre-save middleware to generate hash
InvoiceSchema.pre('save', function(next) {
  if (this.isModified() || this.isNew) {
    this.hash = this.generateHash();
  }
  next();
});

// Method to verify invoice integrity
InvoiceSchema.methods.verifyIntegrity = function(): boolean {
  const currentHash = this.generateHash();
  return currentHash === this.hash;
};

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
