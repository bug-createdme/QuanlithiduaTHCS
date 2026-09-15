'use client';

import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useScope } from '@/hooks/useScope';
import { Button, LoadingState, Notice } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { NAV_ITEMS } from '@/lib/navigation';
import { LockScreen } from './LockScreen';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_KEY = 'tpt:sidebar-collapsed';

/** Lối tắt "Thêm nhanh" — đúng danh sách của showQuickAdd() bản gốc. */
const QUICK_ADD_ITEMS: Array<{ href: string; nav: string; label: string; hint: string }> = [
  { href: '/tasks?new=1', nav: '/tasks', label: 'Công việc', hint: 'Đầu việc có hạn và checklist' },
  { href: '/calendar?new=1', nav: '/calendar', label: 'Lịch hoạt động', hint: 'Sự kiện theo ngày' },
  {
    href: '/activities?new=1',
    nav: '/activities',
    label: 'Hoạt động Đội',
    hint: 'Kèm phương án an toàn',
  },
  { href: '/plans?new=1', nav: '/plans', label: 'Kế hoạch', hint: 'Năm, kỳ, tháng hoặc tuần' },
  {
    href: '/documents?new=1',
    nav: '/documents',
    label: 'Hồ sơ – minh chứng',
    hint: 'Tải tệp và gắn thẻ',
  },
  {
    href: '/commendations?new=1',
    nav: '/commendations',
    label: 'Khen thưởng',
    hint: 'Tập thể hoặc cá nhân',
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, locked } = useAuth();
  const scope = useScope();
  const [collapsed, setCollapsed] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Khôi phục trạng thái thu gọn thanh bên — trạng thái giao diện thuần túy.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      /* bỏ qua */
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.mustChangePassword) router.replace('/doi-mat-khau');
  }, [user, router]);

  if (loading) {
    return (
      <div className="grid h-full place-items-center bg-canvas">
        <LoadingState label="Đang khôi phục phiên làm việc…" />
      </div>
    );
  }

  if (!user) return null;
  if (locked) return <LockScreen />;

  return (
    <div
      className={cx(
        'grid h-full',
        // Mobile-first — nền là điện thoại: một cột, điều hướng nằm dưới đáy.
        'grid-cols-1 grid-rows-[58px_minmax(0,1fr)_calc(68px+env(safe-area-inset-bottom))]',
        // ≥521px: thanh bên dọc chỉ hiện biểu tượng, rộng 68px.
        'sm:grid-cols-[68px_1fr] sm:grid-rows-[64px_minmax(0,1fr)]',
        // ≥851px: thanh bên đầy đủ 260px, thu còn 68px khi người dùng bấm thu gọn.
        collapsed ? 'md:grid-cols-[68px_1fr]' : 'md:grid-cols-[260px_1fr]',
      )}
    >
      {/* Bỏ qua điều hướng — phím Tab đầu tiên nhảy thẳng tới nội dung. */}
      <a
        href="#content"
        className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-lg"
      >
        Bỏ qua điều hướng, tới nội dung chính
      </a>

      <Sidebar collapsed={collapsed} onToggleCollapse={toggleSidebar} />
      <Topbar onQuickAdd={() => setQuickAddOpen(true)} />

      <main
        id="content"
        tabIndex={-1}
        className="col-start-1 row-start-2 min-w-0 overflow-auto bg-canvas outline-none sm:col-start-2"
      >
        {/*
          Giới hạn bề ngang ở màn hình rất rộng (≥1700px): bảng dài tới 1900px
          khiến mắt phải quét quá xa giữa cột đầu và cột cuối.
        */}
        <div className="mx-auto w-full max-w-[1680px] px-3 py-3.5 md:px-5 md:py-5">
          {scope.ready && scope.years.length === 0 ? (
            <Notice tone="warn" title="Chưa có năm học nào." className="mb-4">
              Hãy mở <b>Thiết lập → Cơ sở – năm học</b> để tạo năm học trước khi nhập dữ liệu.
            </Notice>
          ) : null}

          {/*
            Chỉ làm mờ dần. TUYỆT ĐỐI không dùng `transform` ở đây: một phần tử có
            transform sẽ trở thành containing block cho mọi hậu duệ `position: fixed`,
            khiến toàn bộ modal của trang bị định vị sai — căn theo khối nội dung
            thay vì theo khung nhìn.
          */}
          <div className="animate-fade-in">{children}</div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-neutral-400">
            <span>Trợ lý Tổng phụ trách Đội THCS</span>
            <span>Dữ liệu lưu tập trung trên PostgreSQL</span>
          </footer>
        </div>
      </main>

      <Modal
        open={quickAddOpen}
        title="Thêm nhanh"
        description="Chọn loại bản ghi cần tạo; hệ thống mở sẵn biểu mẫu tương ứng."
        icon={<Zap size={18} aria-hidden />}
        onClose={() => setQuickAddOpen(false)}
        footer={<Button onClick={() => setQuickAddOpen(false)}>Đóng</Button>}
      >
        <div className="grid grid-cols-2 gap-2 mobile:grid-cols-1">
          {QUICK_ADD_ITEMS.map((item) => {
            const Icon = NAV_ITEMS.find((nav) => nav.href === item.nav)?.icon;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  setQuickAddOpen(false);
                  router.push(item.href);
                }}
                className="flex items-start gap-3 rounded-md border border-line bg-white p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:shadow-sm"
              >
                {Icon ? (
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600"
                    aria-hidden
                  >
                    <Icon size={17} />
                  </span>
                ) : null}
                <span className="min-w-0">
                  <strong className="block text-base text-ink">{item.label}</strong>
                  <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                    {item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
