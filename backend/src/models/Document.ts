import mongoose, { Document, Schema } from 'mongoose';

export interface IDocument extends Document {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  
  // Document categorization
  category: 'invoice' | 'receipt' | 'tax_document' | 'compliance' | 'other';
  tags: string[];
  description?: string;
  
  // AI parsing results
  parsedData?: {
    text?: string;
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
    invoiceData?: {
      invoiceNumber?: string;
      date?: Date;
      amount?: number;
      vendor?: string;
      gstNumber?: string;
    };
  };
  
  // Security and integrity
  hash: string;
  isEncrypted: boolean;
  
  // Blockchain integration
  blockchainHash?: string;
  transactionId?: string;
  isVerified: boolean;
  
  // Access control
  isPublic: boolean;
  sharedWith: mongoose.Types.ObjectId[];
  
  // Metadata
  uploadedAt: Date;
  lastAccessed?: Date;
  downloadCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  mimeType: {
    type: String,
    required: true,
    enum: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ]
  },
  size: {
    type: Number,
    required: true,
    min: 0,
    max: 50 * 1024 * 1024 // 50MB limit
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String
  },
  category: {
    type: String,
    enum: ['invoice', 'receipt', 'tax_document', 'compliance', 'other'],
    default: 'other',
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  parsedData: {
    text: String,
    entities: [{
      type: String,
      value: String,
      confidence: Number
    }],
    invoiceData: {
      invoiceNumber: String,
      date: Date,
      amount: Number,
      vendor: String,
      gstNumber: String
    }
  },
  hash: {
    type: String,
    required: true,
    unique: true
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  blockchainHash: {
    type: String
  },
  transactionId: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessed: {
    type: Date
  },
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
DocumentSchema.index({ userId: 1, category: 1 });
DocumentSchema.index({ userId: 1, createdAt: -1 });
DocumentSchema.index({ tags: 1 });
// Note: hash field already has unique index from schema definition
DocumentSchema.index({ blockchainHash: 1 });

// Virtual for file size in human readable format
DocumentSchema.virtual('sizeFormatted').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Pre-save middleware to update lastAccessed
DocumentSchema.pre('save', function(next) {
  if (this.isNew) {
    this.uploadedAt = new Date();
  }
  next();
});

// Method to increment download count
DocumentSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

// Method to add tags
DocumentSchema.methods.addTags = function(newTags: string[]) {
  const uniqueTags = [...new Set([...this.tags, ...newTags.map(tag => tag.toLowerCase())])];
  this.tags = uniqueTags;
  return this.save();
};

// Method to remove tags
DocumentSchema.methods.removeTags = function(tagsToRemove: string[]) {
  this.tags = this.tags.filter((tag: string) => !tagsToRemove.includes(tag));
  return this.save();
};

// Static method to find documents by user and category
DocumentSchema.statics.findByUserAndCategory = function(userId: string, category: string) {
  return this.find({ userId, category }).sort({ createdAt: -1 });
};

// Static method to search documents
DocumentSchema.statics.searchDocuments = function(userId: string, query: string) {
  return this.find({
    userId,
    $or: [
      { originalName: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } },
      { 'parsedData.text': { $regex: query, $options: 'i' } }
    ]
  }).sort({ createdAt: -1 });
};

export default mongoose.model<IDocument>('Document', DocumentSchema);
