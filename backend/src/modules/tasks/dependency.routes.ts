import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { businessRule, conflict, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';

/**
 * Phụ thuộc giữa các công việc.
 *
 * Bảng `task_dependencies` có sẵn trong lược đồ từ đầu nhưng chưa có điểm cuối
 * nào chạm tới. Quy tắc quan trọng nhất ở đây là CHẶN VÒNG LẶP: nếu A chờ B và
 * B chờ A thì không việc nào bắt đầu được, và mọi thuật toán duyệt sau này sẽ
 * chạy vô hạn.
 */

const idSchema = z.object({ id: z.string().uuid('Mã bản ghi không hợp lệ.') });

const DEPENDENCY_LABEL: Record<string, string> = {
  FINISH_TO_START: 'Xong trước – mới bắt đầu',
  START_TO_START: 'Bắt đầu cùng lúc',
};

const createSchema = z.object({
  taskId: z.string().uuid('Hãy chọn công việc.'),
  dependsOnId: z.string().uuid('Hãy chọn công việc cần chờ.'),
  type: z.enum(['FINISH_TO_START', 'START_TO_START']).default('FINISH_TO_START'),
});

/**
 * Kiểm tra thêm cạnh `taskId → dependsOnId` có tạo thành vòng không.
 *
 * Duyệt theo chiều "việc này chờ việc nào": xuất phát từ `dependsOnId`, nếu đi
 * ngược lên mà gặp lại `taskId` thì cạnh mới khép thành vòng.
 */
async function findCycle(taskId: string, dependsOnId: string): Promise<string[] | null> {
  const visited = new Set<string>();
  // Mỗi phần tử là đường đi đã qua, để báo lại đúng chuỗi gây vòng lặp.
  const stack: string[][] = [[dependsOnId]];

  while (stack.length > 0) {
    const path = stack.pop()!;
    const current = path[path.length - 1]!;
    if (current === taskId) return path;
    if (visited.has(current)) continue;
    visited.add(current);

    const edges = await prisma.taskDependency.findMany({
      where: { taskId: current, deletedAt: null },
      select: { dependsOnId: true },
    });
    for (const edge of edges) stack.push([...path, edge.dependsOnId]);
  }
  return null;
}

export const taskDependenciesRouter = Router();
taskDependenciesRouter.use(requireAuth);

// ── Danh sách phụ thuộc của một công việc ──────────────────────────────────
taskDependenciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { taskId } = parseOrThrow(
      z.object({ taskId: z.string().uuid('Thiếu mã công việc.') }),
      req.query,
    );
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw notFound('Công việc');

    const [dependsOn, blocking] = await Promise.all([
      // Việc này đang chờ những việc nào.
      prisma.taskDependency.findMany({
        where: { taskId, deletedAt: null },
        include: {
          dependsOn: { select: { id: true, title: true, status: true, dueDate: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Những việc nào đang chờ việc này.
      prisma.taskDependency.findMany({
        where: { dependsOnId: taskId, deletedAt: null },
        include: {
          task: { select: { id: true, title: true, status: true, dueDate: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return ok(res, {
      dependsOn,
      blocking,
      /** Còn việc phải chờ nào chưa xong thì việc này chưa nên bắt đầu. */
      blockedBy: dependsOn.filter((d) => d.dependsOn.status !== 'DONE').length,
    });
  }),
);

// ── Danh sách công việc có thể chọn làm việc phải chờ ──────────────────────
taskDependenciesRouter.get(
  '/candidates',
  asyncHandler(async (req, res) => {
    const { taskId } = parseOrThrow(
      z.object({ taskId: z.string().uuid('Thiếu mã công việc.') }),
      req.query,
    );
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw notFound('Công việc');

    const existing = await prisma.taskDependency.findMany({
      where: { taskId, deletedAt: null },
      select: { dependsOnId: true },
    });
    const taken = new Set(existing.map((e) => e.dependsOnId));

    // Chỉ gợi ý công việc cùng năm học; loại chính nó và các việc đã chọn.
    const candidates = await prisma.task.findMany({
      where: {
        deletedAt: null,
        schoolYearId: task.schoolYearId,
        id: { not: taskId, notIn: [...taken] },
      },
      select: { id: true, title: true, status: true, dueDate: true },
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
      take: 300,
    });
    return ok(res, candidates);
  }),
);

// ── Thêm phụ thuộc ────────────────────────────────────────────────────────
taskDependenciesRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(createSchema, req.body);

    if (body.taskId === body.dependsOnId) {
      throw businessRule('Một công việc không thể chờ chính nó.');
    }

    const [task, dependsOn] = await Promise.all([
      prisma.task.findFirst({ where: { id: body.taskId, deletedAt: null } }),
      prisma.task.findFirst({ where: { id: body.dependsOnId, deletedAt: null } }),
    ]);
    if (!task) throw notFound('Công việc');
    if (!dependsOn) throw notFound('Công việc cần chờ');

    if (task.schoolYearId !== dependsOn.schoolYearId) {
      throw businessRule('Chỉ liên kết được các công việc trong cùng một năm học.');
    }

    const duplicate = await prisma.taskDependency.findFirst({
      where: { taskId: body.taskId, dependsOnId: body.dependsOnId, deletedAt: null },
    });
    if (duplicate) throw conflict('Phụ thuộc này đã được khai báo.');

    const cycle = await findCycle(body.taskId, body.dependsOnId);
    if (cycle) {
      const titles = await prisma.task.findMany({
        where: { id: { in: cycle } },
        select: { id: true, title: true },
      });
      const byId = new Map(titles.map((t) => [t.id, t.title]));
      const chain = [task.title, ...cycle.map((id) => byId.get(id) ?? '…')].join(' → ');
      throw businessRule(`Liên kết này tạo thành vòng lặp: ${chain}. Hãy chọn công việc khác.`, {
        cycle,
      });
    }

    // Bản ghi cũ đã xóa mềm vẫn giữ khóa duy nhất (taskId, dependsOnId),
    // nên phải hồi sinh thay vì tạo mới để không đụng ràng buộc.
    const soft = await prisma.taskDependency.findFirst({
      where: { taskId: body.taskId, dependsOnId: body.dependsOnId },
    });
    const row = soft
      ? await prisma.taskDependency.update({
          where: { id: soft.id },
          data: { type: body.type, deletedAt: null, revision: { increment: 1 } },
        })
      : await prisma.taskDependency.create({ data: body });

    await writeAudit({
      action: 'create',
      entity: 'task_dependencies',
      entityId: row.id,
      summary: `${task.title} chờ ${dependsOn.title} (${DEPENDENCY_LABEL[body.type]})`,
      newValue: dependsOn.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, row);
  }),
);

// ── Đổi kiểu phụ thuộc ────────────────────────────────────────────────────
taskDependenciesRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { type } = parseOrThrow(
      z.object({ type: z.enum(['FINISH_TO_START', 'START_TO_START']) }),
      req.body,
    );
    const existing = await prisma.taskDependency.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Phụ thuộc công việc');

    const row = await prisma.taskDependency.update({
      where: { id },
      data: { type, revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'update',
      entity: 'task_dependencies',
      entityId: id,
      summary: `Đổi kiểu phụ thuộc thành ${DEPENDENCY_LABEL[type]}`,
      oldValue: DEPENDENCY_LABEL[existing.type],
      newValue: DEPENDENCY_LABEL[type],
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, row);
  }),
);

// ── Bỏ phụ thuộc ──────────────────────────────────────────────────────────
taskDependenciesRouter.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.taskDependency.findFirst({
      where: { id, deletedAt: null },
      include: { task: { select: { title: true } }, dependsOn: { select: { title: true } } },
    });
    if (!existing) throw notFound('Phụ thuộc công việc');

    await prisma.taskDependency.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'delete',
      entity: 'task_dependencies',
      entityId: id,
      summary: `Bỏ liên kết: ${existing.task.title} chờ ${existing.dependsOn.title}`,
      oldValue: existing.dependsOn.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);
