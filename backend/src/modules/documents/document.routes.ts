import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env';
import { writeAudit } from '../../lib/audit';
import { toDbDate } from '../../lib/dates';
import { badRequest, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { buildSearchText, normalizeText } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalDate, optionalLongText, optionalText, optionalUuid } from '../entities/entity.schemas';

const idSchema = z.object({ id: z.string().uuid() });

/** Đúng danh sách phần mở rộng mà bản gốc chấp nhận. */
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.zip',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileBytes, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`Định dạng ${ext || 'không xác định'} không được phép tải lên.`));
      return;
    }
    cb(null, true);
  },
});

/** Ghi tệp xuống đĩa theo cây thư mục băm để không dồn quá nhiều tệp một chỗ. */
async function persistFile(buffer: Buffer, originalName: string): Promise<{
  storagePath: string;
  checksum: string;
  size: number;
}> {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(originalName).toLowerCase();
  const relative = path.join(checksum.slice(0, 2), checksum.slice(2, 4), `${checksum}${ext}`);
  const absolute = path.join(env.uploadDir, relative);

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);

  return { storagePath: relative, checksum, size: buffer.length };
}

const documentSchema = z.object({
  schoolYearId: z.string().uuid(),
  campusId: optionalUuid(),
  folderId: optionalUuid(),
  name: z.string().trim().min(1, 'Hãy nhập tên hồ sơ.').max(250),
  type: z.string().trim().min(1, 'Hãy chọn loại hồ sơ.').max(80),
  documentNo: optionalText(80),
  issuer: optionalText(150),
  date: optionalDate(),
  related: optionalText(200),
  tags: optionalText(250),
  description: optionalLongText(),
  status: z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']).default('DRAFT'),
  pinned: z.coerce.boolean().default(false),
});

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

// ── Thư mục ────────────────────────────────────────────────────────────────
documentsRouter.get(
  '/folders',
  asyncHandler(async (req, res) => {
    const { schoolYearId } = parseOrThrow(z.object({ schoolYearId: z.string().uuid() }), req.query);
    return ok(
      res,
      await prisma.documentFolder.findMany({
        where: { schoolYearId, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { documents: true } } },
      }),
    );
  }),
);

documentsRouter.post(
  '/folders',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        name: z.string().trim().min(1, 'Hãy nhập tên thư mục.').max(150),
        parentId: optionalUuid(),
      }),
      req.body,
    );
    return created(res, await prisma.documentFolder.create({ data: body }));
  }),
);

documentsRouter.delete(
  '/folders/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const folder = await prisma.documentFolder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) throw notFound('Thư mục');

    // Tài liệu bên trong chuyển về thư mục gốc thay vì bị xóa theo.
    await prisma.$transaction([
      prisma.document.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      prisma.documentFolder.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    return noContent(res);
  }),
);

// ── Danh sách tài liệu ─────────────────────────────────────────────────────
documentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        folderId: z.union([z.string().uuid(), z.literal('root'), z.literal('trash')]).default('root'),
        q: z.string().trim().max(200).optional(),
        fileType: z.enum(['all', 'pdf', 'image', 'office']).default('all'),
      }),
      req.query,
    );

    const trash = query.folderId === 'trash';
    const where: Record<string, unknown> = {
      schoolYearId: query.schoolYearId,
      ...(trash ? { deletedAt: { not: null } } : { deletedAt: null }),
    };

    if (!trash && query.folderId !== 'root') where.folderId = query.folderId;
    // Tìm kiếm bỏ dấu dựa trên cột search_text đã chuẩn hóa.
    if (query.q) where.searchText = { contains: normalizeText(query.q) };

    const documents = await prisma.document.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: {
        attachments: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    const filtered =
      query.fileType === 'all'
        ? documents
        : documents.filter((doc) => {
            const ext = doc.attachments[0]?.extension?.toLowerCase() ?? '';
            if (query.fileType === 'pdf') return ext === '.pdf';
            if (query.fileType === 'image') return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
            return ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext);
          });

    const totalSize = filtered.reduce(
      (sum, doc) => sum + Number(doc.attachments[0]?.size ?? 0n),
      0,
    );

    return ok(res, { documents: filtered, totalSize, count: filtered.length });
  }),
);

documentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const document = await prisma.document.findFirst({
      where: { id },
      include: {
        attachments: { where: { deletedAt: null }, orderBy: { version: 'desc' } },
        links: true,
        folder: true,
      },
    });
    if (!document) throw notFound('Hồ sơ');
    return ok(res, document);
  }),
);

// ── Tạo/sửa metadata ───────────────────────────────────────────────────────
documentsRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(documentSchema, req.body);
    const document = await prisma.document.create({
      data: {
        ...body,
        date: toDbDate(body.date),
        searchText: buildSearchText(body.name, body.tags, body.description, body.documentNo),
      },
    });
    await writeAudit({
      action: 'create',
      entity: 'documents',
      entityId: document.id,
      summary: document.name,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, document);
  }),
);

documentsRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Hồ sơ');

    const body = parseOrThrow(documentSchema.partial(), req.body);
    const merged = { ...existing, ...body };

    const document = await prisma.document.update({
      where: { id },
      data: {
        ...body,
        ...(body.date !== undefined ? { date: toDbDate(body.date) } : {}),
        searchText: buildSearchText(merged.name, merged.tags, merged.description, merged.documentNo),
        revision: { increment: 1 },
      },
    });
    return ok(res, document);
  }),
);

// ── Tải tệp lên (nhiều tệp cùng lúc) ───────────────────────────────────────
documentsRouter.post(
  '/upload',
  requireWrite,
  upload.array('files', 20),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw badRequest('Chưa chọn tệp nào để tải lên.');

    const body = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        campusId: optionalUuid(),
        folderId: optionalUuid(),
        type: z.string().trim().max(80).default('Hoạt động'),
      }),
      req.body,
    );
    const userId = currentUserId(req);

    const results = [];
    for (const file of files) {
      // Multer đọc tên tệp theo latin1; chuyển về UTF-8 để giữ dấu tiếng Việt.
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const stored = await persistFile(file.buffer, originalName);
      const extension = path.extname(originalName).toLowerCase();

      const document = await prisma.$transaction(async (tx) => {
        const row = await tx.document.create({
          data: {
            schoolYearId: body.schoolYearId,
            campusId: body.campusId,
            folderId: body.folderId,
            name: originalName,
            type: body.type,
            status: 'DRAFT',
            searchText: buildSearchText(originalName),
          },
        });
        await tx.attachment.create({
          data: {
            documentId: row.id,
            fileName: originalName,
            extension,
            mimeType: file.mimetype,
            size: BigInt(stored.size),
            checksum: stored.checksum,
            storagePath: stored.storagePath,
            version: 1,
            status: 'ACTIVE',
          },
        });
        return row;
      });

      results.push(document);
    }

    await writeAudit({
      action: 'document_upload',
      entity: 'documents',
      summary: `Tải lên ${results.length} tệp`,
      userId,
      ipAddress: req.ip,
    });
    return created(res, results);
  }),
);

// ── Thay phiên bản tệp ─────────────────────────────────────────────────────
documentsRouter.post(
  '/:id/versions',
  requireWrite,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    if (!req.file) throw badRequest('Chưa chọn tệp thay thế.');

    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: { attachments: { where: { deletedAt: null }, orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!document) throw notFound('Hồ sơ');

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const stored = await persistFile(req.file.buffer, originalName);
    const current = document.attachments[0];
    const nextVersionNumber = (current?.version ?? 0) + 1;

    const attachment = await prisma.$transaction(async (tx) => {
      if (current) {
        // Phiên bản cũ được lưu trữ lại chứ không xóa.
        await tx.fileVersion.create({
          data: {
            attachmentId: current.id,
            version: current.version,
            fileName: current.fileName,
            size: current.size,
            checksum: current.checksum,
            storagePath: current.storagePath,
            replacedAt: new Date(),
            replacedById: currentUserId(req),
          },
        });
        await tx.attachment.update({ where: { id: current.id }, data: { status: 'ARCHIVED' } });
      }

      return tx.attachment.create({
        data: {
          documentId: id,
          fileName: originalName,
          extension: path.extname(originalName).toLowerCase(),
          mimeType: req.file!.mimetype,
          size: BigInt(stored.size),
          checksum: stored.checksum,
          storagePath: stored.storagePath,
          version: nextVersionNumber,
          status: 'ACTIVE',
        },
      });
    });

    await writeAudit({
      action: 'document_version',
      entity: 'documents',
      entityId: id,
      summary: `Thay phiên bản tệp → v${nextVersionNumber}`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, attachment);
  }),
);

// ── Tải tệp về ─────────────────────────────────────────────────────────────
documentsRouter.get(
  '/attachments/:id/download',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const attachment = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment) throw notFound('Tệp đính kèm');

    const absolute = path.join(env.uploadDir, attachment.storagePath);
    try {
      await fs.access(absolute);
    } catch {
      logger.error({ attachmentId: id, absolute }, 'Tệp có metadata nhưng không tồn tại trên đĩa');
      throw notFound('Tệp trên đĩa');
    }

    res.setHeader('Content-Type', attachment.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    );
    return res.sendFile(absolute);
  }),
);

// ── Thùng rác: xóa mềm, khôi phục, xóa vĩnh viễn ───────────────────────────
documentsRouter.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Hồ sơ');

    await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({
      action: 'delete',
      entity: 'documents',
      entityId: id,
      summary: existing.name,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);

documentsRouter.post(
  '/:id/restore',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const document = await prisma.document.update({
      where: { id },
      data: { deletedAt: null, revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'document_restore',
      entity: 'documents',
      entityId: id,
      summary: document.name,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, document);
  }),
);

documentsRouter.delete(
  '/:id/purge',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const document = await prisma.document.findFirst({
      where: { id },
      include: { attachments: true },
    });
    if (!document) throw notFound('Hồ sơ');

    // Xóa tệp vật lý; thất bại thì ghi log chứ không chặn xóa bản ghi.
    for (const attachment of document.attachments) {
      try {
        await fs.unlink(path.join(env.uploadDir, attachment.storagePath));
      } catch (error) {
        logger.warn({ error, attachmentId: attachment.id }, 'Không xóa được tệp trên đĩa');
      }
    }

    await prisma.document.delete({ where: { id } });
    await writeAudit({
      action: 'document_purge',
      entity: 'documents',
      entityId: id,
      summary: `Xóa vĩnh viễn ${document.name}`,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);

// ── Ghim / bỏ ghim ─────────────────────────────────────────────────────────
documentsRouter.post(
  '/:id/pin',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { pinned } = parseOrThrow(z.object({ pinned: z.boolean() }), req.body);
    return ok(
      res,
      await prisma.document.update({ where: { id }, data: { pinned, revision: { increment: 1 } } }),
    );
  }),
);
