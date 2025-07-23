'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { authenticatedFetch } from '../../../../lib/auth';
import DashboardLayout, { DashboardHeader } from '../../../../components/dashboard/DashboardLayout';
import InvoiceForm from '../../../../components/invoice/InvoiceForm';

interface InvoiceItem {
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
}

interface Customer {
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    setErrors([]);

    try {
      const response = await authenticatedFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        router.push('/dashboard/invoices');
      } else {
        setErrors(result.errors || [result.message]);
      }
    } catch (error) {
      console.error('Invoice creation error:', error);
      setErrors(['Network error. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Create Invoice"
        subtitle="Generate a new GST-compliant invoice with automatic calculations"
        actions={
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 transition-colors"
          >
            Back to Invoices
          </Link>
        }
      />

      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6">
          <InvoiceForm
            onSubmit={handleSubmit}
            loading={loading}
            errors={errors}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
