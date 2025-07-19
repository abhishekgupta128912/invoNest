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
  // Skip validation for empty/null/undefined values unless required
  if (!value || value.toString().trim() === '') {
    if (rules.required) {
      return `${fieldName} is required`;
    }
    return null; // Skip validation for empty optional fields
  }

  const trimmedValue = value.toString().trim();

  if (rules.minLength && trimmedValue.length < rules.minLength) {
    return `${fieldName} must be at least ${rules.minLength} characters long`;
  }

  if (rules.maxLength && trimmedValue.length > rules.maxLength) {
    return `${fieldName} cannot exceed ${rules.maxLength} characters`;
  }

  if (rules.pattern && !rules.pattern.test(trimmedValue)) {
    return rules.patternMessage || `${fieldName} format is invalid`;
  }

  return null;
};

// Registration validation
export const validateRegistration = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { name, email, password, businessName, gstNumber, phone } = req.body;
  const errors: string[] = [];

  // Name validation
  const nameError = validateField(name, 'Name', {
    required: true,
    minLength: 2,
    maxLength: 50
  });
  if (nameError) errors.push(nameError);

  // Email validation
  const emailError = validateField(email, 'Email', {
    required: true,
    pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
    patternMessage: 'Please enter a valid email address'
  });
  if (emailError) errors.push(emailError);

  // Password validation
  const passwordError = validateField(password, 'Password', {
    required: true,
    minLength: 6,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    patternMessage: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  });
  if (passwordError) errors.push(passwordError);

  // Business name validation (optional)
  if (businessName) {
    const businessNameError = validateField(businessName, 'Business name', {
      maxLength: 100
    });
    if (businessNameError) errors.push(businessNameError);
  }

  // GST number validation (optional)
  if (gstNumber) {
    const gstError = validateField(gstNumber, 'GST number', {
      pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      patternMessage: 'Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)'
    });
    if (gstError) errors.push(gstError);
  }

  // Phone validation (optional)
  if (phone) {
    const phoneError = validateField(phone, 'Phone number', {
      pattern: /^[6-9]\d{9}$/,
      patternMessage: 'Please enter a valid 10-digit Indian phone number'
    });
    if (phoneError) errors.push(phoneError);
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

// Login validation
export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body;
  const errors: string[] = [];

  // Email validation
  const emailError = validateField(email, 'Email', {
    required: true,
    pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
    patternMessage: 'Please enter a valid email address'
  });
  if (emailError) errors.push(emailError);

  // Password validation
  const passwordError = validateField(password, 'Password', {
    required: true,
    minLength: 1
  });
  if (passwordError) errors.push(passwordError);

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

// Profile update validation
export const validateProfileUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { name, businessName, gstNumber, phone, address } = req.body;
  const errors: string[] = [];

  console.log('Profile update validation - received data:', { name, businessName, gstNumber, phone, address });

  // Name validation (optional for update)
  if (name) {
    const nameError = validateField(name, 'Name', {
      minLength: 2,
      maxLength: 50
    });
    if (nameError) errors.push(nameError);
  }

  // Business name validation (optional)
  if (businessName) {
    const businessNameError = validateField(businessName, 'Business name', {
      maxLength: 100
    });
    if (businessNameError) errors.push(businessNameError);
  }

  // GST number validation (optional)
  if (gstNumber) {
    const gstError = validateField(gstNumber, 'GST number', {
      pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      patternMessage: 'Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)'
    });
    if (gstError) errors.push(gstError);
  }

  // Phone validation (optional)
  if (phone) {
    const phoneError = validateField(phone, 'Phone number', {
      pattern: /^[6-9]\d{9}$/,
      patternMessage: 'Please enter a valid 10-digit Indian phone number'
    });
    if (phoneError) errors.push(phoneError);
  }

  // Address validation (optional)
  if (address) {
    if (address.street) {
      const streetError = validateField(address.street, 'Street address', {
        maxLength: 200
      });
      if (streetError) errors.push(streetError);
    }

    if (address.city) {
      const cityError = validateField(address.city, 'City', {
        maxLength: 50
      });
      if (cityError) errors.push(cityError);
    }

    if (address.state) {
      const stateError = validateField(address.state, 'State', {
        maxLength: 50
      });
      if (stateError) errors.push(stateError);
    }

    if (address.pincode) {
      const pincodeError = validateField(address.pincode, 'Pincode', {
        pattern: /^[1-9][0-9]{5}$/,
        patternMessage: 'Please enter a valid 6-digit pincode'
      });
      if (pincodeError) errors.push(pincodeError);
    }
  }

  if (errors.length > 0) {
    console.log('Profile update validation errors:', errors);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  console.log('Profile update validation passed');
  next();
};
