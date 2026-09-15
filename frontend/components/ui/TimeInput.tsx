'use client';

import { Clock } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx, maskTimeText, normalizeTimeText } from '@/lib/format';
import { popoverStyle, usePopover } from './usePopover';

/* ============================================================================
 * Ô nhập giờ theo đồng hồ 24 giờ.
 *
 * Vì sao không dùng `<input type="time">`:
 * Trình duyệt vẽ ô giờ theo NGÔN NGỮ GIAO DIỆN của hệ điều hành. Trên máy cài
 * Windows tiếng Anh, giáo viên thấy `--:-- --` kèm cột AM/PM thay vì giờ 24 —
 * vừa lạ với lịch hoạt động của trường, vừa dễ chọn nhầm sáng/chiều.
 *
 * Thành phần này tự vẽ ô nhập và bảng chọn giờ, nhưng GIÁ TRỊ đưa ra ngoài vẫn
 * là chuỗi `HH:mm` y như trước nên dữ liệu lưu xuống không đổi.
 * ========================================================================== */

const PANEL_WIDTH = 176;
const PANEL_HEIGHT = 248;

/** Phút nhảy 5 đơn vị — đủ dùng cho lịch hoạt động và giữ danh sách ngắn. */
const MINUTE_STEP = 5;

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
  String(index * MINUTE_STEP).padStart(2, '0'),
);

export interface TimeInputProps {
  /** Giá trị `HH:mm`; chuỗi rỗng nghĩa là chưa chọn. */
  value: string;
  onValueChange: (time: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export function TimeInput({
  value,
  onValueChange,
  required,
  disabled,
  invalid,
  name,
  id,
  className,
  'aria-label': ariaLabel,
}: TimeInputProps) {
  const [text, setText] = useState(() => normalizeTimeText(value) ?? '');
  const [open, setOpen] = useState(false);

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
    setText(normalizeTimeText(value) ?? '');
  }, [value]);

  const handleChange = (raw: string) => {
    const masked = maskTimeText(raw);
    setText(masked);
    const time = normalizeTimeText(masked);
    if (time !== null) onValueChange(time);
    else if (masked === '' && value !== '') onValueChange('');
  };

  /** Rời ô mà chữ không thành giờ hợp lệ thì trả về giá trị đang lưu. */
  const handleBlur = () => {
    if (text.trim() === '') {
      if (value !== '') onValueChange('');
      return;
    }
    const time = normalizeTimeText(text);
    if (time === null) setText(normalizeTimeText(value) ?? '');
    else setText(time);
  };

  const [currentHour = '', currentMinute = ''] = (normalizeTimeText(value) ?? '').split(':');

  const pick = (hour: string, minute: string) => {
    onValueChange(`${hour}:${minute}`);
    setText(`${hour}:${minute}`);
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
        placeholder="hh:mm"
        maxLength={5}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        // Mẫu combobox của ARIA: ô nhập chữ kèm bảng chọn bật ra.
        role="combobox"
        aria-haspopup="listbox"
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
          setOpen((current) => !current);
        }}
        className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-40"
      >
        <Clock size={16} />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Chọn giờ"
              style={popoverStyle(position, PANEL_WIDTH)}
              className="z-[90] animate-pop-in overflow-hidden rounded-lg border border-line bg-card shadow-lg"
            >
              <div className="grid grid-cols-2 border-b border-line">
                <p className="border-r border-line px-2 py-1.5 text-center text-2xs font-bold uppercase tracking-[0.06em] text-neutral-400">
                  Giờ
                </p>
                <p className="px-2 py-1.5 text-center text-2xs font-bold uppercase tracking-[0.06em] text-neutral-400">
                  Phút
                </p>
              </div>

              <div className="grid h-[184px] grid-cols-2">
                <ul
                  role="listbox"
                  aria-label="Giờ"
                  className="m-0 list-none overflow-y-auto border-r border-line p-1"
                >
                  {HOURS.map((hour) => {
                    const selected = hour === currentHour;
                    return (
                      <li key={hour}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => pick(hour, currentMinute || '00')}
                          className={cx(
                            'w-full rounded-sm py-1 text-center text-sm tabular-nums transition-colors',
                            selected
                              ? 'bg-brand-600 font-bold text-white'
                              : 'text-neutral-700 hover:bg-brand-50 hover:text-brand-700',
                          )}
                        >
                          {hour}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <ul
                  role="listbox"
                  aria-label="Phút"
                  className="m-0 list-none overflow-y-auto p-1"
                >
                  {MINUTES.map((minute) => {
                    const selected = minute === currentMinute;
                    return (
                      <li key={minute}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => pick(currentHour || '07', minute)}
                          className={cx(
                            'w-full rounded-sm py-1 text-center text-sm tabular-nums transition-colors',
                            selected
                              ? 'bg-brand-600 font-bold text-white'
                              : 'text-neutral-700 hover:bg-brand-50 hover:text-brand-700',
                          )}
                        >
                          {minute}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line px-1.5 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const hour = String(now.getHours()).padStart(2, '0');
                    const minute = String(
                      Math.floor(now.getMinutes() / MINUTE_STEP) * MINUTE_STEP,
                    ).padStart(2, '0');
                    pick(hour, minute);
                    close();
                  }}
                  className="rounded-sm px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  Bây giờ
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
                  Xóa giờ
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
