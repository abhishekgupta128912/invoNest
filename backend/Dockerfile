# Use Node.js 20 LTS (to resolve engine warnings)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Fix permissions for node_modules binaries
RUN chmod +x node_modules/.bin/*

# Build the application using npx for better reliability
RUN npx tsc && npm run copy-assets

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port (Render will set PORT env variable)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]
