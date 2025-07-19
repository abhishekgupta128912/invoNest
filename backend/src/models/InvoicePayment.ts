import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoicePayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  
  // Payment details
  paymentId: string; // Unique payment ID
  transactionId?: string; // Bank/UPI transaction ID
  amount: number;
  currency: string;
  
  // Payment method
  paymentMethod: 'upi' | 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'other';
  paymentGateway?: 'razorpay' | 'payu' | 'cashfree' | 'manual';
  
  // UPI specific details
  upiTransactionId?: string;
  upiId?: string;
  
  // Bank transfer details
  bankTransactionId?: string;
  bankReference?: string;
  
  // Status and tracking
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentDate: Date;
  
  // Gateway response
  gatewayResponse?: any;
  failureReason?: string;
  
  // Verification
  isVerified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  
  // Receipt
  receiptNumber: string;
  receiptGenerated: boolean;
  receiptUrl?: string;
  
  // Customer info
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  
  // Metadata
  notes?: string;
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const InvoicePaymentSchema = new Schema<IInvoicePayment>({
  invoiceId: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Payment details
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  transactionId: {
    type: String,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['upi', 'bank_transfer', 'cash', 'cheque', 'card', 'other'],
    required: true
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'payu', 'cashfree', 'manual']
  },
  
  // UPI specific
  upiTransactionId: String,
  upiId: String,
  
  // Bank transfer specific
  bankTransactionId: String,
  bankReference: String,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  
  // Gateway response
  gatewayResponse: Schema.Types.Mixed,
  failureReason: String,
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Receipt
  receiptNumber: {
    type: String,
    required: true,
    unique: true
  },
  receiptGenerated: {
    type: Boolean,
    default: false
  },
  receiptUrl: String,
  
  // Customer info
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  
  // Metadata
  notes: String,
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes for better query performance
InvoicePaymentSchema.index({ invoiceId: 1, status: 1 });
InvoicePaymentSchema.index({ userId: 1, paymentDate: -1 });
InvoicePaymentSchema.index({ paymentMethod: 1, status: 1 });
InvoicePaymentSchema.index({ createdAt: -1 });

// Generate receipt number before saving
InvoicePaymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.receiptNumber) {
    const count = await mongoose.model('InvoicePayment').countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    this.receiptNumber = `RCP-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export default mongoose.model<IInvoicePayment>('InvoicePayment', InvoicePaymentSchema);
