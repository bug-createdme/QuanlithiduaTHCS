import { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { describeRecord, writeAudit } from '../../lib/audit';
import { localISO, toDbDate } from '../../lib/dates';
import { notFound, revisionConflict } from '../../lib/errors';
import {
  asyncHandler,
  created,
  noContent,
  ok,
  paginationSchema,
  parseOrThrow,
  toJsonInput,
  toPageMeta,
} from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { parseScope, scopeWhere } from '../../lib/scope';
import { toCsv } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import {
  customValuesSchema,
  optionalDate,
  optionalLongText,
  optionalText,
  optionalUuid,
  requiredDate,
  scopeFieldsWithSemester,
} from '../entities/entity.schemas';
import {
  assertCompletable,
  assertDateOrder,
  generateRecurringTasks,
  parseChecklist,
  resolveRepeatNext,
  syncChecklist,
} from './task.service';

const idSchema = z.object({ id: z.string().uuid('Mã công việc không hợp lệ.') });

const taskBodySchema = z.object({
  ...scopeFieldsWithSemester,
  title: z.string().trim().min(1, 'Hãy nhập tiêu đề công việc.').max(200),
  groupName: optionalText(80),
  startDate: optionalDate(),
  dueDate: requiredDate(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  status: z.enum(['TODO', 'DOING', 'WAITING', 'REVIEW', 'DONE', 'PAUSED']).default('TODO'),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  coordination: optionalText(200),
  obstacle: optionalLongText(),
  notes: optionalLongText(),
  repeatRule: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('NONE'),
  repeatUntil: optionalDate(),
  /** Textarea checklist: mỗi dòng một mục, tiền tố "!" là bắt buộc. */
  checklist: optionalLongText(),
  customValues: customValuesSchema,
});

const taskUpdateSchema = taskBodySchema.partial();

const listQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  priority: z.string().trim().max(40).optional(),
  /** Bộ lọc nhanh từ các thẻ KPI của trang Tổng quan. */
  filter: z.enum(['today', 'soon', 'overdue']).optional(),
  all: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
});

const includeChecklist = { checkItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } } as const;

function buildTaskWhere(req: Request): Record<string, unknown> {
  const scope = parseScope(req.query);
  const query = parseOrThrow(listQuerySchema, req.query);
  const where = scopeWhere(scope, { semester: true, campus: true });
  const and: unknown[] = Array.isArray(where.AND) ? [...(where.AND as unknown[])] : [];

  const todayIso = localISO(new Date());
  const todayDate = toDbDate(todayIso)!;

  if (query.filter === 'today') and.push({ dueDate: todayDate });
  if (query.filter === 'soon') {
    const soon = new Date(todayDate);
    soon.setUTCDate(soon.getUTCDate() + 3);
    and.push({ dueDate: { gt: todayDate, lte: soon } });
  }
  if (query.filter === 'overdue') and.push({ dueDate: { lt: todayDate }, status: { not: 'DONE' } });

  if (query.status) and.push({ status: query.status });
  if (query.priority) and.push({ priority: query.priority });
  if (query.q) {
    and.push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { groupName: { contains: query.q, mode: 'insensitive' } },
        { coordination: { contains: query.q, mode: 'insensitive' } },
        { notes: { contains: query.q, mode: 'insensitive' } },
        { obstacle: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

// ── Danh sách ──────────────────────────────────────────────────────────────
tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(listQuerySchema, req.query);
    const where = buildTaskWhere(req);

    const total = await prisma.task.count({ where });
    const rows = await prisma.task.findMany({
      where,
      include: includeChecklist,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      ...(query.all ? {} : { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    });

    return ok(res, rows, toPageMeta(total, query.page, query.all ? Math.max(total, 1) : query.pageSize));
  }),
);

// ── Xuất CSV ───────────────────────────────────────────────────────────────
tasksRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await prisma.task.findMany({
      where: buildTaskWhere(req),
      include: { campus: true },
      orderBy: [{ dueDate: 'asc' }],
    });
    const csv = toCsv(
      ['Công việc', 'Nhóm', 'Cơ sở', 'Hạn', 'Trạng thái', 'Tiến độ'],
      rows.map((t) => [
        t.title,
        t.groupName ?? '',
        t.campus?.name ?? 'Toàn trường',
        localISO(t.dueDate),
        t.status,
        `${t.progress}%`,
      ]),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cong-viec-${localISO(new Date())}.csv"`);
    return res.send(csv);
  }),
);

// ── Thư viện mẫu công việc ─────────────────────────────────────────────────
tasksRouter.get(
  '/templates',
  asyncHandler(async (_req, res) =>
    ok(
      res,
      await prisma.taskTemplate.findMany({
        where: { deletedAt: null, active: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ),
  ),
);

tasksRouter.post(
  '/templates/apply',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        semesterId: optionalUuid(),
        campusId: optionalUuid(),
        templateIds: z.array(z.string().uuid()).min(1, 'Hãy chọn ít nhất một mẫu.'),
      }),
      req.body,
    );

    const templates = await prisma.taskTemplate.findMany({
      where: { id: { in: body.templateIds }, deletedAt: null },
    });
    if (!templates.length) throw notFound('Mẫu công việc');

    const todayIso = localISO(new Date());
    const rows = await prisma.$transaction(
      templates.map((template) => {
        const due = new Date(`${todayIso}T00:00:00.000Z`);
        due.setUTCDate(due.getUTCDate() + template.defaultDueOffsetDays);
        return prisma.task.create({
          data: {
            schoolYearId: body.schoolYearId,
            semesterId: body.semesterId,
            campusId: body.campusId,
            title: template.title,
            groupName: template.groupName,
            startDate: toDbDate(todayIso),
            dueDate: due,
            priority: 'NORMAL',
            status: 'TODO',
            progress: 0,
          },
        });
      }),
    );

    await writeAudit({
      action: 'task_template_apply',
      entity: 'tasks',
      summary: `Thêm ${rows.length} công việc từ mẫu`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, rows);
  }),
);

// ── Sinh việc lặp đã đến hạn ───────────────────────────────────────────────
tasksRouter.post(
  '/generate-recurring',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { schoolYearId } = parseOrThrow(
      z.object({ schoolYearId: z.string().uuid().optional() }),
      req.body ?? {},
    );
    const result = await generateRecurringTasks(schoolYearId);
    if (result.created > 0) {
      await writeAudit({
        action: 'task_recurring_generate',
        entity: 'tasks',
        summary: `Sinh ${result.created} công việc lặp`,
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
    }
    return ok(res, result);
  }),
);

// ── Chi tiết ───────────────────────────────────────────────────────────────
tasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const task = await prisma.task.findFirst({ where: { id, deletedAt: null }, include: includeChecklist });
    if (!task) throw notFound('Công việc');
    return ok(res, task);
  }),
);

// ── Tạo mới ────────────────────────────────────────────────────────────────
tasksRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(taskBodySchema, req.body);
    assertDateOrder(body.startDate, body.dueDate);

    const checklist = parseChecklist(body.checklist);
    const { checklist: _omit, ...rest } = body;

    const task = await prisma.$transaction(async (tx) => {
      const row = await tx.task.create({
        data: {
          ...rest,
          customValues: toJsonInput(rest.customValues),
          startDate: toDbDate(body.startDate),
          dueDate: toDbDate(body.dueDate)!,
          repeatUntil: toDbDate(body.repeatUntil),
          repeatNextAt: resolveRepeatNext({ repeatRule: body.repeatRule, dueDate: body.dueDate }, null),
        },
      });
      if (checklist.length) await syncChecklist(tx, row.id, checklist);
      return row;
    });

    await writeAudit({
      action: 'create',
      entity: 'tasks',
      entityId: task.id,
      summary: task.title,
      newValue: task.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });

    return created(res, await prisma.task.findUnique({ where: { id: task.id }, include: includeChecklist }));
  }),
);

// ── Cập nhật ───────────────────────────────────────────────────────────────
tasksRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Công việc');

    if (req.body?.revision !== undefined && Number(req.body.revision) !== existing.revision) {
      throw revisionConflict(existing.revision);
    }

    const body = parseOrThrow(taskUpdateSchema, req.body);
    const startDate = body.startDate ?? (existing.startDate ? localISO(existing.startDate) : null);
    const dueDate = body.dueDate ?? localISO(existing.dueDate);
    assertDateOrder(startDate, dueDate);

    if (body.status) await assertCompletable(id, body.status);

    const checklist = body.checklist !== undefined ? parseChecklist(body.checklist) : null;
    // customValues tách riêng vì cột JSON của Prisma không nhận null trực tiếp.
    const { checklist: _omit, customValues, ...rest } = body;
    const repeatRule = body.repeatRule ?? existing.repeatRule;

    const task = await prisma.$transaction(async (tx) => {
      const data: Prisma.TaskUncheckedUpdateInput = {
        ...rest,
        ...(customValues !== undefined ? { customValues: toJsonInput(customValues) } : {}),
        ...(body.startDate !== undefined ? { startDate: toDbDate(body.startDate) } : {}),
        ...(body.dueDate !== undefined ? { dueDate: toDbDate(body.dueDate)! } : {}),
        ...(body.repeatUntil !== undefined ? { repeatUntil: toDbDate(body.repeatUntil) } : {}),
        repeatNextAt: resolveRepeatNext({ repeatRule, dueDate }, existing),
        ...(repeatRule === 'NONE' ? { repeatUntil: null } : {}),
        revision: { increment: 1 },
      };
      const row = await tx.task.update({ where: { id }, data });
      if (checklist) await syncChecklist(tx, id, checklist);
      return row;
    });

    await writeAudit({
      action: 'update',
      entity: 'tasks',
      entityId: id,
      summary: task.title,
      oldValue: existing.status,
      newValue: task.status,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });

    return ok(res, await prisma.task.findUnique({ where: { id }, include: includeChecklist }));
  }),
);

// ── Nhân bản ───────────────────────────────────────────────────────────────
tasksRouter.post(
  '/:id/clone',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const source = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: { checkItems: { where: { deletedAt: null } } },
    });
    if (!source) throw notFound('Công việc');

    const clone = await prisma.$transaction(async (tx) => {
      const row = await tx.task.create({
        data: {
          schoolYearId: source.schoolYearId,
          semesterId: source.semesterId,
          campusId: source.campusId,
          title: `${source.title} (bản sao)`,
          groupName: source.groupName,
          startDate: source.startDate,
          dueDate: source.dueDate,
          priority: source.priority,
          status: 'TODO',
          progress: 0,
          coordination: source.coordination,
          obstacle: source.obstacle,
          notes: source.notes,
          customValues: source.customValues ?? undefined,
        },
      });
      if (source.checkItems.length) {
        await tx.taskCheckItem.createMany({
          data: source.checkItems.map((item) => ({
            taskId: row.id,
            label: item.label,
            required: item.required,
            done: false,
            sortOrder: item.sortOrder,
          })),
        });
      }
      return row;
    });

    await writeAudit({
      action: 'clone',
      entity: 'tasks',
      entityId: clone.id,
      summary: clone.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, await prisma.task.findUnique({ where: { id: clone.id }, include: includeChecklist }));
  }),
);

// ── Bật/tắt một mục checklist ──────────────────────────────────────────────
tasksRouter.patch(
  '/check-items/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { done } = parseOrThrow(z.object({ done: z.boolean() }), req.body);

    const item = await prisma.taskCheckItem.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw notFound('Mục checklist');

    const updated = await prisma.taskCheckItem.update({
      where: { id },
      data: { done, revision: { increment: 1 } },
    });
    return ok(res, updated);
  }),
);

// ── Xóa mềm ────────────────────────────────────────────────────────────────
tasksRouter.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Công việc');

    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), repeatOccurrenceKey: null, revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'delete',
      entity: 'tasks',
      entityId: id,
      summary: describeRecord(existing as unknown as Record<string, unknown>),
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);
