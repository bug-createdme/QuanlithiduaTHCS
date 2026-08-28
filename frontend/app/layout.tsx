import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/hooks/useAuth';
import { ScopeProvider } from '@/hooks/useScope';
import { ToastProvider } from '@/hooks/useToast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trợ lý Tổng phụ trách Đội THCS',
  description:
    'Trợ lý quản lý công tác Đội, thi đua lớp và báo cáo dành cho Tổng phụ trách Đội THCS.',
  applicationName: 'Trợ lý TPT Đội',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
    apple: '/icons/icon-192.svg',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b6bcb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/* data-paper điều khiển khổ in A4 ngang/dọc, giống bản gốc. */}
      <body data-paper="landscape">
        <ToastProvider>
          <AuthProvider>
            <ScopeProvider>{children}</ScopeProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
