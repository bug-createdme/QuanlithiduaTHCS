'use client';

import Image from 'next/image';
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { USER_ROLE_LABEL } from '@/lib/labels';
import { ApiError } from '@/services/api';

/**
 * Màn hình khóa phiên làm việc hiện đại — phong cách Glassmorphism & High-End Security.
 * Phiên làm việc vẫn còn hiệu lực trong bộ nhớ; người dùng xác thực lại mật khẩu để tiếp tục.
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
        setStatus(err instanceof Error ? err.message : 'Mật khẩu không chính xác. Vui lòng thử lại.');
      }
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Xác nhận đăng xuất',
      description: 'Bạn có chắc chắn muốn đăng xuất và chuyển sang tài khoản khác không? Dữ liệu chưa lưu có thể bị mất.',
      confirmLabel: 'Đăng xuất',
      cancelLabel: 'Ở lại',
      tone: 'danger',
    });
    if (!ok) return;
    toast('Đã đăng xuất khỏi hệ thống.');
    await logout();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      {/* ────────────────────────────────────────────────────────────
          HÌNH NỀN RÕ NÉT CỦA TRƯỜNG THCS LỆ NINH (KHÔNG PHỦ MÀU XANH)
          ──────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/truong-thcs-le-ninh.jpg"
          alt="Hình nền trường THCS Lệ Ninh"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Lớp phủ tối nhẹ 20% trong suốt để làm nổi bật thẻ form chính giữa mà ảnh trường vẫn rõ nét */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* ────────────────────────────────────────────────────────────
          BẢNG NHẬP NỔI CHÍNH GIỮA (FLOATING GLASS CARD)
          ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[430px] animate-modal-in rounded-3xl border border-white/30 bg-white/95 p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.55),0_0_50px_rgba(11,107,203,0.18)] backdrop-blur-2xl sm:p-7">
        {/* Header: Logo và trạng thái */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3.5">
            {/* Vòng nền tròn chứa Logo trường */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50 p-2 shadow-lg shadow-black/10 ring-4 ring-blue-500/15">
              <Image
                src="/images/logo-thcs-le-ninh.png"
                alt="Logo THCS Lệ Ninh"
                width={72}
                height={72}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            {/* Huy hiệu khóa màu cam hổ phách */}
            <div
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md ring-2 ring-white"
              title="Phiên làm việc tạm khóa"
            >
              <Lock size={13} strokeWidth={2.6} aria-hidden />
            </div>
          </div>

          <span className="text-[11px] font-bold tracking-wider text-blue uppercase">
            Trường THCS Lệ Ninh • Trợ lý Đội
          </span>
          <h1 className="mt-1 text-[18px] font-extrabold tracking-tight text-slate-900">
            Phiên Làm Việc Đã Khóa
          </h1>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            Hệ thống tạm khóa bảo mật khi không có thao tác.
          </p>

          {/* Thẻ định danh người dùng đang đăng nhập */}
          {user ? (
            <div className="mt-3.5 flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2 text-left shadow-inner">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100/90 text-blue-700 font-bold text-[13px]">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : <UserIcon size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-slate-800">
                    {user.fullName || user.username}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    @{user.username}
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                {USER_ROLE_LABEL[user.role] ?? 'Thành viên'}
              </span>
            </div>
          ) : null}
        </div>

        {/* Form nhập mật khẩu mở khóa */}
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="space-y-1.5">
            <label
              className="flex items-center justify-between text-[12.5px] font-semibold text-slate-700"
              htmlFor="lockPassword"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound size={14} className="text-blue" aria-hidden />
                Mật khẩu mở khóa
              </span>
              {waitSeconds > 0 ? (
                <span className="flex items-center gap-1 text-[11.5px] font-medium text-amber-600">
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
                placeholder="Nhập mật khẩu của bạn…"
                autoComplete="current-password"
                required
                disabled={busy || waitSeconds > 0}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-[13.5px] text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
              >
                {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
          </div>

          {/* Thông báo trạng thái hoặc lỗi */}
          {status || error ? (
            <div
              role="status"
              className={`mt-2.5 flex items-start gap-2 rounded-xl p-2.5 text-[12px] leading-snug transition-all ${
                error || waitSeconds > 0
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-blue-100 bg-blue-50/80 text-blue-700'
              }`}
            >
              {error || waitSeconds > 0 ? (
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" aria-hidden />
              ) : (
                <ShieldCheck size={15} className="shrink-0 mt-0.5 text-blue-500" aria-hidden />
              )}
              <span className="flex-1">{status}</span>
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] text-slate-500">
              Nhập mật khẩu để tiếp tục làm việc mà không mất dữ liệu đang mở.
            </p>
          )}

          {/* Nút mở khóa chính */}
          <button
            type="submit"
            disabled={busy || waitSeconds > 0 || !password.trim()}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0b6bcb] via-[#0960b7] to-[#0854a0] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {busy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Lock size={15} aria-hidden />
            )}
            <span>{waitSeconds > 0 ? `Tạm khóa (${waitSeconds}s)` : 'Mở khóa phiên làm việc'}</span>
          </button>
        </form>

        {/* Nút đăng xuất chuyển tài khoản */}
        <div className="mt-3.5 border-t border-slate-200/80 pt-3 text-center">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={13} aria-hidden />
            <span>Đăng xuất và dùng tài khoản khác</span>
          </button>
        </div>

        {/* Chân thẻ: Thông điệp bảo mật */}
        <div className="mt-2 text-center text-[11px] text-slate-400">
          Nhấn <strong>Enter</strong> để mở khóa • Dữ liệu lưu an toàn trên PostgreSQL
        </div>
      </div>
    </div>
  );
}

