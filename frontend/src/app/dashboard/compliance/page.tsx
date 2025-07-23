'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';

interface ComplianceItem {
  _id: string;
  complianceId: {
    _id: string;
    title: string;
    description: string;
    type: string;
    category: string;
    priority: string;
    penaltyInfo?: {
      lateFilingPenalty?: string;
      interestRate?: string;
    };
    resources?: {
      officialLink?: string;
      formNumber?: string;
    };
  };
  nextDueDate: string;
  isCompleted: boolean;
  isEnabled: boolean;
  reminderDays: number[];
}

interface ComplianceStats {
  totalActive: number;
  completedThisMonth: number;
  upcomingCount: number;
  overdueCount: number;
}

interface OverdueActivity {
  _id: string;
  complianceId: {
    title: string;
    type: string;
    priority: string;
  };
  nextDueDate: string;
  daysOverdue: number;
  completedDate?: string;
  notes?: string;
}

export default function CompliancePage() {
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [overdueActivity, setOverdueActivity] = useState<OverdueActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showOverdueSection, setShowOverdueSection] = useState(false);
  const [completingItems, setCompletingItems] = useState<Set<string>>(new Set());
  const [clearingData, setClearingData] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchComplianceData();
    fetchComplianceStats();
    fetchOverdueActivity();
  }, [selectedType, selectedMonth, selectedYear]);

  const fetchComplianceData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams({
        type: selectedType,
        month: selectedMonth.toString(),
        year: selectedYear.toString()
      });

      const response = await fetch(`http://localhost:5000/api/compliance/calendar?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComplianceItems(data.data);
      } else {
        console.error('Failed to fetch compliance data');
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/compliance/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching compliance stats:', error);
    }
  };

  const fetchOverdueActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/compliance/overdue-activity', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOverdueActivity(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching overdue activity:', error);
      // Set empty array on error to prevent UI issues
      setOverdueActivity([]);
    }
  };

  const markAsCompleted = async (complianceId: string) => {
    try {
      // Add to completing items set
      setCompletingItems(prev => new Set(prev).add(complianceId));

      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/compliance/${complianceId}/complete`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: 'Marked as completed from dashboard' })
      });

      if (response.ok) {
        // Immediately update the overdue activity list to remove the completed item
        setOverdueActivity(prev => prev.filter(item => item._id !== complianceId));

        // Refresh all data
        await Promise.all([
          fetchComplianceData(),
          fetchComplianceStats(),
          fetchOverdueActivity()
        ]);

        console.log('✅ Compliance item marked as completed successfully');
      } else {
        const errorData = await response.json();
        console.error('Failed to mark compliance as completed:', errorData.message);
        alert('Failed to mark compliance as completed. Please try again.');
      }
    } catch (error) {
      console.error('Error marking compliance as completed:', error);
      alert('Error marking compliance as completed. Please check your connection and try again.');
    } finally {
      // Remove from completing items set
      setCompletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(complianceId);
        return newSet;
      });
    }
  };

  const clearAllComplianceData = async () => {
    if (!confirm('⚠️ Are you sure you want to clear ALL compliance data? This action cannot be undone.')) {
      return;
    }

    try {
      setClearingData(true);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/compliance/clear-all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Successfully cleared ${data.data.deletedCount} compliance items`);

        // Refresh all data
        await Promise.all([
          fetchComplianceData(),
          fetchComplianceStats(),
          fetchOverdueActivity()
        ]);
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to clear compliance data: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error clearing compliance data:', error);
      alert('❌ Error clearing compliance data. Please try again.');
    } finally {
      setClearingData(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-800 bg-gray-50 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gst': return 'bg-blue-100 text-blue-800';
      case 'tds': return 'bg-purple-100 text-purple-800';
      case 'income_tax': return 'bg-green-100 text-green-800';
      case 'pf': return 'bg-orange-100 text-orange-800';
      case 'esi': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Compliance Calendar">
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                Dashboard
              </Link>
            </li>
            <li>
              <svg className="flex-shrink-0 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </li>
            <li>
              <span className="text-gray-900 text-sm font-medium">Compliance Calendar</span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Compliance Calendar</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Track and manage your tax compliance deadlines
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={clearAllComplianceData}
                  disabled={clearingData}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 ${
                    clearingData
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {clearingData ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Clear All</span>
                    </>
                  )}
                </button>
                <Link
                  href="/dashboard/compliance/settings"
                  className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Settings
                </Link>
                <Link
                  href="/dashboard/compliance/custom"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Add Custom
              </Link>
            </div>
          </div>
        </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{stats.totalActive}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Total Active</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalActive}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{stats.completedThisMonth}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Completed This Month</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.completedThisMonth}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{stats.upcomingCount}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Upcoming (30 days)</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.upcomingCount}</p>
                </div>
              </div>
            </div>

            <div
              className={`bg-white rounded-lg shadow p-6 transition-all duration-200 ${
                stats.overdueCount > 0 ? 'cursor-pointer hover:shadow-lg hover:bg-red-50' : ''
              }`}
              onClick={() => stats.overdueCount > 0 && setShowOverdueSection(!showOverdueSection)}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{stats.overdueCount}</span>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-900">Overdue</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.overdueCount}</p>
                </div>
                {stats.overdueCount > 0 && (
                  <div className="ml-2">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        showOverdueSection ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Overdue Activity Section */}
        {stats && stats.overdueCount > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Overdue Activity ({stats.overdueCount})
                  </h2>
                </div>
                <button
                  onClick={() => setShowOverdueSection(!showOverdueSection)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {showOverdueSection ? 'Hide Details' : 'View Details'}
                </button>
              </div>
            </div>

            {showOverdueSection && (
              <div className="px-6 py-4">
                {overdueActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600">Loading overdue activity...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {overdueActivity.slice(0, 5).map((activity) => (
                      <div key={activity._id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-medium text-gray-900">
                              {activity.complianceId.title}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              activity.complianceId.priority === 'critical' ? 'bg-red-100 text-red-800' :
                              activity.complianceId.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              activity.complianceId.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {activity.complianceId.priority}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm">
                            <span className="text-gray-600">
                              Due: {new Date(activity.nextDueDate).toLocaleDateString('en-IN')}
                            </span>
                            <span className="text-red-600 font-medium">
                              {activity.daysOverdue} days overdue
                            </span>
                            <span className="text-gray-600">
                              Type: {activity.complianceId.type.toUpperCase()}
                            </span>
                          </div>
                          {activity.notes && (
                            <p className="mt-2 text-sm text-gray-600 italic">
                              Note: {activity.notes}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => markAsCompleted(activity._id)}
                            disabled={completingItems.has(activity._id)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center space-x-1 ${
                              completingItems.has(activity._id)
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {completingItems.has(activity._id) ? (
                              <>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Completing...</span>
                              </>
                            ) : (
                              <span>Mark Complete</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}

                    {overdueActivity.length > 5 && (
                      <div className="text-center pt-4">
                        <p className="text-sm text-gray-600">
                          Showing 5 of {overdueActivity.length} overdue items
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 transition-colors"
                >
                  <option value="all" className="text-gray-900">All Types</option>
                  <option value="gst" className="text-gray-900">GST</option>
                  <option value="tds" className="text-gray-900">TDS</option>
                  <option value="income_tax" className="text-gray-900">Income Tax</option>
                  <option value="pf" className="text-gray-900">PF</option>
                  <option value="esi" className="text-gray-900">ESI</option>
                  <option value="custom" className="text-gray-900">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 transition-colors"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="text-gray-900">
                      {new Date(2024, i).toLocaleDateString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-gray-400 transition-colors"
                >
                  <option value={2024} className="text-gray-900">2024</option>
                  <option value={2025} className="text-gray-900">2025</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Items */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Compliance Items ({complianceItems.length})
            </h2>
          </div>

          {complianceItems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-900 text-base">No compliance items found for the selected filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {complianceItems.map((item) => {
                const daysUntilDue = getDaysUntilDue(item.nextDueDate);
                const isOverdue = daysUntilDue < 0;
                
                return (
                  <div key={item._id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-medium text-gray-900">
                            {item.complianceId.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(item.complianceId.type)}`}>
                            {item.complianceId.type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(item.complianceId.priority)}`}>
                            {item.complianceId.priority}
                          </span>
                        </div>
                        
                        <p className="mt-1 text-sm text-gray-900">
                          {item.complianceId.description}
                        </p>

                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-900">
                          <span className="font-medium">
                            Due: {new Date(item.nextDueDate).toLocaleDateString('en-IN')}
                          </span>
                          <span className={isOverdue ? 'text-red-600 font-medium' : daysUntilDue <= 7 ? 'text-orange-600 font-medium' : 'text-gray-900 font-medium'}>
                            {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days left`}
                          </span>
                          {item.complianceId.resources?.formNumber && (
                            <span className="text-gray-900">Form: {item.complianceId.resources.formNumber}</span>
                          )}
                        </div>

                        {item.complianceId.penaltyInfo?.lateFilingPenalty && (
                          <div className="mt-2 text-sm text-red-600">
                            <span className="font-medium">Penalty:</span> {item.complianceId.penaltyInfo.lateFilingPenalty}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        {item.complianceId.resources?.officialLink && (
                          <a
                            href={item.complianceId.resources.officialLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Official Link
                          </a>
                        )}
                        
                        {!item.isCompleted && (
                          <button
                            onClick={() => markAsCompleted(item._id)}
                            disabled={completingItems.has(item._id)}
                            className={`px-3 py-1 text-sm font-medium rounded transition-colors flex items-center space-x-1 ${
                              completingItems.has(item._id)
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {completingItems.has(item._id) ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Completing...</span>
                              </>
                            ) : (
                              <span>Mark Complete</span>
                            )}
                          </button>
                        )}
                        
                        {item.isCompleted && (
                          <span className="text-green-600 text-sm font-medium">✓ Completed</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
