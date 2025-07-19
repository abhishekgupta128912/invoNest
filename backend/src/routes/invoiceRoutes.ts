import express from 'express';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  downloadInvoicePDF,
  sendInvoiceEmail,
  verifyInvoiceIntegrity,
  getEmailQueueStatus,
  getPerformanceStats
} from '../controllers/invoiceController';
import {
  calculateInvoiceTotals,
  getGSTRates,
  validateGSTNumber,
  getCommonHSNCodes,
  getIndianStates
} from '../controllers/invoiceCalculationController';
import { authenticate } from '../middleware/auth';
import { validateInvoiceCreation, validateInvoiceUpdate } from '../middleware/invoiceValidation';
import { checkUsageLimit, incrementUsage, checkFeatureAccess } from '../middleware/usageTracking';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Calculation and utility endpoints (must come before /:id routes)
router.post('/calculate', calculateInvoiceTotals);
router.get('/gst-rates', getGSTRates);
router.post('/validate-gst', validateGSTNumber);
router.get('/hsn-codes', getCommonHSNCodes);
router.get('/states', getIndianStates);

// Invoice CRUD operations
router.post('/', checkUsageLimit('invoice'), validateInvoiceCreation, createInvoice);
router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.put('/:id', validateInvoiceUpdate, updateInvoice);
router.delete('/:id', deleteInvoice);

// PDF generation
router.get('/:id/pdf', downloadInvoicePDF);

// Email sending
router.post('/:id/send-email', sendInvoiceEmail);

// Email queue status (development only)
router.get('/email-queue-status', getEmailQueueStatus);

// Performance statistics (development only)
router.get('/performance-stats', getPerformanceStats);

// Blockchain integrity verification (Business plan feature)
router.get('/:id/verify', checkFeatureAccess('apiAccess'), verifyInvoiceIntegrity);

export default router;
