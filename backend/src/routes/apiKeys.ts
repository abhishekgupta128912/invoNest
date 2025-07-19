import express from 'express';
import { authenticate } from '../middleware/auth';
import { authenticateApiKey } from '../middleware/apiAuth';
import { checkFeatureAccess } from '../middleware/usageTracking';
import {
  createApiKey,
  getApiKeys,
  updateApiKey,
  deleteApiKey,
  getUsageStats,
  testApiKey,
  getApiDocs
} from '../controllers/apiKeyController';

const router = express.Router();

/**
 * @route   GET /api/api-keys/docs
 * @desc    Get API documentation
 * @access  Public
 */
router.get('/docs', getApiDocs);

/**
 * @route   GET /api/api-keys/test
 * @desc    Test API key
 * @access  Private (API Key)
 */
router.get('/test', authenticateApiKey, testApiKey);

// All routes below require JWT authentication and Business plan
router.use(authenticate);
router.use(checkFeatureAccess('apiAccess'));

/**
 * @route   POST /api/api-keys
 * @desc    Create a new API key
 * @access  Private (Business plan)
 */
router.post('/', createApiKey);

/**
 * @route   GET /api/api-keys
 * @desc    Get user's API keys
 * @access  Private (Business plan)
 */
router.get('/', getApiKeys);

/**
 * @route   PUT /api/api-keys/:keyId
 * @desc    Update API key
 * @access  Private (Business plan)
 */
router.put('/:keyId', updateApiKey);

/**
 * @route   DELETE /api/api-keys/:keyId
 * @desc    Delete API key
 * @access  Private (Business plan)
 */
router.delete('/:keyId', deleteApiKey);

/**
 * @route   GET /api/api-keys/usage
 * @desc    Get API key usage statistics
 * @access  Private (Business plan)
 */
router.get('/usage', getUsageStats);

export default router;
