import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from './audit';
import { notFound, revisionConflict } from './errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from './http';
import { prisma } from './prisma';
import { currentUserId, requireAuth, requireWrite } from '../middleware/auth';

/**
 * Nhà máy sinh router cho các bảng CON — bảng luôn thuộc về một bản ghi cha
 * (chỉ tiêu của một kế hoạch, lượt mượn của một thiết bị, buổi bồi dưỡng của
 * một thành viên…).
 *
 * Khác `lib/crud.ts` ở ba điểm:
 *   • Danh sách LUÔN phải kèm mã bản ghi cha, không có chế độ xem toàn bộ.
 *   • Kiểm tra bản ghi cha tồn tại trước khi ghi, để không tạo bản ghi mồ côi.
 *   • Không phân trang, không xuất CSV — bảng con luôn hiển thị trọn trong
 *     ngăn chi tiết của bản ghi cha.
 *
 * Giữ nguyên các quy ước của dự án: xóa mềm, tăng `revision`, kiểm tra
 * revision khi sửa, ghi nhật ký kiểm toán cho mọi thao tác ghi.
 */

type DelegateName = {
  [K in keyof typeof prisma]: (typeof prisma)[K] extends { findMany: unknown } ? K : never;
}[keyof typeof prisma];

interface Delegate {
  findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
  findFirst(args?: unknown): Promise<Record<string, unknown> | null>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
}

export interface ChildCrudOptions<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny> {
  /** Model Prisma của bảng con, ví dụ 'planTarget'. */
  model: DelegateName;
  /** Tên bảng ghi vào nhật ký, ví dụ 'plan_targets'. */
  entity: string;
  /** Nhãn tiếng Việt dùng trong thông báo lỗi. */
  label: string;
  /** Tên cột khóa ngoại trỏ về bản ghi cha, ví dụ 'planId'. */
  parentKey: string;
  /** Model Prisma của bản ghi cha, dùng để kiểm tra tồn tại. */
  parentModel: DelegateName;
  /** Nhãn tiếng Việt của bản ghi cha. */
  parentLabel: string;
  createSchema: TCreate;
  updateSchema: TUpdate;
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  /** Quan hệ nạp kèm khi trả danh sách. */
  include?: Record<string, unknown>;
  /** Dòng mô tả ngắn ghi vào nhật ký. */
  describe: (row: Record<string, unknown>) => string;
  /** Biến đổi dữ liệu trước khi ghi (ép kiểu ngày, tính toán…). */
  beforeWrite?: (
    data: Record<string, unknown>,
    context: { req: Request; existing: Record<string, unknown> | null },
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Kiểm tra quy tắc nghiệp vụ; ném AppError nếu vi phạm. */
  validate?: (
    data: Record<string, unknown>,
    context: { req: Request; existing: Record<string, unknown> | null; parentId: string },
  ) => Promise<void> | void;
  /** Chặn xóa khi vi phạm quy tắc nghiệp vụ. */
  beforeDelete?: (row: Record<string, unknown>, context: { req: Request }) => Promise<void> | void;
}

const idSchema = z.object({ id: z.string().uuid('Mã bản ghi không hợp lệ.') });

export function childCrudRouter<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny>(
  options: ChildCrudOptions<TCreate, TUpdate>,
): Router {
  const router = Router();
  router.use(requireAuth);

  const delegate = prisma[options.model] as unknown as Delegate;
  const parentDelegate = prisma[options.parentModel] as unknown as Delegate;
  const orderBy = options.orderBy ?? { createdAt: 'asc' };

  /** Bản ghi cha phải tồn tại và chưa bị xóa mềm. */
  const assertParent = async (parentId: string): Promise<void> => {
    const parent = await parentDelegate.findFirst({ where: { id: parentId, deletedAt: null } });
    if (!parent) throw notFound(options.parentLabel);
  };

  const loadOrThrow = async (id: string): Promise<Record<string, unknown>> => {
    const row = await delegate.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound(options.label);
    return row;
  };

  // ── GET / — danh sách theo bản ghi cha ───────────────────────────────────
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = parseOrThrow(
        z.object({ [options.parentKey]: z.string().uuid(`Thiếu mã ${options.parentLabel.toLowerCase()}.`) }),
        req.query,
      );
      const parentId = query[options.parentKey] as string;
      await assertParent(parentId);

      return ok(
        res,
        await delegate.findMany({
          where: { [options.parentKey]: parentId, deletedAt: null },
          orderBy,
          include: options.include,
        }),
      );
    }),
  );

  // ── POST / ───────────────────────────────────────────────────────────────
  router.post(
    '/',
    requireWrite,
    asyncHandler(async (req, res) => {
      let data = parseOrThrow(options.createSchema, req.body) as Record<string, unknown>;
      const parentId = String(data[options.parentKey]);
      await assertParent(parentId);

      if (options.beforeWrite) data = await options.beforeWrite(data, { req, existing: null });
      await options.validate?.(data, { req, existing: null, parentId });

      const row = await delegate.create({ data });
      await writeAudit({
        action: 'create',
        entity: options.entity,
        entityId: row.id as string,
        summary: options.describe(row),
        newValue: options.describe(row),
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
      return created(res, row);
    }),
  );

  // ── PATCH /:id ───────────────────────────────────────────────────────────
  router.patch(
    '/:id',
    requireWrite,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idSchema, req.params);
      const existing = await loadOrThrow(id);

      const clientRevision = req.body?.revision;
      if (clientRevision !== undefined && Number(clientRevision) !== Number(existing.revision)) {
        throw revisionConflict(Number(existing.revision));
      }

      let data = parseOrThrow(options.updateSchema, req.body) as Record<string, unknown>;
      if (options.beforeWrite) data = await options.beforeWrite(data, { req, existing });
      await options.validate?.(data, {
        req,
        existing,
        parentId: String(existing[options.parentKey]),
      });

      const row = await delegate.update({
        where: { id },
        data: { ...data, revision: { increment: 1 } },
      });
      await writeAudit({
        action: 'update',
        entity: options.entity,
        entityId: id,
        summary: options.describe(row),
        oldValue: options.describe(existing),
        newValue: options.describe(row),
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
      return ok(res, row);
    }),
  );

  // ── DELETE /:id — xóa mềm, giữ vết trong nhật ký ─────────────────────────
  router.delete(
    '/:id',
    requireWrite,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(idSchema, req.params);
      const existing = await loadOrThrow(id);
      await options.beforeDelete?.(existing, { req });

      await delegate.update({
        where: { id },
        data: { deletedAt: new Date(), revision: { increment: 1 } },
      });
      await writeAudit({
        action: 'delete',
        entity: options.entity,
        entityId: id,
        summary: options.describe(existing),
        oldValue: options.describe(existing),
        reason: typeof req.body?.reason === 'string' ? req.body.reason : 'Người dùng xóa bản ghi',
        userId: currentUserId(req),
        ipAddress: req.ip,
      });
      return noContent(res);
    }),
  );

  return router;
}
