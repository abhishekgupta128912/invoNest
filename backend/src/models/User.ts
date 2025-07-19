import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  businessName?: string;
  logo?: string;
  signature?: string;
  gstNumber?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };

  // Payment information
  upiId?: string;
  bankDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    accountHolderName?: string;
  };

  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isActive: boolean;
  lastLogin?: Date;
  paymentReminderSettings?: {
    enabled: boolean;
    reminderDays: number[]; // Days before due date
    overdueReminderDays: number[]; // Days after due date
    maxReminders: number;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  country: { type: String, default: 'India', trim: true }
});

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    validate: {
      validator: function(password: string) {
        // Strong password requirements
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        return strongPasswordRegex.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    },
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  businessName: {
    type: String,
    trim: true,
    maxlength: [100, 'Business name cannot exceed 100 characters']
  },
  logo: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        // Validate file extension for images
        return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(v);
      },
      message: 'Logo must be a valid image file (jpg, jpeg, png, gif, svg, webp)'
    }
  },
  signature: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        // Validate file extension for images
        return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(v);
      },
      message: 'Signature must be a valid image file (jpg, jpeg, png, gif, svg, webp)'
    }
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      'Please enter a valid GST number'
    ]
  },
  phone: {
    type: String,
    trim: true,
    match: [
      /^[6-9]\d{9}$/,
      'Please enter a valid Indian phone number'
    ]
  },
  address: AddressSchema,

  // Payment information
  upiId: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        // Enhanced UPI ID validation
        const upiRegex = /^[\w.-]+@[\w.-]+$/;
        return upiRegex.test(v);
      },
      message: 'Please enter a valid UPI ID (e.g., user@paytm, 9876543210@ybl)'
    }
  },
  bankDetails: {
    accountNumber: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      match: [
        /^[A-Z]{4}0[A-Z0-9]{6}$/,
        'Please enter a valid IFSC code'
      ]
    },
    bankName: {
      type: String,
      trim: true
    },
    accountHolderName: {
      type: String,
      trim: true
    }
  },

  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false // Don't include in queries by default
  },
  emailVerificationExpires: {
    type: Date,
    select: false // Don't include in queries by default
  },
  passwordResetToken: {
    type: String,
    select: false // Don't include in queries by default
  },
  passwordResetExpires: {
    type: Date,
    select: false // Don't include in queries by default
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  paymentReminderSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    reminderDays: {
      type: [Number],
      default: [7, 3, 1] // 7, 3, 1 days before due date
    },
    overdueReminderDays: {
      type: [Number],
      default: [1, 7, 14] // 1, 7, 14 days after due date
    },
    maxReminders: {
      type: Number,
      default: 5
    }
  }
}, {
  timestamps: true
});

// Index for better query performance (email index is already created by unique: true)
UserSchema.index({ gstNumber: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export default mongoose.model<IUser>('User', UserSchema);
