'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from '@/lib/format';
import { statusLabel, statusTone, type BadgeTone } from '@/lib/labels';

/* ============================================================================
 * Bộ thành phần dùng chung của hệ thống thiết kế.
 *
 * Quy ước:
 *  • Mọi kích thước/màu đến từ token trong `globals.css` — không màu rời rạc.
 *  • Mỗi thành phần có đủ trạng thái: mặc định, hover, focus, disabled, loading.
 *  • Thành phần nào có thể bấm đều đạt vùng chạm tối thiểu 30–36px.
 * ========================================================================== */

/* ────────────────────────────── Nút ────────────────────────────────────── */

type ButtonVariant = 'default' | 'primary' | 'danger' | 'success' | 'soft' | 'ghost';
type ControlSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  icon?: ReactNode;
  /** Biểu tượng đặt sau nhãn, ví dụ mũi tên "đi tiếp". */
  iconRight?: ReactNode;
  /** Nút vuông chỉ có biểu tượng — bắt buộc kèm `aria-label`. */
  iconOnly?: boolean;
  /** Chiếm trọn chiều ngang khối cha (hữu ích trên điện thoại). */
  block?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  primary: 'btn-primary',
  danger: 'btn-danger',
  success: 'btn-success',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
};

const ICON_SIZE: Record<ControlSize, number> = { sm: 14, md: 15, lg: 17 };

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  iconOnly = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'btn',
        VARIANT_CLASS[variant],
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        iconOnly && 'btn-icon',
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={ICON_SIZE[size]} className="animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {iconOnly ? null : children}
      {!loading && iconRight ? iconRight : null}
    </button>
  );
}

export function IconButton({
  className,
  size = 'md',
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: ControlSize }) {
  return (
    <button
      type={type}
      className={cx(
        'icon-btn',
        size === 'sm' && 'h-control-sm w-control-sm',
        size === 'lg' && 'h-control-lg w-control-lg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  className,
  tone,
  icon,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'red'; icon?: ReactNode }) {
  return (
    <button
      type={type}
      className={cx('link-btn', tone === 'red' && 'link-btn-red', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ───────────────────────────── Nhãn trạng thái ─────────────────────────── */

export function Badge({
  tone = 'default',
  dot = false,
  icon,
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  /** Thêm chấm tròn để trạng thái không chỉ phân biệt bằng màu sắc. */
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'badge',
        tone === 'green' && 'badge-green',
        tone === 'blue' && 'badge-blue',
        tone === 'yellow' && 'badge-yellow',
        tone === 'red' && 'badge-red',
        dot && 'badge-dot',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Badge tự chọn màu và nhãn từ giá trị enum trạng thái. */
export function StatusBadge({
  value,
  fallback,
  className,
}: {
  value: string | null | undefined;
  fallback?: string;
  className?: string;
}) {
  if (!value) {
    return (
      <Badge tone="yellow" dot className={className}>
        {fallback ?? 'Chưa tạo'}
      </Badge>
    );
  }
  return (
    <Badge tone={statusTone(value)} dot className={className}>
      {statusLabel(value)}
    </Badge>
  );
}

export function Chip({
  children,
  className,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <span className={cx('chip', className)} title={title}>
      {icon}
      {children}
    </span>
  );
}

/* ─────────────────────────────── Thẻ ───────────────────────────────────── */

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={cx('card', className)}>{children}</Tag>;
}

export function CardHead({
  title,
  description,
  icon,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('card-head', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
          ) : null}
        </div>
      </div>
      {meta || actions ? (
        <div className="flex shrink-0 items-center gap-2">
          {meta ? <span className="text-xs text-neutral-500">{meta}</span> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card-body', className)}>{children}</div>;
}

export function CardFoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ─────────────────────── Thẻ chỉ số (KPI) ──────────────────────────────── */

export type StatTone = 'default' | 'brand' | 'success' | 'warning' | 'danger';

const STAT_ICON_CLASS: Record<StatTone, string> = {
  default: 'bg-neutral-100 text-neutral-600',
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
};

const STAT_VALUE_CLASS: Record<StatTone, string> = {
  default: 'text-ink',
  brand: 'text-brand-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
};

/**
 * Ô số liệu tổng quan. Bấm được thì trở thành nút dẫn tới danh sách đã lọc —
 * người dùng luôn đi được từ "con số" tới "bản ghi nào tạo ra con số đó".
 */
export function StatCard({
  value,
  label,
  hint,
  icon,
  tone = 'default',
  onClick,
  className,
  valueClassName,
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  onClick?: () => void;
  className?: string;
  /** Ghi đè cỡ chữ của con số — dùng khi giá trị là chuỗi dài (ngày giờ…). */
  valueClassName?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug text-neutral-600">{label}</span>
        {icon ? (
          <span
            className={cx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors',
              STAT_ICON_CLASS[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cx(
            'font-bold tabular-nums',
            valueClassName ?? 'text-3xl',
            STAT_VALUE_CLASS[tone],
          )}
        >
          {value}
        </span>
      </div>
      {hint ? <p className="mt-1 text-xs leading-snug text-neutral-500">{hint}</p> : null}
    </>
  );

  const base =
    'flex flex-col rounded-lg border border-line bg-card p-3.5 text-left shadow-xs transition-all duration-150';

  if (!onClick) return <div className={cx(base, className)}>{inner}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        base,
        'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md active:translate-y-0',
        className,
      )}
    >
      {inner}
    </button>
  );
}

/* ─────────────────────────── Thông báo & trạng thái ────────────────────── */

export function Notice({
  tone = 'info',
  title,
  children,
  className,
  onDismiss,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success' | 'neutral';
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  const Icon =
    tone === 'danger'
      ? ShieldAlert
      : tone === 'warn'
        ? AlertTriangle
        : tone === 'success'
          ? CheckCircle2
          : Info;
  return (
    <div
      className={cx(
        'notice',
        tone === 'warn' && 'notice-warn',
        tone === 'danger' && 'notice-danger',
        tone === 'success' && 'notice-success',
        tone === 'neutral' && 'notice-neutral',
        className,
      )}
      role={tone === 'info' || tone === 'neutral' ? undefined : 'alert'}
    >
      <Icon size={16} className="mt-[1px] shrink-0 opacity-90" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <strong className="mb-0.5 block">{title}</strong> : null}
        {children}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="-mr-1 -mt-0.5 shrink-0 rounded-sm p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('empty-state', className)}>
      <div className="max-w-[420px]">
        {icon ? (
          <span
            className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <p className="m-0 text-lg font-semibold text-ink">{title}</p>
        {hint ? <p className="mt-1.5 text-sm leading-relaxed">{hint}</p> : null}
        {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <Loader2 size={18} className="animate-spin text-brand-600" aria-hidden />
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'Không thể hiển thị dữ liệu. Hãy thử lại.';
  return (
    <Notice tone="danger" title="Không thể hiển thị dữ liệu.">
      <span>{message}</span>
      {onRetry ? (
        <div className="mt-2.5">
          <Button size="sm" icon={<RotateCcw size={13} aria-hidden />} onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : null}
    </Notice>
  );
}

/* ──────────────────────────── Khung xương tải ──────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('skeleton block', className)} aria-hidden />;
}

/** Khung xương cho bảng — giữ nguyên chiều cao nên bố cục không giật khi tải. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap" role="status" aria-label="Đang tải bảng dữ liệu">
      <div className="divide-y divide-neutral-100">
        <div className="flex gap-3 bg-neutral-50 px-3 py-3">
          {Array.from({ length: cols }).map((_, index) => (
            <Skeleton key={index} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-3 px-3 py-3">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cx('h-3.5 flex-1', colIndex === 0 && 'max-w-[38%]')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4" role="status" aria-label="Đang tải">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cx('h-3', index === lines - 1 && 'w-2/3')} />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────── Tiêu đề trang ──────────────────────────── */

export function PageHead({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** Dòng ngữ cảnh nhỏ phía trên tiêu đề (nhóm chức năng, phạm vi…). */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-2xs font-bold uppercase tracking-[0.08em] text-brand-600">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="m-0 text-2xl font-bold leading-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-[72ch] text-sm leading-relaxed text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="no-print flex flex-wrap items-center gap-2 tablet:w-full">{actions}</div>
      ) : null}
    </header>
  );
}

/** Tiêu đề phân đoạn bên trong một trang dài. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mb-2.5 flex items-center justify-between gap-3', className)}>
      <h2 className="m-0 text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

/* ──────────────────────────────── Trường nhập ──────────────────────────── */

export function Field({
  label,
  required,
  hint,
  error,
  full,
  className,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  // Dùng thẻ <label> bọc ngoài để nhãn gắn thật vào ô nhập bên trong: trình đọc
  // màn hình đọc đúng tên trường và bấm vào nhãn thì con trỏ nhảy vào ô.
  // Cách này không cần đặt id cho từng ô nên áp dụng được cho mọi biểu mẫu.
  return (
    <label className={cx('block', full && 'full', className)}>
      {label ? (
        <span className={cx('field-label', required && 'field-label-required')}>{label}</span>
      ) : null}
      {children}
      {error ? (
        <span className="field-error" role="alert">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

/** Nhóm các trường liên quan thành một phần có tiêu đề trong biểu mẫu dài. */
export function FormSection({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <div className="form-section">
        <div className="form-section-title">{title}</div>
      </div>
      {children}
    </>
  );
}

export function TextInput({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx('field-input', invalid && 'field-input-error', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function TextArea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cx('field-textarea', invalid && 'field-input-error', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  multiple,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      multiple={multiple}
      // Mũi tên chỉ hợp lý với select một dòng; danh sách nhiều lựa chọn không có nó.
      className={cx(
        'field-input',
        !multiple && 'field-select',
        invalid && 'field-input-error',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export { DateInput } from './DateInput';
export type { DateInputProps } from './DateInput';
export { TimeInput } from './TimeInput';
export type { TimeInputProps } from './TimeInput';

/** Ô tìm kiếm có biểu tượng và nút xóa nhanh. */
export function SearchInput({
  value,
  onValueChange,
  className,
  placeholder = 'Tìm kiếm…',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={cx('relative min-w-0', className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="field-input pl-9 pr-8 [&::-webkit-search-cancel-button]:appearance-none"
        {...rest}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Xóa từ khóa tìm kiếm"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: string }) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-2.5 rounded-md py-1 text-base text-neutral-700',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-[2px] h-[16px] w-[16px] shrink-0 cursor-pointer rounded-xs accent-brand-600"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Công tắc bật/tắt — dùng cho tùy chọn có hiệu lực ngay. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-center gap-2.5 text-base text-neutral-700',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-brand-600' : 'bg-neutral-300',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

/* ────────────────────────────────── Tabs ───────────────────────────────── */

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ id: T; label: string; badge?: ReactNode; icon?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'mb-3 flex gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1 shadow-xs no-scrollbar',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-base font-semibold transition-all duration-150',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-ink',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

/** Chuyển đổi cách hiển thị (danh sách ↔ lưới ↔ kanban). */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: Array<{ id: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex h-control shrink-0 items-center gap-0.5 rounded-md border border-line bg-neutral-50 p-0.5',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cx(
              'inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 text-xs font-semibold transition-all duration-150',
              active
                ? 'bg-white text-brand-700 shadow-xs'
                : 'text-neutral-500 hover:text-ink',
            )}
          >
            {item.icon}
            {/* Tren dien thoai chi con bieu tuong, nhung nhan van doc duoc bang trinh doc man hinh. */}
            <span className="mobile:sr-only">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Thanh tiến độ ───────────────────────────── */

export function ProgressBar({
  value,
  className,
  tone,
  label,
}: {
  value: number;
  className?: string;
  /** Tự chọn màu theo mức hoàn thành khi không truyền. */
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  label?: string;
}) {
  const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const resolved =
    tone ?? (percent >= 100 ? 'success' : percent >= 50 ? 'brand' : percent > 0 ? 'warning' : 'brand');
  return (
    <div
      className={cx('progress-track', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      title={label ?? `${percent}%`}
    >
      <span
        className={cx(
          'progress-fill',
          resolved === 'success' && 'bg-success-600',
          resolved === 'warning' && 'bg-warning-500',
          resolved === 'danger' && 'bg-danger-600',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/* ─────────────────────────────── Bảng ──────────────────────────────────── */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('table-wrap', className)}>
      <table className="data-table">{children}</table>
    </div>
  );
}

/** Hàng "không có dữ liệu" trải hết chiều rộng bảng. */
export function TableEmptyRow({
  colSpan,
  children,
  action,
}: {
  colSpan: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <tr className="hover:!bg-transparent">
      <td colSpan={colSpan} className="px-3 py-12 text-center">
        <p className="m-0 text-base font-medium text-neutral-500">{children}</p>
        {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
      </td>
    </tr>
  );
}

/* ──────────────────────────── Phân trang ───────────────────────────────── */

/** Sinh dãy trang rút gọn: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const items: Array<number | 'gap'> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) items.push('gap');
  for (let index = from; index <= to; index += 1) items.push(index);
  if (to < pageCount - 1) items.push('gap');
  items.push(pageCount);
  return items;
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Phân trang"
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2 shadow-xs"
    >
      <span className="text-xs text-neutral-500">
        Hiển thị <strong className="text-ink">{from}</strong>–
        <strong className="text-ink">{to}</strong> trong{' '}
        <strong className="text-ink">{total}</strong> bản ghi
      </span>

      <div className="flex items-center gap-1">
        <IconButton
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft size={15} aria-hidden />
        </IconButton>

        {pageWindow(page, pageCount).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-neutral-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={cx(
                'h-control-sm min-w-[30px] rounded-md px-2 text-xs font-semibold tabular-nums transition-colors',
                item === page
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-ink',
              )}
            >
              {item}
            </button>
          ),
        )}

        <IconButton
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <ChevronRight size={15} aria-hidden />
        </IconButton>
      </div>
    </nav>
  );
}

/* ───────────────────────────── Thanh công cụ ───────────────────────────── */

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('toolbar no-print', className)}>{children}</div>;
}

/** Hai cột trái–phải trên một dòng, dùng nhiều trong các thẻ thống kê. */
export function Split({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-base last:border-b-0',
        className,
      )}
    >
      <span className="text-neutral-500">{label}</span>
      <strong className="text-right font-semibold text-ink">{children}</strong>
    </div>
  );
}

/* ──────────────────────────────── Avatar ───────────────────────────────── */

export function Avatar({
  name,
  size = 32,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white',
        className,
      )}
    >
      {initial}
    </span>
  );
}
