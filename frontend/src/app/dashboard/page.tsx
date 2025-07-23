'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { authenticatedFetch } from '../../lib/auth';
import DashboardLayout, { StatsCard } from '../../components/dashboard/DashboardLayout';

interface DashboardStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  overdueInvoices: number;
}

interface ComplianceStats {
  totalActive: number;
  completedThisMonth: number;
  upcomingCount: number;
  overdueCount: number;
}

interface UpcomingCompliance {
  _id: string;
  complianceId: {
    title: string;
    type: string;
    priority: string;
  };
  nextDueDate: string;
}

interface RecentNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [complianceStats, setComplianceStats] = useState<ComplianceStats | null>(null);
  const [upcomingCompliance, setUpcomingCompliance] = useState<UpcomingCompliance[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const [statsResponse, complianceResponse, complianceStatsResponse, notificationsResponse] = await Promise.all([
          authenticatedFetch('/api/invoices?limit=1000'),
          authenticatedFetch('/api/compliance/user-compliance'),
          authenticatedFetch('/api/compliance/stats'),
          authenticatedFetch('/api/notifications?limit=5')
        ]);

        const statsData = await statsResponse.json();
        const complianceData = await complianceResponse.json();
        const complianceStatsData = await complianceStatsResponse.json();
        const notificationsData = await notificationsResponse.json();

        console.log('Dashboard data fetched:', {
          stats: statsData,
          compliance: complianceData,
          complianceStats: complianceStatsData,
          notifications: notificationsData
        });

        // Calculate stats from invoices
        if (statsData.success && statsData.data && Array.isArray(statsData.data.invoices)) {
          const invoices = statsData.data.invoices;
          const stats: DashboardStats = {
            totalInvoices: invoices.length,
            paidInvoices: invoices.filter((inv: any) => inv.paymentStatus === 'paid').length,
            pendingInvoices: invoices.filter((inv: any) => inv.paymentStatus === 'pending').length,
            overdueInvoices: invoices.filter((inv: any) => inv.status === 'overdue').length,
            totalRevenue: invoices.filter((inv: any) => inv.paymentStatus === 'paid').reduce((sum: number, inv: any) => sum + inv.grandTotal, 0),
            thisMonthRevenue: invoices.filter((inv: any) => {
              const invoiceDate = new Date(inv.invoiceDate);
              const now = new Date();
              return invoiceDate.getMonth() === now.getMonth() &&
                     invoiceDate.getFullYear() === now.getFullYear() &&
                     inv.paymentStatus === 'paid';
            }).reduce((sum: number, inv: any) => sum + inv.grandTotal, 0)
          };
          setStats(stats);
        } else {
          // Set default stats if no invoices or API error
          setStats({
            totalInvoices: 0,
            paidInvoices: 0,
            pendingInvoices: 0,
            overdueInvoices: 0,
            totalRevenue: 0,
            thisMonthRevenue: 0
          });
        }

        // Process compliance stats from dedicated endpoint
        if (complianceStatsData.success && complianceStatsData.data) {
          setComplianceStats(complianceStatsData.data);
        } else {
          // Set default compliance stats if no data or API error
          setComplianceStats({
            totalActive: 0,
            completedThisMonth: 0,
            upcomingCount: 0,
            overdueCount: 0
          });
        }

        // Process compliance data for upcoming items
        if (complianceData.success && complianceData.data && Array.isArray(complianceData.data)) {
          const userCompliances = complianceData.data;
          const now = new Date();

          // Get upcoming compliance items (next 5)
          const upcoming = userCompliances
            .filter((uc: any) => uc.nextDueDate && new Date(uc.nextDueDate) >= now)
            .sort((a: any, b: any) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
            .slice(0, 5);
          setUpcomingCompliance(upcoming);
        } else {
          setUpcomingCompliance([]);
        }

        // Process notifications data
        if (notificationsData.success && notificationsData.data) {
          // Handle both array and object with notifications property
          const notifications = Array.isArray(notificationsData.data)
            ? notificationsData.data
            : notificationsData.data.notifications || [];
          setRecentNotifications(notifications);
        } else {
          // Set empty notifications if no data or API error
          setRecentNotifications([]);
        }
      } catch (error) {
        console.error('Dashboard data fetch failed:', error);
        // Set default values on error to prevent undefined access
        setStats({
          totalInvoices: 0,
          paidInvoices: 0,
          pendingInvoices: 0,
          overdueInvoices: 0,
          totalRevenue: 0,
          thisMonthRevenue: 0
        });
        setComplianceStats({
          totalActive: 0,
          completedThisMonth: 0,
          upcomingCount: 0,
          overdueCount: 0
        });
        setUpcomingCompliance([]);
        setRecentNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleRefresh = async () => {
    setLoading(true);
    // Refetch dashboard data
    if (user) {
      try {
        const [statsResponse, complianceResponse, complianceStatsResponse, notificationsResponse] = await Promise.all([
          authenticatedFetch('/api/invoices?limit=1000'),
          authenticatedFetch('/api/compliance/user-compliance'),
          authenticatedFetch('/api/compliance/stats'),
          authenticatedFetch('/api/notifications?limit=5')
        ]);

        const statsData = await statsResponse.json();
        const complianceData = await complianceResponse.json();
        const complianceStatsData = await complianceStatsResponse.json();
        const notificationsData = await notificationsResponse.json();

        // Process data same as in useEffect
        if (statsData.success && statsData.data && Array.isArray(statsData.data.invoices)) {
          const invoices = statsData.data.invoices;
          const stats: DashboardStats = {
            totalInvoices: invoices.length,
            paidInvoices: invoices.filter((inv: any) => inv.paymentStatus === 'paid').length,
            pendingInvoices: invoices.filter((inv: any) => inv.paymentStatus === 'pending').length,
            overdueInvoices: invoices.filter((inv: any) => inv.status === 'overdue').length,
            totalRevenue: invoices.filter((inv: any) => inv.paymentStatus === 'paid').reduce((sum: number, inv: any) => sum + inv.grandTotal, 0),
            thisMonthRevenue: invoices.filter((inv: any) => {
              const invoiceDate = new Date(inv.invoiceDate);
              const now = new Date();
              return invoiceDate.getMonth() === now.getMonth() &&
                     invoiceDate.getFullYear() === now.getFullYear() &&
                     inv.paymentStatus === 'paid';
            }).reduce((sum: number, inv: any) => sum + inv.grandTotal, 0)
          };
          setStats(stats);
        } else {
          // Set default stats if no invoices or API error
          setStats({
            totalInvoices: 0,
            paidInvoices: 0,
            pendingInvoices: 0,
            overdueInvoices: 0,
            totalRevenue: 0,
            thisMonthRevenue: 0
          });
        }

        // Process compliance stats from dedicated endpoint
        if (complianceStatsData.success && complianceStatsData.data) {
          setComplianceStats(complianceStatsData.data);
        } else {
          // Set default compliance stats if no data or API error
          setComplianceStats({
            totalActive: 0,
            completedThisMonth: 0,
            upcomingCount: 0,
            overdueCount: 0
          });
        }

        // Process compliance data for upcoming items
        if (complianceData.success && complianceData.data && Array.isArray(complianceData.data)) {
          const userCompliances = complianceData.data;
          const now = new Date();

          // Get upcoming compliance items (next 5)
          const upcoming = userCompliances
            .filter((uc: any) => uc.nextDueDate && new Date(uc.nextDueDate) >= now)
            .sort((a: any, b: any) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
            .slice(0, 5);
          setUpcomingCompliance(upcoming);
        } else {
          setUpcomingCompliance([]);
        }

        if (notificationsData.success && notificationsData.data) {
          // Handle both array and object with notifications property
          const notifications = Array.isArray(notificationsData.data)
            ? notificationsData.data
            : notificationsData.data.notifications || [];
          setRecentNotifications(notifications);
        } else {
          // Set empty notifications if no data or API error
          setRecentNotifications([]);
        }
      } catch (error) {
        console.error('Dashboard refresh failed:', error);
        // Set default values on error to prevent undefined access
        setStats({
          totalInvoices: 0,
          paidInvoices: 0,
          pendingInvoices: 0,
          overdueInvoices: 0,
          totalRevenue: 0,
          thisMonthRevenue: 0
        });
        setComplianceStats({
          totalActive: 0,
          completedThisMonth: 0,
          upcomingCount: 0,
          overdueCount: 0
        });
        setUpcomingCompliance([]);
        setRecentNotifications([]);
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Dashboard"
        enablePullToRefresh={true}
        onRefresh={handleRefresh}
      >
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            <span className="text-lg text-gray-600">Loading Dashboard...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      title="Dashboard"
      enablePullToRefresh={true}
      onRefresh={handleRefresh}
    >
      <div className="p-4 lg:p-8">
        {/* Welcome header */}
        <div className="mb-8 lg:mb-10">
            <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold mb-2 text-gray-900">
                    Welcome back, {user.name}! 👋
                  </h1>
                  <p className="text-gray-600 text-lg">
                    Here's what's happening with your business today.
                  </p>
                  {user.businessName && (
                    <p className="text-gray-500 text-sm mt-1">
                      {user.businessName}
                    </p>
                  )}
                </div>
                {user.logo ? (
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 relative">
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/${user.logo}`}
                      alt="Business Logo"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to initials if logo fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="logo-fallback absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl lg:text-2xl" style={{ display: 'none' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full border-2 border-gray-200 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl lg:text-2xl">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-10">
            <StatsCard
              title="Total Invoices"
              value={stats?.totalInvoices || 0}
              icon={
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              color="blue"
              subtitle={(stats?.totalInvoices || 0) === 0 ? "Create your first invoice!" : undefined}
            />

            <StatsCard
              title="Paid Invoices"
              value={stats?.paidInvoices || 0}
              icon={
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
              color="green"
              subtitle={(stats?.paidInvoices || 0) === 0 ? "No payments yet" : undefined}
            />

            <StatsCard
              title="Pending"
              value={stats?.pendingInvoices || 0}
              icon={
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              color="yellow"
              subtitle={(stats?.pendingInvoices || 0) === 0 ? "All caught up!" : undefined}
            />

            <StatsCard
              title="Total Revenue"
              value={formatCurrency(stats?.totalRevenue || 0)}
              icon={
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              }
              color="indigo"
              subtitle={(stats?.totalRevenue || 0) === 0 ? "Start earning!" : undefined}
            />
          </div>



        {/* Quick Actions */}
        <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <Link href="/dashboard/invoices/create" className="group">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border-2 border-indigo-200 p-6 hover:shadow-lg transition-all duration-300 group-hover:border-indigo-400 hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Invoice</h3>
                  <p className="text-gray-600 text-sm">Generate GST-compliant invoices with automatic tax calculations</p>
                </div>
              </Link>

              <Link href="/dashboard/invoices" className="group">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-6 hover:shadow-lg transition-all duration-300 group-hover:border-blue-400 hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Invoices</h3>
                  <p className="text-gray-600 text-sm">View, edit, and track all your invoices in one place</p>
                </div>
              </Link>

              <Link href="/dashboard/compliance" className="group">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-6 hover:shadow-lg transition-all duration-300 group-hover:border-purple-400 hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Compliance Calendar</h3>
                  <p className="text-gray-600 text-sm">Track GST, TDS, and tax compliance deadlines</p>
                </div>
              </Link>

              <Link href="/dashboard/documents" className="group">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6 hover:shadow-lg transition-all duration-300 group-hover:border-green-400 hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-green-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Manager</h3>
                  <p className="text-gray-600 text-sm">Upload, organize, and manage your business documents with AI parsing</p>
                </div>
              </Link>
            </div>
          </div>

        {/* Recent Activity & Notifications */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8 lg:mb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Link href="/dashboard/notifications" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              View all
            </Link>
          </div>

          <div className="space-y-4">
                {recentNotifications && recentNotifications.length > 0 ? (
                  recentNotifications.slice(0, 5).map((notification, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'success' ? 'bg-green-100 text-green-600' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        notification.type === 'error' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {notification.type === 'success' ? '✓' :
                         notification.type === 'warning' ? '⚠' :
                         notification.type === 'error' ? '✕' : 'ℹ'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No recent activity</p>
                    <p className="text-gray-400 text-xs mt-1">Your business activities will appear here</p>
                  </div>
                )}
              </div>

          {recentNotifications && recentNotifications.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Link href="/dashboard/notifications" className="flex items-center justify-center w-full py-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors">
                View All Notifications
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Compliance Status Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Compliance Status</h3>
            <Link href="/dashboard/compliance" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              View Calendar
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{complianceStats?.completedThisMonth || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Upcoming</p>
                    <p className="text-2xl font-bold text-yellow-600">{complianceStats?.upcomingCount || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-800">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{complianceStats?.overdueCount || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

          {upcomingCompliance && upcomingCompliance.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Next Deadlines</h4>
              <div className="space-y-2">
                {upcomingCompliance.slice(0, 3).map((compliance, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        compliance.complianceId?.priority === 'high' ? 'bg-red-500' :
                        compliance.complianceId?.priority === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {compliance.complianceId?.title || 'Compliance Item'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {compliance.complianceId?.type || 'General'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(compliance.nextDueDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {Math.ceil((new Date(compliance.nextDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Business Name</span>
              <span className="text-sm text-gray-900">{user.businessName || 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">GST Number</span>
              <span className="text-sm text-gray-900">{user.gstNumber || 'Not registered'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Phone</span>
              <span className="text-sm text-gray-900">{user.phone || 'Not provided'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-600">Email Status</span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                user.isEmailVerified
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {user.isEmailVerified ? 'Verified' : 'Not Verified'}
              </span>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href="/dashboard/profile"
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
            >
              Update Profile
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
    );
}
