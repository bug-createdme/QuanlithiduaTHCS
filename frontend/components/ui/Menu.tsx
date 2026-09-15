'use client';

import { MoreHorizontal } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/format';

/**
 * Menu thả xuống dùng chung (menu thao tác của dòng bảng, menu tài khoản…).
 *
 * Bảng menu được vẽ qua portal với `position: fixed` vì rất nhiều nơi gọi nó
 * nằm bên trong `.table-wrap` (overflow: auto) — nếu định vị tuyệt đối theo
 * cha thì menu sẽ bị cắt mất ở mép vùng cuộn.
 */

interface MenuProps {
  /** Nội dung nút mở. Bỏ trống thì dùng nút ba chấm mặc định. */
  trigger?: ReactNode;
  label?: string;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
  panelClassName?: string;
}

const PANEL_GAP = 6;
const ESTIMATED_PANEL_HEIGHT = 220;

export function Menu({
  trigger,
  label = 'Mở menu thao tác',
  children,
  align = 'end',
  className,
  panelClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const button = triggerRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth ?? 200;
    const panelHeight = panelRef.current?.offsetHeight ?? ESTIMATED_PANEL_HEIGHT;

    // Lật lên trên khi không đủ chỗ bên dưới.
    const openUp = rect.bottom + PANEL_GAP + panelHeight > window.innerHeight && rect.top > panelHeight;
    const top = openUp ? rect.top - PANEL_GAP - panelHeight : rect.bottom + PANEL_GAP;
    const rawLeft = align === 'end' ? rect.right - panelWidth : rect.left;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - panelWidth - 8);

    setPosition({ top: Math.max(8, top), left });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onReflow = () => setOpen(false);

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReflow);
    // `true` để bắt cả cuộn bên trong vùng có overflow (bảng dữ liệu).
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={trigger ? undefined : label}
        onClick={() => setOpen((current) => !current)}
        className={cx(
          trigger
            ? 'inline-flex items-center rounded-md transition-colors'
            : 'grid h-control-sm w-control-sm place-items-center rounded-md border border-transparent text-neutral-500 transition-colors hover:border-line hover:bg-neutral-100 hover:text-ink',
          open && !trigger && 'border-line bg-neutral-100 text-ink',
          className,
        )}
      >
        {trigger ?? <MoreHorizontal size={16} aria-hidden />}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{
                position: 'fixed',
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
              }}
              className={cx('menu-panel', panelClassName)}
            >
              {children(close)}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function MenuItem({
  icon,
  danger,
  disabled,
  onClick,
  children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cx('menu-item', danger && 'menu-item-danger')}
    >
      {icon ? <span className="shrink-0 opacity-80">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="menu-label">{children}</p>;
}

export function MenuSeparator() {
  return <div className="menu-sep" role="separator" />;
}
