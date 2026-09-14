'use client';

import { ArrowRight, Settings2, Undo2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useConfirm } from '@/hooks/useConfirm';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { CRITERIA_FORMULA_LABEL } from '@/lib/labels';
import { api } from '@/services/api';
import type { Anomaly, AuditLog, Criterion, RankedRow, ScoreContext } from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHead,
  Select,
  StatusBadge,
  TableEmptyRow,
  TableWrap,
  Tabs,
  TextArea,
  Toolbar,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { CriteriaManager } from './CriteriaManager';
import { ScoreGrid, type UndoAction } from './ScoreGrid';

type ScoreTab = 'entry' | 'ranking' | 'anomaly' | 'history';

export default function ScoresPage() {
  const scope = useScope();
  const { toast, toastError } = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<ScoreTab>('entry');
  const [criteriaSetId, setCriteriaSetId] = useState<string>('');
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const enabled = scope.ready && Boolean(scope.yearId) && Boolean(scope.weekId);
  const params = { ...scope.query, ...(criteriaSetId ? { criteriaSetId } : {}) };

  const ctxQuery = useApiQuery<ScoreContext>(enabled ? '/scores/context' : null, params);
  const rankQuery = useApiQuery<{ official: boolean; rows: RankedRow[] }>(
    enabled && tab === 'ranking' ? '/scores/ranking' : null,
    params,
  );
  const anomalyQuery = useApiQuery<Anomaly[]>(
    enabled && tab === 'anomaly' ? '/scores/anomalies' : null,
    params,
  );
  const historyQuery = useApiQuery<AuditLog[]>(
    enabled && tab === 'history' ? '/scores/history' : null,
    { limit: 200 },
  );

  const context = ctxQuery.data;

  const reloadAll = useCallback(() => {
    void ctxQuery.refetch();
    if (tab === 'ranking') void rankQuery.refetch();
    if (tab === 'anomaly') void anomalyQuery.refetch();
    if (tab === 'history') void historyQuery.refetch();
  }, [ctxQuery, rankQuery, anomalyQuery, historyQuery, tab]);

  /** Nút quy trình: khởi tạo bảng hoặc chuyển sang trạng thái kế tiếp. */
  const runWorkflow = useCallback(async () => {
    if (!context) return;
    try {
      if (!context.sheet) {
        setBusy(true);
        await api.post('/scores/sheets', {
          schoolYearId: scope.yearId,
          semesterId: scope.semesterId === 'all' ? null : scope.semesterId,
          campusId: scope.campusId === 'all' ? null : scope.campusId,
          weekId: scope.weekId,
          ...(criteriaSetId ? { criteriaSetId } : {}),
        });
        toast('Đã khởi tạo bảng tuần');
      } else if (context.sheet.status === 'LOCKED') {
        setUnlockOpen(true);
        return;
      } else {
        const ok = await confirm({
          title: 'Chuyển trạng thái bảng điểm',
          description: `Bạn có chắc muốn thực hiện "${context.workflowLabel}" cho bảng điểm tuần này không?`,
          confirmLabel: context.workflowLabel,
          tone: 'primary',
        });
        if (!ok) return;
        setBusy(true);
        await api.post(`/scores/sheets/${context.sheet.id}/advance`);
        toast('Đã cập nhật trạng thái bảng tuần');
      }
      reloadAll();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [context, scope, criteriaSetId, confirm, toast, toastError, reloadAll]);

  const doUnlock = useCallback(async () => {
    if (!context?.sheet) return;
    if (unlockReason.trim().length < 5) {
      toast('Hãy nhập lý do cụ thể, tối thiểu 5 ký tự.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/scores/sheets/${context.sheet.id}/unlock`, { reason: unlockReason.trim() });
      toast('Đã mở khóa và lưu lý do');
      setUnlockOpen(false);
      setUnlockReason('');
      reloadAll();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }, [context, unlockReason, toast, toastError, reloadAll]);

  const doUndo = useCallback(async () => {
    if (!undo) return;
    try {
      await api.post('/scores/entries/undo', undo);
      toast('Đã hoàn tác thay đổi gần nhất');
      setUndo(null);
      reloadAll();
    } catch (err) {
      toastError(err);
    }
  }, [undo, toast, toastError, reloadAll]);

  if (!scope.ready) return <LoadingState />;

  if (!scope.weekId) {
    return (
      <>
        <PageHead title="Thi đua lớp" description="Nhập nhanh, duyệt, khóa và truy vết điểm thi đua theo tuần." />
        <Notice tone="warn">Hãy chọn một tuần ở thanh trên cùng để bắt đầu nhập điểm.</Notice>
      </>
    );
  }

  if (ctxQuery.loading && !context) return <LoadingState />;
  if (ctxQuery.error) return <ErrorState error={ctxQuery.error} onRetry={() => void ctxQuery.refetch()} />;
  if (!context) return null;

  const week = scope.currentWeek;

  return (
    <>
      <PageHead
        title="Thi đua lớp"
        description="Nhập nhanh, duyệt, khóa và truy vết điểm thi đua theo tuần."
        actions={
          <>
            <Button icon={<Settings2 size={15} aria-hidden />} onClick={() => setCriteriaOpen(true)}>
              Bộ tiêu chí
            </Button>
            <Button
              icon={<Undo2 size={15} aria-hidden />}
              disabled={!undo}
              onClick={() => void doUndo()}
            >
              Hoàn tác
            </Button>
            <Button
              variant="primary"
              icon={<ArrowRight size={15} aria-hidden />}
              loading={busy}
              onClick={() => void runWorkflow()}
            >
              {context.workflowLabel}
            </Button>
          </>
        }
      />

      <Notice tone="warn" className="mb-2.5">
        <strong className="block">{context.set?.name ?? 'Chưa có bộ tiêu chí'}</strong>
        {context.set?.basis ?? 'Cần tạo bộ tiêu chí trước khi nhập điểm.'}
        {context.set ? (
          <>
            {' '}
            Công thức:{' '}
            {context.set.formula === 'BASE'
              ? `Điểm chuẩn ${Number(context.set.baseScore)}, sau đó cộng/trừ`
              : CRITERIA_FORMULA_LABEL[context.set.formula]}
            .
          </>
        ) : null}
      </Notice>

      <Toolbar>
        <strong className="text-[13px]">{week?.name ?? 'Chưa chọn tuần'}</strong>
        {week ? (
          <span className="text-[12px] text-muted">
            {fmtDate(week.startDate)} – {fmtDate(week.endDate)}
          </span>
        ) : null}
        {context.sets.length > 0 ? (
          // min-w-0 + max-w cho phép select co lại; nếu để w-auto nó sẽ giãn
          // theo tên bộ tiêu chí dài nhất và đẩy các mục khác ra ngoài màn hình.
          <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-muted">
            <span className="shrink-0">Bộ tiêu chí</span>
            <Select
              value={context.set?.id ?? ''}
              onChange={(e) => {
                const nextId = e.target.value;
                setCriteriaSetId(nextId);
                const picked = context.sets.find((s) => s.id === nextId);
                if (picked) toast(`Đã chuyển sang bộ tiêu chí: ${picked.name}`);
              }}
              className="min-w-0 flex-1 md:max-w-[360px]"
            >
              {context.sets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name} • v{set.version}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
          Trạng thái: <StatusBadge value={context.sheet?.status} />
        </span>
      </Toolbar>

      {context.sheet?.reportsStale ? (
        <Notice tone="warn" className="mb-2.5">
          Bảng đã được mở khóa sau khi duyệt. Các báo cáo đã sinh từ bảng này cần được tạo phiên bản
          mới.
        </Notice>
      ) : null}

      <Tabs<ScoreTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'entry', label: 'Nhập điểm' },
          { id: 'ranking', label: 'Xếp hạng' },
          { id: 'anomaly', label: 'Kiểm tra bất thường' },
          { id: 'history', label: 'Nhật ký điều chỉnh' },
        ]}
      />

      {tab === 'entry' ? (
        <ScoreGrid context={context} onChanged={reloadAll} onUndoAvailable={setUndo} />
      ) : null}

      {tab === 'ranking' ? (
        rankQuery.loading && !rankQuery.data ? (
          <LoadingState />
        ) : (
          <>
            {!rankQuery.data?.official ? (
              <Notice tone="warn" className="mb-2.5">
                Bảng chưa được duyệt. Xếp hạng dưới đây là tạm thời, không dùng cho báo cáo chính thức.
              </Notice>
            ) : null}
            <TableWrap>
              <thead>
                <tr>
                  <th className="w-[70px]">Hạng</th>
                  <th>Lớp</th>
                  <th>Cơ sở</th>
                  <th className="text-right">Tổng điểm</th>
                  <th>Mức dữ liệu</th>
                  <th>Loại</th>
                </tr>
              </thead>
              <tbody>
                {(rankQuery.data?.rows ?? []).length === 0 ? (
                  <TableEmptyRow colSpan={6}>Chưa có dữ liệu xếp hạng.</TableEmptyRow>
                ) : (
                  rankQuery.data!.rows.map((row) => (
                    <tr key={row.classId}>
                      <td>
                        <strong>{row.rank}</strong>
                      </td>
                      <td>{row.className}</td>
                      <td>{scope.campusName(row.campusId)}</td>
                      <td className="text-right">
                        <strong>{row.total.toFixed(1)}</strong>
                      </td>
                      <td>
                        {row.complete ? (
                          <Badge tone="green">Đủ</Badge>
                        ) : (
                          <Badge tone="yellow">Chưa đủ</Badge>
                        )}
                      </td>
                      <td>
                        {rankQuery.data!.official ? (
                          <Badge tone="green">Chính thức</Badge>
                        ) : (
                          <Badge tone="yellow">Tạm thời</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </>
        )
      ) : null}

      {tab === 'anomaly' ? (
        anomalyQuery.loading && !anomalyQuery.data ? (
          <LoadingState />
        ) : (
          <>
            <Notice className="mb-2.5">
              Cảnh báo chỉ yêu cầu kiểm tra, không tự kết luận sai phạm.
            </Notice>
            <Card>
              <CardBody className="pt-2">
                {(anomalyQuery.data ?? []).length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-muted">
                    Chưa phát hiện bất thường theo các quy tắc đang bật.
                  </p>
                ) : (
                  <ul className="m-0 list-none divide-y divide-line p-0">
                    {anomalyQuery.data!.map((item, index) => (
                      <li key={index} className="flex items-start gap-2.5 py-2">
                        <Badge tone={item.level === 'red' ? 'red' : 'yellow'}>
                          {item.level === 'red' ? 'Kiểm tra' : 'Lưu ý'}
                        </Badge>
                        <span className="flex-1 text-[13px]">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </>
        )
      ) : null}

      {tab === 'history' ? (
        historyQuery.loading && !historyQuery.data ? (
          <LoadingState />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hành động</th>
                <th>Nội dung</th>
                <th>Giá trị cũ</th>
                <th>Giá trị mới</th>
                <th>Lý do</th>
                <th>Người thực hiện</th>
              </tr>
            </thead>
            <tbody>
              {(historyQuery.data ?? []).length === 0 ? (
                <TableEmptyRow colSpan={7}>Chưa có điều chỉnh.</TableEmptyRow>
              ) : (
                historyQuery.data!.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                    <td>{log.action}</td>
                    <td>{log.summary ?? '—'}</td>
                    <td>{log.oldValue ?? '—'}</td>
                    <td>{log.newValue ?? '—'}</td>
                    <td className="wrap">{log.reason ?? '—'}</td>
                    <td>{log.user?.fullName ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        )
      ) : null}

      <Modal
        open={unlockOpen}
        title="Mở khóa bảng thi đua"
        onClose={() => setUnlockOpen(false)}
        footer={
          <>
            <Button onClick={() => setUnlockOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void doUnlock()}>
              Mở khóa
            </Button>
          </>
        }
      >
        <Notice tone="danger" className="mb-3">
          Mở khóa cho phép sửa điểm đã khóa. Hệ thống sẽ ghi lại lý do, thời gian và đánh dấu báo cáo
          liên quan cần cập nhật.
        </Notice>
        <Field label="Lý do mở khóa" required>
          <TextArea
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </Field>
      </Modal>

      <CriteriaManager
        open={criteriaOpen}
        onClose={() => setCriteriaOpen(false)}
        onChanged={reloadAll}
        initialSetId={context.set?.id ?? null}
        criteria={context.criteria as Criterion[]}
      />
    </>
  );
}
