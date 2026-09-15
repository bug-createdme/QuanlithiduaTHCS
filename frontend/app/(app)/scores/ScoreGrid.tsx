'use client';

import { Paperclip, Settings2, TableProperties } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { cx } from '@/lib/format';
import { api } from '@/services/api';
import type { Criterion, ScoreContext, ScoreEntry } from '@/types';
import { Badge, EmptyState, Notice } from '@/components/ui';
import { EvidenceDialog } from './EvidenceDialog';

interface UndoAction {
  type: 'delete' | 'restore';
  id?: string;
  row?: ScoreEntry;
}

/** Khóa ô = "classId|criteriaId", đúng cách entryMap() của bản gốc lập chỉ mục. */
const cellKey = (classId: string, criteriaId: string) => `${classId}|${criteriaId}`;

/** Hiển thị lại giá trị đã lưu về dạng người dùng gõ. */
function displayValue(entry: ScoreEntry | undefined): string {
  if (!entry) return '';
  if (entry.entryState === 'NA') return 'KAD';
  if (entry.entryState === 'EXEMPT') return 'MIỄN';
  return entry.value ?? '';
}

/** Quy đổi một ô thành điểm — bản sao logic criterionScore() phía server. */
function scoreOf(entry: ScoreEntry | undefined, criterion: Criterion, formula: string): number {
  if (!entry || entry.entryState !== 'VALUE') return 0;
  let score = Number(entry.value ?? 0);
  if (criterion.dataType === 'COUNT') score *= Number(criterion.points);
  if (criterion.dataType === 'BOOLEAN') score = Number(entry.value) ? Number(criterion.points) : 0;
  if (criterion.dataType === 'NOTE') score = 0;
  if (formula === 'WEIGHTED') score *= Number(criterion.weight) || 1;
  return score;
}

export function ScoreGrid({
  context,
  onChanged,
  onUndoAvailable,
}: {
  context: ScoreContext;
  onChanged: () => void;
  onUndoAvailable: (undo: UndoAction | null) => void;
}) {
  const { toast, toastError } = useToast();
  const [saving, setSaving] = useState<Set<string>>(new Set());
  /** Ô đang mở hộp thoại minh chứng; null nghĩa là đang đóng. */
  const [evidenceEntryId, setEvidenceEntryId] = useState<string | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  const locked = context.sheet?.status === 'LOCKED';
  const formula = context.set?.formula ?? 'BASE';
  const baseScore = Number(context.set?.baseScore ?? 0);

  const entryMap = useMemo(() => {
    const map = new Map<string, ScoreEntry>();
    for (const entry of context.entries) map.set(cellKey(entry.classId, entry.criteriaId), entry);
    return map;
  }, [context.entries]);

  const saveCell = useCallback(
    async (classId: string, criteriaId: string, raw: string) => {
      if (!context.sheet) return;
      const key = cellKey(classId, criteriaId);
      setSaving((current) => new Set(current).add(key));
      try {
        const result = await api.put<{
          cleared: boolean;
          entry: ScoreEntry | null;
          undo?: UndoAction;
        }>('/scores/entries', { sheetId: context.sheet.id, classId, criteriaId, raw });
        onUndoAvailable(result.undo ?? null);
        onChanged();
      } catch (err) {
        toastError(err);
        onChanged();
      } finally {
        setSaving((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [context.sheet, onChanged, onUndoAvailable, toastError],
  );

  /** Enter xuống ô dưới, Shift+Enter lên ô trên — giữ đúng phím tắt bản gốc. */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const input = event.currentTarget;
    const row = Number(input.dataset.row) + (event.shiftKey ? -1 : 1);
    const col = input.dataset.col;
    gridRef.current
      ?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)
      ?.focus();
  }, []);

  /** Dán vùng dữ liệu từ Excel bắt đầu tại ô đang chọn. */
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
      event.preventDefault();
      if (!context.sheet) return;

      const matrix = text
        .trim()
        .split(/\r?\n/)
        .map((line) => line.split('\t'));
      const startRow = Number(event.currentTarget.dataset.row);
      const startCol = Number(event.currentTarget.dataset.col);

      try {
        const result = await api.post<{ applied: number; skipped: number }>(
          '/scores/entries/paste',
          {
            sheetId: context.sheet.id,
            startRow,
            startCol,
            matrix,
            classIds: context.classes.map((c) => c.id),
            criteriaIds: context.criteria.map((c) => c.id),
          },
        );
        toast(
          result.skipped > 0
            ? `Đã dán ${result.applied} ô dữ liệu, bỏ qua ${result.skipped} ô không hợp lệ.`
            : `Đã dán ${result.applied} ô dữ liệu`,
        );
        onChanged();
      } catch (err) {
        toastError(err);
      }
    },
    [context, toast, toastError, onChanged],
  );

  if (!context.set || context.criteria.length === 0) {
    return (
      <EmptyState
        icon={<Settings2 size={22} aria-hidden />}
        title="Chưa có bộ tiêu chí hoạt động"
        hint="Mở “Bộ tiêu chí” ở đầu trang để cấu hình các tiêu chí chấm điểm trước khi nhập."
      />
    );
  }

  if (!context.sheet) {
    return (
      <EmptyState
        icon={<TableProperties size={22} aria-hidden />}
        title="Chưa khởi tạo bảng tuần"
        hint="Chọn “Khởi tạo bảng tuần” ở đầu trang để mở bảng nhập điểm cho tuần đang chọn."
      />
    );
  }

  return (
    <>
      {locked ? (
        <Notice tone="neutral" className="mb-3">
          Bảng đang khóa nên mọi ô ở chế độ chỉ đọc. Dùng nút{' '}
          <strong>{context.workflowLabel}</strong> ở đầu trang nếu cần mở khóa.
        </Notice>
      ) : null}

      <div className="table-wrap max-h-[calc(100vh-380px)]">
        <table ref={gridRef} className="data-table">
          <thead>
            <tr>
              {/* Cột lớp dính bên trái để luôn biết đang nhập cho lớp nào. */}
              <th className="sticky left-0 z-20 min-w-[120px] bg-neutral-50 shadow-[1px_0_0_rgb(var(--border))]">
                Lớp
              </th>
              {context.criteria.map((criterion) => (
                <th
                  key={criterion.id}
                  title={`${criterion.name}${criterion.evidenceRequired ? ' — bắt buộc có minh chứng' : ''}`}
                  className="text-center"
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1 text-ink">
                      {criterion.code}
                      {criterion.evidenceRequired ? (
                        <Paperclip size={11} className="text-danger-500" aria-hidden />
                      ) : null}
                    </span>
                    {criterion.groupName ? (
                      <span className="font-medium normal-case tracking-normal text-neutral-400">
                        {criterion.groupName}
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
              <th className="num sticky right-0 z-20 bg-neutral-50 shadow-[-1px_0_0_rgb(var(--border))]">
                Tổng
              </th>
              <th>Mức nhập</th>
            </tr>
          </thead>
          <tbody>
            {context.classes.map((cls, rowIndex) => {
              let total = formula === 'BASE' ? baseScore : 0;
              let filled = 0;

              const cells = context.criteria.map((criterion, colIndex) => {
                const entry = entryMap.get(cellKey(cls.id, criterion.id));
                if (entry) {
                  filled += 1;
                  total += scoreOf(entry, criterion, formula);
                }
                const key = cellKey(cls.id, criterion.id);
                return (
                  <td key={criterion.id} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        /*
                         * Ô nhập là uncontrolled (dùng `defaultValue`) để gõ không bị giật.
                         * Nhưng vì vậy React không tự đặt lại nội dung khi dữ liệu đổi ở
                         * nơi khác — sau khi Hoàn tác, ô vẫn hiện giá trị cũ dù đã bị xóa.
                         * Đưa giá trị đã lưu vào `key` để ô được dựng lại đúng mỗi khi
                         * bản ghi tương ứng thay đổi.
                         */
                        key={`${entry?.id ?? 'empty'}|${entry?.entryState ?? ''}|${entry?.value ?? ''}`}
                        className={cx(
                          'score-input',
                          !entry && 'score-input-missing',
                          saving.has(key) && 'opacity-60',
                        )}
                        data-row={rowIndex}
                        data-col={colIndex}
                        defaultValue={displayValue(entry)}
                        disabled={locked}
                        aria-label={`${cls.className} - ${criterion.name}`}
                        onKeyDown={handleKeyDown}
                        onPaste={(e) => void handlePaste(e)}
                        onBlur={(e) => {
                          const next = e.currentTarget.value.trim();
                          if (next === displayValue(entry).toString().trim()) return;
                          void saveCell(cls.id, criterion.id, next);
                        }}
                      />
                      {/*
                        Minh chứng gắn theo ô đã có dữ liệu nên chỉ hiện khi ô có
                        giá trị. Bản cũ dùng ký tự "⛃" cỡ 11px — vừa khó hiểu vừa
                        quá nhỏ để bấm; nay là nút biểu tượng kẹp giấy 24×24.
                      */}
                      {entry ? (
                        <button
                          type="button"
                          className={cx(
                            'grid h-6 w-6 shrink-0 place-items-center rounded-sm transition-colors',
                            criterion.evidenceRequired
                              ? 'text-danger-500 hover:bg-danger-50'
                              : 'text-neutral-400 hover:bg-brand-50 hover:text-brand-600',
                          )}
                          title={
                            criterion.evidenceRequired
                              ? `Minh chứng bắt buộc — ${cls.className} · ${criterion.code}`
                              : `Minh chứng — ${cls.className} · ${criterion.code}`
                          }
                          aria-label={`Minh chứng cho ${cls.className}, tiêu chí ${criterion.name}`}
                          onClick={() => setEvidenceEntryId(entry.id)}
                        >
                          <Paperclip size={13} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </td>
                );
              });

              const complete = filled === context.criteria.length;

              return (
                <tr key={cls.id}>
                  <td className="sticky left-0 z-10 bg-card font-semibold text-ink shadow-[1px_0_0_rgb(var(--border))]">
                    {cls.className}
                  </td>
                  {cells}
                  <td className="num sticky right-0 z-10 bg-card text-base font-bold text-ink shadow-[-1px_0_0_rgb(var(--border))]">
                    {total.toFixed(1)}
                  </td>
                  <td>
                    {complete ? (
                      <Badge tone="green" dot>
                        Đủ
                      </Badge>
                    ) : (
                      <Badge tone="yellow" dot>
                        {filled}/{context.criteria.length}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Chú giải cách nhập ────────────────────────────────────────── */}
      <div className="mt-3 rounded-lg border border-line bg-card p-3.5 shadow-xs">
        <p className="m-0 mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-neutral-400">
          Cách nhập nhanh
        </p>
        <dl className="m-0 grid gap-x-6 gap-y-2 p-0 text-sm md:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">Ô trống</dt>
            <dd className="m-0 text-neutral-500">chưa nhập — ô có nền vàng nhạt</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              <span className="kbd">0</span>
            </dt>
            <dd className="m-0 text-neutral-500">có dữ liệu và bằng 0</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              <span className="kbd px-1.5">KAD</span>
            </dt>
            <dd className="m-0 text-neutral-500">không áp dụng cho lớp này</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              <span className="kbd px-1.5">MIỄN</span>
            </dt>
            <dd className="m-0 text-neutral-500">lớp được miễn tiêu chí này</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              <span className="kbd px-1.5">Enter</span>
            </dt>
            <dd className="m-0 text-neutral-500">
              xuống ô dưới; <span className="kbd px-1.5">Shift</span>+
              <span className="kbd px-1.5">Enter</span> lên ô trên
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              <span className="kbd px-1.5">Ctrl</span>+<span className="kbd px-1.5">V</span>
            </dt>
            <dd className="m-0 text-neutral-500">dán cả vùng dữ liệu từ Excel</dd>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <dt className="shrink-0 font-semibold text-neutral-700">
              <Paperclip size={13} className="inline" aria-hidden /> Kẹp giấy
            </dt>
            <dd className="m-0 text-neutral-500">
              gắn minh chứng cho ô đã nhập; biểu tượng màu đỏ nghĩa là tiêu chí bắt buộc có minh
              chứng
            </dd>
          </div>
        </dl>
      </div>

      {evidenceEntryId ? (
        <EvidenceDialog
          scoreEntryId={evidenceEntryId}
          locked={locked}
          onClose={() => setEvidenceEntryId(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}

export type { UndoAction };
