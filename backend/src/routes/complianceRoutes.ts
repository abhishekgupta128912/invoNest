import express from 'express';
import {
  getComplianceCalendar,
  getUpcomingDeadlines,
  markComplianceCompleted,
  updateComplianceSettings,
  addCustomCompliance,
  getComplianceStats,
  getUserCompliance,
  getOverdueActivity,
  clearUserCompliance
} from '../controllers/complianceController';
import { authenticate } from '../middleware/auth';
import { validateComplianceCreation, validateComplianceUpdate } from '../middleware/complianceValidation';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get user compliance data (for dashboard)
router.get('/user-compliance', getUserCompliance);

// Get compliance calendar
router.get('/calendar', getComplianceCalendar);

// Get upcoming deadlines
router.get('/upcoming', getUpcomingDeadlines);

// Get compliance statistics
router.get('/stats', getComplianceStats);

// Get overdue activity details
router.get('/overdue-activity', getOverdueActivity);

// Mark compliance as completed
router.patch('/:complianceId/complete', markComplianceCompleted);

// Update compliance settings
router.put('/:complianceId/settings', validateComplianceUpdate, updateComplianceSettings);

// Add custom compliance item
router.post('/custom', validateComplianceCreation, addCustomCompliance);

// Clear all user compliance data (for removing fake data)
router.delete('/clear-all', clearUserCompliance);

export default router;
