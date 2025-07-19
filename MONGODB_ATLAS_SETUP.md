# 🗄️ MongoDB Atlas Setup Guide

This guide will help you set up a free MongoDB Atlas database for InvoNest.

## 📋 Step-by-Step Setup

### 1. Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Click "Try Free"
3. Sign up with email or Google account
4. Verify your email address

### 2. Create a New Cluster

1. **Choose Deployment Type**: Select "Shared" (Free)
2. **Cloud Provider**: Choose your preferred provider (AWS recommended)
3. **Region**: Select closest region to your users
4. **Cluster Tier**: M0 Sandbox (Free Forever)
5. **Cluster Name**: `invonest-cluster`
6. Click "Create Cluster"

### 3. Configure Database Access

1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. **Authentication Method**: Password
4. **Username**: `invonest_user`
5. **Password**: Generate secure password (save it!)
6. **Database User Privileges**: Read and write to any database
7. Click "Add User"

### 4. Configure Network Access

1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. **For Development**: Click "Allow Access from Anywhere" (0.0.0.0/0)
4. **For Production**: Add your server's IP address
5. Click "Confirm"

### 5. Get Connection String

1. Go to "Clusters" in left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. **Driver**: Node.js
5. **Version**: 4.1 or later
6. Copy the connection string

Example connection string:
```
mongodb+srv://invonest_user:<password>@invonest-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 6. Configure Database

1. Replace `<password>` with your actual password
2. Add database name: `/invonest` before the `?`
3. Final connection string:
```
mongodb+srv://invonest_user:yourpassword@invonest-cluster.xxxxx.mongodb.net/invonest?retryWrites=true&w=majority
```

## 🔧 Environment Configuration

### For Development (.env)
```bash
MONGODB_URI=mongodb+srv://invonest_user:yourpassword@invonest-cluster.xxxxx.mongodb.net/invonest?retryWrites=true&w=majority
```

### For Production (Render)
Add the same connection string to Render environment variables.

## 📊 Database Collections

InvoNest will automatically create these collections:

- `users` - User accounts and profiles
- `invoices` - Invoice documents
- `documents` - Uploaded documents
- `notifications` - System notifications
- `compliancedeadlines` - Tax compliance deadlines
- `payments` - Payment records
- `subscriptions` - User subscriptions

## 🔐 Security Best Practices

1. **Use Strong Passwords**: Generate complex passwords for database users
2. **Limit IP Access**: In production, only allow your server's IP
3. **Regular Backups**: Atlas provides automatic backups
4. **Monitor Usage**: Check Atlas dashboard regularly
5. **Rotate Credentials**: Change passwords periodically

## 📈 Free Tier Limitations

- **Storage**: 512 MB
- **RAM**: Shared
- **Connections**: 500 concurrent
- **Bandwidth**: No limit
- **Backups**: Retained for 2 days

## 🚀 Scaling Options

When you outgrow the free tier:

1. **M2 Cluster**: $9/month - 2GB storage
2. **M5 Cluster**: $25/month - 5GB storage
3. **Dedicated Clusters**: Starting at $57/month

## 🛠️ Troubleshooting

### Connection Issues
- Check IP whitelist in Network Access
- Verify username/password
- Ensure connection string format is correct

### Performance Issues
- Monitor connection count
- Check query performance in Atlas dashboard
- Consider indexing frequently queried fields

### Storage Issues
- Monitor storage usage in Atlas dashboard
- Clean up old/unnecessary data
- Consider upgrading to paid tier

## 📞 Support

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Community Forums](https://community.mongodb.com/)
- [Atlas Support](https://support.mongodb.com/)

Your MongoDB Atlas database is now ready for InvoNest! 🎉
