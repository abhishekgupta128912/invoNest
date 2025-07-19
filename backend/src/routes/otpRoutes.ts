import express from 'express';
import {
  sendLoginOTP,
  verifyLoginOTP,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  sendOperationOTP,
  verifyOperationOTP,
  getOTPStats
} from '../controllers/otpController';
import { authenticate } from '../middleware/auth';
import { recaptchaService } from '../services/recaptchaService';

// Import express-validator using require for compatibility
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Public routes (no authentication required)

/**
 * @route   POST /api/otp/send-login
 * @desc    Send OTP for login
 * @access  Public
 */
router.post('/send-login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
],
recaptchaService.createMiddleware('otp_login'),
validateRequest,
sendLoginOTP);

/**
 * @route   POST /api/otp/verify-login
 * @desc    Verify login OTP and authenticate user
 * @access  Public
 */
router.post('/verify-login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number')
],
recaptchaService.createMiddleware('otp_verify'),
validateRequest,
verifyLoginOTP);

/**
 * @route   POST /api/otp/send-password-reset
 * @desc    Send OTP for password reset
 * @access  Public
 */
router.post('/send-password-reset', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
],
recaptchaService.createMiddleware('forgot_password'),
validateRequest,
sendPasswordResetOTP);

/**
 * @route   POST /api/otp/verify-password-reset
 * @desc    Verify password reset OTP
 * @access  Public
 */
router.post('/verify-password-reset', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number')
], validateRequest, verifyPasswordResetOTP);

// Protected routes (authentication required)
router.use(authenticate);

/**
 * @route   POST /api/otp/send-operation
 * @desc    Send OTP for sensitive operations
 * @access  Private
 */
router.post('/send-operation', [
  body('operation')
    .isIn(['profile-update', 'sensitive-operation'])
    .withMessage('Invalid operation type')
], validateRequest, sendOperationOTP);

/**
 * @route   POST /api/otp/verify-operation
 * @desc    Verify operation OTP
 * @access  Private
 */
router.post('/verify-operation', [
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  body('operation')
    .isIn(['profile-update', 'sensitive-operation'])
    .withMessage('Invalid operation type')
], validateRequest, verifyOperationOTP);

/**
 * @route   GET /api/otp/stats
 * @desc    Get OTP statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats', getOTPStats);

export default router;
