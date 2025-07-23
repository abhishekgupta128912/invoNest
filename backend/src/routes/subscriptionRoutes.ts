import express from 'express';
import {
  getPlans,
  getCurrentSubscription,
  changeSubscription,
  cancelSubscription,
  startFreeTrial,
  checkUsageLimit,
  trackUsage
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

// Usage tracking
router.get('/usage/check', checkUsageLimit);
router.post('/usage/track', trackUsage);

export default router;
