import express from 'express';
import {
  recordPayment,
  verifyPayment,
  getPayment,
  getInvoicePayments,
  getUserPayments,
  manualVerifyPayment,
  upiWebhook
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Record a payment
router.post('/record',
  authenticate,
  recordPayment
);

// Verify a payment
router.post('/verify',
  authenticate,
  verifyPayment
);

// Get payment details
router.get('/:paymentId',
  authenticate,
  getPayment
);

// Get payments for an invoice
router.get('/invoice/:invoiceId',
  authenticate,
  getInvoicePayments
);

// Get user payments
router.get('/user/all',
  authenticate,
  getUserPayments
);

// Manual verify payment (admin)
router.post('/:paymentId/verify-manual',
  authenticate,
  manualVerifyPayment
);

// UPI webhook (no auth required for webhooks)
router.post('/webhook/upi',
  upiWebhook
);

export default router;
