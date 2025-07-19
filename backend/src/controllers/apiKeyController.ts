import { Request, Response } from 'express';
import ApiKeyService from '../services/apiKeyService';

const apiKeyService = new ApiKeyService();

/**
 * Create a new API key
 */
export const createApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const { name, permissions, expiresAt, rateLimit } = req.body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'API key name is required'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'API key name cannot exceed 100 characters'
      });
    }

    // Validate expiration date if provided
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be a valid future date'
        });
      }
    }

    const result = await apiKeyService.createApiKey({
      userId: userId!,
      name: name.trim(),
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      rateLimit
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's API keys
 */
export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const apiKeys = await apiKeyService.getUserApiKeys(userId!);

    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update API key
 */
export const updateApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const { keyId } = req.params;
    const { name, permissions, expiresAt, rateLimit } = req.body;

    // Validate key ID
    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: 'API key ID is required'
      });
    }

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'API key name must be a non-empty string'
      });
    }

    if (name && name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'API key name cannot exceed 100 characters'
      });
    }

    // Validate expiration date if provided
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be a valid future date'
        });
      }
    }

    const result = await apiKeyService.updateApiKey(userId!, keyId, {
      name: name?.trim(),
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      rateLimit
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete API key
 */
export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const { keyId } = req.params;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: 'API key ID is required'
      });
    }

    const result = await apiKeyService.deleteApiKey(userId!, keyId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get API key usage statistics
 */
export const getUsageStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const { keyId } = req.query;

    const stats = await apiKeyService.getUsageStats(userId!, keyId as string);

    if (stats) {
      res.json({
        success: true,
        data: stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get usage statistics'
      });
    }
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Test API key (for API key holders to verify their key works)
 */
export const testApiKey = async (req: any, res: Response) => {
  try {
    // This endpoint is called with API key authentication
    const apiKeyInfo = req.apiKey;

    if (!apiKeyInfo) {
      return res.status(401).json({
        success: false,
        message: 'API key authentication required'
      });
    }

    res.json({
      success: true,
      message: 'API key is valid and working',
      data: {
        keyId: apiKeyInfo.keyId,
        permissions: apiKeyInfo.permissions,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get API documentation info
 */
export const getApiDocs = async (req: Request, res: Response) => {
  try {
    const docs = {
      version: '1.0.0',
      baseUrl: `${req.protocol}://${req.get('host')}/api`,
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <your-api-key>',
        format: 'API keys start with "sk_"'
      },
      endpoints: {
        invoices: {
          list: 'GET /api/v1/invoices',
          get: 'GET /api/v1/invoices/:id',
          create: 'POST /api/v1/invoices',
          update: 'PUT /api/v1/invoices/:id',
          delete: 'DELETE /api/v1/invoices/:id'
        },
        customers: {
          list: 'GET /api/v1/customers',
          get: 'GET /api/v1/customers/:id',
          create: 'POST /api/v1/customers',
          update: 'PUT /api/v1/customers/:id',
          delete: 'DELETE /api/v1/customers/:id'
        },
        documents: {
          list: 'GET /api/v1/documents',
          get: 'GET /api/v1/documents/:id',
          upload: 'POST /api/v1/documents'
        }
      },
      rateLimit: {
        default: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          requestsPerDay: 10000
        },
        headers: {
          remaining: 'X-RateLimit-Remaining'
        }
      },
      errors: {
        401: 'Unauthorized - Invalid or missing API key',
        403: 'Forbidden - Insufficient permissions',
        429: 'Too Many Requests - Rate limit exceeded',
        500: 'Internal Server Error'
      }
    };

    res.json({
      success: true,
      data: docs
    });
  } catch (error) {
    console.error('Error getting API docs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
