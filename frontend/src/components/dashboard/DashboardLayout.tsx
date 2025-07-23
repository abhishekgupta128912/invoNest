'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedRoute from '../auth/ProtectedRoute';
import MobileDashboardLayout from '../mobile/MobileDashboardLayout';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  actions?: React.ReactNode;
  enablePullToRefresh?: boolean;
  onRefresh?: () => Promise<void>;
}

export default function DashboardLayout({
  children,
  title,
  showBack = false,
  backHref = '/dashboard',
  actions,
  enablePullToRefresh = false,
  onRefresh
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Remove unwanted floating elements
  useEffect(() => {
    const removeFloatingElements = () => {
      // Target high z-index elements that might be browser extensions
      const highZIndexElements = document.querySelectorAll('div[style*="z-index: 2147483647"], div[style*="z-index: 999999"]');
      highZIndexElements.forEach(element => {
        const isOurComponent = element.closest('[class*="dashboard"]') ||
                              element.closest('[class*="chat"]') ||
                              element.closest('[class*="mobile"]') ||
                              element.id?.includes('dashboard') ||
                              element.className?.includes('dashboard');

        if (!isOurComponent) {
          (element as HTMLElement).style.display = 'none';
        }
      });

      // Remove Next.js development toasts and overlays
      const nextjsElements = document.querySelectorAll('[data-nextjs-toast], [data-nextjs-toast-wrapper]');
      nextjsElements.forEach(element => {
        (element as HTMLElement).style.display = 'none';
      });

      // Remove any floating circular avatars that aren't part of our app
      const floatingElements = document.querySelectorAll('div[style*="position: fixed"]');
      floatingElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasCircularStyle = style.includes('border-radius: 50%') ||
                                style.includes('border-radius:50%') ||
                                element.querySelector('[style*="border-radius: 50%"]');

        // Check if it's not one of our components
        const isOurComponent = element.closest('[class*="dashboard"]') ||
                              element.closest('[class*="chat"]') ||
                              element.closest('[class*="mobile"]') ||
                              element.id?.includes('invoNest') ||
                              element.className?.includes('invoNest');

        if (hasCircularStyle && !isOurComponent) {
          (element as HTMLElement).style.display = 'none';
        }
      });
    };

    // Run immediately and then periodically
    removeFloatingElements();
    const interval = setInterval(removeFloatingElements, 2000);

    return () => clearInterval(interval);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { name: 'Invoices', href: '/dashboard/invoices', icon: '🧾' },
    { name: 'Create Invoice', href: '/dashboard/invoices/create', icon: '➕' },
    { name: 'Documents', href: '/dashboard/documents', icon: '📁' },
    { name: 'Compliance', href: '/dashboard/compliance', icon: '📅' },
    { name: 'Notifications', href: '/dashboard/notifications', icon: '🔔' },
    { name: 'Subscription', href: '/dashboard/subscription', icon: '💳' },
    { name: 'Profile', href: '/dashboard/profile', icon: '👤' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  // Use mobile layout on mobile devices
  if (isMobile) {
    return (
      <MobileDashboardLayout
        title={title || 'Dashboard'}
        showBack={showBack}
        backHref={backHref}
        actions={actions}
        enablePullToRefresh={enablePullToRefresh}
        onRefresh={onRefresh}
      >
        {children}
      </MobileDashboardLayout>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Fixed Mobile Navigation Bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-700 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
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
            <h1 className="text-sm font-semibold text-gray-900 truncate max-w-24">
              {title || 'Dashboard'}
            </h1>
          </div>
        </div>

        {/* Fixed Left Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-gray-200 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-gray-200 bg-white">
            <Link href="/" className="group flex items-center space-x-3">
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
              <span className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                InvoNest
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-600 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 chat-sidebar-scroll">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)} // Close mobile sidebar on navigation
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-200'
                          : 'text-gray-800 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }`}
                    >
                      <span className="mr-3 text-lg">{item.icon}</span>
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Profile Section */}
          {user && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-700 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
          <main className="h-full overflow-y-auto">
            <div className="p-4 lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Header component for dashboard pages
export function DashboardHeader({ 
  title, 
  subtitle, 
  actions 
}: { 
  title: string; 
  subtitle?: string; 
  actions?: React.ReactNode; 
}) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-700">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// Stats card component
export function StatsCard({ 
  title, 
  value, 
  icon, 
  color = 'indigo',
  subtitle,
  trend 
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  subtitle?: string;
  trend?: { value: number; label: string; positive: boolean };
}) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-700 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center mt-2">
              <span className={`text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.positive ? '↗' : '↘'} {trend.value}%
              </span>
              <span className="text-xs text-gray-500 ml-1">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`w-14 h-14 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
