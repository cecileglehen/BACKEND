import { useState } from "react";
import ApiDocsPage from "./ApiDocsPage.jsx";
import ApiKeysPage from "./ApiKeysPage.jsx";
import PrivacySettingsPage from "./PrivacySettingsPage.jsx";
import UsagePage from "./UsagePage.jsx";
import ModelPreferencesPage from "./ModelPreferencesPage.jsx";
import MemoryPage from "./MemoryPage.jsx";
import IntegrationsPage from "./IntegrationsPage.jsx";
import { useLocale } from "../lib/i18n.jsx";

const SECTION_KEYS = [
  { id: "account",      key: "settings.account" },
  { id: "memory",       key: "settings.memory" },
  { id: "models",       key: "settings.models" },
  { id: "integrations", key: "settings.integrations" },
  { id: "usage",        key: "settings.usage" },
  { id: "api",          key: "settings.api" },
  { id: "docs",         key: "settings.docs" },
  { id: "privacy",      key: "settings.privacy" }
];

export default function SettingsPage({ user, initialSection = "account", onDeleted }) {
  const { t } = useLocale();
  const [section, setSection] = useState(initialSection);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-delt-text">{t("settings.title")}</h1>
        <p className="text-sm text-delt-muted mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 sm:gap-6">
        <aside className="md:sticky md:top-20 h-fit border border-delt-border rounded-lg bg-white overflow-x-auto md:overflow-hidden flex md:block">
          {SECTION_KEYS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-auto md:w-full flex-shrink-0 text-left px-4 py-3 text-sm font-medium border-r md:border-r-0 md:border-b border-delt-border last:border-r-0 md:last:border-b-0 transition-colors ${
                section === item.id ? "bg-delt-panel text-delt-text" : "text-delt-muted hover:bg-delt-surface hover:text-delt-text"
              }`}
            >
              {t(item.key)}
            </button>
          ))}
        </aside>

        <main className="min-w-0">
          {section === "api" ? (
            <ApiKeysPage />
          ) : section === "docs" ? (
            <ApiDocsPage />
          ) : section === "usage" ? (
            <UsagePage />
          ) : section === "models" ? (
            <ModelPreferencesPage user={user} />
          ) : section === "memory" ? (
            <MemoryPage />
          ) : section === "integrations" ? (
            <IntegrationsPage />
          ) : section === "privacy" ? (
            <PrivacySettingsPage onDeleted={onDeleted} />
          ) : (
            <AccountPanel user={user} />
          )}
        </main>
      </div>
    </div>
  );
}

function AccountPanel({ user }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-delt-text">{t("settings.profile")}</h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
          <Info label="Email" value={user?.email || "-"} />
          <Info label="Plan" value={user?.plan || "-"} />
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-delt-text">{t("settings.language")}</h2>
        <div className="mt-3 flex gap-2">
          {[
            { code: "fr", label: t("settings.language_fr"), flag: "🇫🇷" },
            { code: "en", label: t("settings.language_en"), flag: "🇬🇧" }
          ].map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                locale === l.code
                  ? "bg-delt-text text-white border-delt-text"
                  : "bg-white text-delt-text border-delt-border hover:bg-delt-surface"
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-delt-text">{t("settings.docs_section") || "Documents"}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/privacy" className="btn-secondary text-sm">{t("settings.privacy_policy") || "Privacy Policy"}</a>
          <a href="/terms" className="btn-secondary text-sm">{t("settings.terms") || "Terms"}</a>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-delt-border bg-delt-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-delt-muted">{label}</div>
      <div className="text-sm font-medium text-delt-text mt-1 break-all">{value}</div>
    </div>
  );
}
