'use client';

import { AlertTriangle, Info, Loader2, ShieldAlert } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/format';
import { statusLabel, statusTone, type BadgeTone } from '@/lib/labels';

/* ────────────────────────────── Nút ────────────────────────────────────── */

type ButtonVariant = 'default' | 'primary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
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
      className={cx(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'danger' && 'btn-danger',
        size === 'sm' && 'btn-sm',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx('icon-btn', className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  className,
  tone,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'red' }) {
  return (
    <button
      type={type}
      className={cx('link-btn', tone === 'red' && 'link-btn-red', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ───────────────────────────── Nhãn trạng thái ─────────────────────────── */

export function Badge({
  tone = 'default',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'badge',
        tone === 'green' && 'badge-green',
        tone === 'blue' && 'badge-blue',
        tone === 'yellow' && 'badge-yellow',
        tone === 'red' && 'badge-red',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge tự chọn màu và nhãn từ giá trị enum trạng thái. */
export function StatusBadge({ value, fallback }: { value: string | null | undefined; fallback?: string }) {
  if (!value) return <Badge tone="yellow">{fallback ?? 'Chưa tạo'}</Badge>;
  return <Badge tone={statusTone(value)}>{statusLabel(value)}</Badge>;
}

/* ─────────────────────────────── Thẻ ───────────────────────────────────── */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('card', className)}>{children}</section>;
}

export function CardHead({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card-head">
      <h2>{title}</h2>
      <div className="flex items-center gap-2">
        {meta ? <span className="text-[12px] text-muted">{meta}</span> : null}
        {actions}
      </div>
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card-body', className)}>{children}</div>;
}

/* ─────────────────────────── Thông báo & trạng thái ────────────────────── */

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'danger' ? ShieldAlert : tone === 'warn' ? AlertTriangle : Info;
  return (
    <div
      className={cx(
        'notice flex items-start gap-2',
        tone === 'warn' && 'notice-warn',
        tone === 'danger' && 'notice-danger',
        className,
      )}
      role={tone === 'info' ? undefined : 'alert'}
    >
      <Icon size={15} className="mt-[2px] shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>
        <p className="m-0 font-semibold text-ink">{title}</p>
        {hint ? <p className="mt-1 text-[12.5px]">{hint}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin text-blue" aria-hidden />
        <span>{label}</span>
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
    <Notice tone="danger">
      <strong className="block">Không thể hiển thị dữ liệu.</strong>
      <span>{message}</span>
      {onRetry ? (
        <div className="mt-2">
          <Button size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : null}
    </Notice>
  );
}

/* ────────────────────────────── Tiêu đề trang ──────────────────────────── */

export function PageHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="m-0 text-[19px] font-bold leading-tight">{title}</h1>
        {description ? <p className="mt-1 text-[12.5px] text-muted">{description}</p> : null}
      </div>
      {actions ? (
        <div className="no-print flex flex-wrap items-center gap-2 tablet:w-full">{actions}</div>
      ) : null}
    </header>
  );
}

/* ──────────────────────────────── Trường nhập ──────────────────────────── */

export function Field({
  label,
  required,
  hint,
  error,
  full,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  // Dùng thẻ <label> bọc ngoài để nhãn gắn thật vào ô nhập bên trong: trình đọc
  // màn hình đọc đúng tên trường và bấm vào nhãn thì con trỏ nhảy vào ô.
  // Cách này không cần đặt id cho từng ô nên áp dụng được cho mọi biểu mẫu.
  return (
    <label className={cx('block', full && 'full')}>
      {label ? (
        <span className={cx('field-label', required && 'field-label-required')}>{label}</span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-semibold text-red">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('field-input', className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('field-textarea', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('field-input pr-7', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-2 text-[13px]', className)}>
      <input
        type="checkbox"
        className="h-[15px] w-[15px] shrink-0 accent-[#0b6bcb]"
        {...rest}
      />
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
  items: Array<{ id: T; label: string; badge?: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx('mb-2.5 flex gap-1 overflow-x-auto border-b border-line', className)}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
          className={cx(
            'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors',
            item.id === value
              ? 'border-blue text-blue'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {item.label}
          {item.badge}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Thanh tiến độ ───────────────────────────── */

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={cx('progress-track', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="progress-fill" style={{ width: `${percent}%` }} />
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
export function TableEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-[13px] text-muted">
        {children}
      </td>
    </tr>
  );
}

/* ──────────────────────────── Phân trang ───────────────────────────────── */

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
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted">
      <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ‹ Trước
      </Button>
      <span>
        Trang {page}/{pageCount} • {total} bản ghi • {pageSize} dòng/trang
      </span>
      <Button size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Sau ›
      </Button>
    </div>
  );
}

/* ───────────────────────────── Thanh công cụ ───────────────────────────── */

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('toolbar no-print', className)}>{children}</div>;
}

/** Hai cột trái–phải trên một dòng, dùng nhiều trong các thẻ thống kê. */
export function Split({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <strong className="text-right">{children}</strong>
    </div>
  );
}
