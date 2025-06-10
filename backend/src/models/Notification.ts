import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationPreference extends Document {
  userId: mongoose.Types.ObjectId;
  
  // Email preferences
  emailNotifications: boolean;
  emailAddress?: string; // Override default user email
  
  // Notification types
  complianceReminders: boolean;
  invoiceReminders: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
  
  // Timing preferences
  reminderTiming: {
    days: number[]; // Days before deadline
    timeOfDay: string; // HH:MM format
    timezone: string;
  };
  
  // Frequency limits
  maxDailyEmails: number;
  digestMode: boolean; // Send daily digest instead of individual emails
  
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  
  // Notification content
  title: string;
  message: string;
  type: 'compliance' | 'invoice' | 'system' | 'reminder' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Related entities
  relatedEntity?: {
    type: 'compliance' | 'invoice' | 'user';
    id: mongoose.Types.ObjectId;
  };
  
  // Delivery channels
  channels: {
    email: boolean;
    inApp: boolean;
    push?: boolean;
  };
  
  // Delivery status
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  
  // Email specific
  emailDetails?: {
    subject: string;
    htmlContent?: string;
    textContent?: string;
    attachments?: string[];
  };
  
  // Retry logic
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  
  // Scheduling
  scheduledFor?: Date;
  
  // Error tracking
  errorMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  emailAddress: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  complianceReminders: {
    type: Boolean,
    default: true
  },
  invoiceReminders: {
    type: Boolean,
    default: true
  },
  systemUpdates: {
    type: Boolean,
    default: true
  },
  marketingEmails: {
    type: Boolean,
    default: false
  },
  reminderTiming: {
    days: [{
      type: Number,
      min: 0,
      max: 365
    }],
    timeOfDay: {
      type: String,
      default: '09:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  maxDailyEmails: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  digestMode: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['compliance', 'invoice', 'system', 'reminder', 'alert'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  relatedEntity: {
    type: {
      type: String,
      enum: ['compliance', 'invoice', 'user']
    },
    id: {
      type: Schema.Types.ObjectId
    }
  },
  channels: {
    email: {
      type: Boolean,
      default: false
    },
    inApp: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  emailDetails: {
    subject: { type: String, trim: true },
    htmlContent: { type: String },
    textContent: { type: String },
    attachments: [{ type: String }]
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: {
    type: Date
  },
  scheduledFor: {
    type: Date
  },
  errorMessage: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ scheduledFor: 1, status: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationPreference = mongoose.model<INotificationPreference>('NotificationPreference', NotificationPreferenceSchema);
export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
