import { IInvoiceItem } from '../models/Invoice';

// Indian state codes for GST calculation
export const INDIAN_STATES = {
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chhattisgarh': 'CG',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'Nagaland': 'NL',
  'Odisha': 'OR',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TS',
  'Tripura': 'TR',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB',
  'Delhi': 'DL',
  'Jammu and Kashmir': 'JK',
  'Ladakh': 'LA',
  'Chandigarh': 'CH',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  'Lakshadweep': 'LD',
  'Puducherry': 'PY',
  'Andaman and Nicobar Islands': 'AN'
};

export interface GSTRates {
  cgst: number;
  sgst: number;
  igst: number;
}

export interface ItemCalculation {
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  taxableAmount: number;
  gstRates: GSTRates;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface InvoiceCalculation {
  items: ItemCalculation[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Determine if transaction is inter-state or intra-state
 * @param sellerState - Seller's state
 * @param buyerState - Buyer's state
 * @returns true if inter-state (IGST applicable), false if intra-state (CGST+SGST applicable)
 */
export const isInterStateTransaction = (sellerState: string, buyerState: string): boolean => {
  return sellerState.toLowerCase() !== buyerState.toLowerCase();
};

/**
 * Get GST rates based on HSN code and transaction type
 * @param hsnCode - HSN/SAC code
 * @param isInterState - Whether it's inter-state transaction
 * @returns GST rates object
 */
export const getGSTRates = (hsnCode: string, isInterState: boolean): GSTRates => {
  // Default GST rates - in real implementation, this would be fetched from HSN database
  let totalGSTRate = 18; // Default 18% GST
  
  // Common HSN codes and their GST rates
  const hsnRates: { [key: string]: number } = {
    '1001': 0,    // Wheat - 0%
    '1006': 0,    // Rice - 0%
    '0401': 0,    // Milk - 0%
    '3004': 12,   // Medicines - 12%
    '6403': 18,   // Footwear - 18%
    '8517': 18,   // Mobile phones - 18%
    '8703': 28,   // Motor cars - 28%
    '2402': 28,   // Cigarettes - 28%
    '9999': 18    // Default services - 18%
  };
  
  // Get rate based on HSN code (first 4 digits)
  const hsnPrefix = hsnCode.substring(0, 4);
  totalGSTRate = hsnRates[hsnPrefix] || 18;
  
  if (isInterState) {
    // Inter-state: Only IGST
    return {
      cgst: 0,
      sgst: 0,
      igst: totalGSTRate
    };
  } else {
    // Intra-state: CGST + SGST (split equally)
    const halfRate = totalGSTRate / 2;
    return {
      cgst: halfRate,
      sgst: halfRate,
      igst: 0
    };
  }
};

/**
 * Calculate item-wise GST amounts
 * @param item - Invoice item data
 * @param sellerState - Seller's state
 * @param buyerState - Buyer's state
 * @returns Calculated item with GST amounts
 */
export const calculateItemGST = (
  item: {
    description: string;
    hsn: string;
    quantity: number;
    unit: string;
    rate: number;
    discount?: number;
  },
  sellerState: string,
  buyerState: string
): ItemCalculation => {
  const discount = item.discount || 0;
  const grossAmount = item.quantity * item.rate;
  const discountAmount = (grossAmount * discount) / 100;
  const taxableAmount = grossAmount - discountAmount;
  
  const isInterState = isInterStateTransaction(sellerState, buyerState);
  const gstRates = getGSTRates(item.hsn, isInterState);
  
  const cgstAmount = (taxableAmount * gstRates.cgst) / 100;
  const sgstAmount = (taxableAmount * gstRates.sgst) / 100;
  const igstAmount = (taxableAmount * gstRates.igst) / 100;
  
  const totalAmount = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  
  return {
    description: item.description,
    hsn: item.hsn,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    discount,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    gstRates,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    igstAmount: Math.round(igstAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100
  };
};

/**
 * Calculate complete invoice with GST
 * @param items - Array of invoice items
 * @param sellerState - Seller's state
 * @param buyerState - Buyer's state
 * @returns Complete invoice calculation
 */
export const calculateInvoiceGST = (
  items: Array<{
    description: string;
    hsn: string;
    quantity: number;
    unit: string;
    rate: number;
    discount?: number;
  }>,
  sellerState: string,
  buyerState: string
): InvoiceCalculation => {
  const calculatedItems = items.map(item => 
    calculateItemGST(item, sellerState, buyerState)
  );
  
  const subtotal = calculatedItems.reduce((sum, item) => 
    sum + (item.quantity * item.rate), 0
  );
  
  const totalDiscount = calculatedItems.reduce((sum, item) => 
    sum + ((item.quantity * item.rate * item.discount) / 100), 0
  );
  
  const taxableAmount = calculatedItems.reduce((sum, item) => 
    sum + item.taxableAmount, 0
  );
  
  const totalCGST = calculatedItems.reduce((sum, item) => 
    sum + item.cgstAmount, 0
  );
  
  const totalSGST = calculatedItems.reduce((sum, item) => 
    sum + item.sgstAmount, 0
  );
  
  const totalIGST = calculatedItems.reduce((sum, item) => 
    sum + item.igstAmount, 0
  );
  
  const totalTax = totalCGST + totalSGST + totalIGST;
  const grandTotal = taxableAmount + totalTax;
  
  return {
    items: calculatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    totalCGST: Math.round(totalCGST * 100) / 100,
    totalSGST: Math.round(totalSGST * 100) / 100,
    totalIGST: Math.round(totalIGST * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
};

/**
 * Convert invoice items to database format
 * @param calculatedItems - Calculated items from calculateInvoiceGST
 * @returns Array of IInvoiceItem for database storage
 */
export const convertToInvoiceItems = (calculatedItems: ItemCalculation[]): IInvoiceItem[] => {
  return calculatedItems.map(item => ({
    description: item.description,
    hsn: item.hsn,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    discount: item.discount,
    taxableAmount: item.taxableAmount,
    cgstRate: item.gstRates.cgst,
    sgstRate: item.gstRates.sgst,
    igstRate: item.gstRates.igst,
    cgstAmount: item.cgstAmount,
    sgstAmount: item.sgstAmount,
    igstAmount: item.igstAmount,
    totalAmount: item.totalAmount
  }));
};

/**
 * Validate GST number format
 * @param gstNumber - GST number to validate
 * @returns true if valid, false otherwise
 */
export const validateGSTNumber = (gstNumber: string): boolean => {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gstNumber);
};

/**
 * Get state code from GST number
 * @param gstNumber - Valid GST number
 * @returns State code (first 2 digits)
 */
export const getStateCodeFromGST = (gstNumber: string): string => {
  if (!validateGSTNumber(gstNumber)) {
    throw new Error('Invalid GST number format');
  }
  return gstNumber.substring(0, 2);
};
