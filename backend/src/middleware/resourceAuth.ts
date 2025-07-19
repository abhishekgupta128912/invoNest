import { Request, Response, NextFunction } from 'express';
import { securityMonitoring, SecurityEventType, SecuritySeverity } from '../services/securityMonitoringService';

/**
 * Middleware to check if user owns the requested resource
 */
export const checkResourceOwnership = (resourceModel: any, resourceIdParam: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      // Find the resource
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        res.status(404).json({
          success: false,
          message: 'Resource not found',
          error: 'RESOURCE_NOT_FOUND'
        });
        return;
      }

      // Check ownership
      const resourceUserId = resource.userId || resource.createdBy || resource.owner;
      
      if (resourceUserId.toString() !== userId.toString()) {
        // Log unauthorized access attempt
        securityMonitoring.logSecurityEvent({
          type: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.HIGH,
          message: `Unauthorized access attempt to resource ${resourceId}`,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          userId: userId,
          path: req.path,
          method: req.method,
          timestamp: new Date(),
          metadata: { 
            resourceId, 
            resourceType: resourceModel.modelName,
            attemptedUserId: userId,
            actualUserId: resourceUserId.toString()
          }
        });

        res.status(403).json({
          success: false,
          message: 'Access denied. You do not own this resource.',
          error: 'RESOURCE_ACCESS_DENIED'
        });
        return;
      }

      // Add resource to request for use in controller
      (req as any).resource = resource;
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during authorization',
        error: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Middleware to check team-based resource access
 */
export const checkTeamResourceAccess = (resourceModel: any, requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params.id;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      // Find the resource
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        res.status(404).json({
          success: false,
          message: 'Resource not found',
          error: 'RESOURCE_NOT_FOUND'
        });
        return;
      }

      // Check if user is owner
      const resourceUserId = resource.userId || resource.createdBy || resource.owner;
      if (resourceUserId.toString() === userId.toString()) {
        (req as any).resource = resource;
        return next();
      }

      // Check team access
      const TeamMember = require('../models/TeamMember');
      const teamMember = await TeamMember.findOne({
        organizationId: resourceUserId,
        userId: userId,
        status: 'active'
      });

      if (!teamMember) {
        securityMonitoring.logSecurityEvent({
          type: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: SecuritySeverity.HIGH,
          message: `Unauthorized team access attempt to resource ${resourceId}`,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          userId: userId,
          path: req.path,
          method: req.method,
          timestamp: new Date(),
          metadata: { resourceId, resourceType: resourceModel.modelName }
        });

        res.status(403).json({
          success: false,
          message: 'Access denied. You are not a team member.',
          error: 'TEAM_ACCESS_DENIED'
        });
        return;
      }

      // Check specific permission
      const [resource_type, action] = requiredPermission.split('.');
      if (!teamMember.canPerform(resource_type, action)) {
        res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${requiredPermission}`,
          error: 'INSUFFICIENT_TEAM_PERMISSIONS'
        });
        return;
      }

      (req as any).resource = resource;
      (req as any).teamMember = teamMember;
      next();
    } catch (error) {
      console.error('Team resource access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during team authorization',
        error: 'TEAM_AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Middleware for admin-only access
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  
  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTHENTICATION_REQUIRED'
    });
    return;
  }

  if (user.role !== 'admin') {
    securityMonitoring.logSecurityEvent({
      type: SecurityEventType.PRIVILEGE_ESCALATION,
      severity: SecuritySeverity.HIGH,
      message: `Non-admin user attempted to access admin endpoint`,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: user.id,
      path: req.path,
      method: req.method,
      timestamp: new Date(),
      metadata: { userRole: user.role }
    });

    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
      error: 'ADMIN_ACCESS_REQUIRED'
    });
    return;
  }

  next();
};

/**
 * Middleware to check API key permissions for specific actions
 */
export const requireApiPermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = (req as any).apiKey;
    
    if (!apiKey) {
      res.status(401).json({
        success: false,
        message: 'API authentication required',
        error: 'API_AUTH_REQUIRED'
      });
      return;
    }

    const permissions = apiKey.permissions[resource];
    
    if (!permissions || !permissions[action]) {
      securityMonitoring.logApiKeyMisuse(
        req,
        `Insufficient API permissions for ${resource}.${action}`,
        apiKey.keyId
      );

      res.status(403).json({
        success: false,
        message: `Insufficient API permissions. Required: ${resource}.${action}`,
        error: 'INSUFFICIENT_API_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

export default {
  checkResourceOwnership,
  checkTeamResourceAccess,
  requireAdmin,
  requireApiPermission
};
