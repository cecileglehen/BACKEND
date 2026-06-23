import { useState, useEffect } from "react";

// Bandeau de consentement cookies RGPD : accepter / refuser / personnaliser.
// Le consentement est stocké 6 mois. Les traceurs non essentiels ne doivent être
// activés qu'après acceptation (lire window.__deltConsent ou l'event "delt:consent").
const KEY = "delt_cookie_consent";
const MAX_AGE = 1000 * 60 * 60 * 24 * 30 * 6; // 6 mois

function readConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!c || !c.ts || Date.now() - c.ts > MAX_AGE) return null;
    return c;
  } catch { return null; }
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(false); // panneau "personnaliser"
  const [analytics, setAnalytics] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);

  useEffect(() => {
    if (!readConsent()) setOpen(true);
    const reopen = () => { setPrefs(true); setOpen(true); };
    window.addEventListener("delt:cookie-settings", reopen);
    return () => window.removeEventListener("delt:cookie-settings", reopen);
  }, []);

  const save = (consent) => {
    const value = { ...consent, necessary: true, ts: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* */ }
    window.__deltConsent = value;
    window.dispatchEvent(new CustomEvent("delt:consent", { detail: value }));
    setOpen(false); setPrefs(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4">
      <div className="max-w-3xl mx-auto rounded-2xl bg-[#0d0d18] text-white border border-white/15 shadow-2xl p-4 sm:p-5">
        {!prefs ? (
          <>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🍪</span>
              <div className="text-[13px] leading-relaxed text-white/80">
                Nous utilisons des cookies et le stockage local <b className="text-white">strictement nécessaires</b> au
                fonctionnement du service, et — avec votre accord — des traceurs de mesure d'audience et fonctionnalités tierces.
                Voir notre <a href="/cookies" className="underline text-white">politique cookies</a>.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 justify-end">
              <button onClick={() => setPrefs(true)} className="px-3.5 py-2 rounded-full text-[13px] font-semibold text-white/80 hover:text-white hover:bg-white/10">Personnaliser</button>
              <button onClick={() => save({ analytics: false, thirdParty: false })} className="px-4 py-2 rounded-full text-[13px] font-semibold border border-white/20 hover:bg-white/10">Tout refuser</button>
              <button onClick={() => save({ analytics: true, thirdParty: true })} className="px-4 py-2 rounded-full text-[13px] font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>Tout accepter</button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[14px] font-bold mb-3">Préférences cookies</div>
            <div className="space-y-2.5">
              <Row title="Strictement nécessaires" desc="Session, sécurité, paiement. Indispensables." locked checked />
              <Row title="Mesure d'audience" desc="Statistiques d'utilisation anonymisées." checked={analytics} onChange={setAnalytics} />
              <Row title="Fonctionnalités tierces" desc="Connexion Google et intégrations activées volontairement." checked={thirdParty} onChange={setThirdParty} />
            </div>
            <div className="flex flex-wrap gap-2 mt-4 justify-end">
              <button onClick={() => save({ analytics: false, thirdParty: false })} className="px-4 py-2 rounded-full text-[13px] font-semibold border border-white/20 hover:bg-white/10">Tout refuser</button>
              <button onClick={() => save({ analytics, thirdParty })} className="px-4 py-2 rounded-full text-[13px] font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)" }}>Enregistrer mes choix</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ title, desc, checked, onChange, locked }) {
  return (
    <label className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5 ${locked ? "opacity-70" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={locked} onChange={(e) => onChange?.(e.target.checked)}
        className="w-4 h-4 accent-indigo-500 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{title}{locked && <span className="ml-2 text-[10px] text-white/40">(toujours actif)</span>}</div>
        <div className="text-[11px] text-white/50">{desc}</div>
      </div>
    </label>
  );
}
