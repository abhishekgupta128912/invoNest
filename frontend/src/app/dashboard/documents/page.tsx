'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FileUpload from '../../../components/FileUpload';
import DashboardLayout from '../../../components/dashboard/DashboardLayout';
import { MobileCard, MobileButton, MobileInput } from '../../../components/mobile/MobileDashboardLayout';

interface Document {
  _id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  tags: string[];
  description?: string;
  parsedData?: {
    text?: string;
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
    invoiceData?: any;
    documentType?: string;
    confidence: number;
  };
  hash: string;
  isVerified: boolean;
  blockchainHash?: string;
  transactionId?: string;
  uploadedAt: string;
  downloadCount: number;
  sizeFormatted: string;
}

interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  avgSize: number;
  totalDownloads: number;
  categoryBreakdown: Record<string, number>;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const router = useRouter();

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'receipt', label: 'Receipts' },
    { value: 'tax_document', label: 'Tax Documents' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchDocuments();
    fetchStats();
  }, [selectedCategory, searchQuery]);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`http://localhost:5000/api/documents?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setDocuments(data.data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/documents/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();

      if (files.length === 1) {
        formData.append('document', files[0]);
        formData.append('category', 'other');
        formData.append('description', '');

        const response = await fetch('http://localhost:5000/api/documents/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        const data = await response.json();
        if (data.success) {
          await fetchDocuments();
          await fetchStats();
          setShowUpload(false);
        } else {
          alert('Upload failed: ' + data.message);
        }
      } else {
        // Multiple files
        files.forEach(file => formData.append('documents', file));
        formData.append('category', 'other');

        const response = await fetch('http://localhost:5000/api/documents/upload/multiple', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        const data = await response.json();
        if (data.success) {
          await fetchDocuments();
          await fetchStats();
          setShowUpload(false);
        } else {
          alert('Upload failed: ' + data.message);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/documents/${documentId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Refresh documents to update download count
        fetchDocuments();
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        await fetchDocuments();
        await fetchStats();
      } else {
        alert('Delete failed: ' + data.message);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('text')) return '📃';
    return '📁';
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchDocuments(), fetchStats()]);
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Documents"
        enablePullToRefresh={true}
        onRefresh={handleRefresh}
      >
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            <span className="text-lg text-gray-600">Loading Documents...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Documents"
      enablePullToRefresh={true}
      onRefresh={handleRefresh}
      actions={
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="lg:hidden p-2 text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </button>
      }
    >
      <div className="p-4 lg:p-8">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
              <p className="text-gray-600 mt-2">Upload, organize, and manage your business documents</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/dashboard"
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ← Back to Dashboard
              </Link>
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {showUpload ? 'Cancel Upload' : '📤 Upload Documents'}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Stats Cards */}
        {stats && (
          <div className="lg:hidden grid grid-cols-2 gap-4 mb-6">
            <MobileCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Documents</p>
                  <p className="text-lg font-bold text-gray-900">{stats.totalDocuments}</p>
                </div>
              </div>
            </MobileCard>

            <MobileCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Storage</p>
                  <p className="text-lg font-bold text-gray-900">{formatFileSize(stats.totalSize)}</p>
                </div>
              </div>
            </MobileCard>
          </div>
        )}

        {/* Desktop Stats Cards */}
        {stats && (
          <div className="hidden lg:grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Documents</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Downloads</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDownloads}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Storage Used</p>
                  <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.totalSize)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg File Size</p>
                  <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.avgSize)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Upload Section */}
        {showUpload && (
          <div className="lg:hidden mb-6">
            <MobileCard className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h2>
              <FileUpload
                onUpload={handleFileUpload}
                multiple={true}
                maxFiles={10}
                maxSize={50}
              />
              {uploading && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"></div>
                  <span className="text-gray-600">Uploading documents...</span>
                </div>
              )}
            </MobileCard>
          </div>
        )}

        {/* Desktop Upload Section */}
        {showUpload && (
          <div className="hidden lg:block bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents</h2>
            <FileUpload
              onUpload={handleFileUpload}
              multiple={true}
              maxFiles={10}
              maxSize={50}
            />
            {uploading && (
              <div className="mt-4 flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"></div>
                <span className="text-gray-600">Uploading documents...</span>
              </div>
            )}
          </div>
        )}

        {/* Mobile Filters and Search */}
        <div className="lg:hidden space-y-4 mb-6">
          <MobileInput
            label="Search Documents"
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search by name, description, or tags..."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mobile-input w-full"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Filters and Search */}
        <div className="hidden lg:block bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="form-label">
                Search Documents
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, description, or tags..."
                className="form-input"
              />
            </div>
            <div className="sm:w-48">
              <label htmlFor="category" className="form-label">
                Category
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-select"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Documents List */}
        <div className="lg:hidden space-y-4">
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by uploading your first document.
              </p>
              <div className="mt-6">
                <MobileButton onClick={() => setShowUpload(true)}>
                  📤 Upload Document
                </MobileButton>
              </div>
            </div>
          ) : (
            documents.map((document) => (
              <MobileCard
                key={document._id}
                swipeActions={{
                  left: {
                    icon: (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    ),
                    action: () => downloadDocument(document._id, document.originalName),
                    color: '#10b981'
                  },
                  right: {
                    icon: (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                    action: () => deleteDocument(document._id),
                    color: '#ef4444'
                  }
                }}
                className="mb-4"
              >
                <div className="p-4">
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl flex-shrink-0">
                      {getFileIcon(document.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                        {document.originalName}
                      </h3>

                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-gray-500">
                        {formatFileSize(document.size)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(document.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        document.category === 'invoice' ? 'bg-blue-100 text-blue-800' :
                        document.category === 'receipt' ? 'bg-green-100 text-green-800' :
                        document.category === 'tax_document' ? 'bg-purple-100 text-purple-800' :
                        document.category === 'compliance' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {document.category.replace('_', ' ')}
                      </span>

                      {document.isVerified && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          ✓ Verified
                        </span>
                      )}
                    </div>

                    {document.description && (
                      <p className="text-xs text-gray-600 mb-2">{document.description}</p>
                    )}

                    {document.parsedData && document.parsedData.confidence > 0.5 && (
                      <div className="p-2 bg-blue-50 rounded text-xs">
                        <span className="font-medium text-blue-800">
                          AI Parsed ({Math.round(document.parsedData.confidence * 100)}%)
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {document.downloadCount} downloads
                      </span>
                    </div>
                    </div>
                  </div>
                </div>
              </MobileCard>
            ))
          )}
        </div>

        {/* Desktop Documents List */}
        <div className="hidden lg:block bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Documents ({documents.length})
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by uploading your first document.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  📤 Upload Document
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {documents.map((document) => (
                <div key={document._id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">
                        {getFileIcon(document.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {document.originalName}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatFileSize(document.size)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(document.uploadedAt).toLocaleDateString()}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            document.category === 'invoice' ? 'bg-blue-100 text-blue-800' :
                            document.category === 'receipt' ? 'bg-green-100 text-green-800' :
                            document.category === 'tax_document' ? 'bg-purple-100 text-purple-800' :
                            document.category === 'compliance' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {document.category.replace('_', ' ')}
                          </span>
                          {document.isVerified && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        {document.description && (
                          <p className="text-sm text-gray-600 mt-1">{document.description}</p>
                        )}
                        {document.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {document.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {document.parsedData && document.parsedData.confidence > 0.5 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                            <span className="font-medium text-blue-800">
                              AI Parsed ({Math.round(document.parsedData.confidence * 100)}% confidence)
                            </span>
                            {document.parsedData.documentType && (
                              <span className="ml-2 text-blue-600">
                                Type: {document.parsedData.documentType}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {document.downloadCount} downloads
                      </span>
                      <button
                        onClick={() => downloadDocument(document._id, document.originalName)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        title="Download"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteDocument(document._id)}
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
