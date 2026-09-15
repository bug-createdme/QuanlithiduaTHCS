'use client';

import { LayoutGrid, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cx } from '@/lib/format';
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from '@/lib/navigation';

/**
 * Thanh điều hướng chính, viết theo hướng mobile-first:
 *
 *  • ≤ 520px  : thanh dưới đáy 5 ô — 4 mục dùng nhiều nhất + nút "Menu" mở
 *               bảng đầy đủ 16 mục chia nhóm. Bản cũ nhồi cả 16 mục vào một
 *               dải cuộn ngang, người dùng phải vuốt mò mới thấy mục cần.
 *  • 521–850  : cột dọc 68px chỉ biểu tượng, có vạch ngăn giữa các nhóm.
 *  • ≥ 851px  : cột dọc 260px, biểu tượng + nhãn, có tiêu đề nhóm;
 *               thu còn 68px khi người dùng bấm thu gọn.
 *
 * Mọi thuộc tính có nhiều giá trị cạnh tranh đều dùng thang min-width (sm/md)
 * để thứ tự ghi đè luôn đúng — xem ghi chú trong tailwind.config.ts.
 */

/** Bốn mục xuất hiện trực tiếp trên thanh đáy điện thoại. */
const MOBILE_PRIMARY = ['/dashboard', '/today', '/tasks', '/scores'];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ───────────────────────────── Thanh bên máy tính ─────────────────────── */

function DesktopNavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cx(
        'group relative flex items-center rounded-md text-base transition-colors duration-150',
        'sm:my-0.5 sm:h-9 sm:w-full sm:justify-center sm:px-0',
        collapsed ? 'md:justify-center md:px-0' : 'md:justify-start md:gap-3 md:px-3',
        active
          ? 'bg-sidebar-active font-semibold text-white shadow-sm'
          : 'text-sidebar-text hover:bg-white/[0.08] hover:text-white',
      )}
    >
      {/* Vạch chỉ báo bên trái: trạng thái "đang xem" không chỉ dựa vào màu nền. */}
      <span
        aria-hidden
        className={cx(
          'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon size={18} className="shrink-0" aria-hidden />
      <span className={cx('hidden truncate', !collapsed && 'md:block')}>{item.label}</span>
    </Link>
  );
}

/* ───────────────────────── Bảng điều hướng điện thoại ─────────────────── */

function MobileNavSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  // Khóa cuộn nền khi bảng mở.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in flex-col justify-end bg-neutral-950/50 sm:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tất cả chức năng"
        className="max-h-[86vh] animate-sheet-in overflow-auto rounded-t-xl bg-card pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-4 py-3">
          <h2 className="m-0 text-lg font-semibold">Tất cả chức năng</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-ink"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        <div className="px-3 py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="mb-3">
              <p className="px-1 pb-1.5 text-2xs font-bold uppercase tracking-[0.07em] text-neutral-400">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5 xs:grid-cols-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'flex items-center gap-2.5 rounded-md border px-2.5 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'border-brand-200 bg-brand-50 text-brand-700'
                          : 'border-line bg-white text-neutral-700 hover:bg-neutral-50',
                      )}
                    >
                      <Icon size={17} className="shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────── Thanh bên ───────────────────────────── */

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const primaryItems = MOBILE_PRIMARY.map(
    (href) => NAV_ITEMS.find((item) => item.href === href)!,
  );
  const restActive = !primaryItems.some((item) => isActive(pathname, item.href));

  return (
    <>
      <aside
        id="sidebar"
        className={cx(
          'z-20 flex flex-col bg-sidebar text-sidebar-text',
          // Điện thoại: hàng thứ 3 của lưới, thanh điều hướng đáy.
          'col-span-1 row-start-3 h-[calc(68px+env(safe-area-inset-bottom))] w-full',
          'border-t border-white/10 pb-[env(safe-area-inset-bottom)]',
          // Từ 521px trở lên: cột dọc chiếm cả hai hàng.
          'sm:col-span-1 sm:row-span-2 sm:row-start-1 sm:h-auto sm:border-t-0 sm:pb-0',
        )}
      >
        {/* ── Thương hiệu — ẩn trên điện thoại ─────────────────────────── */}
        <div
          className={cx(
            'hidden h-topbar shrink-0 items-center gap-2.5 border-b border-white/10',
            'sm:flex sm:justify-center sm:px-0',
            collapsed ? 'md:justify-center md:px-0' : 'md:justify-start md:px-4',
          )}
        >
          <span className="relative h-9 w-9 shrink-0 drop-shadow-sm">
            <Image
              src="/images/logo-thcs-le-ninh.png"
              alt="Logo THCS Lệ Ninh"
              width={36}
              height={36}
              className="h-full w-full object-contain"
            />
          </span>
          <span className={cx('hidden min-w-0', !collapsed && 'md:block')}>
            <strong className="block truncate text-sm font-bold leading-tight text-white">
              TRỢ LÝ TỔNG PHỤ TRÁCH
            </strong>
            <span className="block truncate text-2xs text-sidebar-dim">Công tác Đội THCS</span>
          </span>
        </div>

        {/* ── Điều hướng ───────────────────────────────────────────────── */}
        <nav
          aria-label="Điều hướng chính"
          className={cx(
            // Điện thoại: 5 ô chia đều chiều ngang.
            'grid h-[68px] grid-cols-5 items-stretch px-1',
            // Từ 521px: danh sách dọc cuộn được.
            'sm:block sm:h-auto sm:flex-1 sm:overflow-y-auto sm:overflow-x-hidden sm:px-2 sm:py-2.5',
          )}
        >
          {/* Điện thoại: 4 mục chính + nút mở bảng đầy đủ. */}
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={`m-${item.href}`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-center transition-colors sm:hidden',
                  active ? 'bg-white/10 text-white' : 'text-sidebar-dim active:bg-white/5',
                )}
              >
                <Icon size={19} className="shrink-0" aria-hidden />
                <span className="w-full truncate text-[10px] font-semibold leading-none">
                  {item.short}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className={cx(
              'flex flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-center transition-colors sm:hidden',
              restActive ? 'bg-white/10 text-white' : 'text-sidebar-dim active:bg-white/5',
            )}
          >
            <LayoutGrid size={19} className="shrink-0" aria-hidden />
            <span className="w-full truncate text-[10px] font-semibold leading-none">Tất cả</span>
          </button>

          {/* Từ 521px: đủ 16 mục chia theo nhóm nghiệp vụ. */}
          <div className="hidden sm:block">
            {NAV_GROUPS.map((group, index) => (
              <div key={group.id} className={cx(index > 0 && 'mt-3')}>
                <p
                  className={cx(
                    'px-3 pb-1 text-2xs font-bold uppercase tracking-[0.07em] text-sidebar-dim/70',
                    'hidden',
                    !collapsed && 'md:block',
                  )}
                >
                  {group.label}
                </p>
                {/* Ở dạng thu gọn, vạch ngang thay cho tiêu đề nhóm. */}
                <div
                  aria-hidden
                  className={cx(
                    'mx-3 mb-2 h-px bg-white/10',
                    index === 0 && 'hidden',
                    !collapsed && 'md:hidden',
                  )}
                />
                {group.items.map((item) => (
                  <DesktopNavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            ))}
          </div>
        </nav>

        {/* ── Chân thanh bên: nút thu gọn ──────────────────────────────── */}
        <div className="mt-auto hidden shrink-0 border-t border-white/10 p-2 md:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            className={cx(
              'flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-dim transition-colors hover:bg-white/[0.08] hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden />
            ) : (
              <PanelLeftClose size={18} aria-hidden />
            )}
            {!collapsed ? <span>Thu gọn</span> : null}
          </button>
        </div>
      </aside>

      <MobileNavSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
