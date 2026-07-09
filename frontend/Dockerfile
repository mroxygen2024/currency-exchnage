# ==============================================================================
# Stage 1: Build the React/Vite application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies (ci ensures clean install from lockfile)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==============================================================================
# Stage 2: Serve with nginx
# ==============================================================================
FROM nginx:1.25-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config for serving the SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 3000 (internal, proxied by main nginx)
EXPOSE 3000

# nginx runs in foreground by default
CMD ["nginx", "-g", "daemon off;"]
