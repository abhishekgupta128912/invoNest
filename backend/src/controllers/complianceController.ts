import { Request, Response } from 'express';
import { ComplianceDeadline, UserCompliance } from '../models/Compliance';
import { Notification } from '../models/Notification';
import getEmailService from '../services/emailService';

// Get user compliance data (for dashboard)
export const getUserCompliance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    // Get all user's compliance items
    const userCompliances = await UserCompliance.find({
      userId,
      isEnabled: true
    })
    .populate({
      path: 'complianceId',
      match: { isActive: true },
      select: 'title description type category priority penaltyInfo resources'
    })
    .sort({ nextDueDate: 1 });

    // Filter out items where compliance was not found (due to populate match)
    const validCompliances = userCompliances.filter(item => item.complianceId);

    res.json({
      success: true,
      data: validCompliances
    });

  } catch (error) {
    console.error('Get user compliance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user compliance data'
    });
  }
};

// Get all compliance deadlines for the current user
export const getComplianceCalendar = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { month, year, type } = req.query;

    // Build date filter
    let dateFilter: any = {};
    if (month && year) {
      const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);
      dateFilter = {
        nextDueDate: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    // Build type filter
    let typeFilter: any = {};
    if (type && type !== 'all') {
      typeFilter = { type };
    }

    // Get user's compliance items
    const userCompliances = await UserCompliance.find({
      userId,
      isEnabled: true,
      ...dateFilter
    })
    .populate({
      path: 'complianceId',
      match: { isActive: true, ...typeFilter },
      select: 'title description type category priority penaltyInfo resources'
    })
    .sort({ nextDueDate: 1 });

    // Filter out items where compliance was not found (due to populate match)
    const validCompliances = userCompliances.filter(item => item.complianceId);

    res.json({
      success: true,
      data: validCompliances
    });
  } catch (error) {
    console.error('Error fetching compliance calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch compliance calendar'
    });
  }
};

// Get upcoming deadlines (next 30 days)
export const getUpcomingDeadlines = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingCompliances = await UserCompliance.find({
      userId,
      isEnabled: true,
      isCompleted: false,
      nextDueDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    })
    .populate('complianceId')
    .sort({ nextDueDate: 1 })
    .limit(10);

    res.json({
      success: true,
      data: upcomingCompliances
    });
  } catch (error) {
    console.error('Error fetching upcoming deadlines:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming deadlines'
    });
  }
};

// Mark compliance as completed
export const markComplianceCompleted = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { complianceId } = req.params;
    const { notes } = req.body;

    const userCompliance = await UserCompliance.findOne({
      userId,
      _id: complianceId
    }).populate('complianceId');

    if (!userCompliance) {
      return res.status(404).json({
        success: false,
        message: 'Compliance item not found'
      });
    }

    // Mark as completed
    userCompliance.isCompleted = true;
    userCompliance.completedDate = new Date();
    if (notes) {
      userCompliance.notes = notes;
    }

    // For recurring items, create a new entry for the next occurrence instead of resetting
    const compliance = userCompliance.complianceId as any;
    if (compliance.frequency !== 'one_time') {
      const nextDueDate = calculateNextDueDate(userCompliance.nextDueDate, compliance.frequency);

      // Create a new UserCompliance entry for the next occurrence
      const nextOccurrence = new UserCompliance({
        userId: userCompliance.userId,
        complianceId: userCompliance.complianceId,
        isEnabled: userCompliance.isEnabled,
        reminderDays: userCompliance.reminderDays,
        nextDueDate: nextDueDate,
        isCompleted: false,
        customDueDate: userCompliance.customDueDate
      });

      await nextOccurrence.save();
      console.log(`✅ Created next occurrence for ${compliance.title} due on ${nextDueDate.toDateString()}`);
    }

    await userCompliance.save();

    res.json({
      success: true,
      message: 'Compliance marked as completed',
      data: userCompliance
    });
  } catch (error) {
    console.error('Error marking compliance as completed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark compliance as completed'
    });
  }
};

// Update user compliance settings
export const updateComplianceSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { complianceId } = req.params;
    const { isEnabled, customDueDate, reminderDays } = req.body;

    const userCompliance = await UserCompliance.findOne({
      userId,
      _id: complianceId
    });

    if (!userCompliance) {
      return res.status(404).json({
        success: false,
        message: 'Compliance item not found'
      });
    }

    // Update settings
    if (typeof isEnabled === 'boolean') {
      userCompliance.isEnabled = isEnabled;
    }
    if (customDueDate) {
      userCompliance.customDueDate = new Date(customDueDate);
      userCompliance.nextDueDate = new Date(customDueDate);
    }
    if (Array.isArray(reminderDays)) {
      userCompliance.reminderDays = reminderDays;
    }

    await userCompliance.save();

    res.json({
      success: true,
      message: 'Compliance settings updated',
      data: userCompliance
    });
  } catch (error) {
    console.error('Error updating compliance settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update compliance settings'
    });
  }
};

// Add custom compliance item
export const addCustomCompliance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const {
      title,
      description,
      dueDate,
      frequency,
      priority,
      reminderDays
    } = req.body;

    // Create custom compliance deadline
    const customCompliance = new ComplianceDeadline({
      title,
      description,
      type: 'custom',
      category: 'other',
      dueDate: new Date(dueDate),
      frequency,
      priority: priority || 'medium',
      applicableFor: ['custom'],
      isActive: true
    });

    await customCompliance.save();

    // Create user compliance entry
    const userCompliance = new UserCompliance({
      userId,
      complianceId: customCompliance._id,
      isEnabled: true,
      reminderDays: reminderDays || [7, 3, 1],
      nextDueDate: new Date(dueDate)
    });

    await userCompliance.save();

    res.status(201).json({
      success: true,
      message: 'Custom compliance item added',
      data: userCompliance
    });
  } catch (error) {
    console.error('Error adding custom compliance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add custom compliance item'
    });
  }
};

// Get compliance statistics
export const getComplianceStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const currentDate = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
      totalActive,
      completedThisMonth,
      upcomingCount,
      overdueCount
    ] = await Promise.all([
      UserCompliance.countDocuments({ userId, isEnabled: true }),
      UserCompliance.countDocuments({
        userId,
        isCompleted: true,
        completedDate: {
          $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        }
      }),
      UserCompliance.countDocuments({
        userId,
        isEnabled: true,
        isCompleted: false,
        nextDueDate: {
          $gte: currentDate,
          $lte: thirtyDaysFromNow
        }
      }),
      UserCompliance.countDocuments({
        userId,
        isEnabled: true,
        isCompleted: false,
        nextDueDate: { $lt: currentDate }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        completedThisMonth,
        upcomingCount,
        overdueCount
      }
    });
  } catch (error) {
    console.error('Error fetching compliance stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch compliance statistics'
    });
  }
};

// Get overdue activity details
export const getOverdueActivity = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const currentDate = new Date();

    // Get all overdue compliance items with details
    const overdueItems = await UserCompliance.find({
      userId,
      isEnabled: true,
      isCompleted: false,
      nextDueDate: { $lt: currentDate }
    })
    .populate({
      path: 'complianceId',
      match: { isActive: true },
      select: 'title description type category priority penaltyInfo resources'
    })
    .sort({ nextDueDate: 1 }) // Oldest overdue first
    .limit(20); // Limit to prevent performance issues

    // Filter out items where compliance was not found and calculate days overdue
    const validOverdueItems = overdueItems
      .filter(item => item.complianceId)
      .map(item => {
        const daysOverdue = Math.floor((currentDate.getTime() - new Date(item.nextDueDate).getTime()) / (1000 * 60 * 60 * 24));
        return {
          _id: item._id,
          complianceId: item.complianceId,
          nextDueDate: item.nextDueDate,
          daysOverdue,
          notes: item.notes,
          completedDate: item.completedDate
        };
      });

    res.json({
      success: true,
      data: validOverdueItems
    });
  } catch (error) {
    console.error('Error fetching overdue activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue activity'
    });
  }
};

// Clear all compliance data for a user (useful for removing fake data)
export const clearUserCompliance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    // Delete all user compliance items
    const result = await UserCompliance.deleteMany({ userId });

    console.log(`🧹 Cleared ${result.deletedCount} compliance items for user ${userId}`);

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} compliance items`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    console.error('Error clearing user compliance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear compliance data'
    });
  }
};

// Helper function to calculate next due date
function calculateNextDueDate(currentDueDate: Date, frequency: string): Date {
  const nextDate = new Date(currentDueDate);
  
  switch (frequency) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      // For one_time, return the same date (shouldn't be called)
      break;
  }
  
  return nextDate;
}
