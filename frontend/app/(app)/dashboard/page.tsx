'use client';

import {
  AlarmClock,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DatabaseBackup,
  FileBarChart,
  ListChecks,
  Plus,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { cx, fmtDate, fmtDateTime } from '@/lib/format';
import type { DashboardPayload } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHead,
  ProgressBar,
  Skeleton,
  Split,
  StatCard,
  StatusBadge,
} from '@/components/ui';

/** Khung xương của trang trong lúc tải — giữ bố cục ổn định, không giật. */
function DashboardSkeleton() {
  return (
    <div aria-busy>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card p-3.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="mt-3 h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton lines={5} />
        </div>
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const scope = useScope();
  const { data, loading, error, refetch } = useApiQuery<DashboardPayload>(
    scope.ready && scope.yearId ? '/analytics/dashboard' : null,
    scope.query,
  );

  if (loading && !data) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { kpis } = data;
  const needsAttention = kpis.overdue + kpis.dueToday + kpis.classesMissingScores;

  return (
    <>
      <PageHead
        eyebrow={`${scope.currentYear?.name ?? 'Chưa chọn năm học'} · ${scope.currentWeek?.name ?? 'Chưa chọn tuần'}`}
        title="Tổng quan"
        description={
          needsAttention > 0
            ? `Có ${needsAttention} việc cần thầy cô xử lý trong phạm vi đang chọn.`
            : 'Không còn việc tồn đọng trong phạm vi đang chọn.'
        }
        actions={
          <>
            <Button
              icon={<FileBarChart size={15} aria-hidden />}
              onClick={() => router.push('/reports')}
            >
              Tạo báo cáo
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => router.push('/tasks?new=1')}
            >
              Thêm công việc
            </Button>
          </>
        }
      />

      {/*
        Sáu chỉ số ưu tiên theo mức độ cần hành động: quá hạn → hôm nay →
        sắp tới. Mỗi thẻ là một nút dẫn thẳng tới danh sách đã lọc sẵn nên
        người dùng đi được từ con số tới đúng bản ghi tạo ra con số đó.
        Mobile-first: 2 cột trên điện thoại → 3 cột từ 851px → 6 cột từ 1181px.
      */}
      <section aria-label="Chỉ số cần theo dõi">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            value={kpis.overdue}
            label="Việc quá hạn"
            hint={kpis.overdue > 0 ? 'Cần xử lý trước tiên' : 'Không còn việc quá hạn'}
            tone={kpis.overdue > 0 ? 'danger' : 'success'}
            icon={<AlarmClock size={17} aria-hidden />}
            onClick={() => router.push('/tasks?filter=overdue')}
          />
          <StatCard
            value={kpis.dueToday}
            label="Việc đến hạn hôm nay"
            hint="Hạn rơi đúng ngày hôm nay"
            tone={kpis.dueToday > 0 ? 'brand' : 'default'}
            icon={<ListChecks size={17} aria-hidden />}
            onClick={() => router.push('/tasks?filter=today')}
          />
          <StatCard
            value={kpis.soon}
            label="Sắp đến hạn 3 ngày"
            hint="Chuẩn bị trước để không dồn việc"
            tone={kpis.soon > 0 ? 'warning' : 'default'}
            icon={<CalendarClock size={17} aria-hidden />}
            onClick={() => router.push('/tasks?filter=soon')}
          />
          <StatCard
            value={kpis.upcomingEvents}
            label="Hoạt động sắp diễn ra"
            hint="Theo lịch hoạt động đã lập"
            tone="default"
            icon={<CalendarDays size={17} aria-hidden />}
            onClick={() => router.push('/calendar')}
          />
          <StatCard
            value={kpis.classesMissingScores}
            label="Lớp chưa nhập thi đua"
            hint="Trong tuần đang chọn"
            tone={kpis.classesMissingScores > 0 ? 'warning' : 'success'}
            icon={<ClipboardList size={17} aria-hidden />}
            onClick={() => router.push('/scores')}
          />
          <StatCard
            value={kpis.classesInApprovedSheet}
            label="Lớp thuộc bảng đã duyệt"
            hint="Số liệu đã chốt, dùng được cho báo cáo"
            tone="success"
            icon={<ShieldCheck size={17} aria-hidden />}
            onClick={() => router.push('/scores')}
          />
        </div>
      </section>

      {/* ── Hàng 2: việc cần xử lý (chính) + tiến độ tuần (phụ) ─────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead
            title="Việc cần xử lý"
            icon={<ListChecks size={16} aria-hidden />}
            meta={`${data.openTasks.length} việc đang mở`}
            actions={
              <Button
                size="sm"
                variant="ghost"
                iconRight={<ArrowUpRight size={14} aria-hidden />}
                onClick={() => router.push('/tasks')}
              >
                Tất cả
              </Button>
            }
          />
          <CardBody className="p-0">
            {data.openTasks.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<CheckCircle2 size={22} aria-hidden />}
                title="Không có việc khẩn"
                hint="Không còn công việc nào đang mở trong phạm vi đã chọn."
              />
            ) : (
              <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
                {data.openTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    <span
                      aria-hidden
                      className={cx(
                        'h-8 w-1 shrink-0 rounded-full',
                        task.overdue ? 'bg-danger-500' : 'bg-warning-500',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base font-semibold text-ink">
                        {task.title}
                      </strong>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {task.groupName || 'Công việc'} · {scope.campusName(task.campusId)}
                      </span>
                    </div>
                    <Badge tone={task.overdue ? 'red' : 'yellow'} dot className="shrink-0">
                      {task.overdue ? 'Quá hạn' : `Hạn ${fmtDate(task.dueDate)}`}
                    </Badge>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => router.push(`/tasks?edit=${task.id}`)}
                    >
                      Mở
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Tiến độ và dữ liệu" icon={<ShieldCheck size={16} aria-hidden />} />
          <CardBody>
            <div className="mb-3 rounded-md border border-line bg-neutral-25 p-3">
              <div className="flex items-end justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-600">Tiến độ công việc</span>
                <span className="text-2xl font-bold tabular-nums text-brand-700">
                  {data.progress.percent}%
                </span>
              </div>
              <ProgressBar
                value={data.progress.percent}
                className="mt-2"
                label={`Hoàn thành ${data.progress.done} trên ${data.progress.total} việc`}
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                Hoàn thành <strong className="text-ink">{data.progress.done}</strong> /{' '}
                {data.progress.total} việc trong phạm vi đang chọn.
              </p>
            </div>

            <Split label="Trạng thái bảng tuần">
              <StatusBadge value={data.sheetStatus} />
            </Split>
            <Split label="Lớp đã có dữ liệu">
              <span className="tabular-nums">
                {data.filledClasses}/{data.totalClasses}
              </span>
            </Split>
            <Split label="Sao lưu gần nhất">
              {data.lastBackupAt ? (
                fmtDateTime(data.lastBackupAt)
              ) : (
                <Badge tone="yellow" dot>
                  Chưa sao lưu
                </Badge>
              )}
            </Split>

            <Button
              size="sm"
              block
              className="mt-3"
              icon={<DatabaseBackup size={14} aria-hidden />}
              onClick={() => router.push('/backup')}
            >
              Sao lưu ngay
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* ── Hàng 3: lịch sắp tới + bảng xếp hạng tạm thời ───────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead
            title="Hoạt động sắp tới"
            icon={<CalendarDays size={16} aria-hidden />}
            meta="Theo lịch hoạt động"
            actions={
              <Button
                size="sm"
                variant="ghost"
                iconRight={<ArrowUpRight size={14} aria-hidden />}
                onClick={() => router.push('/calendar')}
              >
                Xem lịch
              </Button>
            }
          />
          <CardBody className="p-0">
            {data.upcoming.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<CalendarDays size={22} aria-hidden />}
                title="Chưa có hoạt động sắp tới"
                hint="Thêm sự kiện ở trang Lịch hoạt động để hiển thị tại đây."
                action={
                  <Button size="sm" onClick={() => router.push('/calendar?new=1')}>
                    Thêm sự kiện
                  </Button>
                }
              />
            ) : (
              <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
                {data.upcoming.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700"
                      aria-hidden
                    >
                      {fmtDate(event.date).slice(0, 5)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base font-semibold text-ink">
                        {event.title}
                      </strong>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {event.location || 'Chưa có địa điểm'} · {scope.campusName(event.campusId)}
                      </span>
                    </div>
                    {event.time ? (
                      <Badge tone="blue" className="shrink-0">
                        {event.time}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="5 lớp dẫn đầu"
            icon={<Trophy size={16} aria-hidden />}
            meta="Tạm thời"
          />
          <CardBody className="p-0">
            {data.topClasses.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<Trophy size={22} aria-hidden />}
                title="Chưa đủ dữ liệu xếp hạng"
                hint="Nhập điểm thi đua của tuần để xem bảng xếp hạng."
              />
            ) : (
              <>
                <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
                  {data.topClasses.map((row) => (
                    <li key={row.classId} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={cx(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums',
                          row.rank === 1
                            ? 'bg-warning-100 text-warning-700'
                            : row.rank <= 3
                              ? 'bg-brand-50 text-brand-700'
                              : 'bg-neutral-100 text-neutral-500',
                        )}
                      >
                        {row.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-base font-semibold text-ink">
                          {row.className}
                        </strong>
                        <span className="block truncate text-xs text-neutral-500">
                          {scope.campusName(row.campusId)}
                        </span>
                      </div>
                      <strong className="shrink-0 tabular-nums text-base text-ink">
                        {row.total.toFixed(1)}
                      </strong>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-line px-4 py-2 text-xs text-neutral-500">
                  Chỉ để theo dõi nội bộ; xếp hạng chính thức lấy từ bảng đã duyệt.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
