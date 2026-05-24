import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
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
import ErrorBoundary from "./components/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Routes>
          {/* Pages publiques (indexables Google sans auth) */}
          <Route path="/terms"        element={<LegalPage type="terms" />} />
          <Route path="/privacy"      element={<LegalPage type="privacy" />} />
          <Route path="/notre-modele" element={<OurModelRoute />} />

          {/* Tout le reste passe par AuthGate + Navbar */}
          <Route path="*" element={<AppShell />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  return (
    <AuthGate>
      <div className="h-[100dvh] flex flex-col bg-white overflow-hidden">
        <Navbar />
        <Routes>
          <Route path="/"        element={<ChatPage />} />
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
