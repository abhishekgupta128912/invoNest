'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

interface RecaptchaConfig {
  siteKey: string;
  action: string;
}

export const useRecaptcha = (config: RecaptchaConfig) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If no site key is provided, don't load reCAPTCHA
    if (!config.siteKey) {
      setIsLoaded(false);
      return;
    }

    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha && window.grecaptcha.ready) {
      setIsLoaded(true);
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${config.siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.grecaptcha.ready(() => {
        setIsLoaded(true);
      });
    };

    script.onerror = () => {
      console.error('Failed to load reCAPTCHA script');
      setIsLoaded(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script if component unmounts
      const existingScript = document.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [config.siteKey]);

  const executeRecaptcha = async (): Promise<string | null> => {
    if (!isLoaded || !window.grecaptcha) {
      console.warn('reCAPTCHA not loaded yet');
      return null;
    }

    setIsLoading(true);

    try {
      const token = await window.grecaptcha.execute(config.siteKey, {
        action: config.action,
      });
      
      setIsLoading(false);
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      setIsLoading(false);
      return null;
    }
  };

  return {
    isLoaded,
    isLoading,
    executeRecaptcha,
  };
};

// Utility function to get reCAPTCHA site key from environment
export const getRecaptchaSiteKey = (): string => {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    console.warn('NEXT_PUBLIC_RECAPTCHA_SITE_KEY not found in environment variables');
    return '';
  }
  return siteKey;
};

// Common reCAPTCHA actions for authentication forms only
export const RECAPTCHA_ACTIONS = {
  LOGIN: 'login',
  REGISTER: 'register',
  FORGOT_PASSWORD: 'forgot_password',
  OTP_LOGIN: 'otp_login',
  OTP_VERIFY: 'otp_verify',
} as const;

export type RecaptchaAction = typeof RECAPTCHA_ACTIONS[keyof typeof RECAPTCHA_ACTIONS];
