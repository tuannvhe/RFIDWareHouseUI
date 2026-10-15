import { useEffect, useState } from "react";
import { Clock, Package, Tag } from "lucide-react";
import type { TraceEventItem, TraceResult } from "../api/client";
import { useGateEventsLog } from "../context/GateEventsContext";
import { useLanguage } from "../context/LanguageContext";
import { localeFor, type TranslationKey } from "../i18n/translations";
import Pagination from "./Pagination";

const LABELS_PAGE_SIZE = 10;
const EVENTS_PAGE_SIZE = 10;

type Tone = "success" | "warning" | "error";

function eventTone(ev: TraceEventItem): Tone {
  switch (ev.eventType) {
    case "Created":
    case "Read":
      return "success";
    case "Print":
      return ev.resultCode === "OK" ? "success" : "error";
    case "Check":
      return ev.resultCode === "Pass" ? "success" : ev.resultCode === "Error" ? "error" : "warning";
    case "Void":
      return "error";
    default:
      return "warning";
  }
}

function statusTone(status: string): Tone {
  return status === "Mapped" ? "success" : status === "Void" ? "error" : "warning";
}

interface TraceDetailProps {
  result: TraceResult;
  // Bam vao 1 ma tem trong danh sach (khi dang xem theo Lot) -> chuyen sang truy vet rieng tem do.
  onOpenTag: (serial: string) => void;
}

// Hien thi ket qua truy vet cua 1 tem/Lot (thong tin Lot + danh sach tem + dong thoi gian), co phan trang
// cho ca 2 bang. Dung chung cho trang "Truy vet" va cua so truy vet mo tu trang "Lot can xuat tiep".
export default function TraceDetail({ result, onOpenTag }: TraceDetailProps) {
  const { t, language } = useLanguage();
  const { resultLabel } = useGateEventsLog();
  const [labelsPage, setLabelsPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);

  useEffect(() => {
    setLabelsPage(1);
    setEventsPage(1);
  }, [result]);

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(localeFor(language));
  }

  function eventResultText(ev: TraceEventItem): string {
    if (!ev.resultCode) return "—";
    if (ev.eventType === "Print") return t(`trace.print.${ev.resultCode}` as TranslationKey);
    return resultLabel(ev.resultCode);
  }

  function eventDetailText(ev: TraceEventItem): string {
    let text = ev.detail ?? "";
    if (ev.eventType === "Read" && ev.detail) {
      const [count, rssi] = ev.detail.split("|");
      text = `${count} ${t("trace.read.detail")} ${rssi} dBm`;
    }
    if (ev.userID && ev.eventType !== "Read") {
      text = text ? `${text} · ${ev.userID}` : ev.userID;
    }
    return text || "—";
  }

  const lot = result.lot;
  const labelsTotalPages = Math.max(1, Math.ceil(result.labels.length / LABELS_PAGE_SIZE));
  const eventsTotalPages = Math.max(1, Math.ceil(result.events.length / EVENTS_PAGE_SIZE));
  const pagedLabels = result.labels.slice((labelsPage - 1) * LABELS_PAGE_SIZE, labelsPage * LABELS_PAGE_SIZE);
  const pagedEvents = result.events.slice((eventsPage - 1) * EVENTS_PAGE_SIZE, eventsPage * EVENTS_PAGE_SIZE);

  return (
    <>
      {lot && (
        <div className="info-card" style={{ marginBottom: "1.25rem" }}>
          <h3>
            <Package size={16} /> {t("trace.lot.title")}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.9rem 1.5rem" }}>
            {[
              [t("trace.lot.lotId"), <code key="l">{lot.lotID}</code>],
              [t("trace.lot.material"), lot.materialName ?? lot.materialCode ?? "—"],
              [t("trace.lot.warehouse"), lot.warehouseCode ?? "—"],
              [t("trace.lot.location"), lot.locationCode ?? "—"],
              [t("trace.lot.grDate"), lot.grDate ?? "—"],
              [
                t("trace.lot.qty"),
                lot.currentQty != null ? Number(lot.currentQty).toLocaleString(localeFor(language)) : "—",
              ],
            ].map(([label, value], i) => (
              <div key={i}>
                <div className="field-hint" style={{ margin: 0 }}>
                  {label}
                </div>
                <div style={{ fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
          {!lot.materialCode && <p className="field-hint">{t("trace.lot.notInMaster")}</p>}
        </div>
      )}

      <div className="table-card" style={{ marginBottom: "1.5rem" }}>
        <div className="table-toolbar">
          <strong>
            <Tag size={15} style={{ verticalAlign: "-2px", marginRight: "0.35rem" }} />
            {t("trace.labels.title")} ({result.labels.length})
          </strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("trace.labels.col.tag")}</th>
              <th>{t("trace.labels.col.status")}</th>
              <th>{t("trace.labels.col.created")}</th>
              <th>{t("trace.labels.col.updated")}</th>
            </tr>
          </thead>
          <tbody>
            {pagedLabels.map((l) => {
              const serial = l.rfidSerialNo.trim();
              return (
                <tr key={serial}>
                  <td>
                    {result.type === "lot" ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ padding: "0.15rem 0.5rem" }}
                        onClick={() => onOpenTag(serial)}
                      >
                        <code>{serial}</code>
                      </button>
                    ) : (
                      <code>{serial}</code>
                    )}
                  </td>
                  <td>
                    <span className={`gate-log-badge gate-log-${statusTone(l.labelStatus)}`}>
                      {t(`trace.status.${l.labelStatus}` as TranslationKey)}
                    </span>
                    {l.voidReason && <span className="field-hint"> {l.voidReason}</span>}
                  </td>
                  <td>
                    {formatDateTime(l.createDateTime)}
                    {l.createUserID ? ` · ${l.createUserID}` : ""}
                  </td>
                  <td>
                    {l.updateDateTime ? formatDateTime(l.updateDateTime) : "—"}
                    {l.updateUserID ? ` · ${l.updateUserID}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pagination-bar">
          <span className="pagination-info">
            {result.labels.length} {t("common.records")}
          </span>
          <Pagination page={labelsPage} totalPages={labelsTotalPages} onChange={setLabelsPage} />
        </div>
      </div>

      <div className="page-section-title">
        <Clock size={16} /> {t("trace.timeline.title")} ({result.events.length})
      </div>
      <p className="field-hint">{t("trace.timeline.note")}</p>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>{t("trace.timeline.col.time")}</th>
              <th>{t("trace.timeline.col.event")}</th>
              {result.type === "lot" && <th>{t("trace.timeline.col.tag")}</th>}
              <th>{t("trace.timeline.col.gate")}</th>
              <th>{t("trace.timeline.col.result")}</th>
              <th>{t("trace.timeline.col.detail")}</th>
            </tr>
          </thead>
          <tbody>
            {result.events.length === 0 && (
              <tr>
                <td colSpan={result.type === "lot" ? 6 : 5} className="table-empty">
                  {t("trace.timeline.empty")}
                </td>
              </tr>
            )}
            {pagedEvents.map((ev, i) => (
              <tr key={`${ev.eventType}-${ev.rfidSerialNo}-${ev.eventDateTime}-${i}`}>
                <td>{formatDateTime(ev.eventDateTime)}</td>
                <td>
                  <span className={`gate-log-badge gate-log-${eventTone(ev)}`}>
                    {t(`trace.event.${ev.eventType}` as TranslationKey)}
                  </span>
                </td>
                {result.type === "lot" && (
                  <td>
                    <code>{ev.rfidSerialNo}</code>
                  </td>
                )}
                <td>{ev.gateCode?.trim() || "—"}</td>
                <td>{eventResultText(ev)}</td>
                <td className="gate-log-msg">{eventDetailText(ev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination-bar">
          <span className="pagination-info">
            {result.events.length} {t("common.records")}
          </span>
          <Pagination page={eventsPage} totalPages={eventsTotalPages} onChange={setEventsPage} />
        </div>
      </div>
    </>
  );
}
