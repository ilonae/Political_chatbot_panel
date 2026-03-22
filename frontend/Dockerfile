# ── Build stage ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY tailwind.config.js postcss.config.js components.json ./
COPY index.html ./
COPY src ./src

# Vite uses VITE_ prefix (not REACT_APP_).
# Empty string = use relative /api path, proxied by nginx.
ENV VITE_API_URL=""
RUN npm run build

# ── Runtime: nginx ───────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]