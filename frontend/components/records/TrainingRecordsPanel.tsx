'use client';

import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useToast } from '@/hooks/useToast';
import { fmtDate } from '@/lib/format';
import { api } from '@/services/api';
import type { TrainingRecord } from '@/types';
import {
  Button,
  ErrorState,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  TableEmptyRow,
  TableWrap,
  TextArea,
  TextInput,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/**
 * Sổ bồi dưỡng của một thành viên Đội (bảng `training_records`).
 *
 * Ô "Kết quả bồi dưỡng" dạng văn bản trong biểu mẫu thành viên vẫn giữ nguyên
 * để ghi nhận xét chung; bảng này ghi từng buổi có ngày và kết quả cụ thể.
 */

const EMPTY = { content: '', date: '', result: '', note: '' };

export function TrainingRecordsPanel({
  teamMemberId,
  memberName,
}: {
  teamMemberId: string;
  memberName?: string;
}) {
  const { toast, toastError } = useToast();
  const { data, loading, error, refetch } = useApiQuery<TrainingRecord[]>('/training-records', {
    teamMemberId,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingRecord | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TrainingRecord | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((record: TrainingRecord) => {
    setEditing(record);
    setForm({
      content: record.content,
      date: record.date ? record.date.slice(0, 10) : '',
      result: record.result ?? '',
      note: record.note ?? '',
    });
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const payload = {
        content: form.content.trim(),
        date: form.date,
        result: form.result,
        note: form.note,
      };
      if (editing) await api.patch(`/training-records/${editing.id}`, payload);
      else await api.post('/training-records', { ...payload, teamMemberId });
      toast(editing ? 'Đã cập nhật buổi bồi dưỡng' : 'Đã ghi nhận buổi bồi dưỡng');
      setFormOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [editing, form, teamMemberId, toast, toastError, refetch]);

  const remove = useCallback(async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/training-records/${deleting.id}`);
      toast('Đã xóa buổi bồi dưỡng');
      setDeleting(null);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [deleting, toast, toastError, refetch]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const records = data ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">
          {records.length} buổi đã ghi nhận{memberName ? ` cho ${memberName}` : ''}.
        </span>
        <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden />} onClick={openCreate}>
          Thêm buổi bồi dưỡng
        </Button>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <th className="w-[110px]">Thời gian</th>
            <th>Nội dung</th>
            <th className="w-[150px]">Kết quả</th>
            <th className="w-[110px]">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <TableEmptyRow colSpan={4}>
              Chưa ghi nhận buổi bồi dưỡng nào. Hãy chọn “Thêm buổi bồi dưỡng”.
            </TableEmptyRow>
          ) : (
            records.map((record) => (
              <tr key={record.id}>
                <td>{record.date ? fmtDate(record.date) : '—'}</td>
                <td className="wrap">
                  {record.content}
                  {record.note ? (
                    <div className="mt-0.5 text-[12px] text-muted">{record.note}</div>
                  ) : null}
                </td>
                <td className="wrap">{record.result ?? '—'}</td>
                <td>
                  <div className="flex gap-2.5">
                    <LinkButton onClick={() => openEdit(record)}>Sửa</LinkButton>
                    <LinkButton tone="red" onClick={() => setDeleting(record)}>
                      Xóa
                    </LinkButton>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      <Modal
        open={formOpen}
        title={editing ? 'Sửa buổi bồi dưỡng' : 'Thêm buổi bồi dưỡng'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Nội dung bồi dưỡng" required full>
            <TextInput
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              maxLength={200}
              required
              placeholder="Ví dụ: Tập huấn nghi thức Đội"
            />
          </Field>
          <Field label="Thời gian">
            <TextInput
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Kết quả">
            <TextInput
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              maxLength={120}
              placeholder="Ví dụ: Đạt loại Tốt"
            />
          </Field>
          <Field label="Ghi chú" full>
            <TextArea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa buổi bồi dưỡng"
        loading={busy}
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Bản ghi sẽ được xóa mềm và vẫn còn trong nhật ký.
            </Notice>
            <p className="m-0">
              <strong>{deleting?.content}</strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
