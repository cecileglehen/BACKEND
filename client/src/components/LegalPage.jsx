const SECTIONS = {
  privacy: {
    title: "Politique de confidentialite",
    updated: "Derniere mise a jour : 10 mai 2026",
    blocks: [
      ["Responsable du traitement", "DELT AI exploite le service et determine les finalites de traitement. Les demandes relatives aux donnees personnelles peuvent etre exercees depuis l'espace Confidentialite du compte ou via le contact support officiel."],
      ["Donnees traitees", "Compte utilisateur, email, mot de passe chiffre, plan, credits, cles API hashees, historique technique d'usage, paiements PayPal, messages envoyes aux modeles, prompts image/video/code et journaux de securite."],
      ["Finalites", "Creation de compte, authentification, fourniture du chat et de l'API, facturation, support, securite, lutte contre les abus, gestion des droits RGPD et respect des obligations legales."],
      ["Bases legales", "Execution du contrat pour fournir le service, obligation legale pour la facturation, interet legitime pour la securite et la prevention des abus, consentement lorsque celui-ci est requis."],
      ["Sous-traitants", "Le service utilise notamment Render pour l'hebergement, Supabase pour la base/authentification, PayPal pour le paiement, Google pour l'OAuth, OpenRouter/Groq et les fournisseurs de modeles pour traiter les prompts."],
      ["Transferts hors UE", "Certains sous-traitants peuvent traiter des donnees hors Union europeenne. Ces transferts doivent etre couverts par les mecanismes contractuels applicables, dont clauses contractuelles types lorsque necessaire."],
      ["Conservation", "Les donnees de compte sont conservees pendant la duree d'utilisation du service. Les donnees de facturation sont conservees selon les obligations legales. Les logs techniques doivent etre purges selon la politique de conservation definie."],
      ["Droits", "Tu peux demander l'acces, la portabilite, la rectification, l'opposition ou l'effacement de tes donnees depuis l'espace Confidentialite ou par contact email. Tu peux aussi saisir la CNIL."],
      ["Cookies et stockage local", "Le service utilise le stockage local du navigateur pour la session et l'historique local. Les traceurs non strictement necessaires doivent etre soumis au consentement avant depot."]
    ]
  },
  terms: {
    title: "Conditions generales d'utilisation",
    updated: "Derniere mise a jour : 10 mai 2026",
    blocks: [
      ["Objet", "Les presentes conditions encadrent l'acces a DELT AI, au chat multi-modeles, aux credits et a l'API compatible OpenAI."],
      ["Compte", "L'utilisateur doit fournir des informations exactes, garder ses identifiants confidentiels et signaler tout usage non autorise."],
      ["Credits et API", "Les appels API consomment uniquement le solde API transfere depuis le solde du plan. Les couts affiches en credits peuvent varier selon le modele et l'usage."],
      ["Usage interdit", "Sont interdits les usages illicites, abusifs, frauduleux, l'atteinte aux droits de tiers, le contournement des limites techniques et la divulgation de secrets sans autorisation."],
      ["Contenus", "L'utilisateur reste responsable des contenus et donnees qu'il envoie au service. Il ne doit pas transmettre de donnees sensibles ou confidentielles sans base legale et mesures adaptees."],
      ["Disponibilite", "Le service depend de sous-traitants et fournisseurs de modeles. DELT AI peut interrompre ou limiter l'acces pour maintenance, securite ou indisponibilite fournisseur."],
      ["Suspension", "Un compte ou une cle API peut etre suspendu en cas d'abus, risque de securite, impaye ou violation des presentes conditions."],
      ["Contact", "Les demandes liees au compte, a la facturation ou aux donnees personnelles peuvent etre adressees via le support officiel DELT AI."]
    ]
  }
};

export default function LegalPage({ type = "privacy" }) {
  const page = SECTIONS[type] ?? SECTIONS.privacy;
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
