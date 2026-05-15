import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../lib/api.js";

const AuthContext = createContext(null);

function getCachedUser() {
  try {
    const raw = localStorage.getItem("delt_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const initialUser = getToken() ? getCachedUser() : null;
  const [user, setUserState] = useState(initialUser);
  const [authReady, setAuthReady] = useState(Boolean(initialUser));
  const [credits, setCredits] = useState(null);

  const setUser = useCallback((u) => {
    setUserState(u);
    if (u) localStorage.setItem("delt_user", JSON.stringify(u));
    else localStorage.removeItem("delt_user");
  }, []);

  const refreshQuota = useCallback(async () => {
    if (!user) return;
    try {
      const q = await api.quota();
      setCredits(q.credits ?? 0);
    } catch { /* silencieux */ }
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
      return u;
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        setToken(null);
        setUser(null);
      }
      return null;
    }
  }, [setUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("delt_user");
  }, [setUser]);

  // Validation initiale du token
  useEffect(() => {
    if (getToken()) {
      api.me()
        .then((u) => setUser(u))
        .catch((e) => {
          if (e.status === 401 || e.status === 403) {
            setToken(null);
            setUser(null);
          }
        })
        .finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
  }, [setUser]);

  // Charge le quota quand l'utilisateur est connu
  useEffect(() => { refreshQuota(); }, [refreshQuota]);

  const value = {
    user, setUser, authReady,
    credits, setCredits, refreshQuota,
    refreshUser, logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
