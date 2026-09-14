'use client';

import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/api';

/**
 * Trang đăng nhập hệ thống Quản lý Thi đua Nề nếp — Trường THCS Lệ Ninh.
 * Giao diện Dual-Pane kết hợp hình ảnh thực tế sân trường, nhận diện Liên đội
 * và biểu mẫu đăng nhập hiện đại với cơ chế bảo mật phía máy chủ.
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.mustChangePassword ? '/doi-mat-khau' : '/dashboard');
    }
  }, [loading, user, router]);

  useEffect(() => {
    const timer = setTimeout(() => passwordRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // Đếm ngược khi server chặn do nhập sai nhiều lần (backoff mũ 2)
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setInterval(() => {
      setWaitSeconds((current) => {
        if (current <= 1) {
          setStatus(null);
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
    setStatus('Đang xác thực thông tin & mở phiên làm việc…');
    try {
      const account = await login(username.trim(), password);
      setPassword('');
      toast(`Đăng nhập thành công! Chào mừng ${account.fullName || account.username}.`);
      router.replace(account.mustChangePassword ? '/doi-mat-khau' : '/dashboard');
    } catch (err) {
      setPassword('');
      setError(true);
      if (err instanceof ApiError && err.code === 'AUTH_BLOCKED') {
        const wait = Number(err.details?.waitSeconds ?? 0);
        setWaitSeconds(wait);
        setStatus(`Bạn đã nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau ${wait} giây.`);
      } else {
        setStatus(
          err instanceof Error
            ? err.message
            : 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản và mật khẩu.',
        );
      }
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-y-auto bg-[#051c38] md:flex-row md:overflow-hidden">
      {/* ────────────────────────────────────────────────────────────
          CỘT TRÁI (HERO PANE): Banner hình ảnh trường THCS Lệ Ninh
          ──────────────────────────────────────────────────────────── */}
      <div className="relative hidden w-full flex-col justify-between overflow-hidden p-8 text-white md:flex md:w-[55%] lg:w-[58%] lg:p-12 xl:w-[60%]">
        {/* Hình nền ảnh thực tế của trường với bộ lọc tối ưu hiển thị chữ */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/truong-thcs-le-ninh.jpg"
            alt="Sân trường THCS Lệ Ninh trong buổi lễ chào cờ"
            fill
            priority
            sizes="(min-width: 851px) 60vw, 100vw"
            className="object-cover object-center scale-105 transition-transform duration-1000 ease-out hover:scale-100"
          />
          {/* Lớp phủ chuyển màu (gradient overlay đa tầng) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#04162e] via-[#082b52]/85 to-[#051c38]/75 backdrop-brightness-[0.85]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#04162e]/90 via-transparent to-[#04162e]/40" />

          {/* Vùng sáng trang trí ambient glow */}
          <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-12 left-12 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        </div>

        {/* Khối đầu trang Hero (Header) */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            {/* Logo chính thức Trường THCS Lệ Ninh */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center drop-shadow-xl transition-transform duration-300 hover:scale-105">
              <Image
                src="/images/logo-thcs-le-ninh.png"
                alt="Logo Trường THCS Lệ Ninh"
                width={64}
                height={64}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <span>Phòng GD&ĐT Huyện Lệ Thủy</span>
                <span className="inline-block h-1 w-1 rounded-full bg-amber-400" />
                <span className="text-sky-200">Liên đội TNTP Hồ Chí Minh</span>
              </div>
              <h2 className="text-[18px] font-black uppercase tracking-tight text-white drop-shadow-md lg:text-[20px]">
                Trường THCS Lệ Ninh
              </h2>
            </div>
          </div>
        </div>

        {/* Khối giữa Hero: Khẩu hiệu & Giới thiệu tính năng */}
        <div className="relative z-10 my-auto py-8">
          {/* Huy hiệu khẩu hiệu lấy từ khán đài trường trong bức ảnh thực tế */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-3.5 py-1.5 text-[12px] font-semibold text-amber-300 backdrop-blur-md shadow-sm">
            <Sparkles size={14} className="animate-pulse text-amber-400" />
            <span>VỮNG BƯỚC TƯƠNG LAI • KỶ CƯƠNG — TÌNH THƯƠNG — TRÁCH NHIỆM</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-tight text-white drop-shadow-md lg:text-4xl xl:text-[40px]">
            Hệ Thống Quản Lý Thi Đua <br />
            <span className="bg-gradient-to-r from-sky-300 via-blue-200 to-amber-200 bg-clip-text text-transparent">
              Nề Nếp & Hoạt Động Đội
            </span>
          </h1>

          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-slate-200/90 lg:text-[14.5px]">
            Giải pháp số hóa toàn diện dành cho Ban Giám hiệu, Tổng phụ trách Đội và Ban Chỉ huy
            Liên đội THCS Lệ Ninh. Theo dõi chấm điểm Sao đỏ, tự động xếp hạng thi đua chi đội và
            xuất báo cáo nề nếp minh bạch.
          </p>

          {/* 3 Thẻ tính năng mờ kính Glassmorphism */}
          <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-white/15">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
                <Award size={18} />
              </div>
              <h3 className="text-[13px] font-bold text-white">Chấm điểm Nề nếp</h3>
              <p className="mt-1 text-[11.5px] leading-snug text-slate-200/80">
                Ghi nhận vi phạm, điểm cộng chuyên cần, vệ sinh và tác phong thời gian thực.
              </p>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-white/15">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/20 text-emerald-300">
                <BarChart3 size={18} />
              </div>
              <h3 className="text-[13px] font-bold text-white">Xếp hạng Tự động</h3>
              <p className="mt-1 text-[11.5px] leading-snug text-slate-200/80">
                Tính điểm và phân hạng chi đội theo tuần, tháng và học kỳ chuẩn xác, công bằng.
              </p>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-white/15">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/20 text-sky-300">
                <CheckCircle2 size={18} />
              </div>
              <h3 className="text-[13px] font-bold text-white">Số hóa Dữ liệu</h3>
              <p className="mt-1 text-[11.5px] leading-snug text-slate-200/80">
                Lưu trữ tập trung trên PostgreSQL, xuất báo cáo tổng hợp phục vụ chào cờ đầu tuần.
              </p>
            </div>
          </div>
        </div>

        {/* Khối chân trang Hero */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-[12px] text-slate-300/80">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Năm học 2025 — 2026 • Chuyển đổi số trường học</span>
          </div>
          <span className="text-[11px] text-slate-400">Phiên bản Web Quản trị v1.0</span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          CỘT PHẢI: Form Đăng nhập Quản trị Hiện đại
          ──────────────────────────────────────────────────────────── */}
      <div className="relative flex min-h-screen w-full flex-col justify-between overflow-y-auto bg-slate-50 p-6 pb-12 sm:p-10 md:w-[45%] md:min-h-full md:border-l md:border-slate-200 lg:w-[42%] lg:p-12 xl:w-[40%]">
        {/* Nền ảnh trường trên thiết bị di động (khi màn hình hẹp ẩn cột trái) */}
        <div className="absolute inset-0 z-0 block md:hidden">
          <Image
            src="/images/truong-thcs-le-ninh.jpg"
            alt="Trường THCS Lệ Ninh"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center brightness-[0.22]"
          />
          <div className="absolute inset-0 bg-[#051c38]/90 backdrop-blur-sm" />
        </div>

        {/* Header trên Mobile */}
        <div className="relative z-10 mb-6 flex items-center gap-3.5 md:hidden">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center drop-shadow-lg">
            <Image
              src="/images/logo-thcs-le-ninh.png"
              alt="Logo THCS Lệ Ninh"
              width={56}
              height={56}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Phòng GD&ĐT Lệ Thủy
            </span>
            <h2 className="text-[17px] font-black uppercase text-white">THCS LỆ NINH</h2>
          </div>
        </div>

        {/* Khung Form Đăng nhập ở giữa */}
        <div className="relative z-10 my-auto w-full max-w-[420px] self-center rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-300/30 md:p-8">
          {/* Logo & Tiêu đề biểu mẫu */}
          <div className="mb-6 text-center md:text-left">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center drop-shadow-md transition-transform duration-300 hover:scale-105">
                <Image
                  src="/images/logo-thcs-le-ninh.png"
                  alt="Logo Trường THCS Lệ Ninh"
                  width={80}
                  height={80}
                  priority
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11.5px] font-bold text-blue-800 shadow-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>THCS LỆ NINH</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Hệ thống Quản lý Thi đua</span>
              </div>
            </div>

            <h2 className="mt-4 text-[21px] font-black tracking-tight text-slate-900 md:text-[23px]">
              Cổng Đăng Nhập Quản Trị
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Dành cho Ban Giám hiệu, Tổng phụ trách Đội & Ban Chỉ huy Liên đội.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Trường: Tên đăng nhập */}
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-[12.5px] font-semibold text-slate-700"
              >
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User size={17} aria-hidden />
                </div>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={busy || waitSeconds > 0}
                  placeholder="Nhập tên đăng nhập..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Trường: Mật khẩu */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12.5px] font-semibold text-slate-700"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock size={17} aria-hidden />
                </div>
                <input
                  id="password"
                  ref={passwordRef}
                  type={reveal ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy || waitSeconds > 0}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-700"
                >
                  {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Trạng thái thông báo phản hồi (Lỗi / Đếm ngược / Hướng dẫn) */}
            {error && status ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700 animate-fade-in"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
                <span className="font-medium leading-relaxed">{status}</span>
              </div>
            ) : waitSeconds > 0 ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 animate-fade-in"
              >
                <Clock size={16} className="mt-0.5 shrink-0 animate-spin text-amber-600" aria-hidden />
                <span className="font-medium leading-relaxed">{status}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                <ShieldCheck size={15} className="shrink-0 text-emerald-600" aria-hidden />
                <span>Phiên làm việc bảo mật cao. Ứng dụng không ghi nhớ mật khẩu.</span>
              </div>
            )}

            {/* Nút Đăng nhập Gradient nổi bật */}
            <button
              type="submit"
              disabled={busy || waitSeconds > 0}
              className="group relative mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0a3764] via-[#0757a6] to-[#0b6bcb] text-[14px] font-semibold text-white shadow-lg shadow-blue-700/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-700/35 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {busy ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  <span>Đang xác thực & mở dữ liệu…</span>
                </>
              ) : waitSeconds > 0 ? (
                <>
                  <Clock size={16} className="animate-spin" aria-hidden />
                  <span>Thử lại sau {waitSeconds}s</span>
                </>
              ) : (
                <>
                  <span>Mở ứng dụng Quản lý</span>
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </>
              )}
            </button>
          </form>

          {/* Khối gợi ý tài khoản ban đầu */}
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11.5px] leading-relaxed text-slate-600">
            <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-blue-900">
              <Sparkles size={13} className="text-blue-600" aria-hidden />
              <span>Tài khoản khởi tạo:</span>
            </div>
            <p>
              Tài khoản mặc định là <code className="rounded bg-blue-100/80 px-1.5 py-0.5 font-bold text-blue-800">admin</code>.
              Hệ thống bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên để đảm bảo an toàn.
            </p>
          </div>
        </div>

        {/* Chân trang biểu mẫu */}
        <div className="relative z-10 mt-6 text-center text-[11.5px] text-slate-400 md:text-slate-500">
          <p>© 2026 Trường THCS Lệ Ninh — Lệ Thủy, Quảng Bình</p>
          <p className="mt-0.5 text-[11px] opacity-80">
            Hệ thống Quản lý Thi đua Nề nếp & Hoạt động Đội THCS
          </p>
        </div>
      </div>
    </div>
  );
}
