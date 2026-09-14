'use client';

import { Paperclip, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { fmtDateTime } from '@/lib/format';
import { api } from '@/services/api';
import type { ScoreEvidenceView } from '@/types';
import {
  Button,
  Field,
  LinkButton,
  LoadingState,
  Notice,
  TableEmptyRow,
  TableWrap,
  TextArea,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

/**
 * Minh chứng cho một ô điểm (bảng `score_evidence`).
 *
 * Trang Kiểm tra bất thường vẫn cảnh báo "Thiếu minh chứng bắt buộc" cho các
 * tiêu chí có bật cờ yêu cầu minh chứng. Trước đây không có chỗ nào gắn minh
 * chứng nên cảnh báo đó không tắt được; hộp thoại này là chỗ đó.
 */

export function EvidenceDialog({
  scoreEntryId,
  locked,
  onClose,
  onChanged,
}: {
  scoreEntryId: string;
  /** Bảng đã khóa thì chỉ xem, không sửa được — máy chủ cũng chặn. */
  locked: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast, toastError } = useToast();
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApiQuery<ScoreEvidenceView>('/scores/evidence', {
    scoreEntryId,
  });

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const add = useCallback(async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.post('/scores/evidence', { scoreEntryId, note: note.trim() });
      toast('Đã gắn minh chứng');
      setNote('');
      void refetch();
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [note, scoreEntryId, toast, toastError, refetch, onChanged]);

  const remove = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: 'Gỡ minh chứng',
        description: 'Bạn có chắc chắn muốn gỡ minh chứng này khỏi ô điểm không?',
        confirmLabel: 'Gỡ minh chứng',
        tone: 'danger',
      });
      if (!ok) return;
      setBusy(true);
      try {
        await api.delete(`/scores/evidence/${id}`);
        toast('Đã gỡ minh chứng');
        void refetch();
        onChanged();
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    },
    [confirm, toast, toastError, refetch, onChanged],
  );

  const entry = data?.entry;
  const rows = data?.evidence ?? [];

  return (
    <Modal
      open
      wide
      title={
        entry
          ? `Minh chứng — ${entry.className} · ${entry.criterionCode}`
          : 'Minh chứng ô điểm'
      }
      onClose={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <Notice tone="warn">Không tải được danh sách minh chứng.</Notice>
      ) : (
        <>
          {entry ? (
            <p className="mb-3 mt-0 text-[13px] text-muted">
              {entry.criterionName}
              {entry.evidenceRequired ? (
                <strong className="ml-1 text-red">• Tiêu chí này bắt buộc có minh chứng</strong>
              ) : null}
            </p>
          ) : null}

          {locked ? (
            <Notice tone="warn" className="mb-3">
              Bảng thi đua đã khóa nên chỉ xem được minh chứng. Hãy mở khóa có lý do nếu cần sửa.
            </Notice>
          ) : null}

          <TableWrap>
            <thead>
              <tr>
                <th>Nội dung minh chứng</th>
                <th className="w-[150px]">Thời điểm</th>
                {locked ? null : <th className="w-[80px]">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableEmptyRow colSpan={locked ? 2 : 3}>
                  Chưa có minh chứng nào cho ô điểm này.
                </TableEmptyRow>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="wrap">
                      {row.note ?? '—'}
                      {row.attachment ? (
                        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                          <Paperclip size={12} aria-hidden />
                          {row.attachment.fileName}
                        </div>
                      ) : null}
                    </td>
                    <td>{fmtDateTime(row.createdAt)}</td>
                    {locked ? null : (
                      <td>
                        <LinkButton tone="red" disabled={busy} onClick={() => void remove(row.id)}>
                          Gỡ
                        </LinkButton>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>

          {locked ? null : (
            <div className="mt-3">
              <Field
                label="Thêm minh chứng"
                hint="Ghi rõ căn cứ: số biên bản, ngày họp, người xác nhận…"
                full
              >
                <TextArea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: Biên bản họp Chi đội ngày 05/10, cô Lan xác nhận."
                />
              </Field>
              <Button
                size="sm"
                variant="primary"
                className="mt-2"
                icon={<Plus size={14} aria-hidden />}
                disabled={!note.trim() || busy}
                loading={busy}
                onClick={() => void add()}
              >
                Gắn minh chứng
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
