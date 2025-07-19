import cron from 'node-cron';
import Invoice from '../models/Invoice';
import User from '../models/User';
import { getEmailService } from './emailService';

export interface AnalyticsReport {
  period: string;
  startDate: Date;
  endDate: Date;
  summary: {
    totalInvoices: number;
    totalRevenue: number;
    paidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    averageInvoiceValue: number;
    paymentRate: number;
  };
  trends: {
    revenueGrowth: number;
    invoiceGrowth: number;
    paymentTimeAverage: number;
  };
  topCustomers: Array<{
    name: string;
    totalAmount: number;
    invoiceCount: number;
  }>;
  insights: string[];
}

export interface CashFlowForecast {
  period: string;
  expectedIncome: number;
  pendingPayments: number;
  overdueAmount: number;
  projectedCashFlow: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export class EnhancedAnalyticsService {
  private static instance: EnhancedAnalyticsService;
  private emailService = getEmailService();

  constructor() {
    this.initializeCronJobs();
  }

  static getInstance(): EnhancedAnalyticsService {
    if (!EnhancedAnalyticsService.instance) {
      EnhancedAnalyticsService.instance = new EnhancedAnalyticsService();
    }
    return EnhancedAnalyticsService.instance;
  }

  /**
   * Initialize cron jobs for automated reporting
   */
  private initializeCronJobs() {
    // Weekly reports - Every Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
      console.log('Generating weekly analytics reports...');
      await this.generateWeeklyReports();
    });

    // Monthly reports - First day of month at 10 AM
    cron.schedule('0 10 1 * *', async () => {
      console.log('Generating monthly analytics reports...');
      await this.generateMonthlyReports();
    });

    // Cash flow alerts - Daily at 8 AM
    cron.schedule('0 8 * * *', async () => {
      console.log('Checking cash flow alerts...');
      await this.processCashFlowAlerts();
    });
  }

  /**
   * Generate weekly reports for all users
   */
  async generateWeeklyReports(): Promise<void> {
    try {
      const users = await User.find({ isActive: true }).select('_id name email businessName');
      
      for (const user of users) {
        try {
          const report = await this.generateAnalyticsReport((user._id as any).toString(), 'weekly');
          await this.sendAnalyticsReport(user, report, 'weekly');
        } catch (error) {
          console.error(`Error generating weekly report for user ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in weekly report generation:', error);
    }
  }

  /**
   * Generate monthly reports for all users
   */
  async generateMonthlyReports(): Promise<void> {
    try {
      const users = await User.find({ isActive: true }).select('_id name email businessName');
      
      for (const user of users) {
        try {
          const report = await this.generateAnalyticsReport((user._id as any).toString(), 'monthly');
          await this.sendAnalyticsReport(user, report, 'monthly');
        } catch (error) {
          console.error(`Error generating monthly report for user ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in monthly report generation:', error);
    }
  }

  /**
   * Generate analytics report for a user
   */
  async generateAnalyticsReport(userId: string, period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Promise<AnalyticsReport> {
    const { startDate, endDate } = this.getPeriodDates(period);
    
    // Get invoices for the period
    const invoices = await Invoice.find({
      userId,
      invoiceDate: { $gte: startDate, $lte: endDate }
    });

    // Calculate summary metrics
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const paidInvoices = invoices.filter(inv => inv.paymentStatus === 'paid').length;
    const pendingInvoices = invoices.filter(inv => inv.paymentStatus === 'pending').length;
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
    const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
    const paymentRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

    // Calculate trends (compare with previous period)
    const previousPeriod = this.getPreviousPeriodDates(period);
    const previousInvoices = await Invoice.find({
      userId,
      invoiceDate: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate }
    });

    const previousRevenue = previousInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const invoiceGrowth = previousInvoices.length > 0 ? ((totalInvoices - previousInvoices.length) / previousInvoices.length) * 100 : 0;

    // Calculate average payment time
    const paidInvoicesWithDates = invoices.filter(inv => inv.paymentStatus === 'paid' && inv.paymentDate);
    const paymentTimeAverage = paidInvoicesWithDates.length > 0 ? 
      paidInvoicesWithDates.reduce((sum, inv) => {
        const paymentTime = inv.paymentDate!.getTime() - inv.invoiceDate.getTime();
        return sum + (paymentTime / (1000 * 60 * 60 * 24)); // Convert to days
      }, 0) / paidInvoicesWithDates.length : 0;

    // Get top customers
    const customerMap = new Map();
    invoices.forEach(inv => {
      const customerName = inv.customer.name;
      if (customerMap.has(customerName)) {
        const existing = customerMap.get(customerName);
        existing.totalAmount += inv.grandTotal;
        existing.invoiceCount += 1;
      } else {
        customerMap.set(customerName, {
          name: customerName,
          totalAmount: inv.grandTotal,
          invoiceCount: 1
        });
      }
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Generate insights
    const insights = this.generateInsights({
      totalInvoices,
      totalRevenue,
      paymentRate,
      revenueGrowth,
      overdueInvoices,
      averageInvoiceValue,
      paymentTimeAverage
    });

    return {
      period,
      startDate,
      endDate,
      summary: {
        totalInvoices,
        totalRevenue,
        paidInvoices,
        pendingInvoices,
        overdueInvoices,
        averageInvoiceValue,
        paymentRate
      },
      trends: {
        revenueGrowth,
        invoiceGrowth,
        paymentTimeAverage
      },
      topCustomers,
      insights
    };
  }

  /**
   * Generate cash flow forecast
   */
  async generateCashFlowForecast(userId: string, days: number = 30): Promise<CashFlowForecast> {
    const today = new Date();
    const forecastDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    // Get pending invoices due within forecast period
    const pendingInvoices = await Invoice.find({
      userId,
      paymentStatus: { $in: ['pending', 'partial'] },
      dueDate: { $lte: forecastDate }
    });

    // Get overdue invoices
    const overdueInvoices = await Invoice.find({
      userId,
      status: 'overdue',
      paymentStatus: { $in: ['pending', 'partial'] }
    });

    const expectedIncome = pendingInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const pendingPayments = pendingInvoices.length;

    // Simple projection based on historical payment rates
    const historicalPaymentRate = await this.getHistoricalPaymentRate(userId);
    const projectedCashFlow = expectedIncome * (historicalPaymentRate / 100);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (overdueAmount > expectedIncome * 0.3) riskLevel = 'high';
    else if (overdueAmount > expectedIncome * 0.15) riskLevel = 'medium';

    // Generate recommendations
    const recommendations = this.generateCashFlowRecommendations({
      expectedIncome,
      overdueAmount,
      pendingPayments,
      riskLevel,
      historicalPaymentRate
    });

    return {
      period: `Next ${days} days`,
      expectedIncome,
      pendingPayments,
      overdueAmount,
      projectedCashFlow,
      riskLevel,
      recommendations
    };
  }

  /**
   * Process cash flow alerts for all users
   */
  async processCashFlowAlerts(): Promise<void> {
    try {
      const users = await User.find({ isActive: true }).select('_id name email businessName');
      
      for (const user of users) {
        try {
          const forecast = await this.generateCashFlowForecast((user._id as any).toString());
          
          // Send alert if risk level is medium or high
          if (forecast.riskLevel !== 'low') {
            await this.sendCashFlowAlert(user, forecast);
          }
        } catch (error) {
          console.error(`Error processing cash flow alert for user ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in cash flow alert processing:', error);
    }
  }

  /**
   * Send analytics report via email
   */
  private async sendAnalyticsReport(user: any, report: AnalyticsReport, frequency: string): Promise<void> {
    try {
      const subject = `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Business Report - ${user.businessName || user.name}`;
      
      const html = this.generateReportEmailHTML(report, user);
      const text = this.generateReportEmailText(report);

      await this.emailService.sendEmail(user.email, subject, html, text);
    } catch (error) {
      console.error('Error sending analytics report:', error);
    }
  }

  /**
   * Send cash flow alert via email
   */
  private async sendCashFlowAlert(user: any, forecast: CashFlowForecast): Promise<void> {
    try {
      const subject = `Cash Flow Alert - ${forecast.riskLevel.toUpperCase()} Risk Detected`;
      
      const html = this.generateCashFlowAlertHTML(forecast, user);
      const text = this.generateCashFlowAlertText(forecast);

      await this.emailService.sendEmail(user.email, subject, html, text);
    } catch (error) {
      console.error('Error sending cash flow alert:', error);
    }
  }

  /**
   * Get period dates based on period type
   */
  private getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);

    switch (period) {
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Get previous period dates for comparison
   */
  private getPreviousPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const current = this.getPeriodDates(period);
    const diff = current.endDate.getTime() - current.startDate.getTime();

    return {
      startDate: new Date(current.startDate.getTime() - diff),
      endDate: new Date(current.startDate.getTime())
    };
  }

  /**
   * Get historical payment rate for a user
   */
  private async getHistoricalPaymentRate(userId: string): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const historicalInvoices = await Invoice.find({
      userId,
      invoiceDate: { $gte: threeMonthsAgo }
    });

    if (historicalInvoices.length === 0) return 70; // Default assumption

    const paidCount = historicalInvoices.filter(inv => inv.paymentStatus === 'paid').length;
    return (paidCount / historicalInvoices.length) * 100;
  }

  /**
   * Generate insights based on metrics
   */
  private generateInsights(metrics: any): string[] {
    const insights: string[] = [];

    if (metrics.revenueGrowth > 10) {
      insights.push(`🚀 Excellent! Your revenue grew by ${metrics.revenueGrowth.toFixed(1)}% compared to the previous period.`);
    } else if (metrics.revenueGrowth < -10) {
      insights.push(`⚠️ Revenue declined by ${Math.abs(metrics.revenueGrowth).toFixed(1)}%. Consider reviewing your pricing or customer acquisition strategy.`);
    }

    if (metrics.paymentRate > 90) {
      insights.push(`✅ Outstanding payment rate of ${metrics.paymentRate.toFixed(1)}%! Your customers are paying promptly.`);
    } else if (metrics.paymentRate < 70) {
      insights.push(`📞 Payment rate is ${metrics.paymentRate.toFixed(1)}%. Consider implementing automated reminders or reviewing payment terms.`);
    }

    if (metrics.overdueInvoices > metrics.totalInvoices * 0.2) {
      insights.push(`🔴 ${metrics.overdueInvoices} invoices are overdue. Focus on collection efforts to improve cash flow.`);
    }

    if (metrics.paymentTimeAverage > 45) {
      insights.push(`⏰ Average payment time is ${metrics.paymentTimeAverage.toFixed(0)} days. Consider offering early payment discounts.`);
    }

    if (metrics.averageInvoiceValue > 10000) {
      insights.push(`💰 High average invoice value of ₹${metrics.averageInvoiceValue.toLocaleString('en-IN')} indicates strong client relationships.`);
    }

    return insights;
  }

  /**
   * Generate cash flow recommendations
   */
  private generateCashFlowRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    if (data.riskLevel === 'high') {
      recommendations.push('🚨 Immediate action required: Contact overdue customers and consider offering payment plans.');
      recommendations.push('💳 Consider implementing automated payment collection systems.');
    }

    if (data.overdueAmount > 0) {
      recommendations.push(`📞 Follow up on ₹${data.overdueAmount.toLocaleString('en-IN')} in overdue payments.`);
    }

    if (data.historicalPaymentRate < 80) {
      recommendations.push('📋 Review and tighten your credit policies for new customers.');
      recommendations.push('⚡ Implement automated payment reminders to improve collection rates.');
    }

    if (data.pendingPayments > 10) {
      recommendations.push('📊 Consider offering multiple payment options to make it easier for customers to pay.');
    }

    return recommendations;
  }

  /**
   * Generate HTML email for analytics report
   */
  private generateReportEmailHTML(report: AnalyticsReport, user: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Business Analytics Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .metric { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4F46E5; }
          .insight { background: #e8f5e8; padding: 10px; margin: 5px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 ${report.period.charAt(0).toUpperCase() + report.period.slice(1)} Business Report</h1>
            <p>${user.businessName || user.name}</p>
            <p>${report.startDate.toLocaleDateString('en-IN')} - ${report.endDate.toLocaleDateString('en-IN')}</p>
          </div>
          <div class="content">
            <h2>📈 Summary</h2>
            <div class="metric">
              <strong>Total Revenue:</strong> ₹${report.summary.totalRevenue.toLocaleString('en-IN')}
            </div>
            <div class="metric">
              <strong>Total Invoices:</strong> ${report.summary.totalInvoices}
            </div>
            <div class="metric">
              <strong>Payment Rate:</strong> ${report.summary.paymentRate.toFixed(1)}%
            </div>
            <div class="metric">
              <strong>Average Invoice Value:</strong> ₹${report.summary.averageInvoiceValue.toLocaleString('en-IN')}
            </div>

            <h2>📊 Trends</h2>
            <div class="metric">
              <strong>Revenue Growth:</strong> ${report.trends.revenueGrowth > 0 ? '+' : ''}${report.trends.revenueGrowth.toFixed(1)}%
            </div>
            <div class="metric">
              <strong>Average Payment Time:</strong> ${report.trends.paymentTimeAverage.toFixed(0)} days
            </div>

            <h2>💡 Key Insights</h2>
            ${report.insights.map(insight => `<div class="insight">${insight}</div>`).join('')}

            <div class="footer">
              <p>Generated by InvoNest Analytics</p>
              <p><a href="${process.env.FRONTEND_URL}/dashboard">View Dashboard</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text email for analytics report
   */
  private generateReportEmailText(report: AnalyticsReport): string {
    return `
      ${report.period.charAt(0).toUpperCase() + report.period.slice(1)} Business Report
      ${report.startDate.toLocaleDateString('en-IN')} - ${report.endDate.toLocaleDateString('en-IN')}

      SUMMARY:
      - Total Revenue: ₹${report.summary.totalRevenue.toLocaleString('en-IN')}
      - Total Invoices: ${report.summary.totalInvoices}
      - Payment Rate: ${report.summary.paymentRate.toFixed(1)}%
      - Average Invoice Value: ₹${report.summary.averageInvoiceValue.toLocaleString('en-IN')}

      TRENDS:
      - Revenue Growth: ${report.trends.revenueGrowth > 0 ? '+' : ''}${report.trends.revenueGrowth.toFixed(1)}%
      - Average Payment Time: ${report.trends.paymentTimeAverage.toFixed(0)} days

      KEY INSIGHTS:
      ${report.insights.map(insight => `- ${insight}`).join('\n')}

      View your full dashboard: ${process.env.FRONTEND_URL}/dashboard
    `;
  }

  /**
   * Generate HTML email for cash flow alert
   */
  private generateCashFlowAlertHTML(forecast: CashFlowForecast, user: any): string {
    const riskColor = forecast.riskLevel === 'high' ? '#dc3545' : '#ffc107';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Cash Flow Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${riskColor}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .recommendation { background: #e8f5e8; padding: 10px; margin: 5px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Cash Flow Alert</h1>
            <p>${user.businessName || user.name}</p>
            <p>Risk Level: ${forecast.riskLevel.toUpperCase()}</p>
          </div>
          <div class="content">
            <div class="alert">
              <h3>Cash Flow Forecast (${forecast.period})</h3>
              <p><strong>Expected Income:</strong> ₹${forecast.expectedIncome.toLocaleString('en-IN')}</p>
              <p><strong>Overdue Amount:</strong> ₹${forecast.overdueAmount.toLocaleString('en-IN')}</p>
              <p><strong>Projected Cash Flow:</strong> ₹${forecast.projectedCashFlow.toLocaleString('en-IN')}</p>
            </div>

            <h3>🎯 Recommended Actions:</h3>
            ${forecast.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}

            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Dashboard</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text email for cash flow alert
   */
  private generateCashFlowAlertText(forecast: CashFlowForecast): string {
    return `
      CASH FLOW ALERT - ${forecast.riskLevel.toUpperCase()} RISK

      Cash Flow Forecast (${forecast.period}):
      - Expected Income: ₹${forecast.expectedIncome.toLocaleString('en-IN')}
      - Overdue Amount: ₹${forecast.overdueAmount.toLocaleString('en-IN')}
      - Projected Cash Flow: ₹${forecast.projectedCashFlow.toLocaleString('en-IN')}

      RECOMMENDED ACTIONS:
      ${forecast.recommendations.map(rec => `- ${rec}`).join('\n')}

      View your dashboard: ${process.env.FRONTEND_URL}/dashboard
    `;
  }
}
