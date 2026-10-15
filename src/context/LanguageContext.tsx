import { createContext, useContext, useState, type ReactNode } from "react";
import { translate, type Language, type TranslationKey } from "../i18n/translations";

const LANGUAGE_KEY = "rfid.language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === "vi" || stored === "en" || stored === "ko") return stored;
  return "vi";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  function setLanguage(lang: Language) {
    localStorage.setItem(LANGUAGE_KEY, lang);
    setLanguageState(lang);
  }

  function t(key: TranslationKey) {
    return translate(key, language);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
