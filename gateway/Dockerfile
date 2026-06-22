FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies in a separate layer for caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/
COPY .env.example .env.example

EXPOSE 3000

CMD ["node", "src/server.js"]
