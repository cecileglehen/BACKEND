import { useLocale } from "../lib/i18n.jsx";

const SECTIONS = {
  privacy: {
    fr: {
      title: "Politique de confidentialité",
      updated: "Dernière mise à jour : 10 mai 2026",
      blocks: [
        ["Responsable du traitement", "DELT AI exploite le service et détermine les finalités de traitement. Les demandes relatives aux données personnelles peuvent être exercées depuis l'espace Confidentialité du compte ou via le contact support officiel."],
        ["Données traitées", "Compte utilisateur, email, mot de passe chiffré, plan, crédits, clés API hashées, historique technique d'usage, paiements PayPal, messages envoyés aux modèles, prompts image/vidéo/code et journaux de sécurité."],
        ["Finalités", "Création de compte, authentification, fourniture du chat et de l'API, facturation, support, sécurité, lutte contre les abus, gestion des droits RGPD et respect des obligations légales."],
        ["Bases légales", "Exécution du contrat pour fournir le service, obligation légale pour la facturation, intérêt légitime pour la sécurité et la prévention des abus, consentement lorsque celui-ci est requis."],
        ["Sous-traitants", "Le service utilise notamment Render pour l'hébergement, Supabase pour la base/authentification, PayPal pour le paiement, Google pour l'OAuth, Composio pour les intégrations tierces (Gmail, Drive, etc.), OpenRouter/Groq et les fournisseurs de modèles pour traiter les prompts."],
        ["Transferts hors UE", "Certains sous-traitants peuvent traiter des données hors Union européenne. Ces transferts sont couverts par les mécanismes contractuels applicables, dont clauses contractuelles types lorsque nécessaire."],
        ["Conservation", "Les données de compte sont conservées pendant la durée d'utilisation du service. Les données de facturation sont conservées selon les obligations légales. Les logs techniques sont purgés selon la politique de conservation définie."],
        ["Droits", "Tu peux demander l'accès, la portabilité, la rectification, l'opposition ou l'effacement de tes données depuis l'espace Confidentialité ou par contact email. Tu peux aussi saisir la CNIL."],
        ["Cookies et stockage local", "Le service utilise le stockage local du navigateur pour la session et l'historique local. Les traceurs non strictement nécessaires sont soumis au consentement avant dépôt."]
      ]
    },
    en: {
      title: "Privacy Policy",
      updated: "Last updated: May 10, 2026",
      blocks: [
        ["Data Controller", "DELT AI operates the service and determines the purposes of processing. Requests regarding personal data can be exercised from the Privacy section of your account or via the official support contact."],
        ["Data Processed", "User account, email, hashed password, plan, credits, hashed API keys, technical usage history, PayPal payments, messages sent to models, image/video/code prompts and security logs."],
        ["Purposes", "Account creation, authentication, providing the chat and API, billing, support, security, abuse prevention, GDPR rights management and compliance with legal obligations."],
        ["Legal Bases", "Contract execution to provide the service, legal obligation for billing, legitimate interest for security and abuse prevention, consent where required."],
        ["Subprocessors", "The service uses Render for hosting, Supabase for database/authentication, PayPal for payment, Google for OAuth, Composio for third-party integrations (Gmail, Drive, etc.), OpenRouter/Groq and model providers to process prompts."],
        ["Transfers Outside EU", "Some subprocessors may process data outside the European Union. These transfers are covered by applicable contractual mechanisms, including standard contractual clauses when necessary."],
        ["Retention", "Account data is retained for the duration of service use. Billing data is retained according to legal obligations. Technical logs are purged according to the defined retention policy."],
        ["Your Rights", "You may request access, portability, rectification, objection or erasure of your data from the Privacy section or by email contact. You may also file a complaint with the CNIL."],
        ["Cookies and Local Storage", "The service uses browser local storage for session and local history. Non-strictly necessary trackers are subject to consent before deposit."]
      ]
    }
  },
  terms: {
    fr: {
      title: "Conditions générales d'utilisation",
      updated: "Dernière mise à jour : 10 mai 2026",
      blocks: [
        ["Objet", "Les présentes conditions encadrent l'accès à DELT AI, au chat multi-modèles, aux crédits et à l'API compatible OpenAI."],
        ["Compte", "L'utilisateur doit fournir des informations exactes, garder ses identifiants confidentiels et signaler tout usage non autorisé."],
        ["Crédits et API", "Les appels API consomment uniquement le solde API transféré depuis le solde du plan. Les coûts affichés en crédits peuvent varier selon le modèle et l'usage."],
        ["Usage interdit", "Sont interdits les usages illicites, abusifs, frauduleux, l'atteinte aux droits de tiers, le contournement des limites techniques et la divulgation de secrets sans autorisation."],
        ["Contenus", "L'utilisateur reste responsable des contenus et données qu'il envoie au service. Il ne doit pas transmettre de données sensibles ou confidentielles sans base légale et mesures adaptées."],
        ["Disponibilité", "Le service dépend de sous-traitants et fournisseurs de modèles. DELT AI peut interrompre ou limiter l'accès pour maintenance, sécurité ou indisponibilité fournisseur."],
        ["Suspension", "Un compte ou une clé API peut être suspendu en cas d'abus, risque de sécurité, impayé ou violation des présentes conditions."],
        ["Contact", "Les demandes liées au compte, à la facturation ou aux données personnelles peuvent être adressées via le support officiel DELT AI."]
      ]
    },
    en: {
      title: "Terms of Service",
      updated: "Last updated: May 10, 2026",
      blocks: [
        ["Scope", "These terms govern access to DELT AI, the multi-model chat, credits and the OpenAI-compatible API."],
        ["Account", "The user must provide accurate information, keep credentials confidential and report any unauthorized use."],
        ["Credits and API", "API calls only consume the API balance transferred from the plan balance. Costs displayed in credits may vary depending on model and usage."],
        ["Prohibited Use", "Illegal, abusive, fraudulent uses, infringement of third-party rights, circumvention of technical limits and disclosure of secrets without authorization are prohibited."],
        ["Content", "The user remains responsible for the content and data they send to the service. They must not transmit sensitive or confidential data without legal basis and appropriate measures."],
        ["Availability", "The service depends on subprocessors and model providers. DELT AI may interrupt or limit access for maintenance, security or provider unavailability."],
        ["Suspension", "An account or API key may be suspended in case of abuse, security risk, unpaid bill or violation of these terms."],
        ["Contact", "Requests related to account, billing or personal data can be sent via the official DELT AI support."]
      ]
    }
  }
};

export default function LegalPage({ type = "privacy" }) {
  const { locale } = useLocale();
  const section = SECTIONS[type] ?? SECTIONS.privacy;
  const page = section[locale] || section.fr;
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-delt-text">{page.title}</h1>
      <p className="text-sm text-delt-muted mt-2">{page.updated}</p>
      <div className="mt-8 space-y-5">
        {page.blocks.map(([title, body]) => (
          <section key={title} className="card p-5">
            <h2 className="text-sm font-semibold text-delt-text">{title}</h2>
            <p className="text-sm text-delt-muted mt-2 leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
