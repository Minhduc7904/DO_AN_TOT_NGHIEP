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
COPY packages/common/package.json packages/common/package.json
COPY services/media/package.json services/media/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/observability packages/observability
COPY contracts contracts
COPY packages/common packages/common
COPY services/media services/media
RUN pnpm --filter @aiops-lms/contracts build \
    && pnpm --filter @aiops-lms/observability build \
    && pnpm --filter @aiops-lms/common build \
    && pnpm --filter @aiops-lms/media build
RUN pnpm --filter @aiops-lms/contracts deploy --legacy --prod /production/contracts
RUN pnpm --filter @aiops-lms/observability deploy --legacy --prod /production/observability
RUN pnpm --filter @aiops-lms/common deploy --legacy --prod /production/common
RUN pnpm --filter @aiops-lms/media deploy --legacy --prod /production/media

FROM node:22.13.1-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3004
WORKDIR /app

# Schema engine của `prisma migrate deploy` cần openssl trên Alpine; ffmpeg lấy khung hình video làm thumbnail.
RUN apk add --no-cache openssl ffmpeg

COPY --from=build --chown=node:node /production/media/node_modules ./node_modules
# `pnpm deploy --legacy` để lại symlink về /workspace; thay bằng bản đã deploy của từng package nội bộ.
RUN rm -rf node_modules/@aiops-lms
COPY --from=build --chown=node:node /production/contracts ./node_modules/@aiops-lms/contracts
COPY --from=build --chown=node:node /production/observability ./node_modules/@aiops-lms/observability
COPY --from=build --chown=node:node /production/common ./node_modules/@aiops-lms/common
RUN rm -rf node_modules/@aiops-lms/common/node_modules/@aiops-lms
COPY --from=build --chown=node:node /workspace/services/media/dist ./dist
COPY --from=build --chown=node:node /workspace/services/media/prisma ./prisma
COPY --from=build --chown=node:node /workspace/services/media/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /workspace/services/media/package.json ./package.json

USER node
EXPOSE 3004
# Migrate rồi chạy: `migrate deploy` giữ advisory lock nên nhiều replica không giẫm nhau.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
