import express from 'express';
import {
  getPlans,
  getCurrentSubscription,
  createPaymentOrder,
  verifyPayment,
  handlePaymentFailure,
  changeSubscription,
  cancelSubscription,
  getPaymentHistory,
  checkUsageLimit,
  getRevenueAnalytics,
  startFreeTrial,
  syncUsage
} from '../controllers/subscriptionController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/plans', getPlans);

// Protected routes
router.use(authenticate);

// Subscription management
router.get('/current', getCurrentSubscription);
router.post('/change', changeSubscription);
router.post('/cancel', cancelSubscription);
router.post('/trial', startFreeTrial);

// Payment routes
router.post('/payment/create-order', createPaymentOrder);
router.post('/payment/verify', verifyPayment);
router.post('/payment/failure', handlePaymentFailure);
router.get('/payment/history', getPaymentHistory);

// Usage tracking
router.get('/usage/check', checkUsageLimit);
router.post('/usage/sync', syncUsage);

// Admin routes (add admin middleware if needed)
router.get('/analytics/revenue', getRevenueAnalytics);

export default router;
