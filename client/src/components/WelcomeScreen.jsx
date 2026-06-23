import { useT } from "../lib/i18n.jsx";

export default function WelcomeScreen() {
  const t = useT();
  return (
    <div className="min-h-full flex flex-col items-center justify-start px-4 pt-14 pb-8 sm:pt-16 text-center">
      <img
        src="/logo-delt.png"
        alt="DELT AI"
        className="h-28 sm:h-36 w-auto opacity-90 animate-bounceIn drop-shadow-[0_8px_24px_rgba(99,102,241,0.18)]"
      />
      <h1 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight text-gradient animate-fadeInUp">
        {t("welcome.title")}
      </h1>
    </div>
  );
}
