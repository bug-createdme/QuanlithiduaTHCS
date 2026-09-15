'use client';

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDate, toDateInput, todayISO } from '@/lib/format';
import { api } from '@/services/api';
import type { CalendarEvent } from '@/types';
import {
  Badge,
  Button,
  CardSkeleton,
  DateInput,
  ErrorState,
  Field,
  FormSection,
  IconButton,
  LoadingState,
  Notice,
  PageHead,
  Select,
  TextArea,
  TextInput,
  TimeInput,
  Toolbar,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

interface EventFormState {
  title: string;
  date: string;
  time: string;
  location: string;
  leader: string;
  campusId: string;
  category: string;
  reminderHours: string;
  safety: string;
}

const emptyEvent = (date: string, campusId: string): EventFormState => ({
  title: '',
  date,
  time: '',
  location: '',
  leader: '',
  campusId: campusId === 'all' ? '' : campusId,
  category: 'Hoạt động Đội',
  reminderHours: '24',
  safety: '',
});

/**
 * Lưới 42 ô (6 tuần × 7 ngày), tuần bắt đầu Thứ Hai —
 * giữ nguyên cách dựng lịch của renderCalendar() bản gốc.
 */
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = Chủ nhật. Công thức 1 - getDay() + 1 đưa về Thứ Hai đầu tuần.
  const start = new Date(year, month, 1 - first.getDay() + 1);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

const isoOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function CalendarPageInner() {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const searchParams = useSearchParams();

  const [cursor, setCursor] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<EventFormState>(() => emptyEvent(todayISO(), scope.campusId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildGrid(year, month), [year, month]);

  const range = useMemo(
    () => ({ from: isoOf(cells[0]!), to: isoOf(cells[cells.length - 1]!) }),
    [cells],
  );

  const { data, loading, error, refetch } = useApiQuery<CalendarEvent[]>(
    scope.ready && scope.yearId ? '/calendar' : null,
    { ...scope.query, ...range },
  );

  // Ổn định tham chiếu để useMemo bên dưới không tính lại mỗi lần render.
  const events = useMemo(() => data ?? [], [data]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingId(null);
      setValues(emptyEvent(todayISO(), scope.campusId));
      setFormOpen(true);
    }
  }, [searchParams, scope.campusId]);

  const openNew = (date?: string) => {
    setEditingId(null);
    setValues(emptyEvent(date ?? todayISO(), scope.campusId));
    setFormOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setValues({
      title: event.title,
      date: toDateInput(event.date),
      time: event.time ?? '',
      location: event.location ?? '',
      leader: event.leader ?? '',
      campusId: event.campusId ?? '',
      category: event.category,
      reminderHours: String(event.reminderHours),
      safety: event.safety ?? '',
    });
    setFormOpen(true);
  };

  const save = useCallback(async () => {
    if (!values.title.trim() || !values.date) {
      toast('Hãy nhập tên sự kiện và ngày tổ chức.', 'bad');
      return;
    }
    setSaving(true);
    const payload = {
      schoolYearId: scope.yearId,
      campusId: values.campusId || null,
      title: values.title.trim(),
      date: values.date,
      time: values.time || null,
      location: values.location || null,
      leader: values.leader || null,
      category: values.category,
      reminderHours: Number(values.reminderHours || 24),
      safety: values.safety || null,
    };

    try {
      // Backend trả `warnings` khi thiếu địa điểm/phụ trách/an toàn nhưng vẫn lưu.
      const response = await api.raw<{ data: CalendarEvent; warnings?: string[] }>(
        editingId ? `/calendar/${editingId}` : '/calendar',
        { method: editingId ? 'PATCH' : 'POST', body: payload },
      );
      const warnings = (response as unknown as { warnings?: string[] })?.warnings;
      const missing = !values.location || !values.leader || !values.safety;
      toast(
        missing
          ? (warnings?.[0] ?? 'Đã lưu; còn thiếu địa điểm, phụ trách hoặc checklist an toàn.')
          : 'Đã lưu lịch hoạt động',
        missing ? 'bad' : 'ok',
      );
      setFormOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  }, [values, scope.yearId, editingId, toast, toastError, refetch]);

  const remove = useCallback(async () => {
    if (!editingId) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/calendar/${editingId}`);
      toast('Đã xóa sự kiện');
      setDeleting(false);
      setFormOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setDeletingBusy(false);
    }
  }, [editingId, toast, toastError, refetch]);

  const today = todayISO();

  if (!scope.ready) return <LoadingState />;

  return (
    <>
      <PageHead
        eyebrow={`Tháng ${month + 1}/${year}`}
        title="Lịch hoạt động"
        description="Xem lịch theo tháng và cảnh báo sớm những sự kiện còn thiếu địa điểm, người phụ trách hoặc phương án an toàn."
        actions={
          <>
            <Button icon={<Printer size={15} aria-hidden />} onClick={() => window.print()}>
              In lịch
            </Button>
            <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={() => openNew()}>
              Sự kiện
            </Button>
          </>
        }
      />

      <Toolbar>
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            aria-label="Tháng trước"
            title="Tháng trước"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={15} aria-hidden />
          </IconButton>
          <strong className="min-w-[112px] text-center text-base tabular-nums text-ink">
            Tháng {month + 1}/{year}
          </strong>
          <IconButton
            size="sm"
            aria-label="Tháng sau"
            title="Tháng sau"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={15} aria-hidden />
          </IconButton>
        </div>

        <Button size="sm" onClick={() => setCursor(new Date())}>
          Về tháng này
        </Button>

        <span className="ml-auto whitespace-nowrap text-xs text-neutral-500">
          <strong className="tabular-nums text-ink">{events.length}</strong> sự kiện trong phạm vi
          dữ liệu
        </span>
      </Toolbar>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {loading && !data ? <CardSkeleton lines={8} /> : null}

      {!error && data ? (
        <div className="overflow-hidden rounded-lg border border-line bg-card shadow-xs">
          {/* Hàng tiêu đề thứ trong tuần — tuần bắt đầu từ Thứ Hai. */}
          <div className="grid grid-cols-7 border-b border-line bg-neutral-50">
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                className={cx(
                  'px-2 py-2 text-center text-2xs font-bold uppercase tracking-[0.05em]',
                  index >= 5 ? 'text-brand-600' : 'text-neutral-500',
                )}
              >
                <span className="mobile:hidden">{day}</span>
                <span className="hidden mobile:inline">{day.replace('Thứ ', 'T')}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell, index) => {
              const iso = isoOf(cell);
              const outside = cell.getMonth() !== month;
              const weekend = index % 7 >= 5;
              const isToday = iso === today;
              const dayEvents = byDate.get(iso) ?? [];
              // Giới hạn 3 sự kiện hiển thị để ô ngày không cao vồng lên.
              const visible = dayEvents.slice(0, 3);
              const hidden = dayEvents.length - visible.length;

              return (
                <div
                  key={iso}
                  className={cx(
                    'group relative min-h-[104px] border-b border-r border-line p-1.5 transition-colors mobile:min-h-[76px] [&:nth-child(7n)]:border-r-0',
                    outside ? 'bg-neutral-25' : weekend ? 'bg-brand-50/30' : 'bg-card',
                    isToday && 'bg-brand-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        'grid h-6 min-w-[24px] place-items-center rounded-full px-1 text-xs font-semibold tabular-nums',
                        isToday
                          ? 'bg-brand-600 text-white'
                          : outside
                            ? 'text-neutral-300'
                            : 'text-neutral-600',
                      )}
                    >
                      {cell.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNew(iso)}
                      aria-label={`Thêm sự kiện ngày ${fmtDate(iso)}`}
                      title={`Thêm sự kiện ngày ${fmtDate(iso)}`}
                      className="grid h-6 w-6 place-items-center rounded-sm text-neutral-400 opacity-0 transition-all hover:bg-brand-100 hover:text-brand-700 focus:opacity-100 group-hover:opacity-100 mobile:opacity-100"
                    >
                      <Plus size={13} aria-hidden />
                    </button>
                  </div>

                  <div className="mt-1 space-y-1">
                    {visible.map((event) => {
                      // Sự kiện thiếu thông tin bắt buộc được đánh dấu để xử lý sớm.
                      const incomplete = !event.location || !event.leader || !event.safety;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openEdit(event)}
                          title={`${event.title}${incomplete ? ' — còn thiếu thông tin' : ''}`}
                          className={cx(
                            'flex w-full items-center gap-1 rounded-sm border-l-[3px] px-1.5 py-[3px] text-left text-2xs font-medium transition-colors',
                            incomplete
                              ? 'border-warning-500 bg-warning-50 text-warning-700 hover:bg-warning-100'
                              : 'border-brand-600 bg-brand-50 text-brand-800 hover:bg-brand-100',
                          )}
                        >
                          {event.time ? (
                            <span className="shrink-0 tabular-nums opacity-75">{event.time}</span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{event.title}</span>
                        </button>
                      );
                    })}

                    {hidden > 0 ? (
                      <button
                        type="button"
                        onClick={() => openEdit(dayEvents[visible.length]!)}
                        className="w-full rounded-sm px-1.5 py-[2px] text-left text-2xs font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        +{hidden} sự kiện nữa
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chú giải màu — trạng thái không chỉ phân biệt bằng màu sắc. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line bg-neutral-25 px-3 py-2 text-2xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-1 rounded-sm bg-brand-600" />
              Sự kiện đã đủ thông tin
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-1 rounded-sm bg-warning-500" />
              Còn thiếu địa điểm, phụ trách hoặc phương án an toàn
            </span>
            <span className="flex items-center gap-1.5">
              <Badge tone="blue" className="px-1.5 py-0">
                Hôm nay
              </Badge>
              Ngày hiện tại được tô nền xanh nhạt
            </span>
          </div>
        </div>
      ) : null}

      <Modal
        open={formOpen}
        title={editingId ? 'Cập nhật lịch hoạt động' : 'Thêm lịch hoạt động'}
        description="Sự kiện theo ngày, kèm địa điểm, người phụ trách và phương án an toàn."
        icon={<CalendarPlus size={18} aria-hidden />}
        size="lg"
        onClose={() => setFormOpen(false)}
        footer={
          <>
            {editingId ? (
              <Button
                variant="ghost"
                icon={<Trash2 size={15} aria-hidden />}
                onClick={() => setDeleting(true)}
                className="mr-auto text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              >
                Xóa sự kiện
              </Button>
            ) : null}
            <Button onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <FormSection title="Thông tin sự kiện" />

          <Field label="Tên sự kiện" required full>
            <TextInput
              value={values.title}
              onChange={(e) => setValues((c) => ({ ...c, title: e.target.value }))}
              maxLength={200}
            />
          </Field>
          <Field label="Ngày" required>
            <DateInput
              value={values.date}
              onValueChange={(date) => setValues((c) => ({ ...c, date }))}
              required
            />
          </Field>
          <Field label="Giờ">
            <TimeInput
              value={values.time}
              onValueChange={(time) => setValues((c) => ({ ...c, time }))}
            />
          </Field>
          <FormSection title="Tổ chức và an toàn" />

          <Field label="Địa điểm">
            <TextInput
              value={values.location}
              onChange={(e) => setValues((c) => ({ ...c, location: e.target.value }))}
              maxLength={200}
            />
          </Field>
          <Field label="Người phụ trách">
            <TextInput
              value={values.leader}
              onChange={(e) => setValues((c) => ({ ...c, leader: e.target.value }))}
              maxLength={120}
            />
          </Field>
          <Field label="Cơ sở">
            <Select
              value={values.campusId}
              onChange={(e) => setValues((c) => ({ ...c, campusId: e.target.value }))}
            >
              <option value="">Toàn trường</option>
              {scope.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nhắc trước (giờ)">
            <TextInput
              type="number"
              min={0}
              value={values.reminderHours}
              onChange={(e) => setValues((c) => ({ ...c, reminderHours: e.target.value }))}
            />
          </Field>
          <Field
            label="Checklist an toàn"
            full
            hint="Hoạt động đông người nên ghi rõ phương án an toàn và dự phòng."
          >
            <TextArea
              value={values.safety}
              onChange={(e) => setValues((c) => ({ ...c, safety: e.target.value }))}
            />
          </Field>
        </div>

        {(!values.location || !values.leader || !values.safety) && values.title ? (
          <Notice tone="warn" className="mt-3">
            Còn thiếu địa điểm, người phụ trách hoặc checklist an toàn. Hệ thống vẫn cho lưu nhưng sẽ
            nhắc lại ở trang Trợ lý.
          </Notice>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting}
        title="Xóa sự kiện"
        loading={deletingBusy}
        confirmLabel="Xóa"
        description={
          <>
            <p className="m-0">
              Xóa sự kiện <strong className="text-ink">{values.title || 'đã chọn'}</strong> khỏi lịch?
            </p>
            <Notice tone="warn" className="mt-2.5">
              Sự kiện được xóa mềm và vẫn còn trong nhật ký hệ thống.
            </Notice>
          </>
        }
        onCancel={() => setDeleting(false)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarPageInner />
    </Suspense>
  );
}
