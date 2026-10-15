import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "../api/client";
import { getAccessToken } from "../auth/tokenStorage";
import { useAuth } from "./AuthContext";
import { useNotify } from "./NotificationContext";
import { useLanguage } from "./LanguageContext";
import { translate, type TranslationKey } from "../i18n/translations";
import { playFifoAlarmSound } from "../utils/alarmSound";

export interface GateEventPayload {
  gateCode: string;
  rfidSerialNo?: string;
  epc?: string;
  resultCode: string;
  resultMessage?: string;
  timestamp: string;
}

export interface GateEventLogItem extends GateEventPayload {
  id: number;
  receivedAt: string;
}

const RESULT_LABEL_KEYS: Record<string, TranslationKey> = {
  Pass: "outbound.result.passLive",
  FIFOViolation: "outbound.result.fifoViolation",
  NotRegistered: "outbound.result.notRegistered",
  AlreadyShipped: "outbound.result.alreadyShipped",
  VoidLabel: "outbound.result.voidLabel",
  NotMapped: "outbound.result.notMapped",
  Error: "outbound.result.autoCheckError",
};

const MAX_LOG_ITEMS = 50;

interface GateEventsContextValue {
  events: GateEventLogItem[];
  resultLabel: (code: string) => string;
}

const GateEventsContext = createContext<GateEventsContextValue | null>(null);

// Duy nhat 1 ket noi SignalR cho toan app - dat o Context (khong phai hook rieng tung trang)
// de moi trang deu doc duoc cung 1 nhat ky su kien real-time tu cong xuat, khong mo trung ket noi.
export function GateEventsProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<GateEventLogItem[]>([]);
  const nextId = useRef(1);
  // Doc language/duong dan hien tai moi lan render qua ref - tranh phai reconnect SignalR khi
  // doi ngon ngu hoac chuyen trang (effect chi phu thuoc isAuthenticated), nhung callback van
  // luon dung gia tri hien tai.
  const languageRef = useRef(language);
  languageRef.current = language;
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  function resultLabel(code: string): string {
    const key = RESULT_LABEL_KEYS[code];
    return key ? translate(key, languageRef.current) : code;
  }

  useEffect(() => {
    if (!isAuthenticated) return;

    // Co the bi goi 2 lan lien tiep (vd React StrictMode khi dang dev: mount -> cleanup -> mount lai)
    // - dung co "stopped" de dam bao NEU connection nay van co the ket noi thanh cong SAU KHI cleanup
    // da chay (stop() goi truoc khi start() kip xong), no se bi tat ngay lap tuc thay vi song song
    // ton tai voi connection cua lan mount sau, tranh nhan 1 broadcast qua 2 ket noi cung luc (gay
    // phat trung/vang tieng canh bao FIFO tren web).
    let stopped = false;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/gate-events`, {
        accessTokenFactory: () => getAccessToken() ?? "",
      })
      .withAutomaticReconnect()
      .build();

    connection.on("ShipmentChecked", (payload: GateEventPayload) => {
      const label = resultLabel(payload.resultCode);
      const tone = payload.resultCode === "Pass" ? "success" : payload.resultCode === "Error" ? "error" : "warning";

      if (payload.resultCode === "FIFOViolation") {
        playFifoAlarmSound();
        // Vi pham FIFO can xu ly gap (ghi de) - tu dong dua nguoi dung ve trang Xuat kho de thay
        // ngay, tru khi da dang o do san. Cac ket qua khac (Pass...) khong chuyen trang de tranh
        // gian doan cong viec dang lam o trang khac. Kem theo ma tem qua state cua router de trang
        // Xuat kho tu cuon toi dung dong trong bang nhat ky va lam noi bat no len.
        const fifoSerial = payload.rfidSerialNo ?? payload.epc;
        if (pathnameRef.current !== "/outbound") {
          navigate("/outbound", { state: { fifoSerial, fifoAt: Date.now() } });
        } else if (fifoSerial) {
          navigate(pathnameRef.current, { state: { fifoSerial, fifoAt: Date.now() }, replace: true });
        }
      }

      notify(
        tone,
        `${translate("gateEvent.gatePrefix", languageRef.current)} ${payload.gateCode}: ${label}`,
        `${translate("gateEvent.tagPrefix", languageRef.current)} ${payload.rfidSerialNo ?? payload.epc ?? "?"}${payload.resultMessage ? " — " + payload.resultMessage : ""}`,
      );

      setEvents((prev) => [
        { ...payload, id: nextId.current++, receivedAt: new Date().toISOString() },
        ...prev,
      ].slice(0, MAX_LOG_ITEMS));
    });

    connection
      .start()
      .then(() => {
        if (stopped) {
          // Cleanup da chay truoc khi start() kip xong - tat ngay, khong de connection nay song.
          connection.stop();
        }
      })
      .catch((err) => {
        if (!stopped) {
          console.error("Khong ket noi duoc toi GateEventsHub:", err);
        }
      });

    return () => {
      stopped = true;
      connection.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <GateEventsContext.Provider value={{ events, resultLabel }}>
      {children}
    </GateEventsContext.Provider>
  );
}

export function useGateEventsLog() {
  const ctx = useContext(GateEventsContext);
  if (!ctx) {
    throw new Error("useGateEventsLog must be used within GateEventsProvider");
  }
  return ctx;
}
