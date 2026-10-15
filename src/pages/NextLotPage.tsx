import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDownWideNarrow, Loader2, RefreshCw, ScanSearch, Search } from "lucide-react";
import { getNextLots, type NextLotGroup, type NextLotItem, type NextLotsResult } from "../api/client";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";
import { localeFor } from "../i18n/translations";
import Pagination from "../components/Pagination";
import TraceModal from "../components/TraceModal";

const AUTO_REFRESH_MS = 60_000;
const GROUPS_PAGE_SIZE = 5;
const LOTS_PAGE_SIZE = 10;

export default function NextLotPage() {
  const notify = useNotify();
  const { t } = useLanguage();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<NextLotsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [traceQuery, setTraceQuery] = useState<string | null>(null);

  const load = useCallback(
    (silent: boolean) => {
      if (!silent) setLoading(true);
      return getNextLots(search || undefined)
        .then(setData)
        .catch((err) => {
          if (!silent) {
            notify("error", t("common.loadError.title"), err instanceof Error ? err.message : t("common.loadError.body"));
          }
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search],
  );

  useEffect(() => {
    load(false);
    // Hang doi thay doi khi co tem moi phat hanh/xuat - tu cap nhat ngam, khong chop loading.
    const timer = window.setInterval(() => load(true), AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  const groups = data?.groups ?? [];
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedGroups = groups.slice((currentPage - 1) * GROUPS_PAGE_SIZE, currentPage * GROUPS_PAGE_SIZE);

  return (
    <div className="page page-wide">
      <div className="filter-bar">
        <form className="filter-search-group" onSubmit={handleSearch}>
          <span className="filter-search">
            <Search size={15} />
            <input
              placeholder={t("nextLot.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </span>
          <button type="submit" className="ghost-btn" disabled={loading}>
            <Search size={15} /> {t("common.search")}
          </button>
        </form>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setSearchInput("");
            setSearch("");
            setPage(1);
          }}
        >
          {t("common.clearFilters")}
        </button>
        <button type="button" className="ghost-btn" style={{ marginLeft: "auto" }} onClick={() => load(false)} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin-icon" : ""} /> {t("common.refresh")}
        </button>
      </div>

      <div className="info-card" style={{ marginBottom: "1.25rem" }}>
        <h3>
          <ArrowDownWideNarrow size={16} /> FIFO
        </h3>
        <p className="fifo-note">{t("nextLot.hint")}</p>
        {data && (
          <p className="field-hint">
            {t("nextLot.tolerance")}: <strong>{data.toleranceDays}</strong> {t("nextLot.days")}
          </p>
        )}
      </div>

      {loading && !data && (
        <p className="table-empty">
          <Loader2 size={16} className="spin-icon" />
        </p>
      )}

      {data && data.groups.length === 0 && (
        <div className="table-card">
          <p className="table-empty" style={{ padding: "2rem" }}>
            {t("nextLot.empty")}
          </p>
        </div>
      )}

      {pagedGroups.map((group) => (
        <LotGroupTable
          key={`${group.materialCode}|${group.warehouseCode}`}
          group={group}
          onTrace={setTraceQuery}
        />
      ))}

      {groups.length > 0 && (
        <div className="pagination-bar">
          <span className="pagination-info">
            {groups.length} {t("nextLot.groups")}
          </span>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <TraceModal query={traceQuery} onClose={() => setTraceQuery(null)} />
    </div>
  );
}

function StatusBadge({ lot }: { lot: NextLotItem }) {
  const { t } = useLanguage();
  if (lot.isOldest) {
    return <span className="gate-log-badge gate-log-success">{t("nextLot.status.oldest")}</span>;
  }
  if (lot.withinTolerance) {
    return <span className="gate-log-badge gate-log-success">{t("nextLot.status.tolerance")}</span>;
  }
  return <span className="gate-log-badge gate-log-warning">{t("nextLot.status.wait")}</span>;
}

// 1 nhom (ma NVL + kho) voi danh sach Lot tu cu -> moi, phan trang rieng cho cac Lot trong nhom.
function LotGroupTable({ group, onTrace }: { group: NextLotGroup; onTrace: (lotId: string) => void }) {
  const { t, language } = useLanguage();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(group.lots.length / LOTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * LOTS_PAGE_SIZE;
  const pagedLots = group.lots.slice(offset, offset + LOTS_PAGE_SIZE);

  return (
    <div className="table-card" style={{ marginBottom: "1.5rem" }}>
      <div className="table-toolbar">
        <div>
          <strong>{group.materialName ?? group.materialCode}</strong>
          <div className="field-hint" style={{ margin: 0 }}>
            {group.materialCode} · {t("nextLot.group.warehouse")}: {group.warehouseCode || "—"}
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t("nextLot.col.order")}</th>
            <th>{t("nextLot.col.lot")}</th>
            <th>{t("nextLot.col.grDate")}</th>
            <th>{t("nextLot.col.tags")}</th>
            <th>{t("nextLot.col.qty")}</th>
            <th>{t("nextLot.col.location")}</th>
            <th>{t("nextLot.col.status")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pagedLots.map((lot, i) => (
            <tr key={lot.lotID}>
              <td>{offset + i + 1}</td>
              <td>
                <code>{lot.lotID}</code>
              </td>
              <td>{lot.grDate ?? "—"}</td>
              <td>{lot.labelCount}</td>
              <td>{lot.currentQty != null ? Number(lot.currentQty).toLocaleString(localeFor(language)) : "—"}</td>
              <td>{lot.locationCode ?? "—"}</td>
              <td>
                <StatusBadge lot={lot} />
              </td>
              <td>
                <button type="button" className="ghost-btn" onClick={() => onTrace(lot.lotID)}>
                  <ScanSearch size={14} /> {t("nextLot.viewTrace")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination-bar">
        <span className="pagination-info">
          {group.lots.length} {t("nextLot.group.lots")}
        </span>
        <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
