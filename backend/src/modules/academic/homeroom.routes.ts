import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { businessRule, conflict, notFound } from '../../lib/errors';
import { asyncHandler, created, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { normalizeText } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { optionalLongText, optionalText } from '../entities/entity.schemas';

/**
 * Danh sách giáo viên chủ nhiệm theo năm học.
 *
 * Lớp vẫn giữ cột `teacher` dạng văn bản tự do như bản gốc — đó là chủ ý ghi
 * rõ trong lược đồ. Bảng này là lớp chuẩn hóa TÙY CHỌN đặt bên cạnh: khai báo
 * giáo viên một lần rồi gán cho nhiều lớp, có số điện thoại và email để liên
 * hệ. Gán giáo viên sẽ đồng bộ luôn cột `teacher` để mọi báo cáo cũ vẫn đúng.
 */

const idSchema = z.object({ id: z.string().uuid('Mã bản ghi không hợp lệ.') });

const teacherSchema = z.object({
  schoolYearId: z.string().uuid('Hãy chọn năm học.'),
  fullName: z.string().trim().min(1, 'Hãy nhập họ và tên.').max(120),
  phone: optionalText(30),
  email: emptyEmail(),
  note: optionalLongText(),
});

/** Email để trống là hợp lệ; có nhập thì phải đúng dạng. */
function emptyEmail() {
  return z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().email('Email không đúng định dạng.').max(160).nullable(),
  );
}

/** Trùng tên trong cùng một năm học thì chặn, so sánh bỏ dấu như các nơi khác. */
async function assertNameUnique(
  schoolYearId: string,
  fullName: string,
  excludeId?: string,
): Promise<void> {
  const all = await prisma.homeroomTeacher.findMany({
    where: { schoolYearId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  const target = normalizeText(fullName);
  if (all.some((t) => t.id !== excludeId && normalizeText(t.fullName) === target)) {
    throw conflict('Giáo viên này đã có trong danh sách của năm học.');
  }
}

export const homeroomTeachersRouter = Router();
homeroomTeachersRouter.use(requireAuth);

// ── Danh sách ─────────────────────────────────────────────────────────────
homeroomTeachersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { schoolYearId } = parseOrThrow(
      z.object({ schoolYearId: z.string().uuid('Hãy chọn năm học.') }),
      req.query,
    );
    const teachers = await prisma.homeroomTeacher.findMany({
      where: { schoolYearId, deletedAt: null },
      orderBy: { fullName: 'asc' },
      include: {
        classes: {
          where: { deletedAt: null },
          select: { id: true, className: true },
          orderBy: { className: 'asc' },
        },
      },
    });
    return ok(res, teachers);
  }),
);

// ── Thêm ──────────────────────────────────────────────────────────────────
homeroomTeachersRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(teacherSchema, req.body);

    const year = await prisma.schoolYear.findFirst({
      where: { id: body.schoolYearId, deletedAt: null },
    });
    if (!year) throw notFound('Năm học');
    await assertNameUnique(body.schoolYearId, body.fullName);

    const row = await prisma.homeroomTeacher.create({ data: body });
    await writeAudit({
      action: 'create',
      entity: 'homeroom_teachers',
      entityId: row.id,
      summary: row.fullName,
      newValue: row.fullName,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return created(res, row);
  }),
);

// ── Sửa ───────────────────────────────────────────────────────────────────
homeroomTeachersRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.homeroomTeacher.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Giáo viên chủ nhiệm');

    const body = parseOrThrow(teacherSchema.partial().omit({ schoolYearId: true }), req.body);
    if (body.fullName) await assertNameUnique(existing.schoolYearId, body.fullName, id);

    const row = await prisma.homeroomTeacher.update({
      where: { id },
      data: { ...body, revision: { increment: 1 } },
    });

    // Đổi tên giáo viên thì cập nhật luôn cột teacher của các lớp đang gán,
    // để tên trên báo cáo không lệch với danh sách.
    if (body.fullName && body.fullName !== existing.fullName) {
      await prisma.class.updateMany({
        where: { homeroomTeacherId: id, deletedAt: null },
        data: { teacher: body.fullName },
      });
    }

    await writeAudit({
      action: 'update',
      entity: 'homeroom_teachers',
      entityId: id,
      summary: row.fullName,
      oldValue: existing.fullName,
      newValue: row.fullName,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, row);
  }),
);

// ── Xóa ───────────────────────────────────────────────────────────────────
homeroomTeachersRouter.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.homeroomTeacher.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Giáo viên chủ nhiệm');

    const assigned = await prisma.class.count({
      where: { homeroomTeacherId: id, deletedAt: null },
    });
    if (assigned > 0) {
      throw businessRule(
        `Giáo viên đang chủ nhiệm ${assigned} lớp. Hãy gỡ khỏi các lớp đó trước khi xóa.`,
        { assigned },
      );
    }

    await prisma.homeroomTeacher.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'delete',
      entity: 'homeroom_teachers',
      entityId: id,
      summary: existing.fullName,
      oldValue: existing.fullName,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);

// ── Gán / gỡ giáo viên cho một lớp ────────────────────────────────────────
homeroomTeachersRouter.post(
  '/assign',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        classId: z.string().uuid('Hãy chọn lớp.'),
        /** null nghĩa là gỡ giáo viên khỏi lớp. */
        homeroomTeacherId: z.string().uuid().nullable(),
      }),
      req.body,
    );

    const cls = await prisma.class.findFirst({ where: { id: body.classId, deletedAt: null } });
    if (!cls) throw notFound('Lớp');

    let teacherName: string | null = null;
    if (body.homeroomTeacherId) {
      const teacher = await prisma.homeroomTeacher.findFirst({
        where: { id: body.homeroomTeacherId, deletedAt: null },
      });
      if (!teacher) throw notFound('Giáo viên chủ nhiệm');
      if (teacher.schoolYearId !== cls.schoolYearId) {
        throw businessRule('Giáo viên và lớp phải thuộc cùng một năm học.');
      }
      teacherName = teacher.fullName;
    }

    const row = await prisma.class.update({
      where: { id: body.classId },
      data: {
        homeroomTeacherId: body.homeroomTeacherId,
        // Giữ cột văn bản đồng bộ; gỡ giáo viên thì trả ô đó về trống.
        teacher: teacherName,
        revision: { increment: 1 },
      },
    });

    await writeAudit({
      action: 'update',
      entity: 'classes',
      entityId: body.classId,
      summary: teacherName
        ? `Gán ${teacherName} chủ nhiệm ${cls.className}`
        : `Gỡ giáo viên chủ nhiệm khỏi ${cls.className}`,
      oldValue: cls.teacher,
      newValue: teacherName,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return ok(res, row);
  }),
);
