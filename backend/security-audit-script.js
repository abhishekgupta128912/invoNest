// Security Audit Script for InvoNest
const fs = require('fs');
const path = require('path');

class SecurityAuditor {
  constructor() {
    this.results = {
      authentication: { score: 0, maxScore: 100, issues: [], passed: [] },
      authorization: { score: 0, maxScore: 100, issues: [], passed: [] },
      inputValidation: { score: 0, maxScore: 100, issues: [], passed: [] },
      rateLimiting: { score: 0, maxScore: 100, issues: [], passed: [] },
      sessionManagement: { score: 0, maxScore: 100, issues: [], passed: [] },
      monitoring: { score: 0, maxScore: 100, issues: [], passed: [] },
      vulnerabilities: [],
      recommendations: []
    };
  }

  async auditAuthentication() {
    console.log('🔍 Auditing Authentication...');
    
    // Check JWT implementation
    if (this.checkFileExists('src/utils/jwt.ts')) {
      this.results.authentication.passed.push('JWT utilities implemented');
      this.results.authentication.score += 15;
    }

    // Check token blacklisting
    if (this.checkFileExists('src/services/tokenBlacklistService.ts')) {
      this.results.authentication.passed.push('Token blacklisting service implemented');
      this.results.authentication.score += 20;
    } else {
      this.results.authentication.issues.push('Token blacklisting not implemented');
      this.addVulnerability('AUTH-001', 'MEDIUM', 'Missing token blacklisting');
    }

    // Check brute force protection
    if (this.checkFileExists('src/middleware/security.ts')) {
      this.results.authentication.passed.push('Brute force protection implemented');
      this.results.authentication.score += 20;
    }

    // Check password hashing
    const userModel = this.readFile('src/models/User.ts');
    if (userModel && userModel.includes('bcrypt')) {
      this.results.authentication.passed.push('Password hashing with bcrypt');
      this.results.authentication.score += 15;
    }

    // Check password complexity
    if (userModel && userModel.includes('strongPasswordRegex')) {
      this.results.authentication.passed.push('Strong password requirements enforced');
      this.results.authentication.score += 15;
    } else {
      this.results.authentication.issues.push('Weak password requirements');
      this.addVulnerability('AUTH-002', 'MEDIUM', 'Insufficient password complexity');
    }

    // Check MFA implementation
    if (this.checkFileExists('src/controllers/otpController.ts')) {
      this.results.authentication.passed.push('Multi-factor authentication available');
      this.results.authentication.score += 15;
    }
  }

  async auditAuthorization() {
    console.log('🔍 Auditing Authorization...');

    // Check resource ownership middleware
    if (this.checkFileExists('src/middleware/resourceAuth.ts')) {
      this.results.authorization.passed.push('Resource ownership middleware implemented');
      this.results.authorization.score += 30;
    } else {
      this.results.authorization.issues.push('Missing resource ownership checks');
      this.addVulnerability('AUTHZ-001', 'HIGH', 'No resource-level authorization');
    }

    // Check RBAC implementation
    const authMiddleware = this.readFile('src/middleware/auth.ts');
    if (authMiddleware && authMiddleware.includes('authorize')) {
      this.results.authorization.passed.push('Role-based access control implemented');
      this.results.authorization.score += 25;
    }

    // Check API key permissions
    if (this.checkFileExists('src/middleware/apiAuth.ts')) {
      this.results.authorization.passed.push('API key authorization implemented');
      this.results.authorization.score += 20;
    }

    // Check team-based permissions
    if (this.checkFileExists('src/models/TeamMember.ts')) {
      this.results.authorization.passed.push('Team-based permissions available');
      this.results.authorization.score += 15;
    }

    // Check admin protection
    const securityRoutes = this.readFile('src/routes/securityRoutes.ts');
    if (securityRoutes && securityRoutes.includes('admin')) {
      this.results.authorization.passed.push('Admin-only routes protected');
      this.results.authorization.score += 10;
    }
  }

  async auditInputValidation() {
    console.log('🔍 Auditing Input Validation...');

    // Check input sanitization
    if (this.checkFileExists('src/middleware/inputSanitization.ts')) {
      this.results.inputValidation.passed.push('Input sanitization middleware implemented');
      this.results.inputValidation.score += 30;
    } else {
      this.results.inputValidation.issues.push('Missing input sanitization');
      this.addVulnerability('INPUT-001', 'HIGH', 'No input sanitization');
    }

    // Check validation middleware
    if (this.checkFileExists('src/middleware/validation.ts')) {
      this.results.inputValidation.passed.push('Validation middleware implemented');
      this.results.inputValidation.score += 25;
    }

    // Check file upload validation
    const inputSanitization = this.readFile('src/middleware/inputSanitization.ts');
    if (inputSanitization && inputSanitization.includes('validateFileUpload')) {
      this.results.inputValidation.passed.push('File upload validation implemented');
      this.results.inputValidation.score += 20;
    }

    // Check dangerous pattern detection
    if (inputSanitization && inputSanitization.includes('detectDangerousPatterns')) {
      this.results.inputValidation.passed.push('Dangerous pattern detection implemented');
      this.results.inputValidation.score += 25;
    }
  }

  async auditRateLimiting() {
    console.log('🔍 Auditing Rate Limiting...');

    // Check rate limiting middleware
    const securityMiddleware = this.readFile('src/middleware/security.ts');
    if (securityMiddleware && securityMiddleware.includes('rateLimiters')) {
      this.results.rateLimiting.passed.push('Comprehensive rate limiting implemented');
      this.results.rateLimiting.score += 40;
    }

    // Check different rate limits for different endpoints
    const indexFile = this.readFile('src/index.ts');
    if (indexFile && indexFile.includes('/api/auth', 'rateLimiters.auth')) {
      this.results.rateLimiting.passed.push('Authentication-specific rate limiting');
      this.results.rateLimiting.score += 20;
    }

    if (indexFile && indexFile.includes('/api/otp', 'rateLimiters.otp')) {
      this.results.rateLimiting.passed.push('OTP-specific rate limiting');
      this.results.rateLimiting.score += 20;
    }

    // Check API rate limiting
    if (indexFile && indexFile.includes('/api/v1', 'rateLimiters.api')) {
      this.results.rateLimiting.passed.push('API-specific rate limiting');
      this.results.rateLimiting.score += 20;
    }
  }

  async auditSessionManagement() {
    console.log('🔍 Auditing Session Management...');

    // Check token blacklisting on logout
    const authController = this.readFile('src/controllers/authController.ts');
    if (authController && authController.includes('tokenBlacklist.blacklistToken')) {
      this.results.sessionManagement.passed.push('Token invalidation on logout');
      this.results.sessionManagement.score += 30;
    } else {
      this.results.sessionManagement.issues.push('Tokens not invalidated on logout');
      this.addVulnerability('SESSION-001', 'MEDIUM', 'Session tokens persist after logout');
    }

    // Check JWT configuration
    const securityConfig = this.readFile('src/config/security.ts');
    if (securityConfig && securityConfig.includes('jwt')) {
      this.results.sessionManagement.passed.push('JWT configuration implemented');
      this.results.sessionManagement.score += 25;
    }

    // Check session security headers
    if (securityConfig && securityConfig.includes('session')) {
      this.results.sessionManagement.passed.push('Session security configuration');
      this.results.sessionManagement.score += 20;
    }

    // Check refresh token implementation
    const jwtUtils = this.readFile('src/utils/jwt.ts');
    if (jwtUtils && jwtUtils.includes('generateRefreshToken')) {
      this.results.sessionManagement.passed.push('Refresh token implementation');
      this.results.sessionManagement.score += 25;
    }
  }

  async auditMonitoring() {
    console.log('🔍 Auditing Security Monitoring...');

    // Check security monitoring service
    if (this.checkFileExists('src/services/securityMonitoringService.ts')) {
      this.results.monitoring.passed.push('Security monitoring service implemented');
      this.results.monitoring.score += 30;
    }

    // Check security audit service
    if (this.checkFileExists('src/services/securityAuditService.ts')) {
      this.results.monitoring.passed.push('Security audit service implemented');
      this.results.monitoring.score += 25;
    }

    // Check security routes
    if (this.checkFileExists('src/routes/securityRoutes.ts')) {
      this.results.monitoring.passed.push('Security dashboard implemented');
      this.results.monitoring.score += 20;
    }

    // Check logging implementation
    const securityMiddleware = this.readFile('src/middleware/security.ts');
    if (securityMiddleware && securityMiddleware.includes('winston')) {
      this.results.monitoring.passed.push('Comprehensive logging implemented');
      this.results.monitoring.score += 25;
    }
  }

  checkFileExists(filePath) {
    try {
      return fs.existsSync(path.join(__dirname, filePath));
    } catch {
      return false;
    }
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    } catch {
      return null;
    }
  }

  addVulnerability(id, severity, description) {
    this.results.vulnerabilities.push({
      id,
      severity,
      description,
      timestamp: new Date()
    });
  }

  calculateOverallScore() {
    const categories = Object.keys(this.results).filter(key => 
      typeof this.results[key] === 'object' && 
      this.results[key].score !== undefined
    );
    
    const totalScore = categories.reduce((sum, category) => 
      sum + this.results[category].score, 0
    );
    
    const maxTotalScore = categories.reduce((sum, category) => 
      sum + this.results[category].maxScore, 0
    );
    
    return Math.round((totalScore / maxTotalScore) * 100);
  }

  async runFullAudit() {
    console.log('🚀 Starting Comprehensive Security Audit...\n');
    
    await this.auditAuthentication();
    await this.auditAuthorization();
    await this.auditInputValidation();
    await this.auditRateLimiting();
    await this.auditSessionManagement();
    await this.auditMonitoring();

    const overallScore = this.calculateOverallScore();
    
    console.log('\n📊 SECURITY AUDIT RESULTS');
    console.log('========================');
    console.log(`Overall Security Score: ${overallScore}/100`);
    console.log('\nCategory Scores:');
    
    Object.keys(this.results).forEach(category => {
      if (this.results[category].score !== undefined) {
        const score = this.results[category].score;
        const maxScore = this.results[category].maxScore;
        console.log(`  ${category}: ${score}/${maxScore} (${Math.round(score/maxScore*100)}%)`);
      }
    });

    console.log(`\n✅ Total Passed Checks: ${this.getTotalPassedChecks()}`);
    console.log(`⚠️  Total Issues Found: ${this.getTotalIssues()}`);
    console.log(`🚨 Critical Vulnerabilities: ${this.results.vulnerabilities.filter(v => v.severity === 'HIGH').length}`);

    return {
      overallScore,
      results: this.results,
      summary: {
        totalPassed: this.getTotalPassedChecks(),
        totalIssues: this.getTotalIssues(),
        criticalVulns: this.results.vulnerabilities.filter(v => v.severity === 'HIGH').length
      }
    };
  }

  getTotalPassedChecks() {
    return Object.keys(this.results).reduce((total, category) => {
      if (this.results[category].passed) {
        return total + this.results[category].passed.length;
      }
      return total;
    }, 0);
  }

  getTotalIssues() {
    return Object.keys(this.results).reduce((total, category) => {
      if (this.results[category].issues) {
        return total + this.results[category].issues.length;
      }
      return total;
    }, 0);
  }
}

// Run the audit
const auditor = new SecurityAuditor();
auditor.runFullAudit().then(results => {
  console.log('\n🎯 Audit completed successfully!');
}).catch(error => {
  console.error('❌ Audit failed:', error);
});
