'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { authenticatedFetch } from '../../../../lib/auth';
import DashboardLayout, { DashboardHeader } from '../../../../components/dashboard/DashboardLayout';
import BlockchainVerification from '../../../../components/blockchain/BlockchainVerification';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    gstNumber?: string;
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
    taxableAmount: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
  }>;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotal: number;
  notes?: string;
  terms?: string;
  status: string;
  paymentStatus: string;
  paymentDate?: string;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');


  useEffect(() => {
    if (params.id && user) {
      fetchInvoice();
    }
  }, [params.id, user]);

  useEffect(() => {
    if (invoice?.customer?.email) {
      setEmailAddress(invoice.customer.email);
    }
  }, [invoice]);

  const fetchInvoice = async () => {
    try {
      const response = await authenticatedFetch(`/api/invoices/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setInvoice(data.data.invoice);
        setError('');
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to fetch invoice:', err);
      setError('Failed to fetch invoice');
    } finally {
      setLoading(false);
    }
  };

  const updateInvoiceStatus = async (status: string, paymentStatus?: string) => {
    if (!invoice) return;

    setUpdating(true);
    try {
      const updateData: any = { status };
      if (paymentStatus) {
        updateData.paymentStatus = paymentStatus;
        if (paymentStatus === 'paid') {
          updateData.paymentDate = new Date().toISOString();
        }
      }

      const response = await authenticatedFetch(`/api/invoices/${invoice._id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      if (data.success) {
        setInvoice(data.data.invoice);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to update invoice:', err);
      setError('Failed to update invoice');
    } finally {
      setUpdating(false);
    }
  };

  const downloadPDF = async () => {
    if (!invoice) return;

    try {
      setDownloadingPDF(true);
      setError('');

      const response = await authenticatedFetch(`/api/invoices/${invoice._id}/pdf`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setError('Error downloading PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const sendInvoiceEmail = async () => {
    if (!emailAddress.trim()) {
      setError('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await authenticatedFetch(`/api/invoices/${invoice?._id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailAddress }),
      });

      const data = await response.json();

      if (data.success) {
        setShowEmailModal(false);
        setError('');
        // Show success message
        alert('Invoice sent successfully via email!');
        // Refresh invoice data to update status if needed
        fetchInvoice();
      } else {
        setError(data.message || 'Failed to send email');
      }
    } catch (err) {
      console.error('Email sending failed:', err);
      setError('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-orange-100 text-orange-800',
      paid: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[paymentStatus as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg text-gray-600">Loading invoice...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Invoice not found</h3>
          <p className="mt-1 text-sm text-gray-500">{error || 'The invoice you are looking for does not exist.'}</p>
          <div className="mt-6">
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Back to Invoices
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="invoice-page">{/* Add invoice-page class for CSS targeting */}
      <DashboardHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`Created on ${formatDate(invoice.createdAt)}`}
        actions={
          <div className="flex items-center space-x-3">
            <button
              onClick={downloadPDF}
              disabled={downloadingPDF}
              className={`px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center ${
                downloadingPDF
                  ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              {downloadingPDF ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating PDF...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="px-4 py-2 border border-green-300 rounded-lg text-sm font-medium text-green-700 bg-white hover:bg-green-50 transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Email
            </button>

            {invoice.status === 'draft' && (
              <Link
                href={`/dashboard/invoices/${invoice._id}/edit`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Invoice
              </Link>
            )}
          </div>
        }
      />

      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6 invoice-view">
        {/* Status and Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-sm text-gray-600">Status:</span>
                {getStatusBadge(invoice.status)}
              </div>
              <div>
                <span className="text-sm text-gray-600">Payment:</span>
                {getPaymentStatusBadge(invoice.paymentStatus)}
              </div>
            </div>

            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <div className="flex flex-wrap gap-2">
                {invoice.status === 'draft' && (
                  <button
                    onClick={() => updateInvoiceStatus('sent')}
                    disabled={updating}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Mark as Sent
                  </button>
                )}
                {invoice.paymentStatus !== 'paid' && (
                  <button
                    onClick={() => updateInvoiceStatus(invoice.status, 'paid')}
                    disabled={updating}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark as Paid
                  </button>
                )}
                <button
                  onClick={() => updateInvoiceStatus('cancelled')}
                  disabled={updating}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Cancel Invoice
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600">Name:</span>
                <p className="text-gray-900">{invoice.customer.name}</p>
              </div>
              {invoice.customer.email && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Email:</span>
                  <p className="text-gray-900">{invoice.customer.email}</p>
                </div>
              )}
              {invoice.customer.phone && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Phone:</span>
                  <p className="text-gray-900">{invoice.customer.phone}</p>
                </div>
              )}
              {invoice.customer.gstNumber && (
                <div>
                  <span className="text-sm font-medium text-gray-600">GST Number:</span>
                  <p className="text-gray-900">{invoice.customer.gstNumber}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-600">Address:</span>
                <p className="text-gray-900">
                  {invoice.customer.address.street}<br />
                  {invoice.customer.address.city}, {invoice.customer.address.state}<br />
                  {invoice.customer.address.pincode}, {invoice.customer.address.country}
                </p>
              </div>
            </div>
          </div>

          {/* Invoice Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#111827' }}>Invoice Information</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600" style={{ color: '#4B5563' }}>Invoice Number:</span>
                <p className="text-gray-900 font-mono" style={{ color: '#111827' }}>{invoice.invoiceNumber}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600" style={{ color: '#4B5563' }}>Invoice Date:</span>
                <p className="text-gray-900" style={{ color: '#111827' }}>{formatDate(invoice.invoiceDate)}</p>
              </div>
              {invoice.dueDate && (
                <div>
                  <span className="text-sm font-medium text-gray-600" style={{ color: '#4B5563' }}>Due Date:</span>
                  <p className="text-gray-900" style={{ color: '#111827' }}>{formatDate(invoice.dueDate)}</p>
                </div>
              )}
              {invoice.paymentDate && (
                <div>
                  <span className="text-sm font-medium text-gray-600" style={{ color: '#4B5563' }}>Payment Date:</span>
                  <p className="text-gray-900" style={{ color: '#111827' }}>{formatDate(invoice.paymentDate)}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-600" style={{ color: '#4B5563' }}>Grand Total:</span>
                <p className="text-xl font-bold text-indigo-600" style={{ color: '#4F46E5' }}>{formatCurrency(invoice.grandTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ color: '#111827' }}>Invoice Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>S.No</th>
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Description</th>
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>HSN</th>
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Qty</th>
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Rate</th>
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Disc%</th>
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Taxable Amt</th>
                  {user?.address?.state?.toLowerCase() !== invoice.customer.address.state.toLowerCase() ? (
                    <>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>IGST%</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>IGST Amt</th>
                    </>
                  ) : (
                    <>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>CGST%</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>SGST%</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Tax Amt</th>
                    </>
                  )}
                  <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase" style={{ color: '#374151' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm" style={{ color: '#111827' }}>{index + 1}</td>
                    <td className="border border-gray-300 px-2 py-2 text-sm" style={{ color: '#111827' }}>{item.description}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm" style={{ color: '#111827' }}>{item.hsn}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{item.quantity}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{formatCurrency(item.rate)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{item.discount}%</td>
                    <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{formatCurrency(item.taxableAmount)}</td>
                    {user?.address?.state?.toLowerCase() !== invoice.customer.address.state.toLowerCase() ? (
                      <>
                        <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{item.igstRate}%</td>
                        <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{formatCurrency(item.igstAmount)}</td>
                      </>
                    ) : (
                      <>
                        <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{item.cgstRate}%</td>
                        <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{item.sgstRate}%</td>
                        <td className="border border-gray-300 px-2 py-2 text-right text-sm" style={{ color: '#111827' }}>{formatCurrency(item.cgstAmount + item.sgstAmount)}</td>
                      </>
                    )}
                    <td className="border border-gray-300 px-2 py-2 text-right text-sm font-semibold" style={{ color: '#111827' }}>{formatCurrency(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>
          <div className="flex justify-end">
            <div className="w-64">
              <table className="w-full border border-gray-300 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">Subtotal:</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  {invoice.totalDiscount > 0 && (
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">Discount:</td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-semibold">-{formatCurrency(invoice.totalDiscount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">Taxable Amount:</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{formatCurrency(invoice.taxableAmount)}</td>
                  </tr>
                  {invoice.totalCGST > 0 && (
                    <>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">CGST:</td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{formatCurrency(invoice.totalCGST)}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">SGST:</td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{formatCurrency(invoice.totalSGST)}</td>
                      </tr>
                    </>
                  )}
                  {invoice.totalIGST > 0 && (
                    <tr>
                      <td className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">IGST:</td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-semibold">{formatCurrency(invoice.totalIGST)}</td>
                    </tr>
                  )}
                  <tr className="bg-blue-600 text-white">
                    <td className="border border-gray-300 px-3 py-2 font-bold">Grand Total:</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-bold">{formatCurrency(invoice.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        {(invoice.terms || invoice.notes) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.terms && (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded border-l-4 border-l-blue-600">
                  <div className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
                    Terms & Conditions
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{invoice.terms}</p>
                </div>
              )}

              {invoice.notes && (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded border-l-4 border-l-blue-600">
                  <div className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
                    Notes
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blockchain Verification */}
        <BlockchainVerification
          hash={invoice.hash}
          invoiceNumber={invoice.invoiceNumber}
          onVerify={(result) => {
            console.log('Blockchain verification result:', result);
            // Handle verification result if needed
          }}
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Invoice via Email</h3>

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter customer email address"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={sendingEmail}
              >
                Cancel
              </button>
              <button
                onClick={sendInvoiceEmail}
                disabled={sendingEmail || !emailAddress.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {sendingEmail ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      </div>{/* Close invoice-page div */}
    </DashboardLayout>
  );
}
