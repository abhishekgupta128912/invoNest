import express from 'express';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  downloadInvoicePDF,
  verifyInvoiceIntegrity
} from '../controllers/invoiceController';
import { authenticate } from '../middleware/auth';
import { validateInvoiceCreation, validateInvoiceUpdate } from '../middleware/invoiceValidation';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Invoice CRUD operations
router.post('/', validateInvoiceCreation, createInvoice);
router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.put('/:id', validateInvoiceUpdate, updateInvoice);
router.delete('/:id', deleteInvoice);

// PDF generation
router.get('/:id/pdf', downloadInvoicePDF);

// Blockchain integrity verification
router.get('/:id/verify', verifyInvoiceIntegrity);

export default router;
