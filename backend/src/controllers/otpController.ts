import { Request, Response } from 'express';
import otpService from '../services/otpService';
import User from '../models/User';
import { IUser } from '../models/User';

/**
 * Send OTP for login
 */
export const sendLoginOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'No account found with this email address'
      });
      return;
    }

    // Send OTP
    const result = await otpService.sendOTP(email, user.name, 'login');

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          email: email,
          otpId: result.otpId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Send login OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Verify login OTP
 */
export const verifyLoginOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
      return;
    }

    // Verify OTP
    const verification = await otpService.verifyOTP(email, otp, 'login');

    if (!verification.isValid) {
      res.status(400).json({
        success: false,
        message: verification.message,
        remainingAttempts: verification.remainingAttempts
      });
      return;
    }

    // Get user details
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Generate JWT tokens (you'll need to import these from your auth utils)
    const { generateToken, generateRefreshToken } = require('../utils/jwt');
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessName: user.businessName,
          gstNumber: user.gstNumber,
          phone: user.phone,
          address: user.address,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Verify login OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Send OTP for password reset
 */
export const sendPasswordResetOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not for security
      res.status(200).json({
        success: true,
        message: 'If an account with this email exists, an OTP has been sent.'
      });
      return;
    }

    // Send OTP
    const result = await otpService.sendOTP(email, user.name, 'password-reset');

    res.status(200).json({
      success: true,
      message: 'If an account with this email exists, an OTP has been sent.',
      data: result.success ? { otpId: result.otpId } : undefined
    });
  } catch (error) {
    console.error('Send password reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Verify password reset OTP
 */
export const verifyPasswordResetOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
      return;
    }

    // Verify OTP
    const verification = await otpService.verifyOTP(email, otp, 'password-reset');

    if (!verification.isValid) {
      res.status(400).json({
        success: false,
        message: verification.message,
        remainingAttempts: verification.remainingAttempts
      });
      return;
    }

    // Generate a temporary token for password reset
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user with reset token
    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      },
      { new: true }
    );

    console.log('🔑 Password reset token generated:', {
      email,
      resetToken: resetToken.substring(0, 8) + '...',
      expires: resetExpires,
      userUpdated: !!updatedUser
    });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      data: {
        resetToken
      }
    });
  } catch (error) {
    console.error('Verify password reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Send OTP for sensitive operations (profile updates, etc.)
 */
export const sendOperationOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { operation } = req.body;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const validOperations = ['profile-update', 'sensitive-operation'];
    if (!operation || !validOperations.includes(operation)) {
      res.status(400).json({
        success: false,
        message: 'Valid operation type is required'
      });
      return;
    }

    // Send OTP
    const result = await otpService.sendOTP(user.email, user.name, operation);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          otpId: result.otpId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Send operation OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Verify operation OTP
 */
export const verifyOperationOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { otp, operation } = req.body;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!otp || !operation) {
      res.status(400).json({
        success: false,
        message: 'OTP and operation type are required'
      });
      return;
    }

    // Verify OTP
    const verification = await otpService.verifyOTP(user.email, otp, operation);

    if (!verification.isValid) {
      res.status(400).json({
        success: false,
        message: verification.message,
        remainingAttempts: verification.remainingAttempts
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can proceed with the operation.',
      data: {
        verified: true,
        operation
      }
    });
  } catch (error) {
    console.error('Verify operation OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get OTP statistics (admin only)
 */
export const getOTPStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;

    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const stats = otpService.getStats();

    res.status(200).json({
      success: true,
      message: 'OTP statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Get OTP stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
