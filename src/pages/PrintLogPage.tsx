import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Download,
  RotateCw,
  Search,
  XCircle,
} from "lucide-react";
import {
  enqueuePrintRetry,
  getPrintLogs,
  verifyLabels,
  type PrintLogItem,
} from "../api/client";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";
import { localeFor } from "../i18n/translations";
import { exportToExcel } from "../utils/exportExcel";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 15;

type SortColumn = "time" | "status";
type SortDirection = "asc" | "desc";

export default function PrintLogPage() {
  const { userID } = useCurrentUser();
  const notify = useNotify();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<PrintLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [retryTargets, setRetryTargets] = useState<PrintLogItem[]>([]);
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  // Map thay vi Set de giu lai ca doi tuong log da chon - cho phep chon xuyen trang
  // (chon o trang 1, sang trang 2 chon tiep) ma van du du lieu de goi API hang loat sau nay,
  // vi trang khac se khong con nam trong `logs` hien tai nua.
  const [selected, setSelected] = useState<Map<number, PrintLogItem>>(new Map());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [exporting, setExporting] = useState(false);

  const initialSerial = searchParams.get("serial") ?? "";
  const [searchInput, setSearchInput] = useState(initialSerial);
  const [search, setSearch] = useState(initialSerial);
  const [status, setStatus] = useState<"" | "success" | "error">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Cho phep dieu huong tu Dashboard ("Hoat dong in gan day") sang trang nay voi bo loc serial san,
  // qua query string ?serial=... - xoa param khoi URL sau khi da doc de tranh giu lai khi F5.
  useEffect(() => {
    if (initialSerial) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      let cmp = 0;
      if (sort.column === "time") {
        cmp = new Date(a.createDateTime).getTime() - new Date(b.createDateTime).getTime();
      } else {
        const aOk = a.httpStatus !== undefined && a.httpStatus >= 200 && a.httpStatus < 300;
        const bOk = b.httpStatus !== undefined && b.httpStatus >= 200 && b.httpStatus < 300;
        cmp = Number(aOk) - Number(bOk);
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [logs, sort]);

  function sortIcon(column: SortColumn) {
    if (!sort || sort.column !== column) return <ChevronsUpDown size={13} />;
    return sort.direction === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  }

  async function load() {
    setLoading(true);
    try {
      const result = await getPrintLogs({
        page,
        pageSize: PAGE_SIZE,
        search,
        status,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
      });
      setLogs(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      notify("error", t("common.loadError.title"), err instanceof Error ? err.message : t("common.loadError.body"));
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(log: PrintLogItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(log.printLogSequence)) next.delete(log.printLogSequence);
      else next.set(log.printLogSequence, log);
      return next;
    });
  }

  const selectableIds = sortedLogs.map((l) => l.printLogSequence);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));

  // Chon tat ca chi tac dong len trang dang xem, nhung khong xoa mat lua chon o cac trang khac.
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        sortedLogs.forEach((log) => next.set(log.printLogSequence, log));
      }
      return next;
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, from, to, searchNonce]);

  // Doi bo loc (khong phai doi trang) nghia la tap ket qua da thay doi ban chat -> xoa lua chon cu.
  useEffect(() => {
    setSelected(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, from, to]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    // Bam "Tim kiem" (hoac Enter) luon lam moi du liệu, ke ca khi bo loc khong doi -
    // vi setSearch() voi cung gia tri se khong lam useEffect [search,...] chay lai.
    setSearchNonce((n) => n + 1);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  async function handleVerify(log: PrintLogItem) {
    if (!log.rfidSerialNo) return;
    setBusyId(log.printLogSequence);
    try {
      await verifyLabels({
        requestID: log.requestID,
        processUserID: userID || "system",
        verifiedSerials: [log.rfidSerialNo],
      });
      notify("success", t("printLog.verify.success.title"), `${t("printLog.verify.success.body")} ${log.rfidSerialNo} ${t("printLog.verify.correct")}`);
    } catch (err) {
      notify("error", t("printLog.verify.fail.title"), err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  // Xac minh hang loat: usp_DoApplyRFIDLabelVerify xu ly theo tung RequestID rieng (tem nao thuoc
  // cung RequestID nhung khong nam trong danh sach xac nhan se bi tu dong Void) - nen phai gom cac
  // tem da chon theo RequestID va goi 1 lan/nhom, khong duoc gop chung tat ca vao 1 lenh goi.
  async function handleBulkVerify() {
    const items = Array.from(selected.values()).filter((l) => l.rfidSerialNo);
    if (items.length === 0) {
      notify("error", t("printLog.bulk.noValid.title"), t("printLog.bulk.noValid.body"));
      return;
    }
    const groups = new Map<string, PrintLogItem[]>();
    for (const item of items) {
      const arr = groups.get(item.requestID) ?? [];
      arr.push(item);
      groups.set(item.requestID, arr);
    }
    setBulkBusy(true);
    const results = await Promise.allSettled(
      Array.from(groups.entries()).map(([requestID, groupItems]) =>
        verifyLabels({
          requestID,
          processUserID: userID || "system",
          verifiedSerials: groupItems.map((g) => g.rfidSerialNo as string),
        }),
      ),
    );
    const failCount = results.filter((r) => r.status === "rejected").length;
    const okCount = results.length - failCount;
    if (okCount > 0) {
      notify(
        "success",
        t("printLog.bulk.verify.title"),
        `${items.length} ${t("printLog.bulkVerify.success.body")} (${okCount}/${results.length}) ${t("printLog.bulkVerify.successSuffix")}`,
      );
    }
    if (failCount > 0) {
      notify("error", t("printLog.bulk.verify.fail.title"), `${failCount}/${results.length} ${t("printLog.bulk.someFailed.body")}`);
    }
    setSelected(new Map());
    setBulkBusy(false);
  }

  async function confirmRetry() {
    const targets = retryTargets;
    const eligible = targets.filter((l) => l.rfidSerialNo && l.printerIP && l.zplText);
    setRetryTargets([]);
    if (eligible.length === 0) return;

    if (eligible.length === 1) {
      setBusyId(eligible[0].printLogSequence);
    } else {
      setBulkBusy(true);
    }
    const results = await Promise.allSettled(
      eligible.map((log) =>
        enqueuePrintRetry({
          rfidSerialNo: log.rfidSerialNo as string,
          printerIP: log.printerIP as string,
          zplText: log.zplText as string,
        }),
      ),
    );
    const failCount = results.filter((r) => r.status === "rejected").length;
    const okCount = results.length - failCount;
    if (eligible.length === 1) {
      if (okCount === 1) {
        notify("success", t("printLog.retry.queued.title"), `${eligible[0].rfidSerialNo} ${t("printLog.retry.queued.single")}`);
      } else {
        notify("error", t("printLog.retry.fail.title"), undefined);
      }
      setBusyId(null);
    } else {
      if (okCount > 0) {
        notify("success", t("printLog.retry.queued.title"), `${okCount}/${results.length} ${t("printLog.retry.queued.multi")}`);
      }
      if (failCount > 0) {
        notify("error", t("printLog.bulk.retry.fail.title"), `${failCount}/${results.length} ${t("printLog.retry.fail.body")}`);
      }
      setSelected(new Map());
      setBulkBusy(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      // Xuat tat ca ban ghi khop bo loc hien tai (khong chi trang dang xem) - toi da 5000 dong / lan.
      const result = await getPrintLogs({
        page: 1,
        pageSize: 5000,
        search,
        status,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
      });
      const header = [
        t("printLog.col.time"),
        t("inbound.rfidLabel"),
        t("printLog.col.lot"),
        t("printLog.col.material"),
        t("printLog.col.printer"),
        "HTTP Status",
        t("common.error"),
      ];
      const rows = result.items.map((log) => [
        new Date(log.createDateTime).toLocaleString(localeFor(language)),
        log.rfidSerialNo ?? "",
        log.lotID ?? "",
        log.materialName ?? "",
        log.printerIP ?? "",
        log.httpStatus?.toString() ?? "",
        log.errorMessage ?? "",
      ]);
      await exportToExcel(`${t("printLog.exportFileName")}-${new Date().toISOString().slice(0, 10)}`, header, rows);

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
              placeholder={t("common.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </span>
          <button type="submit" className="ghost-btn" disabled={loading}>
            <Search size={15} className={loading ? "spin-icon" : ""} /> {t("common.search")}
          </button>
        </form>

        <select
          className="filter-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
        >
          <option value="">{t("common.allStatus")}</option>
          <option value="success">{t("printLog.filter.success")}</option>
          <option value="error">{t("printLog.filter.error")}</option>
        </select>

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

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">{selected.size} {t("printLog.selectedCount")}</span>
          <button type="button" className="ghost-btn" onClick={handleBulkVerify} disabled={bulkBusy}>
            <CheckCircle2 size={15} /> {t("printLog.action.verifySelected")}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setRetryTargets(Array.from(selected.values()))}
            disabled={bulkBusy}
          >
            <RotateCw size={15} className={bulkBusy ? "spin-icon" : ""} /> {t("printLog.action.reprintSelected")}
          </button>
          <button type="button" className="ghost-btn" onClick={() => setSelected(new Map())} disabled={bulkBusy}>
            {t("printLog.bulk.deselect")}
          </button>
        </div>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="select-cell">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleSelectAll}
                  disabled={bulkBusy || sortedLogs.length === 0}
                  aria-label={t("printLog.selectAll")}
                />
              </th>
              <th className="sortable" onClick={() => toggleSort("time")}>
                <span className="sort-th">{t("printLog.col.time")} {sortIcon("time")}</span>
              </th>
              <th>{t("printLog.col.tag")}</th>
              <th>{t("printLog.col.lot")}</th>
              <th>{t("printLog.col.material")}</th>
              <th>{t("printLog.col.printer")}</th>
              <th className="sortable" onClick={() => toggleSort("status")}>
                <span className="sort-th">{t("printLog.col.status")} {sortIcon("status")}</span>
              </th>
              <th className="actions-col">{t("printLog.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              logs.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr className="skeleton-row" key={`skeleton-${i}`}>
                  <td><span className="skeleton-block" style={{ width: "1rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "9rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "7rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "6rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "8rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "6rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "5rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "4rem" }} /></td>
                </tr>
              ))}
            {sortedLogs.map((log) => {
              const isSuccess = log.httpStatus !== undefined && log.httpStatus >= 200 && log.httpStatus < 300;
              const rowBusy = busyId === log.printLogSequence || bulkBusy;
              return (
                <tr key={log.printLogSequence} className={selected.has(log.printLogSequence) ? "row-selected" : ""}>
                  <td className="select-cell">
                    <input
                      type="checkbox"
                      checked={selected.has(log.printLogSequence)}
                      onChange={() => toggleRow(log)}
                      disabled={bulkBusy}
                      aria-label={`${t("printLog.selectRow")} ${log.rfidSerialNo ?? log.printLogSequence}`}
                    />
                  </td>
                  <td>{new Date(log.createDateTime).toLocaleString(localeFor(language))}</td>
                  <td>
                    <code>{log.rfidSerialNo ?? "—"}</code>
                  </td>
                  <td>{log.lotID ?? "—"}</td>
                  <td>{log.materialName ?? "—"}</td>
                  <td>{log.printerIP ?? "—"}</td>
                  <td>
                    <span
                      className={`status-pill ${isSuccess ? "ok" : "fail"}`}
                      title={isSuccess ? undefined : log.errorMessage ?? t("common.error")}
                    >
                      {isSuccess ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      <span>{isSuccess ? `HTTP ${log.httpStatus}` : log.errorMessage ?? t("common.error")}</span>
                    </span>
                  </td>
                  <td className="row-actions">
                    <div className="row-actions-inner">
                      <button
                        type="button"
                        onClick={() => handleVerify(log)}
                        disabled={rowBusy || !log.rfidSerialNo}
                      >
                        {t("printLog.action.verify")}
                      </button>
                      {!isSuccess && (
                        <button
                          type="button"
                          onClick={() => setRetryTargets([log])}
                          disabled={rowBusy || !log.zplText}
                        >
                          <RotateCw size={13} /> {t("printLog.action.reprint")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={8} className="table-empty">
                  {t("printLog.empty.filtered")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination-bar">
          <span className="pagination-info">
            {totalCount === 0 ? `0 ${t("common.results")}` : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} / ${totalCount}`}
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
        </div>
      </div>

      <Modal
        open={retryTargets.length > 0}
        onClose={() => setRetryTargets([])}
        title={t("printLog.confirmRetry.title")}
        footer={
          <>
            <button type="button" className="modal-btn" onClick={() => setRetryTargets([])}>
              {t("common.cancel")}
            </button>
            <button type="button" className="modal-btn modal-btn-danger" onClick={confirmRetry}>
              <RotateCw size={14} /> {t("printLog.action.reprint")}
            </button>
          </>
        }
      >
        {retryTargets.length === 1 ? (
          <>
            {t("printLog.confirmRetry.singlePrefix")} <strong>{retryTargets[0].rfidSerialNo}</strong> {t("printLog.confirmRetry.single")}
          </>
        ) : (
          <>
            {t("printLog.confirmRetry.multiPrefix")} <strong>{retryTargets.length} {t("printLog.confirmRetry.multiSuffix")}</strong> {t("printLog.confirmRetry.single")}
            {retryTargets.some((l) => !l.rfidSerialNo || !l.printerIP || !l.zplText) && (
              <div className="modal-note">
                {t("printLog.confirmRetry.note")}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
