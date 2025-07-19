import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';
import { IUser } from '../models/User';

// Security event types
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  DATA_BREACH_ATTEMPT = 'DATA_BREACH_ATTEMPT',
  API_KEY_MISUSE = 'API_KEY_MISUSE',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  ACCOUNT_LOCKOUT = 'ACCOUNT_LOCKOUT',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  OTP_FAILURE = 'OTP_FAILURE',
  FILE_UPLOAD_VIOLATION = 'FILE_UPLOAD_VIOLATION',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT'
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  ip: string;
  userAgent?: string;
  userId?: string;
  email?: string;
  path?: string;
  method?: string;
  payload?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class SecurityMonitoringService {
  private logger!: winston.Logger;
  private alertThresholds: Map<SecurityEventType, number> = new Map();
  private eventCounts: Map<string, number> = new Map();

  constructor() {
    this.initializeLogger();
    this.initializeAlertThresholds();
  }

  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'invonest-security-monitoring' },
      transports: [
        // Daily rotating file for security events
        new DailyRotateFile({
          filename: 'logs/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d'
        }),
        // Separate file for critical security events
        new DailyRotateFile({
          filename: 'logs/security-critical-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '90d'
        }),
        // Console output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private initializeAlertThresholds(): void {
    // Set alert thresholds for different event types
    this.alertThresholds.set(SecurityEventType.LOGIN_FAILURE, 5);
    this.alertThresholds.set(SecurityEventType.BRUTE_FORCE_ATTEMPT, 3);
    this.alertThresholds.set(SecurityEventType.SUSPICIOUS_ACTIVITY, 1);
    this.alertThresholds.set(SecurityEventType.RATE_LIMIT_EXCEEDED, 10);
    this.alertThresholds.set(SecurityEventType.UNAUTHORIZED_ACCESS, 3);
    this.alertThresholds.set(SecurityEventType.DATA_BREACH_ATTEMPT, 1);
    this.alertThresholds.set(SecurityEventType.API_KEY_MISUSE, 5);
    this.alertThresholds.set(SecurityEventType.SQL_INJECTION_ATTEMPT, 1);
    this.alertThresholds.set(SecurityEventType.XSS_ATTEMPT, 1);
  }

  /**
   * Log a security event
   */
  logSecurityEvent(event: SecurityEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    
    this.logger.log(logLevel, event.message, {
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      userAgent: event.userAgent,
      userId: event.userId,
      email: event.email,
      path: event.path,
      method: event.method,
      payload: event.payload,
      timestamp: event.timestamp,
      metadata: event.metadata
    });

    // Check if this event type should trigger an alert
    this.checkForAlerts(event);
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    type: SecurityEventType.LOGIN_SUCCESS | SecurityEventType.LOGIN_FAILURE,
    req: Request,
    user?: IUser,
    additionalInfo?: Record<string, any>
  ): void {
    const event: SecurityEvent = {
      type,
      severity: type === SecurityEventType.LOGIN_FAILURE ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW,
      message: type === SecurityEventType.LOGIN_SUCCESS ? 'User login successful' : 'User login failed',
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: user?._id?.toString(),
      email: req.body.email || user?.email,
      path: req.path,
      method: req.method,
      timestamp: new Date(),
      metadata: additionalInfo
    };

    this.logSecurityEvent(event);
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    req: Request,
    reason: string,
    severity: SecuritySeverity = SecuritySeverity.HIGH,
    additionalData?: Record<string, any>
  ): void {
    const event: SecurityEvent = {
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity,
      message: `Suspicious activity detected: ${reason}`,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      payload: req.body,
      timestamp: new Date(),
      metadata: additionalData
    };

    this.logSecurityEvent(event);
  }

  /**
   * Log rate limiting events
   */
  logRateLimitEvent(req: Request, limitType: string): void {
    const event: SecurityEvent = {
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.MEDIUM,
      message: `Rate limit exceeded for ${limitType}`,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      timestamp: new Date(),
      metadata: { limitType }
    };

    this.logSecurityEvent(event);
  }

  /**
   * Log API key misuse
   */
  logApiKeyMisuse(req: Request, reason: string, keyId?: string): void {
    const event: SecurityEvent = {
      type: SecurityEventType.API_KEY_MISUSE,
      severity: SecuritySeverity.HIGH,
      message: `API key misuse detected: ${reason}`,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date(),
      metadata: { keyId, reason }
    };

    this.logSecurityEvent(event);
  }

  /**
   * Log potential injection attacks
   */
  logInjectionAttempt(
    req: Request,
    type: SecurityEventType.SQL_INJECTION_ATTEMPT | SecurityEventType.XSS_ATTEMPT,
    detectedPattern: string
  ): void {
    const event: SecurityEvent = {
      type,
      severity: SecuritySeverity.CRITICAL,
      message: `${type} detected`,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      payload: req.body,
      timestamp: new Date(),
      metadata: { detectedPattern }
    };

    this.logSecurityEvent(event);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    // This would typically query a database or log aggregation service
    // For now, return a placeholder structure
    return Promise.resolve({
      timeframe,
      totalEvents: this.eventCounts.size,
      eventsByType: Object.fromEntries(this.eventCounts),
      criticalEvents: 0,
      highSeverityEvents: 0,
      topIPs: [],
      topUserAgents: [],
      timestamp: new Date()
    });
  }

  private getLogLevel(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.LOW:
        return 'info';
      case SecuritySeverity.MEDIUM:
        return 'warn';
      case SecuritySeverity.HIGH:
      case SecuritySeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  private checkForAlerts(event: SecurityEvent): void {
    const threshold = this.alertThresholds.get(event.type);
    if (!threshold) return;

    const key = `${event.type}_${event.ip}_${new Date().getHours()}`;
    const currentCount = this.eventCounts.get(key) || 0;
    this.eventCounts.set(key, currentCount + 1);

    if (currentCount + 1 >= threshold) {
      this.triggerAlert(event, currentCount + 1);
    }
  }

  private triggerAlert(event: SecurityEvent, count: number): void {
    const alertMessage = `SECURITY ALERT: ${event.type} threshold exceeded (${count} events) from IP ${event.ip}`;
    
    this.logger.error(alertMessage, {
      alertType: 'THRESHOLD_EXCEEDED',
      originalEvent: event,
      count,
      timestamp: new Date()
    });

    // In a production environment, you would:
    // 1. Send email/SMS alerts to security team
    // 2. Integrate with incident management systems
    // 3. Automatically block suspicious IPs
    // 4. Trigger additional security measures
  }
}

// Singleton instance
export const securityMonitoring = new SecurityMonitoringService();

export default SecurityMonitoringService;
