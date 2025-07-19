import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  keyId: string;
  hashedKey: string;
  permissions: {
    invoices: {
      read: boolean;
      create: boolean;
      update: boolean;
      delete: boolean;
    };
    customers: {
      read: boolean;
      create: boolean;
      update: boolean;
      delete: boolean;
    };
    documents: {
      read: boolean;
      create: boolean;
    };
  };
  isActive: boolean;
  lastUsed?: Date;
  usageCount: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  generateKey(): { keyId: string; apiKey: string };
  verifyKey(providedKey: string): boolean;
}

const ApiKeySchema = new Schema<IApiKey>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hashedKey: {
    type: String,
    required: true,
    select: false // Don't include in queries by default
  },
  permissions: {
    invoices: {
      read: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    customers: {
      read: { type: Boolean, default: true },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    documents: {
      read: { type: Boolean, default: true },
      create: { type: Boolean, default: false }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  },
  usageCount: {
    type: Number,
    default: 0
  },
  rateLimit: {
    requestsPerMinute: { type: Number, default: 60 },
    requestsPerHour: { type: Number, default: 1000 },
    requestsPerDay: { type: Number, default: 10000 }
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ApiKeySchema.index({ userId: 1, isActive: 1 });
ApiKeySchema.index({ keyId: 1, isActive: 1 });
ApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate API key
ApiKeySchema.methods.generateKey = function(): { keyId: string; apiKey: string } {
  // Generate a unique key ID (public identifier)
  this.keyId = `ak_${crypto.randomBytes(16).toString('hex')}`;
  
  // Generate the actual API key (secret)
  const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
  
  // Hash the API key for storage
  this.hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  return { keyId: this.keyId, apiKey };
};

// Verify API key
ApiKeySchema.methods.verifyKey = function(providedKey: string): boolean {
  const hashedProvidedKey = crypto.createHash('sha256').update(providedKey).digest('hex');
  return this.hashedKey === hashedProvidedKey;
};

// Static method to find and verify API key
ApiKeySchema.statics.findByKey = async function(apiKey: string) {
  // Extract key ID from the API key format
  if (!apiKey.startsWith('sk_')) {
    return null;
  }
  
  // Find all active API keys and check each one
  const apiKeys = await this.find({ isActive: true }).select('+hashedKey');
  
  for (const key of apiKeys) {
    if (key.verifyKey(apiKey)) {
      // Update last used timestamp and usage count
      key.lastUsed = new Date();
      key.usageCount += 1;
      await key.save();
      return key;
    }
  }
  
  return null;
};

// Pre-save middleware to set default expiration (1 year)
ApiKeySchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  }
  next();
});

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
