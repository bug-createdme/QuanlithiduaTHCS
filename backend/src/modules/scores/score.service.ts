import {
  type Class,
  type Criterion,
  type CriteriaSet,
  type EntryState,
  Prisma,
  type ScoreEntry,
  type SheetStatus,
  type WeeklyScoreSheet,
} from '@prisma/client';
import { businessRule, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { compareVietnamese } from '../../lib/text';

// ───────────────────────────── Tính điểm ────────────────────────────────────

const num = (value: Prisma.Decimal | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

/**
 * Quy đổi một ô nhập thành điểm.
 * Bản dịch trực tiếp của criterionScore() trong website gốc:
 *
 *   count   → value × points
 *   boolean → value ? points : 0
 *   note    → luôn 0
 *   weighted→ nhân thêm trọng số của tiêu chí
 */
export function criterionScore(
  entry: Pick<ScoreEntry, 'value' | 'entryState'> | null | undefined,
  criterion: Pick<Criterion, 'dataType' | 'points' | 'weight'>,
  set: Pick<CriteriaSet, 'formula'> | null | undefined,
): number {
  let score = num(entry?.value);

  if (criterion.dataType === 'COUNT') score *= num(criterion.points);
  if (criterion.dataType === 'BOOLEAN') score = num(entry?.value) ? num(criterion.points) : 0;
  if (criterion.dataType === 'NOTE') score = 0;
  if (set?.formula === 'WEIGHTED') score *= num(criterion.weight) || 1;

  return score;
}

export interface RankedRow {
  classId: string;
  className: string;
  campusId: string | null;
  total: number;
  filled: number;
  complete: boolean;
  rank: number;
}

/**
 * Xếp hạng các lớp trong một bảng tuần.
 *
 * Giữ nguyên quy tắc bản gốc:
 *  • điểm khởi đầu = baseScore khi formula = BASE, ngược lại 0
 *  • chỉ ô entryState = VALUE mới cộng vào tổng; NA/EXEMPT vẫn tính là "đã nhập"
 *  • loại lớp chưa có ô nào (filled = 0)
 *  • đồng điểm thì đồng hạng, hạng kế tiếp nhảy cóc (1, 2, 2, 4)
 */
export function rankClasses(
  classes: Array<Pick<Class, 'id' | 'className' | 'campusId'>>,
  criteria: Array<Pick<Criterion, 'id' | 'dataType' | 'points' | 'weight'>>,
  entries: Array<Pick<ScoreEntry, 'classId' | 'criteriaId' | 'value' | 'entryState'>>,
  set: Pick<CriteriaSet, 'formula' | 'baseScore'> | null,
): RankedRow[] {
  const map = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) map.set(`${entry.classId}|${entry.criteriaId}`, entry);

  const rows = classes
    .map((cls) => {
      let total = set?.formula === 'BASE' ? num(set.baseScore) : 0;
      let filled = 0;

      for (const criterion of criteria) {
        const entry = map.get(`${cls.id}|${criterion.id}`);
        if (!entry) continue;
        filled += 1;
        if (entry.entryState === 'VALUE') total += criterionScore(entry, criterion, set);
      }

      return {
        classId: cls.id,
        className: cls.className,
        campusId: cls.campusId,
        total: Math.round(total * 100) / 100,
        filled,
        complete: filled === criteria.length,
        rank: 0,
      };
    })
    .filter((row) => row.filled > 0)
    .sort((a, b) => b.total - a.total || compareVietnamese(a.className, b.className));

  rows.forEach((row, index) => {
    row.rank = index > 0 && row.total === rows[index - 1]!.total ? rows[index - 1]!.rank : index + 1;
  });

  return rows;
}

// ─────────────────────── Ngữ cảnh bảng điểm tuần ────────────────────────────

export interface ScoreContext {
  sets: CriteriaSet[];
  set: CriteriaSet | null;
  criteria: Criterion[];
  classes: Class[];
  sheet: WeeklyScoreSheet | null;
  entries: ScoreEntry[];
}

export interface ScoreContextQuery {
  schoolYearId: string;
  semesterId?: string | null;
  campusId?: string | null;
  weekId: string;
  criteriaSetId?: string | null;
}

/**
 * Dựng ngữ cảnh chấm điểm — bản dịch của scoreContext() trong website gốc,
 * gồm cả thứ tự ưu tiên chọn bộ tiêu chí.
 */
export async function buildScoreContext(query: ScoreContextQuery): Promise<ScoreContext> {
  const campusFilter =
    query.campusId && query.campusId !== 'all'
      ? [{ campusId: null }, { campusId: query.campusId }]
      : undefined;

  const sets = await prisma.criteriaSet.findMany({
    where: {
      deletedAt: null,
      schoolYearId: query.schoolYearId,
      status: { not: 'STOPPED' },
      ...(campusFilter ? { OR: campusFilter } : {}),
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  const sheets = await prisma.weeklyScoreSheet.findMany({
    where: { deletedAt: null, schoolYearId: query.schoolYearId, weekId: query.weekId },
  });
  const decidedSheet = sheets.find((s) => s.status === 'LOCKED' || s.status === 'APPROVED');

  // Ưu tiên: chọn thủ công → bộ của bảng đã chốt → bộ đang áp dụng → bộ đầu tiên.
  const set =
    sets.find((s) => s.id === query.criteriaSetId) ??
    sets.find((s) => s.id === decidedSheet?.criteriaSetId) ??
    sets.find(
      (s) =>
        s.status === 'ACTIVE' &&
        (!s.semesterId || !query.semesterId || query.semesterId === 'all' || s.semesterId === query.semesterId),
    ) ??
    sets[0] ??
    null;

  const criteria = set
    ? await prisma.criterion.findMany({
        where: { criteriaSetId: set.id, deletedAt: null, active: true },
        orderBy: { sortOrder: 'asc' },
      })
    : [];

  const classes = (
    await prisma.class.findMany({
      where: {
        deletedAt: null,
        schoolYearId: query.schoolYearId,
        active: true,
        ...(query.campusId && query.campusId !== 'all' ? { campusId: query.campusId } : {}),
      },
    })
  ).sort((a, b) => compareVietnamese(a.className, b.className));

  const sheet = set ? (sheets.find((s) => s.criteriaSetId === set.id) ?? null) : null;

  const entries = sheet
    ? await prisma.scoreEntry.findMany({ where: { sheetId: sheet.id, deletedAt: null } })
    : [];

  return { sets, set, criteria, classes, sheet, entries };
}

// ──────────────────────── Phân tích giá trị ô nhập ──────────────────────────

export interface ParsedCell {
  entryState: EntryState;
  value: number | null;
  /** true nghĩa là ô rỗng → xóa bản ghi, đúng hành vi bản gốc. */
  clear: boolean;
}

const BOOLEAN_TRUE = ['ĐẠT', 'DAT', 'CÓ', 'CO'];
const BOOLEAN_FALSE = ['KHÔNG ĐẠT', 'KHONG DAT', 'KHÔNG', 'KHONG'];

/**
 * Diễn giải giá trị người dùng gõ vào ô điểm.
 * Chấp nhận: số (cả dấu phẩy thập phân), KAD/N/A, MIỄN/MIEN,
 * và ĐẠT/KHÔNG ĐẠT cho tiêu chí kiểu boolean.
 */
export function parseCell(
  raw: string | number | null | undefined,
  criterion: Pick<Criterion, 'dataType' | 'minValue' | 'maxValue' | 'code'>,
  options: { strict?: boolean } = {},
): ParsedCell | null {
  const text = String(raw ?? '').trim().toUpperCase();

  if (text === '') return { entryState: 'VALUE', value: null, clear: true };
  if (text === 'KAD' || text === 'N/A') return { entryState: 'NA', value: null, clear: false };
  if (text === 'MIỄN' || text === 'MIEN') return { entryState: 'EXEMPT', value: null, clear: false };

  let value: number;
  if (criterion.dataType === 'BOOLEAN' && BOOLEAN_TRUE.includes(text)) value = 1;
  else if (criterion.dataType === 'BOOLEAN' && BOOLEAN_FALSE.includes(text)) value = 0;
  else value = Number(text.replace(',', '.'));

  if (!Number.isFinite(value)) {
    if (options.strict) {
      throw businessRule('Nhập số, ĐẠT/KHÔNG ĐẠT, KAD hoặc MIỄN theo kiểu tiêu chí.');
    }
    return null;
  }

  const min = criterion.minValue === null ? -Infinity : Number(criterion.minValue);
  const max = criterion.maxValue === null ? Infinity : Number(criterion.maxValue);

  if (value < min || value > max) {
    if (options.strict) {
      throw businessRule(
        `Giá trị phải trong khoảng ${criterion.minValue ?? '−∞'} đến ${criterion.maxValue ?? '+∞'}.`,
        { criterion: criterion.code, min, max },
      );
    }
    return null;
  }

  return { entryState: 'VALUE', value, clear: false };
}

// ───────────────────────── Quy trình trạng thái ─────────────────────────────

/** Nhãn nút hành động kế tiếp — giữ nguyên workflowLabel() của bản gốc. */
export const WORKFLOW_LABEL: Record<SheetStatus, string> = {
  DRAFT: 'Đánh dấu đã nhập đủ',
  COMPLETE: 'Gửi kiểm tra',
  REVIEW: 'Duyệt bảng',
  APPROVED: 'Khóa bảng',
  LOCKED: 'Mở khóa có lý do',
  UNLOCKED: 'Gửi kiểm tra lại',
};

/** Trạng thái kế tiếp trong quy trình. */
export function nextStatus(current: SheetStatus): SheetStatus {
  const map: Record<SheetStatus, SheetStatus> = {
    DRAFT: 'COMPLETE',
    COMPLETE: 'REVIEW',
    UNLOCKED: 'REVIEW',
    REVIEW: 'APPROVED',
    APPROVED: 'LOCKED',
    LOCKED: 'UNLOCKED',
  };
  return map[current];
}

/** Chặn sửa điểm khi bảng đã khóa. */
export async function assertSheetWritable(sheetId: string): Promise<WeeklyScoreSheet> {
  const sheet = await prisma.weeklyScoreSheet.findFirst({ where: { id: sheetId, deletedAt: null } });
  if (!sheet) throw notFound('Bảng thi đua tuần');
  if (sheet.status === 'LOCKED') {
    throw businessRule('Bảng thi đua đã khóa. Hãy mở khóa có lý do trước khi sửa điểm.');
  }
  return sheet;
}

// ──────────────────────── Kiểm tra bất thường ───────────────────────────────

export interface Anomaly {
  level: 'red' | 'yellow';
  text: string;
}

/**
 * Bốn quy tắc cảnh báo của bản gốc. Đây là dấu hiệu cần kiểm tra,
 * không phải kết luận sai phạm — thông điệp giữ nguyên tinh thần đó.
 */
export function detectAnomalies(context: ScoreContext, evidenceEntryIds: Set<string>): Anomaly[] {
  const items: Anomaly[] = [];
  const filled = new Map<string, number>();

  for (const entry of context.entries) {
    filled.set(entry.classId, (filled.get(entry.classId) ?? 0) + 1);
  }

  for (const cls of context.classes) {
    const count = filled.get(cls.id) ?? 0;
    if (count === 0) {
      items.push({ level: 'red', text: `Lớp ${cls.className} chưa có dữ liệu.` });
    } else if (count < context.criteria.length) {
      items.push({
        level: 'yellow',
        text: `Lớp ${cls.className} còn thiếu ${context.criteria.length - count} tiêu chí.`,
      });
    }
  }

  const criteriaById = new Map(context.criteria.map((c) => [c.id, c]));
  const classById = new Map(context.classes.map((c) => [c.id, c]));

  for (const entry of context.entries) {
    const criterion = criteriaById.get(entry.criteriaId);
    if (!criterion) continue;

    if (criterion.evidenceRequired && !evidenceEntryIds.has(entry.id)) {
      items.push({
        level: 'yellow',
        text: `Thiếu minh chứng bắt buộc tại lớp ${classById.get(entry.classId)?.className ?? '—'}, tiêu chí ${criterion.code}.`,
      });
    }

    if (entry.entryState === 'VALUE' && entry.value !== null) {
      const value = Number(entry.value);
      const min = criterion.minValue === null ? -Infinity : Number(criterion.minValue);
      const max = criterion.maxValue === null ? Infinity : Number(criterion.maxValue);
      if (value < min || value > max) {
        items.push({ level: 'red', text: `Giá trị vượt giới hạn ở tiêu chí ${criterion.code}.` });
      }
    }
  }

  return items;
}
