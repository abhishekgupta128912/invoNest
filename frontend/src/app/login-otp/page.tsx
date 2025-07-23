'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../contexts/AuthContext';
import { useRecaptchaContext } from '../../components/auth/RecaptchaProvider';
import { RecaptchaBadge } from '../../components/auth/RecaptchaProvider';
import { RECAPTCHA_ACTIONS } from '../../hooks/useRecaptcha';
import OTPInput from '../../components/auth/OTPInput';

function OTPLoginContent() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpId, setOtpId] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSubmitted, setOtpSubmitted] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateUser } = useAuth();
  const { executeRecaptcha, isLoaded: recaptchaLoaded } = useRecaptchaContext();

  useEffect(() => {
    // Get email from URL params if available
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Countdown for resend cooldown
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendOTP = async (emailAddress: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Execute reCAPTCHA v3
      const recaptchaToken = await executeRecaptcha(RECAPTCHA_ACTIONS.OTP_LOGIN);

      if (!recaptchaToken) {
        setError('Security verification failed. Please try again.');
        setLoading(false);
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/otp/send-login`;
      console.log('📧 Sending OTP to:', emailAddress);
      console.log('🌐 API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailAddress,
          recaptchaToken
        }),
      });

      console.log('📡 Send OTP Response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('📋 Send OTP Response data:', data);

      if (data.success) {
        setOtpId(data.data.otpId);
        setStep('otp');
        setSuccess('OTP sent successfully! Please check your email.');
        setResendCooldown(60); // 60 seconds cooldown
        setRemainingAttempts(null);
        setOtpSubmitted(false); // Reset for new OTP
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = useCallback(async (otp: string) => {
    if (loading || otpSubmitted) return; // Prevent multiple calls

    setOtpSubmitted(true);
    setLoading(true);
    setError('');

    try {
      // Execute reCAPTCHA v3
      const recaptchaToken = await executeRecaptcha(RECAPTCHA_ACTIONS.OTP_VERIFY);

      if (!recaptchaToken) {
        setError('Security verification failed. Please try again.');
        setLoading(false);
        setOtpSubmitted(false);
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/otp/verify-login`;
      console.log('🔐 Verifying OTP:', { email, otpLength: otp?.length });
      console.log('🌐 API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
          recaptchaToken
        }),
      });

      console.log('📡 Verify OTP Response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('📋 Verify OTP Response data:', JSON.stringify(data, null, 2));

      if (data.success) {
        // Store tokens and user data using the auth utility functions
        const { setTokens, setCurrentUser } = await import('../../lib/auth');
        setTokens(data.data.token, data.data.refreshToken, true);
        setCurrentUser(data.data.user);

        // Update auth context
        updateUser(data.data.user);

        // Redirect to dashboard
        router.push('/dashboard');
        return; // Don't reset otpSubmitted on success
      } else {
        setError(data.message || 'Invalid OTP');
        setRemainingAttempts(data.remainingAttempts || null);
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setOtpSubmitted(false); // Reset for retry
    }
  }, [email, loading, otpSubmitted, updateUser, router]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      sendOTP(email.trim());
    }
  };

  const handleResendOTP = () => {
    if (resendCooldown === 0) {
      sendOTP(email);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setError('');
    setSuccess('');
    setOtpId('');
    setRemainingAttempts(null);
    setOtpSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-gray-100">
              <div className="w-12 h-12 relative">
                <Image
                  src="/invologo.png"
                  alt="InvoNest Logo"
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                  priority
                />
              </div>
            </div>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">
            {step === 'email' ? 'Login with OTP' : 'Enter Verification Code'}
          </h2>
          <p className="mt-2 text-gray-800">
            {step === 'email'
              ? 'Enter your email to receive a secure login code'
              : `We've sent a 6-digit code to ${email}`
            }
          </p>
        </div>

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 bg-white placeholder-gray-500"
                placeholder="Enter your email address"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Sending OTP...
                </div>
              ) : (
                'Send OTP'
              )}
            </button>
          </form>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <div className="space-y-6">
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-700 text-sm">{success}</span>
                </div>
              </div>
            )}

            <OTPInput
              length={6}
              onComplete={verifyOTP}
              loading={loading}
              error={error}
              className="mb-6"
            />

            {remainingAttempts !== null && (
              <div className="text-center text-sm text-orange-600">
                {remainingAttempts} attempt(s) remaining
              </div>
            )}

            <div className="text-center space-y-4">
              <button
                onClick={handleResendOTP}
                disabled={resendCooldown > 0 || loading}
                className="text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resendCooldown > 0 
                  ? `Resend OTP in ${resendCooldown}s`
                  : 'Resend OTP'
                }
              </button>

              <div>
                <button
                  onClick={handleBackToEmail}
                  disabled={loading}
                  className="text-gray-800 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Change Email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-800">
            Don't have an account?{' '}
            <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign up
            </Link>
          </div>
          <div className="text-sm text-gray-800">
            Prefer password login?{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Login with password
            </Link>
          </div>

          {/* reCAPTCHA Badge */}
          <RecaptchaBadge className="text-center" />
        </div>
      </div>
    </div>
  );
}

export default function OTPLoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <OTPLoginContent />
    </Suspense>
  );
}
