import fetch from 'node-fetch';

interface RecaptchaVerificationResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

interface RecaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  errors?: string[];
}

class RecaptchaService {
  private secretKey: string;
  private minScore: number;

  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY || '';
    this.minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

    if (!this.secretKey) {
      console.warn('⚠️ RECAPTCHA_SECRET_KEY not configured. reCAPTCHA verification will be disabled.');
    }
  }

  /**
   * Verify reCAPTCHA v3 token
   */
  async verifyToken(
    token: string, 
    expectedAction?: string,
    remoteIp?: string
  ): Promise<RecaptchaVerificationResult> {
    // If no secret key is configured, skip verification in development
    if (!this.secretKey) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ reCAPTCHA verification skipped in development mode');
        return { success: true, score: 1.0 };
      } else {
        return { 
          success: false, 
          errors: ['reCAPTCHA not configured'] 
        };
      }
    }

    if (!token) {
      return { 
        success: false, 
        errors: ['reCAPTCHA token is required'] 
      };
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });

      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json() as RecaptchaVerificationResponse;

      console.log('🔐 reCAPTCHA verification result:', {
        success: data.success,
        score: data.score,
        action: data.action,
        expectedAction,
        errors: data['error-codes'],
      });

      if (!data.success) {
        return {
          success: false,
          errors: data['error-codes'] || ['reCAPTCHA verification failed'],
        };
      }

      // Check score (for v3)
      if (data.score !== undefined && data.score < this.minScore) {
        console.warn(`⚠️ reCAPTCHA score too low: ${data.score} < ${this.minScore}`);
        return {
          success: false,
          score: data.score,
          errors: ['Security verification failed. Please try again.'],
        };
      }

      // Check action if provided
      if (expectedAction && data.action !== expectedAction) {
        console.warn(`⚠️ reCAPTCHA action mismatch: expected ${expectedAction}, got ${data.action}`);
        return {
          success: false,
          action: data.action,
          errors: ['Invalid security verification action'],
        };
      }

      return {
        success: true,
        score: data.score,
        action: data.action,
      };

    } catch (error) {
      console.error('❌ reCAPTCHA verification error:', error);
      return {
        success: false,
        errors: ['reCAPTCHA verification service unavailable'],
      };
    }
  }

  /**
   * Middleware to verify reCAPTCHA token from request body
   */
  createMiddleware(expectedAction?: string) {
    return async (req: any, res: any, next: any) => {
      const { recaptchaToken } = req.body;
      const remoteIp = req.ip || req.connection.remoteAddress;

      const result = await this.verifyToken(recaptchaToken, expectedAction, remoteIp);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Security verification failed',
          errors: result.errors,
        });
      }

      // Add verification result to request for logging
      req.recaptchaVerification = result;
      next();
    };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      enabled: !!this.secretKey,
      minScore: this.minScore,
      environment: process.env.NODE_ENV,
    };
  }
}

// Export singleton instance
export const recaptchaService = new RecaptchaService();
export default recaptchaService;
