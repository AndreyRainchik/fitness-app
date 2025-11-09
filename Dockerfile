# ==============================================
# STAGE 1: Build Frontend
# ==============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install ALL dependencies (including devDependencies for build tools like vite)
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN npm run build

# ==============================================
# STAGE 2: Setup Backend + Serve Frontend
# ==============================================
FROM node:20-alpine

# Install wget for health checks
RUN apk add --no-cache dumb-init wget

# Create app directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy backend source code
COPY backend/src ./src

# Copy built frontend from previous stage
COPY --from=frontend-builder /frontend/dist ./public

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs /app/backups && \
    chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application in production mode
CMD ["node", "src/server.production-single-container.js"]