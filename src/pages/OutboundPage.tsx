import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  DoorOpen,
  Download,
  History,
  Layers,
  Loader2,
  ScanLine,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  checkOutboundShipment,
  getActiveGates,
  getShipmentChecks,
  getStaleGateDetections,
  labelExists,
  overrideShipment,
  type OutboundResult,
  type ReaderGate,
  type ShipmentCheckItem,
  type StaleGateDetectionItem,
} from "../api/client";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useNotify } from "../context/NotificationContext";
import { useGateEventsLog } from "../context/GateEventsContext";
import { useLanguage } from "../context/LanguageContext";
import { localeFor, type TranslationKey } from "../i18n/translations";
import { playFifoAlarmSound } from "../utils/alarmSound";
import { exportToExcel } from "../utils/exportExcel";
import Pagination from "../components/Pagination";
import LoadingOverlay from "../components/LoadingOverlay";

const RESULT_LABEL_KEYS: Record<string, TranslationKey> = {
  Pass: "outbound.result.pass",
  FIFOViolation: "outbound.result.fifoViolation",
  NotRegistered: "outbound.result.notRegistered",
  AlreadyShipped: "outbound.result.alreadyShipped",
  VoidLabel: "outbound.result.voidLabel",
  NotMapped: "outbound.result.notMapped",
};

function resultTone(code?: string, success?: boolean): "success" | "warning" | "error" {
  if (!success) return "error";
  return code === "Pass" ? "success" : "warning";
}

const GATE_LOG_PAGE_SIZE = 15;

type GateSortColumn = "time" | "result";
type GateSortDirection = "asc" | "desc";

interface BatchResultItem {
  serial: string;
  result: OutboundResult;
  overrideMessage?: string;
}

export default function OutboundPage() {
  const { userID } = useCurrentUser();
  const notify = useNotify();
  const { t, language } = useLanguage();
  const { events: gateEvents, resultLabel: gateResultLabel } = useGateEventsLog();
  const location = useLocation();
  const navigate = useNavigate();

  // Khi bi dieu huong toi day do vi pham FIFO (xem GateEventsContext), ma tem vi pham duoc gui kem
  // qua router state - dung de tu cuon xuong + lam noi bat dung dong trong bang nhat ky ben duoi,
  // giup nguoi dung thay ngay tem nao vua bi vi pham ma khong phai tu tim trong bang.
  const [highlightSerial, setHighlightSerial] = useState<string | null>(null);
  const autoBatchRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(localeFor(language));
  }

  function resultLabelFor(code?: string): string {
    if (!code) return "";
    const key = RESULT_LABEL_KEYS[code];
    return key ? t(key) : code;
  }

  const [gates, setGates] = useState<ReaderGate[]>([]);
  const [gatesLoaded, setGatesLoaded] = useState(false);
  const [gateCode, setGateCode] = useState("");
  const [gateLog, setGateLog] = useState<ShipmentCheckItem[]>([]);
  const [gateLogTotal, setGateLogTotal] = useState(0);
  const [gateLogPage, setGateLogPage] = useState(1);
  const [gateLogLoading, setGateLogLoading] = useState(true);
  const [gateSearchInput, setGateSearchInput] = useState("");
  const [gateSearch, setGateSearch] = useState("");
  const [gateResultCode, setGateResultCode] = useState("");
  const [gateFrom, setGateFrom] = useState("");
  const [gateTo, setGateTo] = useState("");
  const [gateSearchNonce, setGateSearchNonce] = useState(0);
  const [gateExporting, setGateExporting] = useState(false);
  const [gateSort, setGateSort] = useState<{ column: GateSortColumn; direction: GateSortDirection } | null>(null);

  const [batchInput, setBatchInput] = useState("");
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [batchSerials, setBatchSerials] = useState<string[]>([]);
  const [batchAdding, setBatchAdding] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResultItem[] | null>(null);
  const [batchChecking, setBatchChecking] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchOverrideReason, setBatchOverrideReason] = useState("");
  const [batchOverriding, setBatchOverriding] = useState(false);

  // Lo tu dong qua cong: gom cac lan quet lien tiep (khoang cach < 15s) tu su kien real-time
  // thanh 1 nhom, de ho tro ghi de hang loat cho ca loat hop di qua cong cung luc.
  const AUTO_BATCH_WINDOW_MS = 15000;
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  const [autoOverrideMessages, setAutoOverrideMessages] = useState<Record<string, string>>({});
  const [autoOverrideReason, setAutoOverrideReason] = useState("");
  const [autoOverriding, setAutoOverriding] = useState(false);

  // Tem da doc duoc tai cong nhung qua STALE_MINUTES van chua duoc xuat kho - canh bao truong hop
  // hang co the da bi mang di ma chua ai bam "Xuat" de kiem tra FIFO/xuat kho that su.
  const STALE_MINUTES = 30;
  const [staleDetections, setStaleDetections] = useState<StaleGateDetectionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    function loadStale() {
      getStaleGateDetections(STALE_MINUTES)
        .then((items) => {
          if (!cancelled) setStaleDetections(items);
        })
        .catch(() => {
          // Im lang bo qua loi tai canh bao phu - khong lam gian doan luong lam viec chinh.
        });
    }
    loadStale();
    const timer = window.setInterval(loadStale, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const state = location.state as { fifoSerial?: string } | null;
    if (state?.fifoSerial) {
      setHighlightSerial(state.fifoSerial);
      // Xoa state khoi lich su ngay - tranh lap lai cuon/noi bat khi nguoi dung bam Back hoac tai lai trang.
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    getActiveGates()
      .then((data) => {
        const outGates = data.filter((g) => g.gateType === "Out");
        setGates(outGates);
        // Hien tai cong ty chi co 1 cong xuat duy nhat - tu dong chon luon, khong bat nguoi dung phai chon.
        if (outGates.length > 0) {
          setGateCode(outGates[0].gateCode);
        }
      })
      .catch(() => setGates([]))
      .finally(() => setGatesLoaded(true));
  }, []);

  // Sau khi kiem tra ca lo xong, focus lai o quet de bat dau lo tiep theo ma khong can bam chuot.
  useEffect(() => {
    if (!batchChecking) {
      batchInputRef.current?.focus();
    }
  }, [batchChecking]);

  // Nhat ky xuat qua cong lay tu DB (STB_RFIDShipmentCheck) thay vi chi giu 50 su kien live trong bo nho -
  // phan trang that, khong gioi han so ban ghi. Refetch khi doi trang hoac khi co su kien live moi
  // (gateEvents.length tang) de bang luon cap nhat gan nhu tuc thi khi co tem quet qua cong.
  useEffect(() => {
    let cancelled = false;
    setGateLogLoading(true);
    getShipmentChecks({
      page: gateLogPage,
      pageSize: GATE_LOG_PAGE_SIZE,
      search: gateSearch,
      resultCode: gateResultCode,
      from: gateFrom ? new Date(gateFrom).toISOString() : undefined,
      to: gateTo ? new Date(gateTo + "T23:59:59").toISOString() : undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setGateLog(result.items);
        setGateLogTotal(result.totalCount);
      })
      .catch((err) => {
        if (cancelled) return;
        notify("error", t("common.loadError.title"), err instanceof Error ? err.message : t("common.loadError.body"));
      })
      .finally(() => {
        if (!cancelled) setGateLogLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateLogPage, gateEvents.length, gateSearch, gateResultCode, gateFrom, gateTo, gateSearchNonce]);

  function handleGateLogSearch(e: FormEvent) {
    e.preventDefault();
    setGateLogPage(1);
    setGateSearch(gateSearchInput.trim());
    setGateSearchNonce((n) => n + 1);
  }

  function resetGateLogFilters() {
    setGateSearchInput("");
    setGateSearch("");
    setGateResultCode("");
    setGateFrom("");
    setGateTo("");
    setGateLogPage(1);
  }

  function toggleGateSort(column: GateSortColumn) {
    setGateSort((prev) => {
      if (!prev || prev.column !== column) return { column, direction: "desc" };
      if (prev.direction === "desc") return { column, direction: "asc" };
      return null;
    });
  }

  const sortedGateLog = useMemo(() => {
    if (!gateSort) return gateLog;
    const copy = [...gateLog];
    copy.sort((a, b) => {
      let cmp = 0;
      if (gateSort.column === "time") {
        cmp = new Date(a.checkDateTime).getTime() - new Date(b.checkDateTime).getTime();
      } else {
        cmp = a.resultCode.localeCompare(b.resultCode);
      }
      return gateSort.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [gateLog, gateSort]);

  function gateSortIcon(column: GateSortColumn) {
    if (!gateSort || gateSort.column !== column) return <ChevronsUpDown size={13} />;
    return gateSort.direction === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  }

  async function handleGateLogExport() {
    if (gateExporting) return;
    setGateExporting(true);
    try {
      const result = await getShipmentChecks({
        page: 1,
        pageSize: 5000,
        search: gateSearch,
        resultCode: gateResultCode,
        from: gateFrom ? new Date(gateFrom).toISOString() : undefined,
        to: gateTo ? new Date(gateTo + "T23:59:59").toISOString() : undefined,
      });
      const header = [
        t("outbound.col.time"),
        t("outbound.col.gate"),
        t("inbound.rfidLabel"),
        t("outbound.col.lot"),
        t("outbound.col.material"),
        t("outbound.col.result"),
        t("outbound.col.note"),
      ];
      const rows = result.items.map((ev) => [
        formatDateTime(ev.checkDateTime),
        ev.gateCode,
        ev.rfidSerialNo ?? "",
        ev.lotID ?? "",
        ev.materialName ?? ev.materialCode ?? "",
        gateResultLabel(ev.resultCode),
        ev.resultMessage ?? "",
      ]);
      await exportToExcel(`${t("outbound.exportFileName")}-${new Date().toISOString().slice(0, 10)}`, header, rows);

      if (result.totalCount > result.items.length) {
        notify("warning", t("common.exportTruncated.title"), t("common.exportTruncated.body"));
      }
    } finally {
      setGateExporting(false);
    }
  }

  // Quet theo lo: quet nhieu tem vao 1 danh sach cho truoc, roi kiem tra FIFO + xuat 1 lan
  // cho ca lo - phu hop voi thuc te xuat ca pallet nhieu thung cung luc thay vi tung tem rieng le.
  // Quet 1 tem duy nhat van dung chinh luong nay (danh sach chi co 1 phan tu).
  // Them/bot tem khoi danh sach cho lam thay doi thanh phan lo hang, nen bat ky lua chon ghi
  // de + o nhap ly do dang mo (dua tren ket qua kiem tra cu) deu khong con hop le nua - an ngay
  // de tranh ghi de nham voi ly do/tap tem khong con khop voi danh sach hien tai.
  function hideOverridePrompt() {
    setBatchSelected(new Set());
    setBatchOverrideReason("");
  }

  async function addToBatch(e?: FormEvent) {
    e?.preventDefault();
    const serial = batchInput.trim();
    if (!serial || batchAdding) return;
    if (batchSerials.includes(serial)) {
      notify("error", t("outbound.batch.duplicate"), serial);
      setBatchInput("");
      return;
    }
    setBatchAdding(true);
    try {
      const exists = await labelExists(serial);
      if (!exists) {
        notify("error", t("outbound.batch.notFound.title"), serial);
        return;
      }
      setBatchSerials((prev) => [...prev, serial]);
      hideOverridePrompt();
    } catch {
      notify("error", t("common.loadError.title"), t("common.loadError.body"));
    } finally {
      setBatchInput("");
      setBatchAdding(false);
      batchInputRef.current?.focus();
    }
  }

  function removeFromBatch(serial: string) {
    setBatchSerials((prev) => prev.filter((s) => s !== serial));
    hideOverridePrompt();
  }

  // Nhom cac su kien real-time gan nhat (tinh tu su kien moi nhat lui ve truoc) thanh 1 "lo" -
  // dung khi thu kho be nguyen 1 loat hop co tem khac nhau di qua cong cung mot luc.
  const recentAutoBatch = useMemo(() => {
    if (gateEvents.length === 0) return [];
    const windowEvents = [gateEvents[0]];
    for (let i = 1; i < gateEvents.length; i++) {
      const prevTime = new Date(windowEvents[windowEvents.length - 1].receivedAt).getTime();
      const curTime = new Date(gateEvents[i].receivedAt).getTime();
      if (prevTime - curTime > AUTO_BATCH_WINDOW_MS) break;
      windowEvents.push(gateEvents[i]);
    }
    // Cung 1 tem co the duoc bao ve nhieu lan (vd dang dung yen truoc anten) - chi giu lai su
    // kien GAN NHAT cho moi tem, tranh hien lai cac dong "Vi pham FIFO" da cu trong khi tem do
    // thuc ra da Pass/duoc xu ly xong o lan quet sau.
    const seen = new Set<string>();
    const deduped: typeof windowEvents = [];
    for (const ev of windowEvents) {
      const key = ev.rfidSerialNo ?? ev.epc ?? "";
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push(ev);
    }
    return deduped;
  }, [gateEvents]);

  useEffect(() => {
    if (!highlightSerial) return;
    const row = autoBatchRowRefs.current[highlightSerial];
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setHighlightSerial(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightSerial, recentAutoBatch]);

  // Khi trang thai moi nhat cua 1 tem khong con la FIFOViolation nua (da Pass/AlreadyShipped o
  // lan quet sau), bo no khoi danh sach da chon ghi de - tranh giu ghi de "treo" cho tem da xong.
  useEffect(() => {
    const eligible = new Set(
      recentAutoBatch
        .filter((ev) => ev.resultCode === "FIFOViolation")
        .map((ev) => ev.rfidSerialNo ?? ev.epc ?? "")
        .filter((s) => s !== ""),
    );
    setAutoSelected((prev) => {
      if (Array.from(prev).every((s) => eligible.has(s))) return prev;
      return new Set(Array.from(prev).filter((s) => eligible.has(s)));
    });
  }, [recentAutoBatch]);

  function toggleAutoSelect(serial: string) {
    setAutoSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serial)) next.delete(serial);
      else next.add(serial);
      return next;
    });
  }

  async function handleAutoOverride() {
    if (!autoOverrideReason.trim() || autoSelected.size === 0 || autoOverriding) return;
    setAutoOverriding(true);
    const targets = Array.from(autoSelected);
    const results = await Promise.allSettled(
      targets.map((serial) =>
        overrideShipment({ rfidSerialNo: serial, overrideUserID: userID, overrideReason: autoOverrideReason }),
      ),
    );
    setAutoOverrideMessages((prev) => {
      const next = { ...prev };
      targets.forEach((serial, i) => {
        const r = results[i];
        if (r.status === "fulfilled") next[serial] = r.value.message;
      });
      return next;
    });
    setAutoSelected(new Set());
    setAutoOverriding(false);
    notify("success", t("outbound.override.success.body"), `${targets.length}/${targets.length}`);
    setGateSearchNonce((n) => n + 1);
  }

  async function handleBatchCheck() {
    if (batchSerials.length === 0 || batchChecking || !userID.trim() || !gateCode) return;
    setBatchChecking(true);

    // usp_DoCheckRFIDShipment danh gia "Lot cu nhat con ton kho" tai thoi diem goi va danh dau
    // Shipped ngay khi Pass - nen neu Lot cu hon trong cung lo chua duoc kiem tra truoc, tem moi
    // hon se bi bao vi pham oan. De khong bat nguoi dung phai tu quet dung thu tu Lot cu->moi,
    // thu lai nhieu vong cho cac tem bi vi pham: sau moi vong, cac Lot da Pass se tu "giai phong"
    // cho Lot ke tiep - lap den khi khong con tien trien them (vi pham that su voi Lot ngoai lo
    // se dung lai sau dung 1 vong thu lai vo ich, khong lap vo han).
    const resultMap = new Map<string, OutboundResult>();
    let pending = [...batchSerials];
    const maxRounds = batchSerials.length;
    for (let round = 0; round < maxRounds && pending.length > 0; round++) {
      const stillPending: string[] = [];
      let progressed = false;
      for (const serial of pending) {
        const res = await checkOutboundShipment({ gateCode, rfidSerialNo: serial, processUserID: userID });
        resultMap.set(serial, res);
        if (res.resultCode === "FIFOViolation") {
          stillPending.push(serial);
        } else {
          progressed = true;
        }
      }
      pending = stillPending;
      if (!progressed) break;
    }
    const results: BatchResultItem[] = batchSerials.map((serial) => ({ serial, result: resultMap.get(serial)! }));
    setBatchResults(results);
    setBatchChecking(false);

    // Tem da co ket qua cuoi cung (Pass, da xuat truoc do, tem loi...) khong con gi de lam them -
    // tu dong bo khoi "Danh sach cho xuat", chi giu lai tem dang Vi pham FIFO (van can nguoi dung
    // ghi de moi xu ly xong) de khong phai tu tay xoa tung tem da xong.
    setBatchSerials((prev) => prev.filter((s) => resultMap.get(s)?.resultCode === "FIFOViolation"));

    const violations = results.filter((r) => r.result.resultCode === "FIFOViolation");
    if (violations.length > 0) {
      playFifoAlarmSound();
      setBatchSelected(new Set(results.filter((r) => r.result.canOverride).map((r) => r.serial)));
    } else {
      setBatchSelected(new Set());
    }
    const passCount = results.filter((r) => r.result.success && r.result.resultCode === "Pass").length;
    notify(
      violations.length > 0 ? "warning" : "success",
      t("outbound.batch.resultsTitle"),
      `${passCount}/${results.length} ${t("outbound.batch.summaryPass")}` +
        (violations.length > 0 ? `, ${violations.length} ${t("outbound.batch.summaryViolation")}` : ""),
    );

    // Kiem tra thu cong/API (khac voi tu dong qua cong) khong phat SignalR nen bang "Nhat ky xuat tu
    // dong qua cong" khong tu refetch - tang nonce de buoc no tai lai, thay ket qua vua kiem tra ngay.
    setGateSearchNonce((n) => n + 1);
  }

  function toggleBatchSelect(serial: string) {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serial)) next.delete(serial);
      else next.add(serial);
      return next;
    });
  }

  async function handleBatchOverride() {
    if (!batchOverrideReason.trim() || batchSelected.size === 0 || batchOverriding) return;
    setBatchOverriding(true);
    const targets = Array.from(batchSelected);
    const results = await Promise.allSettled(
      targets.map((serial) =>
        overrideShipment({ rfidSerialNo: serial, overrideUserID: userID, overrideReason: batchOverrideReason }),
      ),
    );
    setBatchResults((prev) =>
      prev
        ? prev.map((item) => {
            const idx = targets.indexOf(item.serial);
            if (idx === -1) return item;
            const r = results[idx];
            return r.status === "fulfilled" ? { ...item, overrideMessage: r.value.message } : item;
          })
        : prev,
    );
    // Tem vua ghi de thanh cong da duoc xuat that su - khong con "cho xuat" nua, bo khoi danh sach.
    const overriddenSerials = new Set(
      targets.filter((_, i) => results[i].status === "fulfilled"),
    );
    setBatchSerials((prev) => prev.filter((s) => !overriddenSerials.has(s)));
    setBatchSelected(new Set());
    setBatchOverriding(false);
    notify("success", t("outbound.override.success.body"), `${targets.length}/${targets.length}`);
    setGateSearchNonce((n) => n + 1);
  }

  function startNewBatch() {
    setBatchSerials([]);
    setBatchResults(null);
    setBatchSelected(new Set());
    setBatchOverrideReason("");
  }

  const selectedGate = useMemo(() => gates.find((g) => g.gateCode === gateCode), [gates, gateCode]);

  const gateLogTotalPages = Math.max(1, Math.ceil(gateLogTotal / GATE_LOG_PAGE_SIZE));

  return (
    <div className="page page-wide">

      {!userID.trim() && (
        <div className="result-card warning" style={{ marginBottom: "1.25rem" }}>
          <span className="result-icon">
            <AlertCircle size={18} />
          </span>
          <div className="result-body">
            <span className="result-title">{t("inbound.noUser.title")}</span>
            <span className="result-message">{t("inbound.noUser.body")}</span>
          </div>
        </div>
      )}

      {gatesLoaded && !gateCode && (
        <div className="result-card error" style={{ marginBottom: "1.25rem" }}>
          <span className="result-icon">
            <AlertCircle size={18} />
          </span>
          <div className="result-body">
            <span className="result-title">{t("outbound.noGate.title")}</span>
            <span className="result-message">{t("outbound.noGate.body")}</span>
          </div>
        </div>
      )}

      {staleDetections.length > 0 && (
        <div className="table-card" style={{ marginBottom: "1.25rem", border: "1.5px solid var(--amber-300, #fde68a)" }}>
          <div className="table-toolbar">
            <div>
              <strong>
                <AlertTriangle size={15} style={{ verticalAlign: "-2px", marginRight: "0.35rem" }} />
                {t("outbound.staleDetections.title")} ({staleDetections.length})
              </strong>
              <div className="field-hint" style={{ margin: 0 }}>
                {t("outbound.staleDetections.hint")}
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("outbound.col.gate")}</th>
                <th>{t("outbound.tagLabel")}</th>
                <th>{t("outbound.col.lot")}</th>
                <th>{t("outbound.col.material")}</th>
                <th>{t("outbound.staleDetections.col.since")}</th>
              </tr>
            </thead>
            <tbody>
              {staleDetections.map((item) => {
                const minutesAgo = Math.max(
                  0,
                  Math.round((Date.now() - new Date(item.lastReadDateTime).getTime()) / 60000),
                );
                return (
                  <tr key={`${item.gateCode}:${item.rfidSerialNo}`}>
                    <td>{item.gateCode}</td>
                    <td>
                      <code>{item.rfidSerialNo}</code>
                    </td>
                    <td>{item.lotID ?? "—"}</td>
                    <td>{item.materialName ?? item.materialCode ?? "—"}</td>
                    <td>
                      {minutesAgo} {t("outbound.staleDetections.minutesAgo")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="workspace">
        <div className="primary-col">
          <form onSubmit={addToBatch} className="form-card">
            <div className="form-card-header">
              <span className="icon-badge">
                <Layers size={16} />
              </span>
              <h2>{t("outbound.formTitleCheck")}</h2>
            </div>

            <div className="field">
              <label htmlFor="gateCodeBatch">{t("outbound.gate")}</label>
              <div className="input-wrap">
                <span className="field-icon">
                  <DoorOpen size={16} />
                </span>
                <select id="gateCodeBatch" value={gateCode} disabled title={t("outbound.gateSingleHint")}>
                  <option value="">{t("outbound.gateSelectPlaceholder")}</option>
                  {gates.map((g) => (
                    <option key={g.gateCode} value={g.gateCode}>
                      {g.gateName ?? g.gateCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="batchSerial">{t("outbound.tagLabel")}</label>
              <div className="input-wrap">
                <span className="field-icon">
                  <ScanLine size={16} />
                </span>
                <input
                  id="batchSerial"
                  ref={batchInputRef}
                  autoFocus
                  placeholder={t("outbound.batch.scanPlaceholder")}
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  disabled={batchChecking || batchAdding}
                />
              </div>
              <p className="field-hint">
                {batchAdding ? t("outbound.batch.checkingTag") : t("outbound.batch.autoAddHint")}
              </p>
            </div>
          </form>

        </div>

        <div className="side-col">
          <div className="info-card">
            <h3>
              <DoorOpen size={16} /> {t("outbound.selectedGate.title")}
            </h3>
            {selectedGate ? (
              <dl className="gate-info">
                <dt>{t("outbound.selectedGate.code")}</dt>
                <dd>{selectedGate.gateCode}</dd>
                <dt>{t("outbound.selectedGate.name")}</dt>
                <dd>{selectedGate.gateName ?? "—"}</dd>
                <dt>{t("outbound.selectedGate.type")}</dt>
                <dd>{selectedGate.gateType}</dd>
              </dl>
            ) : (
              <p className="gate-info-empty">{t("outbound.selectedGate.none")}</p>
            )}
          </div>

          <div className="info-card">
            <h3>
              <ArrowDownWideNarrow size={16} /> {t("outbound.fifoNote.title")}
            </h3>
            <p className="fifo-note">
              {t("outbound.fifoNote.body1")}{" "}
              {t("outbound.fifoNote.body2")} <strong>{t("outbound.result.fifoViolation")}</strong>{" "}
              {t("outbound.fifoNote.body3")}
            </p>
          </div>
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: "1.5rem" }}>
        <div className="table-toolbar">
          <strong>
            {t("outbound.batch.pendingTitle")} ({batchSerials.length})
          </strong>
          {batchSerials.length > 0 && (
            <button
              type="button"
              className="ghost-btn"
              style={{ marginLeft: "auto" }}
              onClick={startNewBatch}
              disabled={batchChecking}
            >
              <Trash2 size={14} /> {t("outbound.batch.newBatch")}
            </button>
          )}
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("outbound.tagLabel")}</th>
              <th className="actions-col">{t("outbound.batch.remove")}</th>
            </tr>
          </thead>
          <tbody>
            {batchSerials.length === 0 && (
              <tr>
                <td colSpan={2} className="table-empty">
                  {t("outbound.batch.empty")}
                </td>
              </tr>
            )}
            {batchSerials.map((s) => (
              <tr key={s}>
                <td>
                  <code>{s}</code>
                </td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    <button type="button" onClick={() => removeFromBatch(s)} disabled={batchChecking}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {batchSerials.length > 0 && (
        <button
          type="button"
          className="submit-btn"
          style={{ marginTop: "0.75rem", marginBottom: "1.5rem", maxWidth: "320px" }}
          onClick={handleBatchCheck}
          disabled={batchChecking || !userID.trim() || !gateCode}
        >
          {batchChecking ? (
            <>
              <Loader2 size={16} className="spin-icon" /> {t("outbound.batch.checking")}
            </>
          ) : (
            <>
              <ShieldAlert size={16} /> {t("outbound.batch.checkAll")} ({batchSerials.length})
            </>
          )}
        </button>
      )}

      {batchResults && (
        <div className="table-card" style={{ marginBottom: "1rem" }}>
          <div className="table-toolbar">
            <strong>{t("outbound.batch.resultsTitle")}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th />
                <th>{t("outbound.tagLabel")}</th>
                <th>{t("outbound.col.result")}</th>
                <th>{t("outbound.col.note")}</th>
              </tr>
            </thead>
            <tbody>
              {batchResults.map((item) => {
                const itemTone = resultTone(item.result.resultCode, item.result.success);
                return (
                  <tr key={item.serial}>
                    <td>
                      {item.result.canOverride && !item.overrideMessage && (
                        <input
                          type="checkbox"
                          checked={batchSelected.has(item.serial)}
                          onChange={() => toggleBatchSelect(item.serial)}
                          disabled={batchOverriding}
                          aria-label={item.serial}
                        />
                      )}
                    </td>
                    <td>
                      <code>{item.serial}</code>
                    </td>
                    <td>
                      <span className={`gate-log-badge gate-log-${itemTone}`}>
                        {item.result.success ? resultLabelFor(item.result.resultCode) : t("outbound.checkFail.short")}
                      </span>
                    </td>
                    <td className="gate-log-msg">
                      {item.overrideMessage ?? (item.result.success ? item.result.resultMessage : item.result.errorMessage) ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {batchResults && batchSelected.size > 0 && (
        <div className="result-card warning" style={{ marginBottom: "1.5rem" }}>
          <span className="result-icon">
            <AlertTriangle size={18} />
          </span>
          <div className="result-body">
            <div className="override-box">
              <input
                placeholder={t("outbound.batch.overrideSharedReason")}
                value={batchOverrideReason}
                onChange={(e) => setBatchOverrideReason(e.target.value)}
                disabled={batchOverriding}
              />
              <button
                type="button"
                onClick={handleBatchOverride}
                disabled={!batchOverrideReason.trim() || batchOverriding}
              >
                {batchOverriding ? (
                  <>
                    <Loader2 size={14} className="spin-icon" /> {t("outbound.batch.overridingAll")}
                  </>
                ) : (
                  <>
                    {t("outbound.batch.overrideSelected")} ({batchSelected.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {recentAutoBatch.length > 0 && (
        <div className="table-card" style={{ marginBottom: "1.5rem" }}>
          <div className="table-toolbar">
            <div>
              <strong>
                {t("outbound.autoBatch.title")} ({recentAutoBatch.length})
              </strong>
              <div className="field-hint" style={{ margin: 0 }}>
                {t("outbound.autoBatch.windowNote")}
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th />
                <th>{t("outbound.tagLabel")}</th>
                <th>{t("outbound.col.result")}</th>
              </tr>
            </thead>
            <tbody>
              {recentAutoBatch.map((ev) => {
                const serial = ev.rfidSerialNo ?? ev.epc ?? "";
                const canOverride = ev.resultCode === "FIFOViolation";
                const overrideMessage = serial ? autoOverrideMessages[serial] : undefined;
                const evTone = ev.resultCode === "Pass" ? "success" : ev.resultCode === "Error" ? "error" : "warning";
                const isHighlighted = !!serial && serial === highlightSerial;
                return (
                  <tr
                    key={ev.id}
                    ref={(el) => {
                      if (serial) autoBatchRowRefs.current[serial] = el;
                    }}
                    className={isHighlighted ? "row-highlight-fifo" : undefined}
                  >
                    <td>
                      {canOverride && !overrideMessage && (
                        <input
                          type="checkbox"
                          checked={autoSelected.has(serial)}
                          onChange={() => toggleAutoSelect(serial)}
                          disabled={autoOverriding || !serial}
                          aria-label={serial}
                        />
                      )}
                    </td>
                    <td>
                      <code>{serial || "—"}</code>
                    </td>
                    <td>
                      <span className={`gate-log-badge gate-log-${evTone}`}>
                        {overrideMessage ?? gateResultLabel(ev.resultCode)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {autoSelected.size > 0 && (
            <div className="result-card warning" style={{ margin: "1rem" }}>
              <span className="result-icon">
                <AlertTriangle size={18} />
              </span>
              <div className="result-body">
                <div className="override-box">
                  <input
                    placeholder={t("outbound.batch.overrideSharedReason")}
                    value={autoOverrideReason}
                    onChange={(e) => setAutoOverrideReason(e.target.value)}
                    disabled={autoOverriding}
                  />
                  <button
                    type="button"
                    onClick={handleAutoOverride}
                    disabled={!autoOverrideReason.trim() || autoOverriding}
                  >
                    {autoOverriding ? (
                      <>
                        <Loader2 size={14} className="spin-icon" /> {t("outbound.batch.overridingAll")}
                      </>
                    ) : (
                      <>
                        {t("outbound.batch.overrideSelected")} ({autoSelected.size})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="page-section-title">
        <History size={16} /> {t("outbound.autoLog.title")}
      </div>

      <div className="filter-bar">
        <form className="filter-search-group" onSubmit={handleGateLogSearch}>
          <span className="filter-search">
            <Search size={15} />
            <input
              placeholder={t("common.searchPlaceholder")}
              value={gateSearchInput}
              onChange={(e) => setGateSearchInput(e.target.value)}
            />
          </span>
          <button type="submit" className="ghost-btn" disabled={gateLogLoading}>
            <Search size={15} className={gateLogLoading ? "spin-icon" : ""} /> {t("common.search")}
          </button>
        </form>

        <select
          className="filter-select"
          value={gateResultCode}
          onChange={(e) => {
            setGateResultCode(e.target.value);
            setGateLogPage(1);
          }}
        >
          <option value="">{t("outbound.filter.allResults")}</option>
          {Object.entries(RESULT_LABEL_KEYS).map(([code, key]) => (
            <option key={code} value={code}>
              {t(key)}
            </option>
          ))}
          <option value="Error">{t("outbound.filter.autoCheckError")}</option>
        </select>

        <input
          type="date"
          className="filter-select"
          value={gateFrom}
          onChange={(e) => {
            setGateFrom(e.target.value);
            setGateLogPage(1);
          }}
        />
        <span className="filter-sep">—</span>
        <input
          type="date"
          className="filter-select"
          value={gateTo}
          onChange={(e) => {
            setGateTo(e.target.value);
            setGateLogPage(1);
          }}
        />

        <button type="button" className="ghost-btn" onClick={resetGateLogFilters}>
          {t("common.clearFilters")}
        </button>

        <button type="button" className="ghost-btn" onClick={handleGateLogExport} disabled={gateExporting} style={{ marginLeft: "auto" }}>
          <Download size={15} className={gateExporting ? "spin-icon" : ""} /> {gateExporting ? t("common.exporting") : t("common.exportExcel")}
        </button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleGateSort("time")}>
                <span className="sort-th">{t("outbound.col.time")} {gateSortIcon("time")}</span>
              </th>
              <th>{t("outbound.col.gate")}</th>
              <th>{t("outbound.col.tag")}</th>
              <th>{t("outbound.col.lot")}</th>
              <th>{t("outbound.col.material")}</th>
              <th className="sortable" onClick={() => toggleGateSort("result")}>
                <span className="sort-th">{t("outbound.col.result")} {gateSortIcon("result")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {gateLogLoading &&
              gateLog.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr className="skeleton-row" key={`gate-skeleton-${i}`}>
                  <td><span className="skeleton-block" style={{ width: "9rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "4rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "7rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "6rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "8rem" }} /></td>
                  <td><span className="skeleton-block" style={{ width: "6rem" }} /></td>
                </tr>
              ))}
            {sortedGateLog.map((ev) => {
              const tone =
                ev.resultCode === "Pass" ? "success" : ev.resultCode === "Error" ? "error" : "warning";
              return (
                <tr key={ev.shipmentCheckSequence}>
                  <td>{formatDateTime(ev.checkDateTime)}</td>
                  <td>{ev.gateCode}</td>
                  <td>
                    <code>{ev.rfidSerialNo ?? "—"}</code>
                  </td>
                  <td>{ev.lotID ?? "—"}</td>
                  <td>{ev.materialName ?? ev.materialCode ?? "—"}</td>
                  <td>
                    <span
                      className={`gate-log-badge gate-log-${tone}`}
                      title={ev.resultMessage ?? undefined}
                    >
                      {gateResultLabel(ev.resultCode)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!gateLogLoading && gateLog.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  {gateSearch || gateResultCode || gateFrom || gateTo
                    ? t("outbound.empty.filtered")
                    : t("outbound.empty.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination-bar">
          <span className="pagination-info">
            {gateLogTotal === 0 ? `0 ${t("common.results")}` : `${gateLogTotal} ${t("common.records")}`}
          </span>
          <Pagination page={gateLogPage} totalPages={gateLogTotalPages} onChange={setGateLogPage} disabled={gateLogLoading} />
        </div>
      </div>

      {batchChecking && <LoadingOverlay text={t("outbound.batch.checking")} />}
      {batchOverriding && <LoadingOverlay text={t("outbound.batch.overridingAll")} />}
      {autoOverriding && <LoadingOverlay text={t("outbound.batch.overridingAll")} />}
    </div>
  );
}
