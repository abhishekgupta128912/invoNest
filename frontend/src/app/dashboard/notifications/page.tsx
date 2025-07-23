'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  readAt?: string;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  emailAddress?: string;
  complianceReminders: boolean;
  invoiceReminders: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
  reminderTiming: {
    days: number[];
    timeOfDay: string;
    timezone: string;
  };
  maxDailyEmails: number;
  digestMode: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchNotifications();
        fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchNotifications();
        fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const updatePreferences = async (updatedPreferences: Partial<NotificationPreferences>) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedPreferences)
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.data);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'compliance': return '📅';
      case 'invoice': return '🧾';
      case 'system': return '⚙️';
      case 'reminder': return '⏰';
      case 'alert': return '🚨';
      default: return '📢';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Notifications">
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
              <span className="text-gray-900 text-sm font-medium">Notifications</span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage your notifications and preferences
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Mark All Read ({unreadCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'notifications'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'preferences'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Preferences
              </button>
            </nav>
          </div>

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="px-6 py-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Recent Notifications ({notifications.length})
              </h2>

              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-500">No notifications found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`p-4 rounded-lg border ${notification.status !== 'read' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{getTypeIcon(notification.type)}</span>
                            <h3 className="text-lg font-medium text-gray-900">
                              {notification.title}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                            {notification.status !== 'read' && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-gray-600">
                            {notification.message}
                          </p>

                          <div className="mt-2 text-xs text-gray-500">
                            {new Date(notification.createdAt).toLocaleString('en-IN')}
                            {notification.readAt && (
                              <span className="ml-2">
                                • Read {new Date(notification.readAt).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>

                        {notification.status !== 'read' && (
                          <button
                            onClick={() => markAsRead(notification._id)}
                            className="ml-4 text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && preferences && (
            <div className="px-6 py-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h2>

              <div className="space-y-6">
                {/* Email Notifications */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="text-base font-semibold text-gray-900">Enable Email Notifications</label>
                        <p className="text-sm text-gray-600 mt-1">Receive notifications via email</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.emailNotifications}
                        onChange={(e) => updatePreferences({ emailNotifications: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="text-base font-semibold text-gray-900">Compliance Reminders</label>
                        <p className="text-sm text-gray-600 mt-1">Get reminded about upcoming compliance deadlines</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.complianceReminders}
                        onChange={(e) => updatePreferences({ complianceReminders: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="text-base font-semibold text-gray-900">Invoice Reminders</label>
                        <p className="text-sm text-gray-600 mt-1">Get reminded about invoice due dates</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.invoiceReminders}
                        onChange={(e) => updatePreferences({ invoiceReminders: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="text-base font-semibold text-gray-900">System Updates</label>
                        <p className="text-sm text-gray-600 mt-1">Get notified about system updates and maintenance</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.systemUpdates}
                        onChange={(e) => updatePreferences({ systemUpdates: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <label className="text-base font-semibold text-gray-900">Marketing Emails</label>
                        <p className="text-sm text-gray-600 mt-1">Receive promotional emails and updates</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.marketingEmails}
                        onChange={(e) => updatePreferences({ marketingEmails: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                {/* Timing Preferences */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Reminder Timing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-3">
                        Reminder Days Before Due Date
                      </label>
                      <div className="space-y-3">
                        {[1, 3, 7, 15, 30].map((day) => (
                          <label key={day} className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={preferences.reminderTiming.days.includes(day)}
                              onChange={(e) => {
                                const days = e.target.checked
                                  ? [...preferences.reminderTiming.days, day]
                                  : preferences.reminderTiming.days.filter(d => d !== day);
                                updatePreferences({
                                  reminderTiming: { ...preferences.reminderTiming, days }
                                });
                              }}
                              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-3 text-base font-medium text-gray-900">{day} day{day !== 1 ? 's' : ''} before</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="block text-lg font-bold text-gray-900 mb-3">
                        Preferred Time for Reminders
                      </label>
                      <p className="text-sm text-gray-600 mb-3">Choose when you want to receive reminder notifications</p>
                      <input
                        type="time"
                        value={preferences.reminderTiming.timeOfDay}
                        onChange={(e) => updatePreferences({
                          reminderTiming: { ...preferences.reminderTiming, timeOfDay: e.target.value }
                        })}
                        className="border-2 border-gray-300 rounded-xl px-6 py-4 text-lg font-bold text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                        style={{ colorScheme: 'light' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Email Limits */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Email Limits & Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <label className="block text-lg font-bold text-gray-900 mb-3">
                        Maximum Daily Emails
                      </label>
                      <p className="text-sm text-gray-600 mb-4">Control how many emails you receive per day</p>
                      <select
                        value={preferences.maxDailyEmails}
                        onChange={(e) => updatePreferences({ maxDailyEmails: parseInt(e.target.value) })}
                        className="border-2 border-gray-300 rounded-xl px-6 py-4 text-lg font-bold text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                      >
                        <option value={1} className="text-gray-900 font-semibold">1 email per day</option>
                        <option value={3} className="text-gray-900 font-semibold">3 emails per day</option>
                        <option value={5} className="text-gray-900 font-semibold">5 emails per day</option>
                        <option value={10} className="text-gray-900 font-semibold">10 emails per day</option>
                        <option value={20} className="text-gray-900 font-semibold">20 emails per day</option>
                      </select>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          checked={preferences.digestMode}
                          onChange={(e) => updatePreferences({ digestMode: e.target.checked })}
                          className="h-6 w-6 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                        />
                        <div className="ml-4">
                          <label className="text-lg font-bold text-gray-900 cursor-pointer">Daily Digest Mode</label>
                          <p className="text-base text-gray-700 mt-2 font-medium">Receive one daily summary instead of individual emails</p>
                          <div className="mt-3 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm text-blue-700 font-semibold">Recommended for busy professionals</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
