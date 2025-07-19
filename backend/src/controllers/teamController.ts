import { Request, Response } from 'express';
import TeamService from '../services/teamService';
import TeamMember from '../models/TeamMember';

const teamService = new TeamService();

/**
 * Invite a team member
 */
export const inviteTeamMember = async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    const organizationId = req.user?._id?.toString(); // The current user's organization
    const invitedBy = req.user?._id?.toString();

    // Validate input
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }

    if (!['admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, manager, or user'
      });
    }

    // Check if current user has permission to invite
    const currentUserMember = await TeamMember.findOne({
      organizationId,
      userId: invitedBy,
      status: 'active'
    });

    if (!currentUserMember || !currentUserMember.permissions.team.invite) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to invite team members'
      });
    }

    const result = await teamService.inviteTeamMember({
      email,
      role,
      organizationId: organizationId!,
      invitedBy: invitedBy!
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error inviting team member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get team members
 */
export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?._id?.toString();
    const teamMembers = await teamService.getTeamMembers(organizationId!);

    res.json({
      success: true,
      data: teamMembers
    });
  } catch (error) {
    console.error('Error getting team members:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update team member
 */
export const updateTeamMember = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { role, status, permissions } = req.body;
    const organizationId = req.user?._id?.toString();
    const updatedBy = req.user?._id?.toString();

    const result = await teamService.updateTeamMember(
      organizationId!,
      memberId,
      { role, status, permissions },
      updatedBy!
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Remove team member
 */
export const removeTeamMember = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const organizationId = req.user?._id?.toString();
    const removedBy = req.user?._id?.toString();

    const result = await teamService.removeTeamMember(
      organizationId!,
      memberId,
      removedBy!
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Accept team invitation
 */
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.user?._id?.toString();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required'
      });
    }

    const result = await teamService.acceptInvitation(token, userId!);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's team memberships
 */
export const getUserMemberships = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id?.toString();
    const memberships = await teamService.getUserTeamMemberships(userId!);

    res.json({
      success: true,
      data: memberships
    });
  } catch (error) {
    console.error('Error getting user memberships:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Check user permissions
 */
export const checkPermissions = async (req: Request, res: Response) => {
  try {
    const { resource, action } = req.query;
    const userId = req.user?._id?.toString();
    const organizationId = req.headers['x-organization-id'] as string || req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    if (!resource || !action) {
      return res.status(400).json({
        success: false,
        message: 'Resource and action are required'
      });
    }

    const hasPermission = await teamService.checkPermission(
      userId,
      organizationId,
      resource as string,
      action as string
    );

    res.json({
      success: true,
      data: {
        hasPermission,
        resource,
        action
      }
    });
  } catch (error) {
    console.error('Error checking permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get team statistics
 */
export const getTeamStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?._id?.toString();
    
    const teamMembers = await TeamMember.find({ organizationId });
    
    const stats = {
      totalMembers: teamMembers.length,
      activeMembers: teamMembers.filter(m => m.status === 'active').length,
      pendingInvitations: teamMembers.filter(m => m.status === 'pending').length,
      roleDistribution: {
        owner: teamMembers.filter(m => m.role === 'owner').length,
        admin: teamMembers.filter(m => m.role === 'admin').length,
        manager: teamMembers.filter(m => m.role === 'manager').length,
        user: teamMembers.filter(m => m.role === 'user').length
      },
      recentActivity: teamMembers
        .filter(m => m.lastActive)
        .sort((a, b) => new Date(b.lastActive!).getTime() - new Date(a.lastActive!).getTime())
        .slice(0, 5)
        .map(m => ({
          id: m._id,
          email: m.email,
          role: m.role,
          lastActive: m.lastActive
        }))
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting team stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
