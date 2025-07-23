# Downgrade Next.js to stable version and restart development server
Write-Host "🛑 Stopping all Node.js processes..." -ForegroundColor Red

# Kill all node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "🧹 Clearing all caches and build artifacts..." -ForegroundColor Yellow

# Clear .next directory
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared .next directory" -ForegroundColor Green
}

# Clear node_modules cache
if (Test-Path node_modules\.cache) {
    Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared node_modules cache" -ForegroundColor Green
}

# Clear package-lock to ensure clean install
if (Test-Path package-lock.json) {
    Remove-Item package-lock.json -ErrorAction SilentlyContinue
    Write-Host "✅ Cleared package-lock.json" -ForegroundColor Green
}

Write-Host "📦 Installing Next.js 14.2.15 (stable version without Turbopack issues)..." -ForegroundColor Cyan
npm install

Write-Host "🔧 Setting environment variables..." -ForegroundColor Cyan
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:NODE_ENV = "development"

Write-Host "🚀 Starting development server with Next.js 14..." -ForegroundColor Green
Write-Host "Note: Next.js 14 doesn't have Turbopack by default - stable webpack only" -ForegroundColor Gray

npm run dev
