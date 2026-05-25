import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import Logo from "./Logo.jsx";
import { api, setToken } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { useT, useLocale } from "../lib/i18n.jsx";

export default function AuthPage({ onAuth }) {
  const t = useT();
  const { locale } = useLocale();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleGoogle = async (credentialResponse) => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: sbErr } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: credentialResponse.credential
      });
      if (sbErr) throw new Error(sbErr.message);

      const { token, user } = await api.googleAuth(data.session.access_token, {
        termsAccepted: legalAccepted,
        privacyAccepted: legalAccepted
      });
      setToken(token);
      onAuth(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fn = mode === "login" ? api.login : api.register;
      if (mode === "register" && !legalAccepted) {
        throw new Error(t("auth.terms_required"));
      }
      const { token, user } = await fn(email, password, {
        termsAccepted: legalAccepted,
        privacyAccepted: legalAccepted
      });
      setToken(token);
      onAuth(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4"><Logo /></div>
        <h1 className="text-2xl font-bold text-delt-text">
          {mode === "login" ? t("auth.login") : t("auth.create_account")}
        </h1>
        <p className="text-sm text-delt-muted mt-1">
          {mode === "login" ? t("auth.login_sub") : t("auth.signup_sub")}
        </p>
      </div>

      <div className="card w-full max-w-sm p-6">
        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleGoogle}
            onError={() => setError(t("auth.google_cancelled"))}
            theme="outline"
            size="large"
            width="320"
            text="continue_with"
            locale={locale}
          />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-delt-border" />
          <span className="text-xs text-delt-muted">{t("auth.or")}</span>
          <div className="flex-1 h-px bg-delt-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-delt-muted uppercase tracking-wider mb-1.5">{t("auth.email")}</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email_placeholder")}
              className="w-full rounded-lg border border-delt-border px-3 py-2.5 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-delt-muted uppercase tracking-wider mb-1.5">{t("auth.password")}</label>
            <input
              type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password_placeholder")}
              className="w-full rounded-lg border border-delt-border px-3 py-2.5 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-delt-muted leading-relaxed">
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(e) => setLegalAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t("auth.accept_terms_pre")} <a href="/terms" className="text-delt-accent font-semibold hover:underline">{t("auth.terms_word")}</a> {t("auth.and_the")}{" "}
              <a href="/privacy" className="text-delt-accent font-semibold hover:underline">{t("auth.privacy_word")}</a>.
            </span>
          </label>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-2.5">
            {busy ? t("auth.loading") : mode === "login" ? t("auth.signin_btn") : t("auth.signup_btn")}
          </button>
        </form>

        <div className="divider my-4" />
        <p className="text-xs text-center text-delt-muted">
          {mode === "login" ? t("auth.no_account") : t("auth.already_member")}{" "}
          <button type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="text-delt-accent font-semibold hover:underline cursor-pointer">
            {mode === "login" ? t("auth.signup_link") : t("auth.signin_link")}
          </button>
        </p>
        <p className="text-[11px] text-center text-delt-muted mt-3">
          <a href="/privacy" className="hover:underline">{t("settings.privacy_policy")}</a>
          {" · "}
          <a href="/terms" className="hover:underline">{t("settings.terms")}</a>
        </p>
      </div>
    </div>
  );
}
