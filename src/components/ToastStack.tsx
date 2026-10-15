import { CheckCircle2, X, XCircle, AlertTriangle } from "lucide-react";
import { useNotificationState } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

export default function ToastStack() {
  const { toasts, dismiss } = useNotificationState();
  const { t } = useLanguage();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              <Icon size={17} />
            </span>
            <div className="toast-body">
              <span className="toast-title">{toast.title}</span>
              {toast.message && <span className="toast-message">{toast.message}</span>}
            </div>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label={t("common.close")}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
