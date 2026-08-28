'use client';

import { Database, Lock, Menu, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useScope } from '@/hooks/useScope';
import { api } from '@/services/api';
import type { SearchGroup } from '@/types';
import { Button, IconButton, Select } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

/** Đếm ngược khóa phiên, hiển thị dạng "Khóa sau 9 phút". */
function LockChip({ seconds }: { seconds: number | null }) {
  if (seconds === null) return null;
  const minutes = Math.ceil(seconds / 60);
  return (
    <span
      className="wide:hidden whitespace-nowrap rounded-full border border-line bg-canvas px-2 py-[2px] text-[11px] text-muted"
      title="Ứng dụng tự khóa khi không có thao tác"
    >
      Khóa sau {minutes} phút
    </span>
  );
}

export function Topbar({
  collapsed,
  onToggleSidebar,
  onQuickAdd,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onQuickAdd: () => void;
}) {
  const router = useRouter();
  const { lock, secondsToLock } = useAuth();
  const scope = useScope();
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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

  const contextSelects = (
    <>
      <Select
        aria-label="Năm học"
        value={scope.yearId}
        onChange={(e) => scope.setScope({ yearId: e.target.value })}
        className="w-auto max-w-[150px]"
      >
        {scope.years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.name}
            {year.isCurrent ? ' • hiện hành' : ''}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Học kỳ"
        value={scope.semesterId}
        onChange={(e) => scope.setScope({ semesterId: e.target.value })}
        className="w-auto max-w-[150px] desk-sm:hidden"
      >
        <option value="all">Cả năm học</option>
        {scope.semesters.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semester.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Tuần"
        value={scope.weekId}
        onChange={(e) => scope.setScope({ weekId: e.target.value })}
        className="w-auto max-w-[130px] lap-sm:hidden"
      >
        {scope.weeks.map((week) => (
          <option key={week.id} value={week.id}>
            {week.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Cơ sở"
        value={scope.campusId}
        onChange={(e) => scope.setScope({ campusId: e.target.value })}
        className="w-auto max-w-[150px] lap-sm:hidden"
      >
        <option value="all">Toàn trường</option>
        {scope.campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </Select>
    </>
  );

  return (
    <header className="no-print z-10 col-start-1 row-start-1 flex h-topbar-sm min-w-0 items-center gap-2 border-b border-line bg-white px-2 sm:col-start-2 sm:h-topbar md:px-3.5">
      <IconButton
        onClick={onToggleSidebar}
        title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        className="hidden md:grid"
      >
        <Menu size={16} aria-hidden />
      </IconButton>

      <div className="hidden items-center gap-2 md:flex">{contextSelects}</div>

      {/* Trên màn hình hẹp, 4 dropdown gộp vào một nút mở hộp thoại. */}
      <IconButton
        onClick={() => setMobileContextOpen(true)}
        title="Chọn năm, học kỳ, tuần và cơ sở"
        aria-label="Chọn phạm vi dữ liệu"
        className="hidden desk-sm:grid"
      >
        <SlidersHorizontal size={16} aria-hidden />
      </IconButton>

      <div ref={boxRef} className="relative min-w-[120px] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => groups.length > 0 && setSearchOpen(true)}
          placeholder="Tìm công việc, lớp, hoạt động…"
          aria-label="Tìm kiếm"
          autoComplete="off"
          className="field-input pl-8"
        />

        {searchOpen && groups.length > 0 ? (
          <div className="absolute left-0 right-0 top-[38px] z-30 max-h-[60vh] overflow-auto rounded-card border border-line bg-card py-1 shadow-modal">
            {groups.map((group) => (
              <div key={group.page} className="py-1">
                <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToResult(group.page)}
                    className="block w-full truncate px-3 py-1.5 text-left text-[13px] hover:bg-blue-soft"
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {searchOpen && query.trim().length >= 2 && groups.length === 0 ? (
          <div className="absolute left-0 right-0 top-[38px] z-30 rounded-card border border-line bg-card px-3 py-3 text-[12.5px] text-muted shadow-modal">
            Không tìm thấy kết quả cho “{query.trim()}”.
          </div>
        ) : null}
      </div>

      <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={onQuickAdd}>
        <span className="hidden md:inline">Thêm nhanh</span>
      </Button>

      <div className="flex items-center gap-2 lap:hidden">
        <LockChip seconds={secondsToLock} />
        <span
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue/25 bg-blue-soft px-2 py-[2px] text-[11px] font-semibold text-blue"
          title="Dữ liệu lưu tập trung trên PostgreSQL"
        >
          <Database size={12} aria-hidden />
          PostgreSQL
        </span>
      </div>

      <IconButton onClick={lock} title="Khóa ứng dụng" aria-label="Khóa ứng dụng">
        <Lock size={15} aria-hidden />
      </IconButton>

      <Modal
        open={mobileContextOpen}
        title="Chọn phạm vi dữ liệu"
        onClose={() => setMobileContextOpen(false)}
        footer={
          <Button variant="primary" onClick={() => setMobileContextOpen(false)}>
            Xong
          </Button>
        }
      >
        <div className="grid gap-3">
          <label className="block">
            <span className="field-label">Năm học</span>
            <Select value={scope.yearId} onChange={(e) => scope.setScope({ yearId: e.target.value })}>
              {scope.years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="field-label">Học kỳ</span>
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
          </label>
          <label className="block">
            <span className="field-label">Tuần</span>
            <Select value={scope.weekId} onChange={(e) => scope.setScope({ weekId: e.target.value })}>
              {scope.weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="field-label">Cơ sở</span>
            <Select value={scope.campusId} onChange={(e) => scope.setScope({ campusId: e.target.value })}>
              <option value="all">Toàn trường</option>
              {scope.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Modal>
    </header>
  );
}
