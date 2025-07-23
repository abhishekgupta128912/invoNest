'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { updateProfile, authenticatedFetch } from '../../../lib/auth';
import DashboardLayout, { DashboardHeader } from '../../../components/dashboard/DashboardLayout';
import FileUpload from '../../../components/FileUpload';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState<any>({});
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        ...user,
        address: user.address || {
          street: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India'
        }
      });
      // Set logo preview if user has a logo
      if (user.logo) {
        // Handle both full paths and just filenames
        const logoPath = user.logo.includes('/') ? user.logo : `uploads/logos/${user.logo}`;
        setLogoPreview(`http://localhost:5000/${logoPath}`);
      }
      // Set signature preview if user has a signature
      if (user.signature) {
        // Handle both full paths and just filenames
        const signaturePath = user.signature.includes('/') ? user.signature : `uploads/signatures/${user.signature}`;
        setSignaturePreview(`http://localhost:5000/${signaturePath}`);
      }
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Handle nested address fields
    if (['street', 'city', 'state', 'pincode', 'country'].includes(name)) {
      setFormData((prev: any) => ({
        ...prev,
        address: {
          ...prev.address,
          [name]: value
        }
      }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleLogoUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setLogoUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/uploads/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Update form data with new logo path
        setFormData((prev: any) => ({ ...prev, logo: data.data.logoPath }));
        // Set preview
        setLogoPreview(`http://localhost:5000/${data.data.logoPath}`);
        // Update user context with new logo
        if (user) {
          updateUser({ ...user, logo: data.data.logoPath });
        }
        setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to upload logo' });
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload logo' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUploading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/uploads/logo', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setFormData((prev: any) => ({ ...prev, logo: null }));
        setLogoPreview(null);
        // Update user context to remove logo
        if (user) {
          updateUser({ ...user, logo: undefined });
        }
        setMessage({ type: 'success', text: 'Logo removed successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to remove logo' });
      }
    } catch (error) {
      console.error('Logo remove error:', error);
      setMessage({ type: 'error', text: 'Failed to remove logo' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSignatureUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setSignatureUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('signature', file);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/uploads/signature', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Update form data with new signature path
        setFormData((prev: any) => ({ ...prev, signature: data.data.signaturePath }));
        // Set preview
        setSignaturePreview(`http://localhost:5000/${data.data.signaturePath}`);
        // Update user context with new signature
        if (user) {
          updateUser({ ...user, signature: data.data.signaturePath });
        }
        setMessage({ type: 'success', text: 'Signature uploaded successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to upload signature' });
      }
    } catch (error) {
      console.error('Signature upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload signature' });
    } finally {
      setSignatureUploading(false);
    }
  };

  const handleRemoveSignature = async () => {
    setSignatureUploading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/uploads/signature', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setFormData((prev: any) => ({ ...prev, signature: null }));
        setSignaturePreview(null);
        // Update user context to remove signature
        if (user) {
          updateUser({ ...user, signature: undefined });
        }
        setMessage({ type: 'success', text: 'Signature removed successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to remove signature' });
      }
    } catch (error) {
      console.error('Signature remove error:', error);
      setMessage({ type: 'error', text: 'Failed to remove signature' });
    } finally {
      setSignatureUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Clean up the form data before sending
      const cleanFormData: any = {};

      // Only include non-empty fields
      if (formData.name?.trim()) {
        cleanFormData.name = formData.name.trim();
      }
      if (formData.businessName?.trim()) {
        cleanFormData.businessName = formData.businessName.trim();
      }
      if (formData.gstNumber?.trim()) {
        cleanFormData.gstNumber = formData.gstNumber.trim();
      }
      if (formData.phone?.trim()) {
        cleanFormData.phone = formData.phone.trim();
      }

      // Handle address separately
      const address: any = {};
      if (formData.address?.street?.trim()) {
        address.street = formData.address.street.trim();
      }
      if (formData.address?.city?.trim()) {
        address.city = formData.address.city.trim();
      }
      if (formData.address?.state?.trim()) {
        address.state = formData.address.state.trim();
      }
      if (formData.address?.pincode?.trim()) {
        address.pincode = formData.address.pincode.trim();
      }
      if (formData.address?.country?.trim()) {
        address.country = formData.address.country.trim();
      }

      // Only include address if it has at least one field
      if (Object.keys(address).length > 0) {
        cleanFormData.address = address;
      }

      // Include logo if it exists
      if (formData.logo) {
        cleanFormData.logo = formData.logo;
      }

      console.log('Sending profile data:', cleanFormData);
      const response = await updateProfile(cleanFormData);

      if (response.success && response.data) {
        updateUser(response.data.user);
        setEditing(false);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        console.error('Profile update failed:', response);
        const errorMessage = response.errors ? response.errors.join(', ') : response.message || 'Failed to update profile';
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        ...user,
        address: user.address || {
          street: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India'
        }
      });
    }
    setEditing(false);
    setMessage({ type: '', text: '' });
  };

  const sendVerificationEmail = async () => {
    setVerificationLoading(true);
    setVerificationMessage('');

    try {
      const response = await authenticatedFetch('/api/auth/send-verification', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        if (data.developmentToken) {
          // Development mode - show direct verification link
          const verificationUrl = `${window.location.origin}/verify-email?token=${data.developmentToken}`;
          setVerificationMessage(`development_link:${verificationUrl}`);
        } else {
          setVerificationMessage('Verification email sent! Please check your inbox.');
        }
      } else {
        setVerificationMessage(data.message || 'Failed to send verification email.');
      }
    } catch (error) {
      console.error('Send verification error:', error);
      setVerificationMessage('Network error. Please try again.');
    } finally {
      setVerificationLoading(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout title="Profile">
      <DashboardHeader
        title="Profile"
        subtitle="Manage your account information and business details"
        actions={
          <div className="flex items-center space-x-3">
            {editing && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2 inline-block"></div>
                  Saving...
                </>
              ) : editing ? 'Save Changes' : 'Edit Profile'}
            </button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Business Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-3xl font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{user.name}</h1>
              <p className="text-gray-800 mt-1">{user.email}</p>
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-2 sm:space-y-0 sm:space-x-3 mt-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {user.isEmailVerified ? '✓ Email Verified' : '⚠ Email Not Verified'}
                </span>
                {!user.isEmailVerified && (
                  <button
                    onClick={sendVerificationEmail}
                    disabled={verificationLoading}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {verificationLoading ? (
                      <>
                        <div className="animate-spin h-3 w-3 border border-indigo-600 border-t-transparent rounded-full mr-1"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Verify Email
                      </>
                    )}
                  </button>
                )}
              </div>
              {verificationMessage && (
                <div className={`mt-2 p-2 rounded-md text-xs ${
                  verificationMessage.includes('sent') || verificationMessage.includes('development_link')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {verificationMessage.startsWith('development_link:') ? (
                    <div>
                      <p className="mb-2">📧 Email service not configured (Development Mode)</p>
                      <a
                        href={verificationMessage.replace('development_link:', '')}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Click to Verify Email
                      </a>
                    </div>
                  ) : (
                    verificationMessage
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Personal Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter your phone number"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>
            </div>

            {/* Business Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Business Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Business Name</label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter your business name"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">GST Number</label>
                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter GST number (optional)"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              {/* Business Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Business Logo</label>
                {logoPreview ? (
                  <div className="space-y-3">
                    <div className="w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img
                        src={logoPreview}
                        alt="Business Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {editing && (
                      <div className="flex space-x-2">
                        <FileUpload
                          onUpload={handleLogoUpload}
                          accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                          maxSize={5}
                          maxFiles={1}
                          className="flex-1"
                        />
                        <button
                          onClick={handleRemoveLogo}
                          disabled={logoUploading}
                          className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {logoUploading ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-gray-500">No logo</p>
                      </div>
                    </div>
                    {editing && (
                      <FileUpload
                        onUpload={handleLogoUpload}
                        accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                        maxSize={5}
                        maxFiles={1}
                        className="w-full"
                      />
                    )}
                  </div>
                )}
                {logoUploading && (
                  <div className="mt-2 flex items-center text-sm text-gray-600">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full mr-2"></div>
                    Uploading logo...
                  </div>
                )}
              </div>

              {/* Digital Signature */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Digital Signature</label>
                <p className="text-xs text-gray-500 mb-3">Upload your signature to automatically include it in invoices</p>
                {signaturePreview ? (
                  <div className="space-y-3">
                    <div className="w-48 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img
                        src={signaturePreview}
                        alt="Digital Signature"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {editing && (
                      <div className="flex space-x-2">
                        <FileUpload
                          onUpload={handleSignatureUpload}
                          accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                          maxSize={5}
                          maxFiles={1}
                          className="flex-1"
                        />
                        <button
                          onClick={handleRemoveSignature}
                          disabled={signatureUploading}
                          className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {signatureUploading ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-48 h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <p className="text-xs text-gray-500">No signature</p>
                      </div>
                    </div>
                    {editing && (
                      <FileUpload
                        onUpload={handleSignatureUpload}
                        accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                        maxSize={5}
                        maxFiles={1}
                        className="w-full"
                      />
                    )}
                  </div>
                )}
                {signatureUploading && (
                  <div className="mt-2 flex items-center text-sm text-gray-600">
                    <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full mr-2"></div>
                    Uploading signature...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Address Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-800 mb-2">Street Address</label>
                <textarea
                  name="street"
                  value={formData.address?.street || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter your street address"
                  rows={3}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.address?.city || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter city"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.address?.state || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter state"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">PIN Code</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.address?.pincode || ''}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter PIN code"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.address?.country || 'India'}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="Enter country"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${!editing ? 'bg-gray-50' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Mobile Save Button */}
          {editing && (
            <div className="lg:hidden mt-6 flex space-x-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2 inline-block"></div>
                    Saving...
                  </>
                ) : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* Account Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-800">Account Type</span>
              <span className="text-sm text-gray-900 capitalize">{user.role}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-800">Member Since</span>
              <span className="text-sm text-gray-900">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-800">Last Login</span>
              <span className="text-sm text-gray-900">
                {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-IN') : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-800">Email Status</span>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {user.isEmailVerified ? 'Verified' : 'Not Verified'}
                </span>
                {!user.isEmailVerified && (
                  <button
                    onClick={sendVerificationEmail}
                    disabled={verificationLoading}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                  >
                    {verificationLoading ? 'Sending...' : 'Send Verification'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
