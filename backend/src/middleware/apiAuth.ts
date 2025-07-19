import { Request, Response, NextFunction } from 'express';
import ApiKeyService from '../services/apiKeyService';

export interface ApiAuthRequest extends Request {
  apiKey?: {
    userId: string;
    keyId: string;
    permissions: any;
  };
}

const apiKeyService = new ApiKeyService();

/**
 * Middleware to authenticate API requests using API keys
 */
export const authenticateApiKey = async (req: ApiAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'API key required. Use Authorization: Bearer <your-api-key>'
      });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify API key
    const verification = await apiKeyService.verifyApiKey(apiKey);
    
    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired API key'
      });
    }

    // Check rate limits
    const rateLimit = await apiKeyService.checkRateLimit(verification.keyId!, verification.permissions);
    
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      });
    }

    // Add API key info to request
    req.apiKey = {
      userId: verification.userId!,
      keyId: verification.keyId!,
      permissions: verification.permissions!
    };

    // Add rate limit headers
    if (rateLimit.remaining !== undefined) {
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    }

    next();
  } catch (error) {
    console.error('Error in API key authentication:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to check API key permissions for specific resource and action
 */
export const checkApiPermission = (resource: string, action: string) => {
  return (req: ApiAuthRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API authentication required'
      });
    }

    const permissions = req.apiKey.permissions[resource];
    
    if (!permissions || !permissions[action]) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${resource}.${action}`,
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Middleware that works with both JWT and API key authentication
 */
export const authenticateFlexible = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Use JWT token or API key.'
    });
  }

  if (authHeader.startsWith('Bearer sk_')) {
    // API key authentication
    return authenticateApiKey(req, res, next);
  } else if (authHeader.startsWith('Bearer ')) {
    // JWT authentication - use existing auth middleware
    const { authenticate } = require('./auth');
    return authenticate(req, res, next);
  } else {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication format. Use "Bearer <jwt-token>" or "Bearer <api-key>"'
    });
  }
};
