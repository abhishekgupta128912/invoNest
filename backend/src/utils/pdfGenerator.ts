import puppeteer from 'puppeteer';
import { IInvoice } from '../models/Invoice';
import { IUser } from '../models/User';

export interface InvoicePDFData {
  invoice: IInvoice;
  seller: IUser;
}

/**
 * Generate HTML template for GST invoice
 */
export const generateInvoiceHTML = (data: InvoicePDFData): string => {
  const { invoice, seller } = data;
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
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
          font-family: 'Arial', sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }
        
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        
        .header h1 {
          font-size: 24px;
          color: #2563eb;
          margin-bottom: 5px;
        }
        
        .header h2 {
          font-size: 18px;
          color: #333;
          margin-bottom: 10px;
        }
        
        .invoice-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        
        .seller-details, .buyer-details {
          width: 48%;
        }
        
        .section-title {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 8px;
          color: #2563eb;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 2px;
        }
        
        .details-content {
          margin-bottom: 15px;
        }
        
        .invoice-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          background: #f8fafc;
          padding: 10px;
          border-radius: 5px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }
        
        .items-table th,
        .items-table td {
          border: 1px solid #d1d5db;
          padding: 8px 4px;
          text-align: left;
        }
        
        .items-table th {
          background-color: #f3f4f6;
          font-weight: bold;
          text-align: center;
        }
        
        .items-table .number-cell {
          text-align: right;
        }
        
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }
        
        .totals-table {
          width: 300px;
          border-collapse: collapse;
        }
        
        .totals-table td {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
        }
        
        .totals-table .label {
          background-color: #f8fafc;
          font-weight: bold;
        }
        
        .totals-table .amount {
          text-align: right;
          font-weight: bold;
        }
        
        .grand-total {
          background-color: #2563eb !important;
          color: white !important;
          font-size: 14px;
        }
        
        .footer {
          margin-top: 30px;
          border-top: 1px solid #e5e7eb;
          padding-top: 15px;
        }
        
        .terms {
          margin-bottom: 15px;
        }
        
        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
        }
        
        .signature-box {
          width: 200px;
          text-align: center;
        }
        
        .signature-line {
          border-top: 1px solid #333;
          margin-top: 50px;
          padding-top: 5px;
        }
        
        .hash-section {
          margin-top: 20px;
          font-size: 10px;
          color: #6b7280;
          text-align: center;
        }
        
        @media print {
          .invoice-container {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <h1>InvoNest</h1>
          <h2>TAX INVOICE</h2>
        </div>
        
        <!-- Invoice Details -->
        <div class="invoice-details">
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
        
        <!-- Invoice Meta -->
        <div class="invoice-meta">
          <div>
            <strong>Invoice No:</strong> ${invoice.invoiceNumber}<br>
            <strong>Invoice Date:</strong> ${formatDate(invoice.invoiceDate)}
          </div>
          <div>
            ${invoice.dueDate ? `<strong>Due Date:</strong> ${formatDate(invoice.dueDate)}<br>` : ''}
            <strong>Status:</strong> ${invoice.status.toUpperCase()}
          </div>
        </div>
        
        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;">S.No</th>
              <th style="width: 25%;">Description</th>
              <th style="width: 8%;">HSN/SAC</th>
              <th style="width: 8%;">Qty</th>
              <th style="width: 6%;">Unit</th>
              <th style="width: 10%;">Rate</th>
              <th style="width: 8%;">Discount</th>
              <th style="width: 10%;">Taxable Amount</th>
              ${isInterState ? 
                `<th style="width: 8%;">IGST Rate</th>
                 <th style="width: 12%;">IGST Amount</th>` :
                `<th style="width: 6%;">CGST Rate</th>
                 <th style="width: 8%;">CGST Amount</th>
                 <th style="width: 6%;">SGST Rate</th>
                 <th style="width: 8%;">SGST Amount</th>`
              }
              <th style="width: 12%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((item, index) => `
              <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${item.description}</td>
                <td style="text-align: center;">${item.hsn}</td>
                <td class="number-cell">${item.quantity}</td>
                <td style="text-align: center;">${item.unit}</td>
                <td class="number-cell">${formatCurrency(item.rate)}</td>
                <td class="number-cell">${item.discount}%</td>
                <td class="number-cell">${formatCurrency(item.taxableAmount)}</td>
                ${isInterState ?
                  `<td class="number-cell">${item.igstRate}%</td>
                   <td class="number-cell">${formatCurrency(item.igstAmount)}</td>` :
                  `<td class="number-cell">${item.cgstRate}%</td>
                   <td class="number-cell">${formatCurrency(item.cgstAmount)}</td>
                   <td class="number-cell">${item.sgstRate}%</td>
                   <td class="number-cell">${formatCurrency(item.sgstAmount)}</td>`
                }
                <td class="number-cell"><strong>${formatCurrency(item.totalAmount)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="label">Subtotal:</td>
              <td class="amount">${formatCurrency(invoice.subtotal)}</td>
            </tr>
            ${invoice.totalDiscount > 0 ? `
            <tr>
              <td class="label">Total Discount:</td>
              <td class="amount">-${formatCurrency(invoice.totalDiscount)}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="label">Taxable Amount:</td>
              <td class="amount">${formatCurrency(invoice.taxableAmount)}</td>
            </tr>
            ${!isInterState ? `
            <tr>
              <td class="label">Total CGST:</td>
              <td class="amount">${formatCurrency(invoice.totalCGST)}</td>
            </tr>
            <tr>
              <td class="label">Total SGST:</td>
              <td class="amount">${formatCurrency(invoice.totalSGST)}</td>
            </tr>
            ` : `
            <tr>
              <td class="label">Total IGST:</td>
              <td class="amount">${formatCurrency(invoice.totalIGST)}</td>
            </tr>
            `}
            <tr>
              <td class="label">Total Tax:</td>
              <td class="amount">${formatCurrency(invoice.totalTax)}</td>
            </tr>
            <tr class="grand-total">
              <td class="label">Grand Total:</td>
              <td class="amount">${formatCurrency(invoice.grandTotal)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          ${invoice.terms ? `
          <div class="terms">
            <div class="section-title">Terms & Conditions</div>
            <p>${invoice.terms}</p>
          </div>
          ` : ''}
          
          ${invoice.notes ? `
          <div class="terms">
            <div class="section-title">Notes</div>
            <p>${invoice.notes}</p>
          </div>
          ` : ''}
          
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Customer Signature</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Authorized Signatory</div>
            </div>
          </div>
          
          <div class="hash-section">
            <strong>Invoice Hash (Blockchain Integrity):</strong><br>
            <code>${invoice.hash}</code><br>
            <small>This invoice is digitally signed and tamper-proof</small>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate PDF from invoice data
 */
export const generateInvoicePDF = async (data: InvoicePDFData): Promise<Buffer> => {
  const html = generateInvoiceHTML(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};
