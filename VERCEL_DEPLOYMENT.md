# 🌐 Vercel Frontend Deployment Guide

Deploy your InvoNest frontend to Vercel's free tier with this step-by-step guide.

## 📋 Prerequisites

1. ✅ GitHub repository with your code
2. ✅ Vercel account (free)
3. ✅ Backend deployed on Render

## 🚀 Deployment Steps

### 1. Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Select "Import Git Repository"
4. Choose your GitHub account
5. Select `invoNest` repository
6. Click "Import"

### 2. Configure Project Settings

1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build`
4. **Output Directory**: `.next` (auto-detected)
5. **Install Command**: `npm install`

### 3. Environment Variables

Add these environment variables in Vercel:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=production
```

**How to add environment variables:**
1. Go to Project Settings
2. Click "Environment Variables"
3. Add each variable for "Production" environment
4. Click "Save"

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (2-5 minutes)
3. Your app will be live at `https://your-project.vercel.app`

## 🔧 Advanced Configuration

### Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL certificate is automatically provided

### Build Optimization

Update `next.config.js` for production:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Compress responses
  compress: true,
  
  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
}

module.exports = nextConfig
```

### Performance Monitoring

Enable Vercel Analytics:
1. Go to Project Settings → Analytics
2. Enable "Vercel Analytics"
3. Monitor Core Web Vitals

## 🔄 Automatic Deployments

Vercel automatically deploys when you push to GitHub:

1. **Production**: Pushes to `main` branch
2. **Preview**: Pushes to other branches
3. **Pull Requests**: Automatic preview deployments

### Deployment Hooks

Create deployment hooks for manual triggers:
1. Go to Project Settings → Git
2. Create Deploy Hook
3. Use webhook URL to trigger deployments

## 🐛 Troubleshooting

### Common Build Errors

1. **Module Not Found**
   ```bash
   # Check package.json dependencies
   npm install
   ```

2. **Environment Variables**
   ```bash
   # Ensure all NEXT_PUBLIC_ variables are set
   # Check Vercel dashboard environment variables
   ```

3. **Build Timeout**
   ```bash
   # Optimize build process
   # Remove unnecessary dependencies
   ```

### Performance Issues

1. **Large Bundle Size**
   - Use dynamic imports
   - Optimize images
   - Remove unused dependencies

2. **Slow Loading**
   - Enable compression
   - Optimize fonts
   - Use CDN for static assets

### Debugging

1. **Check Build Logs**
   - Go to Deployments tab
   - Click on failed deployment
   - Review build logs

2. **Function Logs**
   - Go to Functions tab
   - Check serverless function logs

## 📊 Monitoring & Analytics

### Vercel Analytics

Monitor your app performance:
- Page views and unique visitors
- Core Web Vitals scores
- Geographic distribution
- Device and browser analytics

### Error Tracking

Set up error monitoring:
1. Install Sentry or similar service
2. Configure error reporting
3. Monitor production errors

## 🔐 Security

### Headers Configuration

Add security headers in `next.config.js`:

```javascript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}
```

## 💰 Pricing & Limits

### Free Tier Includes:
- 100GB bandwidth per month
- 6,000 build minutes per month
- Unlimited static deployments
- Custom domains
- SSL certificates
- Global CDN

### Usage Monitoring:
1. Go to Account Settings → Usage
2. Monitor bandwidth and build minutes
3. Set up usage alerts

## 📞 Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

Your frontend is now live on Vercel! 🎉

**Next Steps:**
1. Test all functionality
2. Update backend CORS settings
3. Configure custom domain (optional)
4. Set up monitoring and analytics
