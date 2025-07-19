import seedComplianceData from './seedComplianceData';
import seedNotificationData from './seedNotificationData';

async function seedDashboardData() {
  console.log('🚀 Starting dashboard data seeding...');
  
  try {
    // Seed compliance data first
    await seedComplianceData();
    
    // Then seed notification data
    await seedNotificationData();
    
    console.log('✨ All dashboard data seeded successfully!');
    console.log('🔄 Please refresh your dashboard to see the new data.');
    
  } catch (error) {
    console.error('❌ Error seeding dashboard data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  seedDashboardData();
}

export default seedDashboardData;
