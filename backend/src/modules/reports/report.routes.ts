import { Prisma, type ReportType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit';
import { localISO } from '../../lib/dates';
import { businessRule, immutable, notFound } from '../../lib/errors';
import { asyncHandler, created, ok, parseOrThrow } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { stableJson, toCsv } from '../../lib/text';
import { currentUserId, requireAuth, requireWrite } from '../../middleware/auth';
import { collectReportData, type AnalyticsScope } from '../analytics/analytics.service';
import { createSnapshot, sha256 } from '../backup/snapshot.service';

const scopeSchema = z.object({
  yearId: z.string().uuid('Hãy chọn năm học.'),
  semesterId: z.union([z.string().uuid(), z.literal('all')]).optional(),
  weekId: z.string().uuid().optional(),
  campusId: z.union([z.string().uuid(), z.literal('all')]).optional(),
});

const REPORT_TITLES: Record<ReportType, string> = {
  WEEK: 'BÁO CÁO CÔNG TÁC TUẦN',
  SCORES: 'TỔNG HỢP THI ĐUA LỚP',
  TASKS: 'BÁO CÁO TIẾN ĐỘ CÔNG VIỆC',
  ACTIVITIES: 'BÁO CÁO HOẠT ĐỘNG ĐỘI',
  EQUIPMENT: 'BÁO CÁO THIẾT BỊ ĐỘI',
  YEAR_SUMMARY: 'BÁO CÁO TỔNG KẾT NĂM HỌC',
};

const STATUS_LABEL: Record<string, string> = {
  TODO: 'Chưa làm',
  DOING: 'Đang làm',
  WAITING: 'Chờ phối hợp',
  REVIEW: 'Chờ duyệt',
  DONE: 'Hoàn thành',
  PAUSED: 'Tạm dừng',
  PLANNED: 'Dự kiến',
  ACTIVE: 'Đang thực hiện',
  FINISHED: 'Đã kết thúc',
};

const label = (value: string | null | undefined): string => STATUS_LABEL[value ?? ''] ?? value ?? '—';
const fmt = (date: Date | null | undefined): string =>
  date ? new Date(date).toLocaleDateString('vi-VN') : '—';

export interface ReportSection {
  heading?: string;
  paragraph?: string;
  table?: { head: string[]; rows: string[][] };
  notice?: { tone: 'warn' | 'info'; text: string };
}

export interface ReportPayload {
  title: string;
  schoolName: string;
  scopeLabel: string;
  generatedAt: string;
  sections: ReportSection[];
  signatures: [string, string];
}

/**
 * Dựng nội dung báo cáo dưới dạng dữ liệu có cấu trúc.
 * Bản gốc trả về chuỗi HTML; ở đây trả JSON để frontend render bằng React,
 * vừa an toàn hơn vừa giữ nguyên bố cục và câu chữ.
 */
async function buildReport(type: ReportType, scope: AnalyticsScope): Promise<ReportPayload> {
  const data = await collectReportData(scope);
  const sections: ReportSection[] = [];

  if (type === 'WEEK') {
    sections.push(
      { heading: 'I. Kết quả thực hiện' },
      {
        paragraph: `Đã hoàn thành ${data.completed.length}/${data.tasks.length} công việc; còn ${data.overdue.length} việc quá hạn.`,
      },
      {
        table: {
          head: ['Công việc', 'Trạng thái', 'Hạn'],
          rows: data.tasks.map((t) => [t.title, label(t.status), fmt(t.dueDate)]),
        },
      },
      { heading: 'II. Hoạt động và lịch sắp tới' },
      {
        table: {
          head: ['Hoạt động', 'Thời gian', 'Địa điểm'],
          rows: data.upcoming.map((e) => [e.title, fmt(e.date), e.location ?? 'Chưa cập nhật']),
        },
      },
      { heading: 'III. Kế hoạch tuần sau' },
      {
        paragraph:
          'Phần nhận xét/kế hoạch có thể bổ sung khi in; hệ thống không tự tạo số liệu ngoài dữ liệu nguồn.',
      },
    );
  }

  if (type === 'SCORES') {
    if (!data.officialRanking) {
      sections.push({
        notice: {
          tone: 'warn',
          text: 'Bảng tuần chưa được duyệt nên chưa có xếp hạng chính thức.',
        },
      });
    } else {
      sections.push({
        table: {
          head: ['Hạng', 'Lớp', 'Cơ sở', 'Tổng điểm'],
          rows: data.ranking.map((r) => [
            String(r.rank),
            r.className,
            data.campusName,
            r.total.toFixed(1),
          ]),
        },
      });
    }
  }

  if (type === 'TASKS') {
    sections.push({
      table: {
        head: ['Công việc', 'Nhóm', 'Cơ sở', 'Hạn', 'Trạng thái', 'Tiến độ'],
        rows: data.tasks.map((t) => [
          t.title,
          t.groupName ?? '',
          data.campusName,
          fmt(t.dueDate),
          label(t.status),
          `${t.progress}%`,
        ]),
      },
    });
  }

  if (type === 'ACTIVITIES') {
    sections.push({
      table: {
        head: ['Hoạt động', 'Nhóm', 'Ngày', 'Địa điểm', 'Trạng thái'],
        rows: data.activities.map((a) => [a.name, a.category, fmt(a.date), a.location, label(a.status)]),
      },
    });
  }

  if (type === 'EQUIPMENT') {
    const equipment = await prisma.equipment.findMany({
      where: {
        deletedAt: null,
        schoolYearId: scope.yearId,
        ...(scope.campusId && scope.campusId !== 'all' ? { campusId: scope.campusId } : {}),
      },
      orderBy: { code: 'asc' },
    });
    sections.push({
      table: {
        head: ['Mã', 'Thiết bị', 'Số lượng', 'Tình trạng', 'Nơi lưu'],
        rows: equipment.map((e) => [
          e.code,
          e.name,
          `${e.quantity} ${e.unit}`,
          e.condition,
          e.location ?? '—',
        ]),
      },
    });
  }

  return {
    title: REPORT_TITLES[type],
    schoolName: data.school?.name ?? 'TRƯỜNG THCS',
    scopeLabel: `${data.week?.name ?? 'Năm học'} • ${data.campusName}`,
    generatedAt: new Date().toISOString(),
    sections,
    signatures: ['Người lập báo cáo', 'Xác nhận của nhà trường'],
  };
}

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// ── Xem trước báo cáo ──────────────────────────────────────────────────────
reportsRouter.get(
  '/preview',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(
      scopeSchema.extend({
        type: z.enum(['WEEK', 'SCORES', 'TASKS', 'ACTIVITIES', 'EQUIPMENT']),
      }),
      req.query,
    );
    const { type, ...scope } = query;
    return ok(res, await buildReport(type, scope as AnalyticsScope));
  }),
);

// ── Danh sách phiên bản đã lưu ─────────────────────────────────────────────
reportsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { yearId } = parseOrThrow(z.object({ yearId: z.string().uuid() }), req.query);
    return ok(
      res,
      await prisma.generatedReport.findMany({
        where: { schoolYearId: yearId, deletedAt: null },
        orderBy: { generatedAt: 'desc' },
        take: 50,
        include: { createdBy: { select: { fullName: true } } },
      }),
    );
  }),
);

reportsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const report = await prisma.generatedReport.findFirst({ where: { id, deletedAt: null } });
    if (!report) throw notFound('Báo cáo');
    return ok(res, report);
  }),
);

// ── Lưu nháp hoặc chốt ─────────────────────────────────────────────────────
reportsRouter.post(
  '/',
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(
      scopeSchema.extend({
        type: z.enum(['WEEK', 'SCORES', 'TASKS', 'ACTIVITIES', 'EQUIPMENT']),
        status: z.enum(['DRAFT', 'FINALIZED']).default('DRAFT'),
        recipient: z.string().trim().max(200).optional(),
        submissionStatus: z.enum(['NOT_SUBMITTED', 'SUBMITTED', 'ACCEPTED']).default('NOT_SUBMITTED'),
        /** Chốt báo cáo bắt buộc tick xác nhận đã đối chiếu. */
        confirmed: z.coerce.boolean().default(false),
      }),
      req.body,
    );
    const { type, status, recipient, submissionStatus, confirmed, ...scope } = body;
    const userId = currentUserId(req);

    if (status === 'FINALIZED' && !confirmed) {
      throw businessRule('Cần xác nhận đã đối chiếu báo cáo trước khi chốt.');
    }

    const payload = await buildReport(type, scope as AnalyticsScope);
    const data = await collectReportData(scope as AnalyticsScope);

    const source = {
      type,
      scope,
      tasks: data.tasks,
      events: data.events,
      activities: data.activities,
      ranking: data.ranking,
    };

    const existing = await prisma.generatedReport.findMany({
      where: { schoolYearId: scope.yearId, type, deletedAt: null },
      select: { version: true },
    });
    const version = Math.max(0, ...existing.map((r) => r.version)) + 1;

    const report = await prisma.$transaction(
      async (tx) => {
        const row = await tx.generatedReport.create({
          data: {
            schoolYearId: scope.yearId,
            campusId: scope.campusId && scope.campusId !== 'all' ? scope.campusId : null,
            name: `${payload.title} - ${localISO(new Date())}`,
            type,
            version,
            status,
            immutable: status === 'FINALIZED',
            recipient: recipient ?? null,
            submissionStatus,
            filters: scope as unknown as Prisma.InputJsonValue,
            scope: scope as unknown as Prisma.InputJsonValue,
            contentHtml: null,
            contentText: JSON.stringify(payload),
            contentChecksum: sha256(stableJson(payload)),
            sourceChecksum: sha256(stableJson(source)),
            sourceRecordCount:
              data.tasks.length + data.events.length + data.activities.length + data.ranking.length,
            configSnapshot: {
              criteriaSetId: data.context?.set?.id ?? null,
              criteriaSetVersion: data.context?.set?.version ?? null,
              appVersion: '1.0.0',
            } as unknown as Prisma.InputJsonValue,
            generatedAt: new Date(),
            finalizedAt: status === 'FINALIZED' ? new Date() : null,
            createdById: userId,
          },
        });

        // Chốt báo cáo thì tạo điểm khôi phục bảo vệ, đúng bản gốc.
        if (status === 'FINALIZED') {
          await createSnapshot(
            {
              name: `Sau chốt báo cáo ${row.name}`,
              tier: 'PROTECTED',
              protectedSnapshot: true,
              reason: 'after-finalized-report',
              schoolYearId: scope.yearId,
              userId,
            },
            tx,
          );
        }
        return row;
      },
      { timeout: 180_000, maxWait: 30_000 },
    );

    await writeAudit({
      action: status === 'FINALIZED' ? 'report_finalize' : 'report_draft',
      entity: 'generated_reports',
      entityId: report.id,
      summary: `${report.name} v${version}`,
      userId,
      ipAddress: req.ip,
    });

    return created(res, report);
  }),
);

// ── Cập nhật: báo cáo đã chốt là bất biến ──────────────────────────────────
reportsRouter.patch(
  '/:id',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const existing = await prisma.generatedReport.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('Báo cáo');
    if (existing.immutable) {
      throw immutable(
        'Báo cáo đã chốt nên không sửa trực tiếp. Nếu số liệu thay đổi, hãy tạo và chốt phiên bản mới.',
      );
    }

    const body = parseOrThrow(
      z.object({
        recipient: z.string().trim().max(200).nullish(),
        submissionStatus: z.enum(['NOT_SUBMITTED', 'SUBMITTED', 'ACCEPTED']).optional(),
      }),
      req.body,
    );

    const report = await prisma.generatedReport.update({
      where: { id },
      data: { ...body, revision: { increment: 1 } },
    });
    return ok(res, report);
  }),
);

// ── Xuất CSV ───────────────────────────────────────────────────────────────
reportsRouter.get(
  '/export/csv',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(
      scopeSchema.extend({ type: z.enum(['WEEK', 'SCORES', 'TASKS', 'ACTIVITIES', 'EQUIPMENT']) }),
      req.query,
    );
    const { type, ...scope } = query;
    const data = await collectReportData(scope as AnalyticsScope);

    const csv =
      type === 'SCORES'
        ? toCsv(
            ['Hạng', 'Lớp', 'Cơ sở', 'Tổng điểm'],
            data.ranking.map((r) => [r.rank, r.className, data.campusName, r.total]),
          )
        : toCsv(
            ['Công việc', 'Nhóm', 'Cơ sở', 'Hạn', 'Trạng thái', 'Tiến độ'],
            data.tasks.map((t) => [
              t.title,
              t.groupName ?? '',
              data.campusName,
              localISO(t.dueDate),
              label(t.status),
              t.progress,
            ]),
          );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bao-cao-${type.toLowerCase()}-${localISO(new Date())}.csv"`,
    );
    return res.send(csv);
  }),
);

// ── Gói báo cáo chốt của năm ───────────────────────────────────────────────
reportsRouter.post(
  '/packages',
  requireWrite,
  asyncHandler(async (req, res) => {
    const { yearId } = parseOrThrow(z.object({ yearId: z.string().uuid() }), req.body);
    const userId = currentUserId(req);

    const year = await prisma.schoolYear.findFirst({ where: { id: yearId, deletedAt: null } });
    if (!year) throw notFound('Năm học');

    const reports = await prisma.generatedReport.findMany({
      where: { schoolYearId: yearId, status: 'FINALIZED', deletedAt: null },
      orderBy: { finalizedAt: 'asc' },
    });
    if (!reports.length) {
      throw businessRule('Chưa có báo cáo nào được chốt trong năm học này.');
    }

    const payload = { year: year.name, reports };
    const pkg = await prisma.reportPackage.create({
      data: {
        schoolYearId: yearId,
        name: `Gói báo cáo chốt ${year.name}`,
        checksum: sha256(stableJson(payload)),
        reportCount: reports.length,
        payload: payload as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await writeAudit({
      action: 'report_package',
      entity: 'report_packages',
      entityId: pkg.id,
      summary: `${pkg.name} (${reports.length} báo cáo)`,
      userId,
      ipAddress: req.ip,
    });
    return created(res, pkg);
  }),
);

reportsRouter.get(
  '/packages/list',
  asyncHandler(async (req, res) => {
    const { yearId } = parseOrThrow(z.object({ yearId: z.string().uuid() }), req.query);
    return ok(
      res,
      await prisma.reportPackage.findMany({
        where: { schoolYearId: yearId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
);
