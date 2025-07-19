import express from 'express';
import {
  getRecurringInvoices,
  getRecurringInvoice,
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  toggleRecurringInvoice,
  generateInvoiceNow
} from '../controllers/recurringInvoiceController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Recurring invoice CRUD operations
router.get('/', getRecurringInvoices);
router.get('/:id', getRecurringInvoice);
router.post('/', createRecurringInvoice);
router.put('/:id', updateRecurringInvoice);
router.delete('/:id', deleteRecurringInvoice);

// Special operations
router.patch('/:id/toggle', toggleRecurringInvoice);
router.post('/:id/generate', generateInvoiceNow);

export default router;
