import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],

    /**
     * Test tích hợp dùng chung một database nên phải chạy tuần tự:
     * mỗi tệp dọn sạch dữ liệu ở beforeAll, chạy song song sẽ giẫm chân nhau.
     */
    fileParallelism: false,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },

    testTimeout: 30_000,
    hookTimeout: 120_000,
    teardownTimeout: 30_000,

    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/*.d.ts'],
    },
  },
});
