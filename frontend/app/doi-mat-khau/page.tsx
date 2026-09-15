'use client';

import { ArrowLeft, KeyRound } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError, api } from '@/services/api';
import { Avatar, Button, Notice } from '@/components/ui';

/**
 * Đổi mật khẩu. Bắt buộc ở lần đăng nhập đầu vì tài khoản seed dùng
 * mật khẩu mặc định kế thừa từ bản gốc ("admin@") — không được để nguyên.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setIssues({});
    setMessage('');
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      toast('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.');
      await logout();
    } catch (err) {
      if (err instanceof ApiError && err.issues?.length) {
        setIssues(Object.fromEntries(err.issues.map((i) => [i.field, i.message])));
      }
      setMessage(err instanceof Error ? err.message : 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="relative grid h-full place-items-center overflow-auto bg-neutral-950 p-4">
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
        <div className="absolute inset-0 bg-brand-950/88" />
      </div>

      <div className="relative z-10 w-full max-w-[460px] rounded-xl border border-line bg-card p-6 shadow-xl sm:p-7">
        <div className="mb-5 flex items-center gap-3.5">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"
            aria-hidden
          >
            <KeyRound size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-2xl font-bold tracking-tight text-ink">Đổi mật khẩu</h1>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              Tài khoản: {user.fullName || user.username}
            </p>
          </div>
        </div>

        {user.mustChangePassword ? (
          <Notice tone="warn" title="Đang dùng mật khẩu khởi tạo mặc định." className="mb-4">
            Hãy đặt mật khẩu riêng trước khi sử dụng hệ thống.
          </Notice>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="field-label field-label-required" htmlFor="currentPassword">
              Mật khẩu hiện tại
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={Boolean(issues.currentPassword) || undefined}
              className={`field-input${issues.currentPassword ? ' field-input-error' : ''}`}
            />
            {issues.currentPassword ? (
              <span className="field-error" role="alert">
                {issues.currentPassword}
              </span>
            ) : null}
          </div>

          <div>
            <label className="field-label field-label-required" htmlFor="newPassword">
              Mật khẩu mới
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              aria-invalid={Boolean(issues.newPassword) || undefined}
              className={`field-input${issues.newPassword ? ' field-input-error' : ''}`}
            />
            {issues.newPassword ? (
              <span className="field-error" role="alert">
                {issues.newPassword}
              </span>
            ) : (
              <span className="field-hint">Tối thiểu 8 ký tự, khác mật khẩu hiện tại.</span>
            )}
          </div>

          <div>
            <label className="field-label field-label-required" htmlFor="confirmPassword">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              aria-invalid={Boolean(issues.confirmPassword) || undefined}
              className={`field-input${issues.confirmPassword ? ' field-input-error' : ''}`}
            />
            {issues.confirmPassword ? (
              <span className="field-error" role="alert">
                {issues.confirmPassword}
              </span>
            ) : null}
          </div>

          {message ? (
            <Notice tone="danger" className="m-0">
              {message}
            </Notice>
          ) : null}

          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            Đổi mật khẩu
          </Button>
        </form>

        {!user.mustChangePassword ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={user.fullName ?? user.username} size={26} />
              <span className="truncate text-xs text-neutral-500">@{user.username}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowLeft size={14} aria-hidden />}
              onClick={() => router.push('/dashboard')}
            >
              Quay lại Tổng quan
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
