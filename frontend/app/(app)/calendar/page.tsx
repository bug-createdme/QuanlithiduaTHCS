'use client';

import { ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDate, toDateInput, todayISO } from '@/lib/format';
import { api } from '@/services/api';
import type { CalendarEvent } from '@/types';
import {
  Button,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHead,
  Select,
  TextArea,
  TextInput,
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
        title="Lịch hoạt động"
        description="Xem lịch tháng; cảnh báo thiếu địa điểm, phụ trách hoặc an toàn."
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
        <Button
          size="sm"
          aria-label="Tháng trước"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          <ChevronLeft size={15} aria-hidden />
        </Button>
        <strong className="text-[13px]">
          Tháng {month + 1}/{year}
        </strong>
        <Button size="sm" aria-label="Tháng sau" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          <ChevronRight size={15} aria-hidden />
        </Button>
        <Button size="sm" onClick={() => setCursor(new Date())}>
          Hôm nay
        </Button>
        <span className="ml-auto text-[12px] text-muted">
          {events.length} sự kiện trong phạm vi dữ liệu
        </span>
      </Toolbar>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {loading && !data ? <LoadingState /> : null}

      {!error && data ? (
        <div className="overflow-hidden rounded-card border border-line bg-card">
          <div className="grid grid-cols-7 border-b border-line bg-[#f7fafd]">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-1.5 text-center text-[11.5px] font-bold text-muted">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const iso = isoOf(cell);
              const outside = cell.getMonth() !== month;
              const dayEvents = byDate.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  className={cx(
                    'min-h-[92px] border-b border-r border-line p-1 last:border-r-0',
                    outside && 'bg-[#fafbfc] text-muted',
                    iso === today && 'bg-blue-soft',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cx('text-[12px] font-semibold', iso === today && 'text-blue')}>
                      {cell.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNew(iso)}
                      aria-label={`Thêm sự kiện ngày ${fmtDate(iso)}`}
                      className="text-muted opacity-0 transition-opacity hover:text-blue focus:opacity-100 group-hover:opacity-100 [div:hover>div>&]:opacity-100"
                    >
                      <Plus size={13} aria-hidden />
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openEdit(event)}
                        title={event.title}
                        className="block w-full truncate rounded-[4px] bg-blue px-1.5 py-[2px] text-left text-[11px] text-white hover:bg-blue-dark"
                      >
                        {event.time ? `${event.time} ` : ''}
                        {event.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Modal
        open={formOpen}
        title={editingId ? 'Cập nhật lịch' : 'Thêm lịch hoạt động'}
        onClose={() => setFormOpen(false)}
        wide
        footer={
          <>
            {editingId ? (
              <Button variant="danger" onClick={() => setDeleting(true)} className="mr-auto">
                Xóa
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
          <Field label="Tên sự kiện" required full>
            <TextInput
              value={values.title}
              onChange={(e) => setValues((c) => ({ ...c, title: e.target.value }))}
              maxLength={200}
            />
          </Field>
          <Field label="Ngày" required>
            <TextInput
              type="date"
              value={values.date}
              onChange={(e) => setValues((c) => ({ ...c, date: e.target.value }))}
            />
          </Field>
          <Field label="Giờ">
            <TextInput
              type="time"
              value={values.time}
              onChange={(e) => setValues((c) => ({ ...c, time: e.target.value }))}
            />
          </Field>
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
        description="Sự kiện sẽ được xóa mềm và vẫn còn trong nhật ký."
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
