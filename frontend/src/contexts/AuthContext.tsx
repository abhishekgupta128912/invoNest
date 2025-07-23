'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  login as apiLogin, 
  register as apiRegister, 
  logout as apiLogout,
  getProfile,
  getCurrentUser,
  isAuthenticated,
  removeTokens,
  setTokens,
  setCurrentUser,
  LoginData,
  RegisterData,
  AuthResponse
} from '../lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (data: LoginData, remember?: boolean) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isAuthenticated()) {
          // Try to get user from localStorage first
          const cachedUser = getCurrentUser();
          if (cachedUser) {
            setUser(cachedUser);
          }
          
          // Then refresh from server
          const freshUser = await getProfile();
          if (freshUser) {
            setUser(freshUser);
          } else {
            // Token might be expired, clear auth state
            removeTokens();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        removeTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (data: LoginData, remember: boolean = false): Promise<AuthResponse> => {
    try {
      const response = await apiLogin(data);
      
      if (response.success && response.data) {
        setTokens(response.data.token, response.data.refreshToken, remember);
        setCurrentUser(response.data.user);
        setUser(response.data.user);
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred during login.',
      };
    }
  };

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await apiRegister(data);
      
      if (response.success && response.data) {
        setTokens(response.data.token, response.data.refreshToken, true);
        setCurrentUser(response.data.user);
        setUser(response.data.user);
      }
      
      return response;
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred during registration.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const updateUser = (updatedUser: User): void => {
    setUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const freshUser = await getProfile();
      if (freshUser) {
        setUser(freshUser);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isLoggedIn: !!user,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> => {
  const AuthenticatedComponent: React.FC<P> = (props) => {
    const { isLoggedIn, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isLoggedIn) {
        router.push('/login');
      }
    }, [isLoggedIn, loading, router]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    if (!isLoggedIn) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return AuthenticatedComponent;
};

// Hook for protected routes
export const useRequireAuth = () => {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, loading, router]);

  return { isLoggedIn, loading };
};
