# ============================================================
# CipherShield Frontend — Multi-stage Dockerfile
# ============================================================
# Stage 1 (builder): install deps & compile TypeScript/Vite
# Stage 2 (production): serve static dist via nginx:alpine
# ============================================================

# ---- Stage 1: Builder ----------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package manifests first (layer-cache optimisation)
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDeps needed for build)
RUN npm ci --prefer-offline

# Copy the rest of the source
COPY . .

# Build the production bundle
RUN npm run build

# ---- Stage 2: Production (nginx) -----------------------------
FROM nginx:1.27-alpine AS production

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx SPA config (handles client-side routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# nginx runs in the foreground
CMD ["nginx", "-g", "daemon off;"]
