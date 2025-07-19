const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Database initialization script for production deployment
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing InvoNest database...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
    
    // Create indexes for better performance
    const db = mongoose.connection.db;
    
    // Users collection indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true });
    console.log('✅ Created users indexes');
    
    // Invoices collection indexes
    await db.collection('invoices').createIndex({ invoiceNumber: 1 }, { unique: true });
    await db.collection('invoices').createIndex({ userId: 1 });
    await db.collection('invoices').createIndex({ createdAt: -1 });
    await db.collection('invoices').createIndex({ status: 1 });
    console.log('✅ Created invoices indexes');
    
    // Documents collection indexes
    await db.collection('documents').createIndex({ userId: 1 });
    await db.collection('documents').createIndex({ uploadDate: -1 });
    console.log('✅ Created documents indexes');
    
    // Notifications collection indexes
    await db.collection('notifications').createIndex({ userId: 1 });
    await db.collection('notifications').createIndex({ createdAt: -1 });
    await db.collection('notifications').createIndex({ read: 1 });
    console.log('✅ Created notifications indexes');
    
    // Compliance deadlines collection indexes
    await db.collection('compliancedeadlines').createIndex({ dueDate: 1 });
    await db.collection('compliancedeadlines').createIndex({ type: 1 });
    console.log('✅ Created compliance deadlines indexes');
    
    // Insert initial compliance deadlines if collection is empty
    const complianceCount = await db.collection('compliancedeadlines').countDocuments();
    if (complianceCount === 0) {
      const complianceDeadlines = [
        {
          title: "GST Return Filing (GSTR-1)",
          description: "Monthly GST return for outward supplies",
          dueDate: new Date("2024-02-11"),
          type: "GST",
          frequency: "monthly",
          applicableTo: ["all"],
          priority: "high",
          reminderDays: [7, 3, 1]
        },
        {
          title: "GST Return Filing (GSTR-3B)",
          description: "Monthly GST return with tax liability",
          dueDate: new Date("2024-02-20"),
          type: "GST",
          frequency: "monthly",
          applicableTo: ["all"],
          priority: "high",
          reminderDays: [7, 3, 1]
        },
        {
          title: "TDS Return Filing",
          description: "Quarterly TDS return filing",
          dueDate: new Date("2024-01-31"),
          type: "TDS",
          frequency: "quarterly",
          applicableTo: ["employers"],
          priority: "medium",
          reminderDays: [15, 7, 3]
        }
      ];
      
      await db.collection('compliancedeadlines').insertMany(complianceDeadlines);
      console.log('✅ Inserted initial compliance deadlines');
    }
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📝 Disconnected from MongoDB');
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
