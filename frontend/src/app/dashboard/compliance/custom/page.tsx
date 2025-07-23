'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CustomComplianceForm {
  title: string;
  description: string;
  dueDate: string;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one_time';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reminderDays: number[];
}

export default function AddCustomCompliancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState<CustomComplianceForm>({
    title: '',
    description: '',
    dueDate: '',
    frequency: 'one_time',
    priority: 'medium',
    reminderDays: [7, 3, 1]
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReminderDaysChange = (day: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      reminderDays: checked
        ? [...prev.reminderDays, day].sort((a, b) => b - a)
        : prev.reminderDays.filter(d => d !== day)
    }));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) {
      errors.push('Title is required');
    } else if (formData.title.length > 200) {
      errors.push('Title cannot exceed 200 characters');
    }

    if (!formData.description.trim()) {
      errors.push('Description is required');
    } else if (formData.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    }

    if (!formData.dueDate) {
      errors.push('Due date is required');
    } else {
      const dueDate = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        errors.push('Due date cannot be in the past');
      }
    }

    if (formData.reminderDays.length === 0) {
      errors.push('At least one reminder day must be selected');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join(', ') });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/compliance/custom', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Custom compliance item created successfully!' });
        // Reset form
        setFormData({
          title: '',
          description: '',
          dueDate: '',
          frequency: 'one_time',
          priority: 'medium',
          reminderDays: [7, 3, 1]
        });
        
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push('/dashboard/compliance');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create custom compliance item' });
      }
    } catch (error) {
      console.error('Error creating custom compliance:', error);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add Custom Compliance</h1>
              <p className="mt-1 text-sm text-gray-700">
                Create a custom compliance deadline for your business
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Compliance Details</h2>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-800 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                maxLength={200}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                placeholder="e.g., Monthly Sales Report Submission"
              />
              <p className="mt-1 text-xs text-gray-700">
                {formData.title.length}/200 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-800 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                maxLength={1000}
                rows={4}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                placeholder="Describe the compliance requirement, what needs to be done, and any important details..."
              />
              <p className="mt-1 text-xs text-gray-700">
                {formData.description.length}/1000 characters
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Due Date */}
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-800 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  id="dueDate"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>

              {/* Frequency */}
              <div>
                <label htmlFor="frequency" className="block text-sm font-medium text-gray-800 mb-1">
                  Frequency *
                </label>
                <select
                  id="frequency"
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="one_time">One Time</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-800 mb-1">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Reminder Days */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Reminder Days *
                </label>
                <div className="flex flex-wrap gap-3">
                  {[1, 3, 7, 15, 30].map((day) => (
                    <label key={day} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.reminderDays.includes(day)}
                        onChange={(e) => handleReminderDaysChange(day, e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-800">
                        {day} day{day > 1 ? 's' : ''} before
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-700">
                  Select when you want to receive reminders before the due date
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Link
                href="/dashboard/compliance"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-800 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Compliance Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
