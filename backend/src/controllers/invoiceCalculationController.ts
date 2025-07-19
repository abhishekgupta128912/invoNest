import { Request, Response } from 'express';
import { calculateInvoiceGST } from '../utils/gstCalculations';

// Calculate invoice totals without saving
export const calculateInvoiceTotals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, sellerState, buyerState } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required and cannot be empty'
      });
      return;
    }

    if (!sellerState || !buyerState) {
      res.status(400).json({
        success: false,
        message: 'Seller state and buyer state are required'
      });
      return;
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || !item.hsn || !item.quantity || !item.rate) {
        res.status(400).json({
          success: false,
          message: `Item ${i + 1} is missing required fields (description, hsn, quantity, rate)`
        });
        return;
      }

      if (item.quantity <= 0 || item.rate < 0) {
        res.status(400).json({
          success: false,
          message: `Item ${i + 1} has invalid quantity or rate`
        });
        return;
      }

      if (item.discount && (item.discount < 0 || item.discount > 100)) {
        res.status(400).json({
          success: false,
          message: `Item ${i + 1} has invalid discount percentage`
        });
        return;
      }
    }

    // Calculate totals
    const calculation = calculateInvoiceGST(items, sellerState, buyerState);

    res.status(200).json({
      success: true,
      message: 'Invoice calculation completed successfully',
      data: calculation
    });

  } catch (error) {
    console.error('Invoice calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate invoice totals'
    });
  }
};

// Get GST rates for HSN code
export const getGSTRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hsn, sellerState, buyerState } = req.query;

    if (!hsn || !sellerState || !buyerState) {
      res.status(400).json({
        success: false,
        message: 'HSN code, seller state, and buyer state are required'
      });
      return;
    }

    // Import the GST calculation functions
    const { getGSTRates: calculateGSTRates, isInterStateTransaction } = require('../utils/gstCalculations');
    
    const isInterState = isInterStateTransaction(sellerState as string, buyerState as string);
    const rates = calculateGSTRates(hsn as string, isInterState);

    res.status(200).json({
      success: true,
      message: 'GST rates retrieved successfully',
      data: {
        hsn,
        isInterState,
        rates,
        sellerState,
        buyerState
      }
    });

  } catch (error) {
    console.error('GST rates calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate GST rates'
    });
  }
};

// Validate GST number
export const validateGSTNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gstNumber } = req.body;

    if (!gstNumber) {
      res.status(400).json({
        success: false,
        message: 'GST number is required'
      });
      return;
    }

    // Import validation function
    const { validateGSTNumber: validateGST, getStateCodeFromGST } = require('../utils/gstCalculations');
    
    const isValid = validateGST(gstNumber);
    let stateCode = null;
    
    if (isValid) {
      try {
        stateCode = getStateCodeFromGST(gstNumber);
      } catch (error) {
        // Handle invalid GST number
      }
    }

    res.status(200).json({
      success: true,
      message: 'GST number validation completed',
      data: {
        gstNumber,
        isValid,
        stateCode
      }
    });

  } catch (error) {
    console.error('GST validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate GST number'
    });
  }
};

// Get common HSN codes with their descriptions and GST rates
export const getCommonHSNCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const commonHSNCodes = [
      { code: '1001', description: 'Wheat', rate: 0 },
      { code: '1006', description: 'Rice', rate: 0 },
      { code: '0401', description: 'Milk and cream', rate: 0 },
      { code: '3004', description: 'Medicaments', rate: 12 },
      { code: '6403', description: 'Footwear', rate: 18 },
      { code: '8517', description: 'Telephone sets, mobile phones', rate: 18 },
      { code: '8703', description: 'Motor cars', rate: 28 },
      { code: '2402', description: 'Cigars, cigarettes', rate: 28 },
      { code: '9999', description: 'Default services', rate: 18 },
      { code: '9954', description: 'Software development services', rate: 18 },
      { code: '9972', description: 'Consulting services', rate: 18 },
      { code: '9973', description: 'Information technology services', rate: 18 },
      { code: '9982', description: 'Business support services', rate: 18 },
      { code: '9983', description: 'Advertising services', rate: 18 },
      { code: '9984', description: 'Market research services', rate: 18 },
      { code: '9985', description: 'Management consulting services', rate: 18 },
      { code: '9986', description: 'Legal services', rate: 18 },
      { code: '9987', description: 'Accounting services', rate: 18 },
      { code: '9988', description: 'Engineering services', rate: 18 },
      { code: '9989', description: 'Architectural services', rate: 18 }
    ];

    res.status(200).json({
      success: true,
      message: 'Common HSN codes retrieved successfully',
      data: {
        hsnCodes: commonHSNCodes
      }
    });

  } catch (error) {
    console.error('HSN codes retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve HSN codes'
    });
  }
};

// Get Indian states list
export const getIndianStates = async (req: Request, res: Response): Promise<void> => {
  try {
    const indianStates = [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
      'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
      'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
      'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
      'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
      'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
      'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    res.status(200).json({
      success: true,
      message: 'Indian states retrieved successfully',
      data: {
        states: indianStates.sort()
      }
    });

  } catch (error) {
    console.error('States retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve states'
    });
  }
};
