'use client';

import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import type { PlanTarget } from '@/types';
import {
  Button,
  ErrorState,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  ProgressBar,
  TableEmptyRow,
  TableWrap,
  TextInput,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/**
 * Chỉ tiêu đo được của một kế hoạch (bảng `plan_targets`).
 *
 * Khác với ô "Chỉ tiêu" dạng văn bản có sẵn trong biểu mẫu kế hoạch: ô đó để
 * mô tả tự do, còn bảng này để theo dõi con số — đặt mục tiêu, ghi kết quả
 * thực hiện và nhìn ra tiến độ. Hai chỗ bổ sung cho nhau, không thay thế nhau.
 */

const EMPTY = { name: '', targetValue: '', actualValue: '', unit: '', sortOrder: '1' };

/** Phần trăm hoàn thành, chặn trong khoảng 0–100 để thanh tiến độ không tràn. */
function progressOf(target: PlanTarget): number | null {
  const goal = Number(target.targetValue);
  const actual = Number(target.actualValue);
  if (!Number.isFinite(goal) || goal === 0 || !Number.isFinite(actual)) return null;
  return Math.max(0, Math.min(100, Math.round((actual / goal) * 100)));
}

export function PlanTargetsPanel({ planId }: { planId: string }) {
  const { toast, toastError } = useToast();
  const { data, loading, error, refetch } = useApiQuery<PlanTarget[]>('/plan-targets', { planId });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanTarget | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<PlanTarget | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ ...EMPTY, sortOrder: String((data?.length ?? 0) + 1) });
    setFormOpen(true);
  }, [data]);

  const openEdit = useCallback((target: PlanTarget) => {
    setEditing(target);
    setForm({
      name: target.name,
      targetValue: target.targetValue ?? '',
      actualValue: target.actualValue ?? '',
      unit: target.unit ?? '',
      sortOrder: String(target.sortOrder),
    });
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        targetValue: form.targetValue,
        actualValue: form.actualValue,
        unit: form.unit,
        sortOrder: Number(form.sortOrder) || 1,
      };
      if (editing) await api.patch(`/plan-targets/${editing.id}`, payload);
      else await api.post('/plan-targets', { ...payload, planId });
      toast(editing ? 'Đã cập nhật chỉ tiêu' : 'Đã thêm chỉ tiêu');
      setFormOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [editing, form, planId, toast, toastError, refetch]);

  const remove = useCallback(async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/plan-targets/${deleting.id}`);
      toast('Đã xóa chỉ tiêu');
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

  const targets = data ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">
          {targets.length} chỉ tiêu đo được. Ô “Chỉ tiêu” trong biểu mẫu kế hoạch vẫn dùng để mô tả
          bằng lời.
        </span>
        <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden />} onClick={openCreate}>
          Thêm chỉ tiêu
        </Button>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <th>Chỉ tiêu</th>
            <th className="w-[110px]">Mục tiêu</th>
            <th className="w-[110px]">Thực hiện</th>
            <th className="w-[150px]">Tiến độ</th>
            <th className="w-[110px]">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {targets.length === 0 ? (
            <TableEmptyRow colSpan={5}>
              Chưa có chỉ tiêu nào. Hãy chọn “Thêm chỉ tiêu”.
            </TableEmptyRow>
          ) : (
            targets.map((target) => {
              const percent = progressOf(target);
              return (
                <tr key={target.id}>
                  <td className="wrap">{target.name}</td>
                  <td className="tabular-nums">
                    {target.targetValue ?? '—'}
                    {target.unit ? ` ${target.unit}` : ''}
                  </td>
                  <td className="tabular-nums">
                    {target.actualValue ?? '—'}
                    {target.actualValue && target.unit ? ` ${target.unit}` : ''}
                  </td>
                  <td>
                    {percent === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={percent} className="flex-1" />
                        <span className="w-[38px] shrink-0 text-right text-[12px] tabular-nums">
                          {percent}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2.5">
                      <LinkButton onClick={() => openEdit(target)}>Sửa</LinkButton>
                      <LinkButton tone="red" onClick={() => setDeleting(target)}>
                        Xóa
                      </LinkButton>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>

      <Modal
        open={formOpen}
        title={editing ? 'Sửa chỉ tiêu' : 'Thêm chỉ tiêu'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu chỉ tiêu
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Tên chỉ tiêu" required full>
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={200}
              required
              placeholder="Ví dụ: Số buổi sinh hoạt Đội trong năm"
            />
          </Field>
          <Field label="Giá trị mục tiêu">
            <TextInput
              type="number"
              step="any"
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
            />
          </Field>
          <Field label="Đã thực hiện">
            <TextInput
              type="number"
              step="any"
              value={form.actualValue}
              onChange={(e) => setForm({ ...form, actualValue: e.target.value })}
            />
          </Field>
          <Field label="Đơn vị tính" hint="Ví dụ: buổi, lớp, %, công trình">
            <TextInput
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              maxLength={30}
            />
          </Field>
          <Field label="Thứ tự hiển thị">
            <TextInput
              type="number"
              min={1}
              max={999}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa chỉ tiêu"
        loading={busy}
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Chỉ tiêu sẽ được xóa mềm và vẫn còn trong nhật ký.
            </Notice>
            <p className="m-0">
              <strong>{deleting?.name}</strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
