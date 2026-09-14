import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { childCrudRouter } from '../../lib/childCrud';
import { toDbDate } from '../../lib/dates';
import { businessRule } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { emptyToNull, optionalDate, optionalLongText, optionalText } from '../entities/entity.schemas';

/**
 * Ba bảng con treo dưới các thực thể CRUD dùng chung:
 *   • plan_targets          — chỉ tiêu đo được của một kế hoạch
 *   • training_records      — buổi bồi dưỡng của một thành viên Đội
 *   • equipment_transactions— sổ mượn–trả của một thiết bị
 *
 * Ba bảng này đã có sẵn trong lược đồ và trong gói sao lưu từ đầu nhưng chưa
 * có điểm cuối nào chạm tới, nên trước đây không nhập được dữ liệu.
 */

// ═══════════════════════ Chỉ tiêu kế hoạch ═════════════════════════════════

const decimalOrNull = () =>
  emptyToNull(z.coerce.number().min(-1_000_000_000).max(1_000_000_000));

const planTargetCreateSchema = z.object({
  planId: z.string().uuid('Hãy chọn kế hoạch.'),
  name: z.string().trim().min(1, 'Hãy nhập tên chỉ tiêu.').max(200),
  targetValue: decimalOrNull(),
  actualValue: decimalOrNull(),
  unit: optionalText(30),
  sortOrder: z.coerce.number().int().min(1).max(999).default(1),
});

/** Số thập phân của Prisma cần Decimal, không nhận number trực tiếp cho cột Decimal. */
const toDecimal = (value: unknown): Prisma.Decimal | null =>
  value === null || value === undefined ? null : new Prisma.Decimal(String(value));

export const planTargetsRouter = childCrudRouter({
  model: 'planTarget',
  entity: 'plan_targets',
  label: 'Chỉ tiêu kế hoạch',
  parentKey: 'planId',
  parentModel: 'plan',
  parentLabel: 'Kế hoạch',
  createSchema: planTargetCreateSchema,
  updateSchema: planTargetCreateSchema.partial().omit({ planId: true }),
  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  describe: (row) => String(row.name ?? 'Chỉ tiêu'),
  beforeWrite: (data) => {
    const out = { ...data };
    if ('targetValue' in out) out.targetValue = toDecimal(out.targetValue);
    if ('actualValue' in out) out.actualValue = toDecimal(out.actualValue);
    return out;
  },
});

// ═══════════════════════ Bồi dưỡng thành viên Đội ══════════════════════════

const trainingRecordCreateSchema = z.object({
  teamMemberId: z.string().uuid('Hãy chọn thành viên.'),
  content: z.string().trim().min(1, 'Hãy nhập nội dung bồi dưỡng.').max(200),
  date: optionalDate(),
  result: optionalText(120),
  note: optionalLongText(),
});

export const trainingRecordsRouter = childCrudRouter({
  model: 'trainingRecord',
  entity: 'training_records',
  label: 'Buổi bồi dưỡng',
  parentKey: 'teamMemberId',
  parentModel: 'teamMember',
  parentLabel: 'Thành viên Đội',
  createSchema: trainingRecordCreateSchema,
  updateSchema: trainingRecordCreateSchema.partial().omit({ teamMemberId: true }),
  orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  describe: (row) => String(row.content ?? 'Buổi bồi dưỡng'),
  beforeWrite: (data) => {
    const out = { ...data };
    if ('date' in out) out.date = toDbDate(out.date as string | null);
    return out;
  },
});

// ═══════════════════════ Sổ mượn–trả thiết bị ══════════════════════════════

const TX_LABEL: Record<string, string> = {
  BORROW: 'Cho mượn',
  RETURN: 'Nhận trả',
  REPAIR: 'Sửa chữa',
  DISPOSE: 'Thanh lý',
};

/** Nhận cả "YYYY-MM-DD" lẫn chuỗi ISO đầy đủ — form gửi dạng nào cũng hợp lệ. */
const optionalMoment = () =>
  emptyToNull(
    z
      .string()
      .trim()
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Thời điểm không hợp lệ.'),
  );

const equipmentTxCreateSchema = z.object({
  equipmentId: z.string().uuid('Hãy chọn thiết bị.'),
  type: z.enum(['BORROW', 'RETURN', 'REPAIR', 'DISPOSE'], {
    errorMap: () => ({ message: 'Hãy chọn loại giao dịch.' }),
  }),
  quantity: z.coerce.number().int().min(1, 'Số lượng phải từ 1 trở lên.').max(100_000),
  borrower: optionalText(120),
  borrowedAt: optionalMoment(),
  dueAt: optionalDate(),
  returnedAt: optionalDate(),
  conditionBefore: optionalText(40),
  conditionAfter: optionalText(40),
  note: optionalLongText(),
});

/**
 * Số lượng đang còn ở ngoài = đã cho mượn − đã nhận trả − đã thanh lý.
 * Dùng để chặn nhận trả nhiều hơn số đã cho mượn.
 */
export async function outstandingQuantity(
  equipmentId: string,
  excludeTxId?: string,
): Promise<number> {
  const rows = await prisma.equipmentTransaction.findMany({
    where: {
      equipmentId,
      deletedAt: null,
      ...(excludeTxId ? { id: { not: excludeTxId } } : {}),
    },
    select: { type: true, quantity: true },
  });
  return rows.reduce((sum, row) => {
    if (row.type === 'BORROW') return sum + row.quantity;
    if (row.type === 'RETURN' || row.type === 'DISPOSE') return sum - row.quantity;
    return sum;
  }, 0);
}

export const equipmentTransactionsRouter = childCrudRouter({
  model: 'equipmentTransaction',
  entity: 'equipment_transactions',
  label: 'Giao dịch thiết bị',
  parentKey: 'equipmentId',
  parentModel: 'equipment',
  parentLabel: 'Thiết bị',
  createSchema: equipmentTxCreateSchema,
  updateSchema: equipmentTxCreateSchema.partial().omit({ equipmentId: true }),
  orderBy: [{ borrowedAt: 'desc' }, { createdAt: 'desc' }],
  describe: (row) =>
    `${TX_LABEL[String(row.type)] ?? String(row.type)} ${row.quantity ?? ''}${
      row.borrower ? ` — ${String(row.borrower)}` : ''
    }`.trim(),
  beforeWrite: (data) => {
    const out = { ...data };
    for (const field of ['dueAt', 'returnedAt']) {
      if (field in out) out[field] = toDbDate(out[field] as string | null);
    }
    // Cho mượn mà không ghi ngày thì lấy thời điểm hiện tại, đúng thói quen ghi sổ.
    if ('borrowedAt' in out) {
      const raw = out.borrowedAt as string | null;
      out.borrowedAt = raw ? new Date(raw) : null;
    }
    if (out.type === 'BORROW' && !out.borrowedAt) out.borrowedAt = new Date();
    return out;
  },
  validate: async (data, { existing, parentId }) => {
    const type = String(data.type ?? existing?.type);
    const quantity = Number(data.quantity ?? existing?.quantity ?? 0);

    const equipment = await prisma.equipment.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { quantity: true, name: true },
    });
    if (!equipment) return;

    if (type === 'BORROW') {
      // Không cho mượn nhiều hơn số còn trong kho.
      const outstanding = await outstandingQuantity(parentId, existing?.id as string | undefined);
      const available = equipment.quantity - outstanding;
      if (quantity > available) {
        throw businessRule(
          `Chỉ còn ${available}/${equipment.quantity} ${equipment.name} trong kho, không cho mượn được ${quantity}.`,
          { available, total: equipment.quantity, requested: quantity },
        );
      }
    }

    if (type === 'RETURN' || type === 'DISPOSE') {
      const outstanding = await outstandingQuantity(parentId, existing?.id as string | undefined);
      if (quantity > outstanding) {
        throw businessRule(
          `Đang có ${outstanding} ${equipment.name} ở ngoài, không ghi nhận ${
            type === 'RETURN' ? 'trả' : 'thanh lý'
          } ${quantity} được.`,
          { outstanding, requested: quantity },
        );
      }
    }
  },
});
