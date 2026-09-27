# Use official Node.js 22 LTS on Alpine Linux
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code and public assets
COPY src/ ./src/
COPY public/ ./public/

# Create directory for SQLite database storage
RUN mkdir -p /app/data

# Google Cloud Run default port is 8080
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "src/server.js"]
