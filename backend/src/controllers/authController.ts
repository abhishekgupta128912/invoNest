import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { ComplianceDeadline, UserCompliance } from '../models/Compliance';
import { NotificationPreference } from '../models/Notification';
import getEmailService from '../services/emailService';
import UPIValidationService from '../services/upiValidationService';
import { validateAdminCredentials, createAdminUserObject } from '../utils/adminAuth';

// Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      password,
      businessName,
      gstNumber,
      phone,
      address
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
      return;
    }

    // Check if GST number already exists (if provided)
    if (gstNumber) {
      const existingGST = await User.findOne({ gstNumber });
      if (existingGST) {
        res.status(400).json({
          success: false,
          message: 'GST number already registered'
        });
        return;
      }
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      businessName,
      gstNumber,
      phone,
      address
    });

    // Auto-verify email for development (better UX)
    user.isEmailVerified = true;
    await user.save();

    // Send welcome email (don't block registration if email fails)
    try {
      const emailService = getEmailService();
      await emailService.sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.error('Failed to send welcome email during registration:', error);
    }

    // Initialize notification preferences only (users can add compliance items manually)
    await initializeNotificationPreferences((user._id as any).toString());

    // Note: Compliance items are not auto-seeded to avoid fake data
    console.log(`✅ User registered successfully: ${user.email}`);

    // Create free subscription for new user
    try {
      const { SubscriptionService } = await import('../services/SubscriptionService');
      await SubscriptionService.createSubscription(
        (user._id as any).toString(),
        'free',
        'monthly',
        false
      );
      console.log(`Created free subscription for user ${user._id}`);
    } catch (error) {
      console.error('Error creating free subscription during registration:', error);
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
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
          createdAt: user.createdAt
        },
        token,
        refreshToken
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Check admin credentials first
    const isAdminLogin = await validateAdminCredentials(email, password);

    if (isAdminLogin) {
      // Handle admin login
      const adminUser = createAdminUserObject();

      // Generate tokens for admin
      const token = generateToken(adminUser as any);
      const refreshToken = generateRefreshToken(adminUser as any);

      res.status(200).json({
        success: true,
        message: 'Admin login successful',
        data: {
          user: adminUser,
          token,
          refreshToken
        }
      });
      return;
    }

    // Find regular user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
      return;
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate tokens
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
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

// Get current user profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Fetch fresh data from database to ensure we have the latest updates
    const freshUser = await User.findById(user._id);

    if (!freshUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    console.log('🔍 Profile request - Fresh user data:', {
      name: freshUser.name,
      businessName: freshUser.businessName,
      hasLogo: !!freshUser.logo,
      hasSignature: !!freshUser.signature,
      signature: freshUser.signature,
      updatedAt: freshUser.updatedAt
    });

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: freshUser._id,
          name: freshUser.name,
          email: freshUser.email,
          role: freshUser.role,
          businessName: freshUser.businessName,
          logo: freshUser.logo,
          signature: freshUser.signature,
          gstNumber: freshUser.gstNumber,
          phone: freshUser.phone,
          address: freshUser.address,
          upiId: freshUser.upiId,
          bankDetails: freshUser.bankDetails,
          isEmailVerified: freshUser.isEmailVerified,
          lastLogin: freshUser.lastLogin,
          createdAt: freshUser.createdAt,
          updatedAt: freshUser.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const {
      name,
      businessName,
      logo,
      signature,
      gstNumber,
      phone,
      address,
      upiId,
      bankDetails
    } = req.body;

    console.log('🔄 Profile update request received:', {
      userId: user?._id,
      name,
      businessName,
      gstNumber,
      phone,
      upiId
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Check if GST number is being changed and if it already exists
    if (gstNumber && gstNumber !== user.gstNumber) {
      const existingGST = await User.findOne({
        gstNumber,
        _id: { $ne: user._id }
      });

      if (existingGST) {
        res.status(400).json({
          success: false,
          message: 'GST number already registered by another user'
        });
        return;
      }
    }

    // Validate UPI ID if provided
    if (upiId !== undefined && upiId !== user.upiId) {
      if (upiId && upiId.trim()) {
        const upiValidation = await UPIValidationService.validateWithSuggestions(upiId.trim());

        if (!upiValidation.isValid) {
          res.status(400).json({
            success: false,
            message: upiValidation.error || 'Invalid UPI ID',
            suggestions: upiValidation.suggestions
          });
          return;
        }
      }
    }

    // Update user fields
    const updateFields: any = {};

    if (name !== undefined) updateFields.name = name;
    if (businessName !== undefined) updateFields.businessName = businessName;
    if (logo !== undefined) updateFields.logo = logo;
    if (signature !== undefined) updateFields.signature = signature;
    if (gstNumber !== undefined) updateFields.gstNumber = gstNumber;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (upiId !== undefined) updateFields.upiId = upiId;
    if (bankDetails !== undefined) updateFields.bankDetails = bankDetails;

    console.log('🔄 Updating user profile with fields:', updateFields);
    console.log('🔍 User ID being updated:', user._id);

    // First, let's check the current user data
    const currentUser = await User.findById(user._id);
    console.log('📋 Current user data before update:', {
      name: currentUser?.name,
      businessName: currentUser?.businessName,
      gstNumber: currentUser?.gstNumber
    });

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateFields,
      {
        new: true,
        runValidators: true
      }
    );

    console.log('📋 User data after update:', {
      name: updatedUser?.name,
      businessName: updatedUser?.businessName,
      gstNumber: updatedUser?.gstNumber
    });

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    console.log('✅ Profile updated successfully:', {
      userId: updatedUser._id,
      name: updatedUser.name,
      businessName: updatedUser.businessName,
      updatedAt: updatedUser.updatedAt
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          businessName: updatedUser.businessName,
          logo: updatedUser.logo,
          gstNumber: updatedUser.gstNumber,
          phone: updatedUser.phone,
          address: updatedUser.address,
          upiId: updatedUser.upiId,
          bankDetails: updatedUser.bankDetails,
          isEmailVerified: updatedUser.isEmailVerified,
          lastLogin: updatedUser.lastLogin,
          updatedAt: updatedUser.updatedAt
        }
      }
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Logout user with token blacklisting
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Import tokenBlacklist service
      const { tokenBlacklist } = require('../services/tokenBlacklistService');

      // Blacklist the current token
      await tokenBlacklist.blacklistToken(token, 'logout');

      console.log(`🚫 Token blacklisted for user ${(req as any).user?.id} on logout`);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Token has been invalidated.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

// Helper function to initialize user compliance items
async function initializeUserCompliance(userId: string) {
  try {
    // Get all active compliance deadlines
    const complianceDeadlines = await ComplianceDeadline.find({ isActive: true });

    // Create user compliance entries for each deadline
    const userComplianceItems = complianceDeadlines.map(deadline => ({
      userId,
      complianceId: deadline._id,
      isEnabled: true,
      reminderDays: [7, 3, 1], // Default reminder days
      nextDueDate: deadline.nextDueDate || deadline.dueDate,
      isCompleted: false
    }));

    await UserCompliance.insertMany(userComplianceItems);
    console.log(`Initialized ${userComplianceItems.length} compliance items for user ${userId}`);
  } catch (error) {
    console.error('Error initializing user compliance:', error);
  }
}

// Helper function to initialize notification preferences
async function initializeNotificationPreferences(userId: string) {
  try {
    const preferences = new NotificationPreference({
      userId,
      emailNotifications: true,
      complianceReminders: true,
      invoiceReminders: true,
      systemUpdates: true,
      marketingEmails: false,
      reminderTiming: {
        days: [7, 3, 1],
        timeOfDay: '09:00',
        timezone: 'Asia/Kolkata'
      },
      maxDailyEmails: 5,
      digestMode: false
    });

    await preferences.save();
    console.log(`Initialized notification preferences for user ${userId}`);
  } catch (error) {
    console.error('Error initializing notification preferences:', error);
  }
}

// Send email verification
export const sendEmailVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
      return;
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with verification token
    await User.findByIdAndUpdate(user._id, {
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });

    // Send verification email
    try {
      const emailService = getEmailService();
      await emailService.sendEmailVerificationEmail(
        user.email,
        verificationToken,
        user.name
      );

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully! Please check your inbox.'
      });
    } catch (emailError: any) {
      console.error('Failed to send verification email:', emailError);

      // If email service is not configured, provide alternative instructions
      if (emailError.message?.includes('not configured') || emailError.code === 'EAUTH') {
        res.status(200).json({
          success: true,
          message: 'Email service is not configured. For development purposes, you can manually verify your email by visiting: /verify-email?token=' + verificationToken,
          developmentToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Email service is currently unavailable. Please try again later.'
        });
      }
      return;
    }



  } catch (error) {
    console.error('Send email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify email with token
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
      return;
    }

    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
      return;
    }

    // Update user as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isEmailVerified: user.isEmailVerified
        }
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Validate UPI ID
export const validateUPI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { upiId } = req.body;

    if (!upiId) {
      res.status(400).json({
        success: false,
        message: 'UPI ID is required'
      });
      return;
    }

    const validation = await UPIValidationService.validateWithSuggestions(upiId);

    if (validation.isValid) {
      res.status(200).json({
        success: true,
        message: 'UPI ID is valid',
        data: {
          upiId,
          provider: validation.provider,
          exists: validation.exists
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: validation.error || 'Invalid UPI ID',
        suggestions: validation.suggestions
      });
    }

  } catch (error) {
    console.error('UPI validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to validate UPI ID at this time'
    });
  }
};

// Get popular UPI providers
export const getUPIProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const providers = UPIValidationService.getPopularProviders();

    res.status(200).json({
      success: true,
      message: 'UPI providers retrieved successfully',
      data: providers
    });

  } catch (error) {
    console.error('Get UPI providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reset password using reset token
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resetToken, newPassword } = req.body;

    console.log('🔐 Password reset attempt:', {
      hasResetToken: !!resetToken,
      resetTokenPreview: resetToken ? resetToken.substring(0, 8) + '...' : 'none',
      hasNewPassword: !!newPassword,
      timestamp: new Date().toISOString()
    });

    if (!resetToken || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Reset token and new password are required'
      });
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');

    console.log('🔍 Reset token lookup:', {
      tokenFound: !!user,
      currentTime: new Date().toISOString(),
      searchToken: resetToken.substring(0, 8) + '...'
    });

    // Also check if there's a user with this token but expired
    const expiredUser = await User.findOne({
      passwordResetToken: resetToken
    }).select('+passwordResetToken +passwordResetExpires');

    if (expiredUser && !user) {
      console.log('⏰ Token found but expired:', {
        tokenExpires: expiredUser.passwordResetExpires,
        currentTime: new Date(),
        isExpired: expiredUser.passwordResetExpires ? expiredUser.passwordResetExpires < new Date() : true
      });
    }

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
      return;
    }

    // Hash the new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password and clear reset token
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { password } = req.body;

    console.log('🗑️ Account deletion attempt:', {
      userId: user?._id,
      hasPassword: !!password,
      timestamp: new Date().toISOString()
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
      return;
    }

    // Verify password before deletion
    const userWithPassword = await User.findById(user._id).select('+password');
    if (!userWithPassword) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const isPasswordValid = await userWithPassword.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
      return;
    }

    // Import models for cleanup
    const Invoice = require('../models/Invoice').default;
    const { UserCompliance } = require('../models/Compliance');
    const { NotificationPreference } = require('../models/Notification');
    const InvoiceTemplate = require('../models/InvoiceTemplate').default;
    const RecurringInvoice = require('../models/RecurringInvoice').default;
    const ApiKey = require('../models/ApiKey').default;
    const Subscription = require('../models/Subscription').default;

    // Start a transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete all user-related data
      await Invoice.deleteMany({ userId: user._id }, { session });
      await UserCompliance.deleteMany({ userId: user._id }, { session });
      await NotificationPreference.deleteMany({ userId: user._id }, { session });
      await InvoiceTemplate.deleteMany({ userId: user._id }, { session });
      await RecurringInvoice.deleteMany({ userId: user._id }, { session });
      await ApiKey.deleteMany({ userId: user._id }, { session });
      await Subscription.deleteMany({ userId: user._id }, { session });

      // Delete the user account
      await User.findByIdAndDelete(user._id, { session });

      // Commit the transaction
      await session.commitTransaction();

      console.log(`✅ Account deleted successfully for user ${user._id}`);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully. All your data has been permanently removed.'
      });

    } catch (error) {
      // Rollback the transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during account deletion'
    });
  }
};