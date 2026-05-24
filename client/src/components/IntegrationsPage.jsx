import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../contexts/ToastContext.jsx";

// Couleurs officielles de chaque marque (simpleicons brand colors)
const BRAND_COLORS = {
  gmail:          "#EA4335",
  googledrive:    "#4285F4",
  googlecalendar: "#4285F4",
  slack:          "#4A154B",
  notion:         "#000000",
  github:         "#181717",
  linear:         "#5E6AD2",
  trello:         "#0079BF",
  discord:        "#5865F2",
  stripe:         "#635BFF"
};

// Logos couleur officiels (PNG/SVG natifs). Si présent → on l'affiche tel quel
// au lieu du mask monochrome avec couleur appliquée.
const COLOR_LOGOS = {
  gmail: "/brands/gmail-color.png"
};

export default function IntegrationsPage() {
  const toast = useToast();
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
        toast.success("Connexion en cours…");
        await load();
      }
    } catch (e) {
      toast.error(`Erreur connexion ${app} : ${e.message}`);
    } finally { setBusyApp(null); }
  };

  const handleDisconnect = async (app) => {
    if (!confirm(`Déconnecter ${app} ? L'IA n'aura plus accès à ce service.`)) return;
    setBusyApp(app);
    try {
      await api.disconnectIntegration(app);
      toast.success(`${app} déconnecté`);
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
        <h2 className="text-sm font-semibold text-delt-text">Intégrations</h2>
        <p className="text-xs text-delt-muted mt-1 leading-relaxed">
          Connecte tes apps pour que l'IA puisse y accéder dans tes conversations
          (lire tes mails, ajouter un événement Calendar, créer une page Notion, etc.).
          Tu peux déconnecter à tout moment — Delt AI ne stocke aucun de tes contenus.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-delt-muted text-center py-8">Chargement…</div>
      ) : (
        Object.entries(grouped).map(([category, apps]) => (
          <div key={category} className="card p-4 sm:p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-delt-muted mb-3">{category}</h3>
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
                        <>✓ Connecté · {new Date(it.connectedAt).toLocaleDateString("fr-FR")}</>
                      ) : (
                        "Non connecté"
                      )}
                    </div>
                  </div>
                  {it.connected ? (
                    <button
                      onClick={() => handleDisconnect(it.app)}
                      disabled={busyApp === it.app}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      Déconnecter
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(it.app)}
                      disabled={busyApp === it.app}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-blue-300"
                    >
                      {busyApp === it.app ? "…" : "Connecter"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <p className="text-[11px] text-delt-muted italic px-2">
        Propulsé par <a href="https://composio.dev" target="_blank" rel="noopener noreferrer" className="underline">Composio</a>. Les tokens OAuth sont gérés et chiffrés par Composio — Delt AI ne les voit jamais.
      </p>
    </div>
  );
}
