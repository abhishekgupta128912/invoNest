# 🌐 Domain & SSL Configuration Guide

Set up custom domains and SSL certificates for your InvoNest application.

## 📋 Overview

Both Vercel and Render provide free SSL certificates and support custom domains on their free tiers.

## 🎯 Domain Strategy

### Recommended Setup:
- **Frontend**: `invonest.com` or `app.invonest.com`
- **Backend API**: `api.invonest.com`
- **Documentation**: `docs.invonest.com`

## 🌐 Frontend Domain (Vercel)

### 1. Purchase Domain

Popular domain registrars:
- [Namecheap](https://www.namecheap.com) - Affordable, good support
- [Google Domains](https://domains.google.com) - Simple interface
- [Cloudflare](https://www.cloudflare.com/products/registrar/) - At-cost pricing
- [GoDaddy](https://www.godaddy.com) - Popular choice

### 2. Configure Domain in Vercel

1. **Go to Vercel Dashboard**
2. **Select your project**
3. **Go to Settings → Domains**
4. **Add Domain**:
   - Enter your domain (e.g., `invonest.com`)
   - Click "Add"

### 3. DNS Configuration

Vercel will provide DNS records to configure:

**Option A: Use Vercel Nameservers (Recommended)**
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

**Option B: CNAME Record**
```
Type: CNAME
Name: www (or @)
Value: cname.vercel-dns.com
```

**Option C: A Record**
```
Type: A
Name: @
Value: 76.76.19.61
```

### 4. SSL Certificate

- **Automatic**: Vercel automatically provisions SSL certificates
- **Renewal**: Automatic renewal every 90 days
- **Type**: Let's Encrypt certificates
- **Support**: TLS 1.2 and 1.3

## 🖥️ Backend Domain (Render)

### 1. Configure Domain in Render

1. **Go to Render Dashboard**
2. **Select your service**
3. **Go to Settings → Custom Domains**
4. **Add Custom Domain**:
   - Enter subdomain (e.g., `api.invonest.com`)
   - Click "Save"

### 2. DNS Configuration

Add CNAME record in your DNS provider:

```
Type: CNAME
Name: api
Value: your-service.onrender.com
TTL: 300 (or Auto)
```

### 3. SSL Certificate

- **Automatic**: Render automatically provisions SSL certificates
- **Renewal**: Automatic renewal
- **Type**: Let's Encrypt certificates
- **Verification**: Domain ownership verification required

## 🔧 DNS Provider Configuration

### Cloudflare (Recommended)

1. **Add Site to Cloudflare**
2. **Change Nameservers** at your registrar
3. **Add DNS Records**:
   ```
   Type: CNAME
   Name: @
   Content: cname.vercel-dns.com
   Proxy: Orange cloud (Proxied)
   
   Type: CNAME
   Name: api
   Content: your-service.onrender.com
   Proxy: Orange cloud (Proxied)
   ```

### Benefits of Cloudflare:
- Free CDN
- DDoS protection
- Analytics
- Additional security features

### Other DNS Providers

**Namecheap:**
1. Go to Domain List → Manage
2. Advanced DNS tab
3. Add records as specified above

**Google Domains:**
1. Go to DNS settings
2. Custom resource records
3. Add records as specified above

## 🔐 SSL/TLS Configuration

### Security Headers

Add security headers in your applications:

**Frontend (Next.js)**:
```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
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

**Backend (Express.js)**:
```javascript
// Already configured in your app
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### HTTPS Redirect

Both platforms automatically redirect HTTP to HTTPS.

## 🧪 Testing & Verification

### SSL Certificate Testing

1. **SSL Labs Test**: [ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/)
2. **Check Certificate**:
   ```bash
   openssl s_client -connect yourdomain.com:443
   ```

### DNS Propagation

1. **DNS Checker**: [dnschecker.org](https://dnschecker.org/)
2. **Command Line**:
   ```bash
   nslookup yourdomain.com
   dig yourdomain.com
   ```

### Performance Testing

1. **GTmetrix**: [gtmetrix.com](https://gtmetrix.com/)
2. **PageSpeed Insights**: [pagespeed.web.dev](https://pagespeed.web.dev/)

## 📧 Email Configuration (Optional)

### Custom Email Domain

Set up email with your domain:

1. **Google Workspace**: $6/user/month
2. **Microsoft 365**: $5/user/month
3. **Zoho Mail**: Free for up to 5 users

### Email DNS Records

```
Type: MX
Name: @
Value: mx.zoho.com
Priority: 10

Type: TXT
Name: @
Value: "v=spf1 include:zoho.com ~all"
```

## 🔄 Environment Updates

### Update Environment Variables

**Frontend (Vercel)**:
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Backend (Render)**:
```bash
FRONTEND_URL=https://yourdomain.com
```

### CORS Configuration

Update CORS settings in backend:
```javascript
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ],
  credentials: true
}));
```

## 🚨 Troubleshooting

### Common Issues

1. **DNS Not Propagating**
   - Wait 24-48 hours for full propagation
   - Clear DNS cache: `ipconfig /flushdns`

2. **SSL Certificate Issues**
   - Verify domain ownership
   - Check DNS records
   - Contact platform support

3. **Mixed Content Warnings**
   - Ensure all resources use HTTPS
   - Update API URLs to use HTTPS

### Monitoring

Set up monitoring for:
- Domain expiration
- SSL certificate expiration
- DNS resolution
- Website uptime

## 💰 Cost Considerations

### Free Options:
- **Vercel**: Free SSL + custom domain
- **Render**: Free SSL + custom domain
- **Cloudflare**: Free CDN + security

### Paid Options:
- **Domain**: $10-15/year
- **Premium DNS**: $5-20/month
- **Advanced SSL**: $50-200/year
- **Email**: $5-10/user/month

## 📞 Support Resources

- [Vercel Domain Docs](https://vercel.com/docs/concepts/projects/custom-domains)
- [Render Domain Docs](https://render.com/docs/custom-domains)
- [Cloudflare Docs](https://developers.cloudflare.com/)

Your custom domain with SSL is now configured! 🎉

**Final Checklist:**
- [ ] Domain purchased and configured
- [ ] DNS records added
- [ ] SSL certificates active
- [ ] Environment variables updated
- [ ] CORS settings updated
- [ ] Testing completed
