# 微金100 后端镜像（多阶段）
# 国内服务器构建：npm 与 Prisma 引擎走 npmmirror，海外构建可 --build-arg 覆盖
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

FROM node:20-alpine AS build
ARG NPM_REGISTRY
ARG PRISMA_ENGINES_MIRROR
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm config set registry $NPM_REGISTRY && npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
ARG NPM_REGISTRY
ARG PRISMA_ENGINES_MIRROR
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
ENV NODE_ENV=production
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm config set registry $NPM_REGISTRY && npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3100
# 启动时先跑迁移，再起服务
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
