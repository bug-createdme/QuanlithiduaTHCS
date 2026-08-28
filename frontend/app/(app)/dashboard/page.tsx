'use client';

import { CalendarDays, FileBarChart, Plus } from 'lucide-react';
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
  ErrorState,
  LoadingState,
  PageHead,
  ProgressBar,
  Split,
  StatusBadge,
} from '@/components/ui';

/** Thẻ KPI — trong bản gốc mỗi thẻ là một nút dẫn tới trang đã lọc sẵn. */
function KpiCard({
  value,
  label,
  tone = 'default',
  onClick,
}: {
  value: number;
  label: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex flex-col items-start rounded-card border bg-card px-3.5 py-3 text-left shadow-card transition-colors hover:border-blue hover:bg-blue-soft',
        tone === 'warning' && 'border-yellow/40',
        tone === 'danger' && 'border-red/30',
        tone === 'success' && 'border-green/30',
        tone === 'default' && 'border-line',
      )}
    >
      <span
        className={cx(
          'text-[26px] font-black leading-none',
          tone === 'warning' && 'text-[#8a6100]',
          tone === 'danger' && 'text-red',
          tone === 'success' && 'text-green',
          tone === 'default' && 'text-blue',
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[12px] leading-snug text-muted">{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const scope = useScope();
  const { data, loading, error, refetch } = useApiQuery<DashboardPayload>(
    scope.ready && scope.yearId ? '/analytics/dashboard' : null,
    scope.query,
  );

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { kpis } = data;

  return (
    <>
      <PageHead
        title="Tổng quan"
        description="Thông tin cần hành động trong phạm vi đang chọn."
        actions={
          <>
            <Button icon={<FileBarChart size={15} aria-hidden />} onClick={() => router.push('/reports')}>
              Tạo báo cáo
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => router.push('/tasks?new=1')}
            >
              Công việc
            </Button>
          </>
        }
      />

      {/* Mobile-first: 2 cột trên điện thoại/tablet → 3 cột từ 851px → 6 cột từ 1181px. */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard value={kpis.dueToday} label="Việc hôm nay" onClick={() => router.push('/tasks?filter=today')} />
        <KpiCard
          value={kpis.soon}
          label="Sắp đến hạn trong 3 ngày"
          tone="warning"
          onClick={() => router.push('/tasks?filter=soon')}
        />
        <KpiCard
          value={kpis.overdue}
          label="Việc quá hạn"
          tone="danger"
          onClick={() => router.push('/tasks?filter=overdue')}
        />
        <KpiCard
          value={kpis.upcomingEvents}
          label="Hoạt động sắp diễn ra"
          onClick={() => router.push('/calendar')}
        />
        <KpiCard
          value={kpis.classesMissingScores}
          label="Lớp chưa nhập thi đua"
          tone="warning"
          onClick={() => router.push('/scores')}
        />
        <KpiCard
          value={kpis.classesInApprovedSheet}
          label="Lớp thuộc bảng đã duyệt"
          tone="success"
          onClick={() => router.push('/scores')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Việc cần xử lý" meta={`${data.openTasks.length} việc đang mở`} />
          <CardBody className="pt-2">
            {data.openTasks.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">
                Không có việc khẩn trong phạm vi đã chọn.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {data.openTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5 py-2">
                    <Badge tone={task.overdue ? 'red' : 'yellow'}>
                      {task.overdue ? 'Quá hạn' : fmtDate(task.dueDate)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px]">{task.title}</strong>
                      <small className="text-[11.5px] text-muted">
                        {task.groupName || 'Công việc'} • {scope.campusName(task.campusId)}
                      </small>
                    </div>
                    <Button size="sm" onClick={() => router.push(`/tasks?edit=${task.id}`)}>
                      Mở
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Tiến độ và dữ liệu" />
          <CardBody>
            <Split label="Tiến độ công việc">{data.progress.percent}%</Split>
            <ProgressBar value={data.progress.percent} className="mb-2 mt-1" />
            <Split label="Trạng thái bảng tuần">
              <StatusBadge value={data.sheetStatus} />
            </Split>
            <Split label="Lớp đã có dữ liệu">
              {data.filledClasses}/{data.totalClasses}
            </Split>
            <Split label="Sao lưu gần nhất">
              {data.lastBackupAt ? fmtDateTime(data.lastBackupAt) : 'Chưa sao lưu'}
            </Split>
            <Button size="sm" className="mt-2" onClick={() => router.push('/backup')}>
              Sao lưu ngay
            </Button>
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Hoạt động sắp tới" meta="Theo lịch" />
          <CardBody className="pt-2">
            {data.upcoming.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">Chưa có hoạt động sắp tới.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {data.upcoming.map((event) => (
                  <li key={event.id} className="flex items-center gap-2.5 py-2">
                    <Badge tone="blue">{fmtDate(event.date)}</Badge>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px]">{event.title}</strong>
                      <small className="text-[11.5px] text-muted">
                        {event.location || 'Chưa có địa điểm'} • {scope.campusName(event.campusId)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="5 lớp dẫn đầu tạm thời" meta="Chỉ để theo dõi nội bộ" />
          <CardBody className="pt-2">
            {data.topClasses.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">Chưa đủ dữ liệu để xếp hạng.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {data.topClasses.map((row) => (
                  <li key={row.classId} className="flex items-center gap-2.5 py-2">
                    <Badge tone={row.rank <= 3 ? 'yellow' : 'default'}>#{row.rank}</Badge>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px]">{row.className}</strong>
                      <small className="text-[11.5px] text-muted">{scope.campusName(row.campusId)}</small>
                    </div>
                    <strong className="text-[13px]">{row.total.toFixed(1)} điểm</strong>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          icon={<CalendarDays size={14} aria-hidden />}
          onClick={() => router.push('/calendar')}
        >
          Xem toàn bộ lịch
        </Button>
      </div>
    </>
  );
}
