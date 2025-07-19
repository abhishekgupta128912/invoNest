import express from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import User from '../models/User';
import Invoice from '../models/Invoice';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Get admin dashboard stats
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    // Get basic statistics
    const [
      totalUsers,
      totalInvoices,
      activeUsers,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      Invoice.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name email businessName createdAt lastLogin')
    ]);

    // Calculate revenue (if you have subscription data)
    const totalRevenue = 0; // Placeholder - implement based on your subscription model

    res.status(200).json({
      success: true,
      message: 'Admin dashboard stats retrieved successfully',
      data: {
        stats: {
          totalUsers,
          totalInvoices,
          activeUsers,
          totalRevenue
        },
        recentUsers
      }
    });

  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users with pagination
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Toggle user active status
router.patch('/users/:userId/toggle-status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        userId: user._id,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Admin toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
