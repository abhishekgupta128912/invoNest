import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateToken = (user: IUser): string => {
  const payload: JWTPayload = {
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  // Use number for expiresIn to avoid TypeScript issues
  return jwt.sign(payload, secret, { expiresIn: 604800 }); // 7 days in seconds
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const generateRefreshToken = (user: IUser): string => {
  const payload = {
    userId: (user._id as any).toString(),
    type: 'refresh'
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  // Use number for expiresIn - 30 days in seconds
  return jwt.sign(payload, secret, { expiresIn: 2592000 });
};
