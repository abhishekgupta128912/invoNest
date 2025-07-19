# 🚀 InvoNest Deployment Guide

This guide will help you deploy InvoNest for free using Vercel (frontend) and Render (backend).

## 📋 Prerequisites

1. GitHub account
2. Vercel account (free)
3. Render account (free)
4. MongoDB Atlas account (free)

## 🗄️ Database Setup (MongoDB Atlas)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account and cluster
3. Create a database user
4. Whitelist IP addresses (0.0.0.0/0 for development)
5. Get your connection string

## 🔧 Backend Deployment (Render)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy InvoNest"
   git push origin main
   ```

2. **Deploy on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `invonest-backend`
     - **Environment**: `Node`
     - **Build Command**: `cd backend && npm install && npm run build`
     - **Start Command**: `cd backend && npm start`
     - **Instance Type**: `Free`

3. **Environment Variables**
   Add these in Render dashboard:
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=your-mongodb-atlas-connection-string
   JWT_SECRET=your-super-secure-jwt-secret-32-chars-min
   JWT_REFRESH_SECRET=your-super-secure-refresh-secret
   FRONTEND_URL=https://your-app.vercel.app
   BCRYPT_ROUNDS=12
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

## 🌐 Frontend Deployment (Vercel)

1. **Deploy on Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: `Next.js`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `.next`

2. **Environment Variables**
   Add these in Vercel dashboard:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
   NEXT_TELEMETRY_DISABLED=1
   ```

## 🔗 Connect Frontend and Backend

1. Update `NEXT_PUBLIC_API_URL` in Vercel with your Render backend URL
2. Update `FRONTEND_URL` in Render with your Vercel frontend URL
3. Redeploy both services

## 🧪 Testing

1. Visit your Vercel frontend URL
2. Test user registration and login
3. Check backend health: `https://your-backend.onrender.com/api/health`

## 📝 Notes

- **Free Tier Limitations**:
  - Render: 750 hours/month, sleeps after 15 min inactivity
  - Vercel: 100GB bandwidth, 6000 build minutes
  - MongoDB Atlas: 512MB storage

- **Custom Domain**: Both Vercel and Render support custom domains on free tier

## 🔧 Troubleshooting

- **Build Fails**: Check build logs in respective dashboards
- **CORS Issues**: Ensure FRONTEND_URL is correctly set in backend
- **Database Connection**: Verify MongoDB Atlas connection string and IP whitelist

## 🚀 Going Live

1. Update environment variables with production values
2. Configure custom domain (optional)
3. Set up monitoring and alerts
4. Enable SSL (automatic on both platforms)

Your InvoNest app is now live! 🎉
