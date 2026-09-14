'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/format';
import { NAV_ITEMS } from '@/lib/navigation';

/**
 * Thanh điều hướng, viết theo hướng mobile-first đúng như bản gốc hiển thị:
 *  • ≤ 520px  : thanh ngang cố định dưới đáy, cuộn ngang có scroll-snap,
 *               mỗi mục 112×62px xếp dọc biểu tượng + nhãn ngắn
 *  • 521–850  : cột dọc 64px, chỉ biểu tượng
 *  • ≥ 851px  : cột dọc 248px, biểu tượng + nhãn đầy đủ
 *               (thu còn 64px khi người dùng bấm thu gọn)
 *
 * Mọi thuộc tính có nhiều giá trị cạnh tranh đều dùng thang min-width (sm/md)
 * để thứ tự ghi đè luôn đúng — xem ghi chú trong tailwind.config.ts.
 */
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar"
      className={cx(
        'z-20 flex flex-col bg-sidebar text-sidebar-text',
        // Điện thoại: nằm hàng thứ 3 của lưới, cao bằng vùng an toàn.
        'col-span-1 row-start-3 h-[calc(70px+env(safe-area-inset-bottom))] w-full pb-[env(safe-area-inset-bottom)]',
        // Từ 521px trở lên: cột dọc chiếm cả hai hàng.
        'sm:col-span-1 sm:row-span-2 sm:row-start-1 sm:h-auto sm:pb-0',
      )}
    >
      {/* Thương hiệu — ẩn trên điện thoại và khi thu gọn. */}
      <div
        className={cx(
          'hidden h-topbar shrink-0 items-center gap-2.5 border-b border-white/10',
          'sm:flex sm:justify-center sm:px-0',
          collapsed ? 'md:justify-center md:px-0' : 'md:justify-start md:px-3.5',
        )}
      >
        <div className="relative h-[36px] w-[36px] shrink-0 drop-shadow-sm">
          <Image
            src="/images/logo-thcs-le-ninh.png"
            alt="Logo THCS Lệ Ninh"
            width={36}
            height={36}
            className="h-full w-full object-contain"
          />
        </div>
        <span className={cx('hidden min-w-0', !collapsed && 'md:block')}>
          <strong className="block truncate text-[13px] leading-tight">TRỢ LÝ TỔNG PHỤ TRÁCH</strong>
          <span className="block truncate text-[10.5px] text-sidebar-dim">Công tác Đội THCS</span>
        </span>
      </div>

      <nav
        aria-label="Điều hướng chính"
        className={cx(
          // Điện thoại: hàng ngang cuộn được, bám mốc khi vuốt.
          'flex snap-x snap-proximity overflow-x-auto overflow-y-hidden px-1 py-1',
          // Từ 521px: danh sách dọc.
          'sm:block sm:overflow-y-auto sm:overflow-x-hidden sm:px-1.5 sm:py-2',
        )}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              className={cx(
                'rounded-control text-[13px] transition-colors',
                active
                  ? 'bg-white font-bold text-sidebar-active'
                  : 'text-sidebar-text hover:bg-white/10 hover:text-white',
                // Điện thoại: ô 112×62, biểu tượng trên nhãn dưới.
                'flex h-[62px] w-[112px] min-w-[112px] shrink-0 snap-start flex-col items-center justify-center gap-[3px] px-1 py-1',
                // Từ 521px: hàng ngang trong cột dọc, chỉ biểu tượng.
                'sm:my-[1px] sm:h-auto sm:min-h-[37px] sm:w-full sm:min-w-0 sm:flex-row sm:justify-center sm:gap-2.5 sm:px-0 sm:py-2',
                // Từ 851px: canh trái và hiện nhãn, trừ khi đang thu gọn.
                collapsed ? 'md:justify-center md:px-0' : 'md:justify-start md:px-2.5',
              )}
            >
              <Icon size={17} className="shrink-0" aria-hidden />

              {/* Nhãn ngắn cho điện thoại. */}
              <span className="block w-full whitespace-normal text-center text-[9.5px] leading-[1.1] sm:hidden">
                {item.short}
              </span>

              {/* Nhãn đầy đủ chỉ xuất hiện khi thanh bên đủ rộng. */}
              <span className={cx('hidden truncate', !collapsed && 'md:block')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className={cx(
          'mt-auto hidden shrink-0 border-t border-white/10 p-2.5 text-[11px] text-sidebar-dim',
          !collapsed && 'md:block',
        )}
      >
        PostgreSQL tập trung • dùng chung mọi thiết bị
      </div>
    </aside>
  );
}
