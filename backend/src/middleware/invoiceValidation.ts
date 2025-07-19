import { Request, Response, NextFunction } from 'express';
import { validateGSTNumber } from '../utils/gstCalculations';

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
    min?: number;
    max?: number;
  }
): string | null => {
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return `${fieldName} is required`;
  }

  if (value !== undefined && value !== null) {
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return `${fieldName} must be at least ${rules.minLength} characters long`;
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        return `${fieldName} cannot exceed ${rules.maxLength} characters`;
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        return rules.patternMessage || `${fieldName} format is invalid`;
      }
    }

    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return `${fieldName} must be at least ${rules.min}`;
      }

      if (rules.max !== undefined && value > rules.max) {
        return `${fieldName} cannot exceed ${rules.max}`;
      }
    }
  }

  return null;
};

// Validate customer data
const validateCustomer = (customer: any): string[] => {
  const errors: string[] = [];

  if (!customer) {
    errors.push('Customer information is required');
    return errors;
  }

  // Name validation
  const nameError = validateField(customer.name, 'Customer name', {
    required: true,
    minLength: 2,
    maxLength: 100
  });
  if (nameError) errors.push(nameError);

  // Email validation (optional)
  if (customer.email) {
    const emailError = validateField(customer.email, 'Customer email', {
      pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      patternMessage: 'Please enter a valid email address'
    });
    if (emailError) errors.push(emailError);
  }

  // Phone validation (optional)
  if (customer.phone) {
    const phoneError = validateField(customer.phone, 'Customer phone', {
      pattern: /^[6-9]\d{9}$/,
      patternMessage: 'Please enter a valid 10-digit Indian phone number'
    });
    if (phoneError) errors.push(phoneError);
  }

  // GST number validation (optional)
  if (customer.gstNumber) {
    if (!validateGSTNumber(customer.gstNumber)) {
      errors.push('Please enter a valid GST number');
    }
  }

  // Address validation
  if (!customer.address) {
    errors.push('Customer address is required');
  } else {
    const addressErrors = [
      validateField(customer.address.street, 'Street address', { required: true, maxLength: 200 }),
      validateField(customer.address.city, 'City', { required: true, maxLength: 50 }),
      validateField(customer.address.state, 'State', { required: true, maxLength: 50 }),
      validateField(customer.address.pincode, 'Pincode', {
        required: true,
        pattern: /^[1-9][0-9]{5}$/,
        patternMessage: 'Please enter a valid 6-digit pincode'
      })
    ].filter(Boolean);

    errors.push(...addressErrors as string[]);
  }

  return errors;
};

// Validate invoice items
const validateItems = (items: any[], invoiceType: 'gst' | 'non-gst' = 'gst'): string[] => {
  const errors: string[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('At least one invoice item is required');
    return errors;
  }

  items.forEach((item, index) => {
    const itemPrefix = `Item ${index + 1}`;

    // Description validation
    const descError = validateField(item.description, `${itemPrefix} description`, {
      required: true,
      minLength: 2,
      maxLength: 200
    });
    if (descError) errors.push(descError);

    // HSN code validation - only required for GST invoices
    if (invoiceType === 'gst') {
      const hsnError = validateField(item.hsn, `${itemPrefix} HSN/SAC code`, {
        required: true,
        minLength: 4,
        maxLength: 10,
        pattern: /^[0-9A-Z]+$/,
        patternMessage: 'HSN/SAC code should contain only numbers and uppercase letters'
      });
      if (hsnError) errors.push(hsnError);
    } else if (item.hsn && item.hsn.trim() !== '') {
      // Optional validation for non-GST invoices if HSN is provided
      const hsnError = validateField(item.hsn, `${itemPrefix} HSN/SAC code`, {
        required: false,
        minLength: 4,
        maxLength: 10,
        pattern: /^[0-9A-Z]+$/,
        patternMessage: 'HSN/SAC code should contain only numbers and uppercase letters'
      });
      if (hsnError) errors.push(hsnError);
    }

    // Quantity validation
    const qtyError = validateField(item.quantity, `${itemPrefix} quantity`, {
      required: true,
      min: 0.01
    });
    if (qtyError) errors.push(qtyError);

    // Unit validation
    const unitError = validateField(item.unit, `${itemPrefix} unit`, {
      required: true,
      maxLength: 20
    });
    if (unitError) errors.push(unitError);

    // Rate validation
    const rateError = validateField(item.rate, `${itemPrefix} rate`, {
      required: true,
      min: 0
    });
    if (rateError) errors.push(rateError);

    // Discount validation (optional)
    if (item.discount !== undefined) {
      const discountError = validateField(item.discount, `${itemPrefix} discount`, {
        min: 0,
        max: 100
      });
      if (discountError) errors.push(discountError);
    }
  });

  return errors;
};

// Invoice creation validation
export const validateInvoiceCreation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { customer, items, dueDate, notes, terms, invoiceType = 'gst' } = req.body;
  const errors: string[] = [];

  // Customer validation
  errors.push(...validateCustomer(customer));

  // Items validation
  errors.push(...validateItems(items, invoiceType));

  // Due date validation (optional)
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(dueDateObj.getTime())) {
      errors.push('Invalid due date format');
    } else if (dueDateObj < today) {
      errors.push('Due date cannot be in the past');
    }
  }

  // Notes validation (optional)
  if (notes) {
    const notesError = validateField(notes, 'Notes', { maxLength: 1000 });
    if (notesError) errors.push(notesError);
  }

  // Terms validation (optional)
  if (terms) {
    const termsError = validateField(terms, 'Terms', { maxLength: 1000 });
    if (termsError) errors.push(termsError);
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

// Invoice update validation
export const validateInvoiceUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { customer, items, dueDate, notes, terms, status, paymentStatus, paymentDate, invoiceType = 'gst' } = req.body;
  const errors: string[] = [];

  // Customer validation (if provided)
  if (customer) {
    errors.push(...validateCustomer(customer));
  }

  // Items validation (if provided)
  if (items) {
    errors.push(...validateItems(items, invoiceType));
  }

  // Due date validation (if provided)
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      errors.push('Invalid due date format');
    }
  }

  // Notes validation (if provided)
  if (notes) {
    const notesError = validateField(notes, 'Notes', { maxLength: 1000 });
    if (notesError) errors.push(notesError);
  }

  // Terms validation (if provided)
  if (terms) {
    const termsError = validateField(terms, 'Terms', { maxLength: 1000 });
    if (termsError) errors.push(termsError);
  }

  // Status validation (if provided)
  if (status) {
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      errors.push('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }
  }

  // Payment status validation (if provided)
  if (paymentStatus) {
    const validPaymentStatuses = ['pending', 'partial', 'paid'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      errors.push('Invalid payment status. Must be one of: ' + validPaymentStatuses.join(', '));
    }
  }

  // Payment date validation (if provided)
  if (paymentDate) {
    const paymentDateObj = new Date(paymentDate);
    if (isNaN(paymentDateObj.getTime())) {
      errors.push('Invalid payment date format');
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
