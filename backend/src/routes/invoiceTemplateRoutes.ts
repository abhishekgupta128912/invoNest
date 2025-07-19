import express from 'express';
import {
  getInvoiceTemplates,
  getInvoiceTemplate,
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  createInvoiceFromTemplate,
  setDefaultTemplate,
  getTemplateCategories
} from '../controllers/invoiceTemplateController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Template categories
router.get('/categories', getTemplateCategories);

// Template CRUD operations
router.get('/', getInvoiceTemplates);
router.get('/:id', getInvoiceTemplate);
router.post('/', createInvoiceTemplate);
router.put('/:id', updateInvoiceTemplate);
router.delete('/:id', deleteInvoiceTemplate);

// Special operations
router.post('/:id/create-invoice', createInvoiceFromTemplate);
router.patch('/:id/set-default', setDefaultTemplate);

export default router;
