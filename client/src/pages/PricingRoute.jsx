import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Pricing from "../components/Pricing.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

export default function PricingRoute() {
  const { user, refreshUser, refreshQuota } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Fallback : retour PayPal /subscribe/success?plan=...&subscription_id=...
  useEffect(() => {
    if (!user) return;
    if (location.pathname !== "/subscribe/success") return;
    const params = new URLSearchParams(location.search);
    const plan = params.get("plan");
    const sub = params.get("subscription_id") || params.get("sub");

    if (plan && sub) {
      api.confirmSubscription(plan, sub)
        .then(async () => {
          await refreshUser();
          await refreshQuota();
          toast.success(`Abonnement ${plan} activé !`);
        })
        .catch((e) => toast.error("Erreur : " + e.message));
    }
    navigate("/billing", { replace: true });
  }, [user, location, navigate, refreshUser, refreshQuota, toast]);

  return (
    <div className="flex-1 overflow-y-auto">
      <Pricing
        user={user}
        onSubscribed={async (plan) => {
          try {
            await refreshUser();
            await refreshQuota();
            toast.success(`Abonnement ${plan} activé ! Tes crédits sont crédités.`);
          } catch (e) {
            toast.error(e.message);
          }
        }}
      />
    </div>
  );
}
