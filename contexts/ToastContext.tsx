'use client';

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { Toast } from '../types';

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  // Kept for backward compat — AppShell no longer renders ToastContainer
  toasts: Toast[];
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const opts = {
      description: t.details,
      // Errors stay until dismissed; others auto-dismiss
      duration: t.type === 'error' ? Infinity : 4000,
    };

    if (t.type === 'success') toast.success(t.message, opts);
    else if (t.type === 'error')   toast.error(t.message, opts);
    else if (t.type === 'warning') toast.warning(t.message, opts);
    else                           toast.info(t.message, opts);
  }, []);

  // No-ops kept so nothing that destructures { toasts, removeToast } breaks
  const removeToast = useCallback((_id: number) => {}, []);

  return (
    <ToastContext.Provider value={{ addToast, toasts: [], removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
