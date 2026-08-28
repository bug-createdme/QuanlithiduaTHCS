import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { toDbDate } from '../../lib/dates';
import { notFound } from '../../lib/errors';
import { asyncHandler, noContent, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { parseScope, scopeWhere } from '../../lib/scope';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { calendarEventCreateSchema, calendarEventUpdateSchema } from '../entities/entity.schemas';

const idSchema = z.object({ id: z.string().uuid() });

/**
 * Cảnh báo mềm: thiếu địa điểm / phụ trách / checklist an toàn.
 * Bản gốc vẫn lưu bản ghi, chỉ hiện toast nhắc — giữ nguyên hành vi đó.
 */
function safetyWarnings(event: {
  location?: string | null;
  leader?: string | null;
  safety?: string | null;
}): string[] {
  const missing: string[] = [];
  if (!event.location) missing.push('địa điểm');
  if (!event.leader) missing.push('người phụ trách');
  if (!event.safety) missing.push('checklist an toàn');
  return missing.length ? [`Đã lưu; còn thiếu ${missing.join(', ')}.`] : [];
}

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

calendarRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = parseScope(req.query);
    const { from, to } = parseOrThrow(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
      req.query,
    );

    const where = scopeWhere(scope, { campus: true });
    if (from || to) {
      where.date = {
        ...(from ? { gte: toDbDate(from)! } : {}),
        ...(to ? { lte: toDbDate(to)! } : {}),
      };
    }

    return ok(
      res,
      await prisma.calendarEvent.findMany({
        where,
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        include: { campus: { select: { id: true, name: true } } },
      }),
    );
  }),
);

calendarRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const event = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
    if (!event) throw notFound('Sự kiện lịch');
    return ok(res, event);
  }),
);

calendarRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(calendarEventCreateSchema, req.body);
    const event = await prisma.calendarEvent.create({
      data: { ...body, date: toDbDate(body.date)! },
    });

    await writeAudit({
      action: 'create',
      entity: 'calendar_events',
      entityId: event.id,
      summary: event.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return res.status(201).json({ data: event, warnings: safetyWarnings(event) });
  }),
);

calendarRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Sự kiện lịch');

    const body = parseOrThrow(calendarEventUpdateSchema, req.body);
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...body,
        ...(body.date !== undefined ? { date: toDbDate(body.date)! } : {}),
        revision: { increment: 1 },
      },
    });

    await writeAudit({
      action: 'update',
      entity: 'calendar_events',
      entityId: id,
      summary: event.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return res.json({ data: event, warnings: safetyWarnings(event) });
  }),
);

calendarRouter.delete(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(idSchema, req.params);
    const existing = await prisma.calendarEvent.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Sự kiện lịch');

    await prisma.calendarEvent.update({
      where: { id },
      data: { deletedAt: new Date(), revision: { increment: 1 } },
    });
    await writeAudit({
      action: 'delete',
      entity: 'calendar_events',
      entityId: id,
      summary: existing.title,
      userId: currentUserId(req),
      ipAddress: req.ip,
    });
    return noContent(res);
  }),
);

export { safetyWarnings };
