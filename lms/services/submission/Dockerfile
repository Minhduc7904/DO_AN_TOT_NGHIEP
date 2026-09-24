FROM node:22.13.1-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global corepack@0.34.0 \
    && corepack enable \
    && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/observability/package.json packages/observability/package.json
COPY services/submission/package.json services/submission/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/observability packages/observability
COPY services/submission services/submission
RUN pnpm --filter @aiops-lms/observability build && pnpm --filter @aiops-lms/submission build
RUN pnpm --filter @aiops-lms/observability deploy --legacy --prod /production/observability
RUN pnpm --filter @aiops-lms/submission deploy --legacy --prod /production/submission

FROM node:22.13.1-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3004
WORKDIR /app

COPY --from=build --chown=node:node /production/submission/node_modules ./node_modules
COPY --from=build --chown=node:node /production/observability ./node_modules/@aiops-lms/observability
COPY --from=build --chown=node:node /workspace/services/submission/dist ./dist
COPY --from=build --chown=node:node /workspace/services/submission/package.json ./package.json

USER node
EXPOSE 3004
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/main.js"]
