import { Router } from 'express';
import { z } from 'zod';
import { addDays, localISO, toDbDate, today } from '../../lib/dates';
import { asyncHandler, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { buildSearchText, escapeLike, normalizeText } from '../../lib/text';
import { requireAuth, requireWrite } from '../../middleware/auth';
import { buildDashboard, collectReportData, type AnalyticsScope } from './analytics.service';
import { QUICK_PROMPTS, answerQuestion } from './assistant.service';

const scopeSchema = z.object({
  yearId: z.string().uuid('Hãy chọn năm học.'),
  semesterId: z.union([z.string().uuid(), z.literal('all')]).optional(),
  weekId: z.string().uuid().optional(),
  campusId: z.union([z.string().uuid(), z.literal('all')]).optional(),
});

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

// ── Tổng quan ──────────────────────────────────────────────────────────────
analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const scope = parseOrThrow(scopeSchema, req.query) as AnalyticsScope;
    return ok(res, await buildDashboard(scope));
  }),
);

// ── Hôm nay ────────────────────────────────────────────────────────────────
analyticsRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    const scope = parseOrThrow(scopeSchema, req.query) as AnalyticsScope;
    const data = await collectReportData(scope);
    const todayIso = today();
    const todayDate = toDbDate(todayIso)!;

    const dayTasks = data.tasks.filter(
      (t) =>
        t.status !== 'DONE' &&
        (t.dueDate <= todayDate || (t.startDate && localISO(t.startDate) === todayIso)),
    );
    const dayEvents = data.events.filter((e) => localISO(e.date) === todayIso);

    return ok(res, {
      date: todayIso,
      tasks: dayTasks,
      events: dayEvents,
      waitingCount: data.tasks.filter((t) => t.status === 'WAITING').length,
      completedToday: data.tasks.filter(
        (t) => t.status === 'DONE' && localISO(t.updatedAt) === todayIso,
      ).length,
      remaining: dayTasks.length,
    });
  }),
);

// ── Tìm kiếm toàn cục ──────────────────────────────────────────────────────
analyticsRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, yearId } = parseOrThrow(
      z.object({
        q: z.string().trim().min(1, 'Hãy nhập từ khóa.').max(200),
        yearId: z.string().uuid(),
      }),
      req.query,
    );

    // `%` và `_` do người dùng gõ phải là ký tự thường, không phải ký tự đại diện.
    const like = { contains: escapeLike(q), mode: 'insensitive' as const };
    const base = { deletedAt: null, schoolYearId: yearId };
    const take = 8;

    // Hồ sơ tra trên cột search_text đã bỏ dấu — giống hệt trang Hồ sơ, để cùng
    // một từ khóa không cho hai kết quả khác nhau ở hai chỗ.
    const documentWhere = {
      ...base,
      searchText: { contains: escapeLike(normalizeText(q)) },
    };

    const [tasks, activities, classes, documents, plans, events] = await Promise.all([
      prisma.task.findMany({ where: { ...base, title: like }, take }),
      prisma.activity.findMany({ where: { ...base, name: like }, take }),
      prisma.class.findMany({ where: { ...base, className: like }, take }),
      prisma.document.findMany({ where: documentWhere, take }),
      prisma.plan.findMany({ where: { ...base, name: like }, take }),
      prisma.calendarEvent.findMany({ where: { ...base, title: like }, take }),
    ]);

    return ok(res, {
      groups: [
        { page: 'tasks', label: 'Công việc', items: tasks.map((t) => ({ id: t.id, text: t.title })) },
        { page: 'activities', label: 'Hoạt động Đội', items: activities.map((a) => ({ id: a.id, text: a.name })) },
        { page: 'scores', label: 'Lớp', items: classes.map((c) => ({ id: c.id, text: c.className })) },
        { page: 'documents', label: 'Hồ sơ', items: documents.map((d) => ({ id: d.id, text: d.name })) },
        { page: 'plans', label: 'Kế hoạch', items: plans.map((p) => ({ id: p.id, text: p.name })) },
        { page: 'calendar', label: 'Lịch hoạt động', items: events.map((e) => ({ id: e.id, text: e.title })) },
      ].filter((group) => group.items.length > 0),
    });
  }),
);

// ── Trợ lý tổng hợp ────────────────────────────────────────────────────────
analyticsRouter.get(
  '/assistant/prompts',
  asyncHandler(async (_req, res) => ok(res, QUICK_PROMPTS)),
);

analyticsRouter.post(
  '/assistant/ask',
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(scopeSchema.extend({ question: z.string().max(500) }), req.body);
    const { question, ...scope } = body;
    return ok(res, await answerQuestion(question, scope as AnalyticsScope));
  }),
);

// ── Ghi nhận nhanh: lưu vào hồ sơ, KHÔNG tác động điểm thi đua ─────────────
analyticsRouter.post(
  '/quick-note',
  // Ghi nhận nhanh tạo bản ghi hồ sơ thật, nên phải chặn tài khoản chỉ xem
  // đúng như mọi điểm cuối ghi khác.
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      z.object({
        schoolYearId: z.string().uuid(),
        campusId: z.string().uuid().nullish(),
        kind: z.enum(['note', 'incident']).default('note'),
        subject: z.string().trim().max(100).optional(),
        type: z.string().trim().max(80).default('Ghi chú'),
        description: z.string().trim().min(1, 'Hãy nhập nội dung.').max(1000),
      }),
      req.body,
    );

    const name =
      body.kind === 'incident'
        ? `${body.type}: ${body.subject ?? 'Ghi nhận'}`
        : `Ghi chú ngày ${localISO(new Date())}`;

    const document = await prisma.document.create({
      data: {
        schoolYearId: body.schoolYearId,
        campusId: body.campusId ?? null,
        name,
        type: body.kind === 'incident' ? 'Ghi nhận nhanh' : 'Ghi chú',
        date: toDbDate(today()),
        description: body.description,
        status: 'DRAFT',
        // Phải dùng buildSearchText như mọi đường ghi hồ sơ khác. Chỉ toLowerCase()
        // thì ghi nhận nhanh sẽ không hiện ra khi tìm bỏ dấu ở trang Hồ sơ.
        searchText: buildSearchText(name, body.description, body.type, body.subject),
      },
    });

    return res.status(201).json({
      data: document,
      // Thông điệp giữ nguyên tinh thần bản gốc: ghi nhận không tự sửa điểm.
      warnings: ['Ghi nhận này không tự động thay đổi bảng thi đua, đặc biệt khi bảng đã khóa.'],
    });
  }),
);

// ── Nhắc việc sắp tới (dùng cho chip trạng thái) ───────────────────────────
analyticsRouter.get(
  '/upcoming',
  asyncHandler(async (req, res) => {
    const scope = parseOrThrow(scopeSchema, req.query) as AnalyticsScope;
    const from = toDbDate(today())!;
    const to = toDbDate(addDays(today(), 7))!;

    const events = await prisma.calendarEvent.findMany({
      where: { deletedAt: null, schoolYearId: scope.yearId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      take: 20,
    });
    return ok(res, events);
  }),
);
