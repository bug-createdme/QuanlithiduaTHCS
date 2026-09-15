'use client';

import { AlertTriangle, HelpCircle, ShieldAlert, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';
import { cx } from '@/lib/format';
import { Button, IconButton } from './index';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-[440px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[900px]',
  xl: 'max-w-[1140px]',
};

interface ModalProps {
  open: boolean;
  title: string;
  /** Dòng mô tả ngắn dưới tiêu đề — nói rõ hộp thoại này dùng để làm gì. */
  description?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Cờ cũ, tương đương `size="lg"`. Giữ lại để không phải sửa nơi gọi. */
  wide?: boolean;
}

/**
 * Modal duy nhất được tái sử dụng, giống cách bản gốc dùng chung #modalLayer.
 * Có bẫy tiêu điểm, đóng bằng Escape và trả tiêu điểm về phần tử gọi.
 * Trên điện thoại, modal trượt lên từ đáy như bottom sheet.
 */
export function Modal({
  open,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
  size,
  wide = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Khóa cuộn nền khi modal mở.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      const inputTarget = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      const fallbackTarget = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (inputTarget ?? fallbackTarget)?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const resolvedSize: ModalSize = size ?? (wide ? 'lg' : 'md');

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-[2px] mobile:items-end mobile:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'flex max-h-[calc(100vh-48px)] w-full animate-modal-in flex-col overflow-hidden rounded-xl bg-card shadow-xl',
          SIZE_CLASS[resolvedSize],
          'mobile:max-h-[94vh] mobile:animate-sheet-in mobile:rounded-b-none',
        )}
      >
        {/* Vạch kéo gợi ý thao tác vuốt trên điện thoại. */}
        <div
          className="mx-auto mt-2 hidden h-1 w-10 shrink-0 rounded-full bg-neutral-300 mobile:block"
          aria-hidden
        />

        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600"
                aria-hidden
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="m-0 truncate text-lg font-semibold text-ink">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{description}</p>
              ) : null}
            </div>
          </div>
          <IconButton onClick={onClose} aria-label="Đóng" size="sm" className="border-transparent shadow-none">
            <X size={16} aria-hidden />
          </IconButton>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-neutral-25 px-5 py-3 mobile:pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Hộp thoại xác nhận. Bản gốc luôn nêu rõ hậu quả trước khi xóa
 * ("xóa mềm và vẫn còn trong nhật ký"), nên `description` là bắt buộc.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  cancelToast,
  children,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warn';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  cancelToast?: string | false;
  children?: ReactNode;
}) {
  const { toast } = useToast();
  const Icon = tone === 'primary' ? HelpCircle : tone === 'warn' ? AlertTriangle : ShieldAlert;

  const handleCancel = () => {
    if (cancelToast !== false) {
      toast(typeof cancelToast === 'string' ? cancelToast : 'Đã hủy thao tác.', 'info');
    }
    onCancel();
  };

  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={handleCancel}
      footer={
        <>
          <Button onClick={handleCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5 text-base">
        <div
          className={cx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-full',
            tone === 'danger'
              ? 'bg-danger-50 text-danger-600'
              : tone === 'warn'
                ? 'bg-warning-50 text-warning-600'
                : 'bg-brand-50 text-brand-600',
          )}
        >
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="leading-relaxed text-neutral-700">{description}</div>
          {children}
        </div>
      </div>
    </Modal>
  );
}
