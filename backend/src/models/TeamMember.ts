import mongoose, { Document, Schema } from 'mongoose';

export interface ITeamMember extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'user';
  permissions: {
    invoices: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
    customers: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
    documents: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
    analytics: {
      read: boolean;
    };
    settings: {
      read: boolean;
      update: boolean;
    };
    team: {
      invite: boolean;
      manage: boolean;
    };
  };
  status: 'active' | 'inactive' | 'pending';
  invitedBy: mongoose.Types.ObjectId;
  invitedAt: Date;
  joinedAt?: Date;
  lastActive?: Date;
  invitationToken?: string;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  canPerform(resource: string, action: string): boolean;
  canManage(targetRole: string): boolean;
}

const TeamMemberSchema = new Schema<ITeamMember>({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'manager', 'user'],
    required: true,
    default: 'user'
  },
  permissions: {
    invoices: {
      create: { type: Boolean, default: true },
      read: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    customers: {
      create: { type: Boolean, default: true },
      read: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    documents: {
      create: { type: Boolean, default: true },
      read: { type: Boolean, default: true },
      update: { type: Boolean, default: true },
      delete: { type: Boolean, default: false }
    },
    analytics: {
      read: { type: Boolean, default: false }
    },
    settings: {
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false }
    },
    team: {
      invite: { type: Boolean, default: false },
      manage: { type: Boolean, default: false }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  joinedAt: {
    type: Date
  },
  lastActive: {
    type: Date
  },
  invitationToken: {
    type: String,
    select: false // Don't include in queries by default
  }
}, {
  timestamps: true
});

// Indexes for better query performance
TeamMemberSchema.index({ organizationId: 1, email: 1 }, { unique: true });
TeamMemberSchema.index({ organizationId: 1, status: 1 });
TeamMemberSchema.index({ userId: 1 });

// Pre-save middleware to set default permissions based on role
TeamMemberSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    switch (this.role) {
      case 'owner':
        this.permissions = {
          invoices: { create: true, read: true, update: true, delete: true },
          customers: { create: true, read: true, update: true, delete: true },
          documents: { create: true, read: true, update: true, delete: true },
          analytics: { read: true },
          settings: { read: true, update: true },
          team: { invite: true, manage: true }
        };
        break;
      case 'admin':
        this.permissions = {
          invoices: { create: true, read: true, update: true, delete: true },
          customers: { create: true, read: true, update: true, delete: true },
          documents: { create: true, read: true, update: true, delete: true },
          analytics: { read: true },
          settings: { read: true, update: false },
          team: { invite: true, manage: true }
        };
        break;
      case 'manager':
        this.permissions = {
          invoices: { create: true, read: true, update: true, delete: false },
          customers: { create: true, read: true, update: true, delete: false },
          documents: { create: true, read: true, update: true, delete: false },
          analytics: { read: true },
          settings: { read: true, update: false },
          team: { invite: false, manage: false }
        };
        break;
      case 'user':
        this.permissions = {
          invoices: { create: true, read: true, update: true, delete: false },
          customers: { create: true, read: true, update: true, delete: false },
          documents: { create: true, read: true, update: false, delete: false },
          analytics: { read: false },
          settings: { read: false, update: false },
          team: { invite: false, manage: false }
        };
        break;
    }
  }
  next();
});

// Static method to get role hierarchy
TeamMemberSchema.statics.getRoleHierarchy = function() {
  return {
    owner: 4,
    admin: 3,
    manager: 2,
    user: 1
  };
};

// Instance method to check if user can perform action
TeamMemberSchema.methods.canPerform = function(resource: string, action: string): boolean {
  const permissions = this.permissions[resource];
  return permissions && permissions[action] === true;
};

// Instance method to check if user can manage another user
TeamMemberSchema.methods.canManage = function(targetRole: string): boolean {
  const hierarchy = (this.constructor as any).getRoleHierarchy();
  return hierarchy[this.role] > hierarchy[targetRole];
};

export default mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);
