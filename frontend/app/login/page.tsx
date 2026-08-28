'use client';

import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { Button } from '@/components/ui';

/**
 * Màn hình đăng nhập — thay cho activation-screen của website gốc.
 * Bản gốc so mật khẩu "admin@" ngay trong JavaScript công khai;
 * ở đây mật khẩu được băm bcrypt và kiểm tra hoàn toàn ở phía máy chủ.
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState(
    'Nhập tài khoản để mở phiên làm việc. Ứng dụng không ghi nhớ mật khẩu.',
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace(user.mustChangePassword ? '/doi-mat-khau' : '/dashboard');
  }, [loading, user, router]);

  useEffect(() => {
    const timer = setTimeout(() => passwordRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, []);

  // Đếm ngược khi server chặn do nhập sai nhiều lần (backoff mũ 2).
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setInterval(() => {
      setWaitSeconds((current) => {
        if (current <= 1) {
          setStatus('Có thể thử lại mật khẩu.');
          setError(false);
          passwordRef.current?.focus();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [waitSeconds]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || waitSeconds > 0) return;

    setBusy(true);
    setError(false);
    setStatus('Đang mở dữ liệu…');
    try {
      const account = await login(username.trim(), password);
      setPassword('');
      router.replace(account.mustChangePassword ? '/doi-mat-khau' : '/dashboard');
    } catch (err) {
      setPassword('');
      setError(true);
      if (err instanceof ApiError && err.code === 'AUTH_BLOCKED') {
        const wait = Number(err.details?.waitSeconds ?? 0);
        setWaitSeconds(wait);
        setStatus(`Sai mật khẩu nhiều lần. Thử lại sau ${wait} giây.`);
      } else {
        setStatus(err instanceof Error ? err.message : 'Đăng nhập không thành công.');
      }
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full place-items-center overflow-auto bg-gradient-to-br from-[#0a3764] to-[#0b6bcb] p-4">
      <div className="w-full max-w-[420px] rounded-card bg-card p-6 shadow-modal">
        <div className="mb-5 flex flex-col items-center text-center">
          <span
            className="mb-3 grid h-[56px] w-[56px] place-items-center rounded-[15px] bg-blue text-[26px] font-black text-white"
            aria-hidden
          >
            Đ
          </span>
          <h1 className="m-0 text-[16px] font-bold leading-snug">
            TRỢ LÝ TỔNG PHỤ TRÁCH ĐỘI THCS
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Dữ liệu lưu tập trung trên PostgreSQL, dùng chung mọi thiết bị.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="field-label" htmlFor="username">
              Tên đăng nhập
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={busy || waitSeconds > 0}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                ref={passwordRef}
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={busy || waitSeconds > 0}
                className="field-input pr-10"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
          </div>

          <p
            role="status"
            className={`text-[12px] leading-snug ${error ? 'font-semibold text-red' : 'text-muted'}`}
          >
            {status}
          </p>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={busy}
            disabled={waitSeconds > 0}
            icon={<LogIn size={15} aria-hidden />}
          >
            {waitSeconds > 0 ? `Thử lại sau ${waitSeconds}s` : 'Mở ứng dụng'}
          </Button>
        </form>

        <p className="mt-4 border-t border-line pt-3 text-center text-[11px] text-muted">
          Tài khoản khởi tạo: <code className="font-semibold">admin</code> — bắt buộc đổi mật khẩu ở
          lần đăng nhập đầu tiên.
        </p>
      </div>
    </div>
  );
}
