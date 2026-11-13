FROM node:22-alpine

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source and static assets
COPY src ./src
COPY public ./public

# Ensure persistent data directory exists
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "src/server.js"]
