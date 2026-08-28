import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { businessRule, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalLongText, optionalText } from '../entities/entity.schemas';

const idSchema = z.object({ id: z.string().uuid() });

/** Thực thể có thể gắn trường tùy chỉnh — đúng danh sách của bản gốc. */
const CUSTOM_FIELD_ENTITIES = [
  'plans',
  'tasks',
  'activities',
  'documents',
  'commendations',
  'equipment',
] as const;

const customFieldSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITIES),
  name: z.string().trim().min(1, 'Hãy nhập tên trường.').max(150),
  fieldType: z
    .enum([
      'SHORT_TEXT',
      'LONG_TEXT',
      'NUMBER',
      'DATE',
      'SINGLE_CHOICE',
      'MULTI_CHOICE',
      'BOOLEAN',
      'LINK',
      'FILE',
    ])
    .default('SHORT_TEXT'),
  options: optionalText(2000),
  description: optionalLongText(),
  required: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(99),
  active: z.coerce.boolean().default(true),
});

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// ═══════════════════ Thiết lập ứng dụng (key-value) ════════════════════════

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.appSetting.findMany();
    return ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }),
);

settingsRouter.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const { key } = parseOrThrow(z.object({ key: z.string().max(80) }), req.params);
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row) throw notFound(`Thiết lập "${key}"`);
    return ok(res, row.value);
  }),
);

settingsRouter.put(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(z.record(z.string().max(80), z.unknown()), req.body);
    const entries = Object.entries(body);
    if (!entries.length) throw businessRule('Không có thiết lập nào để lưu.');

    // Ba ngưỡng cảnh báo dung lượng phải tăng dần — quy tắc của bản gốc.
    const low = Number(body.storage_warning_low);
    const high = Number(body.storage_warning_high);
    const critical = Number(body.storage_warning_critical);
    if ([low, high, critical].every(Number.isFinite) && !(low < high && high < critical)) {
      throw businessRule('Ba ngưỡng phải tăng dần: sớm < cao < nguy cấp.');
    }

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
    );

    await writeAudit({
      action: 'settings_update',
      entity: 'app_settings',
      summary: `Cập nhật ${entries.length} thiết lập`,
      newValue: entries.map(([k]) => k).join(', '),
      userId: currentUserId(req),
      ipAddress: req.ip,
    });

    const rows = await prisma.appSetting.findMany();
    return ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }),
);

// ═══════════════════════ Trường tùy chỉnh ══════════════════════════════════

settingsRouter.get(
  '/custom-fields/:entityType',
  asyncHandler(async (req, res) => {
    const { entityType } = parseOrThrow(
      z.object({ entityType: z.enum(CUSTOM_FIELD_ENTITIES) }),
      req.params,
    );
    const { includeInactive } = parseOrThrow(
      z.object({
        includeInactive: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      }),
      req.query,
    );

    return ok(
      res,
      await prisma.customFieldDefinition.findMany({
        where: { entityType, deletedAt: null, ...(includeInactive ? {} : { active: true }) },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }),
);

settingsRouter.post(
  '/custom-fields',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(customFieldSchema, req.body);

    // Kiểu lựa chọn bắt buộc phải khai báo danh sách giá trị.
    if (
      (body.fieldType === 'SINGLE_CHOICE' || body.fieldType === 'MULTI_CHOICE') &&
      !body.options?.trim()
    ) {
      throw businessRule('Trường dạng lựa chọn cần khai báo các giá trị, ngăn bằng dấu |.');
    }

    return created(res, await prisma.customFieldDefinition.create({ data: body }));
  }),
);

settingsRouter.patch(
  '/custom-fields/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.customFieldDefinition.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Trường tùy chỉnh');

    const body = parseOrThrow(customFieldSchema.partial(), req.body);
    return ok(
      res,
      await prisma.customFieldDefinition.update({
        where: { id },
        data: { ...body, revision: { increment: 1 } },
      }),
    );
  }),
);

settingsRouter.delete(
  '/custom-fields/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.customFieldDefinition.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Trường tùy chỉnh');

    await prisma.customFieldDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    return noContent(res);
  }),
);

// ═══════════════════════ Dữ liệu mẫu ═══════════════════════════════════════

settingsRouter.get(
  '/sample/status',
  asyncHandler(async (_req, res) => {
    const [classes, criteriaSets, criteria, tasks, schools] = await Promise.all([
      prisma.class.count({ where: { isSample: true, deletedAt: null } }),
      prisma.criteriaSet.count({ where: { isSample: true, deletedAt: null } }),
      prisma.criterion.count({ where: { isSample: true, deletedAt: null } }),
      prisma.task.count({ where: { isSample: true, deletedAt: null } }),
      prisma.school.count({ where: { isSample: true, deletedAt: null } }),
    ]);
    const total = classes + criteriaSets + criteria + tasks + schools;
    return ok(res, { total, classes, criteriaSets, criteria, tasks, schools, present: total > 0 });
  }),
);

settingsRouter.delete(
  '/sample',
  requireWrite,
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);

    // Chỉ xóa được dữ liệu mẫu chưa phát sinh nghiệp vụ thật.
    const usedClasses = await prisma.scoreEntry.findMany({
      where: { deletedAt: null, class: { isSample: true } },
      select: { classId: true },
      distinct: ['classId'],
    });
    if (usedClasses.length) {
      throw businessRule(
        `${usedClasses.length} lớp mẫu đã có điểm thi đua. Hãy xóa dữ liệu điểm trước, hoặc giữ lại lớp và chỉ sửa tên.`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const criteria = await tx.criterion.updateMany({
        where: { isSample: true, deletedAt: null },
        data: { deletedAt: now },
      });
      const sets = await tx.criteriaSet.updateMany({
        where: { isSample: true, deletedAt: null },
        data: { deletedAt: now },
      });
      const tasks = await tx.task.updateMany({
        where: { isSample: true, deletedAt: null },
        data: { deletedAt: now },
      });
      const classes = await tx.class.updateMany({
        where: { isSample: true, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.appSetting.upsert({
        where: { key: 'sample_deleted' },
        create: { key: 'sample_deleted', value: true },
        update: { value: true },
      });
      return {
        criteria: criteria.count,
        criteriaSets: sets.count,
        tasks: tasks.count,
        classes: classes.count,
      };
    });

    await writeAudit({
      action: 'sample_delete',
      entity: 'app_settings',
      summary: `Xóa dữ liệu mẫu: ${JSON.stringify(result)}`,
      userId,
      ipAddress: req.ip,
    });
    return ok(res, result);
  }),
);
