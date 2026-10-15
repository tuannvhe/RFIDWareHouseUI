import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../i18n/translations";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`lang-switcher ${compact ? "compact" : ""}`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-switcher-btn ${language === l.code ? "active" : ""}`}
          onClick={() => setLanguage(l.code)}
          title={l.label}
        >
          <span className="lang-flag">{l.flag}</span>
          {!compact && <span>{l.label}</span>}
        </button>
      ))}
    </div>
  );
}
