'use client';

import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  ListTodo,
  NotebookPen,
  Plus,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { fmtDate } from '@/lib/format';
import { api } from '@/services/api';
import type { TodayPayload } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  CardSkeleton,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  PageHead,
  Select,
  StatCard,
  StatusBadge,
  TextArea,
  TextInput,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

/** Checklist trực tuần — trong bản gốc đây là 3 ô tick tĩnh, không lưu dữ liệu. */
const DUTY_CHECKLIST = [
  'Kiểm tra khu vực trực',
  'Ghi nhận nề nếp đầu giờ',
  'Rà soát minh chứng',
];

const INCIDENT_TYPES = ['Ghi chú', 'Điểm cộng đề xuất', 'Điểm trừ đề xuất', 'Chờ phối hợp'];

export default function TodayPage() {
  const scope = useScope();
  const router = useRouter();
  const { toast, toastError } = useToast();
  const { data, loading, error, refetch } = useApiQuery<TodayPayload>(
    scope.ready && scope.yearId ? '/analytics/today' : null,
    scope.query,
  );

  const [duty, setDuty] = useState<boolean[]>(() => DUTY_CHECKLIST.map(() => false));
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [incident, setIncident] = useState({ subject: '', type: INCIDENT_TYPES[0]!, description: '' });
  const [savingIncident, setSavingIncident] = useState(false);

  const toggleTask = async (taskId: string, done: boolean) => {
    try {
      await api.patch(`/tasks/${taskId}`, {
        status: done ? 'DONE' : 'DOING',
        ...(done ? { progress: 100 } : {}),
      });
      toast('Đã cập nhật công việc');
      void refetch();
    } catch (err) {
      toastError(err);
    }
  };

  const saveNote = async () => {
    const value = note.trim();
    if (!value) {
      toast('Hãy nhập nội dung ghi chú.', 'bad');
      return;
    }
    setSavingNote(true);
    try {
      await api.post('/analytics/quick-note', {
        schoolYearId: scope.yearId,
        campusId: scope.campusId === 'all' ? null : scope.campusId,
        kind: 'note',
        description: value,
      });
      setNote('');
      toast('Đã lưu ghi chú');
    } catch (err) {
      toastError(err);
    } finally {
      setSavingNote(false);
    }
  };

  const saveIncident = async () => {
    if (!incident.subject.trim() || !incident.description.trim()) {
      toast('Hãy nhập lớp/khu vực và nội dung ghi nhận.', 'bad');
      return;
    }
    setSavingIncident(true);
    try {
      await api.post('/analytics/quick-note', {
        schoolYearId: scope.yearId,
        campusId: scope.campusId === 'all' ? null : scope.campusId,
        kind: 'incident',
        subject: incident.subject.trim(),
        type: incident.type,
        description: incident.description.trim(),
      });
      setIncidentOpen(false);
      setIncident({ subject: '', type: INCIDENT_TYPES[0]!, description: '' });
      toast('Đã lưu ghi nhận, chưa tác động điểm thi đua');
    } catch (err) {
      toastError(err);
    } finally {
      setSavingIncident(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  /*
   * `/analytics/today` trả về những việc CHƯA xong có hạn ≤ hôm nay (hoặc bắt đầu
   * hôm nay), và `remaining` chính là số lượng của danh sách đó. Vì vậy không
   * dựng hai thẻ riêng cho cùng một con số; thay vào đó tách phần quá hạn ra
   * để thầy cô biết việc nào phải xử lý trước.
   */
  const overdueCount = data.tasks.filter(
    (task) => task.dueDate.slice(0, 10) < data.date,
  ).length;

  return (
    <>
      <PageHead
        eyebrow={`Ngày ${fmtDate(data.date)}`}
        title="Hôm nay"
        description="Tập trung vào việc phải làm, lịch trong ngày và những ghi nhận tại chỗ."
        actions={
          <>
            <Button
              icon={<ClipboardCheck size={15} aria-hidden />}
              onClick={() => setFinishOpen(true)}
            >
              Kết thúc ngày
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => setIncidentOpen(true)}
            >
              Ghi nhận nhanh
            </Button>
          </>
        }
      />

      {/* ── Tóm tắt trong ngày ───────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          value={data.tasks.length}
          label="Việc phải làm hôm nay"
          hint="Gồm cả việc tồn đọng từ trước"
          tone={data.tasks.length > 0 ? 'brand' : 'success'}
          icon={<ListTodo size={17} aria-hidden />}
        />
        <StatCard
          value={overdueCount}
          label="Trong đó đã quá hạn"
          hint={overdueCount > 0 ? 'Cần xử lý trước tiên' : 'Không có việc nào trễ hạn'}
          tone={overdueCount > 0 ? 'danger' : 'success'}
          icon={<Flag size={17} aria-hidden />}
          onClick={() => router.push('/tasks?filter=overdue')}
        />
        <StatCard
          value={data.completedToday}
          label="Đã hoàn thành hôm nay"
          hint="Đánh dấu xong trong ngày"
          tone="success"
          icon={<CheckCircle2 size={17} aria-hidden />}
        />
        <StatCard
          value={data.waitingCount}
          label="Đang chờ phối hợp"
          hint="Chờ đơn vị khác phản hồi"
          tone={data.waitingCount > 0 ? 'warning' : 'default'}
          icon={<Users size={17} aria-hidden />}
          onClick={() => router.push('/tasks')}
        />
      </div>

      {/* ── Việc và lịch ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Việc phải làm"
            icon={<ListTodo size={16} aria-hidden />}
            meta={fmtDate(data.date)}
          />
          <CardBody className="p-0">
            {data.tasks.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<CheckCircle2 size={22} aria-hidden />}
                title="Không có việc đến hạn hôm nay"
                hint="Mọi việc có hạn hôm nay đều đã được xử lý."
              />
            ) : (
              <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
                {data.tasks.map((task) => {
                  const done = task.status === 'DONE';
                  const overdue = !done && task.dueDate.slice(0, 10) < data.date;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => void toggleTask(task.id, e.target.checked)}
                        aria-label={`Đánh dấu hoàn thành: ${task.title}`}
                        className="h-[17px] w-[17px] shrink-0 cursor-pointer accent-brand-600"
                      />
                      <div className="min-w-0 flex-1">
                        <strong
                          className={`block truncate text-base font-semibold ${
                            done ? 'text-neutral-400 line-through' : 'text-ink'
                          }`}
                        >
                          {task.title}
                        </strong>
                        <span className="mt-0.5 block truncate text-xs text-neutral-500">
                          {task.groupName || 'Công việc'} · hạn {fmtDate(task.dueDate)}
                        </span>
                      </div>
                      <StatusBadge
                        className="shrink-0"
                        value={overdue ? 'OVERDUE' : task.status}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Lịch hôm nay"
            icon={<CalendarClock size={16} aria-hidden />}
            actions={
              <Button size="sm" variant="ghost" onClick={() => router.push('/calendar')}>
                Mở lịch
              </Button>
            }
          />
          <CardBody className="p-0">
            {data.events.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<CalendarClock size={22} aria-hidden />}
                title="Chưa có lịch trong ngày"
                hint="Thêm sự kiện ở trang Lịch hoạt động để theo dõi tại đây."
                action={
                  <Button size="sm" onClick={() => router.push('/calendar?new=1')}>
                    Thêm sự kiện
                  </Button>
                }
              />
            ) : (
              <ul className="m-0 list-none divide-y divide-neutral-100 p-0">
                {data.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    <Badge tone="blue" className="shrink-0">
                      {event.time || 'Cả ngày'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base font-semibold text-ink">
                        {event.title}
                      </strong>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {event.location || 'Chưa có địa điểm'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Công cụ tại chỗ ──────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Checklist trực tuần"
            icon={<ClipboardCheck size={16} aria-hidden />}
            meta={`${duty.filter(Boolean).length}/${DUTY_CHECKLIST.length}`}
          />
          <CardBody className="space-y-1">
            {DUTY_CHECKLIST.map((label, index) => (
              <Checkbox
                key={label}
                label={label}
                checked={duty[index]}
                onChange={(e) =>
                  setDuty((current) => current.map((v, i) => (i === index ? e.target.checked : v)))
                }
              />
            ))}
            <p className="pt-2 text-xs text-neutral-500">
              Danh sách nhắc việc trong phiên làm việc, không lưu vào cơ sở dữ liệu.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Ghi chú nhanh" icon={<NotebookPen size={16} aria-hidden />} />
          <CardBody>
            <TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nội dung cần nhớ trong ngày…"
              maxLength={1000}
              aria-label="Ghi chú nhanh trong ngày"
            />
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-400 tabular-nums">{note.length}/1000</span>
              <Button
                size="sm"
                variant="primary"
                loading={savingNote}
                icon={<NotebookPen size={14} aria-hidden />}
                onClick={() => void saveNote()}
              >
                Lưu ghi chú
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Hộp thoại ghi nhận nhanh ─────────────────────────────────── */}
      <Modal
        open={incidentOpen}
        title="Ghi nhận nhanh sự việc"
        description="Ghi lại tại chỗ để không quên; điểm thi đua vẫn do thầy cô nhập riêng."
        icon={<Plus size={18} aria-hidden />}
        onClose={() => setIncidentOpen(false)}
        footer={
          <>
            <Button onClick={() => setIncidentOpen(false)} disabled={savingIncident}>
              Hủy
            </Button>
            <Button variant="primary" loading={savingIncident} onClick={() => void saveIncident()}>
              Lưu ghi nhận
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Lớp/khu vực" required>
            <TextInput
              value={incident.subject}
              onChange={(e) => setIncident((c) => ({ ...c, subject: e.target.value }))}
              maxLength={100}
              placeholder="Ví dụ: 7A2, sân trước"
            />
          </Field>
          <Field label="Loại ghi nhận">
            <Select
              value={incident.type}
              onChange={(e) => setIncident((c) => ({ ...c, type: e.target.value }))}
            >
              {INCIDENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nội dung và lý do" required full>
            <TextArea
              value={incident.description}
              onChange={(e) => setIncident((c) => ({ ...c, description: e.target.value }))}
              maxLength={1000}
              placeholder="Mô tả sự việc, thời điểm và người liên quan…"
            />
          </Field>
        </div>
        <Notice tone="warn" className="mt-3.5">
          Ghi nhận này không tự động thay đổi bảng thi đua, đặc biệt khi bảng đã khóa.
        </Notice>
      </Modal>

      {/* ── Hộp thoại kết thúc ngày ──────────────────────────────────── */}
      <Modal
        open={finishOpen}
        title="Kết thúc ngày"
        icon={<ClipboardCheck size={18} aria-hidden />}
        onClose={() => setFinishOpen(false)}
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setFinishOpen(false);
              toast('Đã tổng kết công việc trong ngày.');
            }}
          >
            Đóng
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-line bg-success-50 p-3 text-center">
            <p className="m-0 text-3xl font-bold tabular-nums text-success-700">
              {data.completedToday}
            </p>
            <p className="m-0 mt-1 text-xs font-semibold text-success-700">Việc đã hoàn thành</p>
          </div>
          <div className="rounded-md border border-line bg-warning-50 p-3 text-center">
            <p className="m-0 text-3xl font-bold tabular-nums text-warning-700">{data.remaining}</p>
            <p className="m-0 mt-1 text-xs font-semibold text-warning-700">Việc còn lại</p>
          </div>
        </div>
        <Notice className="mt-3.5">
          Các việc chưa hoàn thành vẫn giữ nguyên hạn và được hiển thị ngày sau; hệ thống không tự
          sửa trạng thái.
        </Notice>
      </Modal>
    </>
  );
}
