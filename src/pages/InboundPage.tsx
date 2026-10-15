import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Modal from "../components/Modal";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ListChecks,
  Loader2,
  ScanLine,
  Tag,
  XCircle,
} from "lucide-react";
import {
  createInboundLabel,
  getWorkCenters,
  type InboundRequest,
  type InboundResult,
  type WorkCenterOption,
} from "../api/client";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";

const COMPANY_CODE = "VVT";

const DEFAULT_WORK_CENTER = "VVT_F1";

const initialForm: Omit<InboundRequest, "processUserID" | "companyCode"> = {
  workCenterCode: DEFAULT_WORK_CENTER,
  rawMaterialBarcode: "",
};

const BAR_HEIGHTS = [60, 90, 40, 100, 55, 75, 30, 95, 50, 65, 85, 45, 100, 35, 70, 90, 55, 40, 80, 60];

export default function InboundPage() {
  const { userID } = useCurrentUser();
  const notify = useNotify();
  const { t } = useLanguage();
  const [workCenters, setWorkCenters] = useState<WorkCenterOption[]>([]);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<InboundResult | null>(null);
  const [lastLot, setLastLot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Lot da co tem -> hoi xac nhan truoc khi phat hanh them (null = khong co yeu cau xac nhan).
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ lot: string; count: number } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWorkCenters()
      .then(setWorkCenters)
      .catch(() => setWorkCenters([]));
  }, []);

  // Sau khi xu ly xong (thanh cong hay loi), luon focus lai o quet
  // de tram co dinh san sang nhan lan quet tiep theo ma khong can ai bam chuot.
  useEffect(() => {
    if (!loading) {
      barcodeInputRef.current?.focus();
    }
  }, [loading]);

  function handleChange(field: keyof typeof initialForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submitLabel(confirmDuplicate: boolean) {
    const lotSubmitted = form.rawMaterialBarcode.trim();
    setLoading(true);
    setResult(null);
    const res = await createInboundLabel({
      ...form,
      rawMaterialBarcode: lotSubmitted,
      companyCode: COMPANY_CODE,
      processUserID: userID,
      confirmDuplicate,
    });
    setLoading(false);

    if (res.errorCode === "LotAlreadyHasLabels") {
      setDuplicatePrompt({ lot: lotSubmitted, count: res.existingLabelCount ?? 0 });
      return;
    }

    setResult(res);
    if (res.success) {
      setLastLot(lotSubmitted);
      notify("success", t("inbound.success.title"), `${t("inbound.rfidLabel")}: ${res.rfidSerialNo} — Lot: ${lotSubmitted}`);
      setForm((prev) => ({ ...prev, rawMaterialBarcode: "" }));
    } else if (res.errorCode === "LotNotFound") {
      notify("error", t("inbound.error.title"), `${t("inbound.error.lotNotFound")} (${lotSubmitted})`);
    } else {
      notify("error", t("inbound.error.title"), res.errorMessage);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userID.trim() || !form.rawMaterialBarcode.trim() || loading || duplicatePrompt) return;
    void submitLabel(false);
  }

  function confirmDuplicate() {
    setDuplicatePrompt(null);
    void submitLabel(true);
  }

  // Dau doc barcode gui ky tu Enter o cuoi - dam bao tu dong submit
  // ngay ca khi trinh duyet khong tu submit form theo mac dinh.
  function handleBarcodeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!e.currentTarget.value.trim()) return;
      e.currentTarget.form?.requestSubmit();
    }
  }

  const hasLot = form.rawMaterialBarcode.trim().length > 0;
  const previewLot = hasLot ? form.rawMaterialBarcode : lastLot;
  const previewSerial = hasLot ? result?.rfidSerialNo ?? "•••• •••• ••••" : result?.rfidSerialNo;

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

      <div className="workspace">
        <div className="primary-col">
          <form onSubmit={handleSubmit} className="form-card">
            <div className="form-card-header">
              <span className="icon-badge">
                <Tag size={16} />
              </span>
              <h2>{t("inbound.formTitle")}</h2>
            </div>

            <div className="field">
              <label htmlFor="workCenterCode">{t("inbound.workCenter")}</label>
              <div className="input-wrap">
                <span className="field-icon">
                  <Building2 size={16} />
                </span>
                <span id="workCenterCode" className="input-static">
                  {workCenters.find((w) => w.workCenterCode === form.workCenterCode)?.workCenterName ??
                    form.workCenterCode}
                </span>
              </div>
              <span className="field-hint">{t("inbound.workCenterHint")}</span>
            </div>

            <div className="field">
              <label htmlFor="rawMaterialBarcode">{t("inbound.lotLabel")}</label>
              <div className="input-wrap">
                <span className="field-icon">
                  <ScanLine size={16} />
                </span>
                <input
                  id="rawMaterialBarcode"
                  ref={barcodeInputRef}
                  autoFocus
                  placeholder={t("inbound.lotPlaceholder")}
                  value={form.rawMaterialBarcode}
                  onChange={(e) => handleChange("rawMaterialBarcode", e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  disabled={loading || duplicatePrompt !== null}
                  required
                />
              </div>
              <span className="field-hint">{t("inbound.lotHint")}</span>
            </div>

            <button type="submit" className="submit-btn" disabled={loading || !userID.trim()}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spin-icon" /> {t("common.processing")}
                </>
              ) : (
                <>
                  <Tag size={16} /> {t("inbound.submit")}
                </>
              )}
            </button>
          </form>

          {result && (
            <div className={`result-card ${result.success ? "success" : "error"}`}>
              <span className="result-icon">
                {result.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </span>
              <div className="result-body">
                <span className="result-title">
                  {result.success ? t("inbound.success.title") : t("inbound.error.title")}
                </span>
                <span className="result-message">
                  {result.success ? (
                    <>
                      {t("inbound.rfidLabel")}: <code>{result.rfidSerialNo}</code>
                      <br />
                      {t("inbound.lotNvl")}: <code>{lastLot}</code>
                    </>
                  ) : (
                    result.errorMessage
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="side-col">
          <div className="info-card">
            <h3>
              <Tag size={16} /> {t("inbound.preview.title")}
            </h3>
            <div className={`label-preview ${previewLot ? "" : "is-empty"}`}>
              <span className="label-caption">RFID Label</span>
              <div className="barcode">
                {BAR_HEIGHTS.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <span className="serial-text">{previewSerial ?? t("inbound.preview.noData")}</span>
              <span className="lot-text">
                {t("inbound.preview.lot")}: <strong>{previewLot ?? "—"}</strong>
              </span>
            </div>
          </div>

          <div className="info-card">
            <h3>
              <ListChecks size={16} /> {t("inbound.process.title")}
            </h3>
            <div className="steps">
              <div className="step">
                <span className="step-index">1</span>
                <span className="step-text">
                  <strong>{t("inbound.process.step1.title")}</strong>
                  {t("inbound.process.step1.body")}
                </span>
              </div>
              <div className="step">
                <span className="step-index">2</span>
                <span className="step-text">
                  <strong>{t("inbound.process.step2.title")}</strong>
                  {t("inbound.process.step2.body")}
                </span>
              </div>
              <div className="step">
                <span className="step-index">3</span>
                <span className="step-text">
                  <strong>{t("inbound.process.step3.title")}</strong>
                  {t("inbound.process.step3.body")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={duplicatePrompt !== null}
        onClose={() => setDuplicatePrompt(null)}
        title={t("inbound.duplicate.title")}
        footer={
          <>
            <button type="button" className="modal-btn" onClick={() => setDuplicatePrompt(null)}>
              {t("common.cancel")}
            </button>
            <button type="button" className="modal-btn modal-btn-danger" onClick={confirmDuplicate}>
              {t("inbound.duplicate.confirm")}
            </button>
          </>
        }
      >
        <strong>{duplicatePrompt?.lot}</strong>: {duplicatePrompt?.count} {t("inbound.duplicate.body")}
      </Modal>
    </div>
  );
}
