FROM node:22.13.1-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/course/package.json services/course/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY services/course services/course
RUN pnpm build
RUN pnpm --filter @aiops-lms/course deploy --legacy --prod /production/course

FROM node:22.13.1-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3002
WORKDIR /app

COPY --from=build --chown=node:node /production/course/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/course/dist ./dist
COPY --from=build --chown=node:node /workspace/services/course/package.json ./package.json

USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
