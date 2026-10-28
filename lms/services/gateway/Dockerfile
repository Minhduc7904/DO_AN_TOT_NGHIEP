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
COPY packages/common/package.json packages/common/package.json
COPY services/auth/package.json services/auth/package.json
COPY services/course/package.json services/course/package.json
COPY services/gateway/package.json services/gateway/package.json
COPY services/student/package.json services/student/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/observability packages/observability
COPY contracts contracts
COPY packages/common packages/common
COPY services/gateway services/gateway
RUN pnpm --filter @aiops-lms/contracts build \
    && pnpm --filter @aiops-lms/observability build \
    && pnpm --filter @aiops-lms/common build \
    && pnpm --filter @aiops-lms/gateway build
RUN pnpm --filter @aiops-lms/contracts deploy --legacy --prod /production/contracts
RUN pnpm --filter @aiops-lms/observability deploy --legacy --prod /production/observability
RUN pnpm --filter @aiops-lms/common deploy --legacy --prod /production/common
RUN pnpm --filter @aiops-lms/gateway deploy --legacy --prod /production/gateway

FROM node:22.13.1-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /production/gateway/node_modules ./node_modules
# `pnpm deploy --legacy` để lại symlink về /workspace; thay bằng bản đã deploy của từng package nội bộ.
RUN rm -rf node_modules/@aiops-lms
COPY --from=build --chown=node:node /production/contracts ./node_modules/@aiops-lms/contracts
COPY --from=build --chown=node:node /production/observability ./node_modules/@aiops-lms/observability
COPY --from=build --chown=node:node /production/common ./node_modules/@aiops-lms/common
RUN rm -rf node_modules/@aiops-lms/common/node_modules/@aiops-lms
COPY --from=build --chown=node:node /workspace/services/gateway/dist ./dist
COPY --from=build --chown=node:node /workspace/services/gateway/package.json ./package.json

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
