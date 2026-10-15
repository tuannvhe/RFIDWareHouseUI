import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isAlarmSoundUnlocked, unlockAlarmSound } from "../utils/alarmSound";
import { useLanguage } from "../context/LanguageContext";

// Nhac nguoi dung bam vao trang 1 lan de trinh duyet cho phep phat am thanh canh bao FIFO.
// Banner tu bien mat ngay khi co bat ky thao tac nao tren trang.
export default function AlarmSoundBanner() {
  const { t } = useLanguage();
  const [unlocked, setUnlocked] = useState(isAlarmSoundUnlocked);

  useEffect(() => {
    if (unlocked) return;
    function onInteract() {
      unlockAlarmSound();
      // userActivation chi cap nhat sau khi su kien ket thuc.
      window.setTimeout(() => setUnlocked(isAlarmSoundUnlocked()), 0);
    }
    window.addEventListener("pointerdown", onInteract, true);
    window.addEventListener("keydown", onInteract, true);
    return () => {
      window.removeEventListener("pointerdown", onInteract, true);
      window.removeEventListener("keydown", onInteract, true);
    };
  }, [unlocked]);

  if (unlocked) return null;

  return (
    <div className="result-card warning" role="status" style={{ marginBottom: "1rem" }}>
      <span className="result-icon">
        <VolumeX size={18} />
      </span>
      <div className="result-body" style={{ flex: 1 }}>
        <span className="result-title">{t("alarmSound.banner.title")}</span>
        <span className="result-message">{t("alarmSound.banner.body")}</span>
      </div>
      <button type="button" className="ghost-btn" onClick={unlockAlarmSound}>
        <Volume2 size={15} /> {t("alarmSound.banner.btn")}
      </button>
    </div>
  );
}
