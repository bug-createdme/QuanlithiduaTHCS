'use client';

import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useToast } from '@/hooks/useToast';
import { fmtDate } from '@/lib/format';
import { api } from '@/services/api';
import type { EquipmentTransaction, EquipmentTxType } from '@/types';
import {
  Badge,
  Button,
  ErrorState,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  Select,
  Split,
  TableEmptyRow,
  TableWrap,
  TextArea,
  TextInput,
} from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';

/**
 * Sổ mượn–trả của một thiết bị (bảng `equipment_transactions`).
 *
 * Trang Thiết bị vẫn nói "Kiểm kê, mượn–trả và chuẩn bị thiết bị cho sự kiện"
 * nhưng trước đây không có chỗ nào ghi lượt mượn. Ngăn này là chỗ đó.
 */

const TX_LABEL: Record<EquipmentTxType, string> = {
  BORROW: 'Cho mượn',
  RETURN: 'Nhận trả',
  REPAIR: 'Sửa chữa',
  DISPOSE: 'Thanh lý',
};

const TX_TONE: Record<EquipmentTxType, 'blue' | 'green' | 'yellow' | 'red'> = {
  BORROW: 'blue',
  RETURN: 'green',
  REPAIR: 'yellow',
  DISPOSE: 'red',
};

const EMPTY = {
  type: 'BORROW' as EquipmentTxType,
  quantity: '1',
  borrower: '',
  borrowedAt: '',
  dueAt: '',
  returnedAt: '',
  conditionBefore: '',
  conditionAfter: '',
  note: '',
};

export function EquipmentLedgerPanel({
  equipmentId,
  equipmentName,
  totalQuantity,
}: {
  equipmentId: string;
  equipmentName?: string;
  totalQuantity?: number;
}) {
  const { toast, toastError } = useToast();
  const { data, loading, error, refetch } = useApiQuery<EquipmentTransaction[]>(
    '/equipment-transactions',
    { equipmentId },
  );

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<EquipmentTransaction | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  /** Số đang ở ngoài — tính lại ở client để hiển thị, server vẫn tự kiểm tra. */
  const outstanding = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (row.type === 'BORROW') return sum + row.quantity;
        if (row.type === 'RETURN' || row.type === 'DISPOSE') return sum - row.quantity;
        return sum;
      }, 0),
    [rows],
  );

  const available = typeof totalQuantity === 'number' ? totalQuantity - outstanding : null;

  const openCreate = useCallback((type: EquipmentTxType) => {
    setForm({
      ...EMPTY,
      type,
      borrowedAt: type === 'BORROW' ? new Date().toISOString().slice(0, 10) : '',
      returnedAt: type === 'RETURN' ? new Date().toISOString().slice(0, 10) : '',
    });
    setFormOpen(true);
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      await api.post('/equipment-transactions', {
        equipmentId,
        type: form.type,
        quantity: Number(form.quantity) || 0,
        borrower: form.borrower,
        borrowedAt: form.borrowedAt,
        dueAt: form.dueAt,
        returnedAt: form.returnedAt,
        conditionBefore: form.conditionBefore,
        conditionAfter: form.conditionAfter,
        note: form.note,
      });
      toast(`Đã ghi nhận: ${TX_LABEL[form.type]}`);
      setFormOpen(false);
      void refetch();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [equipmentId, form, toast, toastError, refetch]);

  const remove = useCallback(async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/equipment-transactions/${deleting.id}`);
      toast('Đã xóa giao dịch');
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

  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3 tablet:grid-cols-1">
        <Split label="Tổng số">{totalQuantity ?? '—'}</Split>
        <Split label="Đang ở ngoài">{outstanding}</Split>
        <Split label="Còn trong kho">{available ?? '—'}</Split>
      </div>

      {available !== null && available < 0 ? (
        <Notice tone="danger" className="mb-3">
          Sổ đang ghi nhiều hơn số thiết bị hiện có. Hãy kiểm tra lại các lượt mượn–trả.
        </Notice>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          icon={<Plus size={14} aria-hidden />}
          onClick={() => openCreate('BORROW')}
        >
          Cho mượn
        </Button>
        <Button size="sm" onClick={() => openCreate('RETURN')}>
          Nhận trả
        </Button>
        <Button size="sm" onClick={() => openCreate('REPAIR')}>
          Sửa chữa
        </Button>
        <Button size="sm" onClick={() => openCreate('DISPOSE')}>
          Thanh lý
        </Button>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <th className="w-[100px]">Loại</th>
            <th className="w-[70px]">SL</th>
            <th>Người mượn</th>
            <th className="w-[105px]">Ngày mượn</th>
            <th className="w-[105px]">Hạn trả</th>
            <th className="w-[105px]">Đã trả</th>
            <th className="w-[80px]">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableEmptyRow colSpan={7}>
              Chưa có giao dịch nào. Hãy chọn “Cho mượn” để bắt đầu ghi sổ.
            </TableEmptyRow>
          ) : (
            rows.map((row) => {
              const overdue =
                row.type === 'BORROW' &&
                !row.returnedAt &&
                row.dueAt !== null &&
                row.dueAt.slice(0, 10) < new Date().toISOString().slice(0, 10);
              return (
                <tr key={row.id}>
                  <td>
                    <Badge tone={TX_TONE[row.type]}>{TX_LABEL[row.type]}</Badge>
                  </td>
                  <td className="tabular-nums">{row.quantity}</td>
                  <td className="wrap">
                    {row.borrower ?? '—'}
                    {row.note ? (
                      <div className="mt-0.5 text-[12px] text-muted">{row.note}</div>
                    ) : null}
                  </td>
                  <td>{row.borrowedAt ? fmtDate(row.borrowedAt) : '—'}</td>
                  <td>
                    {row.dueAt ? fmtDate(row.dueAt) : '—'}
                    {overdue ? (
                      <span className="ml-1 text-[11px] font-semibold text-red">quá hạn</span>
                    ) : null}
                  </td>
                  <td>{row.returnedAt ? fmtDate(row.returnedAt) : '—'}</td>
                  <td>
                    <LinkButton tone="red" onClick={() => setDeleting(row)}>
                      Xóa
                    </LinkButton>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>

      <Modal
        open={formOpen}
        title={`${TX_LABEL[form.type]}${equipmentName ? ` — ${equipmentName}` : ''}`}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Ghi sổ
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Loại giao dịch" required>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as EquipmentTxType })}
            >
              {(Object.keys(TX_LABEL) as EquipmentTxType[]).map((type) => (
                <option key={type} value={type}>
                  {TX_LABEL[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Số lượng"
            required
            hint={
              form.type === 'BORROW' && available !== null
                ? `Còn ${available} trong kho`
                : form.type === 'RETURN' || form.type === 'DISPOSE'
                  ? `Đang có ${outstanding} ở ngoài`
                  : undefined
            }
          >
            <TextInput
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </Field>
          <Field label="Người/đơn vị mượn" full>
            <TextInput
              value={form.borrower}
              onChange={(e) => setForm({ ...form, borrower: e.target.value })}
              maxLength={120}
              placeholder="Ví dụ: Chi đội 8/A1"
            />
          </Field>
          <Field label="Ngày mượn">
            <TextInput
              type="date"
              value={form.borrowedAt}
              onChange={(e) => setForm({ ...form, borrowedAt: e.target.value })}
            />
          </Field>
          <Field label="Hạn trả">
            <TextInput
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            />
          </Field>
          <Field label="Ngày trả thực tế">
            <TextInput
              type="date"
              value={form.returnedAt}
              onChange={(e) => setForm({ ...form, returnedAt: e.target.value })}
            />
          </Field>
          <Field label="Tình trạng khi giao">
            <TextInput
              value={form.conditionBefore}
              onChange={(e) => setForm({ ...form, conditionBefore: e.target.value })}
              maxLength={40}
            />
          </Field>
          <Field label="Tình trạng khi nhận">
            <TextInput
              value={form.conditionAfter}
              onChange={(e) => setForm({ ...form, conditionAfter: e.target.value })}
              maxLength={40}
            />
          </Field>
          <Field label="Ghi chú" full>
            <TextArea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa giao dịch"
        loading={busy}
        confirmLabel="Xóa"
        description={
          <>
            <Notice tone="danger" className="mb-2">
              Xóa giao dịch sẽ làm thay đổi số lượng đang ở ngoài. Bản ghi vẫn còn trong nhật ký.
            </Notice>
            <p className="m-0">
              <strong>
                {deleting ? `${TX_LABEL[deleting.type]} ${deleting.quantity}` : ''}
                {deleting?.borrower ? ` — ${deleting.borrower}` : ''}
              </strong>
            </p>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
