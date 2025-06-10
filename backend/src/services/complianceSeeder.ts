import { ComplianceDeadline } from '../models/Compliance';

const indianComplianceDeadlines = [
  // GST Returns
  {
    title: 'GSTR-1 Filing',
    description: 'Monthly return for outward supplies of goods and services',
    type: 'gst',
    category: 'filing',
    dueDate: new Date(2024, 0, 11), // 11th of every month
    frequency: 'monthly',
    applicableFor: ['Regular Taxpayer', 'Composition Dealer'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '₹200 per day (max ₹5,000)',
      interestRate: '18% per annum',
      additionalCharges: 'Late fee may apply'
    },
    resources: {
      officialLink: 'https://www.gst.gov.in/',
      formNumber: 'GSTR-1'
    }
  },
  {
    title: 'GSTR-3B Filing',
    description: 'Monthly summary return with tax payment',
    type: 'gst',
    category: 'filing',
    dueDate: new Date(2024, 0, 20), // 20th of every month
    frequency: 'monthly',
    applicableFor: ['Regular Taxpayer'],
    priority: 'critical',
    penaltyInfo: {
      lateFilingPenalty: '₹50 per day per act (max ₹5,000)',
      interestRate: '18% per annum on tax due',
      additionalCharges: 'Interest on delayed payment'
    },
    resources: {
      officialLink: 'https://www.gst.gov.in/',
      formNumber: 'GSTR-3B'
    }
  },
  {
    title: 'GSTR-4 Filing (Quarterly)',
    description: 'Quarterly return for composition dealers',
    type: 'gst',
    category: 'filing',
    dueDate: new Date(2024, 3, 18), // 18th of month following quarter
    frequency: 'quarterly',
    applicableFor: ['Composition Dealer'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '₹200 per day (max ₹5,000)',
      interestRate: '18% per annum',
      additionalCharges: 'Late fee may apply'
    },
    resources: {
      officialLink: 'https://www.gst.gov.in/',
      formNumber: 'GSTR-4'
    }
  },
  {
    title: 'GSTR-9 Annual Return',
    description: 'Annual return for regular taxpayers',
    type: 'gst',
    category: 'return',
    dueDate: new Date(2024, 11, 31), // 31st December
    frequency: 'annually',
    applicableFor: ['Regular Taxpayer'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '0.25% of turnover or ₹25,000 whichever is higher',
      interestRate: '18% per annum',
      additionalCharges: 'Additional penalty may apply'
    },
    resources: {
      officialLink: 'https://www.gst.gov.in/',
      formNumber: 'GSTR-9'
    }
  },

  // TDS Returns
  {
    title: 'TDS Return Filing - Form 24Q',
    description: 'Quarterly TDS return for salary payments',
    type: 'tds',
    category: 'filing',
    dueDate: new Date(2024, 4, 31), // 31st May for Q4
    frequency: 'quarterly',
    applicableFor: ['Employer', 'Deductor'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '₹200 per day',
      interestRate: '1.5% per month',
      additionalCharges: 'Disallowance of deduction'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: '24Q'
    }
  },
  {
    title: 'TDS Return Filing - Form 26Q',
    description: 'Quarterly TDS return for non-salary payments',
    type: 'tds',
    category: 'filing',
    dueDate: new Date(2024, 4, 31), // 31st May for Q4
    frequency: 'quarterly',
    applicableFor: ['Deductor'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '₹200 per day',
      interestRate: '1.5% per month',
      additionalCharges: 'Disallowance of deduction'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: '26Q'
    }
  },
  {
    title: 'TDS Payment',
    description: 'Monthly TDS payment to government',
    type: 'tds',
    category: 'payment',
    dueDate: new Date(2024, 0, 7), // 7th of every month
    frequency: 'monthly',
    applicableFor: ['Deductor'],
    priority: 'critical',
    penaltyInfo: {
      lateFilingPenalty: '1.5% per month or part thereof',
      interestRate: '1.5% per month',
      additionalCharges: 'Prosecution may be initiated'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: 'Challan 281'
    }
  },

  // Income Tax
  {
    title: 'Income Tax Return Filing - ITR',
    description: 'Annual income tax return filing',
    type: 'income_tax',
    category: 'filing',
    dueDate: new Date(2024, 6, 31), // 31st July
    frequency: 'annually',
    applicableFor: ['Individual', 'Company', 'Partnership'],
    priority: 'critical',
    penaltyInfo: {
      lateFilingPenalty: '₹5,000 (₹1,000 for income < ₹5 lakh)',
      interestRate: '1% per month',
      additionalCharges: 'Additional penalty under 271F'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: 'ITR-1/2/3/4'
    }
  },
  {
    title: 'Advance Tax Payment - Q1',
    description: 'First installment of advance tax (15% of tax liability)',
    type: 'income_tax',
    category: 'payment',
    dueDate: new Date(2024, 5, 15), // 15th June
    frequency: 'annually',
    applicableFor: ['Individual', 'Company'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: 'Interest @ 1% per month',
      interestRate: '1% per month',
      additionalCharges: 'Penalty under 234C'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: 'Challan 280'
    }
  },
  {
    title: 'Advance Tax Payment - Q2',
    description: 'Second installment of advance tax (45% of tax liability)',
    type: 'income_tax',
    category: 'payment',
    dueDate: new Date(2024, 8, 15), // 15th September
    frequency: 'annually',
    applicableFor: ['Individual', 'Company'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: 'Interest @ 1% per month',
      interestRate: '1% per month',
      additionalCharges: 'Penalty under 234C'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: 'Challan 280'
    }
  },

  // PF & ESI
  {
    title: 'PF Return Filing',
    description: 'Monthly Provident Fund return filing',
    type: 'pf',
    category: 'filing',
    dueDate: new Date(2024, 0, 25), // 25th of every month
    frequency: 'monthly',
    applicableFor: ['Employer'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '₹75 per day per default',
      interestRate: '12% per annum',
      additionalCharges: 'Damage charges may apply'
    },
    resources: {
      officialLink: 'https://www.epfindia.gov.in/',
      formNumber: 'ECR'
    }
  },
  {
    title: 'ESI Return Filing',
    description: 'Monthly Employee State Insurance return filing',
    type: 'esi',
    category: 'filing',
    dueDate: new Date(2024, 0, 21), // 21st of every month
    frequency: 'monthly',
    applicableFor: ['Employer'],
    priority: 'high',
    penaltyInfo: {
      lateFilingPenalty: '5% of contribution amount',
      interestRate: '12% per annum',
      additionalCharges: 'Penalty and prosecution'
    },
    resources: {
      officialLink: 'https://www.esic.in/',
      formNumber: 'Half Yearly Return'
    }
  }
];

export async function seedComplianceDeadlines() {
  try {
    console.log('Seeding compliance deadlines...');
    
    // Check if deadlines already exist
    const existingCount = await ComplianceDeadline.countDocuments();
    if (existingCount > 0) {
      console.log(`${existingCount} compliance deadlines already exist. Skipping seed.`);
      return;
    }

    // Insert all compliance deadlines
    const result = await ComplianceDeadline.insertMany(indianComplianceDeadlines);
    console.log(`Successfully seeded ${result.length} compliance deadlines`);
    
    return result;
  } catch (error) {
    console.error('Error seeding compliance deadlines:', error);
    throw error;
  }
}

export async function updateComplianceDeadlines() {
  try {
    console.log('Updating compliance deadlines for current year...');
    
    const currentYear = new Date().getFullYear();
    const deadlines = await ComplianceDeadline.find({ isActive: true });
    
    for (const deadline of deadlines) {
      // Update due dates to current year
      const newDueDate = new Date(deadline.dueDate);
      newDueDate.setFullYear(currentYear);
      
      // Calculate next due date based on frequency
      let nextDueDate = new Date(newDueDate);
      const today = new Date();
      
      while (nextDueDate < today) {
        switch (deadline.frequency) {
          case 'monthly':
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDueDate.setMonth(nextDueDate.getMonth() + 3);
            break;
          case 'annually':
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
            break;
        }
      }
      
      deadline.nextDueDate = nextDueDate;
      deadline.lastUpdated = new Date();
      await deadline.save();
    }
    
    console.log(`Updated ${deadlines.length} compliance deadlines`);
  } catch (error) {
    console.error('Error updating compliance deadlines:', error);
    throw error;
  }
}
