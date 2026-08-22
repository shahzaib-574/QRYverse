FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server ./server
COPY tsconfig.server.json tsconfig.server.build.json ./
RUN npm run server:build

FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    QRY_HOST=0.0.0.0 \
    QRY_PORT=8787 \
    QRY_DATABASE_PATH=/data/qryverse.sqlite

WORKDIR /app
COPY --from=build /app/dist-server ./server

RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8787
VOLUME ["/data"]

CMD ["node", "server/index.js"]
