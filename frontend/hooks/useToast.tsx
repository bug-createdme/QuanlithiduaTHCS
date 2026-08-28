'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';

export type ToastTone = 'ok' | 'bad' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
  /** Rút gọn cho lỗi — luôn dùng tông đỏ. */
  toastError: (error: unknown) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Bản gốc tự xóa toast sau 3300 ms; giữ nguyên thời lượng đó. */
const TOAST_TTL_MS = 3300;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'ok') => {
      const id = nextId++;
      setItems((current) => [...current, { id, message, tone }]);
      setTimeout(() => remove(id), TOAST_TTL_MS);
    },
    [remove],
  );

  const toastError = useCallback(
    (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Đã xảy ra lỗi không mong muốn. Hãy thử lại.';
      toast(message, 'bad');
    },
    [toast],
  );

  const value = useMemo(() => ({ toast, toastError }), [toast, toastError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2 mobile:bottom-[calc(78px+env(safe-area-inset-bottom))]"
        aria-live="polite"
        role="status"
      >
        {items.map((item) => {
          const Icon = item.tone === 'ok' ? CheckCircle2 : item.tone === 'bad' ? AlertTriangle : Info;
          return (
            <div
              key={item.id}
              className={cx(
                'pointer-events-auto flex animate-toast-in items-start gap-2 rounded-card border px-3 py-2.5 text-[13px] shadow-card',
                item.tone === 'ok' && 'border-green/25 bg-green-soft text-green',
                item.tone === 'bad' && 'border-red/25 bg-red-soft text-[#8c2020]',
                item.tone === 'info' && 'border-blue/25 bg-blue-soft text-blue',
              )}
            >
              <Icon size={16} className="mt-[1px] shrink-0" aria-hidden />
              <span className="flex-1 leading-snug">{item.message}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Đóng thông báo"
                className="shrink-0 opacity-60 hover:opacity-100"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast phải nằm trong ToastProvider.');
  return context;
}
