# Игровой сервер «Всадников Арены». Собирать из корня репозитория:
#   docker compose -f server/docker-compose.yml up -d --build
#
# 1) сборка: код боя из src/ + three.js → один файл dist/index.js
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY server ./server
RUN npm run build:server

# 2) запуск: только node, ws и собранный файл (~1 МБ)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/ >/dev/null || exit 1
CMD ["node", "dist/index.js"]
