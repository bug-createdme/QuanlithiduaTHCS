import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Ép kiểu và kiểm tra biến môi trường ngay lúc khởi động.
 * Thà chết sớm với thông báo rõ ràng còn hơn chạy sai âm thầm.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_MB: z.coerce.number().int().min(1).max(250).default(25),

  // 'silent' là mức hợp lệ của Pino, dùng để tắt hẳn log (ví dụ khi chạy test).
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

const raw = {
  ...process.env,
  // Trong môi trường phát triển, cho phép chạy ngay mà không cần sinh secret thủ công.
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-access-secret-change-me'),
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-refresh-secret-change-me'),
};

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Cấu hình môi trường không hợp lệ:\n${details}\n\nHãy kiểm tra tệp .env (mẫu ở .env.example).`);
}

const data = parsed.data;

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isDevelopment: data.NODE_ENV === 'development',
  corsOrigins: data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadDir: path.resolve(process.cwd(), data.UPLOAD_DIR),
  maxFileBytes: data.MAX_FILE_MB * 1024 * 1024,
} as const;

export type Env = typeof env;
