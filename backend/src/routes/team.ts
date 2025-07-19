import express from 'express';
import { authenticate } from '../middleware/auth';
import { checkFeatureAccess } from '../middleware/usageTracking';
import {
  inviteTeamMember,
  getTeamMembers,
  updateTeamMember,
  removeTeamMember,
  acceptInvitation,
  getUserMemberships,
  checkPermissions,
  getTeamStats
} from '../controllers/teamController';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/team/invite
 * @desc    Invite a team member
 * @access  Private (Business plan + team management permission)
 */
router.post('/invite', checkFeatureAccess('multiUser'), inviteTeamMember);

/**
 * @route   GET /api/team/members
 * @desc    Get team members
 * @access  Private (Business plan)
 */
router.get('/members', checkFeatureAccess('multiUser'), getTeamMembers);

/**
 * @route   PUT /api/team/members/:memberId
 * @desc    Update team member
 * @access  Private (Business plan + team management permission)
 */
router.put('/members/:memberId', checkFeatureAccess('multiUser'), updateTeamMember);

/**
 * @route   DELETE /api/team/members/:memberId
 * @desc    Remove team member
 * @access  Private (Business plan + team management permission)
 */
router.delete('/members/:memberId', checkFeatureAccess('multiUser'), removeTeamMember);

/**
 * @route   POST /api/team/accept-invitation
 * @desc    Accept team invitation
 * @access  Private
 */
router.post('/accept-invitation', acceptInvitation);

/**
 * @route   GET /api/team/memberships
 * @desc    Get user's team memberships
 * @access  Private
 */
router.get('/memberships', getUserMemberships);

/**
 * @route   GET /api/team/permissions
 * @desc    Check user permissions
 * @access  Private
 */
router.get('/permissions', checkPermissions);

/**
 * @route   GET /api/team/stats
 * @desc    Get team statistics
 * @access  Private (Business plan)
 */
router.get('/stats', checkFeatureAccess('multiUser'), getTeamStats);

export default router;
