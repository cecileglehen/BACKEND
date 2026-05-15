import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Logo from "./Logo.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const TABS = [
  { to: "/",        label: "Chat" },
  { to: "/code",    label: "Code" },
  { to: "/studio",  label: "Studio" },
  { to: "/billing", label: "Tarifs" }
];

const PLAN_COLORS = {
  ULTRA: "#f59e0b",
  PRO:   "#0891b2",
  PLUS:  "#6366f1",
  BASIC: "#10b981",
  FREE:  "#94a3b8"
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!user) return null;

  const initial = (user.email || "?").trim().charAt(0).toUpperCase();
  const planColor = PLAN_COLORS[user.plan] || PLAN_COLORS.FREE;

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <header className="flex-shrink-0 border-b border-delt-border bg-white sticky top-0 z-30">
      <div className="min-h-14 px-2 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4">
        <Logo />

        <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0 max-w-[58vw] sm:max-w-none">
          {TABS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? "bg-delt-panel text-delt-text" : "text-delt-muted hover:text-delt-text hover:bg-delt-surface/60"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <span
            className="hidden xs:inline-flex text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: planColor }}
          >
            {user.plan}
          </span>
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="w-9 h-9 rounded-full bg-delt-text text-white text-sm font-bold flex items-center justify-center border border-slate-200 shadow-sm transition-transform hover:scale-105 active:scale-95"
              aria-label="Menu profil"
              aria-expanded={open}
            >
              {initial}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1rem)] max-w-64 rounded-xl border border-delt-border bg-white shadow-xl z-50 overflow-hidden animate-slideUp">
                <div className="px-4 py-3 border-b border-delt-border">
                  <div className="text-sm font-semibold text-delt-text truncate">{user.email}</div>
                  <div className="text-xs text-delt-muted mt-0.5 flex items-center gap-1.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: planColor }}
                    />
                    {user.plan}
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); navigate("/settings"); }}
                  className="w-full text-left px-4 py-3 text-sm text-delt-text hover:bg-delt-surface transition-colors flex items-center gap-2"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Paramètres
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-delt-border transition-colors flex items-center gap-2"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
