import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface IPaymentToken extends Document {
  tokenId: string; // Unique token ID
  invoiceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Token details
  amount: number;
  currency: string;

  // Security
  isUsed: boolean;
  usedAt?: Date;
  expiresAt: Date;

  // Usage tracking
  scanCount: number;
  lastScannedAt?: Date;
  lastScannedIP?: string;

  // Payment completion
  paymentId?: string;
  transactionId?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markAsUsed(paymentId: string, transactionId?: string): Promise<void>;
  trackScan(ip?: string): Promise<void>;
  isValid(): boolean;
}

export interface IPaymentTokenModel extends Model<IPaymentToken> {
  generatePaymentToken(
    invoiceId: string,
    userId: string,
    amount: number,
    expiryHours?: number
  ): Promise<IPaymentToken>;
}

const PaymentTokenSchema = new Schema<IPaymentToken>({
  tokenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
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
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  usedAt: Date,
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  scanCount: {
    type: Number,
    default: 0
  },
  lastScannedAt: Date,
  lastScannedIP: String,
  paymentId: String,
  transactionId: String
}, {
  timestamps: true
});

// Indexes for better query performance
PaymentTokenSchema.index({ invoiceId: 1, isUsed: 1 });
PaymentTokenSchema.index({ expiresAt: 1 }); // For cleanup
PaymentTokenSchema.index({ createdAt: -1 });

// Note: tokenId is now generated manually in the static method generatePaymentToken

// Static method to generate payment token
PaymentTokenSchema.statics.generatePaymentToken = async function(
  invoiceId: string,
  userId: string,
  amount: number,
  expiryHours: number = 24
): Promise<IPaymentToken> {
  // Check if there's already an active token for this invoice
  const existingToken = await this.findOne({
    invoiceId,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (existingToken) {
    return existingToken;
  }

  // Generate unique token ID manually
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const tokenId = `PT-${timestamp}-${randomBytes}`.toUpperCase();

  // Create new token
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);

  const token = new this({
    tokenId,
    invoiceId,
    userId,
    amount,
    expiresAt
  });

  await token.save();
  return token;
};

// Method to mark token as used
PaymentTokenSchema.methods.markAsUsed = async function(paymentId: string, transactionId?: string): Promise<void> {
  this.isUsed = true;
  this.usedAt = new Date();
  this.paymentId = paymentId;
  if (transactionId) {
    this.transactionId = transactionId;
  }
  await this.save();
};

// Method to track scan
PaymentTokenSchema.methods.trackScan = async function(ip?: string): Promise<void> {
  this.scanCount += 1;
  this.lastScannedAt = new Date();
  if (ip) {
    this.lastScannedIP = ip;
  }
  await this.save();
};

// Method to check if token is valid
PaymentTokenSchema.methods.isValid = function(): boolean {
  return !this.isUsed && new Date() < this.expiresAt;
};

export default mongoose.model<IPaymentToken, IPaymentTokenModel>('PaymentToken', PaymentTokenSchema);
