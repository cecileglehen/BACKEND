import { useT } from "../lib/i18n.jsx";

const PAYPAL_DONATE_ID = "GNLL9DWV9ML56";

function PayPalDonate() {
  return (
    <form action="https://www.paypal.com/donate" method="post" target="_blank" className="flex justify-center">
      <input type="hidden" name="hosted_button_id" value={PAYPAL_DONATE_ID} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#0070ba] hover:bg-[#005a96] text-white font-bold text-base transition-colors shadow-md hover:shadow-xl"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-7.27 6.082h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.474z"/>
        </svg>
        Faire un don via PayPal
      </button>
    </form>
  );
}

export default function OurModelRoute() {
  const t = useT();

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {t("ourmodel.badge")}
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-delt-text leading-[1.05]">
            DELT 33M
          </h1>
          <p className="mt-3 text-blue-600 text-sm sm:text-base font-medium uppercase tracking-wider">
            {t("ourmodel.subtitle")}
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-8 sm:p-12 shadow-xl mb-10 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight" dangerouslySetInnerHTML={{ __html: t("ourmodel.hero_title") }} />
          <p className="mt-5 text-base sm:text-lg text-blue-50 max-w-2xl mx-auto leading-relaxed">
            {t("ourmodel.hero_sub")}
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="rounded-2xl border border-delt-border bg-white p-5">
            <div className="text-3xl font-extrabold text-delt-text">33M</div>
            <div className="text-xs text-delt-muted mt-1 uppercase tracking-wider font-semibold">{t("ourmodel.stat_params")}</div>
            <p className="text-sm text-delt-muted mt-2">{t("ourmodel.stat_params_desc")}</p>
          </div>
          <div className="rounded-2xl border border-delt-border bg-white p-5">
            <div className="text-3xl font-extrabold text-delt-text">1024</div>
            <div className="text-xs text-delt-muted mt-1 uppercase tracking-wider font-semibold">{t("ourmodel.stat_ctx")}</div>
            <p className="text-sm text-delt-muted mt-2">{t("ourmodel.stat_ctx_desc")}</p>
          </div>
          <div className="rounded-2xl border border-delt-border bg-white p-5">
            <div className="text-3xl font-extrabold text-delt-text">100%</div>
            <div className="text-xs text-delt-muted mt-1 uppercase tracking-wider font-semibold">{t("ourmodel.stat_delt")}</div>
            <p className="text-sm text-delt-muted mt-2">{t("ourmodel.stat_delt_desc")}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-delt-border bg-delt-surface p-6 sm:p-8 mb-10">
          <h3 className="text-xl font-bold text-delt-text mb-3">{t("ourmodel.why_title")}</h3>
          <p className="text-sm sm:text-base text-delt-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: t("ourmodel.why_body") }} />
        </div>

        <div className="rounded-3xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white p-6 sm:p-8 mb-10 text-center shadow-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider mb-4">
            {t("ourmodel.support_badge")}
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-delt-text mb-3">
            {t("ourmodel.support_title")}
          </h3>
          <p className="text-sm sm:text-base text-delt-muted max-w-xl mx-auto leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: t("ourmodel.support_body") }} />

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {[5, 10, 25].map((amt) => (
              <span key={amt} className="px-4 py-2 rounded-full bg-white border border-blue-300 text-blue-700 text-sm font-semibold">
                {amt}€
              </span>
            ))}
            <span className="px-4 py-2 rounded-full bg-white border border-blue-300 text-blue-700 text-sm font-semibold">
              {t("ourmodel.support_free")}
            </span>
          </div>

          <PayPalDonate />

          <p className="text-xs text-delt-muted mt-4">
            {t("ourmodel.support_secure")}
          </p>
        </div>

        <div className="text-center">
          <a
            href="/billing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-delt-text hover:bg-black text-white font-semibold transition-colors shadow-md hover:shadow-lg"
          >
            {t("ourmodel.cta_billing")}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </a>
          <p className="text-xs text-delt-muted mt-3">
            {t("ourmodel.cta_billing_sub")}
          </p>
        </div>

      </div>
    </div>
  );
}
