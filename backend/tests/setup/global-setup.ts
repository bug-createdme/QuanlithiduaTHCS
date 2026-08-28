import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { ADMIN_DATABASE_URL, TEST_DATABASE_NAME, TEST_DATABASE_URL } from './test-env';

/**
 * Chạy MỘT LẦN trước toàn bộ bộ kiểm thử:
 *   1. Tạo database test nếu chưa có (không đụng database phát triển).
 *   2. Áp dụng toàn bộ migration để schema khớp với production.
 *
 * Dữ liệu trong từng tệp test do `resetDatabase()` lo — xem tests/helpers/db.ts.
 */
async function ensureTestDatabase(): Promise<void> {
  // Kết nối tới database quản trị `postgres` để có quyền tạo database mới.
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DATABASE_URL } } });
  try {
    // Tên database không tham số hoá được trong CREATE DATABASE; giá trị này
    // do test-env.ts kiểm soát và luôn kết thúc bằng "_test".
    await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
  } catch (error) {
    // 42P04 = database đã tồn tại; mọi lỗi khác là thật và phải ném lên.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('42P04') && !message.toLowerCase().includes('already exists')) {
      throw new Error(
        `Không tạo được database test "${TEST_DATABASE_NAME}". ` +
          `Hãy chắc chắn PostgreSQL đang chạy (docker compose up -d). Chi tiết: ${message}`,
      );
    }
  } finally {
    await admin.$disconnect();
  }
}

export default async function globalSetup(): Promise<void> {
  await ensureTestDatabase();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
