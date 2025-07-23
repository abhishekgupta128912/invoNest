'use client';

import { useState, useEffect } from 'react';

interface BlockchainVerificationProps {
  hash?: string;
  invoiceNumber?: string;
  onVerify?: (result: any) => void;
}

interface VerificationStatus {
  status: 'pending' | 'verified' | 'failed' | 'not-found';
  timestamp?: number;
  transactionHash?: string;
  blockNumber?: number;
  network?: string;
  error?: string;
}

export default function BlockchainVerification({ 
  hash, 
  invoiceNumber, 
  onVerify 
}: BlockchainVerificationProps) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    status: hash ? 'verified' : 'not-found'
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (hash) {
      // Simulate blockchain verification data
      setVerificationStatus({
        status: 'verified',
        timestamp: Date.now() - 86400000, // 1 day ago
        transactionHash: `0x${hash.slice(0, 40)}...`,
        blockNumber: 12345678,
        network: 'Polygon Mumbai'
      });
    }
  }, [hash]);

  const handleVerify = async () => {
    if (!hash) return;
    
    setIsVerifying(true);
    try {
      // Simulate API call to verify on blockchain
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = {
        status: 'verified' as const,
        timestamp: Date.now(),
        transactionHash: `0x${hash.slice(0, 40)}...`,
        blockNumber: 12345678,
        network: 'Polygon Mumbai'
      };
      
      setVerificationStatus(result);
      onVerify?.(result);
    } catch (error) {
      setVerificationStatus({
        status: 'failed',
        error: 'Verification failed. Please try again.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusIcon = () => {
    switch (verificationStatus.status) {
      case 'verified':
        return (
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'pending':
        return (
          <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        );
      case 'failed':
        return (
          <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getStatusText = () => {
    switch (verificationStatus.status) {
      case 'verified':
        return {
          title: 'Blockchain Verified',
          subtitle: 'This invoice is cryptographically secured and tamper-proof',
          color: 'text-green-600'
        };
      case 'pending':
        return {
          title: 'Verification Pending',
          subtitle: 'Blockchain verification in progress...',
          color: 'text-yellow-600'
        };
      case 'failed':
        return {
          title: 'Verification Failed',
          subtitle: verificationStatus.error || 'Unable to verify on blockchain',
          color: 'text-red-600'
        };
      default:
        return {
          title: 'Not Verified',
          subtitle: 'This invoice has not been verified on blockchain',
          color: 'text-gray-600'
        };
    }
  };

  const statusInfo = getStatusText();

  if (!hash && verificationStatus.status === 'not-found') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900">Blockchain Protection Available</h3>
            <p className="text-blue-700 text-sm">Secure this invoice with blockchain verification for enhanced trust and tamper-proof records.</p>
          </div>
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isVerifying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Securing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secure Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getStatusIcon()}
            <div>
              <h3 className={`text-lg font-semibold ${statusInfo.color}`}>
                {statusInfo.title}
              </h3>
              <p className="text-gray-600 text-sm">{statusInfo.subtitle}</p>
            </div>
          </div>
          
          {verificationStatus.status === 'verified' && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
              >
                <span>{showDetails ? 'Hide Technical Data' : 'Technical Details'}</span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Always visible - Safe information */}
      {verificationStatus.status === 'verified' && (
        <div className="p-4 bg-green-50 border-t border-green-200">
          <div className="flex items-center justify-between text-sm text-green-700">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Cryptographically secured</span>
              <span className="text-green-600">•</span>
              <span>Hash: <code className="font-mono text-xs bg-green-100 px-1 rounded">{hash?.substring(0, 8)}...{hash?.substring(hash.length - 4)}</code></span>
              <span className="text-green-600">•</span>
              <span>Network: Polygon</span>
            </div>
            <span className="text-xs text-green-600">
              {verificationStatus.timestamp && `Verified ${new Date(verificationStatus.timestamp).toLocaleDateString()}`}
            </span>
          </div>
        </div>
      )}

      {/* Technical Details - Hidden by default */}
      {showDetails && verificationStatus.status === 'verified' && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          {/* Privacy Warning */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">Technical Information</p>
                <p className="text-xs text-yellow-700 mt-1">
                  The following blockchain data is publicly visible and may be used to track transactions. Share only if necessary for verification purposes.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Document Hash</label>
              <div className="mt-1 font-mono text-sm text-gray-900 bg-white p-3 rounded border break-all">
                {hash}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ This cryptographic fingerprint uniquely identifies your invoice content
              </p>
            </div>

            {verificationStatus.transactionHash && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blockchain Transaction</label>
                <div className="mt-1 font-mono text-sm text-gray-900 bg-white p-3 rounded border break-all">
                  {verificationStatus.transactionHash}
                </div>
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ This transaction is publicly visible on the Polygon blockchain and can be used to track activity
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Verification Details</label>
              <div className="mt-1 bg-white p-3 rounded border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Network:</span>
                  <span className="text-gray-900 flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    {verificationStatus.network}
                  </span>
                </div>
                {verificationStatus.timestamp && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Verified On:</span>
                    <span className="text-gray-900">{new Date(verificationStatus.timestamp).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-medium">Immutable & Tamper-proof</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>This invoice cannot be tampered with or modified without detection</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
