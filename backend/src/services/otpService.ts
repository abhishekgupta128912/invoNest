import crypto from 'crypto';
import getEmailService from './emailService';

interface OTPRecord {
  otp: string;
  email: string;
  purpose: string;
  expiresAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
}

interface OTPValidationResult {
  isValid: boolean;
  message: string;
  remainingAttempts?: number;
}

class OTPService {
  private otpStore: Map<string, OTPRecord> = new Map();
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Clean up expired OTPs periodically
    setInterval(() => {
      this.cleanupExpiredOTPs();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Generate a secure 6-digit OTP
   */
  private generateOTP(): string {
    // Generate cryptographically secure random number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    
    // Convert to 6-digit OTP
    const otp = (randomNumber % 1000000).toString().padStart(this.OTP_LENGTH, '0');
    return otp;
  }

  /**
   * Generate OTP key for storage
   */
  private generateOTPKey(email: string, purpose: string): string {
    return `${email}:${purpose}`;
  }

  /**
   * Send OTP for various purposes
   */
  async sendOTP(
    email: string, 
    userName: string, 
    purpose: 'login' | 'registration' | 'password-reset' | 'profile-update' | 'sensitive-operation'
  ): Promise<{ success: boolean; message: string; otpId?: string }> {
    try {
      const otp = this.generateOTP();
      const otpKey = this.generateOTPKey(email, purpose);
      const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      // Check if there's an existing OTP for this email/purpose
      const existingOTP = this.otpStore.get(otpKey);
      if (existingOTP && !this.isExpired(existingOTP)) {
        return {
          success: false,
          message: `An OTP was already sent. Please wait ${Math.ceil((existingOTP.expiresAt.getTime() - Date.now()) / 60000)} minutes before requesting a new one.`
        };
      }

      // Store OTP
      const otpRecord: OTPRecord = {
        otp,
        email,
        purpose,
        expiresAt,
        attempts: 0,
        isUsed: false,
        createdAt: new Date()
      };

      this.otpStore.set(otpKey, otpRecord);

      // Send OTP via email
      let emailSent = false;
      const emailService = getEmailService();
      if (purpose === 'login') {
        emailSent = await emailService.sendLoginOTPEmail(email, otp, userName);
      } else {
        emailSent = await emailService.sendOTPEmail(email, otp, userName, purpose);
      }

      if (!emailSent) {
        // Remove OTP from store if email failed
        this.otpStore.delete(otpKey);
        return {
          success: false,
          message: 'Failed to send OTP email. Please try again.'
        };
      }

      console.log(`OTP sent successfully for ${email} (${purpose})`);
      
      return {
        success: true,
        message: 'OTP sent successfully to your email address.',
        otpId: otpKey
      };

    } catch (error) {
      console.error('Failed to send OTP:', error);
      return {
        success: false,
        message: 'Failed to send OTP. Please try again later.'
      };
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(
    email: string, 
    otp: string, 
    purpose: string
  ): Promise<OTPValidationResult> {
    const otpKey = this.generateOTPKey(email, purpose);
    const otpRecord = this.otpStore.get(otpKey);

    if (!otpRecord) {
      return {
        isValid: false,
        message: 'No OTP found for this email and purpose. Please request a new OTP.'
      };
    }

    // Check if OTP is expired
    if (this.isExpired(otpRecord)) {
      this.otpStore.delete(otpKey);
      return {
        isValid: false,
        message: 'OTP has expired. Please request a new one.'
      };
    }

    // Check if OTP is already used
    if (otpRecord.isUsed) {
      return {
        isValid: false,
        message: 'OTP has already been used. Please request a new one.'
      };
    }

    // Check attempts
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      this.otpStore.delete(otpKey);
      return {
        isValid: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      };
    }

    // Increment attempts
    otpRecord.attempts++;

    // Verify OTP
    if (otpRecord.otp !== otp) {
      const remainingAttempts = this.MAX_ATTEMPTS - otpRecord.attempts;
      
      if (remainingAttempts <= 0) {
        this.otpStore.delete(otpKey);
        return {
          isValid: false,
          message: 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.'
        };
      }

      return {
        isValid: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts
      };
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    
    console.log(`OTP verified successfully for ${email} (${purpose})`);
    
    // Clean up used OTP after a short delay
    setTimeout(() => {
      this.otpStore.delete(otpKey);
    }, 30000); // 30 seconds

    return {
      isValid: true,
      message: 'OTP verified successfully.'
    };
  }

  /**
   * Check if OTP is expired
   */
  private isExpired(otpRecord: OTPRecord): boolean {
    return Date.now() > otpRecord.expiresAt.getTime();
  }

  /**
   * Clean up expired OTPs
   */
  private cleanupExpiredOTPs(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, record] of this.otpStore.entries()) {
      if (now > record.expiresAt.getTime()) {
        this.otpStore.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired OTPs`);
    }
  }

  /**
   * Get OTP statistics (for monitoring)
   */
  getStats(): {
    totalActive: number;
    byPurpose: Record<string, number>;
    oldestOTP: Date | null;
  } {
    const stats = {
      totalActive: this.otpStore.size,
      byPurpose: {} as Record<string, number>,
      oldestOTP: null as Date | null
    };

    let oldest: Date | null = null;

    for (const record of this.otpStore.values()) {
      // Count by purpose
      stats.byPurpose[record.purpose] = (stats.byPurpose[record.purpose] || 0) + 1;
      
      // Track oldest
      if (!oldest || record.createdAt < oldest) {
        oldest = record.createdAt;
      }
    }

    stats.oldestOTP = oldest;
    return stats;
  }

  /**
   * Invalidate all OTPs for a user (useful for security purposes)
   */
  invalidateUserOTPs(email: string): number {
    let invalidatedCount = 0;
    
    for (const [key, record] of this.otpStore.entries()) {
      if (record.email === email) {
        this.otpStore.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      console.log(`Invalidated ${invalidatedCount} OTPs for user: ${email}`);
    }

    return invalidatedCount;
  }
}

// Export singleton instance
const otpService = new OTPService();
export default otpService;
