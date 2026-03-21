FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY components.json ./
COPY public ./public
COPY src ./src

# Backend URL will be proxied through nginx at /api, so use relative path
ENV REACT_APP_API_URL=""
RUN npm run build

# ────────────────────────────────────────────────────────────────
# Runtime: nginx serves the built React app
FROM nginx:alpine

# Copy built app
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
