import ApiKey from '../models/ApiKey';
// import { Redis } from 'ioredis';

export interface CreateApiKeyData {
  userId: string;
  name: string;
  permissions?: {
    invoices?: {
      read?: boolean;
      create?: boolean;
      update?: boolean;
      delete?: boolean;
    };
    customers?: {
      read?: boolean;
      create?: boolean;
      update?: boolean;
      delete?: boolean;
    };
    documents?: {
      read?: boolean;
      create?: boolean;
    };
  };
  expiresAt?: Date;
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };
}

export class ApiKeyService {
  private redis?: any;

  constructor() {
    // Initialize Redis for rate limiting if available
    if (process.env.REDIS_URL) {
      try {
        // this.redis = new Redis(process.env.REDIS_URL);
        console.warn('Redis not available for API rate limiting');
      } catch (error) {
        console.warn('Redis not available for API rate limiting');
      }
    }
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: CreateApiKeyData): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const { userId, name, permissions, expiresAt, rateLimit } = data;

      // Check if user already has maximum number of API keys (limit to 10)
      const existingKeys = await ApiKey.find({ userId, isActive: true });
      if (existingKeys.length >= 10) {
        return {
          success: false,
          message: 'Maximum number of API keys (10) reached'
        };
      }

      // Check for duplicate names
      const duplicateName = await ApiKey.findOne({ userId, name, isActive: true });
      if (duplicateName) {
        return {
          success: false,
          message: 'API key with this name already exists'
        };
      }

      // Create new API key
      const apiKey = new ApiKey({
        userId,
        name,
        permissions: {
          invoices: {
            read: permissions?.invoices?.read ?? true,
            create: permissions?.invoices?.create ?? false,
            update: permissions?.invoices?.update ?? false,
            delete: permissions?.invoices?.delete ?? false
          },
          customers: {
            read: permissions?.customers?.read ?? true,
            create: permissions?.customers?.create ?? false,
            update: permissions?.customers?.update ?? false,
            delete: permissions?.customers?.delete ?? false
          },
          documents: {
            read: permissions?.documents?.read ?? true,
            create: permissions?.documents?.create ?? false
          }
        },
        expiresAt,
        rateLimit: {
          requestsPerMinute: rateLimit?.requestsPerMinute ?? 60,
          requestsPerHour: rateLimit?.requestsPerHour ?? 1000,
          requestsPerDay: rateLimit?.requestsPerDay ?? 10000
        }
      });

      // Generate the key
      const { keyId, apiKey: generatedKey } = apiKey.generateKey();
      await apiKey.save();

      return {
        success: true,
        message: 'API key created successfully',
        data: {
          id: apiKey._id,
          keyId,
          apiKey: generatedKey, // Only returned once during creation
          name: apiKey.name,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt
        }
      };
    } catch (error) {
      console.error('Error creating API key:', error);
      return {
        success: false,
        message: 'Failed to create API key'
      };
    }
  }

  /**
   * Get user's API keys
   */
  async getUserApiKeys(userId: string): Promise<any[]> {
    try {
      const apiKeys = await ApiKey.find({ userId, isActive: true })
        .select('-hashedKey')
        .sort({ createdAt: -1 });

      return apiKeys.map(key => ({
        id: key._id,
        keyId: key.keyId,
        name: key.name,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt
      }));
    } catch (error) {
      console.error('Error getting user API keys:', error);
      return [];
    }
  }

  /**
   * Update API key
   */
  async updateApiKey(
    userId: string, 
    keyId: string, 
    updates: Partial<CreateApiKeyData>
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const apiKey = await ApiKey.findOne({ userId, _id: keyId, isActive: true });
      
      if (!apiKey) {
        return {
          success: false,
          message: 'API key not found'
        };
      }

      // Update fields
      if (updates.name) {
        // Check for duplicate names
        const duplicateName = await ApiKey.findOne({ 
          userId, 
          name: updates.name, 
          isActive: true,
          _id: { $ne: keyId }
        });
        
        if (duplicateName) {
          return {
            success: false,
            message: 'API key with this name already exists'
          };
        }
        
        apiKey.name = updates.name;
      }

      if (updates.permissions) {
        // Merge permissions properly to maintain required structure
        const newPermissions = { ...apiKey.permissions };
        if (updates.permissions.invoices) {
          newPermissions.invoices = { ...newPermissions.invoices, ...updates.permissions.invoices };
        }
        if (updates.permissions.customers) {
          newPermissions.customers = { ...newPermissions.customers, ...updates.permissions.customers };
        }
        if (updates.permissions.documents) {
          newPermissions.documents = { ...newPermissions.documents, ...updates.permissions.documents };
        }
        apiKey.permissions = newPermissions;
      }

      if (updates.rateLimit) {
        apiKey.rateLimit = { ...apiKey.rateLimit, ...updates.rateLimit };
      }

      if (updates.expiresAt) {
        apiKey.expiresAt = updates.expiresAt;
      }

      await apiKey.save();

      return {
        success: true,
        message: 'API key updated successfully',
        data: {
          id: apiKey._id,
          keyId: apiKey.keyId,
          name: apiKey.name,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt
        }
      };
    } catch (error) {
      console.error('Error updating API key:', error);
      return {
        success: false,
        message: 'Failed to update API key'
      };
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(userId: string, keyId: string): Promise<{ success: boolean; message: string }> {
    try {
      const apiKey = await ApiKey.findOne({ userId, _id: keyId, isActive: true });
      
      if (!apiKey) {
        return {
          success: false,
          message: 'API key not found'
        };
      }

      apiKey.isActive = false;
      await apiKey.save();

      return {
        success: true,
        message: 'API key deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting API key:', error);
      return {
        success: false,
        message: 'Failed to delete API key'
      };
    }
  }

  /**
   * Verify API key and check permissions
   */
  async verifyApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string; permissions?: any; keyId?: string }> {
    try {
      const key = await (ApiKey as any).findByKey(apiKey);
      
      if (!key) {
        return { valid: false };
      }

      // Check if key is expired
      if (key.expiresAt && new Date() > key.expiresAt) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: key.userId.toString(),
        permissions: key.permissions,
        keyId: key.keyId
      };
    } catch (error) {
      console.error('Error verifying API key:', error);
      return { valid: false };
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(keyId: string, rateLimit: any): Promise<{ allowed: boolean; remaining?: number }> {
    if (!this.redis) {
      // If Redis is not available, allow all requests
      return { allowed: true };
    }

    try {
      const now = Date.now();
      const minute = Math.floor(now / 60000);
      const hour = Math.floor(now / 3600000);
      const day = Math.floor(now / 86400000);

      const minuteKey = `rate_limit:${keyId}:minute:${minute}`;
      const hourKey = `rate_limit:${keyId}:hour:${hour}`;
      const dayKey = `rate_limit:${keyId}:day:${day}`;

      // Get current counts
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.redis.get(minuteKey),
        this.redis.get(hourKey),
        this.redis.get(dayKey)
      ]);

      const currentMinute = parseInt(minuteCount || '0');
      const currentHour = parseInt(hourCount || '0');
      const currentDay = parseInt(dayCount || '0');

      // Check limits
      if (currentMinute >= rateLimit.requestsPerMinute ||
          currentHour >= rateLimit.requestsPerHour ||
          currentDay >= rateLimit.requestsPerDay) {
        return { allowed: false };
      }

      // Increment counters
      const pipeline = this.redis.pipeline();
      pipeline.incr(minuteKey);
      pipeline.expire(minuteKey, 60);
      pipeline.incr(hourKey);
      pipeline.expire(hourKey, 3600);
      pipeline.incr(dayKey);
      pipeline.expire(dayKey, 86400);
      await pipeline.exec();

      return {
        allowed: true,
        remaining: Math.min(
          rateLimit.requestsPerMinute - currentMinute - 1,
          rateLimit.requestsPerHour - currentHour - 1,
          rateLimit.requestsPerDay - currentDay - 1
        )
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // If Redis fails, allow the request
      return { allowed: true };
    }
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(userId: string, keyId?: string): Promise<any> {
    try {
      const query: any = { userId, isActive: true };
      if (keyId) {
        query._id = keyId;
      }

      const apiKeys = await ApiKey.find(query);
      
      const stats = {
        totalKeys: apiKeys.length,
        totalUsage: apiKeys.reduce((sum, key) => sum + key.usageCount, 0),
        activeKeys: apiKeys.filter(key => key.lastUsed && 
          new Date(key.lastUsed).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
        ).length,
        keyStats: apiKeys.map(key => ({
          id: key._id,
          keyId: key.keyId,
          name: key.name,
          usageCount: key.usageCount,
          lastUsed: key.lastUsed,
          createdAt: key.createdAt
        }))
      };

      return stats;
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }
}

export default ApiKeyService;
