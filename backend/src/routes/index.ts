import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok } from '../lib/http';
import { academicRouter } from '../modules/academic/academic.routes';
import { analyticsRouter } from '../modules/analytics/analytics.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { backupRouter } from '../modules/backup/backup.routes';
import { calendarRouter } from '../modules/calendar/calendar.routes';
import { configRouter } from '../modules/config/config.routes';
import { homeroomTeachersRouter } from '../modules/academic/homeroom.routes';
import { documentsRouter } from '../modules/documents/document.routes';
import { entityRouters } from '../modules/entities/entity.routes';
import {
  equipmentTransactionsRouter,
  planTargetsRouter,
  trainingRecordsRouter,
} from '../modules/records/record.routes';
import { reportsRouter } from '../modules/reports/report.routes';
import { criteriaRouter } from '../modules/scores/criteria.routes';
import { scoreEvidenceRouter } from '../modules/scores/evidence.routes';
import { scoresRouter } from '../modules/scores/score.routes';
import { settingsRouter } from '../modules/settings/settings.routes';
import { taskDependenciesRouter } from '../modules/tasks/dependency.routes';
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
// Gắn trước academicRouter để đường dẫn con không bị router cha nuốt.
apiRouter.use('/academic/homeroom-teachers', homeroomTeachersRouter);
apiRouter.use('/academic', academicRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/scores/evidence', scoreEvidenceRouter);
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

// Các bảng con treo dưới một bản ghi cha: chỉ tiêu kế hoạch, sổ mượn–trả
// thiết bị, buổi bồi dưỡng thành viên, phụ thuộc công việc.
apiRouter.use('/plan-targets', planTargetsRouter);
apiRouter.use('/equipment-transactions', equipmentTransactionsRouter);
apiRouter.use('/training-records', trainingRecordsRouter);
apiRouter.use('/task-dependencies', taskDependenciesRouter);
