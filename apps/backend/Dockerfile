# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files needed to install dependencies for the monorepo
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY tsconfig.base.json ./

RUN npm ci

# Copy source code and compile the shared package first so backend types resolve
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY packages/shared/jest.config.js ./packages/shared/jest.config.js
RUN npm run build --workspace @mindflow/shared

# Generate Prisma client before compiling the backend
COPY apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd /app && npx prisma generate --schema apps/backend/prisma/schema.prisma

# Copy backend source and compile the backend workspace
COPY apps/backend/tsconfig.json apps/backend/tsconfig.build.json ./apps/backend/
COPY apps/backend/src ./apps/backend/src

RUN npm run build --workspace @mindflow/backend

# ─── Stage 2: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production artifacts from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

CMD ["npm", "run", "start:prod", "--workspace", "@mindflow/backend"]
