import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { businessRule, notFound } from '../../lib/errors';
import { asyncHandler, created, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { stableJson } from '../../lib/text';
import { currentUserId, requireAuth, requireRole, requireWrite } from '../../middleware/auth';
import { collectPayload, createSnapshot, pruneSnapshots, restoreSnapshot, sha256 } from './snapshot.service';

const idSchema = z.object({ id: z.string().uuid() });

/**
 * Định dạng tệp sao lưu. Giữ tên TPT-BACKUP-3 của bản gốc để người dùng
 * nhận ra, nhưng đánh dấu nguồn là PostgreSQL thay vì IndexedDB.
 */
const BACKUP_FORMAT = 'TPT-BACKUP-3';

export const backupRouter = Router();
backupRouter.use(requireAuth);

// ── Tổng quan trang Sao lưu ────────────────────────────────────────────────
backupRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [snapshots, records, lastBackup, attachmentAgg] = await Promise.all([
      prisma.snapshot.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          tier: true,
          protected: true,
          reason: true,
          recordCount: true,
          counts: true,
          checksum: true,
          createdAt: true,
        },
      }),
      prisma.backupRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.appSetting.findUnique({ where: { key: 'last_backup_at' } }),
      prisma.attachment.aggregate({
        where: { deletedAt: null },
        _sum: { size: true },
        _count: true,
      }),
    ]);

    return ok(res, {
      snapshots,
      backupRecords: records,
      lastBackupAt: (lastBackup?.value as string | null) ?? null,
      attachmentCount: attachmentAgg._count,
      attachmentBytes: Number(attachmentAgg._sum.size ?? 0n),
      // Kiến trúc mới: PostgreSQL là nguồn dữ liệu duy nhất.
      storage: {
        kind: 'postgresql',
        label: 'PostgreSQL tập trung — dùng chung mọi thiết bị',
      },
    });
  }),
);

// ── Xuất dữ liệu ───────────────────────────────────────────────────────────
backupRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { scope, yearId } = parseOrThrow(
      z.object({
        scope: z.enum(['QUICK', 'FULL', 'YEAR_PACKAGE']).default('QUICK'),
        yearId: z.string().uuid().optional(),
      }),
      req.query,
    );

    if (scope === 'YEAR_PACKAGE' && !yearId) {
      throw businessRule('Gói năm học cần chọn năm cụ thể.');
    }

    const { payload, counts, total } = await collectPayload(
      prisma,
      scope === 'YEAR_PACKAGE' ? yearId : undefined,
    );

    const body = {
      format: BACKUP_FORMAT,
      scope,
      exportedAt: new Date().toISOString(),
      source: 'postgresql',
      manifest: { recordCount: total, counts },
      data: payload,
    };
    const json = JSON.stringify(body, null, 2);
    const checksum = sha256(stableJson(payload));

    await prisma.$transaction([
      prisma.backupRecord.create({
        data: {
          name: `Sao lưu ${scope} ${new Date().toISOString().slice(0, 10)}`,
          scope,
          size: BigInt(Buffer.byteLength(json, 'utf8')),
          checksum,
          recordCount: total,
          completedAt: new Date(),
          createdById: currentUserId(req),
        },
      }),
      prisma.appSetting.upsert({
        where: { key: 'last_backup_at' },
        create: { key: 'last_backup_at', value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      }),
    ]);

    const filename = `tpt-backup-${scope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Backup-Checksum', checksum);
    return res.send(json);
  }),
);

// ── Kiểm tra tệp phục hồi trước khi ghi ────────────────────────────────────
backupRouter.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        format: z.string(),
        scope: z.string().optional(),
        exportedAt: z.string().optional(),
        manifest: z.object({ recordCount: z.coerce.number() }).optional(),
        data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
      }),
      req.body,
    );

    const issues: string[] = [];
    if (body.format !== BACKUP_FORMAT) {
      issues.push(`Định dạng "${body.format}" không phải ${BACKUP_FORMAT}.`);
    }

    const counts = Object.fromEntries(Object.entries(body.data).map(([k, v]) => [k, v.length]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (body.manifest && body.manifest.recordCount !== total) {
      issues.push(`Số bản ghi không khớp manifest: ${total} vs ${body.manifest.recordCount}.`);
    }

    return ok(res, {
      valid: issues.length === 0,
      issues,
      counts,
      total,
      checksum: sha256(stableJson(body.data)),
    });
  }),
);

// ── Phục hồi từ tệp sao lưu ────────────────────────────────────────────────
backupRouter.post(
  '/restore',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        format: z.literal(BACKUP_FORMAT, {
          errorMap: () => ({ message: `Tệp phải ở định dạng ${BACKUP_FORMAT}.` }),
        }),
        data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
        confirmed: z.coerce.boolean().default(false),
      }),
      req.body,
    );
    const userId = currentUserId(req);

    if (!body.confirmed) {
      throw businessRule('Phục hồi sẽ ghi đè dữ liệu hiện tại. Hãy xác nhận trước khi tiếp tục.');
    }

    // Luôn chụp hiện trạng trước khi ghi đè.
    const safety = await createSnapshot({
      name: 'Trước khi phục hồi từ tệp sao lưu',
      tier: 'PROTECTED',
      protectedSnapshot: true,
      reason: 'before-file-restore',
      userId,
    });

    let restored = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const [model, rows] of Object.entries(body.data)) {
          const delegate = (tx as unknown as Record<string, { upsert(args: unknown): Promise<unknown> }>)[
            model
          ];
          if (!delegate || !Array.isArray(rows)) continue;
          for (const row of rows) {
            const { id, ...rest } = row;
            if (!id) continue;
            await delegate.upsert({ where: { id }, create: row, update: rest });
            restored += 1;
          }
        }
      },
      { timeout: 300_000, maxWait: 30_000 },
    );

    await writeAudit({
      action: 'backup_restore',
      entity: 'app_settings',
      summary: `Phục hồi ${restored} bản ghi từ tệp sao lưu`,
      reason: `Điểm khôi phục an toàn: ${safety.id}`,
      userId,
      ipAddress: req.ip,
    });
    return ok(res, { restored, safetySnapshotId: safety.id });
  }),
);

// ── Điểm khôi phục nội bộ ──────────────────────────────────────────────────
backupRouter.post(
  '/snapshots',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        name: z.string().trim().max(250).optional(),
        yearId: z.string().uuid().optional(),
      }),
      req.body ?? {},
    );

    const snapshot = await createSnapshot({
      name: body.name ?? `Thủ công ${new Date().toLocaleString('vi-VN')}`,
      tier: 'MANUAL',
      schoolYearId: body.yearId,
      userId: currentUserId(req),
    });
    return created(res, snapshot);
  }),
);

backupRouter.get(
  '/snapshots/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const snapshot = await prisma.snapshot.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        tier: true,
        protected: true,
        reason: true,
        recordCount: true,
        counts: true,
        checksum: true,
        createdAt: true,
      },
    });
    if (!snapshot) throw notFound('Điểm khôi phục');
    return ok(res, snapshot);
  }),
);

backupRouter.post(
  '/snapshots/:id/restore',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { confirmed } = parseOrThrow(
      z.object({ confirmed: z.coerce.boolean().default(false) }),
      req.body ?? {},
    );
    if (!confirmed) {
      throw businessRule('Khôi phục sẽ ghi đè dữ liệu hiện tại. Hãy xác nhận trước khi tiếp tục.');
    }

    const userId = currentUserId(req);
    const result = await restoreSnapshot(id, userId);

    await writeAudit({
      action: 'snapshot_restore',
      entity: 'snapshots',
      entityId: id,
      summary: `Khôi phục ${result.restored} bản ghi`,
      reason: `Điểm khôi phục an toàn: ${result.safetySnapshotId}`,
      userId,
      ipAddress: req.ip,
    });
    return ok(res, result);
  }),
);

backupRouter.post(
  '/snapshots/prune',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => ok(res, { removed: await pruneSnapshots() })),
);

// ── Nhật ký kiểm toán ──────────────────────────────────────────────────────
backupRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const { entity, limit } = parseOrThrow(
      z.object({
        entity: z.string().max(60).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      }),
      req.query,
    );
    return ok(
      res,
      await prisma.auditLog.findMany({
        where: entity ? { entity } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { fullName: true, username: true } } },
      }),
    );
  }),
);

/** Ghi nhận thời điểm sao lưu thủ công (dùng khi người dùng tự tải tệp). */
backupRouter.post(
  '/records',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        name: z.string().trim().max(250),
        scope: z.enum(['QUICK', 'FULL', 'YEAR_PACKAGE']),
        size: z.coerce.number().int().min(0),
        checksum: z.string().max(64).optional(),
        recordCount: z.coerce.number().int().min(0).default(0),
      }),
      req.body,
    );

    const record = await prisma.backupRecord.create({
      data: {
        name: body.name,
        scope: body.scope,
        size: BigInt(body.size),
        checksum: body.checksum ?? null,
        recordCount: body.recordCount,
        completedAt: new Date(),
        createdById: currentUserId(req),
      },
    });
    return created(res, record);
  }),
);

export { BACKUP_FORMAT, Prisma };
