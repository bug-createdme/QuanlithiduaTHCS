import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok } from '../lib/http';
import { academicRouter } from '../modules/academic/academic.routes';
import { analyticsRouter } from '../modules/analytics/analytics.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { backupRouter } from '../modules/backup/backup.routes';
import { calendarRouter } from '../modules/calendar/calendar.routes';
import { configRouter } from '../modules/config/config.routes';
import { documentsRouter } from '../modules/documents/document.routes';
import { entityRouters } from '../modules/entities/entity.routes';
import { reportsRouter } from '../modules/reports/report.routes';
import { criteriaRouter } from '../modules/scores/criteria.routes';
import { scoresRouter } from '../modules/scores/score.routes';
import { settingsRouter } from '../modules/settings/settings.routes';
import { tasksRouter } from '../modules/tasks/task.routes';

export const apiRouter = Router();

/** Kiểm tra sức khỏe — dùng cho Docker healthcheck và giám sát. */
apiRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    return ok(res, {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  }),
);

apiRouter.use('/auth', authRouter);
apiRouter.use('/academic', academicRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/scores', scoresRouter);
apiRouter.use('/criteria', criteriaRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/backup', backupRouter);
apiRouter.use('/analytics', analyticsRouter);

// Sáu trang dùng chung bộ CRUD chuẩn.
for (const [path, router] of entityRouters) apiRouter.use(path, router);
