import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';

// Initialize OpenAI client (only if API key is available)
let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

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
   * Use AI to analyze and extract structured data from text
   */
  private async analyzeTextWithAI(text: string): Promise<Partial<ParsedDocumentData>> {
    try {
      if (!openai) {
        console.warn('OpenAI API key not configured. Skipping AI analysis.');
        return {
          entities: [],
          confidence: 0
        };
      }

      const prompt = `
Analyze the following document text and extract structured information. 
Identify if this is an invoice, receipt, tax document, or other business document.
Extract relevant entities and data points.

Document Text:
${text}

Please respond with a JSON object containing:
1. documentType: "invoice" | "receipt" | "tax_document" | "compliance" | "other"
2. entities: Array of {type, value, confidence} for important entities
3. invoiceData: If it's an invoice/receipt, extract invoice number, date, amount, vendor, GST numbers, items, etc.
4. confidence: Overall confidence score (0-1)

Response format:
{
  "documentType": "invoice",
  "entities": [
    {"type": "invoice_number", "value": "INV-001", "confidence": 0.95},
    {"type": "amount", "value": "1000.00", "confidence": 0.90}
  ],
  "invoiceData": {
    "invoiceNumber": "INV-001",
    "amount": 1000.00,
    "vendor": "Company Name"
  },
  "confidence": 0.85
}
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert document analyzer specializing in Indian business documents, invoices, and tax documents. Extract structured data accurately and provide confidence scores.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI service');
      }

      // Try to parse JSON response
      try {
        const parsedResponse = JSON.parse(aiResponse);
        return parsedResponse;
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', aiResponse);
        return {
          entities: [],
          confidence: 0
        };
      }

    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        entities: [],
        confidence: 0
      };
    }
  }

  /**
   * Parse document and extract structured data
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

      // Analyze text with AI
      const aiAnalysis = await this.analyzeTextWithAI(extractedText);

      // Combine results
      const result: ParsedDocumentData = {
        text: extractedText,
        entities: aiAnalysis.entities || [],
        documentType: aiAnalysis.documentType || 'other',
        confidence: aiAnalysis.confidence || 0,
        ...aiAnalysis.invoiceData && { invoiceData: aiAnalysis.invoiceData }
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
