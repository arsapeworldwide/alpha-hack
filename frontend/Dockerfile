# Сборка фронтенда в два этапа: Node собирает статику, nginx её раздаёт и проксирует /api на бэкенд.

# --- Этап 1: сборка ---
FROM node:22-alpine AS build
WORKDIR /app

# Сначала только манифесты: слой с зависимостями кешируется, пока не меняется package-lock.json
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Режим API задаётся при сборке (Vite вшивает переменные в код)
ARG VITE_USE_MOCK=true
ARG VITE_API_BASE_URL=/api
ARG VITE_MOCK_BKI_FAILURE=false
ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MOCK_BKI_FAILURE=$VITE_MOCK_BKI_FAILURE

RUN npm run build

# --- Этап 2: раздача ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
