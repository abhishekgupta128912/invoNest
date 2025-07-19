import mongoose from 'mongoose';
import { ComplianceDeadline, UserCompliance } from '../models/Compliance';
import User from '../models/User';

// Sample compliance deadlines
const sampleCompliances = [
  {
    title: 'GST Return Filing (GSTR-1)',
    description: 'Monthly GST return for outward supplies',
    type: 'gst',
    category: 'tax',
    dueDate: new Date('2025-01-11'),
    frequency: 'monthly',
    priority: 'high',
    applicableFor: ['business', 'freelancer'],
    penaltyInfo: {
      lateFilingPenalty: '₹200 per day (max ₹5,000)',
      interestRate: '18% per annum'
    },
    resources: {
      officialLink: 'https://www.gst.gov.in/',
      formNumber: 'GSTR-1'
    },
    isActive: true
  },
  {
    title: 'GST Return Filing (GSTR-3B)',
    description: 'Monthly summary return',
    type: 'gst',
    category: 'tax',
    dueDate: new Date('2025-01-20'),
    frequency: 'monthly',
    priority: 'high',
    applicableFor: ['business', 'freelancer'],
    penaltyInfo: {
      lateFilingPenalty: '₹50 per day per return',
      interestRate: '18% per annum'
    },
    resources: {
      officialLink: 'https://www.gst.gov.in/',
      formNumber: 'GSTR-3B'
    },
    isActive: true
  },
  {
    title: 'TDS Return Filing (24Q)',
    description: 'Quarterly TDS return for salary payments',
    type: 'tds',
    category: 'tax',
    dueDate: new Date('2025-01-31'),
    frequency: 'quarterly',
    priority: 'medium',
    applicableFor: ['business'],
    penaltyInfo: {
      lateFilingPenalty: '₹200 per day',
      interestRate: '1.5% per month'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: '24Q'
    },
    isActive: true
  },
  {
    title: 'Income Tax Return Filing',
    description: 'Annual income tax return',
    type: 'income_tax',
    category: 'tax',
    dueDate: new Date('2025-07-31'),
    frequency: 'yearly',
    priority: 'high',
    applicableFor: ['individual', 'business', 'freelancer'],
    penaltyInfo: {
      lateFilingPenalty: '₹5,000 (up to ₹1 lakh income), ₹10,000 (above ₹1 lakh)',
      interestRate: '1% per month'
    },
    resources: {
      officialLink: 'https://incometaxindia.gov.in/',
      formNumber: 'ITR-1/ITR-3'
    },
    isActive: true
  }
];

async function seedComplianceData() {
  try {
    console.log('🌱 Starting compliance data seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/invonest');
    console.log('📦 Connected to MongoDB');

    // Clear existing compliance data
    await ComplianceDeadline.deleteMany({});
    await UserCompliance.deleteMany({});
    console.log('🧹 Cleared existing compliance data');

    // Create compliance deadlines
    const createdCompliances = await ComplianceDeadline.insertMany(sampleCompliances);
    console.log(`✅ Created ${createdCompliances.length} compliance deadlines`);

    // Get all users to assign compliance items
    const users = await User.find({ isActive: true });
    console.log(`👥 Found ${users.length} active users`);

    // Create user compliance entries for each user
    for (const user of users) {
      const userComplianceItems = [];
      
      for (const compliance of createdCompliances) {
        // Calculate next due date based on frequency
        let nextDueDate = new Date(compliance.dueDate);
        const now = new Date();
        
        // Adjust date to be in the future if needed
        if (nextDueDate < now) {
          switch (compliance.frequency) {
            case 'monthly':
              nextDueDate.setMonth(now.getMonth() + 1);
              break;
            case 'quarterly':
              nextDueDate.setMonth(now.getMonth() + 3);
              break;
            case 'yearly':
              nextDueDate.setFullYear(now.getFullYear() + 1);
              break;
          }
        }

        userComplianceItems.push({
          userId: user._id,
          complianceId: compliance._id,
          isEnabled: true,
          isCompleted: false,
          reminderDays: [7, 3, 1],
          nextDueDate: nextDueDate,
          lastCompletedDate: null,
          completedDate: null,
          notes: ''
        });
      }

      await UserCompliance.insertMany(userComplianceItems);
      console.log(`✅ Created ${userComplianceItems.length} compliance items for user: ${user.name}`);
    }

    console.log('🎉 Compliance data seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding compliance data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run the seeder
if (require.main === module) {
  seedComplianceData();
}

export default seedComplianceData;
