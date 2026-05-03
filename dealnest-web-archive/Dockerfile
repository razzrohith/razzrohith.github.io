FROM node:20-alpine

# Set working directory to /app (root of the app)
WORKDIR /app

# Copy the sequence app files (not the whole repo)
COPY sequence/package*.json ./
COPY sequence/public ./public
COPY sequence/server.js ./

# Install dependencies
RUN npm ci --only=production

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
