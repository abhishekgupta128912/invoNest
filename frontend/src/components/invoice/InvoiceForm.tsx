'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../../lib/auth';

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

interface InvoiceFormProps {
  onSubmit: (data: any) => Promise<void>;
  loading: boolean;
  errors: string[];
  initialData?: {
    customer?: Partial<Customer>;
    items?: InvoiceItem[];
    invoiceData?: {
      dueDate: string;
      notes: string;
      terms: string;
    };
  };
}

export default function InvoiceForm({ onSubmit, loading, errors, initialData }: InvoiceFormProps) {
  const [customer, setCustomer] = useState<Customer>({
    name: '',
    email: '',
    phone: '',
    gstNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    }
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: '',
      hsn: '',
      quantity: 0,
      unit: 'Nos',
      rate: 0,
      discount: 0
    }
  ]);

  const [invoiceData, setInvoiceData] = useState({
    dueDate: '',
    notes: '',
    terms: 'Payment due within 30 days',
    invoiceType: 'gst' as 'gst' | 'non-gst',
    enableBlockchainVerification: true
  });

  const [calculation, setCalculation] = useState<any>(null);
  const [hsnCodes, setHsnCodes] = useState<any[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [gstValidation, setGstValidation] = useState<{ isValid: boolean; message: string } | null>(null);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      if (initialData.customer) {
        setCustomer(prev => ({ ...prev, ...initialData.customer }));
      }
      if (initialData.items) {
        setItems(initialData.items);
      }
      if (initialData.invoiceData) {
        setInvoiceData(prev => ({ ...prev, ...initialData.invoiceData }));
      }
    }
  }, [initialData]);

  // Load HSN codes and states
  useEffect(() => {
    const loadData = async () => {
      try {
        const [hsnResponse, statesResponse] = await Promise.all([
          authenticatedFetch('/api/invoices/hsn-codes'),
          authenticatedFetch('/api/invoices/states')
        ]);

        const hsnData = await hsnResponse.json();
        const statesData = await statesResponse.json();

        if (hsnData.success) {
          setHsnCodes(hsnData.data.hsnCodes);
        }
        if (statesData.success) {
          setStates(statesData.data.states);
        }
      } catch (error) {
        console.error('Failed to load form data:', error);
      }
    };

    loadData();
  }, []);

  // Calculate totals when items or customer state changes
  useEffect(() => {
    // Only calculate if we have items with valid data and customer state
    const hasValidItems = items.some(item =>
      item.description.trim() &&
      item.hsn.trim() &&
      item.quantity > 0 &&
      item.rate > 0
    );

    if (hasValidItems && customer.address.state) {
      calculateTotals();
    } else {
      // Reset calculation if no valid items
      setCalculation(null);
    }
  }, [items, customer.address.state]);

  const calculateTotals = async () => {
    try {
      // Get user's state from localStorage or context
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        console.warn('User data not found in localStorage');
        return;
      }

      const user = JSON.parse(userStr);
      if (!user.address?.state) {
        console.warn('User state not found');
        return;
      }

      // Filter out invalid items before sending to API
      const validItems = items.filter(item =>
        item.description.trim() &&
        item.hsn.trim() &&
        item.quantity > 0 &&
        item.rate >= 0
      );

      if (validItems.length === 0) {
        setCalculation(null);
        return;
      }

      const response = await authenticatedFetch('/api/invoices/calculate', {
        method: 'POST',
        body: JSON.stringify({
          items: validItems,
          sellerState: user.address.state,
          buyerState: customer.address.state
        })
      });

      const data = await response.json();
      if (data.success) {
        setCalculation(data.data);
      } else {
        console.error('Calculation API error:', data.message);
        setCalculation(null);
      }
    } catch (error) {
      console.error('Failed to calculate totals:', error);
      setCalculation(null);
    }
  };

  const validateGSTNumber = async (gstNumber: string) => {
    if (!gstNumber) {
      setGstValidation(null);
      return;
    }

    try {
      const response = await authenticatedFetch('/api/invoices/validate-gst', {
        method: 'POST',
        body: JSON.stringify({ gstNumber })
      });

      const data = await response.json();
      if (data.success) {
        setGstValidation({
          isValid: data.data.isValid,
          message: data.data.isValid ? 'Valid GST number' : 'Invalid GST number format'
        });
      }
    } catch (error) {
      console.error('Failed to validate GST:', error);
    }
  };

  const handleCustomerChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setCustomer(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setCustomer(prev => ({
        ...prev,
        [field]: value
      }));

      // Validate GST number on change
      if (field === 'gstNumber') {
        validateGSTNumber(value);
      }
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([...items, {
      description: '',
      hsn: '',
      quantity: 0,
      unit: 'Nos',
      rate: 0,
      discount: 0
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      customer,
      items,
      dueDate: invoiceData.dueDate || undefined,
      notes: invoiceData.notes || undefined,
      terms: invoiceData.terms || undefined,
      invoiceType: invoiceData.invoiceType,
      enableBlockchainVerification: invoiceData.enableBlockchainVerification
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Calculate basic totals for display when API calculation is not available
  const getBasicCalculation = () => {
    const validItems = items.filter(item =>
      item.description.trim() &&
      item.quantity > 0 &&
      item.rate >= 0
    );

    if (validItems.length === 0) return null;

    const subtotal = validItems.reduce((sum, item) => {
      const itemTotal = item.quantity * item.rate;
      const discountAmount = (itemTotal * item.discount) / 100;
      return sum + (itemTotal - discountAmount);
    }, 0);

    return {
      subtotal,
      totalDiscount: validItems.reduce((sum, item) => {
        const itemTotal = item.quantity * item.rate;
        return sum + ((itemTotal * item.discount) / 100);
      }, 0),
      totalTax: 0, // Will be calculated by API
      grandTotal: subtotal,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0
    };
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
      {/* Invoice Type Selection */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Invoice Type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
            invoiceData.invoiceType === 'gst'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="invoiceType"
              value="gst"
              checked={invoiceData.invoiceType === 'gst'}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceType: e.target.value as 'gst' | 'non-gst' }))}
              className="sr-only"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                  invoiceData.invoiceType === 'gst'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {invoiceData.invoiceType === 'gst' && (
                    <div className="w-2 h-2 rounded-full bg-white mx-auto mt-0.5"></div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">GST Invoice</div>
                  <div className="text-sm text-gray-600">For GST registered businesses</div>
                </div>
              </div>
            </div>
          </label>

          <label className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
            invoiceData.invoiceType === 'non-gst'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="invoiceType"
              value="non-gst"
              checked={invoiceData.invoiceType === 'non-gst'}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceType: e.target.value as 'gst' | 'non-gst' }))}
              className="sr-only"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                  invoiceData.invoiceType === 'non-gst'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300'
                }`}>
                  {invoiceData.invoiceType === 'non-gst' && (
                    <div className="w-2 h-2 rounded-full bg-white mx-auto mt-0.5"></div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Simple Invoice</div>
                  <div className="text-sm text-gray-600">For freelancers & non-GST businesses</div>
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white lg:bg-transparent rounded-lg lg:rounded-none p-4 lg:p-0 border lg:border-0 border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Customer Information
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.name}
              onChange={(e) => handleCustomerChange('name', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.email}
              onChange={(e) => handleCustomerChange('email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Phone
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.phone}
              onChange={(e) => handleCustomerChange('phone', e.target.value)}
            />
          </div>

          {invoiceData.invoiceType === 'gst' && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                GST Number {invoiceData.invoiceType === 'gst' ? '*' : ''}
              </label>
              <input
                type="text"
                required={invoiceData.invoiceType === 'gst'}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${
                  gstValidation?.isValid === false ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="22AAAAA0000A1Z5"
                value={customer.gstNumber}
                onChange={(e) => handleCustomerChange('gstNumber', e.target.value.toUpperCase())}
              />
              {gstValidation && (
                <p className={`text-xs mt-1 ${gstValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {gstValidation.message}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Street Address *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.address.street}
              onChange={(e) => handleCustomerChange('address.street', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              City *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.address.city}
              onChange={(e) => handleCustomerChange('address.city', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              State {invoiceData.invoiceType === 'gst' ? '*' : ''}
            </label>
            <select
              required={invoiceData.invoiceType === 'gst'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.address.state}
              onChange={(e) => handleCustomerChange('address.state', e.target.value)}
            >
              <option value="">Select State</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {invoiceData.invoiceType === 'gst' && (
              <p className="text-xs text-gray-500 mt-1">Required for GST tax calculation</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Pincode *
            </label>
            <input
              type="text"
              required
              pattern="[1-9][0-9]{5}"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.address.pincode}
              onChange={(e) => handleCustomerChange('address.pincode', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Country
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={customer.address.country}
              onChange={(e) => handleCustomerChange('address.country', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      <div className="bg-white lg:bg-transparent rounded-lg lg:rounded-none p-4 lg:p-0 border lg:border-0 border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Invoice Items
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>

        <div className="space-y-4 lg:space-y-6">
          {items.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-4 lg:p-6 bg-gray-50 lg:bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-semibold text-gray-900 flex items-center">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold mr-2">
                    {index + 1}
                  </span>
                  Item {index + 1}
                </h3>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    HSN/SAC {invoiceData.invoiceType === 'gst' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    required={invoiceData.invoiceType === 'gst'}
                    list={`hsn-list-${index}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    value={item.hsn}
                    onChange={(e) => handleItemChange(index, 'hsn', e.target.value.toUpperCase())}
                    placeholder={invoiceData.invoiceType === 'gst' ? 'Required for GST' : 'Optional'}
                  />
                  {invoiceData.invoiceType === 'gst' && (
                    <datalist id={`hsn-list-${index}`}>
                      {hsnCodes.map(hsn => (
                        <option key={hsn.code} value={hsn.code}>
                          {hsn.code} - {hsn.description}
                        </option>
                      ))}
                    </datalist>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Unit *
                  </label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                  >
                    <option value="Nos">Nos</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Hrs">Hrs</option>
                    <option value="Days">Days</option>
                    <option value="Months">Months</option>
                    <option value="Years">Years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Rate (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    value={item.rate === 0 ? '' : item.rate}
                    onChange={(e) => handleItemChange(index, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    value={item.discount === 0 ? '' : item.discount}
                    onChange={(e) => handleItemChange(index, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Summary - Mobile-friendly positioning */}
      {(calculation || getBasicCalculation()) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10l-3-3h6l-3 3M9 17h6m-6-10h6" />
            </svg>
            Invoice Summary
          </h3>

          {/* Mobile-first layout */}
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-6">
            {(() => {
              const calc = calculation || getBasicCalculation();
              return (
                <>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-600 mb-1">Subtotal</div>
                    <div className="text-xl font-bold text-gray-900">{formatCurrency(calc?.subtotal || 0)}</div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-600 mb-1">Discount</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(calc?.totalDiscount || 0)}</div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-600 mb-1">Total Tax</div>
                    <div className="text-xl font-bold text-orange-600">
                      {formatCurrency(calc?.totalTax || 0)}
                      {!calculation && calc && (
                        <div className="text-xs text-gray-500 mt-1">Add customer state for tax calculation</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-indigo-200">
                    <div className="text-sm text-gray-600 mb-1">Grand Total</div>
                    <div className="text-2xl font-bold text-indigo-600">{formatCurrency(calc?.grandTotal || 0)}</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Tax breakdown */}
          {(() => {
            const calc = calculation || getBasicCalculation();
            return calc && calculation && (calc.totalCGST > 0 || calc.totalIGST > 0) && (
              <div className="mt-6 pt-4 border-t border-indigo-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Tax Breakdown</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calc.totalCGST > 0 && (
                    <>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-600">CGST</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(calc.totalCGST || 0)}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-600">SGST</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(calc.totalSGST || 0)}</div>
                      </div>
                    </>
                  )}
                  {calc.totalIGST > 0 && (
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-600">IGST</div>
                      <div className="font-semibold text-gray-900">{formatCurrency(calc.totalIGST || 0)}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Additional Information */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Due Date
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={invoiceData.dueDate}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Terms & Conditions
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={invoiceData.terms}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, terms: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Blockchain Verification Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 lg:p-6 border border-green-200">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-1">Blockchain Verification</h3>
                <p className="text-green-700 text-sm">
                  Secure your invoice with blockchain technology for enhanced trust and tamper-proof records.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={invoiceData.enableBlockchainVerification}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, enableBlockchainVerification: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {invoiceData.enableBlockchainVerification && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 text-sm text-green-700">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Blockchain verification enabled</span>
                </div>
                <ul className="mt-2 text-xs text-green-600 space-y-1">
                  <li>• Cryptographic hash will be generated for this invoice</li>
                  <li>• Invoice integrity will be verified on Polygon blockchain</li>
                  <li>• Tamper-proof record for enhanced customer trust</li>
                  <li>• Verification badge will be displayed on the invoice</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          <ul className="text-sm space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Invoice...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Invoice
            </>
          )}
        </button>
      </div>
    </form>
  );
}
