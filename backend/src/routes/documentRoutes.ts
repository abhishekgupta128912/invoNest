import express from 'express';
import { authenticate } from '../middleware/auth';
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

// Upload routes
router.post('/upload', upload.single('document'), uploadDocument);
router.post('/upload/multiple', upload.array('documents', 10), uploadMultipleDocuments);

// Document management routes
router.get('/', getUserDocuments);
router.get('/stats', getDocumentStats);
router.get('/blockchain/status', getBlockchainStatus);
router.get('/:id', getDocument);
router.get('/:id/download', downloadDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

// Document processing routes
router.post('/:id/parse', parseDocument);
router.post('/:id/blockchain/verify', verifyDocumentOnBlockchain);
router.post('/:id/blockchain/store', storeDocumentOnBlockchain);

export default router;
