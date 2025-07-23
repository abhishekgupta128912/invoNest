'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useRecaptcha, getRecaptchaSiteKey, RecaptchaAction } from '../../hooks/useRecaptcha';

interface RecaptchaContextType {
  isLoaded: boolean;
  isLoading: boolean;
  executeRecaptcha: (action: RecaptchaAction) => Promise<string | null>;
  isRecaptchaEnabled: boolean;
}

const RecaptchaContext = createContext<RecaptchaContextType | undefined>(undefined);

interface RecaptchaProviderProps {
  children: ReactNode;
}

// Define pages where reCAPTCHA should be enabled
const RECAPTCHA_ENABLED_PAGES = [
  '/login',
  '/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/login-otp'
];

export const RecaptchaProvider: React.FC<RecaptchaProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const isRecaptchaEnabled = RECAPTCHA_ENABLED_PAGES.includes(pathname);

  const siteKey = getRecaptchaSiteKey();

  // Only initialize reCAPTCHA on enabled pages
  const { isLoaded, isLoading, executeRecaptcha: baseExecuteRecaptcha } = useRecaptcha({
    siteKey: isRecaptchaEnabled ? siteKey : '',
    action: 'init',
  });

  const executeRecaptcha = async (action: RecaptchaAction): Promise<string | null> => {
    // If reCAPTCHA is not enabled for this page, return null
    if (!isRecaptchaEnabled) {
      console.warn('reCAPTCHA is not enabled for this page');
      return null;
    }

    if (!isLoaded || !window.grecaptcha) {
      console.warn('reCAPTCHA not loaded yet');
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action });
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      return null;
    }
  };

  const value: RecaptchaContextType = {
    isLoaded: isRecaptchaEnabled ? isLoaded : false,
    isLoading: isRecaptchaEnabled ? isLoading : false,
    executeRecaptcha,
    isRecaptchaEnabled,
  };

  return (
    <RecaptchaContext.Provider value={value}>
      {children}
    </RecaptchaContext.Provider>
  );
};

export const useRecaptchaContext = (): RecaptchaContextType => {
  const context = useContext(RecaptchaContext);
  if (context === undefined) {
    throw new Error('useRecaptchaContext must be used within a RecaptchaProvider');
  }
  return context;
};

// Higher-order component to wrap forms with reCAPTCHA
export const withRecaptcha = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => (
    <RecaptchaProvider>
      <Component {...props} />
    </RecaptchaProvider>
  );
};

// Badge component to show reCAPTCHA branding (required by Google)
export const RecaptchaBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isRecaptchaEnabled } = useRecaptchaContext();

  // Only show the badge if reCAPTCHA is enabled for the current page
  if (!isRecaptchaEnabled) {
    return null;
  }

  return (
    <div className={`text-xs text-gray-500 mt-4 ${className}`}>
      This site is protected by reCAPTCHA and the Google{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      >
        Privacy Policy
      </a>{' '}
      and{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      >
        Terms of Service
      </a>{' '}
      apply.
    </div>
  );
};
