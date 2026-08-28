import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
}

const asText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Ghi nhật ký kiểm toán. Tái hiện db.put(..., {audit:true}) của bản gốc.
 * Truyền `tx` khi cần nhật ký nằm cùng transaction với thay đổi dữ liệu —
 * thao tác thất bại thì nhật ký cũng phải cuốn theo.
 */
export async function writeAudit(input: AuditInput, tx: Tx = prisma): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      oldValue: asText(input.oldValue),
      newValue: asText(input.newValue),
      reason: input.reason ?? null,
      userId: input.userId ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

/** Mô tả ngắn gọn một bản ghi để hiển thị trong nhật ký. */
export function describeRecord(record: Record<string, unknown> | null): string {
  if (!record) return 'Bản ghi đã chọn';
  const candidates = ['name', 'title', 'className', 'recipient', 'label', 'code', 'fullName'];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'Bản ghi đã chọn';
}
