# ---------- Giai đoạn build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Cài phụ thuộc trước để tận dụng cache tầng.
COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---------- Giai đoạn chạy ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl là phụ thuộc thời gian chạy của Prisma trên Alpine.
RUN apk add --no-cache openssl curl

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# CLI `prisma` là devDependency nên `npm ci --omit=dev` ở trên không cài nó.
# Không có dòng này thì lệnh migrate lúc khởi động phải TẢI prisma từ npm mỗi
# lần container chạy: chậm, phụ thuộc mạng, và có thể kéo về phiên bản khác
# với phiên bản đã sinh ra Prisma Client. Phụ thuộc duy nhất của CLI là
# @prisma/engines, đã nằm trong thư mục @prisma copy ở trên.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/dist ./dist
COPY backend/prisma ./prisma

# Thư mục tệp đính kèm — gắn volume khi chạy để dữ liệu không mất theo container.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health || exit 1

# Áp dụng migration rồi mới khởi động API.
#
# Gọi thẳng tệp CLI thay vì qua `npx`: npx sẽ đi tìm trên mạng khi không thấy
# gói ở local, còn cách này luôn dùng đúng bản đã copy từ giai đoạn build.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/server.js"]
