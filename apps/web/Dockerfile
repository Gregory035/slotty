# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
ARG VITE_API_URL=/api
ARG VITE_SITE_URL
ARG VITE_GA_MEASUREMENT_ID
ARG VITE_YM_COUNTER_ID
ARG SEO_INDEXING_ENABLED=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
ENV VITE_YM_COUNTER_ID=$VITE_YM_COUNTER_ID
ENV SEO_INDEXING_ENABLED=$SEO_INDEXING_ENABLED
ENV VITE_SEO_INDEXING_ENABLED=$SEO_INDEXING_ENABLED
RUN npm run build -w @telegram-business/web

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
