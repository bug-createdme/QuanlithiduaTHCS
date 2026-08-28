import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectDatabase, disconnectDatabase } from './lib/prisma';
import { purgeExpiredSessions } from './modules/auth/auth.service';
import { pruneSnapshots } from './modules/backup/snapshot.service';
import { generateRecurringTasks } from './modules/tasks/task.service';

/**
 * Tác vụ nền chạy mỗi ngày.
 * Ở bản gốc, những việc này chỉ chạy khi người dùng mở ứng dụng vì trình duyệt
 * không có lịch nền tin cậy. Có backend rồi thì chúng chạy thật sự định kỳ.
 */
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runMaintenance(): Promise<void> {
  try {
    const [sessions, snapshots, recurring] = await Promise.all([
      purgeExpiredSessions(),
      pruneSnapshots(),
      generateRecurringTasks(),
    ]);
    logger.info(
      { sessions, snapshots, recurringCreated: recurring.created },
      'Hoàn tất tác vụ bảo trì định kỳ',
    );
  } catch (error) {
    logger.error({ error }, 'Tác vụ bảo trì định kỳ thất bại');
  }
}

async function bootstrap(): Promise<void> {
  await fs.mkdir(env.uploadDir, { recursive: true });
  await connectDatabase();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, cors: env.corsOrigins },
      `API sẵn sàng tại http://localhost:${env.PORT}/api`,
    );
  });

  void runMaintenance();
  const maintenanceTimer = setInterval(() => void runMaintenance(), DAILY_INTERVAL_MS);
  maintenanceTimer.unref();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Đang dừng máy chủ…');
    clearInterval(maintenanceTimer);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    // Không để tiến trình treo vô hạn nếu còn kết nối chưa đóng.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Promise bị từ chối mà không được xử lý');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Ngoại lệ không bắt được — dừng tiến trình');
    process.exit(1);
  });
}

void bootstrap().catch((error: unknown) => {
  logger.fatal({ error }, 'Không khởi động được máy chủ');
  process.exit(1);
});
