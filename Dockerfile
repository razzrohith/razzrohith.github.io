FROM node:20-alpine

# Copy entire repo (build context is repo root)
COPY . .

# Set workdir to the sequence app
WORKDIR /app/sequence

# Install dependencies
RUN npm ci --only=production

# Expose port (Railway provides $PORT)
EXPOSE 3000

# Start from the sequence directory
CMD ["npm", "start"]
