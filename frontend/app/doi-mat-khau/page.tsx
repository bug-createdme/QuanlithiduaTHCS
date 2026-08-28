'use client';

import { KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ApiError, api } from '@/services/api';
import { Button, Notice } from '@/components/ui';

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
    <div className="grid h-full place-items-center overflow-auto bg-gradient-to-br from-[#0a3764] to-[#0b6bcb] p-4">
      <div className="w-full max-w-[440px] rounded-card bg-card p-6 shadow-modal">
        <div className="mb-4 flex flex-col items-center text-center">
          <span
            className="mb-3 grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-blue text-white"
            aria-hidden
          >
            <KeyRound size={24} />
          </span>
          <h1 className="m-0 text-[16px] font-bold">Đổi mật khẩu</h1>
          <p className="mt-1 text-[12.5px] text-muted">Tài khoản: {user.fullName}</p>
        </div>

        {user.mustChangePassword ? (
          <Notice tone="warn" className="mb-3">
            Tài khoản đang dùng mật khẩu khởi tạo mặc định. Hãy đặt mật khẩu riêng trước khi sử dụng
            hệ thống.
          </Notice>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
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
              className="field-input"
            />
            {issues.currentPassword ? (
              <span className="mt-1 block text-[11px] font-semibold text-red">
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
              className="field-input"
            />
            <span className="field-hint">Tối thiểu 8 ký tự, khác mật khẩu hiện tại.</span>
            {issues.newPassword ? (
              <span className="mt-1 block text-[11px] font-semibold text-red">
                {issues.newPassword}
              </span>
            ) : null}
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
              className="field-input"
            />
            {issues.confirmPassword ? (
              <span className="mt-1 block text-[11px] font-semibold text-red">
                {issues.confirmPassword}
              </span>
            ) : null}
          </div>

          {message ? <p className="text-[12px] font-semibold text-red">{message}</p> : null}

          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            Đổi mật khẩu
          </Button>
        </form>

        {!user.mustChangePassword ? (
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-3 w-full text-center text-[12px] text-muted hover:text-blue hover:underline"
          >
            Quay lại Tổng quan
          </button>
        ) : null}
      </div>
    </div>
  );
}
