import express from 'express';
import {
  createBatchInvoices,
  sendBatchEmails,
  updateBatchInvoiceStatus,
  deleteBatchInvoices,
  getBatchOperationHistory
} from '../controllers/batchOperationsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Batch operations
router.post('/invoices/create', createBatchInvoices);
router.post('/invoices/send-emails', sendBatchEmails);
router.patch('/invoices/update-status', updateBatchInvoiceStatus);
router.delete('/invoices/delete', deleteBatchInvoices);

// Operation history
router.get('/history', getBatchOperationHistory);

export default router;
