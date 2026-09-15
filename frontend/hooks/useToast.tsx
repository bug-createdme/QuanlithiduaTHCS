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
      {/*
        Góc trên bên phải, luôn nằm trên mọi modal (z-[99999]).
        Trên điện thoại toast bám mép trên và trải rộng để đọc được bằng một mắt nhìn.
      */}
      <div
        className="pointer-events-none fixed right-5 top-5 z-[99999] flex w-[min(400px,calc(100vw-32px))] flex-col gap-2.5 mobile:left-3 mobile:right-3 mobile:top-3 mobile:w-auto"
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
              ? 'Không thực hiện được'
              : isWarn
                ? 'Cảnh báo'
                : 'Thông báo';

          return (
            <div
              key={item.id}
              className="pointer-events-auto relative flex animate-toast-in items-start gap-3 overflow-hidden rounded-lg border border-line bg-card p-3.5 shadow-lg"
            >
              {/* Dải màu bên trái: nhận diện loại thông báo mà không nhuộm cả thẻ. */}
              <span
                aria-hidden
                className={cx(
                  'absolute inset-y-0 left-0 w-1',
                  isSuccess && 'bg-success-500',
                  isError && 'bg-danger-500',
                  isWarn && 'bg-warning-500',
                  !isSuccess && !isError && !isWarn && 'bg-brand-500',
                )}
              />

              <span
                className={cx(
                  'mt-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-md',
                  isSuccess && 'bg-success-50 text-success-600',
                  isError && 'bg-danger-50 text-danger-600',
                  isWarn && 'bg-warning-50 text-warning-600',
                  !isSuccess && !isError && !isWarn && 'bg-brand-50 text-brand-600',
                )}
              >
                <Icon size={16} strokeWidth={2.2} aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-bold text-ink">{title}</p>
                <p className="mt-0.5 break-words text-sm leading-relaxed text-neutral-600">
                  {item.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Đóng thông báo"
                className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X size={15} aria-hidden />
              </button>

              {/* Thanh đếm ngược tới lúc tự đóng. */}
              <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-100">
                <span
                  className={cx(
                    'block h-full w-full origin-left animate-toast-timer',
                    isSuccess && 'bg-success-500',
                    isError && 'bg-danger-500',
                    isWarn && 'bg-warning-500',
                    !isSuccess && !isError && !isWarn && 'bg-brand-500',
                  )}
                />
              </span>
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
