import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";
import { useT, useLocale } from "../lib/i18n.jsx";
import { INTEG_BRAND_COLORS as BRAND_COLORS, INTEG_COLOR_LOGOS as COLOR_LOGOS } from "../lib/brands.js";

// Catégorie FR → clé translation
const CATEGORY_KEYS = {
  "Email": "cat.email",
  "Stockage": "cat.storage",
  "Agenda": "cat.calendar",
  "Communication": "cat.communication",
  "Productivité": "cat.productivity",
  "Dev": "cat.dev",
  "Projet": "cat.project",
  "Paiement": "cat.payment"
};

export default function IntegrationsPage() {
  const toast = useToast();
  const t = useT();
  const { locale } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyApp, setBusyApp] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { integrations } = await api.listIntegrations();
      setItems(integrations || []);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Au retour OAuth (?integration=xxx&status=success), refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration")) {
      load();
      const url = new URL(window.location.href);
      url.searchParams.delete("integration");
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line
  }, []);

  const handleConnect = async (app) => {
    setBusyApp(app);
    try {
      const { redirectUrl } = await api.connectIntegration(app);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast.success(t("integ.connecting"));
        await load();
      }
    } catch (e) {
      toast.error(t("integ.error_connect", { app, msg: e.message }));
    } finally { setBusyApp(null); }
  };

  const handleDisconnect = async (app) => {
    if (!confirm(t("integ.confirm_disconnect", { app }))) return;
    setBusyApp(app);
    try {
      await api.disconnectIntegration(app);
      toast.success(t("integ.disconnected", { app }));
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusyApp(null); }
  };

  const grouped = items.reduce((acc, it) => {
    (acc[it.category] = acc[it.category] || []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-delt-text">{t("integ.title")}</h2>
        <p className="text-xs text-delt-muted mt-1 leading-relaxed">{t("integ.desc")}</p>
      </div>

      {loading ? (
        <div className="text-sm text-delt-muted text-center py-8">{t("integ.loading")}</div>
      ) : (
        Object.entries(grouped).map(([category, apps]) => (
          <div key={category} className="card p-4 sm:p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-delt-muted mb-3">{CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {apps.map((it) => (
                <div
                  key={it.app}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    it.connected ? "border-emerald-300 bg-emerald-50/40" : "border-delt-border bg-white"
                  }`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-delt-border flex items-center justify-center overflow-hidden">
                    {COLOR_LOGOS[it.app] ? (
                      <img
                        src={COLOR_LOGOS[it.app]}
                        alt={it.label}
                        className="w-7 h-7 object-contain"
                      />
                    ) : (
                      <div
                        className="w-6 h-6"
                        title={it.label}
                        style={{
                          WebkitMaskImage: `url(/brands/${it.app}.svg)`,
                          WebkitMaskSize: "contain",
                          WebkitMaskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          maskImage: `url(/brands/${it.app}.svg)`,
                          maskSize: "contain",
                          maskRepeat: "no-repeat",
                          maskPosition: "center",
                          backgroundColor: BRAND_COLORS[it.app] || "#0F172A"
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-delt-text truncate">{it.label}</div>
                    <div className="text-[11px] text-delt-muted">
                      {it.connected ? (
                        <>{t("integ.connected")} · {new Date(it.connectedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}</>
                      ) : (
                        t("integ.not_connected")
                      )}
                    </div>
                  </div>
                  {it.connected ? (
                    <button
                      onClick={() => handleDisconnect(it.app)}
                      disabled={busyApp === it.app}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {t("integ.disconnect")}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(it.app)}
                      disabled={busyApp === it.app}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-blue-300"
                    >
                      {busyApp === it.app ? "…" : t("integ.connect")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <p className="text-[11px] text-delt-muted italic px-2">
        {t("integ.powered_by")} <a href="https://composio.dev" target="_blank" rel="noopener noreferrer" className="underline">Composio</a>. {t("integ.tokens_note")}
      </p>
    </div>
  );
}
