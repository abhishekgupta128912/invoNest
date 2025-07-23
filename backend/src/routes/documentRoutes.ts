import express from 'express';
import { authenticate } from '../middleware/auth';
import { checkUsageLimit, trackUsageAfterAction, checkFeatureAccess } from '../middleware/usageTracking';
import {
  upload,
  uploadDocument,
  uploadMultipleDocuments,
  getUserDocuments,
  getDocument,
  downloadDocument,
  updateDocument,
  deleteDocument,
  getDocumentStats,
  parseDocument,
  verifyDocumentOnBlockchain,
  storeDocumentOnBlockchain,
  getBlockchainStatus
} from '../controllers/documentController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Upload routes (with storage usage tracking)
router.post('/upload',
  checkUsageLimit('storage'),
  upload.single('document'),
  uploadDocument,
  trackUsageAfterAction
);
router.post('/upload/multiple',
  checkUsageLimit('storage'),
  upload.array('documents', 10),
  uploadMultipleDocuments,
  trackUsageAfterAction
);

// Document management routes
router.get('/', getUserDocuments);
router.get('/stats', getDocumentStats);
router.get('/blockchain/status', getBlockchainStatus);
router.get('/:id', getDocument);
router.get('/:id/download', downloadDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

// Document processing routes (with feature access control)
router.post('/:id/parse', parseDocument);
router.post('/:id/blockchain/verify',
  checkFeatureAccess('apiAccess'),
  verifyDocumentOnBlockchain
);
router.post('/:id/blockchain/store',
  checkFeatureAccess('apiAccess'),
  storeDocumentOnBlockchain
);

export default router;
