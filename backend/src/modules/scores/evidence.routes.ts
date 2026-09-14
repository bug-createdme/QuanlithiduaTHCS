import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalLongText, optionalUuid } from '../entities/entity.schemas';
import { assertSheetWritable } from './score.service';

/**
 * Minh chứng cho một ô điểm thi đua.
 *
 * Bảng `score_evidence` đã được ĐỌC từ trước: detectAnomalies() cảnh báo
 * "Thiếu minh chứng bắt buộc" cho các tiêu chí bật cờ `evidenceRequired`.
 * Nhưng chưa có điểm cuối nào GHI vào bảng này, nên cảnh báo đó không bao giờ
 * tắt được — bật cờ lên là mắc kẹt. Router này đóng vòng lặp đó lại.
 *
 * Sửa minh chứng cũng là sửa hồ sơ thi đua, nên đi qua đúng cửa khóa bảng
 * như mọi thao tác ghi điểm khác.
 */

const idSchema = z.object({ id: z.string().uuid('Mã bản ghi không hợp lệ.') });

const createSchema = z
  .object({
    scoreEntryId: z.string().uuid('Hãy chọn ô điểm.'),
    attachmentId: optionalUuid(),
    note: optionalLongText(),
  })
  .refine((value) => Boolean(value.attachmentId) || Boolean(value.note?.trim()), {
    message: 'Hãy chọn tệp minh chứng hoặc ghi chú giải trình.',
    path: ['note'],
  });

export const scoreEvidenceRouter = Router();
scoreEvidenceRouter.use(requireAuth);

/** Ô điểm phải tồn tại; trả kèm bảng tuần để kiểm tra khóa. */
async function loadEntry(scoreEntryId: string) {
  const entry = await prisma.scoreEntry.findFirst({
    where: { id: scoreEntryId, deletedAt: null },
    include: {
      class: { select: { className: true } },
      criterion: { select: { code: true, name: true, evidenceRequired: true } },
    },
  });
  if (!entry) throw notFound('Ô điểm');
  return entry;
}

// ── Danh sách minh chứng của một ô điểm ───────────────────────────────────
scoreEvidenceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { scoreEntryId } = parseOrThrow(
      z.object({ scoreEntryId: z.string().uuid('Thiếu mã ô điểm.') }),
      req.query,
    );
    const entry = await loadEntry(scoreEntryId);

    const evidence = await prisma.scoreEvidence.findMany({
      where: { scoreEntryId, deletedAt: null },
      include: {
        attachment: {
          select: { id: true, fileName: true, extension: true, size: true, mimeType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, {
      evidence: evidence.map((row) => ({
        ...row,
        // BigInt không tuần tự hóa được sang JSON.
        attachment: row.attachment ? { ...row.attachment, size: Number(row.attachment.size) } : null,
      })),
      entry: {
        id: entry.id,
        className: entry.class.className,
        criterionCode: entry.criterion.code,
        criterionName: entry.criterion.name,
        evidenceRequired: entry.criterion.evidenceRequired,
      },
    });
  }),
);

// ── Gắn minh chứng ────────────────────────────────────────────────────────
scoreEvidenceRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(createSchema, req.body);
    const entry = await loadEntry(body.scoreEntryId);
    await assertSheetWritable(entry.sheetId);

    if (body.attachmentId) {
      const attachment = await prisma.attachment.findFirst({
        where: { id: body.attachmentId, deletedAt: null },
      });
      if (!attachment) throw notFound('Tệp đính kèm');
    }

    const row = await prisma.scoreEvidence.create({
      data: {
        scoreEntryId: body.scoreEntryId,
        attachmentId: body.attachmentId,
        note: body.note,
      },
    });

    await writeAudit({
      action: 'create',
      entity: 'score_evidence',
      entityId: row.id,
      summary: `Gắn minh chứng: ${entry.class.className} | ${entry.criterion.code}`,
      newValue: body.note ?? body.attachmentId ?? null,
      reason: 'Bổ sung minh chứng thi đua',
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, row);
  }),
);

// ── Sửa ghi chú minh chứng ────────────────────────────────────────────────
scoreEvidenceRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const { note } = parseOrThrow(
      z.object({ note: z.string().trim().min(1, 'Hãy nhập ghi chú.').max(20_000) }),
      req.body,
    );

    const existing = await prisma.scoreEvidence.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Minh chứng');
    const entry = await loadEntry(existing.scoreEntryId);
    await assertSheetWritable(entry.sheetId);

    const row = await prisma.scoreEvidence.update({
      where: { id },
      data: { note, revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'update',
      entity: 'score_evidence',
      entityId: id,
      summary: `Sửa minh chứng: ${entry.class.className} | ${entry.criterion.code}`,
      oldValue: existing.note,
      newValue: note,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, row);
  }),
);

// ── Gỡ minh chứng ─────────────────────────────────────────────────────────
scoreEvidenceRouter.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.scoreEvidence.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Minh chứng');

    const entry = await loadEntry(existing.scoreEntryId);
    await assertSheetWritable(entry.sheetId);

    await prisma.scoreEvidence.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'delete',
      entity: 'score_evidence',
      entityId: id,
      summary: `Gỡ minh chứng: ${entry.class.className} | ${entry.criterion.code}`,
      oldValue: existing.note,
      reason: 'Người dùng gỡ minh chứng',
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);
