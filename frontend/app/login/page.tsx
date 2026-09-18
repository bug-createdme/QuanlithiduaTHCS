'use client';

import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
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
 *
 * Bố cục hai cột: cột trái là nhận diện trường (ảnh sân trường + ba điểm giá
 * trị của hệ thống), cột phải là biểu mẫu. Toàn bộ màu sắc, bo góc, cỡ chữ lấy
 * từ design token chung nên trang này không còn là "một hòn đảo phong cách"
 * tách rời phần còn lại của ứng dụng.
 */

const HIGHLIGHTS = [
  {
    icon: Award,
    title: 'Chấm điểm nề nếp',
    text: 'Ghi nhận vi phạm, điểm cộng chuyên cần, vệ sinh và tác phong theo tuần.',
  },
  {
    icon: BarChart3,
    title: 'Xếp hạng tự động',
    text: 'Tính điểm và phân hạng chi đội theo tuần, học kỳ và năm học.',
  },
  {
    icon: ShieldCheck,
    title: 'Số liệu có truy vết',
    text: 'Lưu tập trung trên PostgreSQL, mọi điều chỉnh đều ghi nhật ký.',
  },
];

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

  const blocked = busy || waitSeconds > 0;

  return (
    <div className="flex h-full min-h-screen w-full flex-col overflow-y-auto bg-neutral-950 md:flex-row md:overflow-hidden">
      {/* ══════════════════════════════════════════════════════════════
          CỘT TRÁI — Nhận diện trường (ẩn dưới 851px)
          ══════════════════════════════════════════════════════════════ */}
      <section className="relative hidden w-full flex-col justify-between overflow-hidden p-10 text-white md:flex md:w-[52%] lg:w-[56%] lg:p-12">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/truong-thcs-le-ninh.jpg"
            alt="Sân trường THCS Lệ Ninh trong buổi lễ chào cờ"
            fill
            priority
            sizes="(min-width: 851px) 56vw, 100vw"
            className="object-cover object-center"
          />
          {/*
            Hai lớp phủ: một lớp dọc để chân trang đọc được, một lớp ngang để
            phần chữ bên trái luôn đạt tương phản ≥ 4.5:1 trên mọi khung ảnh.
          */}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/80 to-brand-950/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950/85 to-transparent" />
        </div>

        {/* Đầu trang */}
        <header className="relative z-10 flex items-center gap-3.5">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center drop-shadow-lg">
            <Image
              src="/images/logo-thcs-le-ninh.png"
              alt="Logo Trường THCS Lệ Ninh"
              width={56}
              height={56}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <div>
            <p className="m-0 flex flex-wrap items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.1em] text-brand-200">
              <span>Ủy ban nhân dân xã Lệ Ninh</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-brand-300" />
              <span>Liên đội TNTP Hồ Chí Minh</span>
            </p>
            <p className="m-0 text-lg font-bold uppercase tracking-tight text-white">
              Trường THCS Lệ Ninh
            </p>
          </div>
        </header>

        {/* Khối giữa */}
        <div className="relative z-10 my-auto py-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
            Kỷ cương — Tình thương — Trách nhiệm
          </p>

          <h1 className="max-w-[18ch] text-4xl font-bold leading-[1.15] tracking-tight text-white text-balance">
            Hệ thống quản lý thi đua nề nếp &amp; hoạt động Đội
          </h1>

          <p className="mt-4 max-w-[56ch] text-md leading-relaxed text-brand-100/90">
            Công cụ số hóa dành cho Ban Giám hiệu, Tổng phụ trách Đội và Ban Chỉ huy Liên đội:
            theo dõi chấm điểm Sao đỏ, xếp hạng chi đội và xuất báo cáo nề nếp minh bạch.
          </p>

          <ul className="mt-9 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="rounded-lg border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm"
              >
                <span
                  className="mb-2.5 grid h-8 w-8 place-items-center rounded-md bg-white/15 text-white"
                  aria-hidden
                >
                  <Icon size={17} />
                </span>
                <strong className="block text-sm font-bold text-white">{title}</strong>
                <span className="mt-1 block text-xs leading-relaxed text-brand-100/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Chân trang */}
        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-xs text-brand-100/80">
          <span>Năm học 2025 — 2026 • Chuyển đổi số trường học</span>
          <span>Phiên bản Web Quản trị v1.0</span>
        </footer>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CỘT PHẢI — Biểu mẫu đăng nhập
          ══════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen w-full flex-col justify-between overflow-y-auto bg-canvas p-5 pb-10 sm:p-8 md:min-h-full md:w-[48%] lg:w-[44%] lg:p-10">
        {/* Nền ảnh trường khi màn hình hẹp (cột trái bị ẩn). */}
        <div className="absolute inset-0 z-0 block md:hidden">
          <Image
            src="/images/truong-thcs-le-ninh.jpg"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-brand-950/90" />
        </div>

        {/* Đầu trang trên điện thoại */}
        <header className="relative z-10 mb-6 flex items-center gap-3 md:hidden">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center drop-shadow-md">
            <Image
              src="/images/logo-thcs-le-ninh.png"
              alt="Logo THCS Lệ Ninh"
              width={48}
              height={48}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <div>
            <p className="m-0 text-2xs font-bold uppercase tracking-[0.1em] text-brand-200">
              Ủy ban nhân dân xã Lệ Ninh
            </p>
            <p className="m-0 text-md font-bold uppercase text-white">THCS Lệ Ninh</p>
          </div>
        </header>

        {/* Thẻ biểu mẫu */}
        <div className="relative z-10 my-auto w-full max-w-[420px] self-center rounded-xl border border-line bg-card p-6 shadow-lg sm:p-7">
          <div className="mb-6">
            <span
              className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-brand-50 text-brand-600"
              aria-hidden
            >
              <Lock size={22} />
            </span>
            <h2 className="m-0 text-2xl font-bold tracking-tight text-ink">Đăng nhập hệ thống</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              Dành cho Ban Giám hiệu, Tổng phụ trách Đội và Ban Chỉ huy Liên đội.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="field-label field-label-required">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={blocked}
                  placeholder="Nhập tên đăng nhập"
                  className="field-input h-control-lg pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="field-label field-label-required">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  id="password"
                  ref={passwordRef}
                  type={reveal ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={blocked}
                  placeholder="Nhập mật khẩu"
                  className="field-input h-control-lg pl-9 pr-11"
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
            </div>

            {/* Phản hồi: lỗi, đếm ngược chặn, hoặc dòng trấn an mặc định. */}
            {error && status && waitSeconds <= 0 ? (
              <p className="notice notice-danger m-0" role="alert">
                <AlertCircle size={16} className="mt-[1px] shrink-0" aria-hidden />
                <span className="flex-1">{status}</span>
              </p>
            ) : waitSeconds > 0 ? (
              <p className="notice notice-warn m-0" role="alert">
                <Clock size={16} className="mt-[1px] shrink-0" aria-hidden />
                <span className="flex-1">{status}</span>
              </p>
            ) : (
              <p className="m-0 flex items-center gap-2 text-xs text-neutral-500">
                <ShieldCheck size={15} className="shrink-0 text-success-600" aria-hidden />
                Phiên làm việc bảo mật. Ứng dụng không ghi nhớ mật khẩu trên máy này.
              </p>
            )}

            <button type="submit" disabled={blocked} className="btn btn-primary btn-lg w-full">
              {busy ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden />
                  Đang xác thực…
                </>
              ) : waitSeconds > 0 ? (
                <>
                  <Clock size={17} aria-hidden />
                  Thử lại sau {waitSeconds}s
                </>
              ) : (
                <>
                  Mở ứng dụng quản lý
                  <ArrowRight size={17} aria-hidden />
                </>
              )}
            </button>
          </form>

          <div className="notice mt-5">
            <div>
              <strong className="block">Tài khoản khởi tạo</strong>
              Tài khoản mặc định là{' '}
              <code className="rounded-xs bg-brand-100 px-1.5 py-0.5 font-bold">admin</code>. Hệ
              thống bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
            </div>
          </div>
        </div>

        <footer className="relative z-10 mt-6 text-center text-xs text-neutral-400 md:text-neutral-500">
          <p className="m-0">© 2026 Trường THCS Lệ Ninh — Lệ Ninh, Quảng Trị</p>
          <p className="m-0 mt-0.5 opacity-80">
            Hệ thống Quản lý Thi đua Nề nếp &amp; Hoạt động Đội THCS
          </p>
        </footer>
      </section>
    </div>
  );
}
