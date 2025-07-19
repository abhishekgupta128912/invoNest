import puppeteer, { Browser, Page } from 'puppeteer';
import { IInvoice } from '../models/Invoice';
import { IUser } from '../models/User';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { numberToWords, formatIndianCurrency } from './numberToWords';
import SecurePaymentService from '../services/securePaymentService';

// Browser instance management for better performance
class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private isLaunching = false;
  private launchPromise: Promise<Browser> | null = null;

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isLaunching && this.launchPromise) {
      return this.launchPromise;
    }

    this.isLaunching = true;
    this.launchPromise = this.launchBrowser();

    try {
      this.browser = await this.launchPromise;
      return this.browser;
    } finally {
      this.isLaunching = false;
      this.launchPromise = null;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    console.log('🚀 Launching new browser instance...');
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      timeout: 30000 // Reduced from 60s to 30s
    });
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export interface InvoicePDFData {
  invoice: IInvoice;
  seller: IUser;
}

/**
 * Generate Simple UPI QR Code for payment (fallback when secure tokens fail)
 */
const generateSimpleUPIQRCode = async (
  upiId: string,
  amount: number,
  businessName: string,
  invoiceNumber: string
): Promise<string> => {
  try {
    if (!upiId) {
      console.log('❌ No UPI ID provided, returning empty string');
      return '';
    }

    // Create simple UPI URL without secure tokens
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Payment for Invoice ${invoiceNumber}`)}`;

    console.log(`🔍 Generating simple UPI QR code for: ${upiId}, Amount: ${amount}`);

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(upiUrl, {
      width: 120,
      margin: 1,
      color: {
        dark: '#1a202c',
        light: '#ffffff'
      }
    });

    console.log(`✅ Simple UPI QR Code generated successfully, length: ${qrCodeDataUrl.length}`);
    return qrCodeDataUrl;
  } catch (error) {
    console.error('❌ Error generating simple UPI QR code:', error);
    return '';
  }
};

/**
 * Generate Secure UPI QR Code for payment (one-time use) with fallback
 */
const generateSecureUPIQRCode = async (
  invoiceId: string,
  upiId: string,
  amount: number,
  businessName: string,
  invoiceNumber: string
): Promise<string> => {
  try {
    console.log(`🔍 generateSecureUPIQRCode called with:`, {
      invoiceId,
      upiId,
      amount,
      businessName,
      invoiceNumber
    });

    if (!upiId) {
      console.log('❌ No UPI ID provided, returning empty string');
      return '';
    }

    // Try to generate secure payment link with one-time token
    console.log('🔄 Attempting secure payment token generation...');
    try {
      const { qrCodeDataUrl } = await SecurePaymentService.generateSecureUPILink(
        invoiceId,
        upiId,
        businessName,
        amount
      );

      console.log(`✅ Secure QR Code generated successfully, length: ${qrCodeDataUrl.length}`);
      return qrCodeDataUrl;
    } catch (secureError) {
      console.log('⚠️ Secure token generation failed, falling back to simple UPI QR code');
      console.error('Secure error:', secureError instanceof Error ? secureError.message : String(secureError));

      // Fallback to simple UPI QR code
      return await generateSimpleUPIQRCode(upiId, amount, businessName, invoiceNumber);
    }
  } catch (error) {
    console.error('❌ Error in QR code generation:', error);
    // Final fallback to simple UPI QR code
    try {
      return await generateSimpleUPIQRCode(upiId, amount, businessName, invoiceNumber || 'Unknown');
    } catch (fallbackError) {
      console.error('❌ Even fallback QR code generation failed:', fallbackError);
      return '';
    }
  }
};

/**
 * Convert signature file to base64 data URL
 */
const getSignatureDataURL = async (signaturePath: string): Promise<string> => {
  try {
    const fullPath = path.join(process.cwd(), signaturePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ Signature file not found: ${fullPath}`);
      return '';
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const ext = path.extname(signaturePath).toLowerCase();

    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.svg') {
      mimeType = 'image/svg+xml';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    }

    const base64 = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting signature to base64:', error);
    return '';
  }
};

/**
 * Generate HTML template for professional GST invoice
 */
export const generateInvoiceHTML = async (data: InvoicePDFData): Promise<string> => {
  const { invoice, seller } = data;

  // Debug: Log seller data in PDF generation
  console.log(`🔍 PDF Generation - Seller data for invoice ${invoice.invoiceNumber}:`, {
    name: seller.name,
    businessName: seller.businessName,
    userId: seller._id,
    hasSignature: !!seller.signature
  });

  // Generate secure UPI QR code if UPI ID is available
  console.log(`🔍 QR Code Generation Debug for invoice ${invoice.invoiceNumber}:`);
  console.log(`- Seller UPI ID: ${seller.upiId}`);
  console.log(`- Invoice ID: ${(invoice as any)._id.toString()}`);
  console.log(`- Amount: ${invoice.grandTotal}`);
  console.log(`- Business Name: ${seller.businessName || seller.name}`);

  const upiQRCode = seller.upiId ? await generateSecureUPIQRCode(
    (invoice as any)._id.toString(),
    seller.upiId,
    invoice.grandTotal,
    seller.businessName || seller.name,
    invoice.invoiceNumber
  ) : '';

  console.log(`🔍 Generated QR Code Data URL length: ${upiQRCode.length}`);
  console.log(`🔍 QR Code starts with: ${upiQRCode.substring(0, 50)}...`);

  // Generate signature data URL if signature exists
  const signatureDataURL = seller.signature ? await getSignatureDataURL(seller.signature) : '';
  console.log(`🔍 Signature processing for invoice ${invoice.invoiceNumber}:`, {
    hasSignature: !!seller.signature,
    signaturePath: seller.signature,
    signatureDataURLLength: signatureDataURL.length
  });

  // Format currency
  const formatCurrency = (amount: number): string => {
    return formatIndianCurrency(amount);
  };

  // Convert amount to words
  const amountInWords = numberToWords(invoice.grandTotal);

  // Format date
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  // Check if inter-state transaction
  const isInterState = seller.address?.state?.toLowerCase() !== invoice.customer.address.state.toLowerCase();

  // Convert logo to base64 for embedding in HTML
  const getLogoBase64 = (logoPath: string | undefined): string => {
    if (!logoPath) {
      console.log('No logo path provided');
      return '';
    }

    console.log('=== LOGO DEBUG INFO ===');
    console.log('Original logo path:', logoPath);

    const fs = require('fs');

    // If it's a relative path, construct the full file path
    let fullPath: string;
    if (path.isAbsolute(logoPath)) {
      fullPath = logoPath;
    } else {
      fullPath = path.join(process.cwd(), logoPath);
    }

    console.log('Constructed full logo path:', fullPath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log('Logo file does not exist at constructed path:', fullPath);

      // Try alternative paths
      const fileName = path.basename(logoPath);
      const alternativePaths = [
        path.join(process.cwd(), 'uploads', 'logos', fileName),
        path.join(process.cwd(), 'uploads', fileName)
      ];

      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          console.log('✓ Found logo at alternative path:', altPath);
          fullPath = altPath;
          break;
        }
      }

      if (!fs.existsSync(fullPath)) {
        console.log('Logo file not found in any location');
        return '';
      }
    }

    try {
      // Read file and convert to base64
      const fileBuffer = fs.readFileSync(fullPath);
      const fileExtension = path.extname(fullPath).toLowerCase();

      let mimeType = 'image/png'; // default
      if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
        mimeType = 'image/jpeg';
      } else if (fileExtension === '.gif') {
        mimeType = 'image/gif';
      } else if (fileExtension === '.svg') {
        mimeType = 'image/svg+xml';
      }

      const base64String = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64String}`;

      console.log('✓ Successfully converted logo to base64');
      console.log('File size:', fileBuffer.length, 'bytes');
      console.log('MIME type:', mimeType);
      console.log('=== END LOGO DEBUG ===');

      return dataUrl;
    } catch (error) {
      console.error('Error reading logo file:', error);
      console.log('=== END LOGO DEBUG ===');
      return '';
    }
  };
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 11px;
          line-height: 1.5;
          color: #333333;
          background: #ffffff;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .invoice-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 8mm;
          background: white;
          min-height: auto;
          page-break-inside: avoid;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #cccccc;
          background: #ffffff;
        }

        .blockchain-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: #059669;
          color: white;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 7px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .security-info {
          margin-top: 8px;
          padding: 6px 10px;
          background: #ecfdf5;
          border: 1px solid #10b981;
          border-radius: 3px;
          font-size: 8px;
          color: #047857;
          text-align: center;
        }

        .header-left {
          flex: 1;
        }

        .logo-container {
          margin-bottom: 10px;
        }

        .logo-container img {
          max-height: 50px;
          max-width: 180px;
          object-fit: contain;
        }

        .logo-placeholder {
          width: 50px;
          height: 50px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .logo-text {
          color: #333333;
          font-size: 18px;
          font-weight: bold;
        }

        .company-name {
          font-size: 20px;
          font-weight: bold;
          color: #333333;
          margin-bottom: 5px;
        }

        .company-tagline {
          font-size: 11px;
          color: #666666;
          font-weight: normal;
        }

        .header-right {
          text-align: right;
          flex: 1;
        }

        .invoice-title {
          font-size: 28px;
          font-weight: bold;
          color: #333333;
          margin-bottom: 15px;
        }

        .invoice-meta div {
          margin-bottom: 5px;
          font-size: 11px;
          color: #666666;
        }

        .invoice-meta strong {
          color: #333333;
          font-weight: bold;
        }

        .party-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          gap: 15px;
        }

        .seller-details, .buyer-details {
          flex: 1;
          background: #ffffff;
          border: 1px solid #cccccc;
          padding: 10px;
          border-radius: 0;
        }

        .section-title {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 10px;
          color: #333333;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #cccccc;
          padding-bottom: 5px;
        }

        .details-content {
          font-size: 11px;
          line-height: 1.5;
          color: #333333;
        }

        .details-content strong {
          color: #333333;
          font-weight: bold;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          font-size: 9px;
          border: 1px solid #cccccc;
        }

        .items-table th,
        .items-table td {
          padding: 6px 4px;
          text-align: left;
          border-bottom: 1px solid #cccccc;
          border-right: 1px solid #cccccc;
        }

        .items-table th {
          background: #f8f9fa;
          color: #333333;
          font-weight: bold;
          text-align: center;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .items-table .number-cell {
          text-align: right;
          font-weight: normal;
        }

        .items-table tbody td {
          color: #333333;
          font-size: 8px;
        }

        .items-table tbody tr:nth-child(even) {
          background-color: #ffffff;
        }

        .items-table tbody tr:hover {
          background-color: #ffffff;
        }

        .items-table tbody td:last-child {
          border-right: none;
        }

        .items-table th:last-child {
          border-right: none;
        }

        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }

        .totals-table {
          width: 250px;
          border-collapse: collapse;
          border: 1px solid #cccccc;
        }

        .totals-table td {
          padding: 8px 12px;
          font-size: 11px;
          border-bottom: 1px solid #cccccc;
        }

        .totals-table tr:last-child td {
          border-bottom: none;
        }

        .totals-table .label {
          background-color: #f8f9fa;
          font-weight: normal;
          color: #333333;
          width: 70%;
        }

        .totals-table .amount {
          text-align: right;
          font-weight: normal;
          color: #333333;
          background-color: #ffffff;
          width: 30%;
        }

        .grand-total {
          background: #333333 !important;
          color: white !important;
          font-size: 12px !important;
          font-weight: bold !important;
        }

        .grand-total .label,
        .grand-total .amount {
          background: transparent !important;
          color: white !important;
        }

        .footer {
          margin-top: 25px;
          border-top: 1px solid #cccccc;
          padding-top: 20px;
        }

        .terms {
          margin-bottom: 20px;
          background: #f8f9fa;
          padding: 15px;
          border-radius: 0;
          border: 1px solid #cccccc;
        }

        .terms .section-title {
          color: #333333;
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 11px;
          border: none;
          padding: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .terms p {
          color: #333333;
          font-size: 10px;
          line-height: 1.5;
          margin: 0;
        }

        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          margin-bottom: 20px;
          gap: 50px;
        }

        .signature-box {
          flex: 1;
          text-align: center;
          min-height: 60px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .signature-line {
          border-top: 1px solid #333333;
          margin-top: 40px;
          padding-top: 8px;
          font-weight: normal;
          color: #333333;
          font-size: 10px;
        }

        .signature-image {
          max-width: 300px;
          max-height: 120px;
          margin-bottom: 10px;
          object-fit: contain;
        }

        .signature-with-image {
          margin-top: 5px;
        }



        .invonest-branding {
          text-align: center;
          margin-top: 10px;
          padding: 8px;
          border-top: 1px solid #cccccc;
          background: #f8f9fa;
          color: #666666;
          font-size: 9px;
          font-weight: normal;
        }

        .invonest-branding strong {
          color: #333333;
          font-weight: bold;
        }

        .payment-section {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border: 1px solid #cccccc;
          border-radius: 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
        }

        .payment-info {
          flex: 1;
        }

        .payment-title {
          font-weight: bold;
          font-size: 11px;
          color: #333333;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .payment-details {
          font-size: 10px;
          color: #333333;
          line-height: 1.5;
        }

        .payment-details strong {
          color: #333333;
          font-weight: bold;
        }

        .qr-section {
          text-align: center;
          min-width: 100px;
        }

        .qr-code {
          width: 90px;
          height: 90px;
          border: 1px solid #cccccc;
          border-radius: 0;
        }

        .qr-label {
          font-size: 9px;
          color: #666666;
          margin-top: 5px;
          font-weight: normal;
        }

        .qr-security-note {
          font-size: 8px;
          color: #dc3545;
          margin-top: 3px;
          font-weight: normal;
          text-align: center;
        }

        .amount-words {
          margin-top: 8px;
          margin-bottom: 8px;
          padding: 8px 12px;
          background: #f8f9fa;
          border: 1px solid #cccccc;
          border-radius: 0;
          font-size: 9px;
          color: #333333;
          font-weight: normal;
        }

        .amount-words-label {
          font-size: 9px;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }

        @media print {
          .invoice-container {
            padding: 12mm;
          }
          body {
            font-size: 11px;
          }
          .items-table {
            font-size: 10px;
          }
          .items-table th,
          .items-table td {
            padding: 8px 6px;
          }
          .header {
            margin-bottom: 20mm;
          }
          .party-details {
            margin-bottom: 20mm;
          }
          .totals-section {
            margin-bottom: 20mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Blockchain Badge -->
        ${invoice.hash ? `
        <div class="blockchain-badge">
          🔒 BLOCKCHAIN SECURED
        </div>
        ` : ''}

        <!-- Header -->
        <div class="header">
          <div class="header-left">
            ${seller.logo && getLogoBase64(seller.logo) ? `
              <div class="logo-container">
                <img src="${getLogoBase64(seller.logo)}" alt="Company Logo" />
              </div>
            ` : `
              <div class="logo-placeholder">
                <div class="logo-text">${(seller.businessName || seller.name).charAt(0).toUpperCase()}</div>
              </div>
            `}
            <div class="company-name">${seller.businessName || seller.name}</div>
            ${seller.businessName ? `<div class="company-tagline">Professional Services</div>` : ''}
          </div>
          <div class="header-right">
            <div class="invoice-title">${invoice.invoiceType === 'gst' ? 'TAX INVOICE' : 'INVOICE'}</div>
            <div class="invoice-meta">
              <div><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
              <div><strong>Date:</strong> ${formatDate(invoice.invoiceDate)}</div>
              ${invoice.dueDate ? `<div><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</div>` : ''}
              <div><strong>Status:</strong> ${invoice.status.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <!-- Security Information -->
        ${invoice.hash ? `
        <div class="security-info">
          <strong>🔐 Blockchain Verified:</strong> This invoice is cryptographically secured and tamper-proof.
        </div>
        ` : ''}

        <!-- Party Details -->
        <div class="party-details">
          <div class="seller-details">
            <div class="section-title">Seller Details</div>
            <div class="details-content">
              <strong>${seller.businessName || seller.name}</strong><br>
              ${seller.address?.street || ''}<br>
              ${seller.address?.city || ''}, ${seller.address?.state || ''} - ${seller.address?.pincode || ''}<br>
              ${seller.address?.country || 'India'}<br>
              ${seller.gstNumber ? `<strong>GSTIN:</strong> ${seller.gstNumber}<br>` : ''}
              ${seller.email ? `<strong>Email:</strong> ${seller.email}<br>` : ''}
              ${seller.phone ? `<strong>Phone:</strong> ${seller.phone}` : ''}
            </div>
          </div>

          <div class="buyer-details">
            <div class="section-title">Buyer Details</div>
            <div class="details-content">
              <strong>${invoice.customer.name}</strong><br>
              ${invoice.customer.address.street}<br>
              ${invoice.customer.address.city}, ${invoice.customer.address.state} - ${invoice.customer.address.pincode}<br>
              ${invoice.customer.address.country}<br>
              ${invoice.customer.gstNumber ? `<strong>GSTIN:</strong> ${invoice.customer.gstNumber}<br>` : ''}
              ${invoice.customer.email ? `<strong>Email:</strong> ${invoice.customer.email}<br>` : ''}
              ${invoice.customer.phone ? `<strong>Phone:</strong> ${invoice.customer.phone}` : ''}
            </div>
          </div>
        </div>


        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 3%;">#</th>
              <th style="width: 30%;">Description</th>
              ${invoice.invoiceType === 'gst' ? `<th style="width: 7%;">HSN</th>` : ''}
              <th style="width: 6%;">Qty</th>
              <th style="width: 10%;">Rate</th>
              ${invoice.totalDiscount > 0 ? `<th style="width: 5%;">Disc%</th>` : ''}
              <th style="width: 10%;">Amount</th>
              ${invoice.invoiceType === 'gst' ? (isInterState ?
                `<th style="width: 7%;">IGST%</th>
                 <th style="width: 10%;">Tax</th>` :
                `<th style="width: 7%;">CGST%</th>
                 <th style="width: 7%;">SGST%</th>
                 <th style="width: 10%;">Tax</th>`) : ''
              }
              <th style="width: 12%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((item, index) => `
              <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${item.description}</td>
                ${invoice.invoiceType === 'gst' ? `<td style="text-align: center;">${item.hsn || '-'}</td>` : ''}
                <td class="number-cell">${item.quantity}</td>
                <td class="number-cell">${formatCurrency(item.rate)}</td>
                ${invoice.totalDiscount > 0 ? `<td class="number-cell">${item.discount}%</td>` : ''}
                <td class="number-cell">${formatCurrency(item.taxableAmount)}</td>
                ${invoice.invoiceType === 'gst' ? (isInterState ?
                  `<td class="number-cell">${item.igstRate}%</td>
                   <td class="number-cell">${formatCurrency(item.igstAmount)}</td>` :
                  `<td class="number-cell">${item.cgstRate}%</td>
                   <td class="number-cell">${item.sgstRate}%</td>
                   <td class="number-cell">${formatCurrency(item.cgstAmount + item.sgstAmount)}</td>`) : ''
                }
                <td class="number-cell" style="font-weight: 600;">${formatCurrency(item.totalAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Amount in Words -->
        <div class="amount-words">
          <div class="amount-words-label">Amount in Words</div>
          <div>${amountInWords}</div>
        </div>

        <!-- Totals -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="label">Subtotal</td>
              <td class="amount">${formatCurrency(invoice.subtotal)}</td>
            </tr>
            ${invoice.totalDiscount > 0 ? `
            <tr>
              <td class="label">Total Discount</td>
              <td class="amount" style="color: #e53e3e;">-${formatCurrency(invoice.totalDiscount)}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="label">Taxable Amount</td>
              <td class="amount">${formatCurrency(invoice.taxableAmount)}</td>
            </tr>
            ${invoice.invoiceType === 'gst' ? (
              !isInterState ? `
              <tr>
                <td class="label">CGST @ ${invoice.items[0]?.cgstRate || 0}%</td>
                <td class="amount">${formatCurrency(invoice.totalCGST)}</td>
              </tr>
              <tr>
                <td class="label">SGST @ ${invoice.items[0]?.sgstRate || 0}%</td>
                <td class="amount">${formatCurrency(invoice.totalSGST)}</td>
              </tr>
              ` : `
              <tr>
                <td class="label">IGST @ ${invoice.items[0]?.igstRate || 0}%</td>
                <td class="amount">${formatCurrency(invoice.totalIGST)}</td>
              </tr>
              `
            ) : ''}
            ${invoice.invoiceType === 'gst' && invoice.totalTax > 0 ? `
            <tr>
              <td class="label">Total Tax</td>
              <td class="amount">${formatCurrency(invoice.totalTax)}</td>
            </tr>
            ` : ''}
            <tr class="grand-total">
              <td class="label">Grand Total</td>
              <td class="amount">${formatCurrency(invoice.grandTotal)}</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div class="footer">
          ${(invoice.terms || invoice.notes) ? `
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            ${invoice.terms ? `
            <div class="terms" style="flex: 1;">
              <div class="section-title">Terms</div>
              <p>${invoice.terms}</p>
            </div>
            ` : ''}

            ${invoice.notes ? `
            <div class="terms" style="flex: 1;">
              <div class="section-title">Notes</div>
              <p>${invoice.notes}</p>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <!-- Payment Information -->
          ${(seller.upiId || seller.bankDetails?.accountNumber) ? `
          <div class="payment-section">
            <div class="payment-info">
              <div class="payment-title">Payment Information</div>
              <div class="payment-details">
                ${seller.upiId ? `
                  <strong>UPI ID:</strong> ${seller.upiId}<br>
                ` : ''}
                ${seller.bankDetails?.accountNumber ? `
                  <strong>Bank:</strong> ${seller.bankDetails.bankName || 'N/A'}<br>
                  <strong>Account:</strong> ${seller.bankDetails.accountNumber}<br>
                  <strong>IFSC:</strong> ${seller.bankDetails.ifscCode || 'N/A'}<br>
                  <strong>Account Holder:</strong> ${seller.bankDetails.accountHolderName || seller.businessName || seller.name}
                ` : ''}
              </div>
            </div>
            ${upiQRCode ? `
            <div class="qr-section">
              <img src="${upiQRCode}" alt="Secure UPI QR Code" class="qr-code" />
              <div class="qr-label">Scan to Pay</div>
              <div class="qr-security-note">⚠️ One-time use only</div>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Customer Signature</div>
            </div>
            <div class="signature-box">
              ${signatureDataURL ? `
                <img src="${signatureDataURL}" alt="Digital Signature" class="signature-image" />
                <div class="signature-line signature-with-image">Authorized Signatory</div>
              ` : `
                <div class="signature-line">Authorized Signatory</div>
              `}
            </div>
          </div>

          <div class="invonest-branding">
            <p>🚀 Powered by <strong>InvoNest</strong> - Professional Invoice Management System | www.invonest.com</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate PDF from invoice data with optimized single-page layout
 */
export const generateInvoicePDF = async (data: InvoicePDFData): Promise<Buffer> => {
  const html = await generateInvoiceHTML(data);
  const browserManager = BrowserManager.getInstance();

  let page: Page | null = null;
  try {
    console.log('📄 Generating PDF for invoice:', data.invoice.invoiceNumber);
    const startTime = Date.now();

    // Get browser instance (reused if available)
    const browser = await browserManager.getBrowser();
    page = await browser.newPage();

    // Set viewport for better rendering
    await page.setViewport({ width: 1200, height: 1600 });

    // Optimized content loading with reduced timeout
    await page.setContent(html, {
      waitUntil: 'domcontentloaded', // Changed from 'networkidle0' for faster loading
      timeout: 15000 // Reduced from 30s to 15s
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      scale: 0.75, // Reduce scale significantly to fit everything on one page
      margin: {
        top: '5mm',
        right: '5mm',
        bottom: '5mm',
        left: '5mm'
      },
      displayHeaderFooter: false
    });

    const endTime = Date.now();
    console.log(`✅ PDF generated in ${endTime - startTime}ms`);
    return Buffer.from(pdf);

  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Only close the page, not the browser (for reuse)
    if (page) {
      await page.close();
    }
  }
};

// Graceful shutdown function
export const closePDFBrowser = async (): Promise<void> => {
  const browserManager = BrowserManager.getInstance();
  await browserManager.closeBrowser();
  console.log('🔒 PDF browser closed');
};
