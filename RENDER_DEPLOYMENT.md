# 🖥️ Render Backend Deployment Guide

Deploy your InvoNest backend to Render's free tier with this comprehensive guide.

## 📋 Prerequisites

1. ✅ GitHub repository with your code
2. ✅ Render account (free)
3. ✅ MongoDB Atlas database configured

## 🚀 Deployment Steps

### 1. Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select `invoNest` repository
5. Click "Connect"

### 2. Configure Service Settings

**Basic Settings:**
- **Name**: `invonest-backend`
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main`

**Build & Deploy:**
- **Root Directory**: `backend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Instance Type:**
- **Plan**: `Free` (512 MB RAM, shared CPU)

### 3. Environment Variables

Add these environment variables in Render:

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/invonest
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-32-chars
FRONTEND_URL=https://your-app.vercel.app
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**How to add environment variables:**
1. Go to Environment tab
2. Click "Add Environment Variable"
3. Enter key and value
4. Click "Save Changes"

### 4. Deploy

1. Click "Create Web Service"
2. Wait for build to complete (5-10 minutes)
3. Your API will be live at `https://your-service.onrender.com`

## 🔧 Advanced Configuration

### Health Checks

Render automatically monitors your service health:
- **Health Check Path**: `/api/health` (already configured)
- **Timeout**: 30 seconds
- **Interval**: 30 seconds

### Auto-Deploy

Enable automatic deployments:
1. Go to Settings → Build & Deploy
2. Enable "Auto-Deploy"
3. Service redeploys on every push to main branch

### Custom Domain (Optional)

1. Go to Settings → Custom Domains
2. Add your domain
3. Configure DNS records as instructed
4. SSL certificate is automatically provided

## 🔄 Database Connection

### MongoDB Atlas Integration

Ensure your MongoDB Atlas is configured:

1. **Connection String Format**:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/invonest?retryWrites=true&w=majority
   ```

2. **IP Whitelist**: Add `0.0.0.0/0` for Render (or specific IPs)

3. **Database User**: Ensure user has read/write permissions

### Connection Pooling

Optimize database connections in your app:

```javascript
// In your database config
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0 // Disable mongoose buffering
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};
```

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs in Render dashboard
   # Ensure all dependencies are in package.json
   # Verify TypeScript compilation
   ```

2. **Service Won't Start**
   ```bash
   # Check start command: npm start
   # Verify dist/index.js exists after build
   # Check environment variables
   ```

3. **Database Connection Issues**
   ```bash
   # Verify MONGODB_URI format
   # Check MongoDB Atlas IP whitelist
   # Ensure database user permissions
   ```

### Performance Optimization

1. **Memory Usage**
   - Monitor memory usage in dashboard
   - Optimize database queries
   - Use connection pooling

2. **Response Times**
   - Add caching where appropriate
   - Optimize API endpoints
   - Use database indexes

### Debugging

1. **View Logs**
   - Go to Logs tab in dashboard
   - Monitor real-time logs
   - Check error messages

2. **Service Metrics**
   - Monitor CPU and memory usage
   - Track response times
   - Check error rates

## 📊 Monitoring

### Built-in Monitoring

Render provides:
- Service health status
- CPU and memory metrics
- Response time tracking
- Error rate monitoring

### Custom Monitoring

Add application monitoring:

```javascript
// Add to your Express app
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## 🔐 Security

### Environment Security

1. **Secure Secrets**: Use strong, unique secrets
2. **CORS Configuration**: Limit to your frontend domain
3. **Rate Limiting**: Already configured in your app
4. **Input Validation**: Ensure all inputs are validated

### SSL/TLS

- Automatic SSL certificates
- HTTPS enforced by default
- TLS 1.2+ supported

## 💰 Free Tier Limits

### Included in Free Tier:
- 512 MB RAM
- Shared CPU
- 750 hours per month
- Automatic SSL
- Custom domains
- GitHub integration

### Service Sleep:
- Services sleep after 15 minutes of inactivity
- Cold start time: 10-30 seconds
- Keep-alive strategies available

### Scaling Options:
- **Starter**: $7/month - 512 MB RAM, 0.1 CPU
- **Standard**: $25/month - 2 GB RAM, 1 CPU
- **Pro**: $85/month - 4 GB RAM, 2 CPU

## 🔄 CI/CD Integration

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Render

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to Render
      uses: johnbeynon/render-deploy-action@v0.0.8
      with:
        service-id: ${{ secrets.RENDER_SERVICE_ID }}
        api-key: ${{ secrets.RENDER_API_KEY }}
```

## 📞 Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)
- [Support Tickets](https://render.com/support)

Your backend is now live on Render! 🎉

**Next Steps:**
1. Test API endpoints
2. Update frontend API URL
3. Configure monitoring
4. Set up error tracking
