# syntax=docker/dockerfile:1
FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM build AS migrate
USER node
CMD ["npm", "run", "db:deploy"]

FROM build AS production-deps
RUN npm prune --omit=dev

FROM node:24.22.2-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP_DATA_DIR=/var/lib/vermietung
RUN install -d -o node -g node -m 0700 /var/lib/vermietung
COPY --from=production-deps /app/package.json ./
COPY --from=production-deps /app/node_modules ./node_modules

FROM runtime AS app
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
USER node
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]

FROM runtime AS worker
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
RUN node node_modules/playwright/cli.js install --with-deps chromium && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/worker ./worker
COPY --from=build /app/scripts/check-storage.ts ./scripts/check-storage.ts
USER node
CMD ["node", "--import", "tsx", "worker/reports.ts"]
