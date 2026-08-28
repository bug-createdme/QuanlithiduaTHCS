'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/services/api';
import { useAuth } from './useAuth';
import type { Campus, SchoolWeek, SchoolYear, Semester } from '@/types';

/**
 * Phạm vi dữ liệu toàn cục — 4 dropdown ở thanh trên cùng của bản gốc.
 * Lựa chọn được ghi vào localStorage vì đây là trạng thái giao diện,
 * không phải dữ liệu nghiệp vụ (Phase 3 cho phép đúng loại này).
 */
const STORAGE_KEY = 'tpt:scope';

export interface ScopeValue {
  yearId: string;
  semesterId: string;
  weekId: string;
  campusId: string;
}

interface ScopeApi extends ScopeValue {
  years: SchoolYear[];
  semesters: Semester[];
  weeks: SchoolWeek[];
  campuses: Campus[];
  ready: boolean;
  setScope: (partial: Partial<ScopeValue>) => void;
  reload: () => Promise<void>;
  /** Tham số truy vấn gửi kèm mọi lời gọi API có lọc phạm vi. */
  query: Record<string, string>;
  currentYear: SchoolYear | null;
  currentWeek: SchoolWeek | null;
  campusName: (campusId: string | null | undefined) => string;
}

const ScopeContext = createContext<ScopeApi | null>(null);

function readStored(): Partial<ScopeValue> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<ScopeValue>;
  } catch {
    return {};
  }
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [weeks, setWeeks] = useState<SchoolWeek[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [ready, setReady] = useState(false);
  const [scope, setScopeState] = useState<ScopeValue>({
    yearId: '',
    semesterId: 'all',
    weekId: '',
    campusId: 'all',
  });

  const persist = useCallback((next: ScopeValue) => {
    setScopeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* chế độ riêng tư có thể chặn localStorage — bỏ qua an toàn */
    }
  }, []);

  const setScope = useCallback(
    (partial: Partial<ScopeValue>) => {
      setScopeState((current) => {
        const next = { ...current, ...partial };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* bỏ qua */
        }
        return next;
      });
    },
    [],
  );

  const loadYearData = useCallback(async (yearId: string) => {
    const [semesterList, weekList] = await Promise.all([
      api.get<Semester[]>('/academic/semesters', { schoolYearId: yearId }),
      api.get<SchoolWeek[]>('/academic/weeks', { schoolYearId: yearId }),
    ]);
    setSemesters(semesterList);
    setWeeks(weekList);
    return weekList;
  }, []);

  const reload = useCallback(async () => {
    const [yearList, campusList] = await Promise.all([
      api.get<SchoolYear[]>('/academic/years'),
      api.get<Campus[]>('/academic/campuses'),
    ]);
    setYears(yearList);
    setCampuses(campusList);

    const stored = readStored();
    const yearId =
      yearList.find((y) => y.id === stored.yearId)?.id ??
      yearList.find((y) => y.isCurrent)?.id ??
      yearList[0]?.id ??
      '';
    if (!yearId) {
      setReady(true);
      return;
    }

    const weekList = await loadYearData(yearId);

    // Mặc định chọn tuần chứa ngày hôm nay, giống cách bản gốc định vị tuần hiện tại.
    const today = new Date().toISOString().slice(0, 10);
    const activeWeek =
      weekList.find((w) => w.id === stored.weekId) ??
      weekList.find((w) => w.startDate.slice(0, 10) <= today && today <= w.endDate.slice(0, 10)) ??
      weekList[0];

    persist({
      yearId,
      semesterId: stored.semesterId ?? 'all',
      weekId: activeWeek?.id ?? '',
      campusId:
        stored.campusId && (stored.campusId === 'all' || campusList.some((c) => c.id === stored.campusId))
          ? stored.campusId
          : 'all',
    });
    setReady(true);
  }, [loadYearData, persist]);

  useEffect(() => {
    if (!user) {
      setReady(false);
      return;
    }
    void reload();
  }, [user, reload]);

  // Đổi năm học thì nạp lại học kỳ/tuần và đưa tuần về đầu năm.
  useEffect(() => {
    if (!scope.yearId || !ready) return;
    let cancelled = false;
    (async () => {
      const weekList = await loadYearData(scope.yearId);
      if (cancelled) return;
      if (!weekList.some((w) => w.id === scope.weekId)) {
        setScope({ weekId: weekList[0]?.id ?? '', semesterId: 'all' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy lại khi đổi năm học.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.yearId]);

  const campusName = useCallback(
    (campusId: string | null | undefined) =>
      !campusId || campusId === 'all'
        ? 'Toàn trường'
        : (campuses.find((c) => c.id === campusId)?.name ?? '—'),
    [campuses],
  );

  const value = useMemo<ScopeApi>(() => {
    const query: Record<string, string> = { yearId: scope.yearId };
    if (scope.semesterId && scope.semesterId !== 'all') query.semesterId = scope.semesterId;
    if (scope.weekId) query.weekId = scope.weekId;
    if (scope.campusId && scope.campusId !== 'all') query.campusId = scope.campusId;

    return {
      ...scope,
      years,
      semesters,
      weeks,
      campuses,
      ready,
      setScope,
      reload,
      query,
      currentYear: years.find((y) => y.id === scope.yearId) ?? null,
      currentWeek: weeks.find((w) => w.id === scope.weekId) ?? null,
      campusName,
    };
  }, [scope, years, semesters, weeks, campuses, ready, setScope, reload, campusName]);

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeApi {
  const context = useContext(ScopeContext);
  if (!context) throw new Error('useScope phải nằm trong ScopeProvider.');
  return context;
}
