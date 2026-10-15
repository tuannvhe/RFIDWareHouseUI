import { useEffect, useRef, useState } from "react";
import { AlertCircle, Lightbulb, Loader2, RadioTower, RefreshCw, Siren } from "lucide-react";
import { getReaderStatus, pulseGpo, setGpo } from "../api/client";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";

const GREEN_PORT = 1;
const RED_PORT = 2;
const FIFO_TEST_SECONDS = 3;

export default function GpoTestPage() {
  const notify = useNotify();
  const { t } = useLanguage();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [greenOn, setGreenOn] = useState(false);
  const [redOn, setRedOn] = useState(false);
  const [busyPort, setBusyPort] = useState<number | null>(null);
  const [fifoTesting, setFifoTesting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownTimer = useRef<number | null>(null);

  function loadStatus() {
    setStatusLoading(true);
    getReaderStatus()
      .then((res) => setConnected(res.connected))
      .catch(() => setConnected(false))
      .finally(() => setStatusLoading(false));
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    return () => {
      if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    };
  }, []);

  async function handleToggle(port: number, turnOn: boolean) {
    setBusyPort(port);
    const res = await setGpo(port, turnOn);
    setBusyPort(null);
    if (!res.success) {
      notify("error", t("gpoTest.error.title"), res.errorMessage ?? t("gpoTest.error.notConnected"));
      return;
    }
    if (port === GREEN_PORT) setGreenOn(turnOn);
    if (port === RED_PORT) setRedOn(turnOn);
  }

  async function handleFifoTest() {
    if (fifoTesting) return;
    setFifoTesting(true);
    const res = await pulseGpo(RED_PORT, FIFO_TEST_SECONDS);
    if (!res.success) {
      setFifoTesting(false);
      notify("error", t("gpoTest.error.title"), res.errorMessage ?? t("gpoTest.error.notConnected"));
      return;
    }
    setRedOn(true);
    setCountdown(FIFO_TEST_SECONDS);
    countdownTimer.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimer.current) window.clearInterval(countdownTimer.current);
          setFifoTesting(false);
          setRedOn(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <div className="page">
      {connected === false && !statusLoading && (
        <div className="result-card error" style={{ marginBottom: "1.25rem" }}>
          <span className="result-icon">
            <AlertCircle size={18} />
          </span>
          <div className="result-body">
            <span className="result-title">{t("gpoTest.notConnected.title")}</span>
            <span className="result-message">{t("gpoTest.notConnected.body")}</span>
          </div>
        </div>
      )}

      <div className="workspace">
        <div className="primary-col">
          <div className="form-card">
            <div className="form-card-header">
              <span className="icon-badge">
                <RadioTower size={16} />
              </span>
              <h2>{t("gpoTest.readerStatus.title")}</h2>
            </div>
            <div className="gate-info" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className={`status-pill ${connected ? "ok" : "fail"}`}>
                {statusLoading
                  ? t("gpoTest.readerStatus.checking")
                  : connected
                    ? t("gpoTest.readerStatus.connected")
                    : t("gpoTest.readerStatus.disconnected")}
              </span>
              <button type="button" className="ghost-btn" onClick={loadStatus} disabled={statusLoading}>
                <RefreshCw size={14} className={statusLoading ? "spin-icon" : ""} /> {t("common.refresh")}
              </button>
            </div>
          </div>

          <div className="form-card" style={{ marginTop: "1.25rem" }}>
            <div className="form-card-header">
              <span className="icon-badge">
                <Lightbulb size={16} />
              </span>
              <h2>{t("gpoTest.manual.title")}</h2>
            </div>

            <div className="gpo-row">
              <div className="gpo-row-label">
                <span className="gpo-dot gpo-dot-green" data-on={greenOn} />
                <div>
                  <strong>{t("gpoTest.green.label")}</strong>
                  <div className="field-hint" style={{ margin: 0 }}>
                    GPO{GREEN_PORT}
                  </div>
                </div>
              </div>
              <div className="gpo-row-actions">
                <button
                  type="button"
                  className="submit-btn"
                  style={{ width: "auto" }}
                  onClick={() => handleToggle(GREEN_PORT, true)}
                  disabled={busyPort === GREEN_PORT || greenOn}
                >
                  {busyPort === GREEN_PORT ? <Loader2 size={15} className="spin-icon" /> : null} {t("gpoTest.turnOn")}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => handleToggle(GREEN_PORT, false)}
                  disabled={busyPort === GREEN_PORT || !greenOn}
                >
                  {t("gpoTest.turnOff")}
                </button>
              </div>
            </div>

            <div className="gpo-row">
              <div className="gpo-row-label">
                <span className="gpo-dot gpo-dot-red" data-on={redOn} />
                <div>
                  <strong>{t("gpoTest.red.label")}</strong>
                  <div className="field-hint" style={{ margin: 0 }}>
                    GPO{RED_PORT}
                  </div>
                </div>
              </div>
              <div className="gpo-row-actions">
                <button
                  type="button"
                  className="submit-btn"
                  style={{ width: "auto" }}
                  onClick={() => handleToggle(RED_PORT, true)}
                  disabled={busyPort === RED_PORT || redOn || fifoTesting}
                >
                  {busyPort === RED_PORT ? <Loader2 size={15} className="spin-icon" /> : null} {t("gpoTest.turnOn")}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => handleToggle(RED_PORT, false)}
                  disabled={busyPort === RED_PORT || !redOn || fifoTesting}
                >
                  {t("gpoTest.turnOff")}
                </button>
              </div>
            </div>
          </div>

          <div className="form-card" style={{ marginTop: "1.25rem" }}>
            <div className="form-card-header">
              <span className="icon-badge">
                <Siren size={16} />
              </span>
              <h2>{t("gpoTest.fifoTest.title")}</h2>
            </div>
            <p className="fifo-note">{t("gpoTest.fifoTest.body")}</p>
            <button type="button" className="submit-btn" onClick={handleFifoTest} disabled={fifoTesting}>
              {fifoTesting ? (
                <>
                  <Loader2 size={16} className="spin-icon" /> {t("gpoTest.fifoTest.running")} ({countdown}s)
                </>
              ) : (
                <>
                  <Siren size={16} /> {t("gpoTest.fifoTest.button")}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="side-col">
          <div className="info-card">
            <h3>
              <AlertCircle size={16} /> {t("gpoTest.help.title")}
            </h3>
            <p className="fifo-note">{t("gpoTest.help.body1")}</p>
            <p className="fifo-note">{t("gpoTest.help.body2")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
