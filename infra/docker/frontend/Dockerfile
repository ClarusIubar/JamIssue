FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.json .env.example ./
COPY scripts ./scripts
COPY src ./src

RUN npm ci
RUN npm run build

FROM nginx:1.27-alpine

ENV FRONTEND_PORT=8080 \
    BACKEND_UPSTREAM=http://backend:8001 \
    PUBLIC_APP_BASE_URL= \
    PUBLIC_NAVER_MAP_CLIENT_ID=

COPY infra/docker/frontend/default.conf.template /etc/nginx/templates/default.conf.template
COPY infra/docker/frontend/40-write-app-config.sh /docker-entrypoint.d/40-write-app-config.sh
COPY --from=build /app/infra/nginx/site /usr/share/nginx/html

RUN chmod +x /docker-entrypoint.d/40-write-app-config.sh

EXPOSE 8080
