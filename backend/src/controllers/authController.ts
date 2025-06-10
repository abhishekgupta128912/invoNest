import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { ComplianceDeadline, UserCompliance } from '../models/Compliance';
import { NotificationPreference } from '../models/Notification';

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

    await user.save();

    // Initialize user compliance and notification preferences
    await initializeUserCompliance((user._id as any).toString());
    await initializeNotificationPreferences((user._id as any).toString());

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

    // Find user and include password for comparison
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

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
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
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
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
      gstNumber,
      phone,
      address
    } = req.body;

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

    // Update user fields
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        ...(name && { name }),
        ...(businessName && { businessName }),
        ...(gstNumber && { gstNumber }),
        ...(phone && { phone }),
        ...(address && { address })
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

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
          gstNumber: updatedUser.gstNumber,
          phone: updatedUser.phone,
          address: updatedUser.address,
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

// Logout user (client-side token removal)
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: 'Logout successful. Please remove token from client storage.'
  });
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
