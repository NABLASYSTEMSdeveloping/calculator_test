# --- сборка SPA -----------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /srv/frontend

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_API_TIMEOUT_MS=8000
ARG VITE_APP_VERSION=1.0.0
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS \
    VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

# --- раздача статики и shared volume --------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/frontend/dist /usr/share/nginx/html

EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:5173/healthz || exit 1

# Общий том: собранная статика доступна другим сервисам миссии
VOLUME ["/usr/share/nginx/html"]
