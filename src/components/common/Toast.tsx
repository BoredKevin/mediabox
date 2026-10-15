import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Tv, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none flex flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto w-full flex items-center justify-between gap-3 p-3 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-2xl transition-all border ${
            toast.type === 'success'
              ? 'bg-card/95 border-primary text-primary shadow-[0_0_15px_rgba(0,200,212,0.3)]'
              : toast.type === 'error'
              ? 'bg-card/95 border-destructive text-destructive shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'bg-card/95 border-border text-foreground'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-primary" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0 text-destructive" />}
            {toast.type === 'info' && <Tv className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
            <span className="truncate">{toast.message}</span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
