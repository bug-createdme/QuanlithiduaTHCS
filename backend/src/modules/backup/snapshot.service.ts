import crypto from 'node:crypto';
import type { Prisma, PrismaClient, SnapshotTier } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { stableJson } from '../../lib/text';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Các bảng đưa vào điểm khôi phục.
 * Tương ứng STORES trừ SNAPSHOT_EXCLUDED_STORES của bản gốc:
 * không gồm tệp đính kèm (tránh nhân đôi dung lượng) và không gồm bảng hệ thống.
 */
const SNAPSHOT_MODELS = [
  'school',
  'campus',
  'schoolYear',
  'semester',
  'schoolWeek',
  'homeroomTeacher',
  'class',
  'plan',
  'planTarget',
  'task',
  'taskCheckItem',
  'taskDependency',
  'taskTemplate',
  'calendarEvent',
  'activity',
  'criteriaSet',
  'criterion',
  'weeklyScoreSheet',
  'scoreEntry',
  'rankingSnapshot',
  'teamUnit',
  'teamMember',
  'trainingRecord',
  'program',
  'programResult',
  'commendation',
  'documentFolder',
  'document',
  'documentLink',
  'equipment',
  'equipmentTransaction',
  'generatedReport',
  'configCategory',
  'configItem',
  'customFieldDefinition',
] as const;

export type SnapshotModel = (typeof SNAPSHOT_MODELS)[number];

export interface CreateSnapshotOptions {
  name: string;
  tier?: SnapshotTier;
  protectedSnapshot?: boolean;
  /** Mốc nghiệp vụ: before-score-lock, before-score-unlock, after-finalized-report… */
  reason?: string;
  schoolYearId?: string | null;
  userId?: string | null;
}

export interface SnapshotResult {
  id: string;
  checksum: string;
  recordCount: number;
}

/** SHA-256 của chuỗi — dùng cho checksum snapshot, báo cáo và sao lưu. */
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Đọc toàn bộ dữ liệu nghiệp vụ (chưa xóa mềm) làm payload snapshot.
 * Giới hạn theo năm học nếu bảng có cột school_year_id.
 */
export async function collectPayload(
  tx: Tx,
  schoolYearId?: string | null,
): Promise<{ payload: Record<string, unknown[]>; counts: Record<string, number>; total: number }> {
  const payload: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  let total = 0;

  for (const model of SNAPSHOT_MODELS) {
    const delegate = (tx as unknown as Record<string, { findMany(args?: unknown): Promise<unknown[]> }>)[model];
    if (!delegate) continue;

    // Chỉ lọc theo năm học ở những bảng thực sự có cột đó.
    const where: Record<string, unknown> = { deletedAt: null };
    if (schoolYearId) {
      try {
        const probe = await delegate.findMany({ where: { ...where, schoolYearId }, take: 0 });
        void probe;
        where.schoolYearId = schoolYearId;
      } catch {
        // Bảng không có cột school_year_id — lấy toàn bộ.
      }
    }

    const rows = await delegate.findMany({ where });
    payload[model] = rows;
    counts[model] = rows.length;
    total += rows.length;
  }

  return { payload, counts, total };
}

/**
 * Tạo điểm khôi phục nội bộ.
 * Bản gốc gọi createInternalSnapshot() trước khi khóa/mở khóa bảng thi đua,
 * sau khi chốt báo cáo, trước migration và trước khi đóng năm học.
 */
export async function createSnapshot(
  options: CreateSnapshotOptions,
  tx: Tx = prisma,
): Promise<SnapshotResult> {
  const { payload, counts, total } = await collectPayload(tx, options.schoolYearId);
  const checksum = sha256(stableJson(payload));

  const row = await tx.snapshot.create({
    data: {
      name: options.name,
      tier: options.tier ?? 'MANUAL',
      protected: options.protectedSnapshot ?? false,
      reason: options.reason ?? null,
      schoolYearId: options.schoolYearId ?? null,
      recordCount: total,
      counts: counts as unknown as Prisma.InputJsonValue,
      checksum,
      payload: payload as unknown as Prisma.InputJsonValue,
      createdById: options.userId ?? null,
    },
  });

  logger.info({ snapshotId: row.id, reason: options.reason, records: total }, 'Đã tạo điểm khôi phục');
  return { id: row.id, checksum, recordCount: total };
}

/**
 * Dọn snapshot theo chính sách gốc: giữ 7 ngày · 4 tuần · 12 tháng.
 * Snapshot `protected` không bao giờ bị xóa tự động.
 */
export async function pruneSnapshots(): Promise<number> {
  const now = Date.now();
  const day = 86_400_000;

  const cutoffs: Array<{ tier: SnapshotTier; before: Date }> = [
    { tier: 'DAILY', before: new Date(now - 7 * day) },
    { tier: 'WEEKLY', before: new Date(now - 28 * day) },
    { tier: 'MONTHLY', before: new Date(now - 365 * day) },
    { tier: 'MANUAL', before: new Date(now - 90 * day) },
  ];

  let removed = 0;
  for (const { tier, before } of cutoffs) {
    const result = await prisma.snapshot.deleteMany({
      where: { tier, protected: false, createdAt: { lt: before } },
    });
    removed += result.count;
  }

  if (removed > 0) logger.info({ removed }, 'Đã dọn điểm khôi phục quá hạn');
  return removed;
}

/**
 * Khôi phục từ snapshot.
 * Luôn tạo một snapshot bảo vệ của hiện trạng trước khi ghi đè.
 */
export async function restoreSnapshot(snapshotId: string, userId: string | null): Promise<{
  restored: number;
  safetySnapshotId: string;
}> {
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new Error('Không tìm thấy điểm khôi phục.');

  const payload = snapshot.payload as Record<string, Array<Record<string, unknown>>>;
  const expected = sha256(stableJson(payload));
  if (snapshot.checksum && snapshot.checksum !== expected) {
    throw new Error('Checksum điểm khôi phục không khớp; dữ liệu có thể đã hỏng. Chưa ghi gì.');
  }

  const safety = await createSnapshot({
    name: `Trước khi khôi phục ${snapshot.name}`,
    tier: 'PROTECTED',
    protectedSnapshot: true,
    reason: 'before-restore',
    schoolYearId: snapshot.schoolYearId,
    userId,
  });

  let restored = 0;
  await prisma.$transaction(
    async (tx) => {
      // Ghi theo thứ tự khai báo để bảng cha có trước bảng con.
      for (const model of SNAPSHOT_MODELS) {
        const rows = payload[model];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const delegate = (tx as unknown as Record<string, { upsert(args: unknown): Promise<unknown> }>)[model];
        if (!delegate) continue;

        for (const row of rows) {
          const { id, ...rest } = row;
          await delegate.upsert({ where: { id }, create: row, update: rest });
          restored += 1;
        }
      }
    },
    { timeout: 300_000, maxWait: 30_000 },
  );

  logger.info({ snapshotId, restored }, 'Đã khôi phục từ điểm khôi phục');
  return { restored, safetySnapshotId: safety.id };
}
