'use client';

import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';
import { cx } from '@/lib/format';
import { Button, IconButton } from './index';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Modal rộng dùng cho form nhiều cột và bảng, giống cờ `wide` của bản gốc. */
  wide?: boolean;
}

/**
 * Modal duy nhất được tái sử dụng, giống cách bản gốc dùng chung #modalLayer.
 * Có bẫy tiêu điểm, đóng bằng Escape và trả tiêu điểm về phần tử gọi.
 */
export function Modal({ open, title, onClose, children, footer, wide = false }: ModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-[rgba(12,24,40,0.45)] p-4 mobile:items-end mobile:p-0"
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
          'flex max-h-[calc(100vh-48px)] w-full animate-modal-in flex-col rounded-card bg-card shadow-modal',
          wide ? 'max-w-[880px]' : 'max-w-[520px]',
          'mobile:max-h-[92vh] mobile:rounded-b-none',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="m-0 text-[15px] font-bold">{title}</h2>
          <IconButton onClick={onClose} aria-label="Đóng" className="h-8 w-8">
            <X size={16} aria-hidden />
          </IconButton>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3.5">{children}</div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </div>
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
  const Icon = tone === 'primary' ? HelpCircle : AlertTriangle;

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
      onClose={handleCancel}
      footer={
        <>
          <Button onClick={handleCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 text-[13px]">
        <div
          className={cx(
            'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
            tone === 'danger'
              ? 'border border-rose-200 bg-rose-50 text-rose-600'
              : tone === 'warn'
                ? 'border border-amber-200 bg-amber-50 text-amber-600'
                : 'border border-blue-200 bg-blue-50 text-blue-600',
          )}
        >
          <Icon size={19} aria-hidden />
        </div>
        <div className="flex-1 space-y-2.5">
          <div className="leading-relaxed">{description}</div>
          {children}
        </div>
      </div>
    </Modal>
  );
}
