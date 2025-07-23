# Force restart Next.js development server with webpack (no Turbopack)
Write-Host "🛑 Stopping all Node.js processes..." -ForegroundColor Red

# Kill all node processes (this will stop the current dev server)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "🧹 Clearing all caches..." -ForegroundColor Yellow

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

# Clear npm cache
npm cache clean --force 2>$null
Write-Host "✅ Cleared npm cache" -ForegroundColor Green

Write-Host "🔧 Setting environment variables to force webpack..." -ForegroundColor Cyan
$env:TURBOPACK = "0"
$env:NEXT_DISABLE_TURBOPACK = "1"
$env:TURBO = "0"
$env:NEXT_PRIVATE_DISABLE_TURBO = "1"
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:WEBPACK_CACHE_DISABLED = "1"

Write-Host "🚀 Starting development server with WEBPACK ONLY..." -ForegroundColor Green
Write-Host "Note: This will NOT use Turbopack - only webpack for stable chunk loading" -ForegroundColor Gray

# Start with explicit webpack mode
npm run dev
