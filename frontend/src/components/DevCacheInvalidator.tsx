'use client';

import { useEffect } from 'react';

export default function DevCacheInvalidator() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV === 'development') {
      // Force router cache invalidation
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister();
          }
        });
      }

      // Clear any cached data in localStorage that might affect UI
      if (typeof window !== 'undefined') {
        // Add timestamp to force re-renders
        const timestamp = Date.now();
        (window as any).__NEXT_CACHE_BUST__ = timestamp;
        
        // Force a hard refresh if the page has been cached for too long
        const lastRefresh = localStorage.getItem('lastHardRefresh');
        const now = Date.now();
        
        if (!lastRefresh || (now - parseInt(lastRefresh)) > 30000) { // 30 seconds
          localStorage.setItem('lastHardRefresh', now.toString());
          
          // Only do this if we detect stale content
          const currentPath = window.location.pathname;
          if (currentPath === '/' && document.querySelector('[data-cache-version]')) {
            const cacheVersion = document.querySelector('[data-cache-version]')?.getAttribute('data-cache-version');
            if (cacheVersion && parseInt(cacheVersion) < (now - 60000)) {
              console.log('🔄 Detected stale cache, forcing refresh...');
              window.location.reload();
            }
          }
        }
      }
    }
  }, []);

  // Add a cache version to the DOM for detection
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const timestamp = Date.now();
      document.documentElement.setAttribute('data-cache-version', timestamp.toString());
    }
  }, []);

  return null;
}
