@echo off
echo 🚨 FORCE DOWNGRADE: Ensuring Next.js 14 installation

echo 🛑 Killing all processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
timeout /t 3 >nul

echo 🧹 Removing ALL files...
if exist .next rmdir /s /q .next >nul 2>&1
if exist node_modules rmdir /s /q node_modules >nul 2>&1
if exist package-lock.json del package-lock.json >nul 2>&1

echo 🧹 Clearing npm cache...
npm cache clean --force >nul 2>&1

echo 📦 Force installing Next.js 14.2.15...
npm install next@14.2.15 eslint-config-next@14.2.15 --save-exact

echo 📦 Installing remaining dependencies...
npm install

echo 🔧 Setting environment...
set NEXT_TELEMETRY_DISABLED=1
set NODE_ENV=development

echo 🚀 Starting Next.js 14 development server...
echo This should now show "Next.js 14.x.x" (NOT 15.x.x)

npm run dev
