import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/database';
// Temporarily commented out for compilation
// import { getSecurityConfig } from './config/security';
// import {
//   rateLimiters,
//   speedLimiter,
//   securityHeaders,
//   requestLogger,
//   suspiciousActivityDetection
// } from './middleware/security';
// import { sanitizeInput } from './middleware/inputSanitization';
// import { securityMonitoring } from './services/securityMonitoringService';
// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import routes AFTER environment variables are loaded
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
// Removed: import chatRoutes from './routes/chatRoutes';
import complianceRoutes from './routes/complianceRoutes';
import notificationRoutes from './routes/notificationRoutes';
import documentRoutes from './routes/documentRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import uploadRoutes from './routes/uploadRoutes';
import paymentRoutes from './routes/paymentRoutes';
import securePaymentRoutes from './routes/securePaymentRoutes';
import otpRoutes from './routes/otpRoutes';
import paymentReminderRoutes from './routes/paymentReminders';
import analyticsRoutes from './routes/analytics';
import teamRoutes from './routes/team';
import apiKeyRoutes from './routes/apiKeys';
import apiV1InvoiceRoutes from './routes/api/v1/invoices';
import recurringInvoiceRoutes from './routes/recurringInvoiceRoutes';
import invoiceTemplateRoutes from './routes/invoiceTemplateRoutes';
import batchOperationsRoutes from './routes/batchOperationsRoutes';
// Removed: import modelTrainingRoutes from './routes/modelTrainingRoutes';
// import securityRoutes from './routes/securityRoutes';

// Import services AFTER environment variables are loaded
import schedulerService from './services/schedulerService';
import PaymentReminderService from './services/paymentReminderService';
import RecurringInvoiceService from './services/recurringInvoiceService';
import { EnhancedAnalyticsService } from './services/enhancedAnalyticsService';
import EmailQueueService from './services/emailQueueService';
import SecurePaymentService from './services/securePaymentService';
import SubscriptionService from './services/subscriptionService';

// Debug: Log environment loading
console.log('=== ENVIRONMENT LOADING DEBUG ===');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Trying to load .env from:', path.join(__dirname, '../.env'));
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MAIL_USER loaded:', process.env.MAIL_USER ? 'YES' : 'NO');
console.log('MAIL_PASS loaded:', process.env.MAIL_PASS ? 'YES' : 'NO');
console.log('EMAIL_USER loaded:', process.env.EMAIL_USER ? 'YES' : 'NO');
console.log('EMAIL_PASS loaded:', process.env.EMAIL_PASS ? 'YES' : 'NO');
console.log('RAZORPAY_KEY_ID loaded:', process.env.RAZORPAY_KEY_ID ? 'YES' : 'NO');
console.log('RAZORPAY_KEY_SECRET loaded:', process.env.RAZORPAY_KEY_SECRET ? 'YES' : 'NO');
if (process.env.RAZORPAY_KEY_ID) {
  console.log('RAZORPAY_KEY_ID value:', process.env.RAZORPAY_KEY_ID);
}
console.log('==================================');

const app = express();
const PORT = process.env.PORT || 5000;
// const securityConfig = getSecurityConfig();

// Connect to MongoDB
connectDB();

// Temporarily disabled security middleware for compilation
// Security Middleware (Applied First)
// app.use(securityHeaders);
// app.use(requestLogger);
// app.use(suspiciousActivityDetection);
// app.use(sanitizeInput);

// Rate limiting
// app.use('/api/auth', rateLimiters.auth);
// app.use('/api/otp', rateLimiters.otp);
// app.use('/api/v1', rateLimiters.api);
// app.use(rateLimiters.general);
// app.use(speedLimiter);

// Enhanced Helmet configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enhanced CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://invonest.vercel.app',
  'https://invonest-frontend.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    message: 'InvoNest API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});



// Authentication routes
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// OTP routes
app.use('/api/otp', otpRoutes);

// Invoice routes
app.use('/api/invoices', invoiceRoutes);

// Compliance routes
app.use('/api/compliance', complianceRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Document routes
app.use('/api/documents', documentRoutes);

// Subscription routes
app.use('/api/subscriptions', subscriptionRoutes);

// Payment reminder routes
app.use('/api/payment-reminders', paymentReminderRoutes);

// Invoice payment routes
app.use('/api/payments', paymentRoutes);

// Secure payment routes
app.use('/api/secure-payments', securePaymentRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Team management routes
app.use('/api/team', teamRoutes);

// API key management routes
app.use('/api/api-keys', apiKeyRoutes);

// Public API v1 routes
app.use('/api/v1/invoices', apiV1InvoiceRoutes);

// Automation routes
app.use('/api/recurring-invoices', recurringInvoiceRoutes);
app.use('/api/invoice-templates', invoiceTemplateRoutes);
app.use('/api/batch-operations', batchOperationsRoutes);

// Security management routes (temporarily disabled)
// app.use('/api/security', securityRoutes);

// Serve static files from public directory (for email assets like logos)
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Serve static files from uploads directory (before upload routes to avoid conflicts)
// Serve at both /api/uploads/ and /uploads/ for compatibility
app.use('/api/uploads/logos', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'logos')));

app.use('/uploads/logos', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'logos')));

app.use('/api/uploads/documents', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'documents')));

app.use('/uploads/documents', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'documents')));

app.use('/api/uploads/signatures', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'signatures')));

app.use('/uploads/signatures', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'signatures')));

// Upload routes
app.use('/api/uploads', uploadRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, async () => {
  console.log(`🚀 InvoNest server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start the scheduler service
  schedulerService.start();

  // Initialize payment reminder service
  PaymentReminderService.getInstance();
  console.log('💰 Payment reminder service initialized');

  // Initialize recurring invoice service
  RecurringInvoiceService.getInstance();
  console.log('🔄 Recurring invoice service initialized');

  // Initialize enhanced analytics service
  EnhancedAnalyticsService.getInstance();
  console.log('📊 Enhanced analytics service initialized');

  // Initialize email queue service
  EmailQueueService.getInstance();
  console.log('📮 Email queue service initialized');

  // Initialize subscription plans
  await SubscriptionService.initializeDefaultPlans();
  console.log('💳 Subscription plans initialized');

  // Schedule cleanup of expired payment tokens (every hour)
  setInterval(async () => {
    try {
      await SecurePaymentService.cleanupExpiredTokens();
    } catch (error) {
      console.error('Error cleaning up expired payment tokens:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
  console.log('🔐 Secure payment token cleanup scheduled');
});

export default app;
