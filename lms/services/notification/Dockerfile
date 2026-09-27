FROM node:22.13.1-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global corepack@0.34.0 \
    && corepack enable \
    && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY contracts/package.json contracts/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY services/notification/package.json services/notification/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY contracts contracts
COPY packages/observability packages/observability
COPY services/notification services/notification
RUN pnpm --filter @aiops-lms/contracts build \
    && pnpm --filter @aiops-lms/observability build \
    && pnpm --filter @aiops-lms/notification build
RUN pnpm --filter @aiops-lms/contracts deploy --legacy --prod /production/contracts
RUN pnpm --filter @aiops-lms/observability deploy --legacy --prod /production/observability
RUN pnpm --filter @aiops-lms/notification deploy --legacy --prod /production/notification

FROM node:22.13.1-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3006
WORKDIR /app

COPY --from=build --chown=node:node /production/notification/node_modules ./node_modules
COPY --from=build --chown=node:node /production/contracts ./node_modules/@aiops-lms/contracts
COPY --from=build --chown=node:node /production/observability ./node_modules/@aiops-lms/observability
COPY --from=build --chown=node:node /workspace/services/notification/dist ./dist
COPY --from=build --chown=node:node /workspace/services/notification/package.json ./package.json

USER node
EXPOSE 3006
CMD ["node", "dist/main.js"]
