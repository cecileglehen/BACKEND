import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import Logo from "./Logo.jsx";
import { api, setToken } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleGoogle = async (credentialResponse) => {
    setError(null);
    setBusy(true);
    try {
      // Envoie l'ID token Google à Supabase Auth (HTTP, pas de pg)
      const { data, error: sbErr } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: credentialResponse.credential
      });
      if (sbErr) throw new Error(sbErr.message);

      // Envoie le token Supabase à notre backend pour obtenir le JWT DELT
      const { token, user } = await api.googleAuth(data.session.access_token);
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
      const { token, user } = await fn(email, password);
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
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className="text-sm text-delt-muted mt-1">
          {mode === "login" ? "Accède à tous les meilleurs modèles d'IA." : "Commence gratuitement avec le plan LITE."}
        </p>
      </div>

      <div className="card w-full max-w-sm p-6">
        {/* Google OAuth — ID token direct vers Supabase Auth */}
        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleGoogle}
            onError={() => setError("Connexion Google annulée.")}
            theme="outline"
            size="large"
            width="320"
            text="continue_with"
            locale="fr"
          />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-delt-border" />
          <span className="text-xs text-delt-muted">ou</span>
          <div className="flex-1 h-px bg-delt-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-delt-muted uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.fr"
              className="w-full rounded-lg border border-delt-border px-3 py-2.5 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-delt-muted uppercase tracking-wider mb-1.5">Mot de passe</label>
            <input
              type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              className="w-full rounded-lg border border-delt-border px-3 py-2.5 text-sm outline-none focus:border-delt-accent focus:ring-1 focus:ring-delt-accent/20 transition-all"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-2.5">
            {busy ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <div className="divider my-4" />
        <p className="text-xs text-center text-delt-muted">
          {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
          <button type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="text-delt-accent font-semibold hover:underline cursor-pointer">
            {mode === "login" ? "S'inscrire" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}
