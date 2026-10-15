import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Clock,
  ListChecks,
  Loader2,
  PackageSearch,
  RefreshCcw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  getDashboardSummary,
  getPrintLogs,
  getStaleGateDetections,
  getWorkCenters,
  type DashboardSummary,
  type PrintLogItem,
  type StaleGateDetectionItem,
  type WorkCenterOption,
} from "../api/client";
import LineAreaChart from "../components/charts/LineAreaChart";
import DonutRing from "../components/charts/DonutRing";
import SimpleBarChart from "../components/charts/SimpleBarChart";
import GroupedBarChart from "../components/charts/GroupedBarChart";
import VerticalBarChart from "../components/charts/VerticalBarChart";
import MultiSegmentDonut from "../components/charts/MultiSegmentDonut";
import ProgressBar from "../components/charts/ProgressBar";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";
import { localeFor, type TranslationKey } from "../i18n/translations";

type Preset = "today" | "7d" | "30d" | "custom";

const RESULT_LABEL_KEYS: Record<string, TranslationKey> = {
  Pass: "dashboard.result.pass",
  FIFOViolation: "dashboard.result.fifoViolation",
  NotRegistered: "dashboard.result.notRegistered",
  AlreadyShipped: "dashboard.result.alreadyShipped",
  VoidLabel: "dashboard.result.voidLabel",
  NotMapped: "dashboard.result.notMapped",
};

const LABEL_STATUS_KEYS: Record<string, TranslationKey> = {
  Mapped: "dashboard.labelStatus.mapped",
  Shipped: "dashboard.labelStatus.shipped",
  Void: "dashboard.labelStatus.void",
};

// Chon mau khac nhom mau (khong xanh la canh xanh ngoc) de de phan biet hon giua cac phan lien ke.
const LABEL_STATUS_COLOR: Record<string, string> = {
  Mapped: "--amber-500",
  Shipped: "--green-600",
  Void: "--red-600",
};

// Xep xen ke cac tong mau khac nhau (khong de 2 mau xanh canh nhau) de cac phan trong donut
// de phan biet hon, ke ca khi chi co 2-3 hang muc (truong hop pho bien nhat).
const DONUT_PALETTE = ["--indigo-500", "--amber-500", "--red-600", "--teal-500", "--green-600"];

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = toIsoDate(today);
  if (preset === "today") return { from: to, to };
  const days = preset === "30d" ? 29 : 6;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { from: toIsoDate(from), to };
}

const CHART_MIN_DAYS = 30;

// Bieu do luon hien it nhat CHART_MIN_DAYS ngay, bat ke filter dang chon ngan hon (vd "7 ngay").
// Chi khi filter chon khoang dai hon 30 ngay thi bieu do moi noi rong theo dung khoang do.
function chartRangeFor(range: { from: string; to: string }): { from: string; to: string } {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const selectedDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (selectedDays >= CHART_MIN_DAYS) {
    return range;
  }
  const chartFrom = new Date(to);
  chartFrom.setDate(chartFrom.getDate() - (CHART_MIN_DAYS - 1));
  return { from: toIsoDate(chartFrom), to: range.to };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { t, language } = useLanguage();
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [workCenters, setWorkCenters] = useState<WorkCenterOption[]>([]);
  const [workCenterCode] = useState("VVT_F1");
  // Bieu do "Vi pham FIFO & Ghi de theo thang" luon quet ca nam (khong phu thuoc bo loc ngay o tren
  // cung trang) nen can 1 bo chon nam rieng - khong thi nguoi dung khong the xem lai du lieu nam truoc.
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartSummary, setChartSummary] = useState<DashboardSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<PrintLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [staleDetections, setStaleDetections] = useState<StaleGateDetectionItem[]>([]);

  useEffect(() => {
    getWorkCenters()
      .then(setWorkCenters)
      .catch(() => setWorkCenters([]));
  }, []);

  // Tem doc duoc tai cong nhung qua 30 phut chua xuat kho - canh bao ngay tren Dashboard de
  // quan ly theo doi tong quan, tuong tu canh bao da co o trang Xuat kho.
  const STALE_MINUTES = 30;
  useEffect(() => {
    let cancelled = false;
    function loadStale() {
      getStaleGateDetections(STALE_MINUTES)
        .then((items) => {
          if (!cancelled) setStaleDetections(items);
        })
        .catch(() => {
          // Im lang bo qua loi tai canh bao phu - khong lam gian doan dashboard chinh.
        });
    }
    loadStale();
    const timer = window.setInterval(loadStale, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Thoi gian toi thieu hien trang thai loading, ke ca khi backend tra loi qua nhanh (<300ms) -
  // neu khong dau hieu "dang tai" se lot qua qua nhanh, mat khong kip nhin thay.
  const MIN_LOADING_MS = 350;

  const load = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    const startedAt = Date.now();
    const chartRange = chartRangeFor(range);
    const sameRange = chartRange.from === range.from && chartRange.to === range.to;

    const summaryPromise = getDashboardSummary({
      from: `${range.from}T00:00:00`,
      to: `${range.to}T23:59:59`,
      workCenterCode: workCenterCode || undefined,
      year: selectedYear,
    });
    // Neu filter da >= 30 ngay thi chartRange trung voi range - khong can goi lai lan 2 cho ton query.
    const chartPromise = sameRange
      ? summaryPromise
      : getDashboardSummary({
          from: `${chartRange.from}T00:00:00`,
          to: `${chartRange.to}T23:59:59`,
          workCenterCode: workCenterCode || undefined,
        });

    return Promise.all([summaryPromise, chartPromise, getPrintLogs({ page: 1, pageSize: 6 })])
      .then(([summaryData, chartData, logsData]) => {
        setSummary(summaryData);
        setChartSummary(chartData);
        setRecentLogs(logsData.items);
      })
      .catch((err) => {
        // Lam moi ngam bi loi thi khong lam phien nguoi dung bang toast - chi bo qua, lan
        // sau (15 phut ke tiep hoac khi ho tu bam "Lam moi") se thu lai.
        if (silent) return;
        notify(
          "error",
          t("dashboard.loadError.title"),
          err instanceof Error ? err.message : t("dashboard.loadError.body"),
        );
      })
      .finally(() => {
        if (silent) return;
        const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
        if (remaining > 0) {
          setTimeout(() => setLoading(false), remaining);
        } else {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, workCenterCode, selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  // Tu dong lam moi du lieu moi 15 phut - chi cap nhat lai state (React tu dong chi ve lai
  // dung phan DOM co gia tri thay doi), khong reload ca trang. Chay ngam (silent) de khong
  // lam nhap nhay hieu ung "dang tai" tren toan bo dashboard moi 15 phut mot lan.
  const AUTO_REFRESH_MS = 15 * 60 * 1000;
  useEffect(() => {
    const id = window.setInterval(() => {
      load({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Danh sach nam de chon cho bieu do Vi pham FIFO & Ghi de theo thang - bieu do nay luon quet
  // ca 1 nam, khong phu thuoc bo loc ngay o dau trang, nen can chon nam rieng.
  const yearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => nowYear - i);
  }, []);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      setRange(presetRange(p));
    }
  }

  const chartLabels = useMemo(
    () =>
      (chartSummary?.issuedByDay ?? []).map((d) =>
        new Date(d.date).toLocaleDateString(localeFor(language), { day: "2-digit", month: "2-digit" }),
      ),
    [chartSummary, language],
  );
  const chartSeries = useMemo(
    () => [
      { name: t("dashboard.dailyChart.inbound"), colorVar: "--green-600", data: (chartSummary?.issuedByDay ?? []).map((d) => d.count) },
      { name: t("dashboard.dailyChart.outbound"), colorVar: "--indigo-600", data: (chartSummary?.shippedByDay ?? []).map((d) => d.count) },
    ],
    [chartSummary, t],
  );

  const passCount = summary?.outboundResultBreakdown.find((r) => r.name === "Pass")?.count ?? 0;
  const totalChecks = summary?.outboundResultBreakdown.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const passPercent = totalChecks > 0 ? (passCount / totalChecks) * 100 : 0;

  const totalIssued = summary?.totalIssued ?? 0;
  const printSuccessCount = Math.max(0, totalIssued - (summary?.totalPrintErrors ?? 0));
  const printSuccessPercent = totalIssued > 0 ? (printSuccessCount / totalIssued) * 100 : 0;

  const fifoOverrideMonthLabels = (summary?.fifoViolationsByMonth ?? []).map((m) => m.name);
  const fifoOverrideMonthSeries = useMemo(
    () => [
      {
        name: t("dashboard.fifoChart.violations"),
        colorVar: "--amber-600",
        data: (summary?.fifoViolationsByMonth ?? []).map((m) => m.count),
      },
      {
        name: t("dashboard.fifoChart.overrides"),
        colorVar: "--red-600",
        data: (summary?.overridesByMonth ?? []).map((m) => m.count),
      },
    ],
    [summary, t],
  );

  // Tinh tu chinh 2 chuoi theo thang (da la du lieu ca nam) - khong can goi API rieng.
  const yearTotalFifoViolations = (summary?.fifoViolationsByMonth ?? []).reduce((s, m) => s + m.count, 0);
  const yearTotalOverrides = (summary?.overridesByMonth ?? []).reduce((s, m) => s + m.count, 0);
  const yearOverridePercent =
    yearTotalFifoViolations > 0 ? (yearTotalOverrides / yearTotalFifoViolations) * 100 : 0;

  const topFifoMaterialsData = (summary?.topFifoViolationMaterials ?? []).map((x) => ({ name: x.name, count: x.count }));
  const topOverrideUsersData = (summary?.topOverrideUsers ?? []).map((x, i) => ({
    name: x.name,
    count: x.count,
    colorVar: DONUT_PALETTE[i % DONUT_PALETTE.length],
  }));
  const labelStatusData = (summary?.labelStatusBreakdown ?? [])
    .map((x) => ({
      name: LABEL_STATUS_KEYS[x.name] ? t(LABEL_STATUS_KEYS[x.name]) : x.name,
      count: x.count,
      colorVar: LABEL_STATUS_COLOR[x.name] ?? "--ink-300",
    }))
    .sort((a, b) => b.count - a.count);

  const resultBreakdownData = (summary?.outboundResultBreakdown ?? [])
    .map((r) => ({ name: RESULT_LABEL_KEYS[r.name] ? t(RESULT_LABEL_KEYS[r.name]) : r.name, count: r.count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="page page-wide">
      {staleDetections.length > 0 && (
        <button
          type="button"
          className="table-card"
          style={{
            marginBottom: "1.25rem",
            border: "1.5px solid var(--amber-300, #fde68a)",
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
          }}
          onClick={() => navigate("/outbound")}
        >
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
        </button>
      )}

      <div className="filter-bar">
        <div className="preset-group">
          {(["today", "7d", "30d"] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`preset-btn ${preset === p ? "active" : ""}`}
              onClick={() => applyPreset(p)}
            >
              {p === "today" ? t("dashboard.range.today") : p === "7d" ? t("dashboard.range.7d") : t("dashboard.range.30d")}
            </button>
          ))}
        </div>

        <input
          type="date"
          className="filter-select"
          value={range.from}
          max={range.to}
          onChange={(e) => {
            setPreset("custom");
            setRange((r) => ({ ...r, from: e.target.value }));
          }}
        />
        <span className="filter-sep">—</span>
        <input
          type="date"
          className="filter-select"
          value={range.to}
          min={range.from}
          onChange={(e) => {
            setPreset("custom");
            setRange((r) => ({ ...r, to: e.target.value }));
          }}
        />

        <span className="filter-static-badge" style={{ marginLeft: "auto" }} title={t("dashboard.workCenterHint")}>
          <Building2 size={13} />
          {workCenters.find((w) => w.workCenterCode === workCenterCode)?.workCenterName ?? workCenterCode}
        </span>

        <button type="button" className="ghost-btn" onClick={() => load()} disabled={loading}>
          <RefreshCcw size={15} className={loading ? "spin-icon" : ""} /> {t("dashboard.refresh")}
        </button>
      </div>

      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        {t("dashboard.definition.note")}{" "}
        <Link to="/next-lot">{t("nav.nextLot")}</Link>
      </p>

      <div className="dashboard-grid">
        <div className={`info-card span-full ${loading ? "is-loading" : ""}`}>
          <h3>
            <TrendingUp size={16} /> {t("dashboard.dailyChart.title")}
            {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
          </h3>
          <LineAreaChart labels={chartLabels} series={chartSeries} />
        </div>

        <div className="dashboard-row cols-fifo">
          <div className={`info-card ${loading ? "is-loading" : ""}`}>
            <h3>
              <AlertTriangle size={16} /> {t("dashboard.fifoChart.titlePrefix")}
              <select
                className="year-select-inline"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                title={t("dashboard.fifoChart.windowNote")}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </h3>
            <GroupedBarChart labels={fifoOverrideMonthLabels} series={fifoOverrideMonthSeries} />
          </div>

          <div className={`info-card dashboard-mini-stat ${loading ? "is-loading" : ""}`}>
            <span className="stat-label">
              {t("dashboard.overrideRate.caption")}
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </span>
            <div className="donut-wrap donut-wrap-mini">
              <DonutRing
                percent={yearOverridePercent}
                valueLabel={`${Math.round(yearOverridePercent)}%`}
                caption={`${yearTotalOverrides}/${yearTotalFifoViolations} ${t("dashboard.unit.turns")}`}
                tone="red"
              />
            </div>
          </div>
        </div>

        <div className={`info-card ${loading ? "is-loading" : ""}`}>
          <h3>
            {t("dashboard.operationalRates.title")}
            {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
          </h3>
          <div className="progress-bar-stack">
            <ProgressBar
              percent={passPercent}
              colorVar="--teal-500"
              label={t("dashboard.outboundPassRate.title")}
              caption={`${passCount}/${totalChecks} ${t("dashboard.unit.turns")}`}
            />
            <ProgressBar
              percent={printSuccessPercent}
              colorVar="--indigo-500"
              label={t("dashboard.printSuccessRate.title")}
              caption={`${printSuccessCount}/${totalIssued} ${t("dashboard.unit.tags")}`}
            />
          </div>
          {totalIssued > 0 && printSuccessCount === 0 && (
            <p className="field-hint" style={{ color: "var(--red-600)", marginTop: "0.75rem" }}>
              <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />
              {t("dashboard.printSuccessRate.warn")}
            </p>
          )}
        </div>

        <div className="dashboard-row">
          <div className={`info-card ${loading ? "is-loading" : ""}`}>
            <h3>
              <AlertTriangle size={16} /> {t("dashboard.topFifoMaterials.titleFull")}
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </h3>
            <VerticalBarChart data={topFifoMaterialsData} />
          </div>

          <div className={`info-card ${loading ? "is-loading" : ""}`}>
            <h3>
              <ShieldAlert size={16} /> {t("dashboard.topOverrideUsers.title")}
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </h3>
            <MultiSegmentDonut data={topOverrideUsersData} centerLabel={`${yearTotalOverrides}`} />
          </div>

          <div className={`info-card ${loading ? "is-loading" : ""}`}>
            <h3>
              <PackageSearch size={16} /> {t("dashboard.labelStatus.title")}
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </h3>
            <MultiSegmentDonut data={labelStatusData} centerLabel={`${totalIssued}`} />
          </div>
        </div>

        <div className="dashboard-row">
          <div className={`info-card ${loading ? "is-loading" : ""}`}>
            <h3>
              <ListChecks size={16} /> {t("dashboard.outboundBreakdown.title")}
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </h3>
            <SimpleBarChart data={resultBreakdownData} />
          </div>

          <div className={`info-card ${loading ? "is-loading" : ""}`}>
            <h3>
              <Clock size={16} /> {t("dashboard.recentPrint.title")}
              {loading && <Loader2 size={13} className="spin-icon dashboard-card-spinner" />}
            </h3>
            {recentLogs.length === 0 ? (
              <div className="chart-empty">{t("dashboard.recentPrint.empty")}</div>
            ) : (
              <div className="recent-list">
                {recentLogs.map((log) => {
                  const isSuccess = log.httpStatus !== undefined && log.httpStatus >= 200 && log.httpStatus < 300;
                  return (
                    <button
                      type="button"
                      className="recent-row"
                      key={log.printLogSequence}
                      disabled={!log.rfidSerialNo}
                      title={log.rfidSerialNo ? t("dashboard.recentPrint.viewDetail") : undefined}
                      onClick={() =>
                        log.rfidSerialNo &&
                        navigate(`/printlog?serial=${encodeURIComponent(log.rfidSerialNo)}`)
                      }
                    >
                      <span className={`status-pill ${isSuccess ? "ok" : "fail"}`}>
                        {isSuccess ? t("dashboard.recentPrint.ok") : t("common.error")}
                      </span>
                      <span className="recent-serial">{log.rfidSerialNo ?? "—"}</span>
                      <span className="recent-time">
                        {new Date(log.createDateTime).toLocaleString(localeFor(language), {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="button" className="info-card override-link-card" onClick={() => navigate("/override-log")}>
            <h3>
              <ShieldAlert size={16} /> {t("dashboard.overrideLogLink.title")}
            </h3>
            <p className="override-link-desc">
              {t("dashboard.overrideLogLink.body")}
            </p>
            <span className="override-link-cta">{t("dashboard.overrideLogLink.cta")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
