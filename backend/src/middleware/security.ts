import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Security logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'invonest-security' },
  transports: [
    new winston.transports.File({ filename: 'logs/security-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/security-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiter configurations
const rateLimiters = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      error: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      securityLogger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      });
    }
  }),

  // Strict rate limiting for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per 15 minutes
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      error: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    skipSuccessfulRequests: true,
    handler: (req: Request, res: Response) => {
      securityLogger.error('Authentication rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        email: req.body.email
      });
      res.status(429).json({
        success: false,
        message: 'Too many authentication attempts, please try again later.',
        error: 'AUTH_RATE_LIMIT_EXCEEDED'
      });
    }
  }),

  // OTP rate limiting
  otp: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // limit each IP to 3 OTP requests per minute
    message: {
      success: false,
      message: 'Too many OTP requests, please wait before requesting again.',
      error: 'OTP_RATE_LIMIT_EXCEEDED'
    },
    handler: (req: Request, res: Response) => {
      securityLogger.warn('OTP rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        email: req.body.email
      });
      res.status(429).json({
        success: false,
        message: 'Too many OTP requests, please wait before requesting again.',
        error: 'OTP_RATE_LIMIT_EXCEEDED'
      });
    }
  }),

  // API endpoints rate limiting
  api: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 API requests per minute
    message: {
      success: false,
      message: 'API rate limit exceeded, please slow down.',
      error: 'API_RATE_LIMIT_EXCEEDED'
    }
  })
};

// Slow down middleware for progressive delays
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: () => 500, // slow down subsequent requests by 500ms per request
  maxDelayMs: 20000, // maximum delay of 20 seconds
  validate: { delayMs: false } // Disable the warning
});

// Advanced rate limiter using rate-limiter-flexible
const advancedRateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 900, // Per 15 minutes
  blockDuration: 900, // Block for 15 minutes if limit exceeded
});

// Brute force protection for login attempts
const bruteForceProtection = new RateLimiterMemory({
  points: 5, // Number of attempts
  duration: 900, // Per 15 minutes
  blockDuration: 1800, // Block for 30 minutes
});

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Additional security headers beyond helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      securityLogger.error('HTTP Error', logData);
    } else {
      securityLogger.info('HTTP Request', logData);
    }
  });
  
  next();
};

// Suspicious activity detection
export const suspiciousActivityDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
    /(union|select|insert|update|delete|drop|create|alter)/i, // SQL injection
    /(<script|javascript:|vbscript:|onload|onerror)/i, // XSS
    /(eval\(|setTimeout\(|setInterval\()/i, // Code injection
  ];

  const userAgent = req.get('User-Agent') || '';
  const url = req.url;
  const body = JSON.stringify(req.body);

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(url) || pattern.test(body) || pattern.test(userAgent)
  );

  if (isSuspicious) {
    securityLogger.error('Suspicious activity detected', {
      ip: req.ip,
      userAgent,
      url,
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid request detected',
      error: 'SUSPICIOUS_ACTIVITY'
    });
  }

  next();
};

// Advanced brute force protection middleware
export const advancedBruteForceProtection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = `${req.ip}_${req.body.email || 'unknown'}`;
    await bruteForceProtection.consume(key);
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.round((rejRes.msBeforeNext || 60000) / 1000);

    securityLogger.error('Brute force attempt detected', {
      ip: req.ip,
      email: req.body.email,
      userAgent: req.get('User-Agent'),
      remainingTime,
      timestamp: new Date().toISOString()
    });

    res.status(429).json({
      success: false,
      message: `Too many failed attempts. Try again in ${remainingTime} seconds.`,
      error: 'BRUTE_FORCE_PROTECTION',
      retryAfter: remainingTime
    });
  }
};

export {
  rateLimiters,
  speedLimiter,
  advancedRateLimiter,
  bruteForceProtection,
  securityLogger
};
