import { AppShell } from '@/components/layout/AppShell';

/** Bọc toàn bộ 16 trang nghiệp vụ trong khung ứng dụng đã xác thực. */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
