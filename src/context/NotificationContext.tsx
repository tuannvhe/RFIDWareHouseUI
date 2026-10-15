import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastType = "success" | "error" | "warning";

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface NotificationContextValue {
  toasts: Toast[];
  notify: (type: ToastType, title: string, message?: string) => void;
  dismiss: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <NotificationContext.Provider value={{ toasts, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotify must be used within NotificationProvider");
  }
  return ctx.notify;
}

export function useNotificationState() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotificationState must be used within NotificationProvider");
  }
  return ctx;
}
