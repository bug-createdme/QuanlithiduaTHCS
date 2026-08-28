'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api, setAccessToken, setUnauthorizedHandler } from '@/services/api';
import type { CurrentUser } from '@/types';

/**
 * Phân biệt "phiên đã mất" với "gọi hỏng tạm thời".
 * Chỉ 401 nghĩa là refresh token không còn hiệu lực. Mất mạng (status 0) hay
 * 429/5xx chỉ là trục trặc nhất thời và không được phép hủy phiên đang hợp lệ.
 */
function isSessionGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Giây chờ trước khi thử làm mới lại sau một lỗi tạm thời. */
const RETRY_AFTER_SECONDS = 90;

/** Số lần thử khôi phục phiên lúc tải trang trước khi coi như chưa đăng nhập. */
const RESTORE_ATTEMPTS = 3;

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
}

interface AuthApi {
  user: CurrentUser | null;
  loading: boolean;
  /** true khi phiên bị khóa do không hoạt động — cần nhập lại mật khẩu. */
  locked: boolean;
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  lock: () => void;
  refreshUser: () => Promise<void>;
  /** Số giây còn lại trước khi tự khóa; null nghĩa là chưa đăng nhập. */
  secondsToLock: number | null;
}

const AuthContext = createContext<AuthApi | null>(null);

/** Nhịp đếm ngược khóa phiên. */
const TICK_MS = 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [secondsToLock, setSecondsToLock] = useState<number | null>(null);

  const lastActivity = useRef<number>(Date.now());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  /** Làm mới token trước khi hết hạn để người dùng không bị rớt phiên giữa chừng. */
  const scheduleRefresh = useCallback(
    (expiresIn: number) => {
      clearRefreshTimer();
      const delay = Math.max(30_000, (expiresIn - 60) * 1000);
      refreshTimer.current = setTimeout(async () => {
        try {
          const data = await api.post<LoginResponse>('/auth/refresh');
          setAccessToken(data.accessToken);
          setUser(data.user);
          scheduleRefresh(data.expiresIn);
        } catch (error) {
          // Chỉ 401 mới có nghĩa phiên đã mất thật. Mất mạng hay bị giới hạn
          // tần suất chỉ là trục trặc tạm thời — giữ phiên và thử lại,
          // đừng đá người dùng ra màn hình đăng nhập giữa chừng.
          if (isSessionGone(error)) {
            setAccessToken(null);
            setUser(null);
          } else {
            scheduleRefresh(RETRY_AFTER_SECONDS);
          }
        }
      }, delay);
    },
    [clearRefreshTimer],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api.post<LoginResponse>('/auth/login', { username, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      setLocked(false);
      lastActivity.current = Date.now();
      scheduleRefresh(data.expiresIn);
      return data.user;
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    clearRefreshTimer();
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      setLocked(false);
      router.replace('/login');
    }
  }, [clearRefreshTimer, router]);

  /** Khóa màn hình nhưng giữ phiên — người dùng chỉ cần nhập lại mật khẩu. */
  const lock = useCallback(() => setLocked(true), []);

  const refreshUser = useCallback(async () => {
    const fresh = await api.get<CurrentUser>('/auth/me');
    setUser(fresh);
  }, []);

  // Khôi phục phiên khi tải lại trang: refresh token nằm ở cookie HttpOnly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Lỗi tạm thời (mất mạng, bị giới hạn tần suất) không phải là mất phiên,
      // nên thử lại vài lần trước khi đưa người dùng về màn hình đăng nhập.
      for (let attempt = 1; attempt <= RESTORE_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          const data = await api.post<LoginResponse>('/auth/refresh');
          if (cancelled) return;
          setAccessToken(data.accessToken);
          setUser(data.user);
          scheduleRefresh(data.expiresIn);
          break;
        } catch (error) {
          if (cancelled) return;
          if (isSessionGone(error) || attempt === RESTORE_ATTEMPTS) {
            setUser(null);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleRefresh]);

  // Khi API báo 401 không cứu được, đưa người dùng về màn hình đăng nhập.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setAccessToken(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Tự khóa sau khoảng thời gian không hoạt động — tái hiện SessionLockManager gốc.
  useEffect(() => {
    if (!user) {
      setSecondsToLock(null);
      return;
    }

    const markActivity = () => {
      lastActivity.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));

    const timeoutMs = Math.max(1, user.autoLockMinutes) * 60_000;
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      const remaining = Math.ceil((timeoutMs - idle) / 1000);
      setSecondsToLock(Math.max(0, remaining));
      if (idle >= timeoutMs) setLocked(true);
    }, TICK_MS);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  const value = useMemo(
    () => ({ user, loading, locked, login, logout, lock, refreshUser, secondsToLock }),
    [user, loading, locked, login, logout, lock, refreshUser, secondsToLock],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider.');
  return context;
}
