import { useLocation, useNavigate } from "react-router-dom";
import SettingsPage from "../components/SettingsPage.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const PATH_TO_SECTION = {
  "/api": "api",
  "/docs": "docs",
  "/privacy-settings": "privacy",
  "/settings": "account"
};

export default function SettingsRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const section = PATH_TO_SECTION[location.pathname] || "account";

  const handleDeleted = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <SettingsPage user={user} initialSection={section} onDeleted={handleDeleted} />
    </div>
  );
}
