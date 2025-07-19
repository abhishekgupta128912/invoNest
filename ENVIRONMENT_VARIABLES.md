# 🔧 Environment Variables Configuration

This document describes all environment variables used in InvoNest.

## 🖥️ Backend Environment Variables

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | ✅ |
| `PORT` | Server port | `5000` | ✅ |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` | ✅ |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your-super-secure-secret` | ✅ |
| `JWT_REFRESH_SECRET` | JWT refresh secret (32+ chars) | `your-refresh-secret` | ✅ |
| `FRONTEND_URL` | Frontend URL for CORS | `https://app.vercel.app` | ✅ |

### Optional Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` | ❌ |
| `EMAIL_PORT` | SMTP port | `587` | ❌ |
| `EMAIL_USER` | Email username | `your@email.com` | ❌ |
| `EMAIL_PASS` | Email password | `app-password` | ❌ |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA secret | `6Lc...` | ❌ |
| `RAZORPAY_KEY_ID` | Razorpay key | `rzp_test_...` | ❌ |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` | ❌ |

## 🌐 Frontend Environment Variables

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.onrender.com` | ✅ |

### Optional Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA site key | `6Lc...` | ❌ |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` | ❌ |

## 🚀 Deployment Platform Setup

### Render (Backend)

1. Go to Render Dashboard
2. Select your service
3. Go to "Environment" tab
4. Add variables one by one

### Vercel (Frontend)

1. Go to Vercel Dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add variables for Production environment

## 🔐 Security Best Practices

1. **Never commit .env files** to version control
2. **Use strong secrets** (32+ characters for JWT)
3. **Rotate secrets regularly** in production
4. **Use different secrets** for development and production
5. **Limit CORS origins** to your actual frontend domain

## 🧪 Testing Configuration

Create a `.env.test` file for testing:

```bash
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/invonest_test
JWT_SECRET=test-secret-32-characters-minimum
FRONTEND_URL=http://localhost:3000
```

## 📝 Notes

- All `NEXT_PUBLIC_*` variables are exposed to the browser
- Backend variables are server-side only
- Use environment-specific files (.env.development, .env.production)
- Render and Vercel automatically load environment variables
