import Invoice from '../models/Invoice';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays, format } from 'date-fns';

export interface CashFlowData {
  period: string;
  income: number;
  outstanding: number;
  overdue: number;
  netCashFlow: number;
}

export interface CashFlowSummary {
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  averagePaymentTime: number;
  cashFlowTrend: 'positive' | 'negative' | 'stable';
  monthlyData: CashFlowData[];
  weeklyData: CashFlowData[];
  paymentStatusBreakdown: {
    paid: { count: number; amount: number };
    pending: { count: number; amount: number };
    partial: { count: number; amount: number };
    overdue: { count: number; amount: number };
  };
  topCustomers: Array<{
    name: string;
    totalAmount: number;
    invoiceCount: number;
    averagePaymentTime: number;
  }>;
  projectedCashFlow: Array<{
    period: string;
    expectedIncome: number;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

export class CashFlowAnalyticsService {
  /**
   * Get comprehensive cash flow analytics for a user
   */
  async getCashFlowAnalytics(userId: string, period: 'month' | 'quarter' | 'year' = 'month'): Promise<CashFlowSummary> {
    try {
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
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
        default: // month
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }

      // Get all invoices for the user
      const invoices = await Invoice.find({
        userId,
        invoiceDate: { $gte: subMonths(startDate, 12), $lte: endDate }
      }).sort({ invoiceDate: -1 });

      // Calculate basic metrics
      const totalRevenue = this.calculateTotalRevenue(invoices);
      const totalOutstanding = this.calculateOutstanding(invoices);
      const totalOverdue = this.calculateOverdue(invoices);
      const averagePaymentTime = this.calculateAveragePaymentTime(invoices);
      const cashFlowTrend = this.determineCashFlowTrend(invoices);

      // Generate time-series data
      const monthlyData = this.generateMonthlyData(invoices, 12);
      const weeklyData = this.generateWeeklyData(invoices, 8);

      // Payment status breakdown
      const paymentStatusBreakdown = this.getPaymentStatusBreakdown(invoices);

      // Top customers analysis
      const topCustomers = this.getTopCustomers(invoices);

      // Projected cash flow
      const projectedCashFlow = this.generateCashFlowProjection(invoices);

      return {
        totalRevenue,
        totalOutstanding,
        totalOverdue,
        averagePaymentTime,
        cashFlowTrend,
        monthlyData,
        weeklyData,
        paymentStatusBreakdown,
        topCustomers,
        projectedCashFlow
      };
    } catch (error) {
      console.error('Error generating cash flow analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate total revenue from paid invoices
   */
  private calculateTotalRevenue(invoices: any[]): number {
    return invoices
      .filter(invoice => invoice.paymentStatus === 'paid')
      .reduce((total, invoice) => total + invoice.grandTotal, 0);
  }

  /**
   * Calculate total outstanding amount
   */
  private calculateOutstanding(invoices: any[]): number {
    return invoices
      .filter(invoice => invoice.paymentStatus === 'pending')
      .reduce((total, invoice) => total + invoice.grandTotal, 0);
  }

  /**
   * Calculate total overdue amount
   */
  private calculateOverdue(invoices: any[]): number {
    const today = new Date();
    return invoices
      .filter(invoice => 
        invoice.paymentStatus !== 'paid' && 
        invoice.dueDate && 
        new Date(invoice.dueDate) < today
      )
      .reduce((total, invoice) => total + invoice.grandTotal, 0);
  }

  /**
   * Calculate average payment time in days
   */
  private calculateAveragePaymentTime(invoices: any[]): number {
    const paidInvoices = invoices.filter(invoice => 
      invoice.paymentStatus === 'paid' && 
      invoice.paymentDate && 
      invoice.invoiceDate
    );

    if (paidInvoices.length === 0) return 0;

    const totalDays = paidInvoices.reduce((total, invoice) => {
      const invoiceDate = new Date(invoice.invoiceDate);
      const paymentDate = new Date(invoice.paymentDate);
      const daysDiff = Math.ceil((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      return total + daysDiff;
    }, 0);

    return Math.round(totalDays / paidInvoices.length);
  }

  /**
   * Determine cash flow trend
   */
  private determineCashFlowTrend(invoices: any[]): 'positive' | 'negative' | 'stable' {
    const now = new Date();
    const currentMonth = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.invoiceDate);
      return invoiceDate.getMonth() === now.getMonth() && 
             invoiceDate.getFullYear() === now.getFullYear() &&
             invoice.paymentStatus === 'paid';
    });

    const lastMonth = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.invoiceDate);
      const lastMonthDate = subMonths(now, 1);
      return invoiceDate.getMonth() === lastMonthDate.getMonth() && 
             invoiceDate.getFullYear() === lastMonthDate.getFullYear() &&
             invoice.paymentStatus === 'paid';
    });

    const currentRevenue = currentMonth.reduce((total, inv) => total + inv.grandTotal, 0);
    const lastRevenue = lastMonth.reduce((total, inv) => total + inv.grandTotal, 0);

    if (currentRevenue > lastRevenue * 1.1) return 'positive';
    if (currentRevenue < lastRevenue * 0.9) return 'negative';
    return 'stable';
  }

  /**
   * Generate monthly cash flow data
   */
  private generateMonthlyData(invoices: any[], months: number): CashFlowData[] {
    const data: CashFlowData[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthInvoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate);
        return invoiceDate >= monthStart && invoiceDate <= monthEnd;
      });

      const income = monthInvoices
        .filter(inv => inv.paymentStatus === 'paid')
        .reduce((total, inv) => total + inv.grandTotal, 0);

      const outstanding = monthInvoices
        .filter(inv => inv.paymentStatus === 'pending')
        .reduce((total, inv) => total + inv.grandTotal, 0);

      const overdue = monthInvoices
        .filter(inv => inv.paymentStatus !== 'paid' && inv.dueDate && new Date(inv.dueDate) < now)
        .reduce((total, inv) => total + inv.grandTotal, 0);

      data.push({
        period: format(monthDate, 'MMM yyyy'),
        income,
        outstanding,
        overdue,
        netCashFlow: income - outstanding - overdue
      });
    }

    return data;
  }

  /**
   * Generate weekly cash flow data
   */
  private generateWeeklyData(invoices: any[], weeks: number): CashFlowData[] {
    const data: CashFlowData[] = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = subDays(now, i * 7 + 6);
      const weekEnd = subDays(now, i * 7);

      const weekInvoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate);
        return invoiceDate >= weekStart && invoiceDate <= weekEnd;
      });

      const income = weekInvoices
        .filter(inv => inv.paymentStatus === 'paid')
        .reduce((total, inv) => total + inv.grandTotal, 0);

      const outstanding = weekInvoices
        .filter(inv => inv.paymentStatus === 'pending')
        .reduce((total, inv) => total + inv.grandTotal, 0);

      const overdue = weekInvoices
        .filter(inv => inv.paymentStatus !== 'paid' && inv.dueDate && new Date(inv.dueDate) < now)
        .reduce((total, inv) => total + inv.grandTotal, 0);

      data.push({
        period: `Week ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`,
        income,
        outstanding,
        overdue,
        netCashFlow: income - outstanding - overdue
      });
    }

    return data;
  }

  /**
   * Get payment status breakdown
   */
  private getPaymentStatusBreakdown(invoices: any[]) {
    const breakdown = {
      paid: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 }
    };

    const now = new Date();

    invoices.forEach(invoice => {
      if (invoice.paymentStatus === 'paid') {
        breakdown.paid.count++;
        breakdown.paid.amount += invoice.grandTotal;
      } else if (invoice.paymentStatus === 'partial') {
        breakdown.partial.count++;
        breakdown.partial.amount += invoice.grandTotal;
      } else if (invoice.dueDate && new Date(invoice.dueDate) < now) {
        breakdown.overdue.count++;
        breakdown.overdue.amount += invoice.grandTotal;
      } else {
        breakdown.pending.count++;
        breakdown.pending.amount += invoice.grandTotal;
      }
    });

    return breakdown;
  }

  /**
   * Get top customers by revenue
   */
  private getTopCustomers(invoices: any[]) {
    const customerMap = new Map();

    invoices.forEach(invoice => {
      const customerName = invoice.customer.name;
      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, {
          name: customerName,
          totalAmount: 0,
          invoiceCount: 0,
          paymentTimes: []
        });
      }

      const customer = customerMap.get(customerName);
      customer.totalAmount += invoice.grandTotal;
      customer.invoiceCount++;

      if (invoice.paymentStatus === 'paid' && invoice.paymentDate && invoice.invoiceDate) {
        const paymentTime = Math.ceil(
          (new Date(invoice.paymentDate).getTime() - new Date(invoice.invoiceDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        customer.paymentTimes.push(paymentTime);
      }
    });

    return Array.from(customerMap.values())
      .map(customer => ({
        name: customer.name,
        totalAmount: customer.totalAmount,
        invoiceCount: customer.invoiceCount,
        averagePaymentTime: customer.paymentTimes.length > 0 
          ? Math.round(customer.paymentTimes.reduce((a: number, b: number) => a + b, 0) / customer.paymentTimes.length)
          : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }

  /**
   * Generate cash flow projection
   */
  private generateCashFlowProjection(invoices: any[]): Array<{
    period: string;
    expectedIncome: number;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const projection: Array<{
      period: string;
      expectedIncome: number;
      confidence: 'high' | 'medium' | 'low';
    }> = [];
    const now = new Date();

    // Project next 3 months based on historical data
    for (let i = 1; i <= 3; i++) {
      const projectionDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      
      // Calculate average monthly revenue from last 6 months
      const historicalMonths = 6;
      const historicalRevenue = this.generateMonthlyData(invoices, historicalMonths)
        .reduce((total, month) => total + month.income, 0) / historicalMonths;

      // Add some variance based on trend
      const trend = this.determineCashFlowTrend(invoices);
      let multiplier = 1;
      if (trend === 'positive') multiplier = 1.1;
      if (trend === 'negative') multiplier = 0.9;

      const expectedIncome = Math.round(historicalRevenue * multiplier);
      
      // Determine confidence based on data consistency
      const confidence: 'high' | 'medium' | 'low' = historicalRevenue > 0 ? 'medium' : 'low';

      projection.push({
        period: format(projectionDate, 'MMM yyyy'),
        expectedIncome,
        confidence
      });
    }

    return projection;
  }
}

export default CashFlowAnalyticsService;
