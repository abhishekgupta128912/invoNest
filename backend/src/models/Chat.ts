import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IChat extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  title: string;
  messages: IMessage[];
  category: 'gst' | 'tds' | 'income-tax' | 'compliance' | 'general';
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  addMessage(message: Omit<IMessage, 'timestamp'>): Promise<IChat>;
  getRecentMessages(limit?: number): IMessage[];
}

const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ChatSchema = new Schema<IChat>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  messages: {
    type: [MessageSchema],
    default: []
  },
  category: {
    type: String,
    enum: ['gst', 'tds', 'income-tax', 'compliance', 'general'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ChatSchema.index({ userId: 1, sessionId: 1 });
ChatSchema.index({ userId: 1, isActive: 1, lastActivity: -1 });
ChatSchema.index({ category: 1 });

// Generate session ID
ChatSchema.statics.generateSessionId = function(): string {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Update last activity on message add
ChatSchema.methods.addMessage = function(message: Omit<IMessage, 'timestamp'>) {
  this.messages.push({
    ...message,
    timestamp: new Date()
  });
  this.lastActivity = new Date();
  
  // Auto-generate title from first user message
  if (!this.title || this.title === 'New Chat') {
    const firstUserMessage = this.messages.find((msg: IMessage) => msg.role === 'user');
    if (firstUserMessage) {
      this.title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
    }
  }
  
  return this.save();
};

// Get recent messages for context
ChatSchema.methods.getRecentMessages = function(limit: number = 10): IMessage[] {
  return this.messages.slice(-limit);
};

export default mongoose.model<IChat>('Chat', ChatSchema);
