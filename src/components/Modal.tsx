import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function Modal({ open, onClose, title, children, footer, size = "sm" }: ModalProps) {
  const { t } = useLanguage();
  if (!open) return null;

  // Render thang vao document.body (Portal) - tranh bi ket trong stacking context cua to tien
  // (vi du .sidebar dung position:sticky, theo spec CSS luon tao stacking context rieng khien
  // z-index cua modal khong con canh tranh duoc voi cac phan tu khac nam ngoai sidebar).
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("common.close")}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
