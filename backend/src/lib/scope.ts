import { z } from 'zod';
import { parseOrThrow } from './http';

/**
 * Phạm vi dữ liệu toàn cục — 4 dropdown ở topbar của bản gốc
 * (năm học · học kỳ · tuần · cơ sở).
 *
 * Bản gốc lọc phía client bằng hàm scoped():
 *   (!x.school_year_id || x.school_year_id === state.yearId) &&
 *   (!x.semester_id   || semesterId === "all" || x.semester_id === semesterId) &&
 *   (!x.campus_id     || x.campus_id === "all" || campusId === "all" || x.campus_id === campusId)
 *
 * Ở đây logic đó chuyển xuống server và dịch thành mệnh đề WHERE của Prisma.
 */
export const scopeQuerySchema = z.object({
  yearId: z.string().uuid().optional(),
  semesterId: z.union([z.string().uuid(), z.literal('all')]).optional(),
  weekId: z.string().uuid().optional(),
  campusId: z.union([z.string().uuid(), z.literal('all')]).optional(),
});

export type ScopeQuery = z.infer<typeof scopeQuerySchema>;

export function parseScope(query: unknown): ScopeQuery {
  return parseOrThrow(scopeQuerySchema, query);
}

export interface ScopeWhereOptions {
  /** Bảng có cột semester_id hay không. */
  semester?: boolean;
  /** Bảng có cột campus_id hay không. */
  campus?: boolean;
  /** Bảng có cột week_id hay không. */
  week?: boolean;
}

/**
 * Dựng mệnh đề WHERE theo phạm vi.
 *
 * Quy tắc giữ nguyên ngữ nghĩa bản gốc:
 *   • NULL nghĩa là "áp dụng cho mọi giá trị" → luôn được lấy.
 *   • "all" ở phía người dùng nghĩa là không lọc theo trường đó.
 */
export function scopeWhere(
  scope: ScopeQuery,
  options: ScopeWhereOptions = {},
): Record<string, unknown> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (scope.yearId) where.schoolYearId = scope.yearId;

  if (options.semester && scope.semesterId && scope.semesterId !== 'all') {
    where.OR = [{ semesterId: null }, { semesterId: scope.semesterId }];
  }

  if (options.campus && scope.campusId && scope.campusId !== 'all') {
    const campusClause = [{ campusId: null }, { campusId: scope.campusId }];
    // Không ghi đè OR đã có: gộp cả hai điều kiện bằng AND.
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: campusClause }];
      delete where.OR;
    } else {
      where.OR = campusClause;
    }
  }

  if (options.week && scope.weekId) where.weekId = scope.weekId;

  return where;
}
