#!/bin/bash

# Build script for Render deployment

echo "🚀 Starting InvoNest deployment build..."

# Navigate to backend directory
cd backend

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

echo "✅ Build completed successfully!"

# List the dist directory to verify build
echo "📁 Build output:"
ls -la dist/

echo "🎉 Ready for deployment!"
