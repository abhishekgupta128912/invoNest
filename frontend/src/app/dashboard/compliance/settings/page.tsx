'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ComplianceItem {
  _id: string;
  complianceId: {
    _id: string;
    title: string;
    description: string;
    type: string;
    category: string;
    priority: string;
  };
  nextDueDate: string;
  isCompleted: boolean;
  isEnabled: boolean;
  reminderDays: number[];
  customDueDate?: string;
}

export default function ComplianceSettingsPage() {
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const router = useRouter();

  useEffect(() => {
    fetchComplianceItems();
  }, []);

  const fetchComplianceItems = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/compliance/calendar', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setComplianceItems(data.data);
      } else {
        setMessage({ type: 'error', text: 'Failed to fetch compliance items' });
      }
    } catch (error) {
      console.error('Error fetching compliance items:', error);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const updateComplianceSettings = async (itemId: string, settings: any) => {
    setSaving(itemId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/compliance/${itemId}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings updated successfully' });
        fetchComplianceItems();
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Failed to update settings' });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleEnabled = (item: ComplianceItem) => {
    updateComplianceSettings(item._id, { isEnabled: !item.isEnabled });
  };

  const handleCustomDueDateChange = (item: ComplianceItem, customDueDate: string) => {
    if (customDueDate) {
      updateComplianceSettings(item._id, { customDueDate });
    }
  };

  const handleReminderDaysChange = (item: ComplianceItem, reminderDays: number[]) => {
    updateComplianceSettings(item._id, { reminderDays });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gst': return 'bg-blue-100 text-blue-800';
      case 'tds': return 'bg-purple-100 text-purple-800';
      case 'income_tax': return 'bg-green-100 text-green-800';
      case 'pf': return 'bg-orange-100 text-orange-800';
      case 'esi': return 'bg-pink-100 text-pink-800';
      case 'custom': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Compliance Settings</h1>
              <p className="mt-1 text-sm text-gray-900">
                Manage your compliance preferences and reminders
              </p>
            </div>
            <Link
              href="/dashboard/compliance"
              className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Back to Calendar
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Settings List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Compliance Item Settings ({complianceItems.length})
            </h2>
          </div>

          {complianceItems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-900 text-base">No compliance items found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {complianceItems.map((item) => (
                <div key={item._id} className="px-6 py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.complianceId.title}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(item.complianceId.type)}`}>
                          {item.complianceId.type.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-sm text-gray-900 mb-4">
                        {item.complianceId.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Enable/Disable Toggle */}
                        <div>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={item.isEnabled}
                              onChange={() => handleToggleEnabled(item)}
                              disabled={saving === item._id}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-800">
                              Enable notifications
                            </span>
                          </label>
                        </div>

                        {/* Custom Due Date */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Custom Due Date
                          </label>
                          <input
                            type="date"
                            defaultValue={item.customDueDate ? new Date(item.customDueDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleCustomDueDateChange(item, e.target.value)}
                            disabled={saving === item._id}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900"
                          />
                          <p className="mt-1 text-xs text-gray-900">
                            Override default due date
                          </p>
                        </div>

                        {/* Reminder Days */}
                        <div>
                          <label className="block text-sm font-medium text-gray-900 mb-1">
                            Reminder Days
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[1, 3, 7, 15, 30].map((day) => (
                              <label key={day} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={item.reminderDays.includes(day)}
                                  onChange={(e) => {
                                    const newReminderDays = e.target.checked
                                      ? [...item.reminderDays, day].sort((a, b) => b - a)
                                      : item.reminderDays.filter(d => d !== day);
                                    handleReminderDaysChange(item, newReminderDays);
                                  }}
                                  disabled={saving === item._id}
                                  className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <span className="ml-1 text-xs text-gray-800">
                                  {day}d
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-gray-700">
                            Days before due date to send reminders
                          </p>
                        </div>
                      </div>
                    </div>

                    {saving === item._id && (
                      <div className="ml-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
