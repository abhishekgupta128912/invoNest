import express from 'express';
import {
  getComplianceCalendar,
  getUpcomingDeadlines,
  markComplianceCompleted,
  updateComplianceSettings,
  addCustomCompliance,
  getComplianceStats
} from '../controllers/complianceController';
import { authenticate } from '../middleware/auth';
import { validateComplianceCreation, validateComplianceUpdate } from '../middleware/complianceValidation';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get compliance calendar
router.get('/calendar', getComplianceCalendar);

// Get upcoming deadlines
router.get('/upcoming', getUpcomingDeadlines);

// Get compliance statistics
router.get('/stats', getComplianceStats);

// Mark compliance as completed
router.patch('/:complianceId/complete', markComplianceCompleted);

// Update compliance settings
router.put('/:complianceId/settings', validateComplianceUpdate, updateComplianceSettings);

// Add custom compliance item
router.post('/custom', validateComplianceCreation, addCustomCompliance);

export default router;
