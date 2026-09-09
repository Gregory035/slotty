import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'error';
interface ToastApi { notify: (message: string, tone?: ToastTone) => void }

const ToastContext = createContext<ToastApi>({ notify: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now();
    setToast({ id, message, tone });
    window.setTimeout(() => setToast((current) => current?.id === id ? null : current), 4000);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`app-toast toast-${toast.tone}`} role="status">
          {toast.tone === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
