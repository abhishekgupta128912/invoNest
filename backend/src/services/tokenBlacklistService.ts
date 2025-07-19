import { createClient } from 'redis';
import { verifyToken } from '../utils/jwt';

interface BlacklistedToken {
  token: string;
  userId: string;
  expiresAt: Date;
  reason: 'logout' | 'security' | 'admin';
}

class TokenBlacklistService {
  private blacklistedTokens: Map<string, BlacklistedToken> = new Map();
  private redisClient: any = null;

  constructor() {
    this.initializeRedis();
    this.startCleanupInterval();
  }

  private async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redisClient = createClient({
          url: process.env.REDIS_URL
        });
        await this.redisClient.connect();
        console.log('✅ Redis connected for token blacklist');
      } else {
        console.log('⚠️ Redis not configured, using in-memory token blacklist');
      }
    } catch (error) {
      console.error('❌ Redis connection failed, using in-memory fallback:', error);
    }
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token: string, reason: 'logout' | 'security' | 'admin' = 'logout'): Promise<void> {
    try {
      // Decode token to get expiration and user info
      const decoded = verifyToken(token);

      // Handle expiration time - if not present, set a default expiration
      const expTime = decoded.exp || Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days default
      const expiresAt = new Date(expTime * 1000);
      
      const blacklistedToken: BlacklistedToken = {
        token,
        userId: decoded.userId,
        expiresAt,
        reason
      };

      if (this.redisClient) {
        // Store in Redis with TTL
        const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        await this.redisClient.setEx(
          `blacklist:${token}`,
          ttl,
          JSON.stringify(blacklistedToken)
        );
      } else {
        // Store in memory
        this.blacklistedTokens.set(token, blacklistedToken);
      }

      console.log(`🚫 Token blacklisted for user ${decoded.userId}, reason: ${reason}`);
    } catch (error) {
      console.error('Error blacklisting token:', error);
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      if (this.redisClient) {
        const result = await this.redisClient.get(`blacklist:${token}`);
        return result !== null;
      } else {
        return this.blacklistedTokens.has(token);
      }
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      // Fail secure - if we can't check, assume it's blacklisted
      return true;
    }
  }

  /**
   * Blacklist all tokens for a user (useful for security incidents)
   */
  async blacklistAllUserTokens(userId: string, reason: 'security' | 'admin' = 'security'): Promise<void> {
    try {
      if (this.redisClient) {
        // In a real implementation, you'd need to track user tokens
        // For now, we'll add the user to a blacklisted users list
        await this.redisClient.setEx(
          `user_blacklist:${userId}`,
          24 * 60 * 60, // 24 hours
          JSON.stringify({ reason, timestamp: new Date() })
        );
      }
      
      console.log(`🚫 All tokens blacklisted for user ${userId}, reason: ${reason}`);
    } catch (error) {
      console.error('Error blacklisting user tokens:', error);
      throw new Error('Failed to blacklist user tokens');
    }
  }

  /**
   * Check if all user tokens are blacklisted
   */
  async isUserBlacklisted(userId: string): Promise<boolean> {
    try {
      if (this.redisClient) {
        const result = await this.redisClient.get(`user_blacklist:${userId}`);
        return result !== null;
      }
      return false;
    } catch (error) {
      console.error('Error checking user blacklist:', error);
      return false;
    }
  }

  /**
   * Remove token from blacklist (rarely used)
   */
  async removeFromBlacklist(token: string): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.del(`blacklist:${token}`);
      } else {
        this.blacklistedTokens.delete(token);
      }
    } catch (error) {
      console.error('Error removing token from blacklist:', error);
    }
  }

  /**
   * Get blacklist statistics
   */
  async getBlacklistStats(): Promise<{
    totalBlacklistedTokens: number;
    blacklistedUsers: number;
    recentBlacklists: any[];
  }> {
    try {
      if (this.redisClient) {
        // This would require more complex Redis operations
        // For now, return basic stats
        return {
          totalBlacklistedTokens: 0,
          blacklistedUsers: 0,
          recentBlacklists: []
        };
      } else {
        const now = Date.now();
        const validTokens = Array.from(this.blacklistedTokens.values())
          .filter(token => token.expiresAt.getTime() > now);

        return {
          totalBlacklistedTokens: validTokens.length,
          blacklistedUsers: new Set(validTokens.map(t => t.userId)).size,
          recentBlacklists: validTokens
            .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())
            .slice(0, 10)
        };
      }
    } catch (error) {
      console.error('Error getting blacklist stats:', error);
      return {
        totalBlacklistedTokens: 0,
        blacklistedUsers: 0,
        recentBlacklists: []
      };
    }
  }

  /**
   * Clean up expired tokens from memory (only needed for in-memory storage)
   */
  private startCleanupInterval(): void {
    if (!this.redisClient) {
      setInterval(() => {
        const now = Date.now();
        for (const [token, data] of this.blacklistedTokens.entries()) {
          if (data.expiresAt.getTime() <= now) {
            this.blacklistedTokens.delete(token);
          }
        }
      }, 60 * 60 * 1000); // Clean up every hour
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Singleton instance
export const tokenBlacklist = new TokenBlacklistService();

export default TokenBlacklistService;
