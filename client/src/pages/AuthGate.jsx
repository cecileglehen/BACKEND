import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import LandingPage from "../components/LandingPage.jsx";
import AuthPage from "../components/AuthPage.jsx";
import MemoryPage from "../components/MemoryPage.jsx";
import ModelPreferencesPage from "../components/ModelPreferencesPage.jsx";

/**
 * Gère le flux pré-authentification + onboarding.
 * Si tout est OK, rend `children`.
 */
export default function AuthGate({ children }) {
  const { user, setUser, authReady } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 0.15, 0.3].map((d) => (
            <span key={d} className="w-2 h-2 rounded-full bg-delt-accent animate-pulse" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    if (!showAuth) return <LandingPage onStart={() => setShowAuth(true)} />;
    return <AuthPage onAuth={(u) => setUser(u)} />;
  }

  // Onboarding : (1) mémoire perso, (2) modèles préférés
  if (user.onboardedModels === false) {
    if (!user.memorySkipped && !user.display_name && !(user.memory_profile && Object.keys(user.memory_profile || {}).length > 0)) {
      return <MemoryPage isOnboarding onSaved={() => setUser({ ...user, memorySkipped: true })} />;
    }
    return (
      <ModelPreferencesPage
        user={user}
        isOnboarding
        onSaved={() => setUser({ ...user, onboardedModels: true })}
      />
    );
  }

  return children;
}
