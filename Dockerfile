# ============================================================
# 多阶段构建 Dockerfile — ai-newline-center
# 基础镜像: node:20-slim (Debian)，兼容 Prisma 原生二进制
# ============================================================

# ---- 基础层 ----
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---- 安装依赖层 ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- 构建层 ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# 生成 Prisma Client（使用 linux-musl 或 debian 原生二进制）
RUN pnpm prisma generate
# 构建 Next.js standalone 产物
RUN pnpm build

# ---- 生产运行层 ----
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# 复制 standalone 产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制 Prisma 文件（迁移 + schema）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 创建 storage 目录（挂载卷时保持权限）
RUN mkdir -p public/storage/covers public/storage/videos && \
    chown -R nextjs:nodejs public/storage

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
