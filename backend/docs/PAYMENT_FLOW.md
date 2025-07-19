# Invoice Payment Flow Documentation

## Overview
This document explains the complete payment flow after a customer scans the UPI QR code on an invoice.

## Payment Flow Steps

### 1. Customer Scans QR Code
- Customer receives invoice via email or download
- Invoice contains UPI QR code with payment details
- QR code format: `upi://pay?pa=UPI_ID&pn=BUSINESS_NAME&am=AMOUNT&cu=INR&tn=Payment for Invoice INV-XXXX`

### 2. Customer Makes Payment
- Customer's UPI app opens with pre-filled payment details
- Customer confirms and makes the payment
- UPI system processes the payment

### 3. Payment Confirmation Options

#### Option A: Manual Recording (Current Implementation)
```bash
# Business owner manually records payment
POST /api/payments/record
{
  "invoiceId": "invoice_id",
  "amount": 1000.00,
  "paymentMethod": "upi",
  "upiTransactionId": "UPI_TXN_ID",
  "upiId": "customer@upi",
  "customerName": "Customer Name",
  "customerEmail": "customer@email.com",
  "notes": "Payment received via UPI"
}
```

#### Option B: Webhook Integration (Future Enhancement)
```bash
# Payment gateway sends webhook
POST /api/payments/webhook/upi
{
  "paymentId": "PAY-XXXX",
  "transactionId": "UPI_TXN_ID",
  "amount": 1000.00,
  "status": "completed",
  "gatewayResponse": { ... }
}
```

### 4. System Processing
1. **Payment Record Created**
   - Unique payment ID generated
   - Receipt number generated
   - Payment status set to 'pending' or 'completed'

2. **Invoice Status Updated**
   - Invoice `paymentStatus` changed to 'paid'
   - Invoice `status` changed to 'paid'
   - `paymentDate` set to current date

3. **Receipt Generation**
   - Payment receipt PDF generated
   - Receipt stored with unique receipt number

4. **Email Notifications**
   - Confirmation email sent to customer
   - Notification email sent to business owner

## API Endpoints

### Record Payment
```
POST /api/payments/record
Authorization: Bearer <token>
```

### Verify Payment
```
POST /api/payments/verify
Authorization: Bearer <token>
```

### Get Payment Details
```
GET /api/payments/:paymentId
Authorization: Bearer <token>
```

### Get Invoice Payments
```
GET /api/payments/invoice/:invoiceId
Authorization: Bearer <token>
```

### Get User Payments
```
GET /api/payments/user/all
Authorization: Bearer <token>
```

### Manual Verify Payment
```
POST /api/payments/:paymentId/verify-manual
Authorization: Bearer <token>
```

## Database Schema

### InvoicePayment Model
```javascript
{
  invoiceId: ObjectId,
  userId: ObjectId,
  paymentId: String, // Unique payment ID
  transactionId: String, // UPI/Bank transaction ID
  amount: Number,
  paymentMethod: String, // 'upi', 'bank_transfer', etc.
  status: String, // 'pending', 'completed', 'failed'
  receiptNumber: String, // Auto-generated
  customerName: String,
  customerEmail: String,
  paymentDate: Date,
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Frontend Integration

### 1. Payment Status Display
```javascript
// Show payment status on invoice
const PaymentStatus = ({ invoice }) => {
  return (
    <div className="payment-status">
      {invoice.paymentStatus === 'paid' ? (
        <span className="paid">✅ Paid</span>
      ) : (
        <span className="pending">⏳ Pending</span>
      )}
    </div>
  );
};
```

### 2. Record Payment Form
```javascript
// Form to manually record payment
const RecordPaymentForm = ({ invoiceId }) => {
  const recordPayment = async (paymentData) => {
    const response = await fetch('/api/payments/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(paymentData)
    });
    
    if (response.ok) {
      // Payment recorded successfully
      // Refresh invoice data
    }
  };
  
  // Form JSX here...
};
```

### 3. Payment History
```javascript
// Display payment history for invoice
const PaymentHistory = ({ invoiceId }) => {
  const [payments, setPayments] = useState([]);
  
  useEffect(() => {
    fetch(`/api/payments/invoice/${invoiceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setPayments(data.data));
  }, [invoiceId]);
  
  // Render payments list...
};
```

## Email Templates

### Customer Confirmation Email
```
Subject: Payment Confirmation - Invoice #INV-XXXX

Dear [Customer Name],

Your payment has been successfully received!

Payment Details:
- Invoice Number: INV-XXXX
- Amount Paid: ₹1,000.00
- Payment Method: UPI
- Transaction ID: UPI_TXN_ID
- Receipt Number: RCP-XXXX

Thank you for your business!

Best regards,
[Business Name]
```

### Business Owner Notification
```
Subject: Payment Received - Invoice #INV-XXXX

Payment received for Invoice #INV-XXXX

Details:
- Customer: [Customer Name]
- Amount: ₹1,000.00
- Payment Method: UPI
- Transaction ID: UPI_TXN_ID
- Receipt Number: RCP-XXXX

The invoice has been marked as paid.
```

## Future Enhancements

1. **Real-time Payment Gateway Integration**
   - Razorpay, PayU, Cashfree webhooks
   - Automatic payment verification
   - Real-time status updates

2. **Payment Links**
   - Generate secure payment links
   - Send via SMS/WhatsApp
   - Track payment link clicks

3. **Partial Payments**
   - Support for partial payments
   - Payment installments
   - Balance tracking

4. **Payment Analytics**
   - Payment success rates
   - Average payment time
   - Payment method preferences

5. **Advanced Receipts**
   - Branded receipt templates
   - Digital receipt delivery
   - Receipt verification QR codes

## Testing

### Manual Testing Steps
1. Create an invoice with UPI ID in profile
2. Download/email the invoice
3. Verify QR code contains correct payment details
4. Use `/api/payments/record` to simulate payment
5. Check invoice status updates
6. Verify email notifications
7. Check payment history

### API Testing
```bash
# Test payment recording
curl -X POST http://localhost:5000/api/payments/record \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "INVOICE_ID",
    "amount": 1000.00,
    "paymentMethod": "upi",
    "upiTransactionId": "TEST_TXN_123",
    "customerName": "Test Customer"
  }'
```

This payment flow provides a complete solution for handling invoice payments with proper tracking, notifications, and record-keeping.
