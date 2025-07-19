import TeamMember from '../models/TeamMember';
import User from '../models/User';
import { EmailService, getEmailService } from './emailService';
import crypto from 'crypto';

export interface InviteTeamMemberData {
  email: string;
  role: 'admin' | 'manager' | 'user';
  organizationId: string;
  invitedBy: string;
}

export interface TeamMemberUpdate {
  role?: 'admin' | 'manager' | 'user';
  status?: 'active' | 'inactive';
  permissions?: any;
}

export class TeamService {
  private emailService: EmailService;

  constructor() {
    this.emailService = getEmailService();
  }

  /**
   * Invite a new team member
   */
  async inviteTeamMember(data: InviteTeamMemberData): Promise<{ success: boolean; message: string; teamMember?: any }> {
    try {
      const { email, role, organizationId, invitedBy } = data;

      // Check if user is already a team member
      const existingMember = await TeamMember.findOne({ 
        organizationId, 
        email: email.toLowerCase() 
      });

      if (existingMember) {
        return { 
          success: false, 
          message: 'User is already a team member' 
        };
      }

      // Check if user exists in the system
      let user = await User.findOne({ email: email.toLowerCase() });
      let isNewUser = false;

      if (!user) {
        // Create a placeholder user account
        const tempPassword = crypto.randomBytes(16).toString('hex');
        user = new User({
          name: email.split('@')[0], // Use email prefix as temporary name
          email: email.toLowerCase(),
          password: tempPassword,
          isEmailVerified: false,
          isActive: false // Will be activated when they accept the invitation
        });
        await user.save();
        isNewUser = true;
      }

      // Create team member record
      const teamMember = new TeamMember({
        organizationId,
        userId: user._id,
        email: email.toLowerCase(),
        role,
        invitedBy,
        status: 'pending'
      });

      await teamMember.save();

      // Send invitation email
      const invitationToken = crypto.randomBytes(32).toString('hex');
      
      // Store invitation token (you might want to add this to the TeamMember model)
      teamMember.set('invitationToken', invitationToken);
      await teamMember.save();

      await this.sendInvitationEmail(email, role, organizationId, invitationToken, isNewUser);

      return {
        success: true,
        message: 'Team member invited successfully',
        teamMember: {
          id: teamMember._id,
          email: teamMember.email,
          role: teamMember.role,
          status: teamMember.status,
          invitedAt: teamMember.invitedAt
        }
      };
    } catch (error) {
      console.error('Error inviting team member:', error);
      return { 
        success: false, 
        message: 'Failed to invite team member' 
      };
    }
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const teamMember = await TeamMember.findOne({ 
        invitationToken: token,
        status: 'pending'
      });

      if (!teamMember) {
        return { 
          success: false, 
          message: 'Invalid or expired invitation' 
        };
      }

      // Update team member status
      teamMember.status = 'active';
      teamMember.joinedAt = new Date();
      teamMember.userId = userId as any;
      teamMember.set('invitationToken', undefined);
      await teamMember.save();

      // Activate user account if it was a new user
      await User.findByIdAndUpdate(userId, { 
        isActive: true,
        isEmailVerified: true 
      });

      return {
        success: true,
        message: 'Invitation accepted successfully'
      };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { 
        success: false, 
        message: 'Failed to accept invitation' 
      };
    }
  }

  /**
   * Get team members for an organization
   */
  async getTeamMembers(organizationId: string): Promise<any[]> {
    try {
      const teamMembers = await TeamMember.find({ organizationId })
        .populate('userId', 'name email lastLogin')
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });

      return teamMembers.map(member => ({
        id: member._id,
        user: member.userId,
        email: member.email,
        role: member.role,
        permissions: member.permissions,
        status: member.status,
        invitedBy: member.invitedBy,
        invitedAt: member.invitedAt,
        joinedAt: member.joinedAt,
        lastActive: member.lastActive
      }));
    } catch (error) {
      console.error('Error getting team members:', error);
      return [];
    }
  }

  /**
   * Update team member
   */
  async updateTeamMember(
    organizationId: string, 
    memberId: string, 
    updates: TeamMemberUpdate,
    updatedBy: string
  ): Promise<{ success: boolean; message: string; teamMember?: any }> {
    try {
      const teamMember = await TeamMember.findOne({ 
        _id: memberId, 
        organizationId 
      });

      if (!teamMember) {
        return { 
          success: false, 
          message: 'Team member not found' 
        };
      }

      // Check if updater has permission to manage this member
      const updater = await TeamMember.findOne({ 
        organizationId, 
        userId: updatedBy 
      });

      if (!updater || !(updater as any).canManage(teamMember.role)) {
        return { 
          success: false, 
          message: 'Insufficient permissions to update this team member' 
        };
      }

      // Apply updates
      if (updates.role) teamMember.role = updates.role;
      if (updates.status) teamMember.status = updates.status;
      if (updates.permissions) {
        teamMember.permissions = { ...teamMember.permissions, ...updates.permissions };
      }

      await teamMember.save();

      return {
        success: true,
        message: 'Team member updated successfully',
        teamMember: {
          id: teamMember._id,
          email: teamMember.email,
          role: teamMember.role,
          status: teamMember.status,
          permissions: teamMember.permissions
        }
      };
    } catch (error) {
      console.error('Error updating team member:', error);
      return { 
        success: false, 
        message: 'Failed to update team member' 
      };
    }
  }

  /**
   * Remove team member
   */
  async removeTeamMember(
    organizationId: string, 
    memberId: string, 
    removedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const teamMember = await TeamMember.findOne({ 
        _id: memberId, 
        organizationId 
      });

      if (!teamMember) {
        return { 
          success: false, 
          message: 'Team member not found' 
        };
      }

      // Prevent removing the owner
      if (teamMember.role === 'owner') {
        return { 
          success: false, 
          message: 'Cannot remove the organization owner' 
        };
      }

      // Check permissions
      const remover = await TeamMember.findOne({ 
        organizationId, 
        userId: removedBy 
      });

      if (!remover || !(remover as any).canManage(teamMember.role)) {
        return { 
          success: false, 
          message: 'Insufficient permissions to remove this team member' 
        };
      }

      await TeamMember.findByIdAndDelete(memberId);

      return {
        success: true,
        message: 'Team member removed successfully'
      };
    } catch (error) {
      console.error('Error removing team member:', error);
      return { 
        success: false, 
        message: 'Failed to remove team member' 
      };
    }
  }

  /**
   * Get user's team memberships
   */
  async getUserTeamMemberships(userId: string): Promise<any[]> {
    try {
      const memberships = await TeamMember.find({ userId })
        .populate('organizationId', 'name businessName email')
        .sort({ joinedAt: -1 });

      return memberships.map(membership => ({
        id: membership._id,
        organization: membership.organizationId,
        role: membership.role,
        permissions: membership.permissions,
        status: membership.status,
        joinedAt: membership.joinedAt
      }));
    } catch (error) {
      console.error('Error getting user team memberships:', error);
      return [];
    }
  }

  /**
   * Check if user has permission for a specific action
   */
  async checkPermission(
    userId: string, 
    organizationId: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    try {
      const teamMember = await TeamMember.findOne({ 
        userId, 
        organizationId, 
        status: 'active' 
      });

      if (!teamMember) return false;

      return (teamMember as any).canPerform(resource, action);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    email: string, 
    role: string, 
    organizationId: string, 
    token: string,
    isNewUser: boolean
  ): Promise<void> {
    try {
      const organization = await User.findById(organizationId);
      const organizationName = organization?.businessName || organization?.name || 'InvoNest Organization';
      
      const inviteUrl = `${process.env.FRONTEND_URL}/team/accept-invitation?token=${token}`;
      
      const subject = `You're invited to join ${organizationName} on InvoNest`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Team Invitation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #ddd; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You're Invited!</h1>
              <p>Join ${organizationName} on InvoNest</p>
            </div>
            <div class="content">
              <h2>Welcome to the team!</h2>
              <p>You've been invited to join <strong>${organizationName}</strong> as a <strong>${role}</strong> on InvoNest.</p>
              
              ${isNewUser ? `
                <p>Since this is your first time using InvoNest, you'll need to set up your account when you accept this invitation.</p>
              ` : `
                <p>You can use your existing InvoNest account to access this organization.</p>
              `}
              
              <p>As a <strong>${role}</strong>, you'll be able to:</p>
              <ul>
                <li>Create and manage invoices</li>
                <li>Access customer information</li>
                <li>Upload and manage documents</li>
                ${role !== 'user' ? '<li>View analytics and reports</li>' : ''}
                ${role === 'admin' || role === 'owner' ? '<li>Manage team members</li>' : ''}
              </ul>
              
              <div style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation</a>
              </div>
              
              <p><small>This invitation will expire in 7 days. If you have any questions, please contact the team administrator.</small></p>
            </div>
            <div class="footer">
              <p>&copy; 2024 InvoNest. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.emailService.sendEmail(email, subject, html, `
        You're invited to join ${organizationName} on InvoNest
        
        You've been invited as a ${role}.
        
        Accept your invitation: ${inviteUrl}
        
        This invitation expires in 7 days.
        
        Thanks,
        InvoNest Team
      `);
    } catch (error) {
      console.error('Error sending invitation email:', error);
    }
  }
}

export default TeamService;
