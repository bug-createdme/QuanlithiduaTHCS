import type { Activity, CalendarEvent, Class, Task } from '@prisma/client';
import { addDays, localISO, toDbDate, today } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { scopeWhere, type ScopeQuery } from '../../lib/scope';
import { buildScoreContext, rankClasses, type RankedRow, type ScoreContext } from '../scores/score.service';

export interface AnalyticsScope extends ScopeQuery {
  yearId: string;
}

export interface ReportData {
  school: { name: string; code: string | null; reporter: string | null; reporterTitle: string } | null;
  week: { id: string; name: string; startDate: string; endDate: string } | null;
  campusName: string;
  tasks: Task[];
  completed: Task[];
  overdue: Task[];
  dueToday: Task[];
  soon: Task[];
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
  activities: Activity[];
  classes: Class[];
  context: ScoreContext | null;
  ranking: RankedRow[];
  officialRanking: boolean;
}

/**
 * Tập dữ liệu dùng chung cho Tổng quan, Báo cáo và Trợ lý.
 * Tương ứng reportData() của bản gốc, nhưng truy vấn ở tầng server.
 */
export async function collectReportData(scope: AnalyticsScope): Promise<ReportData> {
  const todayIso = today();
  const todayDate = toDbDate(todayIso)!;
  const soonDate = toDbDate(addDays(todayIso, 3))!;

  const taskWhere = scopeWhere(scope, { semester: true, campus: true });
  const eventWhere = scopeWhere(scope, { campus: true });
  const activityWhere = scopeWhere(scope, { campus: true });

  const [school, tasks, events, activities, classes, week] = await Promise.all([
    prisma.school.findFirst({ where: { deletedAt: null } }),
    prisma.task.findMany({ where: taskWhere, orderBy: { dueDate: 'asc' } }),
    prisma.calendarEvent.findMany({ where: eventWhere, orderBy: { date: 'asc' } }),
    prisma.activity.findMany({ where: activityWhere, orderBy: { date: 'desc' } }),
    prisma.class.findMany({
      where: {
        deletedAt: null,
        schoolYearId: scope.yearId,
        active: true,
        ...(scope.campusId && scope.campusId !== 'all' ? { campusId: scope.campusId } : {}),
      },
    }),
    scope.weekId
      ? prisma.schoolWeek.findFirst({ where: { id: scope.weekId, deletedAt: null } })
      : Promise.resolve(null),
  ]);

  const campus =
    scope.campusId && scope.campusId !== 'all'
      ? await prisma.campus.findFirst({ where: { id: scope.campusId, deletedAt: null } })
      : null;

  const open = tasks.filter((t) => t.status !== 'DONE');

  const context = scope.weekId
    ? await buildScoreContext({
        schoolYearId: scope.yearId,
        semesterId: scope.semesterId,
        campusId: scope.campusId,
        weekId: scope.weekId,
      })
    : null;

  const officialRanking = context?.sheet
    ? context.sheet.status === 'APPROVED' || context.sheet.status === 'LOCKED'
    : false;

  const ranking = context
    ? rankClasses(context.classes, context.criteria, context.entries, context.set)
    : [];

  return {
    school: school
      ? {
          name: school.name,
          code: school.code,
          reporter: school.reporter,
          reporterTitle: school.reporterTitle,
        }
      : null,
    week: week
      ? {
          id: week.id,
          name: week.name,
          startDate: localISO(week.startDate),
          endDate: localISO(week.endDate),
        }
      : null,
    campusName: campus?.name ?? 'Toàn trường',
    tasks,
    completed: tasks.filter((t) => t.status === 'DONE'),
    overdue: open.filter((t) => t.dueDate < todayDate),
    dueToday: open.filter((t) => localISO(t.dueDate) === todayIso),
    soon: open.filter((t) => t.dueDate > todayDate && t.dueDate <= soonDate),
    events,
    upcoming: events.filter((e) => e.date >= todayDate).slice(0, 10),
    activities,
    classes,
    context,
    ranking,
    officialRanking,
  };
}

export interface DashboardPayload {
  kpis: {
    dueToday: number;
    soon: number;
    overdue: number;
    upcomingEvents: number;
    classesMissingScores: number;
    classesInApprovedSheet: number;
  };
  openTasks: Array<Task & { overdue: boolean }>;
  upcoming: CalendarEvent[];
  topClasses: RankedRow[];
  progress: { done: number; total: number; percent: number };
  sheetStatus: string | null;
  filledClasses: number;
  totalClasses: number;
  lastBackupAt: string | null;
}

/** Sáu thẻ KPI và bốn thẻ nội dung của trang Tổng quan. */
export async function buildDashboard(scope: AnalyticsScope): Promise<DashboardPayload> {
  const data = await collectReportData(scope);
  const todayDate = toDbDate(today())!;

  const filled = new Set(data.context?.entries.map((e) => e.classId) ?? []);
  const missing = data.classes.filter((c) => !filled.has(c.id));
  const sheetApproved =
    data.context?.sheet?.status === 'APPROVED' || data.context?.sheet?.status === 'LOCKED';

  const lastBackup = await prisma.appSetting.findUnique({ where: { key: 'last_backup_at' } });

  const openTasks = [...data.overdue, ...data.dueToday, ...data.soon].slice(0, 7).map((t) => ({
    ...t,
    overdue: t.dueDate < todayDate,
  }));

  return {
    kpis: {
      dueToday: data.dueToday.length,
      soon: data.soon.length,
      overdue: data.overdue.length,
      upcomingEvents: data.upcoming.slice(0, 5).length,
      classesMissingScores: missing.length,
      classesInApprovedSheet: sheetApproved ? data.classes.length : 0,
    },
    openTasks,
    upcoming: data.upcoming.slice(0, 5),
    topClasses: data.ranking.slice(0, 5),
    progress: {
      done: data.completed.length,
      total: data.tasks.length,
      percent: data.tasks.length ? Math.round((data.completed.length / data.tasks.length) * 100) : 0,
    },
    sheetStatus: data.context?.sheet?.status ?? null,
    filledClasses: filled.size,
    totalClasses: data.classes.length,
    lastBackupAt: (lastBackup?.value as string | null) ?? null,
  };
}
