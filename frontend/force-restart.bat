@echo off
echo 🛑 Stopping all Node.js processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

echo 🧹 Clearing all caches...
if exist .next rmdir /s /q .next >nul 2>&1
if exist node_modules\.cache rmdir /s /q node_modules\.cache >nul 2>&1
npm cache clean --force >nul 2>&1

echo 🔧 Setting environment variables...
set TURBOPACK=0
set NEXT_DISABLE_TURBOPACK=1
set TURBO=0
set NEXT_PRIVATE_DISABLE_TURBO=1
set NEXT_TELEMETRY_DISABLED=1

echo 🚀 Starting development server with WEBPACK ONLY...
npm run dev
