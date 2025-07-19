import bcrypt from 'bcryptjs';

export interface AdminUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: 'admin';
  businessName: string;
  isEmailVerified: boolean;
  lastLogin: Date;
  createdAt: Date;
}

/**
 * Check if the provided credentials match the admin credentials from environment
 */
export const validateAdminCredentials = async (email: string, password: string): Promise<boolean> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('Admin credentials not configured in environment variables');
    return false;
  }

  // Check email match (case insensitive)
  if (email.toLowerCase() !== adminEmail.toLowerCase()) {
    return false;
  }

  // For admin, we can use direct password comparison or hash it
  // Using direct comparison for simplicity since it's stored in env
  return password === adminPassword;
};

/**
 * Create admin user object for JWT token and response
 */
export const createAdminUserObject = (): AdminUser => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@invonest.com';
  const adminName = process.env.ADMIN_NAME || 'InvoNest Admin';

  return {
    _id: 'admin-user-id', // Fixed ID for admin (MongoDB style)
    id: 'admin-user-id', // Fixed ID for admin
    name: adminName,
    email: adminEmail,
    role: 'admin',
    businessName: 'InvoNest Administration',
    isEmailVerified: true,
    lastLogin: new Date(),
    createdAt: new Date('2024-01-01') // Fixed creation date for admin
  };
};

/**
 * Check if a user ID belongs to the admin user
 */
export const isAdminUserId = (userId: string): boolean => {
  return userId === 'admin-user-id';
};
