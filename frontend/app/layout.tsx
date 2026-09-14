import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/hooks/useAuth';
import { ConfirmProvider } from '@/hooks/useConfirm';
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
      { url: '/images/logo-thcs-le-ninh.png', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
    apple: '/images/logo-thcs-le-ninh.png',
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
      <body data-paper="landscape" suppressHydrationWarning>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <ScopeProvider>{children}</ScopeProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
