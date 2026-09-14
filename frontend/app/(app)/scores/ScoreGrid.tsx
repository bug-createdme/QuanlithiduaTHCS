'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { cx } from '@/lib/format';
import { api } from '@/services/api';
import type { Criterion, ScoreContext, ScoreEntry } from '@/types';
import { Badge, Notice } from '@/components/ui';
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
      <Notice tone="warn">
        Chưa có bộ tiêu chí hoạt động. Hãy mở <strong>Bộ tiêu chí</strong> để cấu hình trước khi nhập
        điểm.
      </Notice>
    );
  }

  if (!context.sheet) {
    return (
      <Notice tone="warn">
        Chưa khởi tạo bảng tuần. Chọn <strong>Khởi tạo bảng tuần</strong> để bắt đầu nhập.
      </Notice>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table ref={gridRef} className="data-table">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[110px] bg-[#f7fafd]">Lớp</th>
              {context.criteria.map((criterion) => (
                <th key={criterion.id} title={criterion.name} className="text-center">
                  {criterion.code}
                  <br />
                  <small className="font-normal">{criterion.groupName ?? ''}</small>
                </th>
              ))}
              <th className="text-right">Tổng</th>
              <th>Trạng thái</th>
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
                      {/* Minh chứng gắn theo ô đã có dữ liệu, nên chỉ hiện khi ô có giá trị. */}
                      {entry ? (
                        <button
                          type="button"
                          className={cx(
                            'shrink-0 rounded px-1 text-[11px] leading-none transition-colors',
                            criterion.evidenceRequired ? 'text-red' : 'text-muted hover:text-blue',
                          )}
                          title={
                            criterion.evidenceRequired
                              ? `Minh chứng bắt buộc — ${cls.className} · ${criterion.code}`
                              : `Minh chứng — ${cls.className} · ${criterion.code}`
                          }
                          aria-label={`Minh chứng cho ${cls.className}, tiêu chí ${criterion.name}`}
                          onClick={() => setEvidenceEntryId(entry.id)}
                        >
                          ⛃
                        </button>
                      ) : null}
                    </div>
                  </td>
                );
              });

              return (
                <tr key={cls.id}>
                  <td className="sticky left-0 z-10 bg-card">
                    <strong>{cls.className}</strong>
                  </td>
                  {cells}
                  <td className="text-right font-bold">{total.toFixed(1)}</td>
                  <td>
                    {filled === context.criteria.length ? (
                      <Badge tone="green">Đủ</Badge>
                    ) : (
                      <Badge tone="yellow">
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

      <Notice className="mt-2.5">
        Ô trống = chưa nhập; nhập <strong>0</strong> = có dữ liệu bằng 0; nhập <strong>KAD</strong> =
        không áp dụng; nhập <strong>MIỄN</strong> = được miễn. Có thể dán một vùng dữ liệu từ Excel
        bắt đầu tại ô đang chọn. Enter xuống dòng, Shift+Enter lên dòng. Bấm <strong>⛃</strong> cạnh
        một ô đã nhập để gắn minh chứng.
      </Notice>

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
