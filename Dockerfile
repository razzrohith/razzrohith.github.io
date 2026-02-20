FROM node:20-alpine
WORKDIR /app/sequence
COPY . .
RUN npm ci --only=production
EXPOSE 3000
CMD ["node", "server.js"]
