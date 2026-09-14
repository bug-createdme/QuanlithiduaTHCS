'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';

export type ToastTone = 'ok' | 'bad' | 'info' | 'warn' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastCallable {
  (message: string, tone?: ToastTone): void;
  success: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
}

export interface ToastApi {
  toast: ToastCallable;
  /** Rút gọn cho lỗi — luôn dùng tông đỏ. */
  toastError: (error: unknown) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Tự xóa toast sau 4500 ms để người dùng kịp đọc và xác nhận */
const TOAST_TTL_MS = 4500;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const remove = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const baseToast = useCallback(
    (message: string, tone: ToastTone = 'ok') => {
      const id = nextId++;
      setItems((current) => [...current, { id, message, tone }]);

      const timer = setTimeout(() => {
        remove(id);
      }, TOAST_TTL_MS);
      timersRef.current.set(id, timer);
    },
    [remove],
  );

  const toast = useMemo(() => {
    const fn = ((message: string, tone: ToastTone = 'ok') => {
      baseToast(message, tone);
    }) as ToastCallable;

    fn.success = (message: string) => baseToast(message, 'ok');
    fn.error = (message: string) => baseToast(message, 'bad');
    fn.warn = (message: string) => baseToast(message, 'warn');
    fn.info = (message: string) => baseToast(message, 'info');

    return fn;
  }, [baseToast]);

  const toastError = useCallback(
    (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Đã xảy ra lỗi không mong muốn. Hãy thử lại.';
      baseToast(message, 'bad');
    },
    [baseToast],
  );

  const value = useMemo(() => ({ toast, toastError }), [toast, toastError]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __toast?: ToastCallable }).__toast = toast;
    }
  }, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Vị trí góc trên bên phải nổi bật nhất, luôn trên cùng mọi modal và cửa sổ (z-[99999]) */}
      <div
        className="pointer-events-none fixed top-5 right-5 z-[99999] flex w-[min(420px,calc(100vw-32px))] flex-col gap-2.5 mobile:top-3 mobile:right-3 mobile:left-3 mobile:w-auto"
        aria-live="polite"
        role="status"
      >
        {items.map((item) => {
          const isSuccess = item.tone === 'ok' || item.tone === 'success';
          const isError = item.tone === 'bad' || item.tone === 'error';
          const isWarn = item.tone === 'warn';

          const Icon = isSuccess
            ? CheckCircle2
            : isError
              ? AlertCircle
              : isWarn
                ? AlertTriangle
                : Info;

          const title = isSuccess
            ? 'Thành công'
            : isError
              ? 'Lỗi thao tác'
              : isWarn
                ? 'Cảnh báo'
                : 'Thông báo';

          return (
            <div
              key={item.id}
              className={cx(
                'pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-2xl border bg-white/[0.98] p-3.5 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.06)] ring-1 ring-black/5 backdrop-blur-xl animate-toast-in transition-all duration-200 hover:shadow-2xl',
                isSuccess && 'border-emerald-300/80 text-slate-800',
                isError && 'border-rose-300/80 text-slate-800',
                isWarn && 'border-amber-300/80 text-slate-800',
                !isSuccess && !isError && !isWarn && 'border-sky-300/80 text-slate-800',
              )}
            >
              {/* Huy hiệu tròn biểu tượng đậm màu sắc nét */}
              <div
                className={cx(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ring-2 ring-white',
                  isSuccess && 'bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white',
                  isError && 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white',
                  isWarn && 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white',
                  !isSuccess && !isError && !isWarn && 'bg-gradient-to-tr from-blue to-sky-500 text-white',
                )}
              >
                <Icon size={18} strokeWidth={2.4} aria-hidden />
              </div>

              {/* Nội dung thông báo */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cx(
                      'text-[12.5px] font-bold tracking-tight',
                      isSuccess && 'text-emerald-950',
                      isError && 'text-rose-950',
                      isWarn && 'text-amber-950',
                      !isSuccess && !isError && !isWarn && 'text-sky-950',
                    )}
                  >
                    {title}
                  </span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600 break-words font-medium">
                  {item.message}
                </p>
              </div>

              {/* Nút đóng nhanh */}
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Đóng thông báo"
                className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95"
              >
                <X size={15} aria-hidden />
              </button>

              {/* Thanh tiến trình đếm ngược thời gian tự đóng */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100/90 overflow-hidden">
                <div
                  className={cx(
                    'h-full w-full animate-toast-timer origin-left',
                    isSuccess && 'bg-emerald-500',
                    isError && 'bg-rose-500',
                    isWarn && 'bg-amber-500',
                    !isSuccess && !isError && !isWarn && 'bg-blue',
                  )}
                />
              </div>
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
