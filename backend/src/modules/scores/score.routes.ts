import { Prisma, type SheetStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { businessRule, conflict, notFound } from '../../lib/errors';
import { asyncHandler, created, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { createSnapshot } from '../backup/snapshot.service';
import {
  WORKFLOW_LABEL,
  assertSheetWritable,
  buildScoreContext,
  detectAnomalies,
  nextStatus,
  parseCell,
  rankClasses,
} from './score.service';

/**
 * Tham số phạm vi dùng chung toàn hệ thống là `yearId` (xem lib/scope.ts).
 * Ở đây đổi tên sang `schoolYearId` để khớp cột trong cơ sở dữ liệu,
 * đồng thời vẫn chấp nhận `schoolYearId` nếu người gọi dùng tên cột trực tiếp.
 */
const contextBaseSchema = z.object({
  yearId: z.string().uuid().optional(),
  schoolYearId: z.string().uuid().optional(),
  semesterId: z.union([z.string().uuid(), z.literal('all')]).optional(),
  campusId: z.union([z.string().uuid(), z.literal('all')]).optional(),
  weekId: z.string().uuid('Hãy chọn tuần.'),
  criteriaSetId: z.string().uuid().optional(),
});

/** Áp quy tắc "phải có năm học" và quy về tên cột `schoolYearId`. */
const withYear = <T extends z.ZodRawShape>(shape: z.ZodObject<T>) =>
  shape
    .refine((value) => Boolean(value.yearId ?? value.schoolYearId), {
      message: 'Hãy chọn năm học.',
      path: ['yearId'],
    })
    .transform(({ yearId, schoolYearId, ...rest }) => ({
      ...rest,
      schoolYearId: (schoolYearId ?? yearId) as string,
    }));

const contextQuerySchema = withYear(contextBaseSchema);

const normalizeScope = (value?: string | null): string | null =>
  !value || value === 'all' ? null : value;

export const scoresRouter = Router();
scoresRouter.use(requireAuth);

// ── Ngữ cảnh chấm điểm: bộ tiêu chí + lớp + bảng + ô đã nhập ───────────────
scoresRouter.get(
  '/context',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(contextQuerySchema, req.query);
    const context = await buildScoreContext(query);

    return ok(res, {
      ...context,
      workflowLabel: context.sheet ? WORKFLOW_LABEL[context.sheet.status] : 'Khởi tạo bảng tuần',
      expectedCells: context.classes.length * context.criteria.length,
    });
  }),
);

// ── Xếp hạng ───────────────────────────────────────────────────────────────
scoresRouter.get(
  '/ranking',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(
      withYear(
        contextBaseSchema.extend({
          official: z
            .union([z.literal('true'), z.literal('false')])
            .optional()
            .transform((v) => v === 'true'),
        }),
      ),
      req.query,
    );
    const context = await buildScoreContext(query);
    const isOfficial = context.sheet
      ? context.sheet.status === 'APPROVED' || context.sheet.status === 'LOCKED'
      : false;

    // official=true chỉ trả kết quả khi bảng đã duyệt hoặc đã khóa.
    if (query.official && !isOfficial) return ok(res, { official: false, rows: [] });

    const rows = rankClasses(context.classes, context.criteria, context.entries, context.set);
    return ok(res, { official: isOfficial, rows });
  }),
);

// ── Kiểm tra bất thường ────────────────────────────────────────────────────
scoresRouter.get(
  '/anomalies',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(contextQuerySchema, req.query);
    const context = await buildScoreContext(query);

    const evidence = context.entries.length
      ? await prisma.scoreEvidence.findMany({
          where: { scoreEntryId: { in: context.entries.map((e) => e.id) }, deletedAt: null },
          select: { scoreEntryId: true },
        })
      : [];

    return ok(res, detectAnomalies(context, new Set(evidence.map((e) => e.scoreEntryId))));
  }),
);

// ── Nhật ký điều chỉnh ─────────────────────────────────────────────────────
scoresRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const { limit } = parseOrThrow(
      z.object({ limit: z.coerce.number().int().min(1).max(500).default(200) }),
      req.query,
    );
    const logs = await prisma.auditLog.findMany({
      where: { entity: { in: ['score_entries', 'weekly_score_sheets'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { fullName: true, username: true } } },
    });
    return ok(res, logs);
  }),
);

// ── Khởi tạo bảng tuần ─────────────────────────────────────────────────────
scoresRouter.post(
  '/sheets',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(contextQuerySchema, req.body);
    const context = await buildScoreContext(body);

    if (!context.set) {
      throw businessRule('Chưa có bộ tiêu chí hoạt động. Hãy tạo bộ tiêu chí trước khi khởi tạo bảng tuần.');
    }
    if (context.sheet) throw conflict('Bảng tuần cho bộ tiêu chí này đã tồn tại.');

    const sheet = await prisma.weeklyScoreSheet.create({
      data: {
        schoolYearId: body.schoolYearId,
        semesterId: normalizeScope(body.semesterId),
        campusId: normalizeScope(body.campusId),
        weekId: body.weekId,
        criteriaSetId: context.set.id,
        status: 'DRAFT',
      },
    });

    await writeAudit({
      action: 'sheet_create',
      entity: 'weekly_score_sheets',
      entityId: sheet.id,
      summary: 'Khởi tạo bảng tuần',
      reason: 'Quy trình thi đua',
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, sheet);
  }),
);

// ── Chuyển trạng thái theo quy trình ───────────────────────────────────────
scoresRouter.post(
  '/sheets/:id/advance',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const userId = currentUserId(req);

    const sheet = await prisma.weeklyScoreSheet.findFirst({ where: { id, deletedAt: null } });
    if (!sheet) throw notFound('Bảng thi đua tuần');

    // LOCKED → UNLOCKED đi qua điểm cuối /unlock riêng vì bắt buộc có lý do.
    if (sheet.status === 'LOCKED') {
      throw businessRule('Bảng đã khóa. Hãy dùng chức năng mở khóa và ghi rõ lý do.');
    }

    const target: SheetStatus = nextStatus(sheet.status);
    const context = await buildScoreContext({
      schoolYearId: sheet.schoolYearId,
      semesterId: sheet.semesterId,
      campusId: sheet.campusId,
      weekId: sheet.weekId,
      criteriaSetId: sheet.criteriaSetId,
    });

    // DRAFT → COMPLETE yêu cầu đã nhập đủ mọi ô (kể cả KAD/MIỄN).
    if (sheet.status === 'DRAFT') {
      const expected = context.classes.length * context.criteria.length;
      if (context.entries.length < expected) {
        throw businessRule(
          `Còn ${expected - context.entries.length} ô chưa nhập/KAD/MIỄN. Chưa thể đánh dấu đủ.`,
          { expected, actual: context.entries.length },
        );
      }
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        // APPROVED → LOCKED: snapshot bảo vệ, đóng băng tiêu chí, chốt xếp hạng.
        if (target === 'LOCKED') {
          await createSnapshot(
            {
              name: `Trước khóa bảng thi đua tuần`,
              tier: 'PROTECTED',
              protectedSnapshot: true,
              reason: 'before-score-lock',
              schoolYearId: sheet.schoolYearId,
              userId,
            },
            tx,
          );

          const rows = rankClasses(context.classes, context.criteria, context.entries, context.set);

          await tx.rankingSnapshot.create({
            data: {
              schoolYearId: sheet.schoolYearId,
              semesterId: sheet.semesterId,
              campusId: sheet.campusId,
              weekId: sheet.weekId,
              sheetId: sheet.id,
              criteriaSetId: sheet.criteriaSetId,
              criteriaVersion: context.set?.version ?? null,
              rows: rows as unknown as Prisma.InputJsonValue,
            },
          });

          return tx.weeklyScoreSheet.update({
            where: { id },
            data: {
              status: 'LOCKED',
              lockedAt: new Date(),
              lockedById: userId,
              criteriaSnapshot: {
                set: context.set,
                criteria: context.criteria,
              } as unknown as Prisma.InputJsonValue,
              revision: { increment: 1 },
            },
          });
        }

        return tx.weeklyScoreSheet.update({
          where: { id },
          data: {
            status: target,
            ...(target === 'APPROVED' ? { approvedAt: new Date(), approvedById: userId } : {}),
            revision: { increment: 1 },
          },
        });
      },
      { timeout: 120_000, maxWait: 20_000 },
    );

    await writeAudit({
      action: 'sheet_status',
      entity: 'weekly_score_sheets',
      entityId: id,
      summary: `Chuyển trạng thái: ${target}`,
      oldValue: sheet.status,
      newValue: target,
      reason: 'Quy trình thi đua',
      userId,
      ipAddress: req.ip,
    });

    return ok(res, { ...updated, workflowLabel: WORKFLOW_LABEL[updated.status] });
  }),
);

// ── Mở khóa có lý do ───────────────────────────────────────────────────────
scoresRouter.post(
  '/sheets/:id/unlock',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const { reason } = parseOrThrow(
      z.object({
        reason: z.string().trim().min(5, 'Hãy nhập lý do cụ thể, tối thiểu 5 ký tự.').max(500),
      }),
      req.body,
    );
    const userId = currentUserId(req);

    const sheet = await prisma.weeklyScoreSheet.findFirst({ where: { id, deletedAt: null } });
    if (!sheet) throw notFound('Bảng thi đua tuần');
    if (sheet.status !== 'LOCKED') throw businessRule('Chỉ bảng đang khóa mới cần mở khóa.');

    const updated = await prisma.$transaction(
      async (tx) => {
        await createSnapshot(
          {
            name: 'Trước mở khóa bảng thi đua',
            tier: 'PROTECTED',
            protectedSnapshot: true,
            reason: 'before-score-unlock',
            schoolYearId: sheet.schoolYearId,
            userId,
          },
          tx,
        );
        return tx.weeklyScoreSheet.update({
          where: { id },
          data: {
            status: 'UNLOCKED',
            unlockReason: reason,
            unlockedAt: new Date(),
            // Báo cáo đã sinh từ bảng này nay không còn phản ánh số liệu mới.
            reportsStale: true,
            revision: { increment: 1 },
          },
        });
      },
      { timeout: 120_000, maxWait: 20_000 },
    );

    await writeAudit({
      action: 'sheet_unlock',
      entity: 'weekly_score_sheets',
      entityId: id,
      summary: 'Mở khóa bảng thi đua',
      oldValue: 'LOCKED',
      newValue: 'UNLOCKED',
      reason,
      userId,
      ipAddress: req.ip,
    });

    return ok(res, { ...updated, workflowLabel: WORKFLOW_LABEL[updated.status] });
  }),
);

// ── Lưu một ô điểm ─────────────────────────────────────────────────────────
scoresRouter.put(
  '/entries',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        sheetId: z.string().uuid(),
        classId: z.string().uuid(),
        criteriaId: z.string().uuid(),
        /** Giá trị thô người dùng gõ: số, KAD, MIỄN, ĐẠT… hoặc rỗng để xóa. */
        raw: z.union([z.string(), z.number(), z.null()]),
      }),
      req.body,
    );
    const userId = currentUserId(req);

    const sheet = await assertSheetWritable(body.sheetId);
    const criterion = await prisma.criterion.findFirst({
      where: { id: body.criteriaId, deletedAt: null },
    });
    if (!criterion) throw notFound('Tiêu chí');

    const existing = await prisma.scoreEntry.findFirst({
      where: {
        sheetId: body.sheetId,
        classId: body.classId,
        criteriaId: body.criteriaId,
        deletedAt: null,
      },
    });

    const parsed = parseCell(body.raw, criterion, { strict: true })!;

    // Ô rỗng nghĩa là xóa bản ghi — đúng hành vi bản gốc.
    if (parsed.clear) {
      if (!existing) return ok(res, { cleared: true, entry: null });
      await prisma.scoreEntry.delete({ where: { id: existing.id } });
      await writeAudit({
        action: 'score_clear',
        entity: 'score_entries',
        entityId: existing.id,
        summary: `Xóa giá trị ${existing.value ?? existing.entryState}`,
        oldValue: existing.value ?? existing.entryState,
        newValue: null,
        reason: 'Người dùng xóa ô',
        userId,
        ipAddress: req.ip,
      });
      return ok(res, { cleared: true, entry: null, undo: { type: 'restore', row: existing } });
    }

    const cls = await prisma.class.findFirst({ where: { id: body.classId, deletedAt: null } });
    if (!cls) throw notFound('Lớp');

    const entry = await prisma.scoreEntry.upsert({
      where: {
        sheetId_classId_criteriaId: {
          sheetId: body.sheetId,
          classId: body.classId,
          criteriaId: body.criteriaId,
        },
      },
      create: {
        sheetId: body.sheetId,
        schoolYearId: sheet.schoolYearId,
        semesterId: sheet.semesterId,
        campusId: cls.campusId,
        weekId: sheet.weekId,
        classId: body.classId,
        criteriaId: body.criteriaId,
        entryState: parsed.entryState,
        value: parsed.value === null ? null : new Prisma.Decimal(parsed.value),
      },
      update: {
        entryState: parsed.entryState,
        value: parsed.value === null ? null : new Prisma.Decimal(parsed.value),
        deletedAt: null,
        revision: { increment: 1 },
      },
    });

    await writeAudit({
      action: existing ? 'score_update' : 'score_create',
      entity: 'score_entries',
      entityId: entry.id,
      summary: `${cls.className} | ${criterion.code}`,
      oldValue: existing?.value ?? existing?.entryState ?? null,
      newValue: parsed.value ?? parsed.entryState,
      reason: 'Nhập trực tiếp bảng tuần',
      userId,
      ipAddress: req.ip,
    });

    return ok(res, {
      cleared: false,
      entry,
      undo: existing ? { type: 'restore', row: existing } : { type: 'delete', id: entry.id },
    });
  }),
);

// ── Dán vùng dữ liệu từ bảng tính ──────────────────────────────────────────
scoresRouter.post(
  '/entries/paste',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        sheetId: z.string().uuid(),
        startRow: z.coerce.number().int().min(0),
        startCol: z.coerce.number().int().min(0),
        /** Ma trận giá trị thô, đã tách theo tab/xuống dòng ở client. */
        matrix: z.array(z.array(z.string())).min(1).max(500),
        classIds: z.array(z.string().uuid()),
        criteriaIds: z.array(z.string().uuid()),
      }),
      req.body,
    );
    const userId = currentUserId(req);

    const sheet = await assertSheetWritable(body.sheetId);
    const criteria = await prisma.criterion.findMany({
      where: { id: { in: body.criteriaIds }, deletedAt: null },
    });
    const classes = await prisma.class.findMany({
      where: { id: { in: body.classIds }, deletedAt: null },
    });
    const criteriaById = new Map(criteria.map((c) => [c.id, c]));
    const classById = new Map(classes.map((c) => [c.id, c]));

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    let applied = 0;
    let skipped = 0;

    for (let r = 0; r < body.matrix.length; r += 1) {
      const row = body.matrix[r]!;
      for (let c = 0; c < row.length; c += 1) {
        const classId = body.classIds[body.startRow + r];
        const criteriaId = body.criteriaIds[body.startCol + c];
        if (!classId || !criteriaId) continue;

        const criterion = criteriaById.get(criteriaId);
        const cls = classById.get(classId);
        if (!criterion || !cls) continue;

        // Bản gốc bỏ qua âm thầm mọi ô không hợp lệ khi dán.
        const parsed = parseCell(row[c], criterion, { strict: false });
        if (!parsed || parsed.clear) {
          skipped += 1;
          continue;
        }

        const value = parsed.value === null ? null : new Prisma.Decimal(parsed.value);
        operations.push(
          prisma.scoreEntry.upsert({
            where: { sheetId_classId_criteriaId: { sheetId: body.sheetId, classId, criteriaId } },
            create: {
              sheetId: body.sheetId,
              schoolYearId: sheet.schoolYearId,
              semesterId: sheet.semesterId,
              campusId: cls.campusId,
              weekId: sheet.weekId,
              classId,
              criteriaId,
              entryState: parsed.entryState,
              value,
            },
            update: {
              entryState: parsed.entryState,
              value,
              deletedAt: null,
              revision: { increment: 1 },
            },
          }),
        );
        applied += 1;
      }
    }

    if (!operations.length) {
      throw businessRule('Không có ô hợp lệ để nhập.', { skipped });
    }

    await prisma.$transaction(operations);
    await writeAudit({
      action: 'score_bulk_paste',
      entity: 'score_entries',
      summary: `Dán ${applied} ô điểm`,
      reason: 'Dán vùng dữ liệu từ bảng tính',
      userId,
      ipAddress: req.ip,
    });

    return ok(res, { applied, skipped });
  }),
);

// ── Hoàn tác thay đổi gần nhất ─────────────────────────────────────────────
scoresRouter.post(
  '/entries/undo',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('delete'), id: z.string().uuid() }),
        z.object({ type: z.literal('restore'), row: z.record(z.string(), z.unknown()) }),
      ]),
      req.body,
    );
    const userId = currentUserId(req);

    if (body.type === 'delete') {
      await prisma.scoreEntry.deleteMany({ where: { id: body.id } });
    } else {
      const row = body.row as Record<string, unknown>;
      await assertSheetWritable(String(row.sheetId));
      await prisma.scoreEntry.upsert({
        where: { id: String(row.id) },
        create: {
          id: String(row.id),
          sheetId: String(row.sheetId),
          schoolYearId: String(row.schoolYearId),
          semesterId: (row.semesterId as string | null) ?? null,
          campusId: (row.campusId as string | null) ?? null,
          weekId: String(row.weekId),
          classId: String(row.classId),
          criteriaId: String(row.criteriaId),
          entryState: row.entryState as 'VALUE' | 'NA' | 'EXEMPT',
          value: row.value === null || row.value === undefined ? null : new Prisma.Decimal(String(row.value)),
        },
        update: {
          entryState: row.entryState as 'VALUE' | 'NA' | 'EXEMPT',
          value: row.value === null || row.value === undefined ? null : new Prisma.Decimal(String(row.value)),
          deletedAt: null,
        },
      });
    }

    await writeAudit({
      action: 'score_undo',
      entity: 'score_entries',
      entityId: body.type === 'delete' ? body.id : String(body.row.id),
      summary: 'Hoàn tác thay đổi điểm',
      reason: 'Người dùng hoàn tác',
      userId,
      ipAddress: req.ip,
    });

    return ok(res, { message: 'Đã hoàn tác thay đổi gần nhất.' });
  }),
);
