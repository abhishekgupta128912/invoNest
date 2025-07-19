# 📚 GitHub Repository Setup Guide

This guide will help you push your InvoNest code to GitHub and set up the repository properly.

## 🚀 Quick Setup Commands

Run these commands in your project root directory:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: InvoNest - AI-powered invoicing platform"

# Add remote repository
git remote add origin https://github.com/abhishekgupta128912/invoNest.git

# Push to GitHub
git push -u origin main
```

## 📋 Step-by-Step Instructions

### 1. Prepare Repository

1. **Check Git Status**
   ```bash
   git status
   ```

2. **Add Files to Staging**
   ```bash
   git add .
   ```

3. **Commit Changes**
   ```bash
   git commit -m "Deploy: Complete InvoNest application with deployment configs"
   ```

### 2. Connect to GitHub

1. **Add Remote Origin**
   ```bash
   git remote add origin https://github.com/abhishekgupta128912/invoNest.git
   ```

2. **Verify Remote**
   ```bash
   git remote -v
   ```

### 3. Push to GitHub

1. **Push Main Branch**
   ```bash
   git push -u origin main
   ```

2. **If Branch Doesn't Exist**
   ```bash
   git branch -M main
   git push -u origin main
   ```

## 🔧 Repository Configuration

### GitHub Repository Settings

1. **Go to Repository Settings**
2. **Enable Issues** (for bug tracking)
3. **Enable Discussions** (for community)
4. **Set up Branch Protection** (optional)

### Repository Secrets (for CI/CD)

Add these secrets in GitHub repository settings:

```
MONGODB_URI=your-mongodb-atlas-connection-string
JWT_SECRET=your-jwt-secret
RENDER_API_KEY=your-render-api-key (optional)
VERCEL_TOKEN=your-vercel-token (optional)
```

## 📝 Repository Structure

Your repository should look like this:

```
invoNest/
├── .gitignore
├── README.md
├── DEPLOYMENT.md
├── ENVIRONMENT_VARIABLES.md
├── MONGODB_ATLAS_SETUP.md
├── GITHUB_SETUP.md
├── vercel.json
├── render.yaml
├── build.sh
├── backend/
│   ├── .env.example
│   ├── .env.production
│   ├── Dockerfile
│   ├── healthcheck.js
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   └── scripts/
└── frontend/
    ├── .env.example
    ├── .env.production
    ├── package.json
    ├── next.config.js
    └── src/
```

## 🔄 Continuous Deployment Setup

### Automatic Deployment from GitHub

1. **Vercel (Frontend)**
   - Connect GitHub repository
   - Auto-deploy on push to main branch

2. **Render (Backend)**
   - Connect GitHub repository
   - Auto-deploy on push to main branch

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy InvoNest

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd backend && npm install
        cd ../frontend && npm install
    
    - name: Build backend
      run: cd backend && npm run build
    
    - name: Build frontend
      run: cd frontend && npm run build
```

## 🏷️ Version Tagging

Create version tags for releases:

```bash
# Create a tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tags
git push origin --tags
```

## 📊 Repository Analytics

Enable these features:

1. **Insights** - Track repository activity
2. **Security** - Dependabot alerts
3. **Code Scanning** - Security analysis
4. **Dependency Graph** - Track dependencies

## 🤝 Collaboration Setup

### Branch Protection Rules

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews
   - Require status checks
   - Restrict pushes to main

### Issue Templates

Create `.github/ISSUE_TEMPLATE/`:
- Bug report template
- Feature request template
- Question template

### Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

## 🔐 Security Best Practices

1. **Never commit sensitive data**
2. **Use .gitignore properly**
3. **Enable security alerts**
4. **Regular dependency updates**
5. **Code scanning enabled**

## 📞 Support

- [GitHub Docs](https://docs.github.com/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Community](https://github.community/)

Your GitHub repository is now ready! 🎉
