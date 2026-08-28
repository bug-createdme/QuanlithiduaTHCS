import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Một instance PrismaClient duy nhất cho cả tiến trình.
 * Giữ trên globalThis để `tsx watch` hot-reload không mở thêm connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });

prisma.$on('error' as never, (e: unknown) => logger.error({ prisma: e }, 'Lỗi Prisma'));
prisma.$on('warn' as never, (e: unknown) => logger.warn({ prisma: e }, 'Cảnh báo Prisma'));

if (!env.isProduction) globalForPrisma.prisma = prisma;

/** BigInt không tuần tự hoá được bằng JSON.stringify mặc định. */
(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Đã kết nối PostgreSQL');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Đã ngắt kết nối PostgreSQL');
}
