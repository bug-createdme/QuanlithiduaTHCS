import { config as loadEnv } from 'dotenv';

/**
 * Chuẩn bị biến môi trường cho bộ kiểm thử.
 *
 * ĐIỂM QUAN TRỌNG: test luôn chạy trên MỘT DATABASE RIÊNG (mặc định là tên
 * database phát triển cộng hậu tố `_test`). Bộ kiểm thử sẽ dọn sạch dữ liệu
 * trước mỗi tệp, nên tuyệt đối không được trỏ vào database đang làm việc.
 *
 * Tệp này phải được import TRƯỚC mọi module đọc `process.env`
 * (đặc biệt là `src/config/env.ts`).
 */

loadEnv();

/** Đổi tên database trong chuỗi kết nối, giữ nguyên mọi tham số khác. */
export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const current = parsed.pathname.replace(/^\//, '');
  if (!current) throw new Error('DATABASE_URL không chứa tên database.');
  parsed.pathname = `/${current.endsWith('_test') ? current : `${current}_test`}`;
  return parsed.toString();
}

/** Chuỗi kết nối tới database `postgres` để tạo/xóa database test. */
export function toAdminDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = '/postgres';
  parsed.search = '';
  return parsed.toString();
}

export function databaseNameOf(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/**
 * Ghi nhớ chuỗi kết nối gốc ngay lần đầu.
 *
 * Cần thiết vì tệp này ghi đè `process.env.DATABASE_URL`, mà module có thể
 * được đánh giá lại ở tiến trình con của Vitest. Không ghi nhớ thì lần sau
 * sẽ đọc phải giá trị đã đổi và bộ chặn an toàn báo nhầm.
 */
const DEV_URL_KEY = 'TPT_DEV_DATABASE_URL';
process.env[DEV_URL_KEY] ??= process.env.DATABASE_URL;

const source = process.env[DEV_URL_KEY];
if (!source) {
  throw new Error(
    'Thiếu DATABASE_URL. Hãy sao chép backend/.env.example thành backend/.env trước khi chạy test.',
  );
}

// Cho phép chỉ định riêng qua TEST_DATABASE_URL; mặc định suy ra từ DATABASE_URL.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? toTestDatabaseUrl(source);
export const ADMIN_DATABASE_URL = toAdminDatabaseUrl(source);
export const TEST_DATABASE_NAME = databaseNameOf(TEST_DATABASE_URL);

// Chặn thảm họa: test dọn sạch dữ liệu nên tuyệt đối không được trỏ vào
// database đang làm việc.
if (databaseNameOf(source) === TEST_DATABASE_NAME) {
  throw new Error(
    `Database test ("${TEST_DATABASE_NAME}") trùng với database phát triển. ` +
      'Test sẽ xóa sạch dữ liệu — hãy đặt TEST_DATABASE_URL trỏ tới database riêng.',
  );
}

// Ép mọi module phía dưới dùng database test.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret';
// Giảm vòng băm để test chạy nhanh; production vẫn dùng 12.
process.env.BCRYPT_ROUNDS = '4';
process.env.LOG_LEVEL = 'silent';
// Nới giới hạn tần suất để hàng trăm request trong test không bị chặn.
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.UPLOAD_DIR = './tests/.uploads';
