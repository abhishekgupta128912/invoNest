import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  logout
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRegistration, validateLogin, validateProfileUpdate } from '../middleware/validation';

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', validateProfileUpdate, updateProfile);
router.post('/logout', logout);

export default router;
