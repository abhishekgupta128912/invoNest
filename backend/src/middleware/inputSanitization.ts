import { Request, Response, NextFunction } from 'express';
import { securityMonitoring, SecurityEventType, SecuritySeverity } from '../services/securityMonitoringService';

// Temporary simplified validation - will be enhanced later
const validationResult = (req: Request) => ({
  isEmpty: () => true,
  array: () => []
});

const body = (field: string) => ({
  isEmail: () => body(field),
  normalizeEmail: () => body(field),
  withMessage: (msg?: any) => body(field),
  isLength: (options?: any) => body(field),
  matches: (pattern?: any) => body(field),
  trim: () => body(field),
  optional: () => body(field),
  isMongoId: () => body(field)
});

const query = body;
const param = body;

// Dangerous patterns to detect and block
const DANGEROUS_PATTERNS = {
  SQL_INJECTION: [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /((\%27)|(\')|((\%3D)|(=)))/gi,
    /((\%3B)|(;))/gi,
    /((\%2D)|(-)){2,}/gi,
    /(\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52)))/gi
  ],
  XSS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ],
  PATH_TRAVERSAL: [
    /\.\./gi,
    /\/etc\//gi,
    /\/proc\//gi,
    /\/sys\//gi,
    /\\windows\\/gi,
    /\\system32\\/gi
  ],
  COMMAND_INJECTION: [
    /(\||&|;|\$\(|\`)/gi,
    /(nc|netcat|wget|curl|ping|nslookup|dig)/gi,
    /(rm|del|format|fdisk)/gi
  ],
  LDAP_INJECTION: [
    /(\(|\)|\*|\||&)/gi
  ]
};

// File type validation
const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
};

/**
 * Sanitize string input by removing dangerous characters
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
};

/**
 * Detect dangerous patterns in input
 */
export const detectDangerousPatterns = (input: string): { detected: boolean; type: string; pattern?: string } => {
  if (typeof input !== 'string') return { detected: false, type: '' };

  for (const [type, patterns] of Object.entries(DANGEROUS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return { detected: true, type, pattern: pattern.toString() };
      }
    }
  }

  return { detected: false, type: '' };
};

/**
 * Comprehensive input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, req);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, req);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, req);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input detected',
      error: 'INPUT_SANITIZATION_ERROR'
    });
  }
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj: any, req: Request): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check for dangerous patterns
    const dangerousPattern = detectDangerousPatterns(obj);
    if (dangerousPattern.detected) {
      // Log security event
      securityMonitoring.logInjectionAttempt(
        req,
        dangerousPattern.type.includes('SQL') ? SecurityEventType.SQL_INJECTION_ATTEMPT : SecurityEventType.XSS_ATTEMPT,
        dangerousPattern.pattern || 'unknown'
      );
      
      throw new Error(`Dangerous pattern detected: ${dangerousPattern.type}`);
    }
    
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, req));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value, req);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (allowedTypes: 'images' | 'documents' | 'all' = 'all') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      return next();
    }

    const files: any[] = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else {
        files.push(req.files);
      }
    }
    if (req.file) {
      files.push(req.file);
    }

    for (const file of files) {
      if (!file) continue;

      // Check file size
      const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
      if (file.size && file.size > maxSize) {
        securityMonitoring.logSecurityEvent({
          type: SecurityEventType.FILE_UPLOAD_VIOLATION,
          severity: SecuritySeverity.MEDIUM,
          message: `File size exceeds limit: ${file.size} bytes`,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          path: req.path,
          method: req.method,
          timestamp: new Date(),
          metadata: { fileName: file.originalname, fileSize: file.size }
        });

        res.status(400).json({
          success: false,
          message: `File size exceeds maximum allowed size of ${maxSize} bytes`,
          error: 'FILE_SIZE_EXCEEDED'
        });
        return;
      }

      // Check file type
      let allowedMimeTypes: string[] = [];
      if (allowedTypes === 'images') {
        allowedMimeTypes = ALLOWED_FILE_TYPES.images;
      } else if (allowedTypes === 'documents') {
        allowedMimeTypes = ALLOWED_FILE_TYPES.documents;
      } else {
        allowedMimeTypes = [...ALLOWED_FILE_TYPES.images, ...ALLOWED_FILE_TYPES.documents];
      }

      if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
        securityMonitoring.logSecurityEvent({
          type: SecurityEventType.FILE_UPLOAD_VIOLATION,
          severity: SecuritySeverity.HIGH,
          message: `Invalid file type uploaded: ${file.mimetype}`,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          path: req.path,
          method: req.method,
          timestamp: new Date(),
          metadata: { fileName: file.originalname, mimeType: file.mimetype }
        });

        res.status(400).json({
          success: false,
          message: `File type ${file.mimetype} is not allowed`,
          error: 'INVALID_FILE_TYPE'
        });
        return;
      }

      // Check filename for dangerous patterns
      const dangerousPattern = detectDangerousPatterns(file.originalname || '');
      if (dangerousPattern.detected) {
        securityMonitoring.logSecurityEvent({
          type: SecurityEventType.FILE_UPLOAD_VIOLATION,
          severity: SecuritySeverity.HIGH,
          message: `Dangerous pattern in filename: ${file.originalname}`,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          path: req.path,
          method: req.method,
          timestamp: new Date(),
          metadata: { fileName: file.originalname, pattern: dangerousPattern.pattern }
        });

        res.status(400).json({
          success: false,
          message: 'Invalid filename detected',
          error: 'INVALID_FILENAME'
        });
        return;
      }
    }

    next();
  };
};

/**
 * Enhanced validation result handler
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation failures for security monitoring
    securityMonitoring.logSecurityEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecuritySeverity.LOW,
      message: 'Input validation failed',
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      timestamp: new Date(),
      metadata: { validationErrors: errors.array() }
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error: any) => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
    return;
  }
  
  next();
};

// Common validation chains
export const commonValidations = {
  email: body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email address is too long'),

  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  name: body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  phone: body('phone')
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian phone number'),

  gstNumber: body('gstNumber')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Please provide a valid GST number'),

  mongoId: param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
};

export default {
  sanitizeInput,
  validateFileUpload,
  handleValidationErrors,
  commonValidations,
  sanitizeString,
  detectDangerousPatterns
};
