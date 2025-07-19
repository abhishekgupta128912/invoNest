/**
 * Convert numbers to words (Indian numbering system)
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const scales = [
  '', 'Thousand', 'Lakh', 'Crore'
];

function convertHundreds(num: number): string {
  let result = '';
  
  if (num >= 100) {
    result += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  
  if (num >= 20) {
    result += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  
  if (num > 0) {
    result += ones[num] + ' ';
  }
  
  return result.trim();
}

function convertToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  let result = '';
  let scaleIndex = 0;
  
  // Handle crores
  if (num >= 10000000) {
    const crores = Math.floor(num / 10000000);
    result += convertHundreds(crores) + ' Crore ';
    num %= 10000000;
  }
  
  // Handle lakhs
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    result += convertHundreds(lakhs) + ' Lakh ';
    num %= 100000;
  }
  
  // Handle thousands
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    result += convertHundreds(thousands) + ' Thousand ';
    num %= 1000;
  }
  
  // Handle hundreds, tens, and ones
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

export function numberToWords(amount: number, currency: string = 'Rupees'): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  
  let result = convertToWords(integerPart);
  
  if (result) {
    result += ` ${currency}`;
  }
  
  if (decimalPart > 0) {
    result += ` and ${convertToWords(decimalPart)} Paise`;
  }
  
  result += ' Only';
  
  return result;
}

export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
