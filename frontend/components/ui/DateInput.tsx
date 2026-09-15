'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx, dateTextToIso, isoToDateText, maskDateText, todayISO } from '@/lib/format';
import { popoverStyle, usePopover } from './usePopover';

/* ============================================================================
 * Ô nhập ngày theo định dạng Việt Nam.
 *
 * Vì sao không dùng `<input type="date">`:
 * Chrome/Edge vẽ ô ngày theo NGÔN NGỮ GIAO DIỆN của hệ điều hành chứ không theo
 * `lang="vi"` của tài liệu. Trên máy cài Windows tiếng Anh, giáo viên thấy
 * `mm/dd/yyyy` và rất dễ nhập nhầm 09/07 thành ngày 7 tháng 9.
 *
 * Thành phần này tự vẽ cả ô nhập lẫn lịch chọn, luôn hiển thị `dd/MM/yyyy`,
 * nhưng GIÁ TRỊ đưa ra ngoài vẫn là chuỗi ISO `YYYY-MM-DD` y như trước — nên
 * mọi payload gửi lên máy chủ không đổi một ký tự nào.
 * ========================================================================== */

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTHS = Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`);

const PANEL_WIDTH = 296;
const PANEL_HEIGHT = 348;

/** Số năm hiển thị trong ô chọn năm, tính từ năm hiện tại. */
const YEAR_BACK = 10;
const YEAR_FORWARD = 10;

const pad = (value: number) => String(value).padStart(2, '0');
const toIso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Lưới 42 ô (6 tuần × 7 ngày), tuần bắt đầu Thứ Hai. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = Chủ nhật. Công thức đưa ô đầu tiên về Thứ Hai của tuần chứa ngày 1.
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export interface DateInputProps {
  /** Giá trị ISO `YYYY-MM-DD`; chuỗi rỗng nghĩa là chưa chọn. */
  value: string;
  onValueChange: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Giới hạn ISO, ví dụ không cho chọn trước ngày bắt đầu. */
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export function DateInput({
  value,
  onValueChange,
  required,
  disabled,
  invalid,
  min,
  max,
  name,
  id,
  className,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const [text, setText] = useState(() => isoToDateText(value));
  const [open, setOpen] = useState(false);
  /** Tháng đang xem trong lịch, không nhất thiết trùng ngày đã chọn. */
  const [cursor, setCursor] = useState(() => new Date(`${value || todayISO()}T00:00:00`));

  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const close = useCallback((focusBack = true) => {
    setOpen(false);
    if (focusBack) inputRef.current?.focus();
  }, []);

  const { anchorRef, panelRef, position } = usePopover({
    open,
    onClose: close,
    estimatedWidth: PANEL_WIDTH,
    estimatedHeight: PANEL_HEIGHT,
  });

  // Giá trị đổi từ bên ngoài (nạp bản ghi, đặt lại biểu mẫu) thì đồng bộ lại chữ.
  useEffect(() => {
    setText(isoToDateText(value));
    if (value) setCursor(new Date(`${value}T00:00:00`));
  }, [value]);

  const commit = useCallback(
    (next: string) => {
      const iso = dateTextToIso(next);
      if (iso !== null && iso !== value) onValueChange(iso);
      if (next.trim() === '' && value !== '') onValueChange('');
    },
    [onValueChange, value],
  );

  const handleChange = (raw: string) => {
    const masked = maskDateText(raw);
    setText(masked);
    // Đủ 10 ký tự và là ngày có thật thì phát ngay, không đợi rời ô.
    const iso = dateTextToIso(masked);
    if (iso !== null) onValueChange(iso);
    else if (masked === '' && value !== '') onValueChange('');
  };

  /** Rời ô mà chữ không thành ngày hợp lệ thì trả về giá trị đang lưu. */
  const handleBlur = () => {
    if (text.trim() === '') {
      commit('');
      return;
    }
    if (dateTextToIso(text) === null) setText(isoToDateText(value));
  };

  const pick = (date: Date) => {
    const iso = toIso(date);
    if ((min && iso < min) || (max && iso > max)) return;
    onValueChange(iso);
    setText(isoToDateText(iso));
    close();
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const today = todayISO();

  const years = useMemo(() => {
    const base = new Date().getFullYear();
    const from = Math.min(base - YEAR_BACK, year);
    const to = Math.max(base + YEAR_FORWARD, year);
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }, [year]);

  /** Mũi tên di chuyển theo ngày/tuần ngay trên lưới lịch. */
  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowRight'
          ? 1
          : event.key === 'ArrowUp'
            ? -7
            : event.key === 'ArrowDown'
              ? 7
              : 0;
    if (step === 0) return;
    event.preventDefault();
    const from = value ? new Date(`${value}T00:00:00`) : new Date(`${today}T00:00:00`);
    const next = new Date(from);
    next.setDate(from.getDate() + step);
    setCursor(next);
    onValueChange(toIso(next));
    setText(isoToDateText(toIso(next)));
  };

  return (
    <div ref={anchorRef} className={cx('relative', className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        /*
         * Mẫu "date picker combobox" của ARIA APG: ô nhập chữ kèm bảng lịch bật ra.
         * Vai trò textbox ngầm định KHÔNG nhận aria-expanded, phải khai báo combobox.
         */
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cx('field-input pr-10 tabular-nums', invalid && 'field-input-error')}
      />

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-hidden
        onClick={() => {
          if (disabled) return;
          setCursor(new Date(`${value || todayISO()}T00:00:00`));
          setOpen((current) => !current);
        }}
        className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-40"
      >
        <CalendarDays size={16} />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Chọn ngày"
              style={popoverStyle(position, PANEL_WIDTH)}
              className="z-[90] animate-pop-in rounded-lg border border-line bg-card p-2.5 shadow-lg"
            >
              {/* ── Chọn tháng / năm ─────────────────────────────────── */}
              <div className="mb-2 flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Tháng trước"
                  onClick={() => setCursor(new Date(year, month - 1, 1))}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  <ChevronLeft size={15} aria-hidden />
                </button>

                <select
                  aria-label="Tháng"
                  value={month}
                  onChange={(event) => setCursor(new Date(year, Number(event.target.value), 1))}
                  className="field-input field-select h-8 min-w-0 flex-1 px-2 text-sm"
                >
                  {MONTHS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Năm"
                  value={year}
                  onChange={(event) => setCursor(new Date(Number(event.target.value), month, 1))}
                  className="field-input field-select h-8 w-[84px] shrink-0 px-2 text-sm"
                >
                  {years.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  aria-label="Tháng sau"
                  onClick={() => setCursor(new Date(year, month + 1, 1))}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  <ChevronRight size={15} aria-hidden />
                </button>
              </div>

              {/* ── Lưới ngày ────────────────────────────────────────── */}
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((day, index) => (
                  <div
                    key={day}
                    className={cx(
                      'grid h-7 place-items-center text-2xs font-bold uppercase',
                      index >= 5 ? 'text-brand-600' : 'text-neutral-400',
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div
                role="grid"
                tabIndex={0}
                onKeyDown={onGridKeyDown}
                className="grid grid-cols-7 gap-0.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {cells.map((cell) => {
                  const iso = toIso(cell);
                  const outside = cell.getMonth() !== month;
                  const selected = iso === value;
                  const isToday = iso === today;
                  const blocked = Boolean((min && iso < min) || (max && iso > max));
                  return (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      aria-selected={selected}
                      aria-current={isToday ? 'date' : undefined}
                      disabled={blocked}
                      onClick={() => pick(cell)}
                      className={cx(
                        'grid h-8 place-items-center rounded-sm text-sm tabular-nums transition-colors',
                        selected
                          ? 'bg-brand-600 font-bold text-white'
                          : blocked
                            ? 'cursor-not-allowed text-neutral-300'
                            : outside
                              ? 'text-neutral-300 hover:bg-neutral-100'
                              : 'text-neutral-700 hover:bg-brand-50 hover:text-brand-700',
                        isToday && !selected && 'font-bold text-brand-700 ring-1 ring-brand-200',
                      )}
                    >
                      {cell.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* ── Lối tắt ──────────────────────────────────────────── */}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => pick(new Date(`${today}T00:00:00`))}
                  className="rounded-sm px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange('');
                    setText('');
                    close();
                  }}
                  className="rounded-sm px-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  Xóa ngày
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
