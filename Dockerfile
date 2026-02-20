FROM node:20-alpine
WORKDIR /app
COPY sequence/package*.json ./
RUN npm ci --only=production
COPY sequence/ .
CMD ["npm", "start"]
