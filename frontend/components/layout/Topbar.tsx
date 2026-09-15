'use client';

import {
  CalendarRange,
  ChevronRight,
  Database,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Search,
  TimerReset,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useScope } from '@/hooks/useScope';
import { useToast } from '@/hooks/useToast';
import { USER_ROLE_LABEL } from '@/lib/labels';
import { activeNavGroup, activeNavItem } from '@/lib/navigation';
import { api } from '@/services/api';
import type { SearchGroup } from '@/types';
import { Avatar, Badge, Button, Field, Select } from '@/components/ui';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';

/** Dưới ngưỡng này mới cảnh báo sắp khóa phiên — trên đó chỉ hiện trong menu. */
const LOCK_WARN_SECONDS = 120;

export function Topbar({ onQuickAdd }: { onQuickAdd: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, lock, logout, secondsToLock } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const scope = useScope();

  const [scopeOpen, setScopeOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const navItem = activeNavItem(pathname);
  const navGroup = activeNavGroup(pathname);

  const handleLogout = useCallback(async () => {
    const ok = await confirm({
      title: 'Xác nhận đăng xuất',
      description:
        'Bạn có chắc chắn muốn kết thúc phiên làm việc và đăng xuất khỏi hệ thống không?',
      confirmLabel: 'Đăng xuất',
      cancelLabel: 'Ở lại',
      tone: 'danger',
    });
    if (!ok) return;
    toast('Đã đăng xuất khỏi hệ thống.');
    await logout();
  }, [confirm, logout, toast]);

  const handleLock = useCallback(() => {
    toast('Đã khóa phiên làm việc.');
    lock();
  }, [lock, toast]);

  // Tìm kiếm toàn cục: gọi server sau 200 ms ngừng gõ.
  useEffect(() => {
    if (query.trim().length < 2 || !scope.yearId) {
      setGroups([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await api.get<{ groups: SearchGroup[] }>(
          '/analytics/search',
          { q: query.trim(), yearId: scope.yearId },
          controller.signal,
        );
        setGroups(result.groups);
        setSearchOpen(true);
      } catch {
        setGroups([]);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, scope.yearId]);

  // Đóng bảng kết quả khi bấm ra ngoài.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const goToResult = useCallback(
    (page: string) => {
      setSearchOpen(false);
      setQuery('');
      router.push(`/${page}`);
    },
    [router],
  );

  /**
   * Tóm tắt phạm vi dữ liệu đang áp dụng.
   * Bản cũ đặt 4 <select> thẳng vào thanh trên cùng rồi ẩn dần khi màn hình
   * hẹp lại — ở 1366px người dùng không còn nhìn thấy mình đang ở tuần nào.
   * Nay gom vào một nút luôn hiện, mở ra hộp thoại chứa đủ cả bốn lựa chọn.
   */
  const scopeSummary = useMemo(() => {
    const year = scope.currentYear?.name ?? 'Chưa có năm học';
    const semester =
      scope.semesterId === 'all'
        ? 'Cả năm'
        : (scope.semesters.find((item) => item.id === scope.semesterId)?.name ?? 'Cả năm');
    const week = scope.currentWeek?.name ?? '—';
    const campus = scope.campusName(scope.campusId);
    return { year, semester, week, campus, full: `${year} · ${semester} · ${week} · ${campus}` };
  }, [scope]);

  const lockWarning = secondsToLock !== null && secondsToLock <= LOCK_WARN_SECONDS;

  return (
    <header className="no-print z-30 col-start-1 row-start-1 flex h-topbar-sm min-w-0 items-center gap-2 border-b border-line bg-card px-2.5 sm:col-start-2 sm:h-topbar md:gap-3 md:px-4">
      {/* ── Breadcrumb: người dùng luôn biết mình đang ở đâu ──────────── */}
      <nav
        aria-label="Đường dẫn trang"
        className="hidden min-w-0 shrink-0 items-center gap-1.5 text-sm lg:flex"
      >
        <span className="whitespace-nowrap text-neutral-400">{navGroup?.label ?? 'Hệ thống'}</span>
        <ChevronRight size={13} className="shrink-0 text-neutral-300" aria-hidden />
        <span className="truncate font-semibold text-ink">{navItem?.label ?? 'Trang'}</span>
      </nav>

      {/* ── Tìm kiếm toàn cục ─────────────────────────────────────────── */}
      <div ref={boxRef} className="relative min-w-0 flex-1 lg:max-w-[420px] lg:flex-none lg:grow">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => groups.length > 0 && setSearchOpen(true)}
          placeholder="Tìm công việc, lớp, hoạt động…"
          aria-label="Tìm kiếm toàn hệ thống"
          autoComplete="off"
          className="field-input h-control bg-neutral-50 pl-9 shadow-none focus:bg-white"
        />

        {searchOpen && groups.length > 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[62vh] animate-pop-in overflow-auto rounded-lg border border-line bg-card p-1.5 shadow-lg">
            {groups.map((group) => (
              <div key={group.page} className="pb-1">
                <p className="menu-label">{group.label}</p>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToResult(group.page)}
                    className="menu-item"
                  >
                    <span className="flex-1 truncate">{item.text}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {searchOpen && query.trim().length >= 2 && groups.length === 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 animate-pop-in rounded-lg border border-line bg-card px-3.5 py-3 text-sm text-neutral-500 shadow-lg">
            Không tìm thấy kết quả cho “{query.trim()}”.
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* ── Phạm vi dữ liệu ─────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setScopeOpen(true)}
          title={`Phạm vi dữ liệu: ${scopeSummary.full}`}
          aria-label={`Đổi phạm vi dữ liệu. Hiện tại: ${scopeSummary.full}`}
          className="flex h-control min-w-0 items-center gap-2 rounded-md border border-line bg-white px-2.5 text-sm text-neutral-700 shadow-xs transition-colors hover:border-brand-200 hover:bg-brand-50"
        >
          <CalendarRange size={15} className="shrink-0 text-brand-600" aria-hidden />
          <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
            <span className="max-w-[168px] truncate font-semibold text-ink">
              {scopeSummary.year} · {scopeSummary.week}
            </span>
            <span className="max-w-[168px] truncate text-2xs text-neutral-500">
              {scopeSummary.semester} · {scopeSummary.campus}
            </span>
          </span>
        </button>

        {lockWarning ? (
          <Badge tone="yellow" dot className="lap:hidden" title="Ứng dụng sắp tự khóa">
            Khóa sau {Math.ceil((secondsToLock ?? 0) / 60)} phút
          </Badge>
        ) : null}

        <Button
          variant="primary"
          icon={<Plus size={16} aria-hidden />}
          onClick={onQuickAdd}
          aria-label="Thêm nhanh bản ghi"
          className="tablet:w-control tablet:px-0"
        >
          <span className="tablet:hidden">Thêm nhanh</span>
        </Button>

        {/* ── Menu tài khoản ──────────────────────────────────────────── */}
        <Menu
          align="end"
          label="Mở menu tài khoản và phiên làm việc"
          className="rounded-md"
          trigger={
            <span className="flex h-control items-center gap-2 rounded-md border border-line bg-white px-1.5 pr-2 shadow-xs transition-colors hover:border-brand-200 hover:bg-brand-50">
              <Avatar name={user?.fullName ?? user?.username} size={26} />
              <span className="hidden min-w-0 flex-col items-start leading-tight xl:flex">
                <span className="max-w-[130px] truncate text-sm font-semibold text-ink">
                  {user?.fullName || user?.username}
                </span>
                <span className="max-w-[130px] truncate text-2xs text-neutral-500">
                  {user ? USER_ROLE_LABEL[user.role] : ''}
                </span>
              </span>
            </span>
          }
        >
          {(close) => (
            <>
              <div className="flex items-center gap-2.5 px-2.5 py-2">
                <Avatar name={user?.fullName ?? user?.username} size={34} />
                <div className="min-w-0">
                  <p className="m-0 truncate text-base font-semibold text-ink">
                    {user?.fullName || user?.username}
                  </p>
                  <p className="m-0 truncate text-xs text-neutral-500">
                    @{user?.username} · {user ? USER_ROLE_LABEL[user.role] : ''}
                  </p>
                </div>
              </div>

              <MenuSeparator />

              <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-500">
                <TimerReset size={14} className="shrink-0" aria-hidden />
                {secondsToLock === null
                  ? 'Chưa bật tự khóa'
                  : `Tự khóa sau ${Math.ceil(secondsToLock / 60)} phút không thao tác`}
              </div>
              <div className="flex items-center gap-2 px-2.5 pb-1.5 text-xs text-neutral-500">
                <Database size={14} className="shrink-0" aria-hidden />
                Dữ liệu lưu tập trung trên PostgreSQL
              </div>

              <MenuSeparator />
              <MenuLabel>Phiên làm việc</MenuLabel>

              <MenuItem
                icon={<KeyRound size={15} aria-hidden />}
                onClick={() => {
                  close();
                  router.push('/doi-mat-khau');
                }}
              >
                Đổi mật khẩu
              </MenuItem>
              <MenuItem
                icon={<Lock size={15} aria-hidden />}
                onClick={() => {
                  close();
                  handleLock();
                }}
              >
                Khóa màn hình
              </MenuItem>
              <MenuItem
                danger
                icon={<LogOut size={15} aria-hidden />}
                onClick={() => {
                  close();
                  void handleLogout();
                }}
              >
                Đăng xuất
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      {/* ── Hộp thoại phạm vi dữ liệu ───────────────────────────────── */}
      <Modal
        open={scopeOpen}
        title="Phạm vi dữ liệu"
        description="Mọi trang trong hệ thống chỉ hiển thị dữ liệu thuộc phạm vi này."
        icon={<CalendarRange size={18} aria-hidden />}
        onClose={() => setScopeOpen(false)}
        footer={
          <Button variant="primary" onClick={() => setScopeOpen(false)}>
            Xong
          </Button>
        }
      >
        <div className="grid gap-3.5">
          <Field label="Năm học">
            <Select
              value={scope.yearId}
              onChange={(e) => scope.setScope({ yearId: e.target.value })}
            >
              {scope.years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.isCurrent ? ' • hiện hành' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Học kỳ" hint="Chọn “Cả năm học” để xem số liệu cộng dồn của cả năm.">
            <Select
              value={scope.semesterId}
              onChange={(e) => scope.setScope({ semesterId: e.target.value })}
            >
              <option value="all">Cả năm học</option>
              {scope.semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tuần" hint="Bảng thi đua và báo cáo tuần bám theo lựa chọn này.">
            <Select value={scope.weekId} onChange={(e) => scope.setScope({ weekId: e.target.value })}>
              {scope.weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cơ sở">
            <Select
              value={scope.campusId}
              onChange={(e) => scope.setScope({ campusId: e.target.value })}
            >
              <option value="all">Toàn trường</option>
              {scope.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </header>
  );
}
