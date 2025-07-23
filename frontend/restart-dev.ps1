# PowerShell script to restart development server with proper cache clearing
Write-Host "🧹 Clearing Next.js cache..." -ForegroundColor Yellow

# Clear .next directory
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next
    Write-Host "✅ Cleared .next directory" -ForegroundColor Green
}

# Clear node_modules cache
if (Test-Path node_modules\.cache) {
    Remove-Item -Recurse -Force node_modules\.cache
    Write-Host "✅ Cleared node_modules cache" -ForegroundColor Green
}

Write-Host "🚀 Starting development server with webpack..." -ForegroundColor Cyan
Write-Host "Note: This will use webpack instead of Turbopack to avoid chunk loading issues" -ForegroundColor Gray

# Start development server with webpack
$env:TURBOPACK = "0"
$env:NEXT_DISABLE_TURBOPACK = "1"
$env:NEXT_TELEMETRY_DISABLED = "1"

npm run dev:webpack
