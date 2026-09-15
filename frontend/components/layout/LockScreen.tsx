'use client';

import Image from 'next/image';
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { USER_ROLE_LABEL } from '@/lib/labels';
import { ApiError } from '@/services/api';
import { Avatar, Badge, Button } from '@/components/ui';

/**
 * Màn hình khóa phiên làm việc.
 * Phiên vẫn còn hiệu lực trong bộ nhớ; người dùng chỉ cần xác thực lại mật khẩu
 * để tiếp tục đúng chỗ đang làm dở — không mất dữ liệu đang mở.
 */
export function LockScreen() {
  const { user, login, logout } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, []);

  // Đếm ngược khi bị chặn do nhập sai nhiều lần.
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setInterval(() => {
      setWaitSeconds((current) => {
        if (current <= 1) {
          setStatus(null);
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
    if (busy || waitSeconds > 0 || !user) return;

    setBusy(true);
    setError(false);
    setStatus('Đang xác thực mở khóa…');
    try {
      toast('Đã mở khóa phiên làm việc thành công.');
      await login(user.username, password);
      setPassword('');
    } catch (err) {
      setPassword('');
      setError(true);
      if (err instanceof ApiError && err.code === 'AUTH_BLOCKED') {
        const wait = Number(err.details?.waitSeconds ?? 0);
        setWaitSeconds(wait);
        setStatus(`Nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau ${wait} giây.`);
      } else {
        setStatus(
          err instanceof Error ? err.message : 'Mật khẩu không chính xác. Vui lòng thử lại.',
        );
      }
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Xác nhận đăng xuất',
      description:
        'Bạn có chắc chắn muốn đăng xuất và chuyển sang tài khoản khác không? Dữ liệu chưa lưu có thể bị mất.',
      confirmLabel: 'Đăng xuất',
      cancelLabel: 'Ở lại',
      tone: 'danger',
    });
    if (!ok) return;
    toast('Đã đăng xuất khỏi hệ thống.');
    await logout();
  };

  const blocked = busy || waitSeconds > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      {/* Ảnh nền sân trường, phủ tối vừa đủ để thẻ ở giữa đạt tương phản tốt. */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/truong-thcs-le-ninh.jpg"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] animate-modal-in rounded-xl border border-line bg-card p-6 shadow-xl">
        {/* ── Đầu thẻ ────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3.5">
            <span className="relative grid h-16 w-16 place-items-center rounded-lg border border-line bg-neutral-25 p-2">
              <Image
                src="/images/logo-thcs-le-ninh.png"
                alt="Logo THCS Lệ Ninh"
                width={56}
                height={56}
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <span
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-warning-500 text-white ring-2 ring-white"
              title="Phiên làm việc tạm khóa"
            >
              <Lock size={13} strokeWidth={2.6} aria-hidden />
            </span>
          </div>

          <p className="m-0 text-2xs font-bold uppercase tracking-[0.09em] text-brand-600">
            Trường THCS Lệ Ninh • Trợ lý Đội
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-ink">Phiên làm việc đã khóa</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Hệ thống tự khóa khi không có thao tác. Dữ liệu đang mở vẫn được giữ nguyên.
          </p>
        </div>

        {/* ── Người dùng đang đăng nhập ─────────────────────────────── */}
        {user ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-neutral-25 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user.fullName ?? user.username} size={32} />
              <div className="min-w-0">
                <p className="m-0 truncate text-base font-semibold text-ink">
                  {user.fullName || user.username}
                </p>
                <p className="m-0 truncate text-xs text-neutral-500">@{user.username}</p>
              </div>
            </div>
            <Badge tone="blue" className="shrink-0">
              {USER_ROLE_LABEL[user.role] ?? 'Thành viên'}
            </Badge>
          </div>
        ) : null}

        {/* ── Biểu mẫu mở khóa ──────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="mt-4">
          <label className="field-label justify-between" htmlFor="lockPassword">
            <span className="flex items-center gap-1.5">
              <KeyRound size={14} className="text-brand-600" aria-hidden />
              Mật khẩu mở khóa
            </span>
            {waitSeconds > 0 ? (
              <span className="flex items-center gap-1 text-xs font-medium text-warning-600">
                <Clock size={12} aria-hidden />
                Thử lại sau {waitSeconds}s
              </span>
            ) : null}
          </label>

          <div className="relative">
            <input
              id="lockPassword"
              ref={inputRef}
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu của bạn"
              autoComplete="current-password"
              required
              disabled={blocked}
              className="field-input h-control-lg pr-11"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </div>

          {status || error ? (
            <p
              role="status"
              className={`notice mt-2.5 ${error || waitSeconds > 0 ? 'notice-danger' : ''}`}
            >
              {error || waitSeconds > 0 ? (
                <AlertCircle size={15} className="mt-[1px] shrink-0" aria-hidden />
              ) : (
                <ShieldCheck size={15} className="mt-[1px] shrink-0" aria-hidden />
              )}
              <span className="flex-1">{status}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">
              Nhập mật khẩu để tiếp tục làm việc mà không mất dữ liệu đang mở.
            </p>
          )}

          <button
            type="submit"
            disabled={blocked || !password.trim()}
            className="btn btn-primary btn-lg mt-3.5 w-full"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Lock size={16} aria-hidden />
            )}
            {waitSeconds > 0 ? `Tạm khóa (${waitSeconds}s)` : 'Mở khóa phiên làm việc'}
          </button>
        </form>

        {/* ── Đổi tài khoản ─────────────────────────────────────────── */}
        <div className="mt-3.5 border-t border-line pt-3 text-center">
          <Button
            size="sm"
            variant="ghost"
            icon={<LogOut size={14} aria-hidden />}
            onClick={() => void handleLogout()}
          >
            Đăng xuất và dùng tài khoản khác
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-neutral-400">
          Nhấn <span className="kbd">Enter</span> để mở khóa
        </p>
      </div>
    </div>
  );
}
