'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../contexts/AuthContext';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
  actions?: React.ReactNode;
}

export default function MobileHeader({ 
  title, 
  showBack = false, 
  backHref = '/dashboard',
  actions 
}: MobileHeaderProps) {
  const { user } = useAuth();

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 safe-area-pt">
      <div className="flex items-center justify-between px-4 py-3 h-14">
        {/* Left Section */}
        <div className="flex items-center space-x-3 flex-1">
          {showBack ? (
            <Link
              href={backHref}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          ) : (
            <Link href="/">
              <div className="w-10 h-10 relative">
                <Image
                  src="/invologo.png"
                  alt="InvoNest Logo"
                  width={40}
                  height={40}
                  className="object-contain w-full h-full"
                  priority
                />
              </div>
            </Link>
          )}
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {actions}

          {/* Settings Icon */}
          {user && (
            <Link
              href="/dashboard/settings"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}

          {/* User Avatar */}
          {user && (
            <Link
              href="/dashboard/profile"
              className="flex items-center space-x-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title="Profile"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick Action Button Component
export function QuickActionButton({ 
  icon, 
  onClick, 
  className = '' 
}: { 
  icon: React.ReactNode; 
  onClick: () => void; 
  className?: string; 
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${className}`}
    >
      {icon}
    </button>
  );
}

// Notification Badge Component
export function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  
  return (
    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </div>
  );
}
