import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function LoadingOverlay({ text }: { text?: string }) {
  const { t } = useLanguage();
  return createPortal(
    <div className="loading-overlay">
      <div className="loading-box">
        <Loader2 size={30} className="spin-icon" />
        <span>{text ?? t("common.processing")}</span>
      </div>
    </div>,
    document.body,
  );
}
