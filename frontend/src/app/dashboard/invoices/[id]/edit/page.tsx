'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '../../../../../components/dashboard/DashboardLayout';
import InvoiceForm from '../../../../../components/invoice/InvoiceForm';
import { authenticatedFetch } from '../../../../../lib/auth';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer: {
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
  };
  items: Array<{
    description: string;
    hsn: string;
    quantity: number;
    unit: string;
    rate: number;
    discount: number;
  }>;
  dueDate?: string;
  notes?: string;
  terms?: string;
  status: string;
  paymentStatus: string;
}

interface InvoiceFormData {
  customer: {
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
  };
  items: Array<{
    description: string;
    hsn: string;
    quantity: number;
    unit: string;
    rate: number;
    discount: number;
  }>;
  dueDate?: string;
  notes?: string;
  terms?: string;
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/invoices/${invoiceId}`);
      const data = await response.json();

      if (data.success) {
        setInvoice(data.data.invoice);
      } else {
        setErrors([data.message || 'Failed to fetch invoice']);
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setErrors(['Failed to fetch invoice']);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: InvoiceFormData) => {
    setSubmitting(true);
    setErrors([]);

    try {
      const response = await authenticatedFetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/dashboard/invoices/${invoiceId}`);
      } else {
        setErrors([data.message || 'Failed to update invoice']);
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      setErrors(['Failed to update invoice']);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Edit Invoice"
      >
        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout
        title="Edit Invoice"

      >
        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            Invoice not found or you don't have permission to edit it.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Check if invoice can be edited
  if (invoice.paymentStatus === 'paid') {
    return (
      <DashboardLayout
        title="Edit Invoice"

      >
        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-medium">Cannot Edit Paid Invoice</p>
                <p className="text-sm mt-1">This invoice has been marked as paid and cannot be edited.</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Prepare initial data for the form
  const initialData: InvoiceFormData = {
    customer: invoice.customer,
    items: invoice.items,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
    notes: invoice.notes || '',
    terms: invoice.terms || ''
  };

  return (
    <DashboardLayout
      title="Edit Invoice"

      actions={
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      }
    >
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <InvoiceForm
            onSubmit={handleSubmit}
            loading={submitting}
            errors={errors}
            initialData={initialData}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
