# ---------- Giai đoạn build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# URL API được nhúng vào bundle lúc build vì là biến NEXT_PUBLIC_*.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ---------- Giai đoạn chạy ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl
COPY frontend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bản build production nằm ở .next-prod (xem distDir trong next.config.mjs).
COPY --from=builder /app/.next-prod ./.next-prod
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/login || exit 1

CMD ["npx", "next", "start", "-p", "3000"]
