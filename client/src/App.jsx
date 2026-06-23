import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { I18nProvider } from "./lib/i18n.jsx";
import AuthGate from "./pages/AuthGate.jsx";
import Navbar from "./components/Navbar.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import CodeStudio from "./components/CodeStudio.jsx";
import ArtistStudio from "./components/ArtistStudio.jsx";
import LegalPage from "./components/LegalPage.jsx";
import PricingRoute from "./pages/PricingRoute.jsx";
import SettingsRoute from "./pages/SettingsRoute.jsx";
import OurModelRoute from "./pages/OurModelRoute.jsx";
import ThanksRoute from "./pages/ThanksRoute.jsx";
import GoodbyeRoute from "./pages/GoodbyeRoute.jsx";
import IntroRoute from "./pages/IntroRoute.jsx";
import AgentsPage from "./components/AgentsPage.jsx";
import LaunchIDE from "./pages/LaunchIDE.jsx";
import LaunchLanding from "./pages/LaunchLanding.jsx";
import CookieConsent from "./components/CookieConsent.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Launch est un produit à part : accessible uniquement sur le sous-domaine
// launch.deltai.fr (launch.lvh.me en dev — TLD public requis par Google OAuth),
// jamais dans la nav principale.
const IS_LAUNCH_HOST =
  typeof window !== "undefined" && /^launch\./i.test(window.location.hostname);

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <CookieConsent />
            {IS_LAUNCH_HOST ? (
              <LaunchHost />
            ) : (
              <Routes>
                {/* Pages publiques (indexables Google sans auth) */}
                <Route path="/terms"            element={<LegalPage type="terms" />} />
                <Route path="/privacy"          element={<LegalPage type="privacy" />} />
                <Route path="/mentions-legales" element={<LegalPage type="legal" />} />
                <Route path="/cookies"          element={<LegalPage type="cookies" />} />
                <Route path="/notre-modele" element={<OurModelRoute />} />

                {/* Tout le reste passe par AuthGate + Navbar */}
                <Route path="*" element={<AppShell />} />
              </Routes>
            )}
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

// Coquille du sous-domaine Launch : landing publique (visiteurs non connectés) →
// CTA → auth → IDE plein écran. Les users déjà connectés vont direct à l'IDE.
function LaunchHost() {
  const { user } = useAuth();
  const [started, setStarted] = useState(false);
  if (!user && !started) return <LaunchLanding onStart={() => setStarted(true)} />;
  return (
    <AuthGate launchMode>
      <div className="h-[100dvh] flex flex-col overflow-hidden">
        <LaunchIDE />
      </div>
    </AuthGate>
  );
}

function AppShell() {
  return (
    <AuthGate>
      <div className="h-[100dvh] flex flex-col overflow-hidden">
        <Navbar />
        <Routes>
          <Route path="/"        element={<ChatPage />} />
          <Route path="/agents"  element={<AgentsPage />} />
          <Route path="/code"    element={<CodeStudioRoute />} />
          <Route path="/studio"  element={<ArtistStudioRoute />} />
          <Route path="/notre-modele"      element={<OurModelRoute />} />
          <Route path="/thanks"            element={<ThanksRoute />} />
          <Route path="/goodbye"           element={<GoodbyeRoute />} />
          <Route path="/intro"             element={<IntroRoute />} />
          <Route path="/billing"           element={<PricingRoute />} />
          <Route path="/subscribe/success" element={<PricingRoute />} />
          <Route path="/settings"          element={<SettingsRoute />} />
          <Route path="/api"               element={<SettingsRoute />} />
          <Route path="/docs"              element={<SettingsRoute />} />
          <Route path="/privacy-settings"  element={<SettingsRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthGate>
  );
}

function CodeStudioRoute() {
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <CodeStudio />
    </div>
  );
}

function ArtistStudioRoute() {
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <ArtistStudio />
    </div>
  );
}
