import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { conflict, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { normalizeText } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalLongText } from '../entities/entity.schemas';
import { CONFIG_DEFINITIONS, CONFIG_COLORS, slugCode } from './config.defaults';

const idSchema = z.object({ id: z.string().uuid() });

const itemSchema = z.object({
  label: z.string().trim().min(1, 'Hãy nhập tên hiển thị.').max(150),
  code: z
    .string()
    .trim()
    .min(1, 'Hãy nhập mã duy nhất.')
    .max(60)
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ không dấu, số, gạch ngang hoặc gạch dưới.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải ở dạng #RRGGBB').default('#0b6bcb'),
  icon: z.string().trim().max(8).default('•'),
  sortOrder: z.coerce.number().int().default(99),
  description: optionalLongText(),
  active: z.coerce.boolean().default(true),
});

export const configRouter = Router();
configRouter.use(requireAuth);

// ── Danh sách danh mục (kèm mục con) ───────────────────────────────────────
configRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { keys, includeInactive } = parseOrThrow(
      z.object({
        /** Lọc theo nhiều key, ngăn bằng dấu phẩy. */
        keys: z.string().optional(),
        includeInactive: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      }),
      req.query,
    );

    const keyList = keys?.split(',').map((k) => k.trim()).filter(Boolean);

    const categories = await prisma.configCategory.findMany({
      where: { deletedAt: null, ...(keyList?.length ? { key: { in: keyList } } : {}) },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { deletedAt: null, ...(includeInactive ? {} : { active: true }) },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return ok(res, categories);
  }),
);

// ── Lấy nhanh các mục của một danh mục (dùng cho dropdown) ─────────────────
configRouter.get(
  '/items/:key',
  asyncHandler(async (req, res) => {
    const { key } = parseOrThrow(z.object({ key: z.string().max(60) }), req.params);
    const { includeInactive } = parseOrThrow(
      z.object({
        includeInactive: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      }),
      req.query,
    );
    return ok(
      res,
      await prisma.configItem.findMany({
        where: { categoryKey: key, deletedAt: null, ...(includeInactive ? {} : { active: true }) },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }),
);

// ── Thêm mục ───────────────────────────────────────────────────────────────
configRouter.post(
  '/categories/:key/items',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { key } = parseOrThrow(z.object({ key: z.string().max(60) }), req.params);
    const category = await prisma.configCategory.findFirst({ where: { key, deletedAt: null } });
    if (!category) throw notFound('Danh mục cấu hình');

    const body = parseOrThrow(itemSchema, req.body);
    const duplicate = await prisma.configItem.findFirst({
      where: { categoryId: category.id, deletedAt: null, code: { equals: body.code, mode: 'insensitive' } },
    });
    if (duplicate) throw conflict('Mã đã tồn tại trong danh mục.');

    const item = await prisma.configItem.create({
      data: {
        ...body,
        categoryId: category.id,
        categoryKey: key,
        searchText: normalizeText(body.label),
      },
    });
    return created(res, item);
  }),
);

// ── Sửa mục ────────────────────────────────────────────────────────────────
configRouter.patch(
  '/items/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.configItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Mục cấu hình');

    const body = parseOrThrow(itemSchema.partial(), req.body);
    if (body.code) {
      const duplicate = await prisma.configItem.findFirst({
        where: {
          categoryId: existing.categoryId,
          deletedAt: null,
          id: { not: id },
          code: { equals: body.code, mode: 'insensitive' },
        },
      });
      if (duplicate) throw conflict('Mã đã tồn tại trong danh mục.');
    }

    const item = await prisma.configItem.update({
      where: { id },
      data: {
        ...body,
        ...(body.label ? { searchText: normalizeText(body.label) } : {}),
        revision: { increment: 1 },
      },
    });
    return ok(res, item);
  }),
);

// ── Nhân bản mục ───────────────────────────────────────────────────────────
configRouter.post(
  '/items/:id/clone',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const source = await prisma.configItem.findFirst({ where: { id, deletedAt: null } });
    if (!source) throw notFound('Mục cấu hình');

    // Bảo đảm mã bản sao không trùng.
    let code = `${source.code}_copy`;
    let suffix = 2;
    while (
      await prisma.configItem.findFirst({
        where: { categoryId: source.categoryId, deletedAt: null, code },
      })
    ) {
      code = `${source.code}_copy${suffix++}`;
    }

    const label = `${source.label} – Bản sao`;
    const item = await prisma.configItem.create({
      data: {
        categoryId: source.categoryId,
        categoryKey: source.categoryKey,
        label,
        code,
        color: source.color,
        icon: source.icon,
        sortOrder: source.sortOrder + 1,
        description: source.description,
        active: source.active,
        isDefault: false,
        searchText: normalizeText(label),
      },
    });
    return created(res, item);
  }),
);

// ── Di chuyển thứ tự ───────────────────────────────────────────────────────
configRouter.post(
  '/items/:id/move',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { direction } = parseOrThrow(
      z.object({ direction: z.enum(['up', 'down']) }),
      req.body,
    );
    const item = await prisma.configItem.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw notFound('Mục cấu hình');

    const updated = await prisma.configItem.update({
      where: { id },
      data: {
        sortOrder: Math.max(1, item.sortOrder + (direction === 'up' ? -1 : 1)),
        revision: { increment: 1 },
      },
    });
    return ok(res, updated);
  }),
);

// ── Xóa mềm mục ────────────────────────────────────────────────────────────
configRouter.delete(
  '/items/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.configItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Mục cấu hình');

    await prisma.configItem.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    return noContent(res);
  }),
);

// ── Khôi phục mẫu mặc định ─────────────────────────────────────────────────
configRouter.post(
  '/categories/:key/restore-defaults',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { key } = parseOrThrow(z.object({ key: z.string().max(60) }), req.params);
    const definition = CONFIG_DEFINITIONS.find((d) => d[0] === key);
    if (!definition) throw notFound('Danh mục mẫu');

    const category = await prisma.configCategory.findFirst({ where: { key, deletedAt: null } });
    if (!category) throw notFound('Danh mục cấu hình');

    const existing = await prisma.configItem.findMany({ where: { categoryId: category.id } });
    let restored = 0;

    for (const [index, label] of definition[2].entries()) {
      const code = slugCode(label);
      const match = existing.find((item) => item.code === code);
      if (match) {
        // Bật lại mục mẫu đã bị tắt, giữ nguyên mọi mục do người dùng thêm.
        await prisma.configItem.update({
          where: { id: match.id },
          data: {
            label,
            active: true,
            deletedAt: null,
            sortOrder: index + 1,
            isDefault: true,
            searchText: normalizeText(label),
            revision: { increment: 1 },
          },
        });
      } else {
        await prisma.configItem.create({
          data: {
            categoryId: category.id,
            categoryKey: key,
            label,
            code,
            color: CONFIG_COLORS[index % CONFIG_COLORS.length]!,
            icon: '•',
            sortOrder: index + 1,
            active: true,
            isDefault: true,
            searchText: normalizeText(label),
          },
        });
      }
      restored += 1;
    }

    await writeAudit({
      action: 'config_restore_defaults',
      entity: 'config_items',
      summary: `Khôi phục ${restored} mục mẫu cho danh mục ${key}`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, { restored });
  }),
);

// ── Xuất / nhập toàn bộ cấu hình ───────────────────────────────────────────
configRouter.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.configCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { items: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    const customFields = await prisma.customFieldDefinition.findMany({ where: { deletedAt: null } });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cau-hinh-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return res.send(
      JSON.stringify({ format: 'TPT-CONFIG-1', exportedAt: new Date().toISOString(), categories, customFields }, null, 2),
    );
  }),
);

configRouter.post(
  '/import',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        format: z.literal('TPT-CONFIG-1', {
          errorMap: () => ({ message: 'Tệp cấu hình không đúng định dạng TPT-CONFIG-1.' }),
        }),
        categories: z.array(
          z.object({
            key: z.string().max(60),
            name: z.string().max(150),
            sortOrder: z.coerce.number().int().optional(),
            items: z.array(
              z.object({
                label: z.string().max(150),
                code: z.string().max(60),
                color: z.string().optional(),
                icon: z.string().optional(),
                sortOrder: z.coerce.number().int().optional(),
                description: z.string().nullish(),
                active: z.coerce.boolean().optional(),
              }),
            ),
          }),
        ),
      }),
      req.body,
    );

    let imported = 0;
    await prisma.$transaction(async (tx) => {
      for (const category of body.categories) {
        const existing = await tx.configCategory.findFirst({ where: { key: category.key } });
        const row =
          existing ??
          (await tx.configCategory.create({
            data: { key: category.key, name: category.name, sortOrder: category.sortOrder ?? 99 },
          }));

        for (const item of category.items) {
          await tx.configItem.upsert({
            where: { categoryId_code: { categoryId: row.id, code: item.code } },
            create: {
              categoryId: row.id,
              categoryKey: category.key,
              label: item.label,
              code: item.code,
              color: item.color ?? '#0b6bcb',
              icon: item.icon ?? '•',
              sortOrder: item.sortOrder ?? 99,
              description: item.description ?? null,
              active: item.active ?? true,
              searchText: normalizeText(item.label),
            },
            update: {
              label: item.label,
              color: item.color ?? undefined,
              icon: item.icon ?? undefined,
              sortOrder: item.sortOrder ?? undefined,
              description: item.description ?? undefined,
              active: item.active ?? undefined,
              deletedAt: null,
              searchText: normalizeText(item.label),
              revision: { increment: 1 },
            },
          });
          imported += 1;
        }
      }
    });

    await writeAudit({
      action: 'config_import',
      entity: 'config_items',
      summary: `Nhập ${imported} mục cấu hình`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, { imported });
  }),
);
