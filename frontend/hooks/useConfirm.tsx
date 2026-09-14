'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';

export interface ConfirmOptions {
  title?: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warn';
  /** Thông báo toast hiển thị ngay khi bấm xác nhận */
  confirmToast?: string;
  /** Thông báo toast hiển thị khi bấm hủy (mặc định: 'Đã hủy thao tác.') */
  cancelToast?: string | false;
}

export type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFunction = useCallback((options) => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions =
        typeof options === 'string'
          ? { title: 'Xác nhận thao tác', description: options }
          : options;

      setDialogState({
        open: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialogState) {
      if (dialogState.options.confirmToast) {
        toast(dialogState.options.confirmToast, 'ok');
      }
      dialogState.resolve(true);
      setDialogState(null);
    }
  }, [dialogState, toast]);

  const handleCancel = useCallback(() => {
    if (dialogState) {
      if (dialogState.options.cancelToast !== false) {
        toast(dialogState.options.cancelToast || 'Đã hủy thao tác.', 'info');
      }
      dialogState.resolve(false);
      setDialogState(null);
    }
  }, [dialogState, toast]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialogState ? (
        <ConfirmDialog
          open={dialogState.open}
          title={dialogState.options.title || 'Xác nhận thao tác'}
          description={dialogState.options.description}
          confirmLabel={dialogState.options.confirmLabel || 'Xác nhận'}
          cancelLabel={dialogState.options.cancelLabel || 'Hủy'}
          tone={dialogState.options.tone || 'danger'}
          cancelToast={false} // Đã xử lý cancelToast trong handleCancel ở trên
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFunction {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm phải được dùng bên trong ConfirmProvider.');
  }
  return context;
}
