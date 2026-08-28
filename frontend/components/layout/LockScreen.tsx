'use client';

import { Eye, EyeOff, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { Button } from '@/components/ui';

/**
 * Màn hình khóa phiên — tương ứng activation-screen của website gốc.
 * Phiên vẫn còn hiệu lực; người dùng chỉ cần xác nhận lại mật khẩu.
 * Khác bản gốc ở chỗ mật khẩu được kiểm tra ở server, không hard-code trong mã.
 */
export function LockScreen() {
  const { user, login, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState('Nhập mật khẩu để tiếp tục phiên làm việc.');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, []);

  // Đếm ngược khi bị chặn do nhập sai nhiều lần.
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setInterval(() => {
      setWaitSeconds((current) => {
        if (current <= 1) {
          setStatus('Có thể thử lại mật khẩu.');
          setError(false);
          inputRef.current?.focus();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [waitSeconds]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy || waitSeconds > 0) return;

    setBusy(true);
    setStatus('Đang mở khóa…');
    setError(false);
    try {
      await login(user.username, password);
      setPassword('');
    } catch (err) {
      setPassword('');
      setError(true);
      if (err instanceof ApiError && err.code === 'AUTH_BLOCKED') {
        const wait = Number(err.details?.waitSeconds ?? 0);
        setWaitSeconds(wait);
        setStatus(`Mật khẩu không đúng. Thử lại sau ${wait} giây.`);
      } else {
        setStatus(err instanceof Error ? err.message : 'Mật khẩu không đúng.');
      }
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-gradient-to-br from-[#0a3764] to-[#0b6bcb] p-4">
      <div className="w-full max-w-[400px] rounded-card bg-card p-6 shadow-modal">
        <div className="mb-4 flex flex-col items-center text-center">
          <span
            className="mb-3 grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-blue text-[24px] font-black text-white"
            aria-hidden
          >
            Đ
          </span>
          <h1 className="m-0 text-[16px] font-bold leading-snug">PHIÊN LÀM VIỆC ĐÃ KHÓA</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            {user ? `Đang đăng nhập: ${user.fullName}` : 'Ứng dụng tự khóa khi không có thao tác.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="lockPassword">
            Mật khẩu mở ứng dụng
          </label>
          <div className="relative">
            <input
              id="lockPassword"
              ref={inputRef}
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

          <p
            role="status"
            className={`mt-2 text-[12px] ${error ? 'font-semibold text-red' : 'text-muted'}`}
          >
            {status}
          </p>

          <Button
            type="submit"
            variant="primary"
            className="mt-3 w-full"
            loading={busy}
            disabled={waitSeconds > 0}
            icon={<Lock size={14} aria-hidden />}
          >
            {waitSeconds > 0 ? `Thử lại sau ${waitSeconds}s` : 'Mở khóa'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 w-full text-center text-[12px] text-muted hover:text-blue hover:underline"
        >
          Đăng xuất và dùng tài khoản khác
        </button>
      </div>
    </div>
  );
}
