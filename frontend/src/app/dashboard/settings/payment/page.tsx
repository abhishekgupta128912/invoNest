'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../../components/dashboard/DashboardLayout';
import { authenticatedFetch } from '../../../../lib/auth';

interface PaymentSettings {
  upiId: string;
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    accountHolderName: string;
  };
}

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PaymentSettings>({
    upiId: '',
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      accountHolderName: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingUPI, setValidatingUPI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [upiValidation, setUpiValidation] = useState<{
    isValid?: boolean;
    error?: string;
    suggestions?: string[];
    provider?: string;
  }>({});

  useEffect(() => {
    fetchPaymentSettings();
  }, []);

  const fetchPaymentSettings = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/auth/profile');
      const data = await response.json();

      if (data.success) {
        setSettings({
          upiId: data.data.upiId || '',
          bankDetails: {
            accountNumber: data.data.bankDetails?.accountNumber || '',
            ifscCode: data.data.bankDetails?.ifscCode || '',
            bankName: data.data.bankDetails?.bankName || '',
            accountHolderName: data.data.bankDetails?.accountHolderName || ''
          }
        });
      }
    } catch (err) {
      setError('Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate UPI ID before saving
    if (settings.upiId && settings.upiId.trim() && upiValidation.isValid === false) {
      setError('Please enter a valid UPI ID before saving');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await authenticatedFetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upiId: settings.upiId,
          bankDetails: settings.bankDetails
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Payment settings saved successfully!');
      } else {
        setError(data.message || 'Failed to save payment settings');
      }
    } catch (err) {
      setError('Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const validateUPI = async (upiId: string) => {
    if (!upiId.trim()) {
      setUpiValidation({});
      return;
    }

    setValidatingUPI(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/validate-upi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ upiId: upiId.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setUpiValidation({
          isValid: true,
          provider: data.data.provider
        });
      } else {
        setUpiValidation({
          isValid: false,
          error: data.message,
          suggestions: data.suggestions
        });
      }
    } catch (err) {
      setUpiValidation({
        isValid: false,
        error: 'Unable to validate UPI ID'
      });
    } finally {
      setValidatingUPI(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'upiId') {
      setSettings(prev => ({ ...prev, upiId: value }));

      // Debounced UPI validation
      const timeoutId = setTimeout(() => {
        validateUPI(value);
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else {
      setSettings(prev => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          [field]: value
        }
      }));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure your payment details to receive payments from customers
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-green-700">{success}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* UPI Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="text-2xl mr-3">📱</span>
                UPI Payment Settings
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Add your UPI ID to receive instant payments from customers
              </p>
            </div>
            <div className="px-6 py-6">
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UPI ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={settings.upiId}
                    onChange={(e) => handleInputChange('upiId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      upiValidation.isValid === true
                        ? 'border-green-300 bg-green-50'
                        : upiValidation.isValid === false
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    placeholder="e.g., yourname@paytm, 9876543210@ybl"
                  />
                  {validatingUPI && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    </div>
                  )}
                  {!validatingUPI && upiValidation.isValid === true && (
                    <div className="absolute right-3 top-2.5">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  {!validatingUPI && upiValidation.isValid === false && (
                    <div className="absolute right-3 top-2.5">
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Validation Messages */}
                {upiValidation.isValid === true && upiValidation.provider && (
                  <p className="text-xs text-green-600 mt-1 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Valid UPI ID ({upiValidation.provider})
                  </p>
                )}

                {upiValidation.isValid === false && upiValidation.error && (
                  <div className="mt-1">
                    <p className="text-xs text-red-600 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {upiValidation.error}
                    </p>
                    {upiValidation.suggestions && upiValidation.suggestions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 mb-1">Suggestions:</p>
                        <div className="flex flex-wrap gap-1">
                          {upiValidation.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleInputChange('upiId', suggestion)}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!upiValidation.isValid && (
                  <p className="text-xs text-gray-500 mt-1">
                    Examples: user@paytm, 9876543210@ybl, name@oksbi, etc.
                  </p>
                )}
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How UPI payments work:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Customers will see a "Pay Now" button in invoice emails</li>
                  <li>Clicking the button opens their UPI app with pre-filled details</li>
                  <li>They can complete payment instantly using any UPI app</li>
                  <li>No additional fees or setup required</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="text-2xl mr-3">🏦</span>
                Bank Transfer Details
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Add your bank details for customers who prefer bank transfers
              </p>
            </div>
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={settings.bankDetails.accountHolderName}
                    onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="As per bank records"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={settings.bankDetails.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Your bank account number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={settings.bankDetails.ifscCode}
                    onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., SBIN0001234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={settings.bankDetails.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., State Bank of India"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Bank transfer information:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Bank details will be included in invoice emails</li>
                  <li>Customers can transfer money directly to your account</li>
                  <li>Include invoice number in transfer reference for easy tracking</li>
                  <li>Verify all details carefully before saving</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Payment Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
