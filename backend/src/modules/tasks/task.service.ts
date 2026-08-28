import { Prisma, type RepeatRule, type Task } from '@prisma/client';
import { businessRule } from '../../lib/errors';
import { addDays, diffDays, localISO, nextRepeatDate, toDbDate, today } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { normalizeText } from '../../lib/text';

export interface ChecklistLine {
  label: string;
  required: boolean;
}

/**
 * Phân tích textarea checklist của bản gốc: mỗi dòng một mục,
 * tiền tố "!" đánh dấu mục bắt buộc.
 */
export function parseChecklist(raw: string | null | undefined): ChecklistLine[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      label: line.replace(/^!\s*/, '').trim(),
      required: line.startsWith('!'),
    }))
    .filter((item) => item.label.length > 0);
}

/**
 * Đồng bộ checklist con của một công việc.
 * Giữ nguyên trạng thái `done` khi nhãn khớp sau chuẩn hóa — đúng hành vi bản gốc.
 */
export async function syncChecklist(
  tx: Prisma.TransactionClient,
  taskId: string,
  lines: ChecklistLine[],
): Promise<void> {
  const existing = await tx.taskCheckItem.findMany({ where: { taskId, deletedAt: null } });
  const keptIds = new Set<string>();

  for (const [index, line] of lines.entries()) {
    const match = existing.find(
      (item) => normalizeText(item.label) === normalizeText(line.label) && !keptIds.has(item.id),
    );
    if (match) {
      keptIds.add(match.id);
      await tx.taskCheckItem.update({
        where: { id: match.id },
        data: { label: line.label, required: line.required, sortOrder: index, revision: { increment: 1 } },
      });
    } else {
      await tx.taskCheckItem.create({
        data: { taskId, label: line.label, required: line.required, done: false, sortOrder: index },
      });
    }
  }

  const removed = existing.filter((item) => !keptIds.has(item.id)).map((item) => item.id);
  if (removed.length) {
    await tx.taskCheckItem.updateMany({
      where: { id: { in: removed } },
      data: { deletedAt: new Date() },
    });
  }
}

/**
 * Chặn hoàn thành công việc khi còn mục checklist bắt buộc chưa xong.
 * Thông điệp giữ nguyên văn bản của bản gốc.
 */
export async function assertCompletable(taskId: string, status: string): Promise<void> {
  if (status !== 'DONE') return;
  const pending = await prisma.taskCheckItem.count({
    where: { taskId, deletedAt: null, required: true, done: false },
  });
  if (pending > 0) {
    throw businessRule('Chưa thể hoàn thành vì còn checklist bắt buộc chưa xong.', { pending });
  }
}

/** Kiểm tra hạn hoàn thành phải từ ngày bắt đầu trở đi. */
export function assertDateOrder(startDate?: string | null, dueDate?: string | null): void {
  if (startDate && dueDate && dueDate < startDate) {
    throw businessRule('Hạn hoàn thành phải từ ngày bắt đầu trở đi.');
  }
}

export interface RecurringResult {
  created: number;
  sources: number;
}

/**
 * Sinh các bản lặp đã đến hạn.
 * Tái hiện generateRecurringTasks() của bản gốc, gồm cả guard 400 vòng
 * và khóa chống trùng repeatOccurrenceKey = "{sourceId}:{dueDate}".
 */
export async function generateRecurringTasks(schoolYearId?: string): Promise<RecurringResult> {
  const now = today();
  const sources = await prisma.task.findMany({
    where: {
      deletedAt: null,
      repeatRule: { not: 'NONE' },
      repeatNextAt: { not: null, lte: toDbDate(now)! },
      ...(schoolYearId ? { schoolYearId } : {}),
    },
    include: { checkItems: { where: { deletedAt: null } } },
  });

  let created = 0;

  for (const source of sources) {
    let due = source.repeatNextAt ? localISO(source.repeatNextAt) : null;
    const until = source.repeatUntil ? localISO(source.repeatUntil) : null;
    let guard = 0;

    // Độ dài công việc được giữ nguyên cho mọi bản lặp.
    const sourceStart = source.startDate ? localISO(source.startDate) : localISO(source.dueDate);
    const duration = Math.max(0, diffDays(sourceStart, localISO(source.dueDate)));

    while (due && due <= now && guard < 400) {
      guard += 1;
      if (until && due > until) break;

      const occurrenceKey = `${source.id}:${due}`;
      const exists = await prisma.task.findUnique({ where: { repeatOccurrenceKey: occurrenceKey } });

      if (!exists) {
        const clone = await prisma.task.create({
          data: {
            schoolYearId: source.schoolYearId,
            semesterId: source.semesterId,
            campusId: source.campusId,
            title: source.title,
            groupName: source.groupName,
            startDate: toDbDate(addDays(due, -duration)),
            dueDate: toDbDate(due)!,
            priority: source.priority,
            status: 'TODO',
            progress: 0,
            coordination: source.coordination,
            notes: source.notes,
            repeatRule: 'NONE',
            repeatSourceId: source.id,
            repeatOccurrenceKey: occurrenceKey,
            customValues: source.customValues ?? Prisma.DbNull,
          },
        });
        created += 1;

        if (source.checkItems.length) {
          await prisma.taskCheckItem.createMany({
            data: source.checkItems.map((item) => ({
              taskId: clone.id,
              label: item.label,
              required: item.required,
              done: false,
              sortOrder: item.sortOrder,
            })),
          });
        }
      }

      due = nextRepeatDate(due, source.repeatRule as RepeatRule);
    }

    const nextValue = due ? toDbDate(due) : null;
    const currentValue = source.repeatNextAt ? localISO(source.repeatNextAt) : null;
    if (due !== currentValue) {
      await prisma.task.update({ where: { id: source.id }, data: { repeatNextAt: nextValue } });
    }
  }

  return { created, sources: sources.length };
}

/** Tính repeatNextAt khi lưu công việc, đúng logic bản gốc. */
export function resolveRepeatNext(
  incoming: { repeatRule: RepeatRule; dueDate: string },
  existing: Task | null,
): Date | null {
  if (incoming.repeatRule === 'NONE') return null;
  const ruleChanged = !existing || existing.repeatRule !== incoming.repeatRule || !existing.repeatNextAt;
  if (ruleChanged) return toDbDate(nextRepeatDate(incoming.dueDate, incoming.repeatRule));
  return existing.repeatNextAt;
}
