'use client';

import { CheckCircle2, NotebookPen, Plus } from 'lucide-react';
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
  Checkbox,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHead,
  Select,
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

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <>
      <PageHead
        title="Hôm nay"
        description="Tập trung công việc, lịch và ghi nhận nhanh trong ngày."
        actions={
          <>
            <Button onClick={() => setFinishOpen(true)}>Kết thúc ngày</Button>
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

      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Việc phải làm" meta={fmtDate(data.date)} />
          <CardBody className="pt-2">
            {data.tasks.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">
                Không có công việc đến hạn hôm nay.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {data.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={task.status === 'DONE'}
                      onChange={(e) => void toggleTask(task.id, e.target.checked)}
                      aria-label={`Đánh dấu hoàn thành: ${task.title}`}
                      className="h-[15px] w-[15px] shrink-0 accent-[#0b6bcb]"
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px]">{task.title}</strong>
                      <small className="text-[11.5px] text-muted">
                        {task.groupName || 'Công việc'} • hạn {fmtDate(task.dueDate)}
                      </small>
                    </div>
                    <StatusBadge
                      value={
                        task.status !== 'DONE' && task.dueDate.slice(0, 10) < data.date
                          ? 'OVERDUE'
                          : task.status
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Lịch hôm nay" />
          <CardBody className="pt-2">
            {data.events.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">Chưa có lịch trong ngày.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {data.events.map((event) => (
                  <li key={event.id} className="flex items-center gap-2.5 py-2">
                    <Badge tone="blue">{event.time || 'Cả ngày'}</Badge>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px]">{event.title}</strong>
                      <small className="text-[11.5px] text-muted">
                        {event.location || 'Chưa có địa điểm'}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 tablet:grid-cols-1">
        <Card>
          <CardHead title="Checklist trực tuần" />
          <CardBody className="space-y-2">
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
            <p className="pt-1 text-[11px] text-muted">
              Danh sách nhắc việc trong phiên, không lưu vào cơ sở dữ liệu.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Chờ phối hợp" />
          <CardBody>
            <p className="m-0 text-[13px]">
              <strong className="text-[20px]">{data.waitingCount}</strong> công việc đang chờ đơn vị
              khác.
            </p>
            <Button size="sm" className="mt-2" onClick={() => (window.location.href = '/tasks')}>
              Xem danh sách
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Ghi chú nhanh" />
          <CardBody>
            <TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nội dung cần nhớ trong ngày…"
              maxLength={1000}
            />
            <Button
              size="sm"
              className="mt-2"
              loading={savingNote}
              icon={<NotebookPen size={14} aria-hidden />}
              onClick={() => void saveNote()}
            >
              Lưu ghi chú
            </Button>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={incidentOpen}
        title="Ghi nhận nhanh sự việc"
        onClose={() => setIncidentOpen(false)}
        footer={
          <>
            <Button onClick={() => setIncidentOpen(false)}>Hủy</Button>
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
            />
          </Field>
        </div>
        <Notice tone="warn" className="mt-3">
          Ghi nhận này không tự động thay đổi bảng thi đua, đặc biệt khi bảng đã khóa.
        </Notice>
      </Modal>

      <Modal
        open={finishOpen}
        title="Kết thúc ngày"
        onClose={() => setFinishOpen(false)}
        footer={<Button onClick={() => setFinishOpen(false)}>Đóng</Button>}
      >
        <p className="m-0 flex items-center gap-2 text-[13px]">
          <CheckCircle2 size={16} className="text-green" aria-hidden />
          Đã hoàn thành <strong>{data.completedToday}</strong> việc. Còn{' '}
          <strong>{data.remaining}</strong> việc cần tiếp tục xử lý.
        </p>
        <Notice className="mt-3">
          Các việc chưa hoàn thành vẫn giữ nguyên hạn và được hiển thị ngày sau; hệ thống không tự
          sửa trạng thái.
        </Notice>
      </Modal>
    </>
  );
}
