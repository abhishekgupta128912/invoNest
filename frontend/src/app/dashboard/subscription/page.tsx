'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { authenticatedFetch } from '../../../lib/auth';
import DashboardLayout, { DashboardHeader } from '../../../components/dashboard/DashboardLayout';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: {
    maxInvoices: number;
    maxStorage: number;
    maxUsers: number;
    documentAnalysis: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    advancedReports: boolean;
    automatedReminders: boolean;
    recurringInvoices: boolean;
    multiCurrency: boolean;
    exportOptions: string[];
  };
  isPopular?: boolean;
}

interface SubscriptionDetails {
  subscription: {
    planId: string;
    status: string;
    billingCycle: string;
    currentPeriodEnd: string;
    amount: number;
    usage: {
      invoicesUsed: number;
      storageUsed: number;
      usersCount: number;
    };
    isActive: () => boolean;
    isTrialing: () => boolean;
  };
  plan: Plan;
  usagePercentages: {
    invoices: number;
    storage: number;
    users: number;
  };
  isNearLimit: boolean;
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [plansResponse, subscriptionResponse] = await Promise.all([
        authenticatedFetch('/api/subscriptions/plans'),
        authenticatedFetch('/api/subscriptions/current')
      ]);

      const plansData = await plansResponse.json();
      const subscriptionData = await subscriptionResponse.json();

      if (plansData.success) {
        setPlans(plansData.data.plans);
      }

      if (subscriptionData.success) {
        setSubscriptionDetails(subscriptionData.data);
        setBillingCycle(subscriptionData.data.subscription.billingCycle);
      }
    } catch (error) {
      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (planId: string) => {
    try {
      setChanging(planId);
      setError('');

      const response = await authenticatedFetch('/api/subscriptions/change', {
        method: 'POST',
        body: JSON.stringify({ planId, billingCycle })
      });

      const data = await response.json();
      if (data.success) {
        setSubscriptionDetails(data.data);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to change subscription');
    } finally {
      setChanging(null);
    }
  };

  const handleStartTrial = async (planId: string) => {
    try {
      setChanging(planId);
      setError('');

      const response = await authenticatedFetch('/api/subscriptions/trial', {
        method: 'POST',
        body: JSON.stringify({ planId })
      });

      const data = await response.json();
      if (data.success) {
        setSubscriptionDetails(data.data);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Failed to start trial');
    } finally {
      setChanging(null);
    }
  };

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `₹${price}`;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Subscription" subtitle="Manage your subscription plan" />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Subscription" subtitle="Manage your subscription plan" />

      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Current Subscription */}
        {subscriptionDetails && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Plan</p>
                <p className="text-lg font-medium text-gray-900">{subscriptionDetails.plan.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  subscriptionDetails.subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                  subscriptionDetails.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {subscriptionDetails.subscription.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Billing</p>
                <p className="text-lg font-medium text-gray-900">
                  {formatPrice(subscriptionDetails.subscription.amount)} / {subscriptionDetails.subscription.billingCycle}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Next Billing</p>
                <p className="text-lg font-medium text-gray-900">
                  {new Date(subscriptionDetails.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Usage This Period</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">Invoices</span>
                    <span className={`text-sm px-2 py-1 rounded ${getUsageColor(subscriptionDetails.usagePercentages.invoices)}`}>
                      {subscriptionDetails.subscription.usage.invoicesUsed} / {subscriptionDetails.plan.features.maxInvoices === -1 ? '∞' : subscriptionDetails.plan.features.maxInvoices}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(subscriptionDetails.usagePercentages.invoices, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">Storage</span>
                    <span className={`text-sm px-2 py-1 rounded ${getUsageColor(subscriptionDetails.usagePercentages.storage)}`}>
                      {subscriptionDetails.subscription.usage.storageUsed}MB / {subscriptionDetails.plan.features.maxStorage}MB
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(subscriptionDetails.usagePercentages.storage, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500">Users</span>
                    <span className={`text-sm px-2 py-1 rounded ${getUsageColor(subscriptionDetails.usagePercentages.users)}`}>
                      {subscriptionDetails.subscription.usage.usersCount} / {subscriptionDetails.plan.features.maxUsers === -1 ? '∞' : subscriptionDetails.plan.features.maxUsers}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(subscriptionDetails.usagePercentages.users, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Yearly <span className="text-green-600 text-xs">(Save 10%)</span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-lg shadow-sm border-2 p-6 ${
                plan.isPopular ? 'border-indigo-500' : 'border-gray-200'
              } ${subscriptionDetails?.subscription.planId === plan.id ? 'ring-2 ring-indigo-500' : ''}`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-500 text-white px-3 py-1 text-xs font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatPrice(plan.price[billingCycle])}
                  </span>
                  {plan.price[billingCycle] > 0 && (
                    <span className="text-gray-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                  )}
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                <li className="flex items-center text-sm text-gray-600">
                  <span className="mr-2">📄</span>
                  {plan.features.maxInvoices === -1 ? 'Unlimited' : plan.features.maxInvoices} invoices
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <span className="mr-2">💾</span>
                  {plan.features.maxStorage}MB storage
                </li>
                <li className="flex items-center text-sm text-gray-600">
                  <span className="mr-2">👥</span>
                  {plan.features.maxUsers === -1 ? 'Unlimited' : plan.features.maxUsers} users
                </li>
                {plan.features.documentAnalysis && (
                  <li className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">🔍</span>
                    Document analysis
                  </li>
                )}
                {plan.features.prioritySupport && (
                  <li className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">⚡</span>
                    Priority support
                  </li>
                )}
                {plan.features.apiAccess && (
                  <li className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">🔌</span>
                    API access
                  </li>
                )}
              </ul>

              <div className="mt-6">
                {subscriptionDetails?.subscription.planId === plan.id ? (
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-md text-sm font-medium cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (plan.id !== 'free' && (subscriptionDetails?.subscription.planId === 'free' || !subscriptionDetails)) {
                        handleStartTrial(plan.id);
                      } else {
                        handlePlanChange(plan.id);
                      }
                    }}
                    disabled={changing === plan.id}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changing === plan.id ? 'Processing...' :
                     plan.id !== 'free' && (subscriptionDetails?.subscription.planId === 'free' || !subscriptionDetails) ? 'Start Free Trial' :
                     plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
