import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import User from '../models/User';

// Sample notifications
const sampleNotifications = [
  {
    title: 'Welcome to InvoNest!',
    message: 'Your account has been successfully created. Start by creating your first invoice.',
    type: 'system',
    priority: 'medium'
  },
  {
    title: 'GST Return Due Soon',
    message: 'Your GST return (GSTR-1) is due in 3 days. Don\'t forget to file it on time.',
    type: 'compliance',
    priority: 'high'
  },
  {
    title: 'Invoice Payment Received',
    message: 'Payment of ₹15,000 has been received for Invoice #INV-001.',
    type: 'invoice',
    priority: 'medium'
  },
  {
    title: 'Monthly Report Available',
    message: 'Your monthly business report for December 2024 is now available.',
    type: 'system',
    priority: 'low'
  },
  {
    title: 'TDS Return Reminder',
    message: 'TDS return filing deadline is approaching. File your 24Q return by January 31st.',
    type: 'compliance',
    priority: 'high'
  }
];

async function seedNotificationData() {
  try {
    console.log('🔔 Starting notification data seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/invonest');
    console.log('📦 Connected to MongoDB');

    // Get all users
    const users = await User.find({ isActive: true });
    console.log(`👥 Found ${users.length} active users`);

    if (users.length === 0) {
      console.log('⚠️  No active users found. Please create a user first.');
      return;
    }

    // Clear existing notifications (optional - comment out if you want to keep existing ones)
    // await Notification.deleteMany({});
    // console.log('🧹 Cleared existing notifications');

    // Create notifications for each user
    for (const user of users) {
      const userNotifications = sampleNotifications.map(notification => ({
        userId: user._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        channels: {
          email: false,
          inApp: true,
          push: false
        },
        status: 'sent',
        sentAt: new Date(),
        deliveredAt: new Date(),
        retryCount: 0,
        maxRetries: 3
      }));

      await Notification.insertMany(userNotifications);
      console.log(`✅ Created ${userNotifications.length} notifications for user: ${user.name}`);
    }

    console.log('🎉 Notification data seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding notification data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run the seeder
if (require.main === module) {
  seedNotificationData();
}

export default seedNotificationData;
