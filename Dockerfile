FROM node:20-alpine
WORKDIR /app
COPY sequence/ .
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "start"]
