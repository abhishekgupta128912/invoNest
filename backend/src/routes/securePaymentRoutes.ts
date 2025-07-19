import express from 'express';
import {
  generatePaymentLink,
  validatePaymentToken,
  initiateSecurePayment,
  completeSecurePayment,
  getPaymentTokenDetails,
  getInvoicePaymentTokens,
  upiCallback,
  cleanupExpiredTokens
} from '../controllers/securePaymentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Generate secure payment link (authenticated)
router.post('/generate-link',
  authenticate,
  generatePaymentLink
);

// Validate payment token (public - no auth required)
router.get('/validate/:tokenId',
  validatePaymentToken
);

// Initiate payment using secure token (public - no auth required)
router.post('/initiate/:tokenId',
  initiateSecurePayment
);

// Complete payment using secure token (public - no auth required)
router.post('/complete/:tokenId',
  completeSecurePayment
);

// Get payment token details (authenticated)
router.get('/token/:tokenId',
  authenticate,
  getPaymentTokenDetails
);

// Get invoice payment tokens (authenticated)
router.get('/invoice/:invoiceId/tokens',
  authenticate,
  getInvoicePaymentTokens
);

// UPI callback handler (webhook - no auth required)
router.post('/upi-callback/:tokenId',
  upiCallback
);

// Cleanup expired tokens (authenticated - admin only)
router.post('/cleanup-expired',
  authenticate,
  cleanupExpiredTokens
);

export default router;
