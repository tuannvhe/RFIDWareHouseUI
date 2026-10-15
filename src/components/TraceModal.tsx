import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { traceLookup, type TraceResult } from "../api/client";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";
import Modal from "./Modal";
import TraceDetail from "./TraceDetail";

interface TraceModalProps {
  // Ma Lot/tem can truy vet; null = dong modal.
  query: string | null;
  onClose: () => void;
}

// Cua so truy vet mo ngay tai trang hien tai (khong roi khoi trang). Bam vao 1 tem trong danh sach cua
// Lot se xem rieng tem do, nut "Quay lai" tro ve ket qua truoc.
export default function TraceModal({ query, onClose }: TraceModalProps) {
  const notify = useNotify();
  const { t } = useLanguage();
  const [stack, setStack] = useState<string[]>([]);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStack(query ? [query] : []);
    setResult(null);
  }, [query]);

  const current = stack.length > 0 ? stack[stack.length - 1] : null;

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    traceLookup(current)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult(null);
        notify("error", t("common.loadError.title"), err instanceof Error ? err.message : t("common.loadError.body"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const hasDetail = result && (result.type === "label" || result.type === "lot");

  return (
    <Modal open={query !== null} onClose={onClose} title={`${t("trace.modal.title")}: ${current ?? ""}`} size="lg">
      {stack.length > 1 && (
        <button
          type="button"
          className="ghost-btn"
          style={{ marginBottom: "1rem" }}
          onClick={() => setStack((s) => s.slice(0, -1))}
        >
          <ArrowLeft size={14} /> {t("trace.modal.back")}
        </button>
      )}

      {loading && (
        <p className="table-empty">
          <Loader2 size={16} className="spin-icon" />
        </p>
      )}

      {!loading && result?.type === "none" && (
        <p className="table-empty">
          {t("trace.notFound")} <code>{current}</code>
        </p>
      )}

      {!loading && hasDetail && (
        <TraceDetail result={result} onOpenTag={(serial) => setStack((s) => [...s, serial])} />
      )}
    </Modal>
  );
}
