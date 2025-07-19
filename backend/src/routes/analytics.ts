import express from 'express';
import { authenticate } from '../middleware/auth';
import { checkFeatureAccess } from '../middleware/usageTracking';
import {
  getCashFlowAnalytics,
  getDashboardAnalytics,
  getRevenueAnalytics,
  getCustomerAnalytics
} from '../controllers/analyticsController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard analytics summary
 * @access  Private
 */
router.get('/dashboard', getDashboardAnalytics);

/**
 * @route   GET /api/analytics/cash-flow
 * @desc    Get cash flow analytics (basic for all plans, advanced for paid plans)
 * @access  Private
 */
router.get('/cash-flow', getCashFlowAnalytics);

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Private (Professional/Business plans)
 */
router.get('/revenue', checkFeatureAccess('advancedReports'), getRevenueAnalytics);

/**
 * @route   GET /api/analytics/customers
 * @desc    Get customer analytics
 * @access  Private (Professional/Business plans)
 */
router.get('/customers', checkFeatureAccess('advancedReports'), getCustomerAnalytics);

export default router;
