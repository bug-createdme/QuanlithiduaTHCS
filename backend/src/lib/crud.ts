import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit, describeRecord } from './audit';
import { notFound, revisionConflict } from './errors';
import { asyncHandler, created, noContent, ok, paginationSchema, parseOrThrow, toPageMeta } from './http';
import { prisma } from './prisma';
import { parseScope, scopeWhere, type ScopeWhereOptions } from './scope';
import { escapeLike, normalizeText, toCsv } from './text';
import { currentUserId, requireAuth, requireWrite } from '../middleware/auth';

/** Tên model Prisma dùng được với `prisma[name]`. */
type DelegateName = {
  [K in keyof typeof prisma]: (typeof prisma)[K] extends { findMany: unknown } ? K : never;
}[keyof typeof prisma];

interface Delegate {
  findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
  findFirst(args?: unknown): Promise<Record<string, unknown> | null>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
}

export interface CrudColumn {
  /** Khóa trường trong bản ghi. */
  key: string;
  /** Nhãn hiển thị/tiêu đề cột CSV — giữ nguyên tiếng Việt của bản gốc. */
  label: string;
}

export interface CrudOptions<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny> {
  /** Tên model Prisma, ví dụ 'plan'. */
  model: DelegateName;
  /** Tên bảng dùng trong nhật ký, ví dụ 'plans'. */
  entity: string;
  /** Nhãn tiếng Việt dùng trong thông báo lỗi. */
  label: string;
  createSchema: TCreate;
  updateSchema: TUpdate;
  /** Bảng có những cột phạm vi nào. */
  scope?: ScopeWhereOptions;
  /** Thứ tự sắp xếp mặc định. */
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  /** Các trường tìm kiếm tự do (LIKE không phân biệt hoa/thường). */
  searchFields?: string[];
  /** Cột xuất CSV; bỏ trống thì không mở điểm cuối /export. */
  columns?: CrudColumn[];
  /** Quan hệ nạp kèm khi lấy chi tiết. */
  include?: Record<string, unknown>;
  /** Biến đổi dữ liệu trước khi ghi (gắn schoolYearId, chuẩn hóa searchText…). */
  beforeWrite?: (
    data: Record<string, unknown>,
    context: { req: Request; existing: Record<string, unknown> | null },
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Kiểm tra quy tắc nghiệp vụ; ném AppError nếu vi phạm. */
  validate?: (
    data: Record<string, unknown>,
    context: { req: Request; existing: Record<string, unknown> | null },
  ) => Promise<void> | void;
}

const idSchema = z.object({ id: z.string().uuid('Mã bản ghi không hợp lệ.') });

const listQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(60).optional(),
  /** `true` để lấy toàn bộ (dùng cho xuất CSV và dropdown). */
  all: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
});

/**
 * Nhà máy sinh router CRUD chuẩn cho các thực thể đơn giản.
 * Bảy trang dùng chung renderEntity() ở bản gốc được ánh xạ qua đây,
 * nên không phải chép đi chép lại cùng một bộ handler.
 */
export function createCrudRouter<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny>(
  options: CrudOptions<TCreate, TUpdate>,
): Router {
  const router = Router();
  const delegate = prisma[options.model] as unknown as Delegate;
  const orderBy = options.orderBy ?? { updatedAt: 'desc' };

  const buildWhere = (req: Request, extra?: Record<string, unknown>): Record<string, unknown> => {
    const scope = parseScope(req.query);
    const where = scopeWhere(scope, options.scope ?? {});
    const query = parseOrThrow(listQuerySchema, req.query);

    const and: unknown[] = [];
    if (where.AND) and.push(...(where.AND as unknown[]));

    if (query.q && options.searchFields?.length) {
      const needle = escapeLike(query.q);
      and.push({
        OR: options.searchFields.map((field) => ({
          [field]: { contains: needle, mode: 'insensitive' },
        })),
      });
    }
    if (query.status) and.push({ status: query.status });
    if (extra) and.push(extra);

    if (and.length) {
      where.AND = and;
      if (where.OR && and.some((c) => (c as Record<string, unknown>).OR)) {
        // giữ nguyên: OR cấp trên và AND cùng tồn tại là hợp lệ trong Prisma
      }
    }
    return where;
  };

  const loadOrThrow = async (id: string): Promise<Record<string, unknown>> => {
    const row = await delegate.findFirst({ where: { id, deletedAt: null }, include: options.include });
    if (!row) throw notFound(options.label);
    return row;
  };

  // ── GET / — danh sách có phân trang, tìm kiếm, lọc ───────────────────────
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = parseOrThrow(listQuerySchema, req.query);
      const where = buildWhere(req);

      const total = await delegate.count({ where });
      const rows = await delegate.findMany({
        where,
        orderBy,
        ...(query.all ? {} : { skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      });

      return ok(res, rows, toPageMeta(total, query.page, query.all ? Math.max(total, 1) : query.pageSize));
    }),
  );

  // ── GET /export — CSV kèm BOM, an toàn trước CSV injection ───────────────
  if (options.columns?.length) {
    router.get(
      '/export',
      asyncHandler(async (req, res) => {
        const rows = await delegate.findMany({ where: buildWhere(req), orderBy });
        const columns = options.columns!;
        const csv = toCsv(
          columns.map((c) => c.label),
          rows.map((row) => columns.map((c) => row[c.key] ?? '')),
        );
        const filename = `${options.entity}-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csv);
      }),
    );
  }

  // ── GET /:id ─────────────────────────────────────────────────────────────
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idSchema, req.params);
      return ok(res, await loadOrThrow(id));
    }),
  );

  // ── POST / ───────────────────────────────────────────────────────────────
  router.post(
    '/',
    requireWrite,
    asyncHandler(async (req, res) => {
      let data = parseOrThrow(options.createSchema, req.body) as Record<string, unknown>;
      if (options.beforeWrite) data = await options.beforeWrite(data, { req, existing: null });
      await options.validate?.(data, { req, existing: null });

      const row = await delegate.create({ data });
      await writeAudit({
        action: 'create',
        entity: options.entity,
        entityId: row.id as string,
        summary: describeRecord(row),
        newValue: describeRecord(row),
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
      return created(res, row);
    }),
  );

  // ── PATCH /:id — có kiểm tra revision (optimistic locking) ───────────────
  router.patch(
    '/:id',
    requireWrite,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idSchema, req.params);
      const existing = await loadOrThrow(id);

      // Bản gốc ném RevisionConflictError khi revision không khớp.
      const clientRevision = req.body?.revision;
      if (clientRevision !== undefined && Number(clientRevision) !== Number(existing.revision)) {
        throw revisionConflict(Number(existing.revision));
      }

      let data = parseOrThrow(options.updateSchema, req.body) as Record<string, unknown>;
      if (options.beforeWrite) data = await options.beforeWrite(data, { req, existing });
      await options.validate?.(data, { req, existing });

      const row = await delegate.update({
        where: { id },
        data: { ...data, revision: { increment: 1 } },
      });
      await writeAudit({
        action: 'update',
        entity: options.entity,
        entityId: id,
        summary: describeRecord(row),
        oldValue: describeRecord(existing),
        newValue: describeRecord(row),
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
      return ok(res, row);
    }),
  );

  // ── DELETE /:id — xóa mềm, giữ tombstone như bản gốc ─────────────────────
  router.delete(
    '/:id',
    requireWrite,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idSchema, req.params);
      const existing = await loadOrThrow(id);

      await delegate.update({
        where: { id },
        data: { deletedAt: new Date(), revision: { increment: 1 } },
      });
      await writeAudit({
        action: 'delete',
        entity: options.entity,
        entityId: id,
        summary: describeRecord(existing),
        oldValue: describeRecord(existing),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : 'Người dùng xóa bản ghi',
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
      return noContent(res);
    }),
  );

  return router;
}

/** Toàn bộ router CRUD đều yêu cầu đăng nhập. */
export function protectedCrud<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny>(
  options: CrudOptions<TCreate, TUpdate>,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(createCrudRouter(options));
  return router;
}

/** Chuẩn hóa văn bản tìm kiếm cho các bảng có cột search_text. */
export const searchTextOf = normalizeText;
