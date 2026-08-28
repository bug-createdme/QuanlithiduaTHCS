import { Prisma } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { badRequest } from './errors';

/**
 * Cột JSON của Prisma không nhận `null` trực tiếp — phải dùng `Prisma.DbNull`.
 * Helper này che khác biệt đó để các schema Zod cứ trả về null/undefined như bình thường.
 */
export function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

/** Bọc handler async để mọi promise reject đều rơi vào errorHandler. */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Bao dữ liệu theo một hình dạng nhất quán để frontend luôn đọc `data`. */
export function ok<T>(res: Response, data: T, meta?: PageMeta): Response {
  return res.json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

/** Chuyển lỗi Zod thành danh sách lỗi theo trường, dễ hiển thị cạnh input. */
export function zodIssues(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(gốc)',
    message: issue.message,
  }));
}

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest('Dữ liệu gửi lên không hợp lệ.', zodIssues(result.error));
  }
  return result.data;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export function toPageMeta(total: number, page: number, pageSize: number): PageMeta {
  return { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
