import fs from 'fs/promises';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';

export interface ParsedDocumentData {
  text: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  invoiceData?: {
    invoiceNumber?: string;
    date?: Date;
    amount?: number;
    vendor?: string;
    gstNumber?: string;
    customerName?: string;
    customerGST?: string;
    items?: Array<{
      description: string;
      quantity?: number;
      rate?: number;
      amount?: number;
    }>;
  };
  documentType?: 'invoice' | 'receipt' | 'tax_document' | 'compliance' | 'other';
  confidence: number;
}

export class DocumentParsingService {
  private pdfExtract: PDFExtract;

  constructor() {
    this.pdfExtract = new PDFExtract();
  }

  /**
   * Extract text from PDF files
   */
  private async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const data = await new Promise<any>((resolve, reject) => {
        this.pdfExtract.extract(filePath, {}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      let text = '';
      for (const page of data.pages) {
        for (const content of page.content) {
          text += content.str + ' ';
        }
        text += '\n';
      }

      return text.trim();
    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from image files using OCR (placeholder - would need actual OCR service)
   */
  private async extractTextFromImage(filePath: string): Promise<string> {
    // This is a placeholder. In a real implementation, you would use:
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Computer Vision
    // - Tesseract.js for client-side OCR
    
    console.log('Image OCR not implemented yet for:', filePath);
    return 'Image text extraction not implemented yet';
  }

  /**
   * Extract text from text files
   */
  private async extractTextFromTextFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Text file reading error:', error);
      throw new Error('Failed to read text file');
    }
  }

  /**
   * Extract text based on file type
   */
  private async extractText(filePath: string, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractTextFromPDF(filePath);
      
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
        return this.extractTextFromImage(filePath);
      
      case 'text/plain':
      case 'text/csv':
        return this.extractTextFromTextFile(filePath);
      
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // Would need additional libraries like mammoth.js for Word docs
        throw new Error('Document type not supported yet');
      
      default:
        throw new Error('Unsupported file type for text extraction');
    }
  }

  /**
   * Rule-based text analysis as fallback when AI is not available
   */
  private async analyzeTextWithRules(text: string): Promise<Partial<ParsedDocumentData>> {
    const entities: Array<{ type: string; value: string; confidence: number }> = [];
    let documentType: 'invoice' | 'receipt' | 'tax_document' | 'compliance' | 'other' = 'other';
    let confidence = 0.6; // Base confidence for rule-based analysis

    const lowerText = text.toLowerCase();

    // Determine document type
    if (lowerText.includes('invoice') || lowerText.includes('bill') || lowerText.includes('inv no')) {
      documentType = 'invoice';
      confidence += 0.2;
    } else if (lowerText.includes('receipt') || lowerText.includes('payment received')) {
      documentType = 'receipt';
      confidence += 0.2;
    } else if (lowerText.includes('gst') || lowerText.includes('tax') || lowerText.includes('tds')) {
      documentType = 'tax_document';
      confidence += 0.1;
    }

    // Extract common patterns

    // Invoice numbers
    const invoicePatterns = [
      /(?:invoice|inv|bill)[\s#:no.-]*([A-Z0-9\/-]+)/gi,
      /(?:^|\s)([A-Z]{2,4}[-\/]?\d{3,})/g
    ];

    for (const pattern of invoicePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          entities.push({
            type: 'invoice_number',
            value: match.trim(),
            confidence: 0.8
          });
        });
      }
    }

    // Amounts (Indian currency)
    const amountPatterns = [
      /₹\s*([0-9,]+\.?\d*)/g,
      /(?:rs|inr|amount|total)[\s:]*([0-9,]+\.?\d*)/gi,
      /([0-9,]+\.?\d*)\s*(?:rs|inr|rupees)/gi
    ];

    for (const pattern of amountPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const amount = match.replace(/[^\d.,]/g, '');
          if (amount && parseFloat(amount.replace(',', '')) > 0) {
            entities.push({
              type: 'amount',
              value: amount,
              confidence: 0.7
            });
          }
        });
      }
    }

    // GST numbers
    const gstPattern = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g;
    const gstMatches = text.match(gstPattern);
    if (gstMatches) {
      gstMatches.forEach(gst => {
        entities.push({
          type: 'gst_number',
          value: gst,
          confidence: 0.9
        });
      });
    }

    // PAN numbers
    const panPattern = /\b[A-Z]{5}\d{4}[A-Z]{1}\b/g;
    const panMatches = text.match(panPattern);
    if (panMatches) {
      panMatches.forEach(pan => {
        entities.push({
          type: 'pan_number',
          value: pan,
          confidence: 0.8
        });
      });
    }

    // Dates
    const datePatterns = [
      /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g,
      /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}\b/gi
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(date => {
          entities.push({
            type: 'date',
            value: date,
            confidence: 0.6
          });
        });
      }
    }

    // Email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = text.match(emailPattern);
    if (emailMatches) {
      emailMatches.forEach(email => {
        entities.push({
          type: 'email',
          value: email,
          confidence: 0.9
        });
      });
    }

    // Phone numbers (Indian format)
    const phonePattern = /(?:\+91|91)?[-\s]?[6-9]\d{9}/g;
    const phoneMatches = text.match(phonePattern);
    if (phoneMatches) {
      phoneMatches.forEach(phone => {
        entities.push({
          type: 'phone',
          value: phone.trim(),
          confidence: 0.7
        });
      });
    }

    // Basic invoice data extraction
    let invoiceData: any = {};

    if (documentType === 'invoice' || documentType === 'receipt') {
      // Extract invoice number
      const invoiceEntity = entities.find(e => e.type === 'invoice_number');
      if (invoiceEntity) {
        invoiceData.invoiceNumber = invoiceEntity.value;
      }

      // Extract amount
      const amountEntity = entities.find(e => e.type === 'amount');
      if (amountEntity) {
        const amount = parseFloat(amountEntity.value.replace(/[,]/g, ''));
        if (!isNaN(amount)) {
          invoiceData.amount = amount;
        }
      }

      // Extract GST number
      const gstEntity = entities.find(e => e.type === 'gst_number');
      if (gstEntity) {
        invoiceData.gstNumber = gstEntity.value;
      }

      // Extract date
      const dateEntity = entities.find(e => e.type === 'date');
      if (dateEntity) {
        try {
          invoiceData.date = new Date(dateEntity.value);
        } catch (e) {
          // Invalid date format
        }
      }
    }

    return {
      entities,
      documentType,
      confidence: Math.min(confidence, 1.0),
      ...(Object.keys(invoiceData).length > 0 && { invoiceData })
    };
  }

  /**
   * Parse document and extract structured data using rule-based analysis only
   */
  async parseDocument(filePath: string, mimeType: string): Promise<ParsedDocumentData> {
    try {
      // Extract text from document
      const extractedText = await this.extractText(filePath, mimeType);

      if (!extractedText || extractedText.trim().length === 0) {
        return {
          text: '',
          entities: [],
          confidence: 0
        };
      }

      // Analyze text with rule-based analysis only
      const analysis = await this.analyzeTextWithRules(extractedText);

      // Combine results
      const result: ParsedDocumentData = {
        text: extractedText,
        entities: analysis.entities || [],
        documentType: analysis.documentType || 'other',
        confidence: analysis.confidence || 0,
        ...analysis.invoiceData && { invoiceData: analysis.invoiceData }
      };

      return result;

    } catch (error) {
      console.error('Document parsing error:', error);
      return {
        text: '',
        entities: [],
        confidence: 0
      };
    }
  }

  /**
   * Validate extracted invoice data
   */
  validateInvoiceData(invoiceData: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!invoiceData.invoiceNumber) {
      errors.push('Invoice number is missing');
    }

    if (!invoiceData.amount || invoiceData.amount <= 0) {
      errors.push('Valid invoice amount is missing');
    }

    if (!invoiceData.vendor) {
      warnings.push('Vendor information is missing');
    }

    if (!invoiceData.date) {
      warnings.push('Invoice date is missing');
    }

    // Validate GST number format (basic validation)
    if (invoiceData.gstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(invoiceData.gstNumber)) {
        warnings.push('GST number format appears invalid');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv'
    ];
  }

  /**
   * Check if file type is supported for parsing
   */
  isFileTypeSupported(mimeType: string): boolean {
    return this.getSupportedFileTypes().includes(mimeType);
  }
}

// Export singleton instance
export const documentParsingService = new DocumentParsingService();
