import { Request, Response } from 'express';
import CashFlowAnalyticsService from '../services/cashFlowAnalyticsService';
import Invoice from '../models/Invoice';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

const cashFlowService = new CashFlowAnalyticsService();

/**
 * Get basic cash flow analytics for free users
 */
const getBasicCashFlowAnalytics = async (userId: string, period: string) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  // Determine date range based on period
  switch (period) {
    case 'quarter':
      startDate = subMonths(startOfMonth(now), 3);
      endDate = endOfMonth(now);
      break;
    case 'year':
      startDate = subMonths(startOfMonth(now), 12);
      endDate = endOfMonth(now);
      break;
    default: // month
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
  }

  // Get invoices for the period
  const invoices = await Invoice.find({
    userId,
    invoiceDate: { $gte: startDate, $lte: endDate }
  });

  // Calculate basic metrics
  const totalRevenue = invoices
    .filter(invoice => invoice.paymentStatus === 'paid')
    .reduce((total, invoice) => total + invoice.grandTotal, 0);

  const totalOutstanding = invoices
    .filter(invoice => invoice.paymentStatus === 'pending')
    .reduce((total, invoice) => total + invoice.grandTotal, 0);

  const totalOverdue = invoices
    .filter(invoice => invoice.status === 'overdue')
    .reduce((total, invoice) => total + invoice.grandTotal, 0);

  // Basic payment status breakdown
  const paymentStatusBreakdown = {
    paid: {
      count: invoices.filter(inv => inv.paymentStatus === 'paid').length,
      amount: totalRevenue
    },
    pending: {
      count: invoices.filter(inv => inv.paymentStatus === 'pending').length,
      amount: totalOutstanding
    },
    partial: {
      count: invoices.filter(inv => inv.paymentStatus === 'partial').length,
      amount: invoices.filter(inv => inv.paymentStatus === 'partial').reduce((sum, inv) => sum + inv.grandTotal, 0)
    },
    overdue: {
      count: invoices.filter(inv => inv.status === 'overdue').length,
      amount: totalOverdue
    }
  };

  // Simple monthly data (last 3 months for basic users)
  const monthlyData = [];
  for (let i = 2; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      return invDate >= monthStart && invDate <= monthEnd;
    });

    monthlyData.push({
      period: format(monthDate, 'MMM yyyy'),
      income: monthInvoices.filter(inv => inv.paymentStatus === 'paid').reduce((sum, inv) => sum + inv.grandTotal, 0),
      outstanding: monthInvoices.filter(inv => inv.paymentStatus === 'pending').reduce((sum, inv) => sum + inv.grandTotal, 0),
      overdue: monthInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.grandTotal, 0),
      netCashFlow: monthInvoices.filter(inv => inv.paymentStatus === 'paid').reduce((sum, inv) => sum + inv.grandTotal, 0)
    });
  }

  return {
    totalRevenue,
    totalOutstanding,
    totalOverdue,
    averagePaymentTime: 0, // Not calculated for basic users
    cashFlowTrend: totalRevenue > totalOutstanding ? 'positive' : totalOutstanding > totalRevenue ? 'negative' : 'stable',
    monthlyData,
    paymentStatusBreakdown,
    topCustomers: [], // Not included for basic users
    isBasic: true,
    upgradeMessage: 'Upgrade to Professional plan for detailed analytics, customer insights, and payment trends'
  };
};

/**
 * Get cash flow analytics (basic for all plans, advanced for paid plans)
 */
export const getCashFlowAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { period = 'month' } = req.query;

    if (!['month', 'quarter', 'year'].includes(period as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be month, quarter, or year'
      });
    }

    // Check if user has advanced reports access
    const SubscriptionService = (await import('../services/SubscriptionService')).default;
    let subscription = await SubscriptionService.getSubscriptionWithDetails(userId!.toString());

    // Create free subscription if none exists (for existing users)
    if (!subscription) {
      try {
        const newSubscription = await SubscriptionService.createSubscription(
          userId!.toString(),
          'free',
          'monthly',
          false
        );
        subscription = await SubscriptionService.getSubscriptionWithDetails(userId!.toString());
        console.log(`Created free subscription for existing user ${userId}`);
      } catch (error) {
        console.error('Error creating subscription for existing user:', error);
        // Continue with basic analytics even if subscription creation fails
      }
    }

    const hasAdvancedReports = subscription?.plan?.features?.advancedReports || false;

    if (hasAdvancedReports) {
      // Full analytics for paid users
      const analytics = await cashFlowService.getCashFlowAnalytics(
        userId!.toString(),
        period as 'month' | 'quarter' | 'year'
      );

      res.json({
        success: true,
        data: analytics
      });
    } else {
      // Basic analytics for free users
      const basicAnalytics = await getBasicCashFlowAnalytics(userId!.toString(), period as string);

      res.json({
        success: true,
        data: basicAnalytics,
        message: 'Upgrade to Professional plan for advanced analytics'
      });
    }
  } catch (error) {
    console.error('Error getting cash flow analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get dashboard analytics summary
 */
export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Get current month invoices
    const currentMonthInvoices = await Invoice.find({
      userId,
      invoiceDate: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });

    // Get last month invoices for comparison
    const lastMonthInvoices = await Invoice.find({
      userId,
      invoiceDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Calculate current month metrics
    const currentRevenue = currentMonthInvoices
      .filter(inv => inv.paymentStatus === 'paid')
      .reduce((total, inv) => total + inv.grandTotal, 0);

    const currentOutstanding = currentMonthInvoices
      .filter(inv => inv.paymentStatus === 'pending')
      .reduce((total, inv) => total + inv.grandTotal, 0);

    const currentOverdue = currentMonthInvoices
      .filter(inv => inv.paymentStatus !== 'paid' && inv.dueDate && new Date(inv.dueDate) < now)
      .reduce((total, inv) => total + inv.grandTotal, 0);

    // Calculate last month metrics for comparison
    const lastRevenue = lastMonthInvoices
      .filter(inv => inv.paymentStatus === 'paid')
      .reduce((total, inv) => total + inv.grandTotal, 0);

    const lastOutstanding = lastMonthInvoices
      .filter(inv => inv.paymentStatus === 'pending')
      .reduce((total, inv) => total + inv.grandTotal, 0);

    // Calculate growth percentages
    const revenueGrowth = lastRevenue > 0 
      ? Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100)
      : 0;

    const outstandingGrowth = lastOutstanding > 0 
      ? Math.round(((currentOutstanding - lastOutstanding) / lastOutstanding) * 100)
      : 0;

    // Get recent invoices
    const recentInvoices = await Invoice.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('invoiceNumber customer.name grandTotal paymentStatus createdAt');

    // Get payment status distribution
    const allInvoices = await Invoice.find({ userId });
    const paymentDistribution = {
      paid: allInvoices.filter(inv => inv.paymentStatus === 'paid').length,
      pending: allInvoices.filter(inv => inv.paymentStatus === 'pending').length,
      partial: allInvoices.filter(inv => inv.paymentStatus === 'partial').length,
      overdue: allInvoices.filter(inv => 
        inv.paymentStatus !== 'paid' && 
        inv.dueDate && 
        new Date(inv.dueDate) < now
      ).length
    };

    // Get top customers
    const customerMap = new Map();
    allInvoices.forEach(invoice => {
      const customerName = invoice.customer.name;
      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, { name: customerName, totalAmount: 0, invoiceCount: 0 });
      }
      const customer = customerMap.get(customerName);
      customer.totalAmount += invoice.grandTotal;
      customer.invoiceCount++;
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        currentMonth: {
          revenue: currentRevenue,
          outstanding: currentOutstanding,
          overdue: currentOverdue,
          invoiceCount: currentMonthInvoices.length
        },
        growth: {
          revenue: revenueGrowth,
          outstanding: outstandingGrowth
        },
        paymentDistribution,
        recentInvoices,
        topCustomers,
        period: format(now, 'MMMM yyyy')
      }
    });
  } catch (error) {
    console.error('Error getting dashboard analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

/**
 * Get revenue analytics
 */
export const getRevenueAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { period = '12' } = req.query;
    const months = parseInt(period as string) || 12;

    if (months < 1 || months > 24) {
      return res.status(400).json({ 
        success: false, 
        message: 'Period must be between 1 and 24 months' 
      });
    }

    const now = new Date();
    const monthlyData = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthInvoices = await Invoice.find({
        userId,
        invoiceDate: { $gte: monthStart, $lte: monthEnd }
      });

      const revenue = monthInvoices
        .filter(inv => inv.paymentStatus === 'paid')
        .reduce((total, inv) => total + inv.grandTotal, 0);

      const invoiceCount = monthInvoices.length;
      const paidCount = monthInvoices.filter(inv => inv.paymentStatus === 'paid').length;

      monthlyData.push({
        period: format(monthDate, 'MMM yyyy'),
        revenue,
        invoiceCount,
        paidCount,
        averageInvoiceValue: invoiceCount > 0 ? Math.round(revenue / paidCount) || 0 : 0
      });
    }

    // Calculate totals
    const totalRevenue = monthlyData.reduce((total, month) => total + month.revenue, 0);
    const totalInvoices = monthlyData.reduce((total, month) => total + month.invoiceCount, 0);
    const averageMonthlyRevenue = Math.round(totalRevenue / months);

    res.json({
      success: true,
      data: {
        monthlyData,
        summary: {
          totalRevenue,
          totalInvoices,
          averageMonthlyRevenue,
          period: `${months} months`
        }
      }
    });
  } catch (error) {
    console.error('Error getting revenue analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

/**
 * Get customer analytics
 */
export const getCustomerAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const invoices = await Invoice.find({ userId });

    // Customer analysis
    const customerMap = new Map();
    const now = new Date();

    invoices.forEach(invoice => {
      const customerName = invoice.customer.name;
      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, {
          name: customerName,
          totalAmount: 0,
          invoiceCount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
          lastInvoiceDate: null,
          paymentTimes: []
        });
      }

      const customer = customerMap.get(customerName);
      customer.totalAmount += invoice.grandTotal;
      customer.invoiceCount++;

      if (invoice.paymentStatus === 'paid') {
        customer.paidAmount += invoice.grandTotal;
        if (invoice.paymentDate && invoice.invoiceDate) {
          const paymentTime = Math.ceil(
            (new Date(invoice.paymentDate).getTime() - new Date(invoice.invoiceDate).getTime()) / 
            (1000 * 60 * 60 * 24)
          );
          customer.paymentTimes.push(paymentTime);
        }
      } else if (invoice.dueDate && new Date(invoice.dueDate) < now) {
        customer.overdueAmount += invoice.grandTotal;
      } else {
        customer.pendingAmount += invoice.grandTotal;
      }

      if (!customer.lastInvoiceDate || new Date(invoice.invoiceDate) > new Date(customer.lastInvoiceDate)) {
        customer.lastInvoiceDate = invoice.invoiceDate;
      }
    });

    const customerAnalytics = Array.from(customerMap.values())
      .map(customer => ({
        name: customer.name,
        totalAmount: customer.totalAmount,
        invoiceCount: customer.invoiceCount,
        paidAmount: customer.paidAmount,
        pendingAmount: customer.pendingAmount,
        overdueAmount: customer.overdueAmount,
        lastInvoiceDate: customer.lastInvoiceDate,
        averageInvoiceValue: Math.round(customer.totalAmount / customer.invoiceCount),
        averagePaymentTime: customer.paymentTimes.length > 0 
          ? Math.round(customer.paymentTimes.reduce((a: number, b: number) => a + b, 0) / customer.paymentTimes.length)
          : 0,
        paymentReliability: customer.invoiceCount > 0 
          ? Math.round((customer.paidAmount / customer.totalAmount) * 100)
          : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Summary statistics
    const totalCustomers = customerAnalytics.length;
    const activeCustomers = customerAnalytics.filter(c => {
      const lastInvoice = new Date(c.lastInvoiceDate);
      const threeMonthsAgo = subMonths(now, 3);
      return lastInvoice >= threeMonthsAgo;
    }).length;

    const averageCustomerValue = totalCustomers > 0 
      ? Math.round(customerAnalytics.reduce((total, c) => total + c.totalAmount, 0) / totalCustomers)
      : 0;

    res.json({
      success: true,
      data: {
        customers: customerAnalytics,
        summary: {
          totalCustomers,
          activeCustomers,
          averageCustomerValue,
          topCustomers: customerAnalytics.slice(0, 10)
        }
      }
    });
  } catch (error) {
    console.error('Error getting customer analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};
