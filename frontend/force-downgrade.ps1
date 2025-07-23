# Force downgrade to Next.js 14 and completely reset environment
Write-Host "🚨 FORCE DOWNGRADE: Ensuring Next.js 14 installation" -ForegroundColor Red

# Kill ALL processes
Write-Host "🛑 Killing all processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "npm" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Remove everything
Write-Host "🧹 Removing ALL files..." -ForegroundColor Yellow
if (Test-Path .next) { Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue }
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue }
if (Test-Path package-lock.json) { Remove-Item package-lock.json -ErrorAction SilentlyContinue }

# Clear all caches
Write-Host "🧹 Clearing all caches..." -ForegroundColor Yellow
npm cache clean --force 2>$null

# Verify package.json has Next.js 14
Write-Host "🔍 Verifying package.json..." -ForegroundColor Cyan
$packageJson = Get-Content package.json | ConvertFrom-Json
$nextVersion = $packageJson.dependencies.next
Write-Host "Current Next.js version in package.json: $nextVersion" -ForegroundColor Gray

if ($nextVersion -ne "14.2.15") {
    Write-Host "❌ Package.json still has wrong version. Fixing..." -ForegroundColor Red
    
    # Manually fix package.json
    $content = Get-Content package.json -Raw
    $content = $content -replace '"next": "15\.3\.3"', '"next": "14.2.15"'
    $content = $content -replace '"eslint-config-next": "15\.3\.3"', '"eslint-config-next": "14.2.15"'
    Set-Content package.json $content
    
    Write-Host "✅ Fixed package.json to use Next.js 14.2.15" -ForegroundColor Green
}

# Force install specific version
Write-Host "📦 Force installing Next.js 14.2.15..." -ForegroundColor Cyan
npm install next@14.2.15 eslint-config-next@14.2.15 --save-exact

# Install other dependencies
Write-Host "📦 Installing remaining dependencies..." -ForegroundColor Cyan
npm install

# Verify installation
Write-Host "🔍 Verifying installation..." -ForegroundColor Cyan
$installedVersion = npm list next --depth=0 2>$null | Select-String "next@"
Write-Host "Installed version: $installedVersion" -ForegroundColor Gray

# Set environment
Write-Host "🔧 Setting environment..." -ForegroundColor Cyan
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:NODE_ENV = "development"

Write-Host "🚀 Starting Next.js 14 development server..." -ForegroundColor Green
Write-Host "This should now show 'Next.js 14.x.x' (NOT 15.x.x)" -ForegroundColor Yellow

npm run dev
