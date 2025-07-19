import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { tokenBlacklist } from '../services/tokenBlacklistService';
import { securityMonitoring, SecurityEventType, SecuritySeverity } from '../services/securityMonitoringService';
import { isAdminUserId, createAdminUserObject } from '../utils/adminAuth';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Export AuthRequest interface for use in controllers
export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
      return;
    }

    // Check if token is blacklisted
    const isBlacklisted = await tokenBlacklist.isTokenBlacklisted(token);
    if (isBlacklisted) {
      securityMonitoring.logSecurityEvent({
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: SecuritySeverity.MEDIUM,
        message: 'Attempt to use blacklisted token',
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        metadata: { token: token.substring(0, 20) + '...' }
      });

      res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
      return;
    }

    // Verify token
    const decoded: JWTPayload = verifyToken(token);

    // Check if user is globally blacklisted
    const isUserBlacklisted = await tokenBlacklist.isUserBlacklisted(decoded.userId);
    if (isUserBlacklisted) {
      res.status(401).json({
        success: false,
        message: 'Account access has been suspended. Please contact support.'
      });
      return;
    }

    // Check if this is an admin user
    if (isAdminUserId(decoded.userId)) {
      // Handle admin user
      const adminUser = createAdminUserObject();
      req.user = adminUser as any;
    } else {
      // Get regular user from database
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Token is valid but user not found.'
        });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
        return;
      }

      // Attach user to request object
      req.user = user;
    }
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded: JWTPayload = verifyToken(token);

        if (isAdminUserId(decoded.userId)) {
          // Handle admin user
          const adminUser = createAdminUserObject();
          req.user = adminUser as any;
        } else {
          // Handle regular user
          const user = await User.findById(decoded.userId).select('-password');

          if (user && user.isActive) {
            req.user = user;
          }
        }
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};
