import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Package, Search } from "lucide-react";
import { traceLookup, type TraceResult } from "../api/client";
import TraceDetail from "../components/TraceDetail";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";

export default function TracePage() {
  const notify = useNotify();
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const [input, setInput] = useState(query);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Tra cuu theo tham so ?q= tren URL de co the dan thang toi 1 Lot/tem.
  useEffect(() => {
    setInput(query);
    if (!query) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    traceLookup(query)
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
  }, [query, nonce]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    if (value === query) {
      setNonce((n) => n + 1);
    } else {
      setParams({ q: value });
    }
  }

  const hasDetail = result && (result.type === "label" || result.type === "lot");

  return (
    <div className="page page-wide">
      <div className="filter-bar">
        <form className="filter-search-group" style={{ flex: 1 }} onSubmit={handleSubmit}>
          <span className="filter-search" style={{ flex: 1 }}>
            <Search size={15} />
            <input
              autoFocus
              placeholder={t("trace.searchPlaceholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </span>
          <button type="submit" className="ghost-btn" disabled={loading || !input.trim()}>
            {loading ? <Loader2 size={15} className="spin-icon" /> : <Search size={15} />} {t("common.search")}
          </button>
        </form>
      </div>
      <p className="field-hint" style={{ marginBottom: "1.25rem" }}>
        {t("trace.hint")}
      </p>

      {!query && (
        <div className="table-card">
          <p className="table-empty" style={{ padding: "2rem" }}>
            {t("trace.empty.initial")}
          </p>
        </div>
      )}

      {query && !loading && result?.type === "none" && (
        <div className="result-card warning">
          <div className="result-body">
            <span className="result-title">
              {t("trace.notFound")} <code>{query}</code>
            </span>
          </div>
        </div>
      )}

      {result?.type === "multiple" && (
        <div className="table-card" style={{ padding: "1rem 1.25rem" }}>
          <strong>{t("trace.multiple.title")}</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
            {result.candidates.map((c) => (
              <button key={c} type="button" className="ghost-btn" onClick={() => setParams({ q: c })}>
                <Package size={14} /> {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasDetail && <TraceDetail result={result} onOpenTag={(serial) => setParams({ q: serial })} />}
    </div>
  );
}
