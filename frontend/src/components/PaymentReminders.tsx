'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface PaymentReminder {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  dueDate: string;
  daysToDue?: number;
  daysOverdue?: number;
  status: string;
  paymentStatus: string;
}

interface ReminderSettings {
  enabled: boolean;
  reminderDays: number[];
  overdueReminderDays: number[];
  maxReminders: number;
}

const PaymentReminders: React.FC = () => {
  const [upcomingReminders, setUpcomingReminders] = useState<PaymentReminder[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<PaymentReminder[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: true,
    reminderDays: [7, 3, 1],
    overdueReminderDays: [1, 7, 14],
    maxReminders: 5
  });
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch upcoming reminders, overdue invoices, and settings
      const [upcomingRes, overdueRes, settingsRes] = await Promise.all([
        fetch('/api/payment-reminders/upcoming', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/payment-reminders/overdue', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/payment-reminders/settings', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (upcomingRes.ok) {
        const upcomingData = await upcomingRes.json();
        setUpcomingReminders(upcomingData.data || []);
      }

      if (overdueRes.ok) {
        const overdueData = await overdueRes.json();
        setOverdueInvoices(overdueData.data || []);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.data || settings);
      }
    } catch (error) {
      console.error('Error fetching payment reminders:', error);
      toast.error('Failed to load payment reminders');
    } finally {
      setLoading(false);
    }
  };

  const sendManualReminder = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/payment-reminders/send/${invoiceId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        toast.success('Payment reminder sent successfully');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send reminder');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  const updateSettings = async () => {
    try {
      const response = await fetch('/api/payment-reminders/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast.success('Settings updated successfully');
        setShowSettings(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Payment Reminders</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-lg shadow-md p-6 border">
          <h3 className="text-lg font-semibold mb-4">Reminder Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
                Enable automatic payment reminders
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send reminders before due date (days):
              </label>
              <input
                type="text"
                value={settings.reminderDays.join(', ')}
                onChange={(e) => setSettings({
                  ...settings,
                  reminderDays: e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="7, 3, 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send reminders after due date (days):
              </label>
              <input
                type="text"
                value={settings.overdueReminderDays.join(', ')}
                onChange={(e) => setSettings({
                  ...settings,
                  overdueReminderDays: e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="1, 7, 14"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={updateSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Save Settings
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Reminders */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Upcoming Payment Reminders ({upcomingReminders.length})
          </h3>
        </div>
        
        {upcomingReminders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No upcoming payment reminders
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {upcomingReminders.map((reminder) => (
              <div key={reminder.invoiceId} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-indigo-600">
                        {reminder.invoiceNumber}
                      </span>
                      <span className="text-sm text-gray-500">
                        {reminder.customerName}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                      <span>Amount: {formatCurrency(reminder.amount)}</span>
                      <span>Due: {formatDate(reminder.dueDate)}</span>
                      <span className="text-orange-600 font-medium">
                        Due in {reminder.daysToDue} day{reminder.daysToDue !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => sendManualReminder(reminder.invoiceId)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    Send Reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Invoices */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Overdue Invoices ({overdueInvoices.length})
          </h3>
        </div>
        
        {overdueInvoices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No overdue invoices
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {overdueInvoices.map((invoice) => (
              <div key={invoice.invoiceId} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-indigo-600">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="text-sm text-gray-500">
                        {invoice.customerName}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                      <span>Amount: {formatCurrency(invoice.amount)}</span>
                      <span>Due: {formatDate(invoice.dueDate)}</span>
                      <span className="text-red-600 font-medium">
                        {invoice.daysOverdue} day{invoice.daysOverdue !== 1 ? 's' : ''} overdue
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => sendManualReminder(invoice.invoiceId)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    Send Reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentReminders;
