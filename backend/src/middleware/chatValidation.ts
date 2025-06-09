import { Request, Response, NextFunction } from 'express';

// Validation helper function
const validateField = (
  value: any,
  fieldName: string,
  rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    patternMessage?: string;
  }
): string | null => {
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return `${fieldName} is required`;
  }

  if (value !== undefined && value !== null && typeof value === 'string') {
    if (rules.minLength && value.trim().length < rules.minLength) {
      return `${fieldName} must be at least ${rules.minLength} characters long`;
    }

    if (rules.maxLength && value.trim().length > rules.maxLength) {
      return `${fieldName} cannot exceed ${rules.maxLength} characters`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return rules.patternMessage || `${fieldName} format is invalid`;
    }
  }

  return null;
};

// Chat message validation
export const validateChatMessage = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { message } = req.body;
  const errors: string[] = [];

  // Message validation
  const messageError = validateField(message, 'Message', {
    required: true,
    minLength: 1,
    maxLength: 2000
  });
  if (messageError) errors.push(messageError);

  // Check for potentially harmful content
  if (message && typeof message === 'string') {
    const harmfulPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript URLs
      /on\w+\s*=/gi, // Event handlers
      /data:text\/html/gi // Data URLs
    ];

    const containsHarmfulContent = harmfulPatterns.some(pattern => 
      pattern.test(message)
    );

    if (containsHarmfulContent) {
      errors.push('Message contains potentially harmful content');
    }

    // Check message length after trimming
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      errors.push('Message cannot be empty or contain only whitespace');
    }

    // Check for spam-like patterns
    const spamPatterns = [
      /(.)\1{10,}/g, // Repeated characters
      /^[A-Z\s!]{20,}$/g, // All caps with excessive length
      /(https?:\/\/[^\s]+){3,}/g // Multiple URLs
    ];

    const isSpamLike = spamPatterns.some(pattern => pattern.test(message));
    if (isSpamLike) {
      errors.push('Message appears to be spam or contains excessive repetition');
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

// Chat session creation validation
export const validateChatSession = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { title, category } = req.body;
  const errors: string[] = [];

  // Title validation (optional)
  if (title) {
    const titleError = validateField(title, 'Title', {
      minLength: 1,
      maxLength: 100
    });
    if (titleError) errors.push(titleError);
  }

  // Category validation (optional)
  if (category) {
    const validCategories = ['gst', 'tds', 'income-tax', 'compliance', 'general'];
    if (!validCategories.includes(category)) {
      errors.push('Invalid category. Must be one of: ' + validCategories.join(', '));
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

// Chat session update validation
export const validateChatSessionUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { title, category } = req.body;
  const errors: string[] = [];

  // At least one field should be provided for update
  if (!title && !category) {
    errors.push('At least one field (title or category) must be provided for update');
  }

  // Title validation (if provided)
  if (title) {
    const titleError = validateField(title, 'Title', {
      minLength: 1,
      maxLength: 100
    });
    if (titleError) errors.push(titleError);
  }

  // Category validation (if provided)
  if (category) {
    const validCategories = ['gst', 'tds', 'income-tax', 'compliance', 'general'];
    if (!validCategories.includes(category)) {
      errors.push('Invalid category. Must be one of: ' + validCategories.join(', '));
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

// Rate limiting for chat messages (prevent spam)
const messageTimestamps = new Map<string, number[]>();

export const rateLimitChatMessages = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
    return;
  }

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxMessages = 20; // Max 20 messages per minute

  // Get user's message timestamps
  const userTimestamps = messageTimestamps.get(userId) || [];
  
  // Remove timestamps older than the window
  const recentTimestamps = userTimestamps.filter(timestamp => 
    now - timestamp < windowMs
  );

  // Check if user has exceeded the limit
  if (recentTimestamps.length >= maxMessages) {
    res.status(429).json({
      success: false,
      message: 'Too many messages. Please wait before sending another message.',
      retryAfter: Math.ceil((recentTimestamps[0] + windowMs - now) / 1000)
    });
    return;
  }

  // Add current timestamp
  recentTimestamps.push(now);
  messageTimestamps.set(userId, recentTimestamps);

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    const cutoff = now - windowMs;
    for (const [key, timestamps] of messageTimestamps.entries()) {
      const filtered = timestamps.filter(timestamp => timestamp > cutoff);
      if (filtered.length === 0) {
        messageTimestamps.delete(key);
      } else {
        messageTimestamps.set(key, filtered);
      }
    }
  }

  next();
};
