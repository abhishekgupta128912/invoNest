'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedRoute from '../auth/ProtectedRoute';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';


interface MobileDashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  backHref?: string;
  actions?: React.ReactNode;
  enablePullToRefresh?: boolean;
  onRefresh?: () => Promise<void>;
}

export default function MobileDashboardLayout({ 
  children, 
  title,
  showBack = false,
  backHref = '/dashboard',
  actions,
  enablePullToRefresh = false,
  onRefresh
}: MobileDashboardLayoutProps) {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enablePullToRefresh) return;
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enablePullToRefresh || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance * 0.5, 80));
    }
  };

  const handleTouchEnd = async () => {
    if (!enablePullToRefresh || isRefreshing) return;
    
    if (pullDistance > 60 && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 lg:hidden">
        {/* Mobile Header */}
        <MobileHeader 
          title={title}
          showBack={showBack}
          backHref={backHref}
          actions={actions}
        />

        {/* Main Content */}
        <main 
          className={`pt-14 pb-20 min-h-screen mobile-scroll ${enablePullToRefresh ? 'pull-to-refresh' : ''} ${isRefreshing ? 'refreshing' : ''}`}
          style={{ 
            transform: `translateY(${pullDistance}px)`,
            transition: pullDistance === 0 ? 'transform 0.3s ease' : 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="safe-area-inset">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

      </div>

      {/* Desktop Layout Fallback */}
      <div className="hidden lg:block">
        <div className="min-h-screen bg-gray-50">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>
            {children}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Mobile Card Component
export function MobileCard({ 
  children, 
  className = '', 
  onClick,
  swipeActions
}: { 
  children: React.ReactNode; 
  className?: string; 
  onClick?: () => void;
  swipeActions?: {
    left?: { icon: React.ReactNode; action: () => void; color?: string };
    right?: { icon: React.ReactNode; action: () => void; color?: string };
  };
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!swipeActions) return;
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeActions || !isDragging) return;

    const currentX = e.touches[0].clientX;
    const distance = currentX - startX;
    setSwipeX(Math.max(-120, Math.min(120, distance)));
  };

  const handleTouchEnd = () => {
    if (!swipeActions) return;

    if (swipeX > 60 && swipeActions.left) {
      swipeActions.left.action();
    } else if (swipeX < -60 && swipeActions.right) {
      swipeActions.right.action();
    }

    setSwipeX(0);
    setIsDragging(false);
  };

  return (
    <div className={`mobile-card ${swipeActions ? 'swipe-actions' : ''} ${className}`}>
      {swipeActions?.left && (
        <div className="swipe-actions-left" style={{ background: swipeActions.left.color || '#10b981' }}>
          {swipeActions.left.icon}
        </div>
      )}

      {swipeActions?.right && (
        <div className="swipe-actions-right" style={{ background: swipeActions.right.color || '#ef4444' }}>
          {swipeActions.right.icon}
        </div>
      )}

      <div
        className="swipe-content"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}

// Mobile Button Component
export function MobileButton({ 
  children, 
  variant = 'primary', 
  size = 'medium',
  className = '', 
  onClick,
  disabled = false,
  loading = false,
  ...props 
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  className?: string; 
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  [key: string]: any;
}) {
  const baseClasses = 'mobile-btn flex items-center justify-center font-semibold transition-all duration-200';
  
  const variantClasses = {
    primary: 'mobile-btn-primary',
    secondary: 'mobile-btn-secondary',
    outline: 'bg-transparent border-2 border-gray-300 text-gray-700 hover:border-gray-400'
  };
  
  const sizeClasses = {
    small: 'px-4 py-2 text-sm min-h-[36px]',
    medium: 'px-6 py-3 text-base min-h-[44px]',
    large: 'px-8 py-4 text-lg min-h-[52px]'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
}

// Mobile Input Component
export function MobileInput({ 
  label, 
  error, 
  className = '', 
  ...props 
}: { 
  label?: string; 
  error?: string; 
  className?: string; 
  [key: string]: any;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={`mobile-input w-full ${error ? 'border-red-500' : ''}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
