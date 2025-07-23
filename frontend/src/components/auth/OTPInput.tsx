'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

export default function OTPInput({
  length = 6,
  onComplete,
  loading = false,
  error = '',
  className = ''
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittedOtpRef = useRef<string>('');

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleComplete = useCallback((otpValue: string) => {
    if (submittedOtpRef.current === otpValue) {
      return; // Already submitted this OTP
    }
    submittedOtpRef.current = otpValue;
    onComplete(otpValue);
  }, [onComplete]);

  useEffect(() => {
    // Call onComplete when OTP is fully entered
    const otpValue = otp.join('');
    if (otpValue.length === length && !loading) {
      handleComplete(otpValue);
    }
  }, [otp, length, handleComplete, loading]);

  // Reset submitted OTP when error changes (indicating a failed attempt)
  useEffect(() => {
    if (error) {
      submittedOtpRef.current = '';
    }
  }, [error]);

  const handleChange = (value: string, index: number) => {
    // Only allow numeric input
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    
    // Handle paste
    if (value.length > 1) {
      const pastedData = value.slice(0, length);
      for (let i = 0; i < length; i++) {
        newOtp[i] = pastedData[i] || '';
      }
      setOtp(newOtp);
      
      // Focus last filled input or next empty input
      const lastFilledIndex = Math.min(pastedData.length - 1, length - 1);
      const nextIndex = pastedData.length < length ? pastedData.length : length - 1;
      setActiveIndex(nextIndex);
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex]?.focus();
      }
      return;
    }

    // Handle single character input
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < length - 1) {
      setActiveIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      
      if (otp[index]) {
        // Clear current input
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Move to previous input and clear it
        newOtp[index - 1] = '';
        setOtp(newOtp);
        setActiveIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      setActiveIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const otpValue = otp.join('');
      if (otpValue.length === length) {
        handleComplete(otpValue);
      }
    }
  };

  const handleFocus = (index: number) => {
    setActiveIndex(index);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < length; i++) {
        newOtp[i] = pastedData[i] || '';
      }
      setOtp(newOtp);
      
      // Focus appropriate input
      const nextIndex = Math.min(pastedData.length, length - 1);
      setActiveIndex(nextIndex);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const clearOTP = () => {
    setOtp(new Array(length).fill(''));
    setActiveIndex(0);
    submittedOtpRef.current = ''; // Reset submitted OTP
    inputRefs.current[0]?.focus();
  };

  return (
    <div className={`otp-input-container ${className}`}>
      <div className="flex justify-center space-x-3 mb-4">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={() => handleFocus(index)}
            onPaste={handlePaste}
            disabled={loading}
            className={`
              w-12 h-12 text-center text-xl font-bold border-2 rounded-lg
              transition-all duration-200 focus:outline-none text-gray-900 bg-white
              ${digit ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
              ${activeIndex === index ? 'ring-2 ring-indigo-500 ring-opacity-50' : ''}
              ${error ? 'border-red-500' : ''}
              ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-400'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label={`OTP digit ${index + 1}`}
          />
        ))}
      </div>

      {error && (
        <div className="text-red-600 text-sm text-center mb-4 flex items-center justify-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center">
          <div className="inline-flex items-center text-indigo-600">
            <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full mr-2"></div>
            <span className="text-sm">Verifying...</span>
          </div>
        </div>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={clearOTP}
          disabled={loading || otp.every(digit => !digit)}
          className="text-sm text-gray-800 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>

      <style jsx>{`
        .otp-input-container input::-webkit-outer-spin-button,
        .otp-input-container input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        .otp-input-container input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
