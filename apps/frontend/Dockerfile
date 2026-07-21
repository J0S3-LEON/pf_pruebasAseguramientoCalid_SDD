# Build from the monorepo root:
# docker build -f apps/frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 .
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY tsconfig.base.json ./
RUN npm ci

COPY packages/shared ./packages/shared
RUN npm run build --workspace @mindflow/shared

COPY apps/frontend ./apps/frontend
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build --workspace @mindflow/frontend

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER appuser
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
