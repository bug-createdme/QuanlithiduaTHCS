'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useScope } from '@/hooks/useScope';
import { Button, LoadingState, Notice } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { LockScreen } from './LockScreen';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_KEY = 'tpt:sidebar-collapsed';

/** Lối tắt "Thêm nhanh" — đúng danh sách của showQuickAdd() bản gốc. */
const QUICK_ADD_ITEMS: Array<{ href: string; label: string; hint: string }> = [
  { href: '/tasks?new=1', label: 'Công việc', hint: 'Đầu việc có hạn và checklist' },
  { href: '/calendar?new=1', label: 'Lịch hoạt động', hint: 'Sự kiện theo ngày' },
  { href: '/activities?new=1', label: 'Hoạt động Đội', hint: 'Kèm phương án an toàn' },
  { href: '/plans?new=1', label: 'Kế hoạch', hint: 'Năm, kỳ, tháng hoặc tuần' },
  { href: '/documents?new=1', label: 'Hồ sơ – minh chứng', hint: 'Tải tệp và gắn thẻ' },
  { href: '/commendations?new=1', label: 'Khen thưởng', hint: 'Tập thể hoặc cá nhân' },
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
        'grid-cols-1 grid-rows-[58px_minmax(0,1fr)_calc(70px+env(safe-area-inset-bottom))]',
        // ≥521px: thanh bên dọc chỉ hiện biểu tượng, rộng 64px.
        'sm:grid-cols-[64px_1fr] sm:grid-rows-[62px_minmax(0,1fr)]',
        // ≥851px: thanh bên đầy đủ 248px, thu còn 64px khi người dùng bấm thu gọn.
        collapsed ? 'md:grid-cols-[64px_1fr]' : 'md:grid-cols-[248px_1fr]',
      )}
    >
      <Sidebar collapsed={collapsed} />
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        onQuickAdd={() => setQuickAddOpen(true)}
      />

      <main
        id="content"
        tabIndex={-1}
        className="col-start-1 row-start-2 min-w-0 overflow-auto bg-canvas p-2.5 outline-none sm:col-start-2 md:p-3.5"
      >
        {scope.ready && scope.years.length === 0 ? (
          <Notice tone="warn" className="mb-3">
            <strong className="block">Chưa có năm học nào.</strong>
            Hãy mở <b>Thiết lập → Cơ sở – năm học</b> để tạo năm học trước khi nhập dữ liệu.
          </Notice>
        ) : null}

        {children}

        <footer className="mt-6 border-t border-line pt-2 text-center text-[11px] text-muted">
          Trợ lý Tổng phụ trách Đội THCS • Dữ liệu lưu trên PostgreSQL
        </footer>
      </main>

      <Modal
        open={quickAddOpen}
        title="Thêm nhanh"
        onClose={() => setQuickAddOpen(false)}
        footer={<Button onClick={() => setQuickAddOpen(false)}>Đóng</Button>}
      >
        <div className="grid grid-cols-2 gap-2 mobile:grid-cols-1">
          {QUICK_ADD_ITEMS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                router.push(item.href);
              }}
              className="rounded-control border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-blue hover:bg-blue-soft"
            >
              <strong className="block text-[13px]">{item.label}</strong>
              <span className="text-[11.5px] text-muted">{item.hint}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
