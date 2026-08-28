import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { toDbDate } from '../../lib/dates';
import { businessRule, conflict, immutable, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { nextVersion } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalDate, optionalLongText, optionalText, optionalUuid } from '../entities/entity.schemas';

const idSchema = z.object({ id: z.string().uuid() });

const setCreateSchema = z.object({
  schoolYearId: z.string().uuid('Hãy chọn năm học.'),
  semesterId: optionalUuid(),
  campusId: optionalUuid(),
  name: z.string().trim().min(1, 'Hãy nhập tên bộ tiêu chí.').max(200),
  version: z.string().trim().max(20).default('1.0'),
  formula: z.enum(['BASE', 'SUM', 'WEIGHTED']).default('BASE'),
  baseScore: z.coerce.number().default(100),
  status: z.enum(['DRAFT', 'ACTIVE', 'STOPPED']).default('DRAFT'),
  effectiveFrom: optionalDate(),
  effectiveTo: optionalDate(),
  basis: optionalLongText(),
});

const setUpdateSchema = setCreateSchema.partial();

const criterionSchema = z.object({
  code: z.string().trim().min(1, 'Hãy nhập mã tiêu chí.').max(20),
  groupName: optionalText(80),
  name: z.string().trim().min(1, 'Hãy nhập tên hiển thị.').max(200),
  description: optionalLongText(),
  dataType: z.enum(['SCORE', 'COUNT', 'BOOLEAN', 'CHOICE', 'NOTE']).default('SCORE'),
  points: z.coerce.number().default(0),
  minValue: z.coerce.number().nullish(),
  maxValue: z.coerce.number().nullish(),
  decimals: z.coerce.number().int().min(0).max(3).default(0),
  weight: z.coerce.number().min(0).default(1),
  sortOrder: z.coerce.number().int().default(99),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải ở dạng #RRGGBB').default('#0b6bcb'),
  evidenceRequired: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
});

/** Bộ đã phát sinh bảng điểm thì khóa cấu trúc — chỉ được nhân bản phiên bản mới. */
async function isSetLocked(criteriaSetId: string): Promise<boolean> {
  const count = await prisma.weeklyScoreSheet.count({ where: { criteriaSetId, deletedAt: null } });
  return count > 0;
}

export const criteriaRouter = Router();
criteriaRouter.use(requireAuth);

// ── Danh sách bộ tiêu chí ──────────────────────────────────────────────────
criteriaRouter.get(
  '/sets',
  asyncHandler(async (req, res) => {
    const { schoolYearId } = parseOrThrow(z.object({ schoolYearId: z.string().uuid() }), req.query);
    const sets = await prisma.criteriaSet.findMany({
      where: { schoolYearId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { criteria: true, scoreSheets: true } } },
    });
    return ok(
      res,
      sets.map((set) => ({ ...set, locked: set._count.scoreSheets > 0 })),
    );
  }),
);

// ── Chi tiết bộ + tiêu chí ─────────────────────────────────────────────────
criteriaRouter.get(
  '/sets/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const set = await prisma.criteriaSet.findFirst({
      where: { id, deletedAt: null },
      include: { criteria: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!set) throw notFound('Bộ tiêu chí');
    return ok(res, { ...set, locked: await isSetLocked(id) });
  }),
);

// ── Tạo bộ mới ─────────────────────────────────────────────────────────────
criteriaRouter.post(
  '/sets',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(setCreateSchema, req.body);
    if (body.effectiveFrom && body.effectiveTo && body.effectiveTo < body.effectiveFrom) {
      throw businessRule('Ngày hết hiệu lực phải sau ngày bắt đầu.');
    }

    const set = await prisma.criteriaSet.create({
      data: {
        ...body,
        baseScore: new Prisma.Decimal(body.baseScore),
        effectiveFrom: toDbDate(body.effectiveFrom),
        effectiveTo: toDbDate(body.effectiveTo),
      },
    });

    await writeAudit({
      action: 'create',
      entity: 'criteria_sets',
      entityId: set.id,
      summary: `${set.name} v${set.version}`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, set);
  }),
);

// ── Cập nhật bộ — khóa cấu trúc khi đã phát sinh điểm ──────────────────────
criteriaRouter.patch(
  '/sets/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.criteriaSet.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Bộ tiêu chí');

    const body = parseOrThrow(setUpdateSchema, req.body);
    const locked = await isSetLocked(id);

    if (locked) {
      const frozen = ['name', 'version', 'formula', 'baseScore'] as const;
      const attempted = frozen.filter(
        (field) => body[field] !== undefined && String(body[field]) !== String(existing[field]),
      );
      if (attempted.length) {
        throw immutable(
          'Bộ tiêu chí đã phát sinh điểm nên bị khóa cấu trúc. Hãy nhân bản thành phiên bản mới để thay đổi.',
        );
      }
    }

    const effectiveFrom = body.effectiveFrom ?? existing.effectiveFrom?.toISOString().slice(0, 10) ?? null;
    const effectiveTo = body.effectiveTo ?? existing.effectiveTo?.toISOString().slice(0, 10) ?? null;
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw businessRule('Ngày hết hiệu lực phải sau ngày bắt đầu.');
    }

    const set = await prisma.criteriaSet.update({
      where: { id },
      data: {
        ...body,
        ...(body.baseScore !== undefined ? { baseScore: new Prisma.Decimal(body.baseScore) } : {}),
        ...(body.effectiveFrom !== undefined ? { effectiveFrom: toDbDate(body.effectiveFrom) } : {}),
        ...(body.effectiveTo !== undefined ? { effectiveTo: toDbDate(body.effectiveTo) } : {}),
        lockedVersion: locked,
        revision: { increment: 1 },
      },
    });

    await writeAudit({
      action: 'update',
      entity: 'criteria_sets',
      entityId: id,
      summary: `${set.name} v${set.version}`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, set);
  }),
);

// ── Nhân bản thành phiên bản mới ───────────────────────────────────────────
criteriaRouter.post(
  '/sets/:id/clone',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const source = await prisma.criteriaSet.findFirst({
      where: { id, deletedAt: null },
      include: { criteria: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!source) throw notFound('Bộ tiêu chí');

    const clone = await prisma.$transaction(async (tx) => {
      const row = await tx.criteriaSet.create({
        data: {
          schoolYearId: source.schoolYearId,
          semesterId: source.semesterId,
          campusId: source.campusId,
          name: `${source.name} – Phiên bản mới`,
          version: nextVersion(source.version),
          formula: source.formula,
          baseScore: source.baseScore,
          // Phiên bản mới luôn bắt đầu ở trạng thái dự thảo.
          status: 'DRAFT',
          effectiveFrom: source.effectiveFrom,
          effectiveTo: source.effectiveTo,
          basis: source.basis,
          lockedVersion: false,
          sourceSetId: source.id,
        },
      });

      if (source.criteria.length) {
        await tx.criterion.createMany({
          data: source.criteria.map((c) => ({
            criteriaSetId: row.id,
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
      return row;
    });

    await writeAudit({
      action: 'criteria_set_clone',
      entity: 'criteria_sets',
      entityId: clone.id,
      summary: `Nhân bản từ ${source.name} v${source.version} → v${clone.version}`,
      reason: 'Dữ liệu tuần cũ không thay đổi',
      userId: currentUserId(req),
      ipAddress: req.ip,
    });

    return created(res, clone);
  }),
);

// ── Thêm tiêu chí ──────────────────────────────────────────────────────────
criteriaRouter.post(
  '/sets/:id/criteria',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const set = await prisma.criteriaSet.findFirst({ where: { id, deletedAt: null } });
    if (!set) throw notFound('Bộ tiêu chí');
    if (await isSetLocked(id)) {
      throw immutable('Bộ tiêu chí đã phát sinh điểm. Hãy nhân bản phiên bản mới trước khi thêm tiêu chí.');
    }

    const body = parseOrThrow(criterionSchema, req.body);
    if (body.minValue != null && body.maxValue != null && body.minValue > body.maxValue) {
      throw businessRule('Giới hạn tối thiểu/tối đa không hợp lệ.');
    }

    const duplicate = await prisma.criterion.findFirst({
      where: { criteriaSetId: id, deletedAt: null, code: { equals: body.code, mode: 'insensitive' } },
    });
    if (duplicate) throw conflict('Mã tiêu chí đã tồn tại trong bộ.');

    const criterion = await prisma.criterion.create({
      data: {
        criteriaSetId: id,
        ...body,
        points: new Prisma.Decimal(body.points),
        minValue: body.minValue == null ? null : new Prisma.Decimal(body.minValue),
        maxValue: body.maxValue == null ? null : new Prisma.Decimal(body.maxValue),
        weight: new Prisma.Decimal(body.weight),
      },
    });
    return created(res, criterion);
  }),
);

// ── Sửa tiêu chí ───────────────────────────────────────────────────────────
criteriaRouter.patch(
  '/criteria/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.criterion.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Tiêu chí');

    const body = parseOrThrow(criterionSchema.partial(), req.body);

    // Bật/tắt sử dụng vẫn cho phép ngay cả khi bộ đã khóa (giống bản gốc).
    const onlyToggling = Object.keys(body).length === 1 && body.active !== undefined;
    if (!onlyToggling && (await isSetLocked(existing.criteriaSetId))) {
      throw immutable('Bộ tiêu chí đã phát sinh điểm. Chỉ có thể bật/tắt sử dụng tiêu chí.');
    }

    const min = body.minValue ?? (existing.minValue === null ? null : Number(existing.minValue));
    const max = body.maxValue ?? (existing.maxValue === null ? null : Number(existing.maxValue));
    if (min != null && max != null && min > max) {
      throw businessRule('Giới hạn tối thiểu/tối đa không hợp lệ.');
    }

    if (body.code) {
      const duplicate = await prisma.criterion.findFirst({
        where: {
          criteriaSetId: existing.criteriaSetId,
          deletedAt: null,
          id: { not: id },
          code: { equals: body.code, mode: 'insensitive' },
        },
      });
      if (duplicate) throw conflict('Mã tiêu chí đã tồn tại trong bộ.');
    }

    const criterion = await prisma.criterion.update({
      where: { id },
      data: {
        ...body,
        ...(body.points !== undefined ? { points: new Prisma.Decimal(body.points) } : {}),
        ...(body.minValue !== undefined
          ? { minValue: body.minValue == null ? null : new Prisma.Decimal(body.minValue) }
          : {}),
        ...(body.maxValue !== undefined
          ? { maxValue: body.maxValue == null ? null : new Prisma.Decimal(body.maxValue) }
          : {}),
        ...(body.weight !== undefined ? { weight: new Prisma.Decimal(body.weight) } : {}),
        revision: { increment: 1 },
      },
    });
    return ok(res, criterion);
  }),
);

// ── Xóa mềm tiêu chí ───────────────────────────────────────────────────────
criteriaRouter.delete(
  '/criteria/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.criterion.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Tiêu chí');

    const used = await prisma.scoreEntry.count({ where: { criteriaId: id, deletedAt: null } });
    if (used > 0) {
      throw conflict(
        `Tiêu chí đã có ${used} ô điểm. Hãy chuyển sang "Ngừng sử dụng" thay vì xóa để giữ dữ liệu lịch sử.`,
      );
    }

    await prisma.criterion.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    return noContent(res);
  }),
);

// ── Xuất bộ tiêu chí sang JSON ─────────────────────────────────────────────
criteriaRouter.get(
  '/sets/:id/export',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const set = await prisma.criteriaSet.findFirst({
      where: { id, deletedAt: null },
      include: { criteria: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!set) throw notFound('Bộ tiêu chí');

    const filename = `bo-tieu-chi-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Giữ nguyên định dạng TPT-CRITERIA-1 của bản gốc để tương thích hai chiều.
    return res.send(
      JSON.stringify({ format: 'TPT-CRITERIA-1', set, criteria: set.criteria }, null, 2),
    );
  }),
);
