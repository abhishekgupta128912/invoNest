import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
  sendEmailVerification,
  verifyEmail,
  validateUPI,
  getUPIProviders,
  resetPassword,
  deleteAccount
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRegistration, validateLogin, validateProfileUpdate } from '../middleware/validation';
import { recaptchaService } from '../services/recaptchaService';
// import { advancedBruteForceProtection } from '../middleware/security';
// import { handleValidationErrors, commonValidations } from '../middleware/inputSanitization';

const router = express.Router();

// Public routes with reCAPTCHA protection
router.post('/register',
  recaptchaService.createMiddleware('register'),
  validateRegistration,
  register
);
router.post('/login',
  recaptchaService.createMiddleware('login'),
  validateLogin,
  login
);

router.post('/verify-email', verifyEmail);
router.post('/reset-password', resetPassword);

// UPI validation routes (public)
router.post('/validate-upi', validateUPI);
router.get('/upi-providers', getUPIProviders);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', validateProfileUpdate, updateProfile);
router.post('/logout', logout);
router.post('/send-verification', sendEmailVerification);
router.delete('/account', deleteAccount);

export default router;
