import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Download, Search, ShieldAlert } from "lucide-react";
import { getShipmentChecks, type ShipmentCheckItem } from "../api/client";
import Pagination from "../components/Pagination";
import { useLanguage } from "../context/LanguageContext";
import { useNotify } from "../context/NotificationContext";
import { localeFor } from "../i18n/translations";
import { exportToExcel } from "../utils/exportExcel";

const PAGE_SIZE = 15;

type SortColumn = "time";
type SortDirection = "asc" | "desc";

export default function OverrideLogPage() {
  const { t, language } = useLanguage();
  const notify = useNotify();
  const [logs, setLogs] = useState<ShipmentCheckItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function formatDateTime(iso?: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(localeFor(language));
  }

  async function load() {
    setLoading(true);
    try {
      const result = await getShipmentChecks({
        page,
        pageSize: PAGE_SIZE,
        search,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        overrideOnly: true,
      });
      setLogs(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      notify("error", t("common.loadError.title"), err instanceof Error ? err.message : t("common.loadError.body"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, from, to, searchNonce]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setSearchNonce((n) => n + 1);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, direction: "desc" };
      if (prev.direction === "desc") return { column, direction: "asc" };
      return null;
    });
  }

  const sortedLogs = useMemo(() => {
    if (!sort) return logs;
    const copy = [...logs];
    copy.sort((a, b) => {
      const cmp = new Date(a.overrideDateTime ?? a.checkDateTime).getTime()
        - new Date(b.overrideDateTime ?? b.checkDateTime).getTime();
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [logs, sort]);

  function sortIcon(column: SortColumn) {
    if (!sort || sort.column !== column) return <ChevronsUpDown size={13} />;
    return sort.direction === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await getShipmentChecks({
        page: 1,
        pageSize: 5000,
        search,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        overrideOnly: true,
      });
      const header = [
        t("overrideLog.col.overrideTime"),
        t("overrideLog.col.overrideBy"),
        t("overrideLog.col.gate"),
        t("printLog.col.tag"),
        t("overrideLog.col.shippedLot"),
        t("overrideLog.col.material"),
        t("overrideLog.col.expectedLot"),
        t("overrideLog.col.reason"),
      ];
      const rows = result.items.map((ev) => [
        formatDateTime(ev.overrideDateTime ?? ev.checkDateTime),
        ev.overrideUserID ?? "",
        ev.gateCode,
        ev.rfidSerialNo ?? "",
        ev.lotID ?? "",
        ev.materialName ?? ev.materialCode ?? "",
        ev.expectedLotID ?? "",
        ev.overrideReason ?? "",
      ]);
      await exportToExcel(`${t("overrideLog.exportFileName")}-${new Date().toISOString().slice(0, 10)}`, header, rows);

      if (result.totalCount > result.items.length) {
        notify("warning", t("common.exportTruncated.title"), t("common.exportTruncated.body"));
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page page-wide">
      <div className="filter-bar">
        <form className="filter-search-group" onSubmit={handleSearchSubmit}>
          <span className="filter-search">
            <Search size={15} />
            <input
              placeholder={t("overrideLog.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </span>
          <button type="submit" className="ghost-btn" disabled={loading}>
            <Search size={15} className={loading ? "spin-icon" : ""} /> {t("common.search")}
          </button>
        </form>

        <input
          type="date"
          className="filter-select"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <span className="filter-sep">—</span>
        <input
          type="date"
          className="filter-select"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />

        <button type="button" className="ghost-btn" onClick={resetFilters}>
          {t("common.clearFilters")}
        </button>

        <button type="button" className="ghost-btn" onClick={handleExport} disabled={exporting} style={{ marginLeft: "auto" }}>
          <Download size={15} className={exporting ? "spin-icon" : ""} /> {exporting ? t("common.exporting") : t("common.exportExcel")}
        </button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("time")}>
                <span className="sort-th">{t("overrideLog.col.overrideTime")} {sortIcon("time")}</span>
              </th>
              <th>{t("overrideLog.col.overrideBy")}</th>
              <th>{t("overrideLog.col.gate")}</th>
              <th>{t("printLog.col.tag")}</th>
              <th>{t("overrideLog.col.shippedLot")}</th>
              <th>{t("overrideLog.col.material")}</th>
              <th>{t("overrideLog.col.expectedLot")}</th>
              <th>{t("overrideLog.col.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              logs.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr className="skeleton-row" key={`override-skeleton-${i}`}>
                  <td><span className="skeleton-block" style={{ width: "9rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "5rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "4rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "7rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "6rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "8rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "6rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "10rem" }} /></td>
                </tr>
              ))}
            {sortedLogs.map((ev) => (
              <tr key={ev.shipmentCheckSequence}>
                <td>{formatDateTime(ev.overrideDateTime ?? ev.checkDateTime)}</td>
                <td>{ev.overrideUserID ?? "—"}</td>
                <td>{ev.gateCode}</td>
                <td>
                  <code>{ev.rfidSerialNo ?? "—"}</code>
                </td>
                <td>{ev.lotID ?? "—"}</td>
                <td>{ev.materialName ?? ev.materialCode ?? "—"}</td>
                <td>{ev.expectedLotID ?? "—"}</td>
                <td className="gate-log-msg">{ev.overrideReason ?? "—"}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={8} className="table-empty">
                  {search || from || to ? (
                    t("overrideLog.empty.filtered")
                  ) : (
                    <>
                      <ShieldAlert size={14} style={{ verticalAlign: "-2px", marginRight: "0.35rem" }} />
                      {t("overrideLog.empty.none")}
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination-bar">
          <span className="pagination-info">
            {totalCount === 0 ? `0 ${t("common.results")}` : `${totalCount} ${t("common.records")}`}
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
        </div>
      </div>
    </div>
  );
}
