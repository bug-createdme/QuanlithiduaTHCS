'use client';

import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  History,
  ListChecks,
  Settings2,
  ShieldAlert,
  Trophy,
  Undo2,
  Unlock,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useConfirm } from '@/hooks/useConfirm';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { cx, fmtDate, fmtDateTime } from '@/lib/format';
import { CRITERIA_FORMULA_LABEL, SHEET_STATUS_LABEL } from '@/lib/labels';
import { api } from '@/services/api';
import type {
  Anomaly,
  AuditLog,
  Criterion,
  RankedRow,
  ScoreContext,
  SheetStatus,
} from '@/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHead,
  ProgressBar,
  Select,
  StatusBadge,
  TableEmptyRow,
  TableWrap,
  Tabs,
  TextArea,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { CriteriaManager } from './CriteriaManager';
import { ScoreGrid, type UndoAction } from './ScoreGrid';

type ScoreTab = 'entry' | 'ranking' | 'anomaly' | 'history';

/**
 * Vòng đời của một bảng thi đua tuần. Hiển thị thành các bước để người dùng
 * luôn trả lời được "bảng đang ở đâu" và "bước kế tiếp là gì" — trước đây
 * thông tin này chỉ nằm trong một nhãn trạng thái nhỏ ở góc thanh công cụ.
 */
const WORKFLOW_STEPS: SheetStatus[] = ['DRAFT', 'COMPLETE', 'REVIEW', 'APPROVED', 'LOCKED'];

function WorkflowSteps({ status }: { status: SheetStatus | null }) {
  // UNLOCKED là trạng thái quay lại sau khi mở khóa: coi như đang ở bước duyệt.
  const normalized: SheetStatus = status === 'UNLOCKED' ? 'REVIEW' : (status ?? 'DRAFT');
  const activeIndex = WORKFLOW_STEPS.indexOf(normalized);

  return (
    <ol className="flex list-none flex-wrap items-center gap-x-1 gap-y-2 p-0">
      {WORKFLOW_STEPS.map((step, index) => {
        const done = status !== null && index < activeIndex;
        const current = status !== null && index === activeIndex;
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              className={cx(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold',
                current && 'border-brand-200 bg-brand-50 text-brand-700',
                done && 'border-success-200 bg-success-50 text-success-700',
                !current && !done && 'border-line bg-neutral-50 text-neutral-400',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? (
                <CheckCircle2 size={13} aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={cx(
                    'grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold',
                    current ? 'bg-brand-600 text-white' : 'bg-neutral-200 text-neutral-500',
                  )}
                >
                  {index + 1}
                </span>
              )}
              {SHEET_STATUS_LABEL[step]}
            </span>
            {index < WORKFLOW_STEPS.length - 1 ? (
              <span aria-hidden className="h-px w-3 bg-neutral-300" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

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
        /*
         * Điểm cuối này dùng chung `contextBaseSchema` với các truy vấn GET, mà
         * schema đó chỉ nhận `uuid | 'all' | undefined` — không nhận `null`. Gửi
         * thẳng `null` (như trước đây) khiến "Khởi tạo bảng tuần" luôn báo
         * VALIDATION_ERROR ở trạng thái mặc định (Cả năm học + Toàn trường).
         * Gửi 'all' cho kết quả lưu xuống DB y hệt: normalizeScope('all') = null.
         */
        await api.post('/scores/sheets', {
          schoolYearId: scope.yearId,
          semesterId: scope.semesterId,
          campusId: scope.campusId,
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
        <PageHead
          title="Thi đua lớp"
          description="Nhập nhanh, duyệt, khóa và truy vết điểm thi đua theo tuần."
        />
        <EmptyState
          icon={<CalendarRange size={22} aria-hidden />}
          title="Chưa chọn tuần làm việc"
          hint="Hãy chọn một tuần ở nút phạm vi dữ liệu trên thanh trên cùng để bắt đầu nhập điểm."
        />
      </>
    );
  }

  if (ctxQuery.loading && !context) return <LoadingState label="Đang tải bảng thi đua…" />;
  if (ctxQuery.error) {
    return <ErrorState error={ctxQuery.error} onRetry={() => void ctxQuery.refetch()} />;
  }
  if (!context) return null;

  const week = scope.currentWeek;
  const filledClasses = new Set(context.entries.map((entry) => entry.classId)).size;
  const totalClasses = context.classes.length;
  const coverage = totalClasses > 0 ? Math.round((filledClasses / totalClasses) * 100) : 0;

  return (
    <>
      <PageHead
        eyebrow={week ? `${week.name} · ${fmtDate(week.startDate)} – ${fmtDate(week.endDate)}` : undefined}
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
              title={undo ? 'Hoàn tác thay đổi ô vừa nhập' : 'Chưa có thay đổi nào để hoàn tác'}
              onClick={() => void doUndo()}
            >
              Hoàn tác
            </Button>
            <Button
              variant="primary"
              icon={
                context.sheet?.status === 'LOCKED' ? (
                  <Unlock size={15} aria-hidden />
                ) : (
                  <ArrowRight size={15} aria-hidden />
                )
              }
              loading={busy}
              onClick={() => void runWorkflow()}
            >
              {context.workflowLabel}
            </Button>
          </>
        }
      />

      {/* ══ Thẻ ngữ cảnh: bảng nào, bộ tiêu chí nào, đang ở bước nào ══════ */}
      <Card className="mb-4">
        <CardBody className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-[0.07em] text-neutral-400">
                Trạng thái bảng tuần
              </span>
              <StatusBadge value={context.sheet?.status} fallback="Chưa khởi tạo" />
            </div>
            <WorkflowSteps status={context.sheet?.status ?? null} />

            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              Bước kế tiếp:{' '}
              <strong className="text-ink">{context.workflowLabel}</strong>
              {context.sheet?.status === 'LOCKED'
                ? ' — bảng đã khóa, cần lý do cụ thể mới mở lại được.'
                : '.'}
            </p>
          </div>

          <div className="min-w-0 lg:border-l lg:border-line lg:pl-4">
            {context.sets.length > 0 ? (
              <Field label="Bộ tiêu chí đang áp dụng">
                <Select
                  value={context.set?.id ?? ''}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setCriteriaSetId(nextId);
                    const picked = context.sets.find((s) => s.id === nextId);
                    if (picked) toast(`Đã chuyển sang bộ tiêu chí: ${picked.name}`);
                  }}
                >
                  {context.sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name} • v{set.version}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Notice tone="warn">
                Chưa có bộ tiêu chí nào. Hãy mở <strong>Bộ tiêu chí</strong> để tạo trước khi nhập
                điểm.
              </Notice>
            )}

            {context.set ? (
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                <strong className="text-neutral-700">Cách tính:</strong>{' '}
                {context.set.formula === 'BASE'
                  ? `điểm chuẩn ${Number(context.set.baseScore)}, sau đó cộng/trừ`
                  : CRITERIA_FORMULA_LABEL[context.set.formula]}
                {context.set.basis ? ` · căn cứ: ${context.set.basis}` : ''}
              </p>
            ) : null}

            <div className="mt-3.5 rounded-md border border-line bg-neutral-25 p-3">
              <div className="flex items-end justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-600">Lớp đã có dữ liệu</span>
                <span className="text-lg font-bold tabular-nums text-ink">
                  {filledClasses}/{totalClasses}
                </span>
              </div>
              <ProgressBar
                value={coverage}
                className="mt-2"
                label={`Đã nhập dữ liệu cho ${filledClasses} trên ${totalClasses} lớp`}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {context.sheet?.reportsStale ? (
        <Notice tone="warn" title="Báo cáo liên quan cần tạo phiên bản mới." className="mb-3">
          Bảng đã được mở khóa sau khi duyệt, nên các báo cáo đã sinh từ bảng này không còn khớp số
          liệu hiện tại.
        </Notice>
      ) : null}

      <Tabs<ScoreTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'entry', label: 'Nhập điểm', icon: <ListChecks size={15} aria-hidden /> },
          { id: 'ranking', label: 'Xếp hạng', icon: <Trophy size={15} aria-hidden /> },
          { id: 'anomaly', label: 'Kiểm tra bất thường', icon: <ShieldAlert size={15} aria-hidden /> },
          { id: 'history', label: 'Nhật ký điều chỉnh', icon: <History size={15} aria-hidden /> },
        ]}
      />

      {tab === 'entry' ? (
        <ScoreGrid context={context} onChanged={reloadAll} onUndoAvailable={setUndo} />
      ) : null}

      {/* ══ Xếp hạng ═════════════════════════════════════════════════════ */}
      {tab === 'ranking' ? (
        rankQuery.loading && !rankQuery.data ? (
          <LoadingState label="Đang tính xếp hạng…" />
        ) : (
          <>
            {!rankQuery.data?.official ? (
              <Notice tone="warn" title="Xếp hạng tạm thời" className="mb-3">
                Bảng chưa được duyệt, nên thứ hạng dưới đây chỉ để tham khảo nội bộ và không dùng
                cho báo cáo chính thức.
              </Notice>
            ) : (
              <Notice tone="success" title="Xếp hạng chính thức" className="mb-3">
                Số liệu lấy từ bảng đã duyệt, dùng được cho báo cáo và công bố.
              </Notice>
            )}

            <TableWrap>
              <thead>
                <tr>
                  <th className="w-[76px]">Hạng</th>
                  <th className="min-w-[160px]">Lớp</th>
                  <th>Cơ sở</th>
                  <th className="num">Tổng điểm</th>
                  <th>Mức dữ liệu</th>
                  <th>Loại</th>
                </tr>
              </thead>
              <tbody>
                {(rankQuery.data?.rows ?? []).length === 0 ? (
                  <TableEmptyRow colSpan={6}>
                    Chưa có dữ liệu xếp hạng cho tuần đang chọn.
                  </TableEmptyRow>
                ) : (
                  rankQuery.data!.rows.map((row) => (
                    <tr key={row.classId}>
                      <td>
                        <span
                          className={cx(
                            'grid h-7 w-7 place-items-center rounded-full text-xs font-bold tabular-nums',
                            row.rank === 1
                              ? 'bg-warning-100 text-warning-700'
                              : row.rank <= 3
                                ? 'bg-brand-50 text-brand-700'
                                : 'bg-neutral-100 text-neutral-500',
                          )}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="font-semibold text-ink">{row.className}</td>
                      <td>{scope.campusName(row.campusId)}</td>
                      <td className="num font-bold text-ink">{row.total.toFixed(1)}</td>
                      <td>
                        {row.complete ? (
                          <Badge tone="green" dot>
                            Đủ dữ liệu
                          </Badge>
                        ) : (
                          <Badge tone="yellow" dot>
                            Chưa đủ
                          </Badge>
                        )}
                      </td>
                      <td>
                        {rankQuery.data!.official ? (
                          <Badge tone="green" dot>
                            Chính thức
                          </Badge>
                        ) : (
                          <Badge tone="yellow" dot>
                            Tạm thời
                          </Badge>
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

      {/* ══ Bất thường ═══════════════════════════════════════════════════ */}
      {tab === 'anomaly' ? (
        anomalyQuery.loading && !anomalyQuery.data ? (
          <LoadingState label="Đang rà soát dữ liệu…" />
        ) : (
          <>
            <Notice className="mb-3">
              Cảnh báo chỉ đề nghị kiểm tra lại, không tự kết luận sai phạm và không thay đổi điểm.
            </Notice>
            {(anomalyQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={22} aria-hidden />}
                title="Không phát hiện bất thường"
                hint="Dữ liệu của tuần này thỏa mãn mọi quy tắc kiểm tra đang bật."
              />
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {anomalyQuery.data!.map((item, index) => (
                  <li
                    key={index}
                    className={cx(
                      'flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-xs',
                      item.level === 'red' ? 'border-danger-200' : 'border-warning-200',
                    )}
                  >
                    <span
                      className={cx(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-md',
                        item.level === 'red'
                          ? 'bg-danger-50 text-danger-600'
                          : 'bg-warning-50 text-warning-600',
                      )}
                      aria-hidden
                    >
                      <ShieldAlert size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badge tone={item.level === 'red' ? 'red' : 'yellow'} dot>
                        {item.level === 'red' ? 'Cần kiểm tra' : 'Lưu ý'}
                      </Badge>
                      <p className="m-0 mt-1.5 text-base leading-relaxed text-neutral-700">
                        {item.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      ) : null}

      {/* ══ Nhật ký ══════════════════════════════════════════════════════ */}
      {tab === 'history' ? (
        historyQuery.loading && !historyQuery.data ? (
          <LoadingState label="Đang tải nhật ký…" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hành động</th>
                <th className="min-w-[180px]">Nội dung</th>
                <th>Giá trị cũ</th>
                <th>Giá trị mới</th>
                <th className="min-w-[160px]">Lý do</th>
                <th>Người thực hiện</th>
              </tr>
            </thead>
            <tbody>
              {(historyQuery.data ?? []).length === 0 ? (
                <TableEmptyRow colSpan={7}>
                  Chưa có điều chỉnh nào được ghi nhận.
                </TableEmptyRow>
              ) : (
                historyQuery.data!.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap tabular-nums">{fmtDateTime(log.createdAt)}</td>
                    <td>
                      <Badge>{log.action}</Badge>
                    </td>
                    <td className="wrap">{log.summary ?? '—'}</td>
                    <td className="num">{log.oldValue ?? '—'}</td>
                    <td className="num font-semibold text-ink">{log.newValue ?? '—'}</td>
                    <td className="wrap">{log.reason ?? '—'}</td>
                    <td>{log.user?.fullName ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {/* ══ Mở khóa ══════════════════════════════════════════════════════ */}
      <Modal
        open={unlockOpen}
        title="Mở khóa bảng thi đua"
        description="Thao tác này được ghi vào nhật ký cùng lý do và người thực hiện."
        icon={<Unlock size={18} aria-hidden />}
        onClose={() => setUnlockOpen(false)}
        footer={
          <>
            <Button onClick={() => setUnlockOpen(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void doUnlock()}>
              Mở khóa bảng
            </Button>
          </>
        }
      >
        <Notice tone="danger" title="Bảng đã khóa đang ở trạng thái dùng được cho báo cáo." className="mb-3.5">
          Mở khóa cho phép sửa điểm đã chốt. Hệ thống sẽ ghi lại lý do, thời gian và đánh dấu các
          báo cáo liên quan là cần cập nhật.
        </Notice>
        <Field
          label="Lý do mở khóa"
          required
          hint="Tối thiểu 5 ký tự. Ví dụ: sửa điểm vệ sinh lớp 7A2 theo biên bản ngày 12/9."
        >
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
