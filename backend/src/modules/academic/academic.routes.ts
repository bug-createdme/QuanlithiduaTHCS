import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { generateWeeks, toDbDate } from '../../lib/dates';
import { businessRule, conflict, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { compareVietnamese, normalizeText } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalText } from '../entities/entity.schemas';
import { createSnapshot } from '../backup/snapshot.service';

const idSchema = z.object({ id: z.string().uuid() });

export const academicRouter = Router();
academicRouter.use(requireAuth);

// ═══════════════════════════ TRƯỜNG ════════════════════════════════════════

academicRouter.get(
  '/school',
  asyncHandler(async (_req, res) => {
    const school = await prisma.school.findFirst({ where: { deletedAt: null } });
    if (!school) throw notFound('Thông tin trường');
    return ok(res, school);
  }),
);

academicRouter.patch(
  '/school',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        name: z.string().trim().min(1, 'Hãy nhập tên trường.').max(200),
        code: optionalText(50),
        address: optionalText(300),
        reporter: optionalText(120),
        reporterTitle: z.string().trim().max(120).default('Tổng phụ trách Đội'),
      }),
      req.body,
    );

    const existing = await prisma.school.findFirst({ where: { deletedAt: null } });
    if (!existing) throw notFound('Thông tin trường');

    const school = await prisma.school.update({
      where: { id: existing.id },
      // Sửa tên trường nghĩa là đã cấu hình xong — bỏ cờ dữ liệu mẫu.
      data: { ...body, isSample: false, revision: { increment: 1 } },
    });

    await writeAudit({
      action: 'update',
      entity: 'schools',
      entityId: school.id,
      summary: school.name,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, school);
  }),
);

// ═══════════════════════════ CƠ SỞ ═════════════════════════════════════════

/** 16 bảng tham chiếu campus_id — bản gốc kiểm tra đúng danh sách này. */
const CAMPUS_REFERENCES: Array<[keyof typeof prisma, string]> = [
  ['class', 'lớp'],
  ['plan', 'kế hoạch'],
  ['task', 'công việc'],
  ['calendarEvent', 'lịch hoạt động'],
  ['activity', 'hoạt động Đội'],
  ['criteriaSet', 'bộ tiêu chí'],
  ['weeklyScoreSheet', 'bảng thi đua'],
  ['scoreEntry', 'dòng điểm'],
  ['rankingSnapshot', 'bảng xếp hạng'],
  ['teamUnit', 'đơn vị Đội'],
  ['teamMember', 'thành viên Đội'],
  ['programResult', 'phong trào'],
  ['commendation', 'khen thưởng'],
  ['document', 'hồ sơ'],
  ['equipment', 'thiết bị'],
  ['generatedReport', 'báo cáo'],
];

academicRouter.get(
  '/campuses',
  asyncHandler(async (_req, res) => {
    const campuses = await prisma.campus.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
      include: { _count: { select: { classes: true } } },
    });
    return ok(res, campuses);
  }),
);

const campusSchema = z.object({
  name: z.string().trim().min(1, 'Hãy nhập tên cơ sở.').max(120),
  code: z
    .string()
    .trim()
    .min(1, 'Hãy nhập mã cơ sở.')
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ không dấu, số, gạch ngang hoặc gạch dưới.')
    .transform((v) => v.toUpperCase()),
});

async function assertCampusUnique(name: string, code: string, excludeId?: string): Promise<void> {
  const all = await prisma.campus.findMany({ where: { deletedAt: null } });
  const target = normalizeText(name);
  if (all.some((c) => c.id !== excludeId && normalizeText(c.name) === target)) {
    throw conflict('Tên cơ sở đã tồn tại.');
  }
  if (all.some((c) => c.id !== excludeId && c.code.toUpperCase() === code)) {
    throw conflict('Mã cơ sở đã tồn tại.');
  }
}

academicRouter.post(
  '/campuses',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(campusSchema, req.body);
    await assertCampusUnique(body.name, body.code);

    const school = await prisma.school.findFirst({ where: { deletedAt: null } });
    if (!school) throw notFound('Thông tin trường');

    const campus = await prisma.campus.create({ data: { ...body, schoolId: school.id } });
    await writeAudit({
      action: 'create',
      entity: 'campuses',
      entityId: campus.id,
      summary: `${campus.name} (${campus.code})`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, campus);
  }),
);

academicRouter.patch(
  '/campuses/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const body = parseOrThrow(campusSchema, req.body);
    const existing = await prisma.campus.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Cơ sở');

    await assertCampusUnique(body.name, body.code, id);

    const campus = await prisma.campus.update({
      where: { id },
      data: { ...body, revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'update',
      entity: 'campuses',
      entityId: id,
      summary: `${campus.name} (${campus.code})`,
      oldValue: `${existing.name} (${existing.code})`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, campus);
  }),
);

/** Kiểm tra trước khi xóa — trả về danh sách nơi cơ sở đang được dùng. */
academicRouter.get(
  '/campuses/:id/usage',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const usage: Array<{ label: string; count: number }> = [];

    for (const [model, label] of CAMPUS_REFERENCES) {
      const delegate = prisma[model] as unknown as { count(args: unknown): Promise<number> };
      const count = await delegate.count({ where: { campusId: id, deletedAt: null } });
      if (count > 0) usage.push({ label, count });
    }

    return ok(res, { usage, deletable: usage.length === 0 });
  }),
);

academicRouter.delete(
  '/campuses/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const campus = await prisma.campus.findFirst({ where: { id, deletedAt: null } });
    if (!campus) throw notFound('Cơ sở');

    const total = await prisma.campus.count({ where: { deletedAt: null } });
    if (total <= 1) throw businessRule('Phải giữ lại ít nhất một cơ sở.');

    const usage: string[] = [];
    for (const [model, label] of CAMPUS_REFERENCES) {
      const delegate = prisma[model] as unknown as { count(args: unknown): Promise<number> };
      const count = await delegate.count({ where: { campusId: id, deletedAt: null } });
      if (count > 0) usage.push(`${count} ${label}`);
    }
    if (usage.length) {
      throw conflict(
        `${campus.name} đang được dùng bởi ${usage.join(', ')}. Để bảo toàn dữ liệu lịch sử, hãy sửa tên hoặc mã cơ sở; chỉ xóa được cơ sở chưa phát sinh dữ liệu.`,
        { usage },
      );
    }

    await prisma.campus.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'delete',
      entity: 'campuses',
      entityId: id,
      summary: `${campus.name} (${campus.code})`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);

// ═══════════════════════════ NĂM HỌC ═══════════════════════════════════════

academicRouter.get(
  '/years',
  asyncHandler(async (_req, res) => {
    const years = await prisma.schoolYear.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { semesters: true, weeks: true, classes: true } } },
    });
    return ok(res, years);
  }),
);

const yearCreateSchema = z.object({
  name: z.string().trim().min(1, 'Hãy nhập tên năm học.').max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isCurrent: z.coerce.boolean().default(false),
  /** Sao chép có chọn lọc từ năm hiện tại — đúng hộp thoại của bản gốc. */
  copyFromYearId: z.string().uuid().optional(),
  copyClasses: z.coerce.boolean().default(true),
  copyCriteria: z.coerce.boolean().default(true),
  copyTemplates: z.coerce.boolean().default(true),
});

academicRouter.post(
  '/years',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(yearCreateSchema, req.body);
    if (body.endDate <= body.startDate) {
      throw businessRule('Ngày kết thúc phải sau ngày bắt đầu.');
    }

    const school = await prisma.school.findFirst({ where: { deletedAt: null } });
    if (!school) throw notFound('Thông tin trường');

    const userId = currentUserId(req);

    const year = await prisma.$transaction(
      async (tx) => {
        if (body.isCurrent) {
          await tx.schoolYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
        }

        const createdYear = await tx.schoolYear.create({
          data: {
            schoolId: school.id,
            name: body.name,
            startDate: toDbDate(body.startDate)!,
            endDate: toDbDate(body.endDate)!,
            isCurrent: body.isCurrent,
          },
        });

        // Hai học kỳ chia đôi năm học.
        const midpoint = new Date(`${body.startDate}T00:00:00.000Z`);
        const end = new Date(`${body.endDate}T00:00:00.000Z`);
        midpoint.setUTCDate(midpoint.getUTCDate() + Math.floor((end.getTime() - midpoint.getTime()) / 86_400_000 / 2));
        const midIso = midpoint.toISOString().slice(0, 10);

        const semester1 = await tx.semester.create({
          data: {
            schoolYearId: createdYear.id,
            name: 'Học kỳ I',
            startDate: toDbDate(body.startDate)!,
            endDate: toDbDate(midIso)!,
            sortOrder: 1,
          },
        });
        const semester2 = await tx.semester.create({
          data: {
            schoolYearId: createdYear.id,
            name: 'Học kỳ II',
            startDate: toDbDate(midIso)!,
            endDate: toDbDate(body.endDate)!,
            sortOrder: 2,
          },
        });

        // 40 tuần, mỗi tuần 7 ngày.
        await tx.schoolWeek.createMany({
          data: generateWeeks(body.startDate, 40).map((w) => ({
            schoolYearId: createdYear.id,
            semesterId: w.startDate <= midIso ? semester1.id : semester2.id,
            number: w.number,
            name: w.name,
            startDate: toDbDate(w.startDate)!,
            endDate: toDbDate(w.endDate)!,
          })),
        });

        if (body.copyFromYearId) {
          // Lớp và GVCN — tạo ID mới, không mang theo điểm.
          if (body.copyClasses) {
            const sourceClasses = await tx.class.findMany({
              where: { schoolYearId: body.copyFromYearId, deletedAt: null },
            });
            if (sourceClasses.length) {
              await tx.class.createMany({
                data: sourceClasses.map((c) => ({
                  schoolYearId: createdYear.id,
                  campusId: c.campusId,
                  code: c.code,
                  className: c.className,
                  grade: c.grade,
                  teacher: c.teacher,
                  active: true,
                })),
              });
            }
          }

          // Bộ tiêu chí — chuyển về dự thảo.
          if (body.copyCriteria) {
            const sourceSets = await tx.criteriaSet.findMany({
              where: { schoolYearId: body.copyFromYearId, deletedAt: null },
              include: { criteria: { where: { deletedAt: null } } },
            });
            for (const set of sourceSets) {
              const newSet = await tx.criteriaSet.create({
                data: {
                  schoolYearId: createdYear.id,
                  campusId: set.campusId,
                  name: set.name,
                  version: set.version,
                  formula: set.formula,
                  baseScore: set.baseScore,
                  status: 'DRAFT',
                  basis: set.basis,
                  sourceSetId: set.id,
                },
              });
              if (set.criteria.length) {
                await tx.criterion.createMany({
                  data: set.criteria.map((c) => ({
                    criteriaSetId: newSet.id,
                    code: c.code,
                    groupName: c.groupName,
                    name: c.name,
                    description: c.description,
                    dataType: c.dataType,
                    points: c.points,
                    minValue: c.minValue,
                    maxValue: c.maxValue,
                    decimals: c.decimals,
                    weight: c.weight,
                    sortOrder: c.sortOrder,
                    color: c.color,
                    evidenceRequired: c.evidenceRequired,
                    active: c.active,
                    sourceCriteriaId: c.id,
                  })),
                });
              }
            }
          }
        }

        await tx.yearTransitionLog.create({
          data: {
            fromYearId: body.copyFromYearId ?? null,
            toYearId: createdYear.id,
            action: 'CREATE',
            detail: {
              copyClasses: body.copyClasses,
              copyCriteria: body.copyCriteria,
              copyTemplates: body.copyTemplates,
            } as unknown as Prisma.InputJsonValue,
            userId,
          },
        });

        return createdYear;
      },
      { timeout: 180_000, maxWait: 30_000 },
    );

    await writeAudit({
      action: 'year_create',
      entity: 'school_years',
      entityId: year.id,
      summary: `Tạo năm học ${year.name} và 40 tuần`,
      userId,
      ipAddress: req.ip,
    });
    return created(res, year);
  }),
);

/** Đặt năm hiện hành — chỉ một năm được đánh dấu. */
academicRouter.post(
  '/years/:id/set-current',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const year = await prisma.schoolYear.findFirst({ where: { id, deletedAt: null } });
    if (!year) throw notFound('Năm học');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.schoolYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      return tx.schoolYear.update({
        where: { id },
        data: { isCurrent: true, revision: { increment: 1 } },
      });
    });
    return ok(res, updated);
  }),
);

/** Tiền kiểm tra trước khi đóng năm. */
academicRouter.get(
  '/years/:id/close-check',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const [openSheets, openTasks, draftReports] = await Promise.all([
      prisma.weeklyScoreSheet.count({
        where: { schoolYearId: id, deletedAt: null, status: { notIn: ['LOCKED'] } },
      }),
      prisma.task.count({ where: { schoolYearId: id, deletedAt: null, status: { not: 'DONE' } } }),
      prisma.generatedReport.count({ where: { schoolYearId: id, deletedAt: null, status: 'DRAFT' } }),
    ]);

    const warnings: string[] = [];
    if (openSheets) warnings.push(`${openSheets} bảng thi đua chưa khóa`);
    if (openTasks) warnings.push(`${openTasks} công việc chưa hoàn thành`);
    if (draftReports) warnings.push(`${draftReports} báo cáo còn ở dạng nháp`);

    return ok(res, { warnings, openSheets, openTasks, draftReports });
  }),
);

academicRouter.post(
  '/years/:id/close',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { reason } = parseOrThrow(
      z.object({ reason: z.string().trim().max(500).optional() }),
      req.body ?? {},
    );
    const userId = currentUserId(req);

    const year = await prisma.schoolYear.findFirst({ where: { id, deletedAt: null } });
    if (!year) throw notFound('Năm học');
    if (year.status === 'ARCHIVED') throw conflict('Năm học đã được đóng trước đó.');

    const updated = await prisma.$transaction(
      async (tx) => {
        await createSnapshot(
          {
            name: `Trước khi đóng năm học ${year.name}`,
            tier: 'PROTECTED',
            protectedSnapshot: true,
            reason: 'before-year-close',
            schoolYearId: id,
            userId,
          },
          tx,
        );

        await tx.yearTransitionLog.create({
          data: { fromYearId: id, action: 'CLOSE', reason: reason ?? null, userId },
        });

        return tx.schoolYear.update({
          where: { id },
          data: { status: 'ARCHIVED', readOnly: true, closedAt: new Date(), revision: { increment: 1 } },
        });
      },
      { timeout: 180_000, maxWait: 30_000 },
    );

    await writeAudit({
      action: 'year_close',
      entity: 'school_years',
      entityId: id,
      summary: `Đóng năm học ${year.name}`,
      reason: reason ?? null,
      userId,
      ipAddress: req.ip,
    });
    return ok(res, updated);
  }),
);

// ═══════════════════════ HỌC KỲ & TUẦN ═════════════════════════════════════

academicRouter.get(
  '/semesters',
  asyncHandler(async (req, res) => {
    const { schoolYearId } = parseOrThrow(z.object({ schoolYearId: z.string().uuid() }), req.query);
    return ok(
      res,
      await prisma.semester.findMany({
        where: { schoolYearId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }),
);

academicRouter.get(
  '/weeks',
  asyncHandler(async (req, res) => {
    const { schoolYearId, semesterId } = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        semesterId: z.union([z.string().uuid(), z.literal('all')]).optional(),
      }),
      req.query,
    );
    return ok(
      res,
      await prisma.schoolWeek.findMany({
        where: {
          schoolYearId,
          deletedAt: null,
          ...(semesterId && semesterId !== 'all' ? { semesterId } : {}),
        },
        orderBy: { number: 'asc' },
      }),
    );
  }),
);

// ═══════════════════════════ LỚP ═══════════════════════════════════════════

academicRouter.get(
  '/classes',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        campusId: z.union([z.string().uuid(), z.literal('all')]).optional(),
        includeInactive: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      }),
      req.query,
    );

    const classes = await prisma.class.findMany({
      where: {
        schoolYearId: query.schoolYearId,
        deletedAt: null,
        ...(query.campusId && query.campusId !== 'all' ? { campusId: query.campusId } : {}),
        ...(query.includeInactive ? {} : { active: true }),
      },
      include: { campus: { select: { id: true, name: true, code: true } } },
    });

    // Sắp xếp tự nhiên theo tiếng Việt: 6/A2 đứng trước 6/A10.
    return ok(res, classes.sort((a, b) => compareVietnamese(a.className, b.className)));
  }),
);

const classSchema = z.object({
  schoolYearId: z.string().uuid(),
  campusId: z.string().uuid('Hãy chọn cơ sở.'),
  code: optionalText(30),
  className: z.string().trim().min(1, 'Hãy nhập tên lớp/chi đội.').max(50),
  grade: z.coerce.number().int().min(1).max(9),
  teacher: optionalText(120),
  active: z.coerce.boolean().default(true),
});

async function assertClassNameUnique(
  schoolYearId: string,
  className: string,
  excludeId?: string,
): Promise<void> {
  const duplicate = await prisma.class.findFirst({
    where: {
      schoolYearId,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      className: { equals: className, mode: 'insensitive' },
    },
  });
  if (duplicate) throw conflict('Tên lớp đã tồn tại trong năm học.');
}

academicRouter.post(
  '/classes',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(classSchema, req.body);
    await assertClassNameUnique(body.schoolYearId, body.className);
    const row = await prisma.class.create({ data: body });
    await writeAudit({
      action: 'create',
      entity: 'classes',
      entityId: row.id,
      summary: row.className,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, row);
  }),
);

academicRouter.patch(
  '/classes/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const body = parseOrThrow(classSchema.partial(), req.body);
    const existing = await prisma.class.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Lớp');

    if (body.className) {
      await assertClassNameUnique(body.schoolYearId ?? existing.schoolYearId, body.className, id);
    }

    const row = await prisma.class.update({
      where: { id },
      data: { ...body, revision: { increment: 1 } },
    });
    return ok(res, row);
  }),
);

academicRouter.delete(
  '/classes/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.class.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Lớp');

    const entries = await prisma.scoreEntry.count({ where: { classId: id, deletedAt: null } });
    if (entries > 0) {
      throw conflict(
        `Lớp đã có ${entries} dòng điểm thi đua. Hãy chuyển sang "Ngừng hoạt động" thay vì xóa để giữ dữ liệu lịch sử.`,
      );
    }

    await prisma.class.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    return noContent(res);
  }),
);

/** Nhập lớp hàng loạt — all-or-nothing, đúng tinh thần bản gốc. */
academicRouter.post(
  '/classes/import',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        rows: z
          .array(
            z.object({
              code: z.string().trim().max(30).optional(),
              className: z.string().trim().min(1).max(50),
              grade: z.coerce.number().int().min(1).max(9),
              campusCode: z.string().trim().min(1).max(30),
              teacher: z.string().trim().max(120).optional(),
            }),
          )
          .min(1, 'Không có dòng dữ liệu nào.')
          .max(2000),
        /** true = chỉ kiểm tra, không ghi. */
        dryRun: z.coerce.boolean().default(false),
      }),
      req.body,
    );

    const campuses = await prisma.campus.findMany({ where: { deletedAt: null } });
    const campusByCode = new Map(campuses.map((c) => [c.code.toUpperCase(), c]));
    const existing = await prisma.class.findMany({
      where: { schoolYearId: body.schoolYearId, deletedAt: null },
      select: { className: true },
    });
    const existingNames = new Set(existing.map((c) => c.className.toLowerCase()));

    const errors: Array<{ row: number; message: string }> = [];
    const seen = new Set<string>();

    body.rows.forEach((row, index) => {
      const line = index + 1;
      if (!campusByCode.has(row.campusCode.toUpperCase())) {
        errors.push({ row: line, message: `Mã cơ sở "${row.campusCode}" không tồn tại.` });
      }
      const key = row.className.toLowerCase();
      if (existingNames.has(key)) {
        errors.push({ row: line, message: `Lớp "${row.className}" đã tồn tại trong năm học.` });
      }
      if (seen.has(key)) {
        errors.push({ row: line, message: `Lớp "${row.className}" bị trùng trong tệp nhập.` });
      }
      seen.add(key);
    });

    if (errors.length) {
      return ok(res, { imported: 0, errors, valid: body.rows.length - errors.length });
    }
    if (body.dryRun) {
      return ok(res, { imported: 0, errors: [], valid: body.rows.length, preview: body.rows });
    }

    const result = await prisma.class.createMany({
      data: body.rows.map((row) => ({
        schoolYearId: body.schoolYearId,
        campusId: campusByCode.get(row.campusCode.toUpperCase())!.id,
        code: row.code ?? null,
        className: row.className,
        grade: row.grade,
        teacher: row.teacher ?? null,
        active: true,
      })),
    });

    await writeAudit({
      action: 'class_import',
      entity: 'classes',
      summary: `Nhập ${result.count} lớp`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, { imported: result.count, errors: [] });
  }),
);
