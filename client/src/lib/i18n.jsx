// i18n léger pour Delt AI — FR (défaut) + EN.
// Auto-détection via navigator.language au mount.
// L'utilisateur peut override son choix manuellement (stocké localStorage).
//
// Usage :
//   import { useT, useLocale } from "../lib/i18n.js";
//   const t = useT();
//   <h1>{t("home.title")}</h1>

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { TRANSLATIONS } from "./translations.js";

const SUPPORTED = ["fr", "en"];
const DEFAULT_LOCALE = "fr";
const STORAGE_KEY = "delt-locale";

function detectLocale() {
  // 1. Override utilisateur
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
  // 2. Navigator
  try {
    const navLang = (navigator.language || navigator.userLanguage || "").toLowerCase().split("-")[0];
    if (SUPPORTED.includes(navLang)) return navLang;
  } catch {}
  return DEFAULT_LOCALE;
}

const I18nContext = createContext({ locale: DEFAULT_LOCALE, setLocale: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next) => {
    if (!SUPPORTED.includes(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    setLocaleState(next);
  };

  const value = useMemo(() => {
    const t = (key, vars = {}) => {
      const entry = TRANSLATIONS[key];
      if (!entry) return key; // fallback : la clé elle-même
      let str = entry[locale] || entry[DEFAULT_LOCALE] || key;
      // Substitution basique {{var}}
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
      }
      return str;
    };
    return { locale, setLocale, t, isEN: locale === "en", isFR: locale === "fr" };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}

export function useLocale() {
  return useContext(I18nContext);
}

export { SUPPORTED };
