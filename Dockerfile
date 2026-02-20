# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files from sequence subfolder
COPY sequence/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY sequence/ .

# Railway sets $PORT automatically; we listen on it
EXPOSE 3000

# Start command
CMD ["npm", "start"]
