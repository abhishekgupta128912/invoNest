# Emergency fix for corrupted Next.js build
Write-Host "🚨 EMERGENCY FIX: Completely resetting Next.js environment" -ForegroundColor Red

# Kill ALL node processes aggressively
Write-Host "🛑 Killing all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "npm" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "next" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Remove ALL build artifacts and caches
Write-Host "🧹 Removing ALL build artifacts..." -ForegroundColor Yellow

if (Test-Path .next) {
    Write-Host "Removing .next directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
}

if (Test-Path node_modules) {
    Write-Host "Removing node_modules directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}

if (Test-Path package-lock.json) {
    Write-Host "Removing package-lock.json..." -ForegroundColor Gray
    Remove-Item package-lock.json -ErrorAction SilentlyContinue
}

# Clear npm cache completely
Write-Host "Clearing npm cache..." -ForegroundColor Gray
npm cache clean --force 2>$null

# Clear Windows temp files related to Node
$tempPath = $env:TEMP
if (Test-Path "$tempPath\npm-*") {
    Remove-Item "$tempPath\npm-*" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "✅ All caches and build artifacts cleared" -ForegroundColor Green

# Fresh install
Write-Host "📦 Installing dependencies with Next.js 14..." -ForegroundColor Cyan
npm install

Write-Host "🔧 Setting clean environment..." -ForegroundColor Cyan
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:NODE_ENV = "development"

# Remove any existing source maps that might be corrupted
if (Test-Path .next) {
    Get-ChildItem -Path .next -Recurse -Filter "*.map" | Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host "🚀 Starting fresh development server..." -ForegroundColor Green
Write-Host "This should now work without any chunk loading errors!" -ForegroundColor Green

npm run dev
