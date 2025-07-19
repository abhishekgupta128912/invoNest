import axios from 'axios';

interface UPIValidationResult {
  isValid: boolean;
  exists?: boolean;
  accountName?: string;
  error?: string;
  provider?: string;
}

export class UPIValidationService {
  
  /**
   * Validate UPI ID format
   */
  static validateUPIFormat(upiId: string): boolean {
    if (!upiId || typeof upiId !== 'string') {
      return false;
    }

    // Basic UPI ID format validation
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    
    if (!upiRegex.test(upiId)) {
      return false;
    }

    // Check for valid UPI providers
    const validProviders = [
      'paytm', 'phonepe', 'ybl', 'oksbi', 'okaxis', 'okicici', 'okhdfcbank',
      'okbizaxis', 'ibl', 'axl', 'apl', 'allbank', 'andb', 'barodampay',
      'cnrb', 'cbin', 'corp', 'cosb', 'dcb', 'federal', 'hdfcbank',
      'icici', 'idbi', 'idfc', 'indianbank', 'indus', 'iob', 'jkb',
      'karb', 'kvb', 'mahb', 'obc', 'payzapp', 'pingpay', 'pnb',
      'psb', 'rajgovhb', 'sbi', 'scb', 'srcb', 'synb', 'tjsb',
      'uco', 'unionbank', 'united', 'vijb', 'yesg', 'jupiteraxis'
    ];

    const provider = upiId.split('@')[1]?.toLowerCase();
    return validProviders.includes(provider);
  }

  /**
   * Enhanced UPI ID validation with existence check
   * Note: This is a mock implementation as real UPI validation requires
   * integration with bank APIs which need special permissions
   */
  static async validateUPIExistence(upiId: string): Promise<UPIValidationResult> {
    try {
      // First validate format
      if (!this.validateUPIFormat(upiId)) {
        return {
          isValid: false,
          error: 'Invalid UPI ID format'
        };
      }

      const [handle, provider] = upiId.split('@');
      
      // Mock validation based on common patterns
      // In production, this would integrate with bank APIs
      const result = await this.mockUPIValidation(upiId, handle, provider);
      
      return result;

    } catch (error) {
      console.error('UPI validation error:', error);
      return {
        isValid: false,
        error: 'Unable to validate UPI ID at this time'
      };
    }
  }

  /**
   * Mock UPI validation (for demonstration)
   * In production, this would call actual bank APIs
   */
  private static async mockUPIValidation(
    upiId: string, 
    handle: string, 
    provider: string
  ): Promise<UPIValidationResult> {
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock validation logic
    const providerInfo = this.getProviderInfo(provider);
    
    // Basic validation rules
    if (handle.length < 3) {
      return {
        isValid: false,
        error: 'UPI handle too short'
      };
    }

    if (handle.length > 50) {
      return {
        isValid: false,
        error: 'UPI handle too long'
      };
    }

    // For phone number based UPI IDs
    if (/^\d{10}$/.test(handle)) {
      if (!['ybl', 'paytm', 'phonepe'].includes(provider)) {
        return {
          isValid: false,
          error: 'Phone number format not supported by this provider'
        };
      }
    }

    // Mock successful validation
    return {
      isValid: true,
      exists: true,
      provider: providerInfo.name,
      accountName: this.generateMockAccountName(handle)
    };
  }

  /**
   * Get provider information
   */
  private static getProviderInfo(provider: string): { name: string; type: string } {
    const providers: Record<string, { name: string; type: string }> = {
      'paytm': { name: 'Paytm', type: 'wallet' },
      'phonepe': { name: 'PhonePe', type: 'wallet' },
      'ybl': { name: 'Yes Bank (Google Pay)', type: 'bank' },
      'oksbi': { name: 'State Bank of India', type: 'bank' },
      'okaxis': { name: 'Axis Bank', type: 'bank' },
      'okicici': { name: 'ICICI Bank', type: 'bank' },
      'okhdfcbank': { name: 'HDFC Bank', type: 'bank' },
      'sbi': { name: 'State Bank of India', type: 'bank' },
      'icici': { name: 'ICICI Bank', type: 'bank' },
      'hdfcbank': { name: 'HDFC Bank', type: 'bank' },
      'axl': { name: 'Axis Bank', type: 'bank' },
      'ibl': { name: 'IDBI Bank', type: 'bank' }
    };

    return providers[provider] || { name: provider.toUpperCase(), type: 'unknown' };
  }

  /**
   * Generate mock account name for testing
   */
  private static generateMockAccountName(handle: string): string {
    // This is just for testing - real implementation would return actual account name
    if (/^\d{10}$/.test(handle)) {
      return `User ending with ${handle.slice(-4)}`;
    }
    return `${handle.charAt(0).toUpperCase()}${handle.slice(1).toLowerCase()}`;
  }

  /**
   * Validate UPI ID and provide suggestions
   */
  static async validateWithSuggestions(upiId: string): Promise<{
    isValid: boolean;
    exists?: boolean;
    suggestions?: string[];
    error?: string;
    provider?: string;
  }> {
    const result = await this.validateUPIExistence(upiId);
    
    if (!result.isValid && result.error) {
      const suggestions = this.generateSuggestions(upiId);
      return {
        ...result,
        suggestions
      };
    }

    return result;
  }

  /**
   * Generate UPI ID suggestions
   */
  private static generateSuggestions(upiId: string): string[] {
    const suggestions: string[] = [];
    
    if (!upiId.includes('@')) {
      suggestions.push(
        `${upiId}@paytm`,
        `${upiId}@ybl`,
        `${upiId}@phonepe`
      );
      return suggestions;
    }

    const [handle, provider] = upiId.split('@');
    
    // Suggest common providers if current one is invalid
    const commonProviders = ['paytm', 'ybl', 'phonepe', 'oksbi', 'okaxis', 'okicici'];
    
    commonProviders.forEach(p => {
      if (p !== provider) {
        suggestions.push(`${handle}@${p}`);
      }
    });

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Get list of popular UPI providers
   */
  static getPopularProviders(): Array<{ id: string; name: string; example: string }> {
    return [
      { id: 'paytm', name: 'Paytm', example: 'yourname@paytm' },
      { id: 'ybl', name: 'Google Pay (Yes Bank)', example: '9876543210@ybl' },
      { id: 'phonepe', name: 'PhonePe', example: 'yourname@phonepe' },
      { id: 'oksbi', name: 'SBI (YONO)', example: 'yourname@oksbi' },
      { id: 'okaxis', name: 'Axis Bank', example: 'yourname@okaxis' },
      { id: 'okicici', name: 'ICICI Bank', example: 'yourname@okicici' },
      { id: 'okhdfcbank', name: 'HDFC Bank', example: 'yourname@okhdfcbank' }
    ];
  }
}

export default UPIValidationService;
